import { Fragment, useMemo, useState } from "react";

import useUrlState from "../../hooks/useUrlState";
import { ClockCounterClockwise, DownloadSimple } from "../icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar } from "../shared/Chip";
import { EmptyState, FilterSelect, Page, PageHeader, SearchField } from "../shared/page";
import { LoadingState } from "../shared/PageStates";
import { downloadCsv } from "@/lib/csv";
import { ACTIVITY_KIND, groupByDay, timeLabel } from "../../utils/activityLog";
import { matches } from "../../utils/search";

/**
 * The activity log, drawn to the "11 · Settings · Activity log" board:
 *
 *   PageHeader (Export CSV) → FilterBar (search, Area, period, count) → the
 *   log grouped by day (Time, Who, What happened, Area, From) → Load older.
 *
 * "From" says whether the database recorded the entry itself or it was
 * carried over from the old screens unverified.
 */
const AREA = {
  [ACTIVITY_KIND.SIGN_IN]: "Sign-ins",
  [ACTIVITY_KIND.STOCK]: "Stock",
  [ACTIVITY_KIND.PRICE]: "Prices",
  [ACTIVITY_KIND.ACCOUNT]: "Accounts",
  [ACTIVITY_KIND.ORDER]: "Orders",
  [ACTIVITY_KIND.DELIVERY]: "Deliveries",
  [ACTIVITY_KIND.PRODUCT]: "Products",
  [ACTIVITY_KIND.CUSTOMER]: "Customers",
  [ACTIVITY_KIND.SUPPLIER]: "Suppliers",
};

const PERIODS = [
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "all", label: "Everything loaded" },
];

const UNVERIFIED = " (historical entry; unverified)";

export default function ActivityLogPage({ entries = [], isLoaded = true, onShowOlder }) {
  const [query, setQuery] = useUrlState("query", "", "activity");
  const [area, setArea] = useUrlState("tab", "all", "activity");
  const [period, setPeriod] = useState("all");
  const [now] = useState(() => Date.now());

  const filtered = useMemo(() => {
    const since = period === "all" ? null : now - Number(period) * 86_400_000;
    return entries.filter((entry) => {
      if (area !== "all" && entry.kind !== area) return false;
      if (since !== null && (!entry.at || new Date(entry.at).getTime() < since)) return false;
      return matches(query, entry.who, entry.what, entry.subject);
    });
  }, [entries, area, period, query, now]);
  const days = useMemo(() => groupByDay(filtered), [filtered]);
  const areas = [{ value: "all", label: "All" }, ...Object.entries(AREA).map(([value, label]) => ({ value, label }))];

  const exportLog = () =>
    downloadCsv(
      "lsb-activity-log.csv",
      [
        { label: "When", value: (e) => e.at },
        { label: "Who", value: (e) => e.who },
        { label: "What happened", value: (e) => e.what.replace(UNVERIFIED, "") },
        { label: "Area", value: (e) => AREA[e.kind] ?? "" },
        { label: "From", value: (e) => (e.what.endsWith(UNVERIFIED) ? "Unverified" : "Recorded") },
      ],
      filtered
    );

  return (
    <Page>
      <PageHeader
        icon={ClockCounterClockwise}
        title="Activity log"
        description="Every change anyone made, newest first. Entries cannot be edited or deleted."
        actions={
          <Button variant="outline" onClick={exportLog}>
            <DownloadSimple aria-hidden="true" />
            Export CSV
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <SearchField label="Search the log" value={query} onChange={setQuery} placeholder="Search a name, order or code" />
        <FilterSelect label="Area" value={area} onChange={setArea} options={areas} />
        <FilterSelect label="Period" value={period} onChange={setPeriod} options={PERIODS} />
        <span className="flex-[1_1_0] whitespace-nowrap text-13 text-muted-fg">{filtered.length} of {entries.length} entries</span>
      </div>

      <section aria-label="Activity" className="rounded-lg border border-border bg-card shadow-xs">
        {!isLoaded ? (
          <LoadingState noun="activity" bare />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={ClockCounterClockwise}
            title={entries.length ? "Nothing in the log matches" : "Nothing recorded yet"}
            description={entries.length ? "Try another name, or show every area." : "Changes anybody makes show up here as they happen."}
            action={entries.length ? <Button variant="outline" onClick={() => { setQuery(""); setArea("all"); setPeriod("all"); }}>Clear filters</Button> : null}
          />
        ) : (
          <Table minWidth={820} aria-label="Activity log">
            <TableHeader>
              <TableRow>
                <TableHead className="w-24">Time</TableHead>
                <TableHead className="w-[180px]">Who</TableHead>
                <TableHead>What happened</TableHead>
                <TableHead className="w-[110px]">Area</TableHead>
                <TableHead className="w-[110px]">From</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {days.map((day) => (
                <Fragment key={day.label}>
                  <TableRow className="h-8 bg-surface-2">
                    <TableHead scope="rowgroup" colSpan={5} className="h-8 text-xs font-semibold text-fg-2">{day.label}</TableHead>
                  </TableRow>
                  {day.entries.map((entry) => {
                    const unverified = entry.what.endsWith(UNVERIFIED);
                    return (
                      <TableRow key={entry.id}>
                        <TableCell className="text-muted-fg">{timeLabel(entry.at)}</TableCell>
                        <TableCell>
                          <span className="inline-flex min-w-0 items-center gap-2">
                            <Avatar name={entry.who} />
                            <span className="truncate">{entry.who}</span>
                          </span>
                        </TableCell>
                        <TableCell className="max-w-[440px] truncate" title={entry.what}>{unverified ? entry.what.slice(0, -UNVERIFIED.length) : entry.what}</TableCell>
                        <TableCell><Badge variant="outline">{AREA[entry.kind] ?? "Other"}</Badge></TableCell>
                        <TableCell className={unverified ? "text-warning-fg" : "text-muted-fg"}>{unverified ? "Unverified" : "Recorded"}</TableCell>
                      </TableRow>
                    );
                  })}
                </Fragment>
              ))}
            </TableBody>
          </Table>
        )}
        {onShowOlder ? (
          <div className="flex items-center justify-end border-t border-border px-3 py-2">
            <Button variant="outline" size="sm" onClick={onShowOlder}>Load older</Button>
          </div>
        ) : null}
      </section>
    </Page>
  );
}
