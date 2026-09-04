import { ALargeSmall, AtSign, KeyRound, LayoutDashboard, Pencil, Phone, UserRound } from "../icons";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar } from "../shared/Chip";
import FactTable from "../shared/FactTable";
import { RadioRow } from "../shared/forms";
import StatusPill from "../shared/StatusPill";
import { DASHBOARD_VIEW } from "../../utils/constants";
import { ROLE_BLURB, roleLabel } from "../../utils/copy";
import { formatLongDate } from "../../utils/profileFormat";

/**
 * My profile — screen 2s.
 *
 * THE ROLE COMES WITH ITS SENTENCE. Telling somebody they are "Sales Staff"
 * tells them nothing about why half the sidebar is missing. The line underneath
 * says what the role reaches, which turns a puzzling absence into a rule they
 * can accept — and stops the support question that follows it.
 *
 * "HOW YOUR DASHBOARD LOOKS" LIVES HERE, and also in the header's account menu.
 * The handoff flags that the profile screen alone may be too buried for a
 * preference that decides how the whole system reads to somebody, and putting
 * it in both places costs one menu item. The note under it — "this changes only
 * what you see" — is what stops somebody worrying they are changing it for the
 * whole office.
 */
export default function MyProfilePage({
  profile,
  dashboardView = DASHBOARD_VIEW.STANDARD,
  onEdit,
  onChangePassword,
  onSetDashboardView,
}) {
  return (
    <div className="mx-auto grid w-full max-w-[900px] gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="flex min-w-0 flex-col gap-4">
        <Card className="p-6 text-center">
          <div className="flex flex-col items-center">
            <Avatar name={profile?.name} size="2xl" />
            <h2 className="pt-4 text-[25px] font-extrabold tracking-[-0.02em] text-ink">
              {profile?.name}
            </h2>
            <div className="pt-2.5">
              <StatusPill label={roleLabel(profile?.role)} tone="cobalt" mark={false} size="sm" />
            </div>
            <p className="max-w-[46ch] pt-3 text-[15.5px] leading-[1.55] text-muted">
              {ROLE_BLURB[profile?.role] ??
                "Nobody has said what your account does yet, so most screens are closed to it. An administrator can change that."}
            </p>
          </div>

          <div className="flex flex-wrap justify-center gap-3 pt-5">
            <Button variant="cobalt" size="lg" onClick={onEdit}>
              <Pencil className="h-5 w-5" />
              Edit my details
            </Button>
            <Button variant="outline" size="lg" onClick={onChangePassword}>
              <KeyRound className="h-5 w-5" />
              Change password
            </Button>
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Your details</CardTitle>
          </CardHeader>
          <FactTable
            rows={[
              {
                label: "Email",
                value: profile?.email || null,
                icon: <AtSign className="h-4.5 w-4.5" />,
              },
              {
                label: "Username",
                value: profile?.username || null,
                icon: <UserRound className="h-4.5 w-4.5" />,
              },
              {
                label: "Phone",
                value: profile?.contactNumber || null,
                icon: <Phone className="h-4.5 w-4.5" />,
              },
              {
                label: "With LSB since",
                value: profile?.createdAt ? formatLongDate(profile.createdAt) : null,
              },
            ]}
          />
        </Card>
      </div>

      <Card className="h-fit">
        <CardHeader>
          <CardTitle>How your dashboard looks</CardTitle>
        </CardHeader>
        <div className="p-4.5">
          <RadioRow
            label="How your dashboard looks"
            value={dashboardView}
            onChange={onSetDashboardView}
            options={[
              {
                value: DASHBOARD_VIEW.STANDARD,
                label: "Standard",
                description:
                  "More on screen at once. Best if you are in the system all day.",
              },
              {
                value: DASHBOARD_VIEW.LARGE,
                label: "Large text",
                description:
                  "Bigger words and buttons, fewer things per screen. The same system, easier to read across a room.",
              },
            ]}
          />
          <p className="flex items-start gap-2.5 pt-3.5 text-[14.5px] leading-[1.5] text-muted">
            <LayoutDashboard className="mt-0.5 h-4.5 w-4.5 shrink-0" aria-hidden="true" />
            This changes only what you see. Nobody else&rsquo;s screen is affected, and only
            the dashboard looks different — everything else is the same either way.
          </p>
          <p className="flex items-start gap-2.5 pt-2.5 text-[14.5px] leading-[1.5] text-muted">
            <ALargeSmall className="mt-0.5 h-4.5 w-4.5 shrink-0" aria-hidden="true" />
            You can also switch this from the menu behind your name, top right.
          </p>
        </div>
      </Card>
    </div>
  );
}
