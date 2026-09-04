import { useState } from "react";

import { ArrowLeft, Save } from "../icons";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Field, FormBand, FormFooter, LockedField } from "../shared/forms";

/**
 * Edit my details.
 *
 * TWO EDITABLE FIELDS, and that is not an oversight. Your own name and phone
 * number are yours to correct; your email is how you sign in, and your role is
 * what an administrator decided you do. Both of those are shown, locked, with a
 * line saying who to ask — because a screen that silently omits them leaves
 * somebody hunting for where to change them.
 *
 * The write goes through an RPC that updates exactly these two columns on
 * exactly the caller's own row (see storageManager.saveOwnProfile). A policy
 * permissive enough to let somebody edit their own row would also let them set
 * their own role to Administrator; RLS gates rows, not columns.
 */
export default function EditProfilePage({ profile, onBack, onSave }) {
  const [name, setName] = useState(profile?.name ?? "");
  const [contactNumber, setContactNumber] = useState(profile?.contactNumber ?? "");
  const [saving, setSaving] = useState(false);

  const changed =
    name !== (profile?.name ?? "") || contactNumber !== (profile?.contactNumber ?? "");

  async function handleSubmit(event) {
    event.preventDefault();
    if (!changed || saving) return;
    setSaving(true);
    await onSave?.({ name: name.trim(), contactNumber: contactNumber.trim() });
    setSaving(false);
  }

  return (
    <div className="mx-auto flex w-full max-w-[640px] flex-col gap-4">
      <Button variant="ghost" size="sm" className="self-start px-2" onClick={onBack}>
        <ArrowLeft className="h-5 w-5" />
        My profile
      </Button>

      <Card>
        <form onSubmit={handleSubmit}>
          <FormBand title="Your details">
            <Field label="Your name" hint="How you appear to colleagues throughout the system.">
              {(props) => (
                <Input
                  {...props}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              )}
            </Field>

            <Field label="Phone number" hint="So colleagues can reach you without asking around.">
              {(props) => (
                <Input
                  {...props}
                  inputMode="tel"
                  value={contactNumber}
                  onChange={(event) => setContactNumber(event.target.value)}
                  placeholder="09XX XXX XXXX"
                />
              )}
            </Field>

            <LockedField
              label="Email address"
              value={profile?.email}
              hint="This cannot be changed here — it is how you sign in. Ask an administrator."
            />

            <LockedField
              label="What you do"
              value={profile?.role || "Nothing set yet"}
              hint="Only an administrator can change what your account is allowed to open."
            />
          </FormBand>

          <FormFooter
            left={
              <Button variant="outline" size="lg" onClick={onBack}>
                Cancel
              </Button>
            }
            right={
              <Button type="submit" variant="cobalt" size="lg" disabled={!changed || saving}>
                <Save className="h-5 w-5" />
                {saving ? "Saving…" : "Save my details"}
              </Button>
            }
          />
        </form>
      </Card>
    </div>
  );
}
