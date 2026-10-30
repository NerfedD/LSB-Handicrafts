import FormError from "../shared/FormError";
import { guardForm, reportFormError } from "../../utils/formErrors";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input, LockedInput } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Field, RequirementList, Row } from "../shared/forms";
import { ROLE_BLURB, roleLabel } from "../../utils/copy";
import { passwordIsAcceptable, passwordRequirements } from "../../utils/password";
import { cleanPhoneInput, localPhoneDigits, phoneProblem } from "../../utils/phone";
import { ROLES } from "../../utils/staffData";

/**
 * Add a staff account — the create dialog from screen 2t.
 *
 * ONE REQUEST TO THE SERVER, NOT TWO WRITES FROM HERE. Creating an account
 * means a Supabase Auth user AND a `staff` row, and only the second one
 * actually grants access. This dialog used to do both from the browser, which
 * is how the project accumulated auth users with no staff row — people who
 * could sign in, saw nothing, and were signed straight back out with no
 * explanation. The admin-accounts function now provisions both halves or
 * neither, so there is no half-made account left for this screen to explain,
 * and the administrator's own session stays intact — `signUp` on the normal
 * client would have replaced it with the account being created.
 *
 * THE ROLE IS A ROW OF BUTTONS, not a dropdown — the same treatment as the
 * product kind. Five options that all fit on screen do not need to be hidden
 * behind a click, and the choice decides what the account can reach.
 *
 * DUPLICATES ARE CAUGHT ON THIS SIDE FIRST, against the staff list already
 * loaded. That is a courtesy and not the guarantee: the unique indexes on
 * lower(email) and lower(username) in schema.sql are the real boundary and
 * they still run. This only means somebody finds out before they have invented
 * a password, rather than after two round trips.
 *
 * A failed request retains every field for correction.
 */

const EMPTY = {
  name: "",
  role: "",
  contactNumber: "",
  username: "",
  email: "",
  password: "",
};

const DEPARTMENT = { Admin: "Office", Manager: "Office", "Sales Staff": "Sales", "Production Staff": "Production", "Delivery Staff": "Delivery" };
function takenBy(form, staff) {
  const found = {};
  const email = form.email.trim().toLowerCase();
  const username = form.username.trim().toLowerCase();
  const matches = (value, wanted) => String(value || "").trim().toLowerCase() === wanted;

  if (email && staff.some((person) => matches(person.email, email))) {
    found.email = "Somebody already signs in with that email address.";
  }
  if (username && staff.some((person) => matches(person.username, username))) {
    found.username = "That username is taken. Add a surname or an initial to it.";
  }
  return found;
}

