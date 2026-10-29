import { useState } from "react";

import { FloppyDisk } from "../icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar } from "../shared/Chip";
import { Page, PageHeader } from "../shared/page";
import { DetailsSection, PasswordSection, PreferencesSection, SessionsSection } from "./ProfileSections";
import useTheme from "../../hooks/useTheme";
import { DASHBOARD_VIEW } from "../../utils/constants";
import { roleLabel } from "../../utils/copy";

/**
 * Your profile, drawn to the "13 · Your profile" board:
 *
 *   the profile header (avatar, name, role, email; photo buttons, Save
 *   changes) → Your details → Password → How the app looks for you → Where
 *   you're signed in.
 *
 * The app keeps no profile photo or list of sessions, so those buttons are
 * disabled. Theme goes through hooks/useTheme; text size is the dashboard
 * view preference.
 */
export default function MyProfilePage({ profile, dashboardView = DASHBOARD_VIEW.STANDARD, onSaveDetails, onSetDashboardView }) {
  const [theme, setTheme] = useTheme();
  const [dirty, setDirty] = useState(false);

  return (
    <Page>
      <PageHeader
        leading={<Avatar name={profile?.name} size="lg" />}
        title={profile?.name}
        titleBadge={<Badge variant="outline">{roleLabel(profile?.role)}</Badge>}
        description={profile?.email}
        actions={
          <>
            <Button variant="outline" disabled title="Profile photos are not stored yet">Change photo</Button>
            <Button variant="ghost" disabled>Use initials</Button>
            {dirty ? <Badge variant="warning">Unsaved changes</Badge> : null}
            <Button type="submit" form="mp-details-form" disabled={!dirty}>
              <FloppyDisk aria-hidden="true" />
              Save changes
            </Button>
          </>
        }
      />
      <DetailsSection profile={profile} formId="mp-details-form" onSave={onSaveDetails} onDirtyChange={setDirty} />
      <PasswordSection profile={profile} />
      <PreferencesSection theme={theme} onTheme={setTheme} dashboardView={dashboardView} onSetDashboardView={onSetDashboardView} />
      <SessionsSection />
    </Page>
  );
}
