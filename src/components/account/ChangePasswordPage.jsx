import { useState } from "react";

import { ArrowLeft, CircleAlert, CircleCheck, KeyRound, Lock } from "../icons";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import AuthField from "../shared/AuthField";
import Callout from "../shared/Callout";
import IconChip from "../shared/Chip";
import { FormBand, FormFooter, RequirementList } from "../shared/forms";
import { supabase } from "../../lib/supabaseClient";
import { passwordIsAcceptable, passwordRequirements } from "../../utils/password";

/**
 * Change password — the right half of screen 2s.
 *
 * THE CHECKLIST TICKS AS THEY TYPE. Password rules delivered as an error after
 * submitting are a guessing game played one round per submission; the same
 * rules as a list that fills in are a progress bar. The button stays disabled
 * until all three are met, so the round trip that would have told them off
 * never happens.
 *
 * THE CONFIRM FIELD SAYS WHY IT EXISTS. "Type the new password again — so we
 * know there is no typo"rather than"Confirm New Password". One describes the
 * field; the other describes the reason, and the reason is what makes somebody
 * type it out carefully instead of pasting.
 *
 * THE CURRENT PASSWORD IS ASKED FOR, and Supabase does not require it —
 * `updateUser` will change the password of whoever holds the session. It is
 * asked because a signed-in session left open on a shared machine is exactly
 * how somebody else's password gets changed, and re-authenticating first is the
 * difference between an unlocked screen and a taken account.
 */
export default function ChangePasswordPage({ profile, onBack, onDone }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const requirements = passwordRequirements(next);
  const ready = current !== "" && passwordIsAcceptable(next) && again === next;

  async function handleSubmit(event) {
    event.preventDefault();
    if (!ready || saving) return;

    setError(null);
    setSaving(true);
    try {
      // Re-authenticate first. See the note above on why, given Supabase does
      // not ask for it.
      const { error: checkError } = await supabase.auth.signInWithPassword({
        email: profile?.email,
        password: current,
      });
      if (checkError) {
        setError("That is not your current password. Check for capital letters and spaces.");
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({ password: next });
      if (updateError) {
        setError(updateError.message);
        return;
      }

      setDone(true);
    } catch {
      setError("We could not reach the system, so your password was not changed.");
    } finally {
      setSaving(false);
    }
  }

  if (done) {
    return (
      <div className="mx-auto w-full max-w-[560px]">
        <Card className="p-6 text-center">
          <div className="flex flex-col items-center">
            <IconChip icon={<CircleCheck />} tone="green" size="xl" />
            <h2 className="pt-4 text-[21px] font-extrabold text-ink">
              Your new password is saved
            </h2>
            <p className="max-w-80 pt-2.5 text-[15.5px] leading-[1.55] text-muted">
              Use it the next time you sign in. Your old password no longer works.
            </p>
            <Button variant="cobalt" size="lg" className="mt-6" onClick={onDone}>
              Back to my profile
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[560px] flex-col gap-4">
      <Button variant="ghost" size="sm" className="self-start px-2" onClick={onBack}>
        <ArrowLeft className="h-5 w-5" />
        My profile
      </Button>

      <Card>
        <form onSubmit={handleSubmit} noValidate>
          <FormBand title="Change your password">
            {error && (
              <Callout tone="red" icon={<CircleAlert />} title="Not changed.">
                {error}
              </Callout>
            )}

            <AuthField
              label="Your current password"
              type="password"
              icon={<Lock />}
              value={current}
              onChange={setCurrent}
              placeholder="The one you use now"
              autoComplete="current-password"
              invalid={Boolean(error)}
            />

            <AuthField
              label="New password"
              type="password"
              icon={<KeyRound />}
              value={next}
              onChange={setNext}
              placeholder="Something you will remember"
              autoComplete="new-password"
            />

            <RequirementList requirements={requirements} />

            <AuthField
              label="Type the new password again"
              type="password"
              icon={<Lock />}
              value={again}
              onChange={setAgain}
              placeholder="The same password"
              autoComplete="new-password"
              invalid={again !== "" && again !== next}
              hint="So we know there is no typo."
            />
          </FormBand>

          <FormFooter
            left={
              <Button variant="outline" size="lg" onClick={onBack}>
                Cancel
              </Button>
            }
            right={
              <Button type="submit" variant="cobalt" size="lg" disabled={!ready || saving}>
                {saving ? "Saving…" : "Save the new password"}
              </Button>
            }
          />
        </form>
      </Card>
    </div>
  );
}