export default function CreateAccountDialog({
  open,
  onOpenChange,
  onAccountCreated,
  staff = [],
}) {
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  // A field's own error clears as it is retyped: leaving "that username is
  // taken" under a box somebody has just changed is a form arguing with itself.
  const setField = (field) => (value) => {
    setForm((f) => ({ ...f, [field]: value }));
    setFieldErrors((previous) =>
      previous[field] ? { ...previous, [field]: undefined } : previous
    );
  };
  const requirements = passwordRequirements(form.password);

  function handleOpenChange(next) {
    // A dismissal mid-write is refused: the signup is already in flight and
    // there would be nowhere left to report whether the staff row followed it.
    if (submitting) return;
    if (!next) {
      setForm(EMPTY);
      setError(null);
      setFieldErrors({});
    }
    onOpenChange?.(next);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting) return;
    const formElement = event.currentTarget;
    const fail = (message) => { setError(message); reportFormError(formElement, message); };
    setError(null);
    if (!guardForm(formElement)) return;
    setFieldErrors({});

    if (!form.name.trim() || !form.email.trim()) {
      fail("A name and an email address are both needed — the email is how they sign in.");
      return;
    }
    if (!form.role) {
      fail("Say what this person does. Without it the account cannot open anything.");
      return;
    }
    // Before the password, not after: being told the email is taken is a reason
    // to stop, and there is no sense making somebody invent a password for an
    // account that is not going to be created.
    const taken = takenBy(form, staff);
    const phoneIssue = phoneProblem(form.contactNumber);
    if (phoneIssue) taken.contactNumber = phoneIssue;
    if (Object.keys(taken).length > 0) {
      setFieldErrors(taken);
      return;
    }

    if (!passwordIsAcceptable(form.password)) {
      fail("The first password needs to meet all three requirements below.");
      return;
    }

    setSubmitting(true);
    try {
      // The number goes to the server as DIGITS, which is now also exactly what
      // the box holds. localPhoneDigits is the same helper phoneProblem counts
      // with, so the two sides agree by construction -- and a value seeded or
      // pasted as +63 still reaches admin-accounts in the 09 form it checks.
      const result = await onAccountCreated({
        ...form,
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        contactNumber: localPhoneDigits(form.contactNumber),
      });
      if (!result?.ok) {
        fail(result?.message || 'The account was not created. Check the details and retry.');
        return;
      }
      setForm(EMPTY);
      setError(null);
      setFieldErrors({});
      onOpenChange?.(false);
    } catch {
      fail('The account could not be confirmed. Your entries are still here; check the connection and retry.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit} noValidate className="flex min-h-0 flex-col">
          <DialogHeader>
            <DialogTitle>Add user</DialogTitle>
            <DialogDescription>
              They sign in with the email and the first password you set here, and can change the password afterwards.
            </DialogDescription>
          </DialogHeader>

          <DialogBody>
            <FormError message={error} />

            <Field label="Full name" required>
              {(props) => (
                <Input
                  {...props}
                  maxLength={120}
                  value={form.name}
                  onChange={(event) => setField("name")(event.target.value)}
                  placeholder="Juan Dela Cruz"
                />
              )}
            </Field>

            <Field label="Work email" required error={fieldErrors.email} hint="This is what they type to sign in.">
              {(props) => (
                <Input
                  {...props}
                  type="email"
                  value={form.email}
                  onChange={(event) => setField("email")(event.target.value)}
                  placeholder="name@lsbhandicrafts.ph"
                />
              )}
            </Field>

            <Row>
              <Field label="Role" required>
                {(props) => (
                  <NativeSelect {...props} value={form.role} onChange={(event) => setField("role")(event.target.value)}>
                    <option value="">Choose a role</option>
                    {ROLES.map((role) => (
                      <option key={role} value={role}>{roleLabel(role)}</option>
                    ))}
                  </NativeSelect>
                )}
              </Field>
              <Field label="Department" hint="Follows from the role.">
                {(props) => <LockedInput {...props} value={DEPARTMENT[form.role] ?? ""} placeholder="Choose a role first" />}
              </Field>
            </Row>
            {form.role ? <p className="-mt-1.5 text-13 text-muted-fg">{ROLE_BLURB[form.role]}</p> : null}

            <Row>
              <Field label={<>Username <span className="font-normal text-muted-fg">(optional)</span></>} error={fieldErrors.username} hint="Shorter to type than the email.">
                {(props) => (
                  <Input
                    {...props}
                    pattern="[a-zA-Z0-9._\-]{3,50}"
                    maxLength={50}
                    title="Use 3 to 50 letters, numbers, dots, underscores or hyphens."
                    value={form.username}
                    onChange={(event) => setField("username")(event.target.value)}
                    placeholder="juan.delacruz"
                  />
                )}
              </Field>
              <Field label={<>Mobile <span className="font-normal text-muted-fg">(optional)</span></>} error={fieldErrors.contactNumber}>
                {(props) => (
                  <Input
                    {...props}
                    type="tel"
                    value={form.contactNumber}
                    onChange={(event) => setField("contactNumber")(cleanPhoneInput(event.target.value))}
                    placeholder="0917 000 0000"
                  />
                )}
              </Field>
            </Row>

            <div className="flex flex-col gap-2 rounded-md border border-border p-3">
              <Field label="First password" required hint="Tell it to them in person. They can change it once they are in.">
                {(props) => (
                  <Input
                    {...props}
                    type="text"
                    maxLength={128}
                    value={form.password}
                    onChange={(event) => setField("password")(event.target.value)}
                    placeholder="Something they can type"
                    autoComplete="off"
                  />
                )}
              </Field>
              <RequirementList requirements={requirements} />
            </div>
          </DialogBody>

          <DialogFooter>
            <Button variant="outline" disabled={submitting} onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Adding…" : "Add user"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
