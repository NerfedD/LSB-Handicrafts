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
   * Sign in with either an email or a username.
   *
   * TWO PATHS, AND THE SPLIT IS THE SECURITY FIX. An email goes straight to
   * GoTrue from here, exactly as it always has — the browser already knows the
   * address, so there is nothing to hide and nothing to gain by moving it.
   *
   * A username goes to the `sign-in` Edge Function instead. It used to be
   * traded for an email first, through a SECURITY DEFINER RPC granted to
   * `anon`: hand it a username, get the address back. The anon key ships in
   * this bundle, so that was an open lookup — and staff usernames are short
   * words, one of them "admin". Guessing a few returned real personal email
   * addresses to anybody who asked. The function does the whole sign-in on the
   * server now and this screen never learns an address it was not already
   * given, so there is no question left to ask anonymously.
   *
   * The error comes back shaped like a GoTrue one, so the mapping below does
   * not care which path produced it.
   */
  async function signIn(identifier, password) {
    if (identifier.includes("@")) {
      return supabase.auth.signInWithPassword({ email: identifier, password });
    }

    const { data, error } = await supabase.functions.invoke("sign-in", {
      body: { identifier, password },
    });
    // A transport failure, not a verdict on the credentials. Thrown so the
    // catch below calls it what it is: the network.
    if (error) throw error;
    // A username nobody holds and a wrong password come back identically, so
    // this cannot tell a stranger which usernames exist.
    if (data?.error) return { data: null, error: data.error };
    if (!data?.session) throw new Error("No session returned.");

    // Writes through the storage adapter in lib/supabaseClient, so "Keep me
    // signed in" still decides local vs session storage.
    const { error: sessionError } = await supabase.auth.setSession(data.session);
    if (sessionError) return { data: null, error: sessionError };
    return { data: { user: data.user }, error: null };
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (isSubmitting || !identifier.trim() || !password) { setStatus("wrong"); return; }
    setIsSubmitting(true);

    // Before the sign-in, not after: this decides WHERE the client writes the
    // session, and the write happens inside that call — whichever of the two
    // paths in signIn() ends up performing it.
    setKeepSignedIn(keepSignedIn);

    try {
      const { data, error } = await signIn(identifier.trim(), password);
      if (error) {
        setStatus(error.code === 'user_banned' || /banned|blocked|suspended/i.test(error.message)
          ? 'blocked' : error.status === 429 ? 'rate-limited'
          : error.status >= 500 || error.name === 'AuthRetryableFetchError' ? 'offline' : 'wrong');
        return;
      }

      // App.jsx decides whether this email actually gets in — it looks for a
      // matching row in the `staff` table, checks it isn't blocked, and routes
      // by role. Anyone it doesn't grant access to is signed straight back out.
      const result = await onLoginAttempt?.(data.user.email);
      if (result !== "ok") {
        await supabase.auth.signOut();
        setStatus(result === "blocked" ? "blocked" : result === "offline" ? "offline" : "not-set-up");
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

      <div aria-live="assertive" aria-atomic="true">
      {status === "rate-limited" && <Callout tone="amber" title="Too many sign-in attempts.">Please wait a few minutes before trying again.</Callout>}

      {status === "wrong" && (
        <Callout
          tone="red"
          icon={<CircleAlert />}
          title="That username or password did not match."
          className="mt-6"
        >
          Check for capital letters and extra spaces, then try again.
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
          This account has been suspended/blocked. Please contact an administrator.
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

      </div>
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
