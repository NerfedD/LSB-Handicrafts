import { useState } from "react";

import { CheckCircle, WarningCircle } from "./icons";
import AuthLayout, { AuthCard } from "./layout/AuthLayout";
import AuthField from "./shared/AuthField";
import Callout from "./shared/Callout";
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
      <AuthLayout>
        <AuthCard width={400} step={3} title="All set" description="Sign in with your new password.">
          <Callout tone="green" icon={<CheckCircle />}>
            <span className="font-medium text-success-fg">Your password is changed. Other devices were signed out.</span>
          </Callout>
          <Button block onClick={onReturnToLogin}>Sign in</Button>
        </AuthCard>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <AuthCard
        width={400}
        step={3}
        title="Choose a new password"
        description="You will use it from now on, on every device."
        footer={
          <button type="button" data-slot="text-link" onClick={onReturnToLogin} className="text-13 font-medium text-primary-text hover:text-primary-hover">
            Back to sign in
          </button>
        }
      >
        {error ? (
          <Callout tone="red" icon={<WarningCircle />} title="Not saved yet.">{error}</Callout>
        ) : null}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          <AuthField
            label="New password"
            type="password"
            value={password}
            onChange={setPassword}
            autoComplete="new-password"
          />
          <RequirementList requirements={requirements} />
          <AuthField
            label="Type it again"
            type="password"
            value={confirmPassword}
            onChange={setConfirmPassword}
            autoComplete="new-password"
            invalid={confirmPassword !== "" && confirmPassword !== password}
          />
          <Button type="submit" block disabled={isSubmitting || !ready}>
            {isSubmitting ? "Saving…" : "Save new password"}
          </Button>
        </form>
      </AuthCard>
    </AuthLayout>
  );
}
