import { useState } from "react";

import { FloppyDisk } from "../icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, LockedInput } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { DangerBlock } from "../shared/Callout";
import { Avatar } from "../shared/Chip";
import ConfirmDialog from "../shared/ConfirmDialog";
import { Field } from "../shared/forms";
import { NotFoundState } from "../shared/PageStates";
import { Page, PageHeader, TextLink } from "../shared/page";
import StatusPill from "../shared/StatusPill";
import { RoleChoices } from "./RoleChoices";
import { supabase } from "../../lib/supabaseClient";
import { guardForm } from "../../utils/formErrors";
import { sameEmail } from "../../utils/email";
import { nameProblem } from "../../utils/validation";
import { ACTIVITY_KIND, timeLabel, whenLabel } from "../../utils/activityLog";
import { roleLabel, signInState } from "../../utils/copy";
import { cleanPhoneInput, localPhoneDigits, phoneProblem } from "../../utils/phone";
import { formatShortDate } from "../../utils/profileFormat";

/**
 * One account, drawn to the "12 · Account details (edit)" board:
 *
 *   Back to User Management → the profile header (avatar, name, role,
 *   access; Discard, Save changes) → Their details → Role → Signing in →
 *   removing the account, beside this month's activity and recent activity.
 *
 * Name, phone and role save together through the app's own handlers; the
 * sign-in switch blocks or unblocks the account after a confirmation. The
 * sign-in email cannot change here, and the app records no position or start
 * date, so those fields are read-only.
 *
 * "Send password reset" posts a reset link to the account's OWN email address,
 * so an administrator can start the recovery without ever learning or setting
 * the password themselves. "Sign out everywhere" ends every session of this
 * account's login (public.sign_out_staff): no device of theirs can renew its
 * access, though one already open keeps working until its token runs out, an
 * hour at most. Blocking the account is what keeps somebody out for good.
 */
const DEPARTMENT = { Admin: "Office", Manager: "Office", "Sales Staff": "Sales", "Production Staff": "Production", "Delivery Staff": "Delivery" };

