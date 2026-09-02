import { useState } from "react";
import { Eye, EyeOff, CheckCircle2 } from "./icons";
import AppShell from "./layout/AppShell";
import { createSignupClient } from "../lib/supabaseSignupClient";
// Was a private copy of this list. Two copies meant a role added in one place
// silently failed to appear in the other -- and the database now rejects any
// role outside the canonical set, so drift here becomes a save failure.
import { ROLES } from "../utils/staffData";

const emptyForm = {
  employeeName: "",
  role: "",
  contactNumber: "",
  username: "",
  email: "",
  temporaryPassword: "",
};

/**
 * LSB Handicrafts — Create User Account
 * Figma: node 28:2 (form), 28:302 (success)
 *
 * `onAccountCreated` is called after a successful signup with
 * { name, role, contactNumber, email, username } so the caller can add the
 * person to the `staff` list right away (see src/App.jsx) — otherwise they'd
 * only show up once they sign in themselves and the bootstrap effect runs.
 *
 * The username is optional and lives on the `staff` row, not in Supabase Auth,
 * which only knows emails. LoginPage trades one for the other at sign-in.
 */
export default function CreateUserAccountPage({
  onNavigate,
  onSignOut,
  isAdmin = false,
  onCancel,
  onAccountCreated,
}) {
  const [form, setForm] = useState(emptyForm);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [succeeded, setSucceeded] = useState(false);

  function update(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    if (!form.employeeName || !form.role || !form.email || !form.temporaryPassword) {
      setError("Please fill in employee name, role, email, and a temporary password.");
      return;
    }

    setIsSubmitting(true);
    try {
      // A separate client so this signup can't replace the admin's own
      // session — see src/lib/supabaseSignupClient.js.
      const signupClient = createSignupClient();
      const { error: signUpError } = await signupClient.auth.signUp({
        email: form.email,
        password: form.temporaryPassword,
      });

      if (signUpError) {
        setError(signUpError.message);
        return;
      }

      // Awaited, and its result decides whether this counts as success.
      //
      // These are two writes to two systems: the Auth user above, and the staff
      // row below that actually grants access. Treating the first as the whole
      // job is how the project accumulated auth users with no staff row -- they
      // could sign in, then see nothing and be signed straight back out. If the
      // staff row fails, say so plainly rather than showing a success screen.
      const created = await onAccountCreated?.({
        name: form.employeeName,
        role: form.role,
        contactNumber: form.contactNumber,
        email: form.email.trim().toLowerCase(),
        username: form.username,
      });

      if (created === false) {
        setError(
          "The sign-in was created, but granting access failed. Ask an administrator " +
            "to add this person under User Accounts before they try to sign in."
        );
        return;
      }

      setSucceeded(true);
      setForm(emptyForm);
    } catch {
      setError("Couldn't create the account. Please check the details and try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (succeeded) {
    return (
      <AppShell isAdmin={isAdmin} activeTab="create" onNavigate={onNavigate} onSignOut={onSignOut}>
        <div className="relative flex w-[720px] max-w-full flex-col items-center rounded-2xl border border-[#17263a12] bg-white px-16 py-[52px] text-center shadow-[0_8px_24px_rgba(17,30,50,0.12),0_2px_4px_rgba(17,30,50,0.07)]">
          <div className="flex size-[72px] items-center justify-center rounded-full border border-[#287a5538] bg-[#287a5514]">
            <CheckCircle2 className="h-9 w-9 text-[#287a55]" />
          </div>
          <h1 className="mt-7 text-[30px] font-bold leading-tight tracking-tight text-[#17263a]">
            Account Created Successfully
          </h1>
          <p className="mt-3.5 text-base text-[#5f6875]">
            The new user account has been created successfully.
          </p>
          <div className="mt-10 flex gap-3.5">
            <button
              type="button"
              onClick={() => setSucceeded(false)}
              className="h-14 rounded-[10px] bg-[#1b3a6b] px-10 text-[17px] font-semibold tracking-[0.5px] text-white shadow-[0_2px_6px_rgba(27,58,107,0.28)] transition hover:bg-[#17263a]"
            >
              Done
            </button>
            <button
              type="button"
              onClick={() => onNavigate?.("accounts")}
              className="h-14 rounded-[10px] border border-[#17263a2e] px-7 text-base font-medium text-[#17263a] transition hover:bg-[#17263a08]"
            >
              View User Accounts
            </button>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell isAdmin={isAdmin} activeTab="create" onNavigate={onNavigate} onSignOut={onSignOut}>
      <div className="relative w-[720px] max-w-full rounded-2xl border border-[#17263a12] bg-white px-[60px] py-[52px] shadow-[0_8px_24px_rgba(17,30,50,0.12),0_2px_4px_rgba(17,30,50,0.07)]">
        <div className="h-[2.5px] w-7 rounded bg-[#1b3a6b]" />
        <h1 className="mt-5 text-[32px] font-bold leading-tight tracking-tight text-[#17263a]">
          Create User Account
        </h1>
        <p className="mt-2.5 text-base text-[#5f6875]">
          Create an account for a new employee.
        </p>

        {error && (
          <p className="mt-5 text-sm font-medium text-[#b54747]">{error}</p>
        )}

        <form onSubmit={handleSubmit} className="mt-9 flex flex-col">
          <SectionLabel>Employee Information</SectionLabel>
          <div className="mt-5 grid grid-cols-2 gap-6">
            <Field label="Employee Name">
              <input
                type="text"
                required
                value={form.employeeName}
                onChange={update("employeeName")}
                placeholder="Enter employee name"
                className={inputClasses}
              />
            </Field>
            <Field label="Role">
              <select
                required
                value={form.role}
                onChange={update("role")}
                className={`${inputClasses} appearance-none bg-white ${
                  form.role ? "text-[#17263a]" : "text-[#9aa3ad]"
                }`}
              >
                <option value="" disabled>
                  Select role
                </option>
                {ROLES.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Contact Number" className="mt-[22px]">
            <input
              type="tel"
              value={form.contactNumber}
              onChange={update("contactNumber")}
              placeholder="Enter contact number"
              className={inputClasses}
            />
          </Field>

          <hr className="mt-7 border-[#17263a14]" />

          <SectionLabel className="mt-6">Login Credentials</SectionLabel>
          <div className="mt-5 grid grid-cols-2 gap-6">
            <Field label="Username">
              <input
                type="text"
                value={form.username}
                onChange={update("username")}
                placeholder="Optional — they can sign in with this or their email"
                className={inputClasses}
              />
            </Field>
            <Field label="Email">
              <input
                type="email"
                required
                value={form.email}
                onChange={update("email")}
                placeholder="Enter email address"
                className={inputClasses}
              />
            </Field>
          </div>
          <p className="mt-2 text-[13.5px] text-[#5f6875]">
            They can sign in with either the username or the email. Leave the
            username blank to use email only.
          </p>

          <Field label="Temporary Password" className="mt-[22px]">
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                minLength={6}
                value={form.temporaryPassword}
                onChange={update("temporaryPassword")}
                placeholder="At least 6 characters"
                className={`${inputClasses} pr-[58px]`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1.5 text-[#17263a99] hover:bg-[#17263a0d]"
              >
                {showPassword ? (
                  <EyeOff className="h-5 w-5" />
                ) : (
                  <Eye className="h-5 w-5" />
                )}
              </button>
            </div>
          </Field>

          <div className="mt-9 flex gap-3.5">
            <button
              type="submit"
              disabled={isSubmitting}
              className="h-14 flex-1 rounded-[10px] bg-[#1b3a6b] text-[17px] font-semibold tracking-[0.5px] text-white shadow-[0_2px_6px_rgba(27,58,107,0.28)] transition hover:bg-[#17263a] disabled:opacity-60"
            >
              {isSubmitting ? "Creating…" : "Create Account"}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="h-14 rounded-[10px] border border-[#17263a2e] px-7 text-base font-medium text-[#17263a] transition hover:bg-[#17263a08]"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}

const inputClasses =
  "h-14 w-full rounded-[10px] border border-[#17263a29] bg-white px-[18px] text-[17px] text-[#17263a] outline-none transition placeholder:text-[#17263a80] focus:ring-2 focus:ring-[#1b3a6b]/30";

function SectionLabel({ children, className = "" }) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <span className="whitespace-nowrap text-[11px] font-semibold uppercase tracking-[1.1px] text-[#5f6875]">
        {children}
      </span>
      <span className="h-px flex-1 bg-[#17263a1a]" />
    </div>
  );
}

function Field({ label, children, className = "" }) {
  return (
    <div className={className}>
      <label className="block text-base font-semibold text-[#17263a]">
        {label}
      </label>
      <div className="mt-[9px]">{children}</div>
    </div>
  );
}
