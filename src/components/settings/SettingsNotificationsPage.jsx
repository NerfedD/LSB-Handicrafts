import { Fragment } from "react";

import { Bell, FloppyDisk } from "../icons";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Page, PageHeader } from "../shared/page";
import { NotStoredYet, SettingsSection } from "./SettingsParts";

/**
 * Settings · Notifications, drawn to the "10 · Settings · Notifications"
 * board: the event-by-channel grid, the daily summary and quiet hours.
 *
 * The app sends no notifications and stores no preferences for them, so
 * every control is disabled and unticked.
 */
const GROUPS = [
  ["Orders", [["A new order is taken", "By anyone, from any screen"], ["An order is cancelled", "Stock it held goes back on the shelf"]]],
  ["Stock", [["A product runs low", "At or below its warning level"], ["A raw material needs ordering", "After what batches will use"]]],
  ["Production", [["A batch is waiting for quality check", "Ready to count and finish"]]],
  ["Deliveries", [["A delivery is late", "Past the day promised"], ["A delivery arrives", "Marked delivered by the driver"]]],
  ["Accounts", [["Someone cannot sign in", "Suspended or without a role"]]],
];
const CHANNELS = ["In the app", "Email", "Text message"];

export default function SettingsNotificationsPage({ profile }) {
  return (
    <Page>
      <PageHeader
        icon={Bell}
        title="Notifications"
        description="Your own alerts. Each person chooses theirs; this does not change anyone else's."
        actions={
          <Button disabled>
            <FloppyDisk aria-hidden="true" />
            Save changes
          </Button>
        }
      />

      <NotStoredYet>The app does not send alerts yet, so there is nothing to switch on. This is how choosing them will look.</NotStoredYet>

      <section aria-labelledby="sn-events" className="rounded-lg border border-border bg-card shadow-xs">
        <div className="px-4 pb-3 pt-4">
          <h2 id="sn-events" className="m-0 text-sm font-semibold">Tell me when</h2>
          <p className="m-0 text-13 text-muted-fg">
            Text messages would go to {profile?.contactNumber || "your mobile"}. Email would go to {profile?.email || "your sign-in email"}.
          </p>
        </div>
        <div className="border-t border-border">
          <Table minWidth={640} aria-label="Notification channels">
            <TableHeader>
              <TableRow>
                <TableHead>Event</TableHead>
                {CHANNELS.map((channel) => (
                  <TableHead key={channel} className="w-[120px] text-center">{channel}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {GROUPS.map(([group, events]) => (
                <Fragment key={group}>
                  <TableRow className="h-8 bg-surface-2">
                    <TableHead scope="rowgroup" colSpan={4} className="h-8 text-xs font-semibold text-fg-2">{group}</TableHead>
                  </TableRow>
                  {events.map(([name, hint]) => (
                    <TableRow key={name} className="h-11">
                      <TableCell>
                        <div className="font-medium">{name}</div>
                        <div className="text-xs text-muted-fg">{hint}</div>
                      </TableCell>
                      {CHANNELS.map((channel) => (
                        <TableCell key={channel} className="text-center">
                          <Checkbox disabled checked={false} aria-label={`${name}: ${channel}`} />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </Fragment>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      <SettingsSection
        id="sn-daily"
        title="Daily summary"
        description="One email with the day's orders, deliveries and stock to watch."
        action={<Switch aria-label="Daily summary" disabled />}
      >
        <div className="flex flex-wrap items-center gap-2 text-13 text-muted-fg">
          <span>Send at</span>
          <label htmlFor="sn-time" className="sr-only">Send time</label>
          <Input id="sn-time" disabled placeholder="6:00 PM" className="w-28" />
          <span>every working day</span>
        </div>
      </SettingsSection>

      <SettingsSection
        id="sn-quiet"
        title="Quiet hours"
        description="No text messages overnight. They wait in the app until morning."
        action={<Switch aria-label="Quiet hours" disabled />}
      >
        <div className="flex flex-wrap items-center gap-2 text-13 text-muted-fg">
          <span>From</span>
          <label htmlFor="sn-q1" className="sr-only">Quiet from</label>
          <Input id="sn-q1" disabled placeholder="9:00 PM" className="w-28" />
          <span>to</span>
          <label htmlFor="sn-q2" className="sr-only">Quiet until</label>
          <Input id="sn-q2" disabled placeholder="7:00 AM" className="w-28" />
        </div>
      </SettingsSection>
    </Page>
  );
}
