import { useEffect, useId, useState } from "react";

import { ArrowRight, CaretRight } from "../icons";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ToggleGroup } from "@/components/ui/toggle-group";
import { Avatar, Mono } from "./Chip";
import StatusPill, { InlineBadge } from "./StatusPill";
import { EmptyState, SectionCard, TextLink } from "./page";
import { timeLabel } from "../../utils/activityLog";
import { cn } from "@/lib/utils";

/**
 * The parts the "2 · Dashboard" board is built from: the chart card, Stock to
 * watch, Recent activity, and the count-up the stat figures do once.
 */

/** A number that counts up once when it first shows: 600ms, ease-out, tabular figures. */
function useCountUp(target, duration = 600) {
  const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const [k, setK] = useState(reduce ? 1 : 0);
  // Runs on mount only: the figure counts up once per visit, not on every refresh of the data.
  useEffect(() => {
    if (reduce) return undefined;
    let frame = 0;
    const start = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - start) / duration);
      setK(1 - Math.pow(1 - t, 3));
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [duration, reduce]);
  return target * k;
}

/** Renders a figure that counts up; `format` turns the running number into text. */
export function CountUp({ value, format = (n) => String(Math.round(n)) }) {
  const shown = useCountUp(Number(value) || 0);
  return <>{format(shown)}</>;
}

/**
 * "Orders per week": this period's weekly line in --primary-text against the
 * period before in dashed --muted-2, with the Orders / Revenue switch.
 * `weeks` is [{ label, current, previous }] for both measures.
 */
