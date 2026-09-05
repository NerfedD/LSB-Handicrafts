import { useState } from "react";

import { CircleAlert, Mail, Phone, Send } from "./icons";
import AuthLayout, { StepBar } from "./layout/AuthLayout";
import AuthField from "./shared/AuthField";
import Callout from "./shared/Callout";
import IconChip from "./shared/Chip";
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
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

  if (sent) {
    return (
      <AuthLayout width={470}>
        <StepBar step={2} />

        <div className="pt-6">
          <IconChip icon={<Mail />} tone="cobalt" size="xl" />
          <h1 className="pt-5 text-[25px] font-extrabold leading-tight tracking-[-0.02em] text-ink">
            Now check your email
          </h1>
          <p className="pt-2 text-[16px] leading-[1.55] text-muted">
            {/* Deliberately "if an account exists": confirming which addresses
                are registered would tell a stranger who works here. */}
            If there is an account for{" "}
            <strong className="font-bold text-ink">{email}</strong>, a link is on its way.
            Open it on this device and you can choose a new password. The link works for
            one hour.
          </p>
        </div>

        <div className="flex flex-col gap-3 pt-7">
          <Button variant="cobalt" size="xl" block onClick={onBack}>
            Back to sign in
          </Button>
          <Button variant="outline" size="lg" block asChild>
            <a href={`tel:${OFFICE_PHONE.replace(/[^\d+]/g, "")}`}>
              <Phone className="h-5 w-5" />
              No email arrived — call the office
            </a>
          </Button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout width={470}>
      <StepBar step={1} />

      <div className="pt-6">
        <h1 className="text-[25px] font-extrabold leading-tight tracking-[-0.02em] text-ink">
          What is your email?
        </h1>
        <p className="pt-2 text-[16px] leading-[1.55] text-muted">
          We will send you a link that lets you choose a new password. The link works for
          one hour.
        </p>
      </div>

      {error && (
        <Callout tone="red" icon={<CircleAlert />} title="That did not work." className="mt-5">
          {error}
        </Callout>
      )}

      <form onSubmit={handleSubmit} className="pt-6" noValidate>
        <AuthField
          label="Email address"
          icon={<Mail />}
          type="email"
          value={email}
          onChange={setEmail}
          placeholder="you@example.com"
          autoComplete="email"
          invalid={Boolean(error)}
        />

        <div className="flex flex-wrap gap-3 pt-6">
          <Button type="submit" variant="cobalt" size="xl" className="flex-1" disabled={isSubmitting}>
            <Send className="h-5 w-5" />
            {isSubmitting ? "Sending…" : "Send the link"}
          </Button>
          <Button variant="outline" size="xl" onClick={onBack}>
            Back
          </Button>
        </div>
      </form>
    </AuthLayout>
  );
}
