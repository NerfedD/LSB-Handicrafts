import { useRef, useState } from "react";

import { FloppyDisk } from "../icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar } from "../shared/Chip";
import { useStaffPhoto } from "../shared/staffPhotos";
import { Page, PageHeader } from "../shared/page";
import { DetailsSection, PasswordSection, PreferencesSection, SessionsSection } from "./ProfileSections";
import useTheme from "../../hooks/useTheme";
import { DASHBOARD_VIEW } from "../../utils/constants";
import { roleLabel } from "../../utils/copy";
import { PHOTO_TYPES, preparePhoto } from "../../utils/photos";

/**
 * Your profile, drawn to the "13 · Your profile" board:
 *
 *   the profile header (avatar, name, role, email; photo buttons, Save
 *   changes) → Your details → Password → How the app looks for you → Where
 *   you're signed in.
 *
 * Change photo picks a picture, which the browser cuts down to a small
 * square-ish JPEG before it is saved (public.save_own_photo, the caller's own
 * row only); Use initials removes it. The other sign-ins cannot be LISTED
 * (Supabase shows a person only their own current session) but they can be
 * ended -- see SessionsSection. Theme goes through hooks/useTheme; text size
 * is the dashboard view preference.
 */
export default function MyProfilePage({ profile, dashboardView = DASHBOARD_VIEW.STANDARD, onSaveDetails, onSetDashboardView, onSavePhoto }) {
  const [theme, setTheme] = useTheme();
  const [dirty, setDirty] = useState(false);
  const photo = useStaffPhoto(profile?.name);
  const picker = useRef(null);
  const [photoWorking, setPhotoWorking] = useState(false);
  const [photoError, setPhotoError] = useState(null);

  async function savePhoto(dataUrl) {
    if (!onSavePhoto || photoWorking) return;
    setPhotoError(null);
    setPhotoWorking(true);
    try {
      const result = await onSavePhoto(dataUrl);
      if (!result?.ok) setPhotoError(result?.message || "Your photo was not saved. Try again.");
    } finally {
      setPhotoWorking(false);
    }
  }

  async function choosePhoto(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      // A circle a few dozen pixels across never needs more than 256.
      await savePhoto(await preparePhoto(file, { maxSide: 256, maxLength: 380_000 }));
    } catch (problem) {
      setPhotoError(problem?.message || "That file could not be used as a photo.");
    }
  }

  return (
    <Page>
      <PageHeader
        leading={<Avatar name={profile?.name} size="lg" />}
        title={profile?.name}
        titleBadge={<Badge variant="outline">{roleLabel(profile?.role)}</Badge>}
        description={profile?.email}
        actions={
          <>
            <input ref={picker} type="file" accept={PHOTO_TYPES.join(",")} className="sr-only" tabIndex={-1} aria-label="Photo" onChange={choosePhoto} />
            <Button variant="outline" disabled={!onSavePhoto || photoWorking} onClick={() => picker.current?.click()}>
              {photoWorking ? "Saving…" : photo ? "Change photo" : "Add a photo"}
            </Button>
            {photo ? <Button variant="ghost" disabled={photoWorking} onClick={() => savePhoto(null)}>Use initials</Button> : null}
            {dirty ? <Badge variant="warning">Unsaved changes</Badge> : null}
            <Button type="submit" form="mp-details-form" disabled={!dirty}>
              <FloppyDisk aria-hidden="true" />
              Save changes
            </Button>
          </>
        }
      />
      {photoError ? <p role="alert" className="m-0 text-13 text-danger-fg">{photoError}</p> : null}
      <DetailsSection profile={profile} formId="mp-details-form" onSave={onSaveDetails} onDirtyChange={setDirty} />
      <PasswordSection profile={profile} />
      <PreferencesSection theme={theme} onTheme={setTheme} dashboardView={dashboardView} onSetDashboardView={onSetDashboardView} />
      <SessionsSection />
    </Page>
  );
}
