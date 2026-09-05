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
import Callout from "../shared/Callout";
import { ChoiceButtons, Field, RequirementList } from "../shared/forms";
import { createSignupClient } from "../../lib/supabaseSignupClient";
import { passwordIsAcceptable, passwordRequirements } from "../../utils/password";
import { ROLES } from "../../utils/staffData";

/**
 * Add a staff account — the create dialog from screen 2t.
 *
 * TWO WRITES TO TWO SYSTEMS, and the reason the error handling here is longer
 * than the form: creating an account means a Supabase Auth user AND a `staff`
 * row, and only the second one actually grants access. Treating the first as
 * the whole job is how this project accumulated auth users with no staff row —
 * people who could sign in, saw nothing, and were signed straight back out with
 * no explanation. If the staff row fails, this says so plainly and tells the
 * administrator what to do about it rather than closing on a success that did
 * not happen.
 *
 * The signup runs on a SEPARATE Supabase client (see lib/supabaseSignupClient)
 * because `signUp` on the normal one would replace the administrator's own
 * session with the account they are creating.
 *
 * THE ROLE IS A ROW OF BUTTONS, not a dropdown — the same treatment as the
 * product kind. Five options that all fit on screen do not need to be hidden
 * behind a click, and the choice decides what the account can reach.
 */

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
    setError(null);

    if (!form.name.trim() || !form.email.trim()) {
      setError("A name and an email address are both needed — the email is how they sign in.");
      return;
    }
    if (!form.role) {
      setError("Say what this person does. Without it the account cannot open anything.");
      return;
    }
    if (!passwordIsAcceptable(form.password)) {
      setError("The first password needs to meet all three requirements below.");
      return;
    }

    setSubmitting(true);
    try {
      const signupClient = createSignupClient();
      const { error: signUpError } = await signupClient.auth.signUp({
        email: form.email.trim().toLowerCase(),
        password: form.password,
      });

      if (signUpError) {
        setError(signUpError.message);
        return;
      }

      const created = await onAccountCreated?.({
        name: form.name.trim(),
        role: form.role,
        contactNumber: form.contactNumber,
        email: form.email.trim().toLowerCase(),
        username: form.username,
      });

      if (created === false) {
        setError(
          "The sign-in was created, but granting access failed. Add this person under " +
            "Staff & accounts before they try to sign in, or they will be turned away " +
            "with no explanation."
        );
        return;
      }

      handleOpenChange(false);
    } catch {
      setError("We could not reach the system, so nothing was created. Try again.");
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
            {error && (
              <Callout tone="red" icon={<CircleAlert />} title="Not created.">
                {error}
              </Callout>
            )}

            <Field label="Their name" required>
              {(props) => (
                <Input
                  {...props}
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
