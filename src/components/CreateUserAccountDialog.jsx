import { useState } from "react";
import { Eye, EyeOff } from "./icons";
import { createSignupClient } from "../lib/supabaseSignupClient";
// Was a private copy of this list. Two copies meant a role added in one place
// silently failed to appear in the other -- and the database now rejects any
// role outside the canonical set, so drift here becomes a save failure.
import { ROLES } from "../utils/staffData";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

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
 * Figma: node 28:2 (form)
 *
 * This was a screen of its own, reached from a "Create User Account" entry in
 * the nav. Creating an account is an action taken on the accounts list, not a
 * section of the system, so it is now a modal opened by the button on User
 * Accounts — the arrangement the redesign uses. The fields, the validation and
 * the two-step write below are exactly as they were on the page.
 *
 * The page's full-screen success panel does not survive the move: the modal
 * closes on success and App.jsx raises a toast instead, matching how every
 * other write on these screens reports itself.
 *
 * `onAccountCreated` is called after a successful signup with
 * { name, role, contactNumber, email, username } so the caller can add the
 * person to the `staff` list right away (see src/App.jsx) — otherwise they'd
 * only show up once they sign in themselves and the bootstrap effect runs.
 *
 * The username is optional and lives on the `staff` row, not in Supabase Auth,
 * which only knows emails. LoginPage trades one for the other at sign-in.
 */
export default function CreateUserAccountDialog({
  open,
  onOpenChange,
  onAccountCreated,
}) {
  const [form, setForm] = useState(emptyForm);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function update(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  function reset() {
    setForm(emptyForm);
    setShowPassword(false);
    setError(null);
  }

  // Escape, the scrim and the close button all land here. A dismissal in the
  // middle of the write is refused: the signup is already in flight and there
  // would be nowhere left to report whether the staff row followed it.
  function handleOpenChange(next) {
    if (isSubmitting) return;
    if (!next) reset();
    onOpenChange?.(next);
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
      // staff row fails, say so plainly rather than closing on a success that
      // didn't happen.
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

      reset();
      onOpenChange?.(false);
    } catch {
      setError("Couldn't create the account. Please check the details and try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-[720px] flex-col p-0 text-left">
        <div className="shrink-0 rounded-t-2xl border-b border-[#17263a12] bg-[#f7f4ec] px-13 py-7">
          <DialogTitle className="text-[26px] font-bold leading-tight tracking-tight text-[#17263a]">
            Create User Account
          </DialogTitle>
          <DialogDescription className="mt-2 text-[15px] text-[#5f6875]">
            Create an account for a new employee.
          </DialogDescription>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-13 py-9">
            {error && (
              <p className="mb-6 rounded-[10px] border border-[#b5474733] bg-[#b5474710] px-4 py-3 text-sm font-medium text-[#b54747]">
                {error}
              </p>
            )}

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

            <Field label="Contact Number" className="mt-6">
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

            <Field label="Temporary Password" className="mt-6">
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={6}
                  value={form.temporaryPassword}
                  onChange={update("temporaryPassword")}
                  placeholder="At least 6 characters"
                  className={`${inputClasses} pr-14`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-2 text-[#17263a99] hover:bg-[#17263a0d]"
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
            </Field>
          </div>

          <div className="flex shrink-0 justify-end gap-3 rounded-b-2xl border-t border-[#17263a12] bg-[#fafaf8] px-13 py-5">
            <button
              type="button"
              onClick={() => handleOpenChange(false)}
              disabled={isSubmitting}
              className="h-11 rounded-[10px] border border-[#17263a2e] bg-white px-6 text-[15px] font-medium text-[#17263a] shadow-[0_1px_2px_rgba(17,30,50,0.05)] transition hover:bg-[#17263a08] disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="h-11 rounded-[10px] bg-[#1b3a6b] px-6 text-[15px] font-semibold tracking-[0.3px] text-white shadow-[0_2px_5px_rgba(27,58,107,0.26)] transition hover:bg-[#17263a] disabled:opacity-60"
            >
              {isSubmitting ? "Creating…" : "Create Account"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const inputClasses =
  "h-13 w-full rounded-[10px] border border-[#17263a29] bg-white px-4 text-[17px] text-[#17263a] outline-none transition placeholder:text-[#17263a80] focus:ring-2 focus:ring-[#1b3a6b]/30";

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
      <div className="mt-2">{children}</div>
    </div>
  );
}
