import { useMemo, useRef, useState } from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";

import { MagnifyingGlass } from "@/components/icons";
import { Kbd } from "@/components/ui/kbd";
import { cn } from "@/lib/utils";

/**
 * The ⌘K / Ctrl+K command menu, drawn to the "Search · Command ⌘K" board: a
 * 560px panel 96px from the top, a 44px search row with an Esc key, the
 * results under "Pages" and "Actions", and a footer of key hints.
 *
 * `groups` is [{ label, items: [{ key, label, icon, shortcut, run }] }].
 * Arrow keys move the highlight, Enter runs it, Esc closes.
 */
export default function CommandMenu({ open, onOpenChange, groups }) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const listRef = useRef(null);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return groups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => !needle || item.label.toLowerCase().includes(needle)),
      }))
      .filter((group) => group.items.length > 0);
  }, [groups, query]);

  const flat = visible.flatMap((group) => group.items);
  const current = Math.min(active, Math.max(0, flat.length - 1));

  const close = (next) => {
    onOpenChange(next);
    if (!next) {
      setQuery("");
      setActive(0);
    }
  };

  const run = (item) => {
    close(false);
    item.run();
  };

  const onKeyDown = (event) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      const next = (current + step + flat.length) % Math.max(1, flat.length);
      setActive(next);
      listRef.current?.querySelector(`[data-index="${next}"]`)?.scrollIntoView({ block: "nearest" });
    } else if (event.key === "Enter" && flat[current]) {
      event.preventDefault();
      run(flat[current]);
    }
  };

  const starts = visible.map((_, groupIndex) =>
    visible.slice(0, groupIndex).reduce((sum, group) => sum + group.items.length, 0)
  );
  return (
    <DialogPrimitive.Root open={open} onOpenChange={close}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="lsb-fade fixed inset-0 z-50 bg-overlay" />
        <DialogPrimitive.Viewport className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-24">
          <DialogPrimitive.Popup
            aria-label="Search pages and actions"
            className="lsb-pop flex max-h-[400px] w-[560px] max-w-full flex-col overflow-hidden rounded-lg border border-border bg-card text-sm text-foreground shadow-dialog outline-none"
          >
            <DialogPrimitive.Title className="sr-only">Search pages and actions</DialogPrimitive.Title>
            <div className="flex h-11 shrink-0 items-center gap-2 border-b border-border px-3">
              <MagnifyingGlass className="size-4 text-muted-fg" aria-hidden="true" />
              <label htmlFor="cmd-input" className="sr-only">Search</label>
              <input
                id="cmd-input"
                type="text"
                autoComplete="off"
                role="combobox"
                aria-expanded="true"
                aria-controls="cmd-results"
                aria-activedescendant={flat[current] ? `cmd-${flat[current].key}` : undefined}
                placeholder="Type a command or search…"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setActive(0);
                }}
                onKeyDown={onKeyDown}
                className="h-full min-w-0 flex-1 border-0 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-2"
              />
              <DialogPrimitive.Close className="h-5 rounded border border-border bg-muted px-1.5 text-2xs font-medium text-muted-fg">
                Esc
              </DialogPrimitive.Close>
            </div>
            <div ref={listRef} id="cmd-results" role="listbox" aria-label="Results" className="min-h-0 flex-1 overflow-y-auto p-1">
              {visible.length === 0 ? (
                <p className="m-0 px-2 py-6 text-center text-13 text-muted-fg">No pages or actions match “{query}”.</p>
              ) : null}
              {visible.map((group, groupIndex) => (
                <div key={group.label} role="group" aria-label={group.label}>
                  {groupIndex > 0 ? <div role="separator" className="-mx-1 my-1 h-px bg-muted-strong" /> : null}
                  <div className="px-2 pb-1 pt-1.5 text-xs font-medium text-muted-fg">{group.label}</div>
                  {group.items.map((item, itemIndex) => {
                    const mine = starts[groupIndex] + itemIndex;
                    const Icon = item.icon;
                    return (
                      <div
                        key={item.key}
                        id={`cmd-${item.key}`}
                        role="option"
                        aria-selected={mine === current}
                        data-index={mine}
                        onMouseMove={() => setActive(mine)}
                        onClick={() => run(item)}
                        className={cn(
                          "flex h-8 cursor-default items-center gap-2 rounded px-2 text-foreground",
                          mine === current && "bg-muted"
                        )}
                      >
                        {Icon ? <Icon className="size-4 shrink-0 text-muted-fg" aria-hidden="true" /> : null}
                        <span className="flex-1 truncate">{item.label}</span>
                        {item.shortcut ? <span className="text-xs tracking-[0.05em] text-muted-fg">{item.shortcut}</span> : null}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
            <div className="flex h-9 shrink-0 items-center gap-4 border-t border-border px-3 text-xs text-muted-fg">
              <span className="inline-flex items-center gap-1.5"><Kbd className="h-[18px] px-1">↑↓</Kbd>Move</span>
              <span className="inline-flex items-center gap-1.5"><Kbd className="h-[18px] px-1">↵</Kbd>Open</span>
              <span className="inline-flex items-center gap-1.5"><Kbd className="h-[18px] px-1">Esc</Kbd>Close</span>
            </div>
          </DialogPrimitive.Popup>
        </DialogPrimitive.Viewport>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
