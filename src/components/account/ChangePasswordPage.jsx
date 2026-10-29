import { Key } from "../icons";
import { Page, PageHeader } from "../shared/page";
import { PasswordSection } from "./ProfileSections";

/** Your password on its own: the Your profile board's password section as a screen. */
export default function ChangePasswordPage({ profile, onBack }) {
  return (
    <Page>
      <PageHeader back={{ label: "Back to your profile", onClick: onBack }} icon={Key} title="Change password" description="Your current password is checked before it changes." />
      <PasswordSection profile={profile} />
    </Page>
  );
}
