import FormError from "../shared/FormError";
import { guardForm, reportFormError } from "../../utils/formErrors";
import { useState } from "react";

import { CircleAlert, ClipboardList, Hammer, Shield, Truck, UserCog } from "../icons";
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
import { Input } from "@/components/ui/input";
import { ChoiceButtons, Field, RequirementList } from "../shared/forms";
import { passwordIsAcceptable, passwordRequirements } from "../../utils/password";
import { ROLES } from "../../utils/staffData";

/** The administrator's session stays intact: the server provisions Auth and
 * staff together. A failed request retains every field for correction. */

const EMPTY = {
  name: "",
  role: "",
  contactNumber: "",
  username: "",
  email: "",
  password: "",
};

const ROLE_ICONS = {
  Admin: <Shield className="h-5 w-5" />,
  Manager: <UserCog className="h-5 w-5" />,
  "Sales Staff": <ClipboardList className="h-5 w-5" />,
  "Production Staff": <Hammer className="h-5 w-5" />,
  "Delivery Staff": <Truck className="h-5 w-5" />,
};

export default function CreateAccountDialog({ open, onOpenChange, onAccountCreated }) {
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const setField = (field) => (value) => setForm((f) => ({ ...f, [field]: value }));
  const requirements = passwordRequirements(form.password);

  function handleOpenChange(next) {
    // A dismissal mid-write is refused: the signup is already in flight and
    // there would be nowhere left to report whether the staff row followed it.
    if (submitting) return;
    if (!next) {
      setForm(EMPTY);
      setError(null);
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

    if (!form.name.trim() || !form.email.trim()) {
      fail("A name and an email address are both needed — the email is how they sign in.");
      return;
    }
    if (!form.role) {
      fail("Say what this person does. Without it the account cannot open anything.");
      return;
    }
    if (!passwordIsAcceptable(form.password)) {
      fail("The first password needs to meet all three requirements below.");
      return;
    }

    setSubmitting(true);
    try {
      const result = await onAccountCreated({ ...form, name: form.name.trim(), email: form.email.trim().toLowerCase() });
      if (!result?.ok) {
        fail(result?.message || 'The account was not created. Check the details and retry.');
        return;
      }
      setForm(EMPTY);
      setError(null);
      onOpenChange?.(false);
    } catch {
      fail('The account could not be confirmed. Your entries are still here; check the connection and retry.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-[600px]">
        <form onSubmit={handleSubmit} noValidate className="flex min-h-0 flex-col">
          <DialogHeader>
            <DialogTitle>Add a staff account</DialogTitle>
            <DialogDescription>
              They will sign in with the email and first password you set here, and can
              change the password afterwards.
            </DialogDescription>
          </DialogHeader>

          <DialogBody className="flex flex-col gap-5.5">
            <FormError message={error} />

            <Field label="Their name" required>
              {(props) => (
                <Input
                  {...props}
                  maxLength={200}
                  value={form.name}
                  onChange={(event) => setField("name")(event.target.value)}
                  placeholder="Ana Reyes"
                />
              )}
            </Field>

            <Field label="What they do" required hint="This decides which screens they can open.">
              <ChoiceButtons
                label="What they do"
                value={form.role}
                onChange={setField("role")}
                className="sm:grid-cols-3"
                options={ROLES.map((role) => ({
                  value: role,
                  label: role === "Admin" ? "Administrator" : role,
                  icon: ROLE_ICONS[role],
                }))}
              />
            </Field>

            <Field label="Email address" required hint="This is what they type to sign in.">
              {(props) => (
                <Input
                  {...props}
                  type="email"
                  value={form.email}
                  onChange={(event) => setField("email")(event.target.value)}
                  placeholder="them@example.com"
                />
              )}
            </Field>

            <Field
              label="Username"
              hint="Optional. A shorter thing to type than an email — they can use either."
            >
              {(props) => (
                <Input
                  {...props}
                  pattern="[a-zA-Z0-9._\-]{3,50}"
                  maxLength={50}
                  title="Use 3 to 50 letters, numbers, dots, underscores or hyphens."
                  value={form.username}
                  onChange={(event) => setField("username")(event.target.value)}
                  placeholder="ana.reyes"
                />
              )}
            </Field>

            <Field label="Phone number" hint="So colleagues can reach them without asking around.">
              {(props) => (
                <Input
                  {...props}
                  inputMode="tel"
                  value={form.contactNumber}
                  onChange={(event) => setField("contactNumber")(event.target.value)}
                  placeholder="09XX XXX XXXX"
                />
              )}
            </Field>

            <Field
              label="First password"
              required
              hint="Tell it to them in person. They can change it once they are in."
            >
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

            {/* Shown in the clear, deliberately: an administrator has to read
                this out loud to somebody standing next to them, and a masked
                field they cannot check is a password typed wrong twice. */}
            <RequirementList requirements={requirements} />
          </DialogBody>

          <DialogFooter className="justify-between">
            <Button
              variant="outline"
              size="lg"
              disabled={submitting}
              onClick={() => handleOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="cobalt" size="lg" disabled={submitting}>
              {submitting ? "Creating…" : "Create the account"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
