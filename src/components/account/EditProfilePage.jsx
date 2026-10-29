import { User } from "../icons";
import { Button } from "@/components/ui/button";
import { Page, PageHeader } from "../shared/page";
import { DetailsSection } from "./ProfileSections";

/** Your details on their own: the Your profile board's details section as a screen. */
export default function EditProfilePage({ profile, onBack, onSave }) {
  return (
    <Page>
      <PageHeader back={{ label: "Back to your profile", onClick: onBack }} icon={User} title="Edit your details" description="How your name shows on orders and in the activity log." />
      <DetailsSection
        profile={profile}
        formId="edit-profile-form"
        onSave={onSave}
        footer={(saving, changed) => (
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onBack}>Cancel</Button>
            <Button type="submit" disabled={!changed || saving}>{saving ? "Saving…" : "Save changes"}</Button>
          </div>
        )}
      />
    </Page>
  );
}
