import { useState } from "react";

import { CheckCircle, DeviceMobile, Monitor, WarningCircle } from "../icons";
import { Button } from "@/components/ui/button";
import { Input, LockedInput } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import Callout from "../shared/Callout";
import { Field, RadioRow, RequirementList } from "../shared/forms";
import { cn } from "@/lib/utils";
import { supabase } from "../../lib/supabaseClient";
import { DASHBOARD_VIEW } from "../../utils/constants";
import { guardForm } from "../../utils/formErrors";
import { nameProblem } from "../../utils/validation";
import { passwordIsAcceptable, passwordRequirements } from "../../utils/password";
import { cleanPhoneInput, localPhoneDigits, phoneProblem } from "../../utils/phone";
import { roleLabel } from "../../utils/copy";

/**
 * The sections of the "13 · Your profile" board, used by Your profile and by
 * the two focused screens behind it (edit details, change password).
 */
export function ProfilePanel({ id, title, description, action, children, className }) {
  return (
    <section aria-labelledby={id} className={cn("rounded-lg border border-border bg-card shadow-xs", className)}>
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

/**
 * Your name and mobile. The form is submitted by a button elsewhere (the
 * header's Save changes) through `formId`; `onDirtyChange` lets that button
 * know when there is something to save.
 */
export function DetailsSection({ profile, onSave, formId = "profile-details", onDirtyChange, footer }) {
  const [name, setName] = useState(profile?.name ?? "");
  const seededPhone = localPhoneDigits(profile?.contactNumber ?? "");
  const [contactNumber, setContactNumber] = useState(seededPhone);
  const [phoneError, setPhoneError] = useState(null);
  const [nameError, setNameError] = useState(null);
  const [saving, setSaving] = useState(false);
  const changed = name !== (profile?.name ?? "") || contactNumber !== seededPhone;

  const touch = (next) => onDirtyChange?.(next);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!guardForm(event.currentTarget)) return;
    if (!changed || saving) return;
    const nameIssue = nameProblem(name, { label: "Your name", max: 120 });
    setNameError(nameIssue);
    if (nameIssue) return;
    const problem = phoneProblem(contactNumber);
    if (problem) {
      setPhoneError(problem);
      return;
    }
    setSaving(true);
    await onSave?.({ name: name.trim(), contactNumber: contactNumber.trim() });
    setSaving(false);
    touch(false);
  }

  return (
    <ProfilePanel id="mp-details" title="Your details" description="How your name shows on orders and in the activity log.">
      <form id={formId} noValidate onSubmit={handleSubmit} className="grid gap-3.5 px-4 py-4 sm:grid-cols-2">
        <Field label="Your name" error={nameError}>
          {(props) => (
            <Input
              {...props}
              required
              maxLength={120}
              autoComplete="name"
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                setNameError(null);
                touch(true);
              }}
            />
          )}
        </Field>
        <Field label="Mobile" error={phoneError}>
          {(props) => (
            <Input
              {...props}
              type="tel"
              autoComplete="tel"
              value={contactNumber}
              onChange={(event) => {
                setContactNumber(cleanPhoneInput(event.target.value));
                setPhoneError(null);
                touch(true);
              }}
            />
          )}
        </Field>
        <Field label="Sign-in email" hint="Another admin can change this for you.">
          {(props) => <LockedInput {...props} value={profile?.email ?? ""} />}
        </Field>
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">What you do</span>
          <span className="flex h-8 items-center text-sm">{roleLabel(profile?.role)}</span>
          <span className="text-xs text-muted-fg">Set in User Management.</span>
        </div>
        {footer ? <div className="sm:col-span-2">{footer(saving, changed)}</div> : null}
      </form>
    </ProfilePanel>
  );
}

