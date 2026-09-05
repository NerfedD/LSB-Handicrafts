import { useEffect, useMemo, useState } from "react";

import { ArrowLeft, Download, History } from "../icons";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import IconChip from "../shared/Chip";
import { FilterBar } from "../shared/ListScreen";
import { FilterChips, SearchField } from "../shared/filters";
import { EmptyState, LoadingState } from "../shared/PageStates";
import { activityIcon } from "../shared/activityIcons";
import { ACTIVITY_CHIPS, groupByDay, timeLabel } from "../../utils/activityLog";
import { matches } from "../../utils/search";

/**
 * What happened recently — screen 2r, right half.
 *
 * ENTRIES ARE SENTENCES. "Maria Santos changed the price of Styro Ball 4 inch
 * to ₱120.00" — the person's name in bold, then what they did, then the time on
 * the right. The old screen put the event TYPE in a pill ("Price Edit") and
 * left the reader to translate a category back into an event.
 *
 * GROUPED BY DAY. A long log is only skimmable if the eye can find the day
 * first and the time within it; a full date on every one of two hundred rows is
 * two hundred dates to read past.
 *
 * THIS IS REAL DATA NOW. Until this overhaul the screen rendered a hardcoded
 * array of twelve invented entries that were identical on every install — see
 * utils/activityLog.js for what replaced it and what gets recorded.
 */
export default function ActivityLogPage({
  entries = [],
  isLoaded = true,
  onBack,
  onExport,
  onContext,
}) {
  const [query, setQuery] = useState("");
  const [chip, setChip] = useState("all");

  useEffect(() => {
    if (!isLoaded) return;
    onContext?.(`${entries.length} ${entries.length === 1 ? "entry" : "entries"} recorded`);
  }, [entries.length, isLoaded, onContext]);

  const filtered = useMemo(() => {
    const kinds = ACTIVITY_CHIPS.find((c) => c.value === chip)?.kinds;
    return entries.filter((entry) => {
      if (kinds && !kinds.includes(entry.kind)) return false;
      return matches(query, entry.who, entry.what);
    });
  }, [entries, chip, query]);

  const chips = useMemo(
    () =>
      ACTIVITY_CHIPS.map((definition) => ({
        value: definition.value,
        label: definition.label,
        count: definition.kinds
          ? entries.filter((entry) => definition.kinds.includes(entry.kind)).length
          : entries.length,
      })),
    [entries]
  );

  const days = useMemo(() => groupByDay(filtered), [filtered]);

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" size="sm" className="px-2" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
          Staff &amp; accounts
        </Button>
        {onExport && (
          <Button variant="outline" size="sm" onClick={onExport}>
            <Download className="h-4.5 w-4.5" />
            Save a copy
          </Button>
        )}
      </div>

      <FilterBar>
        <SearchField
          value={query}
          onChange={setQuery}
          placeholder="Search by person or what they did"
          id="activity-search"
        />
      </FilterBar>

      <FilterChips chips={chips} value={chip} onChange={setChip} label="Show which entries" />

      {!isLoaded ? (
        <LoadingState noun="entries" />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<History />}
          title="Nothing recorded yet"
          description="As people sign in, change stock and edit prices, what they did will be listed here."
          query={query.trim()}
          onClearSearch={() => setQuery("")}
        />
      ) : (
        <div className="flex flex-col gap-3.5">
          {days.map((day) => (
            <Card key={day.label}>
              {/* The date group label. 13px uppercase and tracked — the same
                  exception to the 16px floor as a table header, for the same
                  reason: it is a signpost, read once. */}
              <p className="border-b border-hair bg-paper-2 px-5.5 py-3 text-[13px] font-extrabold uppercase tracking-[0.07em] text-muted">
                {day.label}
              </p>
              <ul>
                {day.entries.map((entry) => (
                  <li
                    key={entry.id}
                    className="flex min-h-16 items-center gap-3.5 border-b border-hair px-5.5 py-3 last:border-b-0"
                  >
                    <IconChip icon={activityIcon(entry.icon)} tone={entry.tone} size="sm" />
                    <p className="min-w-0 flex-1 text-[15.5px] leading-[1.45] text-ink">
                      <strong className="font-extrabold">{entry.who}</strong> {entry.what}
                    </p>
                    <span className="shrink-0 text-[14.5px] tabular-nums text-muted">
                      {timeLabel(entry.at)}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
