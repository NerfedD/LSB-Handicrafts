import { Fragment, useEffect, useState } from "react";

import { Bell, FloppyDisk, Info } from "../icons";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import Callout from "../shared/Callout";
import FormError from "../shared/FormError";
import { Page, PageHeader } from "../shared/page";
import { LoadingState } from "../shared/PageStates";
import { SettingsSection } from "./SettingsParts";
import { eventsFor, NOTIFICATION_GROUPS } from "../../utils/notifications";

/**
 * Settings · Notifications, drawn to the "10 · Settings · Notifications"
 * board: the event-by-channel grid, the daily summary and quiet hours.
 *
 * "In the app" works: each person ticks the events they want under the bell
 * in the top bar, saved to public.notification_settings, and only the events
 * their role can see are offered. Somebody who has never saved hears about
 * all of them. Email and text messages, the daily summary email and quiet
 * hours are drawn but stay off: they need an outside sending service.
 */
const CHANNELS = ["In the app", "Email", "Text message"];
const same = (a, b) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());

export default function SettingsNotificationsPage({ profile, loadSettings, onSave }) {
  const allowed = eventsFor(profile?.role);
  const [saved, setSaved] = useState(null);
  const [chosen, setChosen] = useState([]);
  const [loadFailed, setLoadFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  useEffect(() => {
    if (!loadSettings) return undefined;
    let live = true;
    loadSettings().then((result) => {
      if (!live) return;
      if (!result.ok) { setLoadFailed(true); return; }
      // Never saved: every event the role allows is on.
      const start = (result.data ?? allowed).filter((event) => allowed.includes(event));
      setSaved(start);
      setChosen(start);
    });
    return () => { live = false; };
    // The role does not change while this screen is open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadSettings]);

  if (loadFailed) {
    return (
      <Page>
        <PageHeader icon={Bell} title="Notifications" description="Your own alerts." />
        <FormError message="Your notification settings could not be loaded. Refresh to try again." />
      </Page>
    );
  }
  if (saved === null) return <LoadingState noun="notification settings" />;

  const dirty = !same(saved, chosen);
  const toggle = (event) => setChosen((now) => (now.includes(event) ? now.filter((e) => e !== event) : [...now, event]));

  async function save() {
    if (saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      const result = await onSave(chosen);
      if (result?.ok) {
        const kept = result.data ?? chosen;
        setSaved(kept);
        setChosen(kept);
      } else {
        setSaveError(result?.message || "Your notification settings were not saved. Try again.");
      }
    } catch {
      setSaveError("We could not reach the system, so nothing was saved.");
    } finally {
      setSaving(false);
    }
  }

  const groups = NOTIFICATION_GROUPS
    .map(([group, events]) => [group, events.filter(([key]) => allowed.includes(key))])
    .filter(([, events]) => events.length > 0);

  return (
    <Page>
      <PageHeader
        icon={Bell}
        title="Notifications"
        description="Your own alerts. Each person chooses theirs; this does not change anyone else's."
        actions={
          <Button disabled={!dirty || saving} onClick={save}>
            <FloppyDisk aria-hidden="true" />
            {saving ? "Saving…" : "Save changes"}
          </Button>
        }
      />

      <FormError message={saveError} />
      <Callout tone="neutral" icon={<Info />} title="Alerts arrive in the app, under the bell at the top">
        Email, text messages and the daily summary need a sending service, which is not set up yet, so those stay off.
      </Callout>

      <section aria-labelledby="sn-events" className="rounded-lg border border-border bg-card shadow-xs">
        <div className="px-4 pb-3 pt-4">
          <h2 id="sn-events" className="m-0 text-sm font-semibold">Tell me when</h2>
          <p className="m-0 text-13 text-muted-fg">
            Only what your role works with is listed. Text messages would go to {profile?.contactNumber || "your mobile"}; email to {profile?.email || "your sign-in email"}.
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
              {groups.map(([group, events]) => (
                <Fragment key={group}>
                  <TableRow className="h-8 bg-surface-2">
                    <TableHead scope="rowgroup" colSpan={4} className="h-8 text-xs font-semibold text-fg-2">{group}</TableHead>
                  </TableRow>
                  {events.map(([key, name, hint]) => (
                    <TableRow key={key} className="h-11">
                      <TableCell>
                        <div className="font-medium">{name}</div>
                        <div className="text-xs text-muted-fg">{hint}</div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Checkbox checked={chosen.includes(key)} onCheckedChange={() => toggle(key)} aria-label={`${name}: In the app`} />
                      </TableCell>
                      {CHANNELS.slice(1).map((channel) => (
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
        description="One email with the day's orders, deliveries and stock to watch. Needs an email service first."
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
        description="No text messages overnight. Needs a text message service first."
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
