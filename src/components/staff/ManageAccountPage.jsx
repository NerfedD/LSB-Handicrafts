import { useState } from "react";

import { ArrowLeft, Save, UserCheck, UserCog, UserX } from "../icons";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import Callout, { DangerBlock } from "../shared/Callout";
import { Avatar } from "../shared/Chip";
import ConfirmDialog from "../shared/ConfirmDialog";
import { Field, FormBand, FormFooter, LockedField } from "../shared/forms";
import { NotFoundState } from "../shared/PageStates";
import StatusPill from "../shared/StatusPill";
import { roleLabel, signInState } from "../../utils/copy";

/**
 * Manage one account — screen 2p.
 *
 * THE STATUS CALLOUT LEADS, and it says the thing an administrator opening a
 * blocked account most needs to hear: THEIR PASSWORD STILL WORKS. Without that
 * line the natural conclusion is that unblocking also means resetting a
 * password and telling somebody a new one, which is two unnecessary phone calls
 * per block.
 *
 * THE EMAIL IS LOCKED AND SAYS WHY. It is how the person signs in, so changing
 * it here is not an edit to a detail — it would lock them out. A greyed box
 * with no explanation reads as a bug; a lock glyph plus one line reads as a
 * rule.
 *
 * REMOVING AN ACCOUNT IS ITS OWN BLOCK AT THE BOTTOM. Rule 6, and the strongest
 * case for it in the app: it names the person, states exactly what happens AND
 * what survives ("orders and stock records they made stay exactly as they are"),
 * says it cannot be undone, and puts the button inside a red-outlined card of
 * its own. Never a bin icon beside "Edit" in a table row.
 */

