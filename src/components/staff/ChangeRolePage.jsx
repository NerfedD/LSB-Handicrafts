import { useState } from "react";

import {
  ArrowLeft,
  ClipboardList,
  Hammer,
  Save,
  Shield,
  Truck,
  UserCog,
} from "../icons";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FormBand, FormFooter, RadioCards } from "../shared/forms";
import { NotFoundState } from "../shared/PageStates";
import { ROLE_BLURB } from "../../utils/copy";
import { ROLES } from "../../utils/staffData";

/**
 * What does this person do? — screen 2q.
 *
 * NOT "ASSIGN STAFF ROLE". The screen used to be titled that and offered a list
 * of five words, which is a quiz: nothing about "Manager" tells you whether it
 * can delete a staff account, and an administrator picking one was guessing at
 * what they were granting.
 *
 * Each option now SPELLS OUT WHAT IT UNLOCKS in a sentence. That is the whole
 * screen: the words are the same five, the sentences are the design.
 *
 * Radio cards rather than a dropdown, because all five have to be readable at
 * once to be compared — and comparing them is the decision being made.
 */

const ROLE_ICONS = {
  Admin: { icon: <Shield className="h-5 w-5" />, tone: "cobalt" },
  Manager: { icon: <UserCog className="h-5 w-5" />, tone: "purple" },
  "Sales Staff": { icon: <ClipboardList className="h-5 w-5" />, tone: "green" },
  "Production Staff": { icon: <Hammer className="h-5 w-5" />, tone: "clay" },
  "Delivery Staff": { icon: <Truck className="h-5 w-5" />, tone: "amber" },
};

export default function ChangeRolePage({ account, onBack, onSave }) {
  const [role, setRole] = useState(account?.role ?? "");
  const [saving, setSaving] = useState(false);

  if (!account) return <NotFoundState noun="account" onBack={onBack} />;

  const first = String(account.name || "this person").split(" ")[0];
  const changed = role && role !== account.role;

  async function handleSubmit(event) {
    event.preventDefault();
    if (!changed || saving) return;
    setSaving(true);
    await onSave?.(role);
    setSaving(false);
  }

  const options = ROLES.map((value) => ({
    value,
    label: value === "Admin" ? "Administrator" : value,
    description: ROLE_BLURB[value],
    ...ROLE_ICONS[value],
  }));

  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-4">
      <Button variant="ghost" size="sm" className="self-start px-2" onClick={onBack}>
        <ArrowLeft className="h-5 w-5" />
        Back to {first}&rsquo;s account
      </Button>

      <Card>
        <form onSubmit={handleSubmit}>
          <FormBand title={`What does ${first} do?`}>
            <p className="-mt-1 text-[16px] leading-[1.5] text-muted">
              This decides which screens {first} can open. It can be changed at any time,
              and changing it does not affect anything they have already made.
            </p>

            <RadioCards
              label={`What ${first} does`}
              options={options}
              value={role}
              onChange={setRole}
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
                {saving ? "Saving…" : "Save what they do"}
              </Button>
            }
          />
        </form>
      </Card>
    </div>
  );
}
