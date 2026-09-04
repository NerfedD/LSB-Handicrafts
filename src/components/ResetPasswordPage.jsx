import { useState } from "react";

import { CircleAlert, CircleCheck, KeyRound, Lock } from "./icons";
import AuthLayout, { StepBar } from "./layout/AuthLayout";
import AuthField from "./shared/AuthField";
import Callout from "./shared/Callout";
import IconChip from "./shared/Chip";
import { RequirementList } from "./shared/forms";
import { Button } from "@/components/ui/button";
import { supabase } from "../lib/supabaseClient";
import { passwordIsAcceptable, passwordRequirements } from "../utils/password";

/**
 * Forgot password, step 3 of 3 — choose a new one.
 *
 * Only reachable with a valid Supabase recovery session already established:
 * see the PASSWORD_RECOVERY listener in src/App.jsx, which is what lands
 * somebody here after they click the link from the email.
 *
 * THE CHECKLIST TICKS AS THEY TYPE. Password rules delivered as an error after
 * submitting are a guessing game played one round per submission; the same
 * rules shown as a list that fills in are a progress bar. The screen also
 * refuses to submit until all three are met, so the round trip that would have
 * told them off never happens.
 *
 * The confirm field is labelled "Type the new password again — so we know there
 * is no typo", which says why it exists."Confirm New Password" describes the
 * field; this describes the reason, and the reason is what makes somebody type
 * carefully rather than paste.
 */
export default function ResetPasswordPage({ onReturnToLogin }) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [succeeded, setSucceeded] = useState(false);

  const requirements = passwordRequirements(password);
  const ready = passwordIsAcceptable(password) && confirmPassword === password;

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);

    if (confirmPassword !== password) {
      setError("The two passwords are not the same. Check for a typo in the second box.");
      return;
    }

    setIsSubmitting(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError(updateError.message);
        return;
      }
      setSucceeded(true);
    } catch {
      setError("We could not reach the system, so your password was not changed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (succeeded) {
    return (
      <AuthLayout width={470}>
        <StepBar step={3} />

        <div className="pt-6">
          <IconChip icon={<CircleCheck />} tone="green" size="xl" />
          <h1 className="pt-5 text-[25px] font-extrabold leading-tight tracking-[-0.02em] text-ink">
            Your new password is saved
          </h1>
          <p className="pt-2 text-[16px] leading-[1.55] text-muted">
            Use it the next time you sign in. Your old password no longer works, and
            anywhere else you were signed in has been signed out.
          </p>
        </div>

        <Button variant="cobalt" size="xl" block className="mt-7" onClick={onReturnToLogin}>
          Sign in with the new password
        </Button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout width={470}>
      <StepBar step={3} />

      <div className="pt-6">
        <h1 className="text-[25px] font-extrabold leading-tight tracking-[-0.02em] text-ink">
          Choose a new password
        </h1>
        <p className="pt-2 text-[16px] leading-[1.55] text-muted">
          Pick something you will remember. Nobody else can see what you type here.
        </p>
      </div>

      {error && (
        <Callout tone="red" icon={<CircleAlert />} title="Not saved yet." className="mt-5">
          {error}
        </Callout>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-5 pt-6" noValidate>
        <AuthField
          label="New password"
          type="password"
          icon={<KeyRound />}
          value={password}
          onChange={setPassword}
          placeholder="Your new password"
          autoComplete="new-password"
        />

        <RequirementList requirements={requirements} />

        <AuthField
          label="Type the new password again"
          type="password"
          icon={<Lock />}
          value={confirmPassword}
          onChange={setConfirmPassword}
          placeholder="The same password"
          autoComplete="new-password"
          invalid={confirmPassword !== "" && confirmPassword !== password}
          hint="So we know there is no typo."
        />

        <Button
          type="submit"
          variant="cobalt"
          size="xl"
          block
          disabled={isSubmitting || !ready}
        >
          {isSubmitting ? "Saving…" : "Save the new password"}
        </Button>
      </form>
    </AuthLayout>
  );
}