/** Current, new and again; the app checks the current password before changing it. */
export function PasswordSection({ profile, onDone }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const requirements = passwordRequirements(next);
  const met = requirements.filter((r) => r.met).length;
  const ready = current !== "" && passwordIsAcceptable(next) && again === next;

  async function handleSubmit(event) {
    event.preventDefault();
    if (!ready || saving) return;
    setError(null);
    setSaving(true);
    try {
      const { error: checkError } = await supabase.auth.signInWithPassword({ email: profile?.email, password: current });
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
      setCurrent("");
      setNext("");
      setAgain("");
      onDone?.();
    } catch {
      setError("We could not reach the system, so your password was not changed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ProfilePanel id="mp-pass" title="Password" description="Your current password is checked before it changes.">
      <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-3.5 px-4 py-4">
        {done ? (
          <Callout tone="green" icon={<CheckCircle />}>
            <span className="font-medium text-success-fg">Your new password is saved. Your old password no longer works.</span>
          </Callout>
        ) : null}
        {error ? <Callout tone="red" icon={<WarningCircle />} title="Not changed yet.">{error}</Callout> : null}
        <div className="grid gap-3.5 sm:grid-cols-3">
          <Field label="Current password">
            {(props) => <Input {...props} type="password" autoComplete="current-password" value={current} onChange={(e) => { setCurrent(e.target.value); setDone(false); }} />}
          </Field>
          <Field label="New password">
            {(props) => <Input {...props} type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} aria-describedby="mp-strength" />}
          </Field>
          <Field label="Type it again" error={again && again !== next ? "The two are not the same yet." : null}>
            {(props) => <Input {...props} type="password" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} />}
          </Field>
        </div>
        <div id="mp-strength" className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-2">
            <span aria-hidden="true" className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <span key={i} className={cn("h-1 w-10 rounded-sm", met > i * (requirements.length / 3) ? (met === requirements.length ? "bg-success" : "bg-warning") : "bg-muted-strong")} />
              ))}
            </span>
            <RequirementList requirements={requirements} />
          </div>
          <Button type="submit" variant="outline" disabled={!ready || saving}>{saving ? "Changing…" : "Change password"}</Button>
        </div>
      </form>
    </ProfilePanel>
  );
}

/**
 * Theme (per device, hooks/useTheme) and the dashboard's text size (per
 * account). "Open on" has nothing to save to yet, so it is disabled.
 */
export function PreferencesSection({ theme, onTheme, dashboardView, onSetDashboardView }) {
  return (
    <ProfilePanel id="mp-prefs" title="How the app looks for you" description="Theme is kept on this device; text size follows your account.">
      <div className="grid gap-4 px-4 py-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium" id="mp-theme">Theme</span>
          <RadioRow
            label="Theme"
            value={theme}
            onChange={(next) => {
              const root = document.documentElement;
              root.classList.add("theme-anim");
              onTheme(next);
              setTimeout(() => root.classList.remove("theme-anim"), 300);
            }}
            options={[
              { value: "light", label: "Light" },
              { value: "dark", label: "Dark" },
              { value: "system", label: "Match this device" },
            ]}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium" id="mp-size">Text size</span>
          <RadioRow
            label="Text size"
            value={dashboardView}
            onChange={(next) => onSetDashboardView?.(next)}
            options={[
              { value: DASHBOARD_VIEW.STANDARD, label: "Standard", description: "More on screen at once." },
              { value: DASHBOARD_VIEW.LARGE, label: "Large text", description: "Bigger words and buttons on the dashboard." },
            ]}
          />
        </div>
        <div className="flex flex-col gap-1.5 sm:col-span-2 sm:max-w-[280px]">
          <label htmlFor="mp-start" className="text-sm font-medium">Open on</label>
          <NativeSelect id="mp-start" disabled defaultValue="dashboard" aria-describedby="mp-start-hint">
            <option value="dashboard">Dashboard</option>
          </NativeSelect>
          <span id="mp-start-hint" className="text-xs text-muted-fg">Everyone opens on the dashboard for now.</span>
        </div>
      </div>
    </ProfilePanel>
  );
}

/** This device only: the app keeps no list of sessions, so the others cannot be shown or ended. */
export function SessionsSection() {
  const phone = typeof navigator !== "undefined" && /Mobi|Android|iPhone/i.test(navigator.userAgent);
  const Icon = phone ? DeviceMobile : Monitor;
  return (
    <ProfilePanel
      id="mp-sessions"
      title="Where you're signed in"
      description="Sign out anything you don't recognise, then change your password."
      action={<Button variant="outline" size="sm" disabled title="Not available yet">Sign out everywhere else</Button>}
    >
      <ul className="m-0 list-none p-0">
        <li className="flex items-center gap-3 px-4 py-3 text-13">
          <span aria-hidden="true" className="flex size-8 items-center justify-center rounded-md border border-border text-fg-2">
            <Icon className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 font-medium">
              {phone ? "Phone" : "Computer"}
              <span className="rounded border border-border px-1.5 text-xs font-medium text-fg-2">This device</span>
            </div>
            <div className="text-muted-fg">Signed in now</div>
          </div>
        </li>
      </ul>
    </ProfilePanel>
  );
}
