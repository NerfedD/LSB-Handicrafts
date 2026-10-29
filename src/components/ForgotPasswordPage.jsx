import { useState } from "react";

import { Envelope, Phone, WarningCircle } from "./icons";
import AuthLayout, { AuthCard } from "./layout/AuthLayout";
import AuthField from "./shared/AuthField";
import Callout from "./shared/Callout";
import { Button } from "@/components/ui/button";
import { supabase } from "../lib/supabaseClient";
import { OFFICE_PHONE } from "../utils/office";

/**
 * Forgot password, steps 1 and 2 of 3.
 *
 * Supabase's real reset flow is email → emailed link → new password. The link
 * is what proves it is really them, and clicking it lands back in this app on a
 * temporary recovery session — which is step 3, ResetPasswordPage.
 *
 * THE PROGRESS BAR IS NOT DECORATION. A password reset that spans an email
 * client and two screens is a flow of unknown length, and "how many more of
 * these are there" is the question that makes somebody abandon it and phone the
 * office. Three bars answer it before they start.
 *
 * "The link works for one hour" is stated on step 1, before they leave for
 * their inbox — which is the only moment saying it is any use. Told on step 2,
 * it is a fact about a link they are already holding; told on step 3, it is an
 * explanation for why nothing worked.
 */
export default function ForgotPasswordPage({ onBack }) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState(null);
  const [emailError, setEmailError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);
    const typed = email.trim();
    // Checked here, beside the box, so a blank or half-typed address does not
    // spend a request (and a rate-limit slot) on something that cannot arrive.
    const problem = typed === ""
      ? "Put in your email address."
      : typed.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(typed)
        ? "That does not look like an email address. Check for a missing @ or dot."
        : null;
    setEmailError(problem);
    if (problem) return;
    setIsSubmitting(true);
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(typed, {
        redirectTo: window.location.origin,
      });
      if (resetError) {
        setError(resetError.message);
        return;
      }
      setSent(true);
    } catch {
      setError("We could not reach the system. Check the internet connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const footer = (
    <button type="button" data-slot="text-link" onClick={onBack} className="text-13 font-medium text-primary-text hover:text-primary-hover">
      Back to sign in
    </button>
  );

  if (sent) {
    return (
      <AuthLayout>
        <AuthCard
          width={400}
          step={2}
          title="Check your email"
          // Deliberately "if an account exists": confirming which addresses
          // are registered would tell a stranger who works here.
          description={<>If there is an account for <strong className="font-medium text-foreground">{email}</strong>, a link is on its way. It works for one hour.</>}
          footer={footer}
        >
          <Callout tone="neutral" icon={<Envelope />}>
            Open the link on this device and you can choose a new password.
          </Callout>
          <Button variant="outline" block render={<a href={`tel:${OFFICE_PHONE.replace(/[^\d+]/g, "")}`} />}>
            <Phone />
            No email arrived? Call the office
          </Button>
        </AuthCard>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <AuthCard
        width={400}
        step={1}
        title="Reset your password"
        description="We email a link to the address you sign in with. It works for one hour."
        footer={footer}
      >
        {error ? (
          <Callout tone="red" icon={<WarningCircle />} title="That did not work.">{error}</Callout>
        ) : null}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          <AuthField
            label="Email"
            type="email"
            value={email}
            onChange={(next) => {
              setEmail(next);
              setEmailError(null);
            }}
            placeholder="name@lsbhandicrafts.ph"
            autoComplete="email"
            invalid={Boolean(error) || Boolean(emailError)}
            error={emailError}
          />
          <Button type="submit" block disabled={isSubmitting}>
            {isSubmitting ? "Sending…" : "Send me a link"}
          </Button>
        </form>
      </AuthCard>
    </AuthLayout>
  );
}
