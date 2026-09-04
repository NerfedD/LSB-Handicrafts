import { useEffect, useMemo, useState } from "react";

import { ArrowLeft, Mail, Phone } from "../icons";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar } from "../shared/Chip";
import { FilterBar } from "../shared/ListScreen";
import { SearchField } from "../shared/filters";
import { EmptyState, LoadingState } from "../shared/PageStates";
import { matches } from "../../utils/search";
import { roleLabel } from "../../utils/copy";

/**
 * Who to call for what — screen 2r, left half.
 *
 * READ-ONLY, AND FRAMED AS A QUESTION. The old title was "Staff Directory",
 * which describes the data; this one describes the reason anybody opens it.
 * Nobody comes here to browse a roster — they come because something has gone
 * wrong with an order and they need the person who handles orders.
 *
 * NO BUTTONS ON THE CARDS except the phone number, which is a real `tel:` link
 * rather than text to copy. Managing an account happens on the accounts screen;
 * mixing the two would put "Manage" next to a colleague's phone number and make
 * an ordinary lookup feel like an administrative act.
 */
export default function StaffDirectoryPage({
  staff = [],
  isLoaded = true,
  onBack,
  onContext,
}) {
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!isLoaded) return;
    onContext?.(`${staff.length} ${staff.length === 1 ? "person" : "people"} on the team`);
  }, [staff.length, isLoaded, onContext]);

  const filtered = useMemo(
    () =>
      staff
        .filter((person) => matches(query, person.name, person.role, person.contactNumber))
        .sort((a, b) => String(a.name).localeCompare(String(b.name))),
    [staff, query]
  );

  return (
    <div className="flex flex-col gap-3.5">
      <Button variant="ghost" size="sm" className="self-start px-2" onClick={onBack}>
        <ArrowLeft className="h-5 w-5" />
        Staff &amp; accounts
      </Button>

      <FilterBar>
        <SearchField
          value={query}
          onChange={setQuery}
          placeholder="Search by name or what they do"
          id="directory-search"
        />
      </FilterBar>

      {!isLoaded ? (
        <LoadingState noun="people" />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="Nobody on the team yet"
          description="Once staff accounts exist, this is where anyone can find out who to call for what."
          query={query.trim()}
          onClearSearch={() => setQuery("")}
        />
      ) : (
        <ul className="grid gap-3.5 sm:grid-cols-2">
          {filtered.map((person) => {
            const dialable = String(person.contactNumber || "").replace(/[^\d+]/g);
            return (
              <li key={person.id}>
                <Card className="flex h-full items-center gap-4 p-4.5">
                  <Avatar name={person.name} size="lg" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[17px] font-extrabold text-ink">{person.name}</p>
                    <p className="truncate pt-0.5 text-[15px] text-muted">
                      {roleLabel(person.role)}
                    </p>
                    <p className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1.5">
                      {dialable ? (
                        <a
                          href={`tel:${dialable}`}
                          className="inline-flex items-center gap-2 text-[15.5px] font-bold text-cobalt dark:text-dk-cobalt underline-offset-[3px] hover:underline"
                        >
                          <Phone className="h-4.5 w-4.5 shrink-0" aria-hidden="true" />
                          {person.contactNumber}
                        </a>
                      ) : (
                        <span className="inline-flex items-center gap-2 text-[15px] text-muted-2">
                          <Phone className="h-4.5 w-4.5 shrink-0" aria-hidden="true" />
                          No number on file
                        </span>
                      )}
                      {person.email && (
                        <a
                          href={`mailto:${person.email}`}
                          className="inline-flex min-w-0 items-center gap-2 text-[15px] text-muted underline-offset-[3px] hover:text-ink hover:underline"
                        >
                          <Mail className="h-4.5 w-4.5 shrink-0" aria-hidden="true" />
                          <span className="truncate">{person.email}</span>
                        </a>
                      )}
                    </p>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
