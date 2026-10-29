import { useState } from "react";

import { FloppyDisk, UserGear } from "../icons";
import { Button } from "@/components/ui/button";
import { NotFoundState } from "../shared/PageStates";
import { Page, PageHeader } from "../shared/page";
import { RoleChoices } from "./RoleChoices";

/**
 * Change one person's role, on its own: the Role section of the Account
 * details board as a screen, reached from a User Management row's "Change
 * role". Saving goes through the same handler as the account screen.
 */
export default function ChangeRolePage({ account, onBack, onSave }) {
  const [role, setRole] = useState(account?.role ?? "");
  const [revision] = useState(account?.revision ?? 0);
  const [saving, setSaving] = useState(false);

  if (!account) return <NotFoundState noun="account" onBack={onBack} />;

  const first = String(account.name || "this person").split(" ")[0];
  const changed = role && role !== account.role;

  async function handleSubmit(event) {
    event.preventDefault();
    if (!changed || saving) return;
    setSaving(true);
    await onSave?.(role, revision);
    setSaving(false);
  }

  return (
    <Page>
      <PageHeader
        back={{ label: `Back to ${first}'s account`, onClick: onBack }}
        icon={UserGear}
        title={`Change ${first}'s role`}
        description={`It decides which screens ${first} can open. Nothing they have already recorded changes.`}
      />
      <form onSubmit={handleSubmit} className="max-w-[720px] rounded-lg border border-border bg-card shadow-xs">
        <div className="border-b border-border px-4 py-3.5">
          <h2 className="m-0 text-sm font-semibold">Role</h2>
        </div>
        <div className="px-4 py-3">
          <RoleChoices label={`What ${first} does`} value={role} onChange={setRole} />
        </div>
        <div className="flex justify-end gap-2 border-t border-border px-4 py-3">
          <Button variant="outline" onClick={onBack}>Cancel</Button>
          <Button type="submit" disabled={!changed || saving}>
            <FloppyDisk aria-hidden="true" />
            {saving ? "Saving…" : "Save role"}
          </Button>
        </div>
      </form>
    </Page>
  );
}
