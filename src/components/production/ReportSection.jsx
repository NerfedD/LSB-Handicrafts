import { useMemo, useState } from "react";

import { CalendarBlank, CaretDown, ChartLine, DownloadSimple } from "../icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Mono } from "../shared/Chip";
import { EmptySlot } from "../shared/PageStates";
import { Page, PageHeader, SectionCard, StatCard, StatCards } from "../shared/page";
import { downloadCsv } from "@/lib/csv";
import { formatPeso, formatShortDate } from "../../utils/profileFormat";

/**
 * Production · Report, drawn to the "7d · Production · Report" board:
 *
 *   PageHeader ("Managers only", the month, Download) → four compact
 *   StatCards → "Pieces made per week" beside "Why pieces were damaged" →
 *   the by-product table.
 *
 * Everything is worked out from finished batches, their damage records and
 * the received lots they used (material cost is what those lots were bought
 * for). Download saves the by-product table as a CSV; the app has no PDF.
 * The damage log with lot numbers, kept from before, closes the page.
 */
const HIGH_RATE = 3;
const pct = (part, whole) => (whole > 0 ? (part / whole) * 100 : null);
const rateLabel = (rate) => (rate === null ? "—" : `${rate.toFixed(1)}%`);

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export default function ReportSection({ ws }) {
  const { batches, defects, usage, lots, materialOrders, prod, worker, now } = ws;
  const months = useMemo(() => {
    const keys = new Set([monthKey(new Date(now))]);
    for (const b of batches) if (b.completed_at) keys.add(monthKey(new Date(b.completed_at)));
    return [...keys].sort().reverse();
  }, [batches, now]);
  const [month, setMonth] = useState(months[0]);
  const monthLabel = (key) => {
    const [y, m] = key.split("-").map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
  };
  const previousKey = (() => {
    const [y, m] = month.split("-").map(Number);
    return monthKey(new Date(y, m - 2, 1));
  })();

  const finishedIn = (key) => batches.filter((b) => b.status === "Completed" && b.completed_at && monthKey(new Date(b.completed_at)) === key);
  const finished = finishedIn(month);
  const before = finishedIn(previousKey);
  const cancelled = batches.filter((b) => b.status === "Cancelled" && monthKey(new Date(b.completed_at || b.created_at)) === month).length;
  const good = finished.reduce((s, b) => s + (b.good_output_qty || 0), 0);
  const goodBefore = before.reduce((s, b) => s + (b.good_output_qty || 0), 0);
  const damaged = finished.reduce((s, b) => s + (b.damaged_qty || 0), 0);
  const damageRate = pct(damaged, good + damaged);
  const ids = new Set(finished.map((b) => b.id));
  const lotCost = (lotId) => {
    const lot = lots.find((l) => l.id === lotId);
    const order = lot?.order_id ? materialOrders.find((o) => o.id === lot.order_id) : null;
    return order ? Number(order.unit_price) || 0 : null;
  };
  const used = usage.filter((u) => ids.has(u.batch_id));
  const costKnown = used.length > 0 && used.every((u) => lotCost(u.lot_id) !== null);
  const materialCost = used.reduce((s, u) => s + u.quantity * (lotCost(u.lot_id) ?? 0), 0);
  const change = goodBefore ? Math.round(((good - goodBefore) / goodBefore) * 1000) / 10 : null;

  const weeks = useMemo(() => {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - start.getDay());
    return Array.from({ length: 6 }, (_, i) => {
      const from = start.getTime() - (5 - i) * 7 * 86_400_000;
      const to = from + 7 * 86_400_000;
      const rows = batches.filter((b) => b.status === "Completed" && b.completed_at && new Date(b.completed_at).getTime() >= from && new Date(b.completed_at).getTime() < to);
      const g = rows.reduce((s, b) => s + (b.good_output_qty || 0), 0);
      const d = rows.reduce((s, b) => s + (b.damaged_qty || 0), 0);
      return { label: new Date(from).toLocaleDateString("en-US", { month: "short", day: "numeric" }), good: g, bad: d, rate: pct(d, g + d) };
    });
  }, [batches, now]);
  const tallest = Math.max(1, ...weeks.map((w) => w.good + w.bad));

  const monthDefects = defects.filter((d) => ids.has(d.batch_id));
  const reasons = Object.entries(
    monthDefects.reduce((acc, d) => ({ ...acc, [d.reason]: (acc[d.reason] ?? 0) + d.damaged_quantity }), {})
  ).sort((a, b) => b[1] - a[1]);
  const topReason = Math.max(1, ...reasons.map(([, n]) => n));

  const byProduct = Object.values(
    finished.reduce((acc, b) => {
      const row = (acc[b.target_product_id] ??= { id: b.target_product_id, name: prod(b.target_product_id)?.name ?? "Product", batches: 0, good: 0, bad: 0, reasons: {} });
      row.batches += 1;
      row.good += b.good_output_qty || 0;
      row.bad += b.damaged_qty || 0;
      for (const d of monthDefects.filter((x) => x.batch_id === b.id)) row.reasons[d.reason] = (row.reasons[d.reason] ?? 0) + d.damaged_quantity;
      return acc;
    }, {})
  ).map((row) => ({ ...row, made: row.good + row.bad, rate: pct(row.bad, row.good + row.bad), reason: Object.entries(row.reasons).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—" }));

  const download = () =>
    downloadCsv(
      `lsb-production-${month}.csv`,
      [
        { label: "Product", value: (r) => r.name },
        { label: "Batches", value: (r) => r.batches },
        { label: "Made", value: (r) => r.made },
        { label: "Good", value: (r) => r.good },
        { label: "Damaged", value: (r) => r.bad },
        { label: "Damage rate", value: (r) => rateLabel(r.rate) },
        { label: "Main reason", value: (r) => r.reason },
      ],
      byProduct
    );

  return (
    <Page>
      <PageHeader
        icon={ChartLine}
        title="Production report"
        titleBadge={<Badge variant="outline">Managers only</Badge>}
        description="What the workshop made, what was damaged, and why."
        actions={
          <>
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="outline" />}>
                <CalendarBlank aria-hidden="true" />
                {monthLabel(month)}
                <CaretDown aria-hidden="true" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuRadioGroup value={month} onValueChange={setMonth}>
                  {months.map((key) => <DropdownMenuRadioItem key={key} value={key}>{monthLabel(key)}</DropdownMenuRadioItem>)}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="outline" onClick={download}>
              <DownloadSimple aria-hidden="true" />
              Download CSV
            </Button>
          </>
        }
      />

      <StatCards label={`${monthLabel(month)} totals`} min={180}>
        <StatCard compact label="Good pieces" value={good.toLocaleString("en-US")} caption={change === null ? "nothing to compare" : <Badge variant={change >= 0 ? "success" : "warning"}>{change > 0 ? "+" : ""}{change}%</Badge>} />
        <StatCard compact label="Damaged" value={damaged.toLocaleString("en-US")} caption={damageRate === null ? "nothing finished" : `${rateLabel(damageRate)} of everything made`} />
        <StatCard compact label="Batches finished" value={finished.length} caption={`${cancelled} cancelled`} />
        <StatCard compact label="Material used" value={costKnown ? formatPeso(materialCost) : used.reduce((s, u) => s + u.quantity, 0).toLocaleString("en-US")} caption={costKnown ? "at cost" : "units, cost not known for every lot"} />
      </StatCards>

      <div className="flex flex-wrap gap-4">
        <section aria-labelledby="pr-weekly" className="min-w-0 flex-[2_1_520px] rounded-lg border border-border bg-card shadow-xs">
          <div className="flex flex-wrap items-start justify-between gap-3 px-4 pt-4">
            <div>
              <h2 id="pr-weekly" className="m-0 text-sm font-semibold">Pieces made per week</h2>
              <p className="m-0 text-13 text-muted-fg">Last 6 weeks, with the share that was damaged</p>
            </div>
            <div aria-hidden="true" className="flex gap-3 text-xs text-muted-fg">
              <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-sm bg-primary" />Good</span>
              <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-sm bg-muted-2" />Damaged</span>
            </div>
          </div>
          <div
            role="img"
            aria-label={weeks.map((w) => `${w.label}: ${w.good} good, ${w.bad} damaged`).join("; ")}
            className="mx-4 mt-2 grid h-[200px] grid-cols-6 items-end gap-4 border-b border-border px-6 pt-4"
          >
            {weeks.map((w) => (
              <div key={w.label} className="flex h-full flex-col items-center justify-end gap-1">
                <span className="text-2xs font-medium text-fg-2">{w.good ? w.good.toLocaleString("en-US") : ""}</span>
                <span className="flex w-full max-w-11 flex-col">
                  <span className="rounded-t-[3px] bg-muted-2" style={{ height: `${(w.bad / tallest) * 150}px` }} />
                  <span className={w.bad ? "bg-primary" : "rounded-t-[3px] bg-primary"} style={{ height: `${(w.good / tallest) * 150}px` }} />
                </span>
              </div>
            ))}
          </div>
          <div aria-hidden="true" className="grid grid-cols-6 gap-4 px-10 pb-4 pt-1.5 text-center text-2xs text-muted-fg">
            {weeks.map((w) => (
              <span key={w.label}><span className="block text-fg-2">{w.label}</span>{rateLabel(w.rate)} damaged</span>
            ))}
          </div>
        </section>

        <section aria-labelledby="pr-why" className="min-w-0 flex-[1_1_300px] rounded-lg border border-border bg-card shadow-xs">
          <div className="px-4 pb-3 pt-4">
            <h2 id="pr-why" className="m-0 text-sm font-semibold">Why pieces were damaged</h2>
            <p className="m-0 text-13 text-muted-fg">{damaged} pieces in {monthLabel(month).split(" ")[0]}</p>
          </div>
          {reasons.length === 0 ? (
            <EmptySlot>No damage recorded this month.</EmptySlot>
          ) : (
            <ul className="m-0 flex list-none flex-col gap-3 px-4 pb-4">
              {reasons.map(([label, n]) => (
                <li key={label}>
                  <div className="flex justify-between gap-2 text-13"><span>{label}</span><span className="font-medium">{n}</span></div>
                  <div aria-hidden="true" className="mt-1 h-1.5 overflow-hidden rounded-[3px] bg-muted">
                    <div className="h-full bg-muted-fg" style={{ width: `${(n / topReason) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <SectionCard title="By product" aria-labelledby="pr-prod">
        <div className="border-t border-border">
          {byProduct.length === 0 ? (
            <EmptySlot>No batch was finished in {monthLabel(month)}.</EmptySlot>
          ) : (
            <Table minWidth={820} aria-label="Production by product">
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Batches</TableHead>
                  <TableHead className="text-right">Made</TableHead>
                  <TableHead className="text-right">Good</TableHead>
                  <TableHead className="text-right">Damaged</TableHead>
                  <TableHead>Damage rate</TableHead>
                  <TableHead>Main reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {byProduct.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell className="text-right">{row.batches}</TableCell>
                    <TableCell className="text-right">{row.made}</TableCell>
                    <TableCell className="text-right">{row.good}</TableCell>
                    <TableCell className="text-right">{row.bad}</TableCell>
                    <TableCell>
                      {row.rate !== null && row.rate >= HIGH_RATE ? <Badge variant="warning">{rateLabel(row.rate)}</Badge> : <span className="text-fg-2">{rateLabel(row.rate)}</span>}
                    </TableCell>
                    <TableCell className="text-fg-2">{row.reason}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <p className="m-0 border-t border-border px-4 py-2.5 text-xs text-muted-fg">Rates of {HIGH_RATE}% or more are marked. The workshop&rsquo;s usual rate is about 2%.</p>
        </div>
      </SectionCard>

      <SectionCard title="Damage log" description="Every damage record from quality checks, newest first, with the material lots each batch used.">
        <div className="border-t border-border">
          {defects.length === 0 ? (
            <EmptySlot>No production damage has been recorded. Damaged pieces are counted when a batch goes through its quality check.</EmptySlot>
          ) : (
            <Table minWidth={820}>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Damaged</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Batch</TableHead>
                  <TableHead>Logged</TableHead>
                  <TableHead>Material lots</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {defects.slice().reverse().map((d) => {
                  const b = batches.find((row) => row.id === d.batch_id);
                  const lotsUsed = usage.filter((u) => u.batch_id === d.batch_id);
                  return (
                    <TableRow key={d.id}>
                      <TableCell className="font-medium">{prod(d.product_id)?.name}</TableCell>
                      <TableCell className="text-right">{d.damaged_quantity}</TableCell>
                      <TableCell className="text-fg-2">{d.reason}</TableCell>
                      <TableCell><Mono className="text-fg-2">{b?.batch_code}</Mono></TableCell>
                      <TableCell className="text-muted-fg">{formatShortDate(d.logged_at)} · {worker(d.logged_by_staff_id)}</TableCell>
                      <TableCell className="text-muted-fg">{lotsUsed.length ? lotsUsed.map((u) => `#${u.lot_id} (${u.quantity})`).join(", ") : "None recorded"}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
      </SectionCard>
    </Page>
  );
}