export default function ManageAccountPage({
  account,
  currentUserEmail,
  onBack,
  onChangeRole,
  onStatusChange,
  onSaveDetails,
  onDelete,
}) {
  const [name, setName] = useState(account?.name ?? "");
  const [contactNumber, setContactNumber] = useState(account?.contactNumber ?? "");
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState(null); // "block" | "unblock" | "delete" | null
  const [working, setWorking] = useState(false);

  if (!account) return <NotFoundState noun="account" onBack={onBack} />;

  const signIn = signInState(account);
  const isBlocked = account.status === "Blocked";
  // Blocking is enforced at sign-in, so blocking your own account would lock
  // you out on the next visit with no way back unless somebody else has access.
  const isSelf = Boolean(account.email) && account.email === currentUserEmail;
  const first = String(account.name || "This person").split(" ")[0];

  const changed = name !== account.name || contactNumber !== (account.contactNumber ?? "");

  async function handleSaveDetails(event) {
    event.preventDefault();
    if (!changed || saving) return;
    setSaving(true);
    await onSaveDetails?.({ name, contactNumber });
    setSaving(false);
  }

  async function runConfirm() {
    setWorking(true);
    if (confirm === "delete") await onDelete?.(account);
    else await onStatusChange?.(confirm === "block" ? "Blocked" : "Active");
    setWorking(false);
    setConfirm(null);
  }

  return (
    <div className="flex flex-col gap-4">
      <Button variant="ghost" size="sm" className="self-start px-2" onClick={onBack}>
        <ArrowLeft className="h-5 w-5" />
        All staff accounts
      </Button>

      {/* ---- who this is, and whether they can get in ---- */}
      <Card className="p-5.5">
        <div className="flex flex-wrap items-center gap-4">
          <Avatar name={account.name} size="xl" />
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-[23px] font-extrabold tracking-[-0.02em] text-ink">
              {account.name}
            </h2>
            <p className="pt-1 text-[15.5px] text-muted">{account.email}</p>
          </div>
          <StatusPill label={signIn.label} tone={signIn.tone} mark={signIn.icon} />
        </div>
      </Card>

      {isBlocked && (
        <Callout
          tone="red"
          icon={<UserX />}
          title={`${first} cannot sign in right now`}
          action={
            <Button variant="green" size="lg" onClick={() => setConfirm("unblock")}>
              <UserCheck className="h-5 w-5" />
              Let {first} sign in again
            </Button>
          }
        >
          {/* "Their password still works" is the load-bearing sentence. Without
              it the natural assumption is that unblocking also means issuing a
              new password, which is two unnecessary phone calls per block. */}
          An administrator blocked this account.{" "}
          <strong className="font-bold">Their password still works</strong> — unblocking is
          all that is needed, and they will not have to be told anything new.
        </Callout>
      )}

      {!account.role && (
        <Callout
          tone="amber"
          icon={<UserCog />}
          title={`Nobody has said what ${first} does`}
          action={
            <Button variant="cobalt" size="lg" onClick={onChangeRole}>
              Say what {first} does
            </Button>
          }
        >
          The password works, but with no job set there is nothing to let them into — so
          signing in will fail with no explanation on their end.
        </Callout>
      )}

      {/* ---- their details ---- */}
      <Card>
        <form onSubmit={handleSaveDetails}>
          <FormBand title="Their details">
            <Field label="Full name">
              {(props) => (
                <Input
                  {...props}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              )}
            </Field>

            <LockedField
              label="Email address"
              value={account.email}
              hint="Email cannot be changed here — it is how they sign in."
            />

            <Field label="Phone number" hint="So colleagues can reach them without asking around.">
              {(props) => (
                <Input
                  {...props}
                  inputMode="tel"
                  value={contactNumber}
                  onChange={(event) => setContactNumber(event.target.value)}
                  placeholder="09XX XXX XXXX"
                />
              )}
            </Field>

            <Field label="What they do" hint="This decides which screens they can open.">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-[16.5px] font-bold text-ink">
                  {account.role ? roleLabel(account.role) : "Nothing set yet"}
                </span>
                <Button variant="outline" size="sm" onClick={onChangeRole}>
                  <UserCog className="h-4.5 w-4.5" />
                  Change this
                </Button>
              </div>
            </Field>
          </FormBand>

          <FormFooter
            left={
              <Button variant="outline" size="lg" onClick={onBack}>
                Cancel
              </Button>
            }
            right={
              <>
                {!isBlocked && !isSelf && !account.isSuperAdmin && (
                  <Button variant="outline" size="lg" onClick={() => setConfirm("block")}>
                    <UserX className="h-5 w-5" />
                    Stop {first} signing in
                  </Button>
                )}
                <Button type="submit" variant="cobalt" size="lg" disabled={!changed || saving}>
                  <Save className="h-5 w-5" />
                  {saving ? "Saving…" : "Save changes"}
                </Button>
              </>
            }
          />
        </form>
      </Card>

      {/* ---- the only place an account can be removed ---- */}
      {!isSelf && !account.isSuperAdmin && (
        <DangerBlock
          title="Remove this account for good"
          action={
            <Button variant="danger" size="lg" onClick={() => setConfirm("delete")}>
              Remove {account.name}
            </Button>
          }
        >
          {account.name} disappears from the staff list and their sign-in stops working.
          Orders and stock records they made stay exactly as they are. This cannot be
          undone.
          <br />
          <br />
          If they have simply left for a while, stopping them signing in is the reversible
          option and keeps the account ready for their return.
        </DangerBlock>
      )}

      <ConfirmDialog
        open={confirm === "delete"}
        onOpenChange={(next) => !next && setConfirm(null)}
        title={`Remove ${account.name}?`}
        consequences={
          <>
            {account.name} disappears from the staff list and can no longer sign in. Orders
            and stock records they made stay exactly as they are. This cannot be undone.
          </>
        }
        confirmLabel="Yes, remove them"
        busy={working}
        onConfirm={runConfirm}
      />

      <ConfirmDialog
        open={confirm === "block"}
        onOpenChange={(next) => !next && setConfirm(null)}
        title={`Stop ${account.name} signing in?`}
        consequences={
          <>
            They will not be able to get in until somebody unblocks them. Their password is
            not changed and nothing they have made is affected, so this can be undone at any
            time.
          </>
        }
        confirmLabel="Yes, block them"
        busy={working}
        onConfirm={runConfirm}
      />

      <ConfirmDialog
        open={confirm === "unblock"}
        onOpenChange={(next) => !next && setConfirm(null)}
        intent="forward"
        title={`Let ${account.name} sign in again?`}
        consequences={
          <>
            They will be able to get in straight away with the password they already have.
            Nothing needs to be sent to them.
          </>
        }
        confirmLabel="Yes, let them in"
        keepLabel="Not yet"
        busy={working}
        onConfirm={runConfirm}
      />
    </div>
  );
}
