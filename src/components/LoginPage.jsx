import { useState } from "react";

import { AtSign, CircleAlert, Info, LogIn, Lock, Phone, UserX } from "./icons";
import AuthLayout from "./layout/AuthLayout";
import AuthField, { Checkbox } from "./shared/AuthField";
import Callout from "./shared/Callout";
import { Button } from "@/components/ui/button";
import { keepsSignedIn, setKeepSignedIn, supabase } from "../lib/supabaseClient";
import { OFFICE_PHONE } from "../utils/office";

/**
 * Sign in.
 *
 * THE ERROR STATES ARE THE SCREEN. Signing in either works — in which case
 * nobody reads anything — or it fails, and what it says then is the entire
 * value of the page. There are three distinct failures and they need three
 * distinct answers, because the thing the person should do next is different
 * in each:
 *
 *   wrong details   they can fix it themselves — so the message says HOW
 *                   (capitals, spaces) and warns about the lockout before they
 *                   hit it, not after.
 *   blocked         they cannot fix it. The message leads with "your password
 *                   was correct", because otherwise they will spend the next
 *                   ten minutes retyping it, and offers the phone number.
 *   not set up yet  also not their fault, also not fixable by retrying, and a
 *                   different person has to act.
 *
 * The old screen showed four variations of "Incorrect username or password.
 * Please check your details and try again." — including for the two cases
 * where the details were correct and retrying was guaranteed to fail.
 */
export default function LoginPage({ onLoginAttempt, onForgotPassword }) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  // Seeded from what they chose last time, so somebody on a shared machine who
  // unchecks it does not have to remember to uncheck it again every morning.
  const [keepSignedIn, setKeepSignedInChoice] = useState(keepsSignedIn);
  const [status, setStatus] = useState("idle"); // idle | wrong | blocked | not-set-up | offline
  const [isSubmitting, setIsSubmitting] = useState(false);

  /**
   * Supabase Auth only authenticates on email, so a username has to be traded
   * for one first. `email_for_username` is a SECURITY DEFINER function — see
   * supabase/schema.sql — because at this point nobody is signed in yet and the
   * staff policies deny every ordinary read.
   *
   * Anything containing "@" is taken as an email and passed straight through,
   * so this costs a round trip only for people who actually type a username.
   */
  async function resolveEmail(value) {
    if (value.includes("@")) return value;

    const { data, error } = await supabase.rpc("email_for_username", {
      p_username: value,
    });
    // A username nobody holds is a failed sign-in, not a distinct error — it
    // would otherwise tell a stranger which usernames exist.
    if (error || !data) return null;
    return data;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setIsSubmitting(true);

    // Before signInWithPassword, not after: this decides WHERE the client
    // writes the session, and the write happens inside that call.
    setKeepSignedIn(keepSignedIn);

    try {
      const email = await resolveEmail(identifier.trim());
      if (!email) {
        setStatus("wrong");
        return;
      }

      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setStatus("wrong");
        return;
      }

      // App.jsx decides whether this email actually gets in — it looks for a
      // matching row in the `staff` table, checks it isn't blocked, and routes
      // by role. Anyone it doesn't grant access to is signed straight back out.
      const result = await onLoginAttempt?.(data.user.email);
      if (result !== "ok") {
        await supabase.auth.signOut();
        setStatus(result === "blocked" ? "blocked" : "not-set-up");
        return;
      }

      setStatus("idle");
    } catch {
      // A thrown error here is the network, not the credentials, and telling
      // somebody their password is wrong when the office wifi has dropped is
      // how they end up locked out of an account that was fine.
      setStatus("offline");
    } finally {
      setIsSubmitting(false);
    }
  }

  const callTheOffice = (
    <Button variant="outline" size="sm" asChild>
      <a href={`tel:${OFFICE_PHONE.replace(/[^\d+]/g, "")}`}>
        <Phone className="h-4.5 w-4.5" />
        Call the office
      </a>
    </Button>
  );

  return (
    <AuthLayout>
      <h1 className="text-[34px] font-extrabold leading-tight tracking-[-0.03em] text-ink">
        Sign in
      </h1>
      <p className="pt-2 text-[16.5px] leading-[1.45] text-muted">
        Use the username or email your administrator gave you.
      </p>

      {status === "wrong" && (
        <Callout
          tone="red"
          icon={<CircleAlert />}
          title="That username or password did not match."
          className="mt-6"
        >
          Check for capital letters and extra spaces, then try again. After 5 tries the
          account locks for 15 minutes.
        </Callout>
      )}

      {status === "blocked" && (
        <Callout
          tone="amber"
          icon={<UserX />}
          title="An administrator has blocked this account."
          className="mt-6"
          action={callTheOffice}
        >
          Your password was correct. Ask an administrator to unblock you — it takes them
          seconds.
        </Callout>
      )}

      {status === "not-set-up" && (
        <Callout
          tone="cobalt"
          icon={<Info />}
          title="This account is not set up in the system yet."
          className="mt-6"
          action={callTheOffice}
        >
          Your password was correct, but nobody has given the account a job to do. An
          administrator needs to do that once.
        </Callout>
      )}

      {status === "offline" && (
        <Callout
          tone="amber"
          icon={<CircleAlert />}
          title="We could not reach the system."
          className="mt-6"
        >
          Your details were not checked, so nothing is wrong with your account. Check the
          internet connection and try again.
        </Callout>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-5 pt-7" noValidate>
        <AuthField
          label="Username or email"
          icon={<AtSign />}
          value={identifier}
          onChange={setIdentifier}
          placeholder="maria.santos"
          autoComplete="username"
          invalid={status === "wrong"}
        />

        <AuthField
          label="Password"
          type="password"
          icon={<Lock />}
          value={password}
          onChange={setPassword}
          placeholder="Your password"
          autoComplete="current-password"
          invalid={status === "wrong"}
        />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Checkbox
            checked={keepSignedIn}
            onChange={setKeepSignedInChoice}
            label="Keep me signed in"
          />
          <button
            type="button"
            onClick={onForgotPassword}
            className="text-[15.5px] font-bold text-cobalt dark:text-dk-cobalt underline underline-offset-[3px] transition duration-150 hover:text-cobalt-deep"
          >
            Forgot password?
          </button>
        </div>

        <Button type="submit" variant="cobalt" size="xl" block disabled={isSubmitting}>
          <LogIn className="h-5.5 w-5.5" />
          {isSubmitting ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      {/*
        A real escape hatch, not a legal footer. Somebody who cannot get in
        cannot be helped by anything else on this screen, and the alternative
        to a phone number here is them giving up.
      */}
      <p className="pt-6 text-[14.5px] leading-[1.6] text-muted">
        Accounts are created by your administrator. If you cannot get in, call the office
        on <strong className="font-bold text-ink">{OFFICE_PHONE}</strong>.
      </p>
    </AuthLayout>
  );
}