export function WeeklyChart({ title, description, series, measure, onMeasure, formatValue }) {
  const gradientId = useId();
  const points = series[measure];
  const max = Math.max(1, ...points.flatMap((p) => [p.current, p.previous]));
  const top = niceCeil(max);
  const ticks = [top, (top * 2) / 3, top / 3, 0];
  const W = 720;
  const H = 216;
  const x = (i) => (points.length <= 1 ? W / 2 : (i * W) / (points.length - 1));
  const y = (v) => H - (v / top) * H;
  const line = (key) => points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)} ${y(p[key]).toFixed(1)}`).join(" ");
  const total = (key) => points.reduce((sum, p) => sum + p[key], 0);

  return (
    <section className="min-w-0 flex-[2_1_520px] rounded-lg border border-border bg-card shadow-xs">
      <div className="flex flex-wrap items-start justify-between gap-3 px-4 pt-4">
        <div>
          <h2 className="m-0 text-sm font-semibold">{title}</h2>
          <p className="m-0 text-13 text-muted-fg">{description}</p>
        </div>
        <ToggleGroup
          label="Chart measure"
          value={measure}
          onValueChange={onMeasure}
          options={[{ value: "orders", label: "Orders" }, { value: "revenue", label: "Revenue" }]}
        />
      </div>
      <div className="flex flex-wrap gap-4 px-4 pt-3 text-xs text-muted-fg">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-sm bg-primary" />
          This period · {formatValue(total("current"))}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-sm bg-muted-2" />
          Previous period · {formatValue(total("previous"))}
        </span>
      </div>
      <div className="flex gap-2 px-4 pb-4 pt-3">
        <div aria-hidden="true" className="-mt-2 flex h-[216px] w-8 shrink-0 flex-col justify-between text-right text-2xs text-muted-fg">
          {ticks.map((tick) => <span key={tick}>{shortNumber(tick)}</span>)}
        </div>
        <div className="min-w-0 flex-1">
          <svg
            role="img"
            aria-label={`${title}: ${points.map((p) => `${p.label} ${formatValue(p.current)}`).join(", ")}`}
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="none"
            className="block h-[216px] w-full overflow-visible"
          >
            <defs>
              <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.14" />
                <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
              </linearGradient>
            </defs>
            {[0, 1, 2, 3].map((i) => (
              <path key={i} d={`M0 ${(i * H) / 3 + (i === 0 ? 0.5 : 0)}H${W}`} stroke="var(--border-subtle)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
            ))}
            <path d={line("previous")} fill="none" stroke="var(--muted-2)" strokeWidth="1.5" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
            <path d={`${line("current")} L${W} ${H} L0 ${H} Z`} fill={`url(#${gradientId})`} />
            <path d={line("current")} fill="none" stroke="var(--primary-text)" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
          </svg>
          <div aria-hidden="true" className="mt-2 flex justify-between text-2xs text-muted-fg">
            {points.map((p) => (
              <span key={p.label} className="flex w-0 justify-center whitespace-nowrap">{p.label}</span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

const niceCeil = (n) => {
  if (n <= 3) return 3;
  const step = Math.pow(10, Math.floor(Math.log10(n)));
  const scaled = Math.ceil((n / step) * 1.5) / 1.5;
  return Math.ceil((scaled * step) / 3) * 3;
};

const shortNumber = (n) => {
  if (n >= 1_000_000) return `${Math.round(n / 100_000) / 10}m`;
  if (n >= 1000) return `${Math.round(n / 100) / 10}k`;
  return String(Math.round(n));
};

/**
 * "Stock to watch": products at or below their reorder level, each with its
 * code, what is left and a status badge, and a link to the inventory.
 */
export function StockWatch({ rows, total, onOpen, onOpenInventory, className }) {
  return (
    <SectionCard
      className={cn("flex-[1_1_280px]", className)}
      title="Stock to watch"
      description="At or below the reorder level"
      action={<InlineBadge label={`${rows.length} of ${total}`} />}
      footer={
        <TextLink onClick={onOpenInventory}>
          Open inventory
          <ArrowRight className="size-4" aria-hidden="true" />
        </TextLink>
      }
    >
      {rows.length === 0 ? (
        <EmptyState title="Nothing to watch" description="Every product is above its reorder level." className="py-8" />
      ) : (
        <ul className="m-0 list-none p-0">
          {rows.map((row) => (
            <li key={row.key} className="flex items-center gap-3 border-t border-row-divider px-4 py-[9px]">
              <button type="button" onClick={() => onOpen?.(row)} className="min-w-0 flex-1 border-0 bg-transparent p-0 text-left text-inherit">
                <div className="truncate text-13 font-medium">{row.name}</div>
                <Mono className="block truncate">{row.code}</Mono>
              </button>
              <span className="whitespace-nowrap text-13 text-fg-2">{row.left}</span>
              <StatusPill label={row.status} tone={row.tone} />
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

const UNVERIFIED = " (historical entry; unverified)";

/**
 * "Recent activity": Time, Staff, Action, Record and Status in a 36px-row
 * table. The status says whether the entry was recorded by the server or
 * carried over from the old screens unverified.
 */
export function RecentActivity({ entries, description, onViewAll }) {
  return (
    <SectionCard
      title="Recent activity"
      description={description}
      action={
        onViewAll ? (
          <Button variant="ghost" className="px-2.5" onClick={onViewAll}>
            View all
            <CaretRight aria-hidden="true" />
          </Button>
        ) : null
      }
    >
      {entries.length === 0 ? (
        <div className="border-t border-border">
          <EmptyState title="Nothing recorded yet" description="Changes anybody makes show up here as they happen." className="py-8" />
        </div>
      ) : (
        <div className="border-t border-border">
          <Table minWidth={760}>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24">Time</TableHead>
                <TableHead>Staff</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Record</TableHead>
                <TableHead className="w-[120px]">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry) => {
                const unverified = entry.what.endsWith(UNVERIFIED);
                const action = unverified ? entry.what.slice(0, -UNVERIFIED.length) : entry.what;
                return (
                  <TableRow key={entry.id}>
                    <TableCell className="text-muted-fg">{timeLabel(entry.at)}</TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-2">
                        <Avatar name={entry.who} />
                        {entry.who}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-[420px] truncate">{action}</TableCell>
                    <TableCell className="text-fg-2">{entry.subject || "—"}</TableCell>
                    <TableCell>
                      <StatusPill label={unverified ? "Unverified" : "Recorded"} tone={unverified ? "warning" : "success"} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </SectionCard>
  );
}

/**
 * The app's "Needs your attention" (or a salesperson's follow-ups): each
 * item one row with its explanation and the outline button that deals with
 * it. Not on the board; built from the same card and row parts.
 */
export function AttentionList({ title, items }) {
  if (items.length === 0) return null;
  return (
    <SectionCard title={title} description="Each one opens the screen where it can be dealt with">
      <ul className="m-0 list-none p-0">
        {items.map((item) => (
          <li key={item.key ?? item.title} className="flex flex-wrap items-center gap-3 border-t border-row-divider px-4 py-2.5">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-13 font-medium">
                <StatusPill label={item.tone === "red" ? "Urgent" : item.tone === "amber" ? "Soon" : "Note"} tone={item.tone} />
                <span className="min-w-0">{item.title}</span>
              </div>
              {item.body ? <p className="m-0 mt-0.5 text-13 text-muted-fg">{item.body}</p> : null}
            </div>
            <Button variant="outline" size="sm" onClick={item.onAction}>
              {item.actionLabel}
            </Button>
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}