function Panel({ id, title, description, action, children }) {
  return (
    <section aria-labelledby={id} className="rounded-lg border border-border bg-card shadow-xs">
      <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3.5">
        <div className="min-w-0">
          <h2 id={id} className="m-0 text-sm font-semibold">{title}</h2>
          {description ? <p className="m-0 text-13 text-muted-fg">{description}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export default function ManageAccountPage({
  account,
  activity = [],
  currentUserEmail,
  onBack,
  onSaveRole,
  onStatusChange,
  onSaveDetails,
  onDelete,
  onOpenActivity,
  onCompareRoles,
  /** Ends every session of this account's login; absent for your own account. */
  onSignOutEverywhere,
}) {
  const [name, setName] = useState(account?.name ?? "");
  const [revision] = useState(account?.revision ?? 0);
  const seededPhone = localPhoneDigits(account?.contactNumber ?? "");
  const [contactNumber, setContactNumber] = useState(seededPhone);
  const [role, setRole] = useState(account?.role ?? "");
  const [saving, setSaving] = useState(false);
  const [phoneError, setPhoneError] = useState(null);
  const [nameError, setNameError] = useState(null);
  const [confirm, setConfirm] = useState(null); // "block" | "unblock" | "delete" | null
  const [working, setWorking] = useState(false);
  const [now] = useState(() => Date.now());
  // "idle" | "sending" | "sent" | "failed" -- a reset is a one-shot action with
  // no record on the row, so its outcome lives here rather than in the account.
  const [reset, setReset] = useState("idle");
  // The same one-shot shape for ending their sessions.
  const [ending, setEnding] = useState("idle");
  const [endingMessage, setEndingMessage] = useState(null);

  async function signOutEverywhere() {
    if (!onSignOutEverywhere || ending === "working") return;
    setEnding("working");
    setEndingMessage(null);
    try {
      const result = await onSignOutEverywhere(account);
      setEnding(result?.ok ? "done" : "failed");
      setEndingMessage(result?.ok
        ? result.ended > 0
          ? `Signed out of ${result.ended === 1 ? "1 device" : `${result.ended} devices`}. A screen already open can keep working for up to an hour.`
          : "They were not signed in anywhere."
        : result?.message || "They are still signed in. Try again.");
    } catch {
      setEnding("failed");
      setEndingMessage("We could not reach the system, so nothing was signed out.");
    }
  }

  async function sendPasswordReset() {
    if (reset === "sending" || reset === "sent" || !account?.email) return;
    setReset("sending");
    try {
      // The link goes to the account holder's own inbox, never to the
      // administrator who pressed this, so it cannot be used to take an
      // account over -- it only saves a phone call to the person who is
      // locked out. Same call the sign-in screen's "Forgot password" makes.
      const { error } = await supabase.auth.resetPasswordForEmail(account.email, {
        redirectTo: window.location.origin,
      });
      setReset(error ? "failed" : "sent");
    } catch {
      setReset("failed");
    }
  }

  if (!account) return <NotFoundState noun="account" onBack={onBack} />;

  const signIn = signInState(account);
  const isBlocked = account.status === "Blocked";
  const isSelf = sameEmail(account.email, currentUserEmail);
  const roleLocked = isSelf || account.isSuperAdmin;
  const first = String(account.name || "This person").split(" ")[0];
  const detailsChanged = name !== account.name || contactNumber !== seededPhone;
  const roleChanged = Boolean(role) && role !== account.role;
  const dirty = detailsChanged || roleChanged;

  const mine = activity.filter((entry) => entry.who === account.name);
  const lastSignIn = mine.find((entry) => entry.kind === ACTIVITY_KIND.SIGN_IN);
  const monthStart = new Date(now);
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const thisMonth = mine.filter((entry) => entry.at && new Date(entry.at).getTime() >= monthStart.getTime());
  const countOf = (kind) => thisMonth.filter((entry) => entry.kind === kind).length;
  const month = monthStart.toLocaleDateString("en-US", { month: "long" });

  async function save(event) {
    event?.preventDefault();
    const form = document.getElementById("account-form");
    if (form && !guardForm(form)) return;
    const problem = phoneProblem(contactNumber);
    setPhoneError(problem);
    const nameIssue = nameProblem(name, { label: "Their name", max: 120 });
    setNameError(nameIssue);
    if (problem || nameIssue || !dirty || saving) return;
    setSaving(true);
    // One write when both changed: the account carries a revision, and a
    // second write against the same revision would be refused as stale.
    const withRole = roleChanged && !roleLocked;
    if (detailsChanged) await onSaveDetails?.({ name, contactNumber, ...(withRole ? { role } : {}), revision });
    else if (withRole) await onSaveRole?.(role, revision);
    setSaving(false);
  }

  const discard = () => {
    setName(account.name ?? "");
    setContactNumber(seededPhone);
    setRole(account.role ?? "");
    setNameError(null);
    setPhoneError(null);
  };

  async function runConfirm() {
    setWorking(true);
    if (confirm === "delete") await onDelete?.(account);
    else await onStatusChange?.(confirm === "block" ? "Blocked" : "Active", revision);
    setWorking(false);
    setConfirm(null);
  }

  return (
    <Page>
      <PageHeader
        back={{ label: "Back to User Management", onClick: onBack }}
        leading={<Avatar name={account.name} size="lg" />}
        title={account.name}
        titleBadge={
          <span className="inline-flex flex-wrap items-center gap-2">
            <Badge variant="outline">{roleLabel(account.role)}</Badge>
            <StatusPill label={signIn.label === "Yes" ? "Active" : signIn.label === "Blocked" ? "Suspended" : "Not set up"} tone={signIn.label === "Yes" ? "green" : signIn.label === "Blocked" ? "red" : "amber"} />
            {isSelf ? <Badge variant="outline">You</Badge> : null}
          </span>
        }
        description={`${roleLabel(account.role)} · ${DEPARTMENT[account.role] ?? "No department"} · ${account.email}${lastSignIn ? ` · Last signed in ${whenLabel(lastSignIn.at).toLowerCase()}` : ""}`}
        actions={
          <>
            {dirty ? <Badge variant="warning">Unsaved changes</Badge> : null}
            <Button variant="outline" onClick={discard} disabled={!dirty || saving}>Discard</Button>
            <Button onClick={save} disabled={!dirty || saving}>
              <FloppyDisk aria-hidden="true" />
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </>
        }
      />

      <div className="flex flex-col items-start gap-4 lg:flex-row">
        <div className="flex w-full min-w-0 flex-1 flex-col gap-4">
          <Panel id="ad-details" title="Their details" description="Shown in the staff directory and on anything they record.">
            <form id="account-form" onSubmit={save} noValidate className="grid gap-3.5 px-4 py-4 sm:grid-cols-2">
              <Field label="Full name" error={nameError}>
                {(props) => <Input {...props} required maxLength={120} value={name} onChange={(event) => { setName(event.target.value); setNameError(null); }} autoComplete="name" />}
              </Field>
              <Field label="Mobile" error={phoneError}>
                {(props) => (
                  <Input
                    {...props}
                    type="tel"
                    value={contactNumber}
                    onChange={(event) => { setContactNumber(cleanPhoneInput(event.target.value)); setPhoneError(null); }}
                    autoComplete="tel"
                  />
                )}
              </Field>
              <Field label="Sign-in email" hint="It is how they sign in, so it cannot be changed here.">
                {(props) => <LockedInput {...props} value={account.email ?? ""} />}
              </Field>
              <Field label="Position" hint="Follows from their role.">
                {(props) => <LockedInput {...props} value={roleLabel(account.role)} />}
              </Field>
              <Field label="Department" hint="Follows from their role.">
                {(props) => <LockedInput {...props} value={DEPARTMENT[account.role] ?? "Not set"} />}
              </Field>
              <Field label="Started on" hint="Not recorded in the system yet.">
                {(props) => <Input {...props} disabled placeholder="Not recorded" />}
              </Field>
            </form>
          </Panel>

          <Panel
            id="ad-role"
            title="Role"
            description={roleLocked ? (isSelf ? "Nobody changes their own role." : "Only the owner can change the owner's role.") : "Decides which screens they can open."}
            action={onCompareRoles ? <TextLink onClick={onCompareRoles}>Compare roles</TextLink> : null}
          >
            <div className="px-4 py-3">
              <RoleChoices label={`${first}'s role`} value={role} onChange={setRole} disabled={roleLocked} />
            </div>
          </Panel>

          <Panel id="ad-signin" title="Signing in">
            <div className="flex items-start justify-between gap-4 px-4 py-3">
              <div>
                <label htmlFor="ad-can" className="block text-sm font-medium">Can sign in</label>
                <span className="block text-13 text-muted-fg">
                  {isBlocked
                    ? "Suspended. Their password still works once this is turned back on."
                    : !account.role
                      ? "Their password works, but nothing opens until they have a role."
                      : "Turn off to stop them signing in. Nothing they recorded is removed."}
                </span>
              </div>
              <Switch
                id="ad-can"
                aria-label="Can sign in"
                checked={!isBlocked}
                disabled={isSelf || account.isSuperAdmin}
                onCheckedChange={(next) => setConfirm(next ? "unblock" : "block")}
              />
            </div>
            <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 border-t border-row-divider px-4 py-3 text-13">
              <dt className="text-muted-fg">Last signed in</dt>
              <dd className="m-0">{lastSignIn ? whenLabel(lastSignIn.at) : "Not in the activity log"}</dd>
            </dl>
            <div className="flex flex-wrap items-center gap-2 border-t border-row-divider px-4 py-3">
              <Button
                variant="outline"
                size="sm"
                onClick={sendPasswordReset}
                disabled={!account.email || reset === "sending" || reset === "sent"}
              >
                {reset === "sending" ? "Sending…" : reset === "sent" ? "Reset link sent" : "Send password reset"}
              </Button>
              {onSignOutEverywhere ? (
                <Button variant="outline" size="sm" onClick={signOutEverywhere} disabled={ending === "working" || ending === "done"}>
                  {ending === "working" ? "Signing out…" : ending === "done" ? "Signed out everywhere" : "Sign out everywhere"}
                </Button>
              ) : null}
              {endingMessage ? (
                <span className={ending === "failed" ? "text-13 text-danger-fg" : "text-13 text-muted-fg"}>{endingMessage}</span>
              ) : null}
              {reset === "sent" ? (
                <span className="text-13 text-muted-fg">
                  Sent to {account.email}. {first} can set a new password from that link; their current one keeps working until they do.
                </span>
              ) : null}
              {reset === "failed" ? (
                <span className="text-13 text-danger-fg">
                  That did not send. Too many resets in a row are refused for a few minutes — wait, then try again.
                </span>
              ) : null}
            </div>
          </Panel>

          {!isSelf && !account.isSuperAdmin ? (
            <DangerBlock
              title={`Remove ${first}'s account`}
              action={<Button variant="destructive-outline" onClick={() => setConfirm("delete")}>Remove account</Button>}
            >
              The account stops working for good. Orders, deliveries and log entries keep {first}&rsquo;s name.
            </DangerBlock>
          ) : null}
        </div>

        <aside className="flex w-full flex-col gap-4 lg:w-[320px] lg:shrink-0">
          <section aria-labelledby="ad-month" className="rounded-lg border border-border bg-card shadow-xs">
            <div className="px-4 pb-2 pt-3.5"><h2 id="ad-month" className="m-0 text-sm font-semibold">{month} so far</h2></div>
            <div className="grid grid-cols-2 gap-px border-t border-row-divider bg-muted">
              {[
                ["Order changes", countOf(ACTIVITY_KIND.ORDER)],
                ["Delivery moves", countOf(ACTIVITY_KIND.DELIVERY)],
                ["Stock changes", countOf(ACTIVITY_KIND.STOCK)],
                ["Customer changes", countOf(ACTIVITY_KIND.CUSTOMER)],
              ].map(([label, value]) => (
                <div key={label} className="bg-card px-4 py-2.5">
                  <div className="text-xs text-muted-fg">{label}</div>
                  <div className="text-lg font-semibold">{value}</div>
                </div>
              ))}
            </div>
          </section>

          <section aria-labelledby="ad-act" className="rounded-lg border border-border bg-card shadow-xs">
            <div className="flex items-baseline justify-between px-4 pb-2 pt-3.5">
              <h2 id="ad-act" className="m-0 text-sm font-semibold">Recent activity</h2>
              {onOpenActivity ? <TextLink onClick={onOpenActivity}>Activity log</TextLink> : null}
            </div>
            {mine.length === 0 ? (
              <p className="m-0 border-t border-row-divider px-4 py-3 text-13 text-muted-fg">Nothing recorded yet.</p>
            ) : (
              <ol className="m-0 list-none border-t border-row-divider px-4 py-2 text-13">
                {mine.slice(0, 5).map((entry) => (
                  <li key={entry.id} className="flex gap-3 py-1">
                    <span className="w-16 shrink-0 text-muted-fg">
                      {entry.at && new Date(entry.at).toDateString() === new Date().toDateString() ? timeLabel(entry.at) : formatShortDate(entry.at)}
                    </span>
                    <span className="min-w-0">{entry.what}</span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </aside>
      </div>

      <ConfirmDialog
        open={confirm === "delete"}
        onOpenChange={(next) => !next && setConfirm(null)}
        title={`Remove ${account.name}?`}
        consequences={`${account.name} disappears from the staff list and can no longer sign in. Orders and stock records they made stay exactly as they are. This cannot be undone.`}
        confirmLabel="Yes, remove them"
        busy={working}
        onConfirm={runConfirm}
      />
      <ConfirmDialog
        open={confirm === "block"}
        onOpenChange={(next) => !next && setConfirm(null)}
        title={`Stop ${account.name} signing in?`}
        consequences={`${first} can’t sign in until someone turns it back on. Their password is not changed and nothing they recorded is removed.`}
        confirmLabel="Yes, suspend"
        keepLabel="Keep access"
        busy={working}
        onConfirm={runConfirm}
      />
      <ConfirmDialog
        open={confirm === "unblock"}
        onOpenChange={(next) => !next && setConfirm(null)}
        intent="forward"
        title={`Let ${account.name} sign in again?`}
        consequences="They will be able to get in straight away with the password they already have. Nothing needs to be sent to them."
        confirmLabel="Yes, let them in"
        keepLabel="Not yet"
        busy={working}
        onConfirm={runConfirm}
      />
    </Page>
  );
}
