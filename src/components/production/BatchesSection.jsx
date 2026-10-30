import { useState } from "react";

import { ArrowUUpLeft, ChartLine, Hammer, PencilSimple, Plus, Trash, X } from "../icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ToggleGroup } from "@/components/ui/toggle-group";
import { Avatar, Mono } from "../shared/Chip";
import { landedRow } from "../shared/landing";
import { EmptyState, Page, PageHeader, SectionCard, StatCard, StatCards } from "../shared/page";
import { FlowStrip, LookBadge, MoreActions, ToggleChips } from "./parts";
import { cn } from "@/lib/utils";
import { materialShortfall, productionTotals, units } from "../../utils/production";
import { formatShortDate } from "../../utils/profileFormat";

/**
 * Production · Batches, drawn to the "7 · Production · Batches" board:
 *
 *   PageHeader (Production report, Start batch) → four compact StatCards →
 *   "How a batch moves" → the Batches / Make list switch → the batches table
 *   (Batch, Product, Planned, Stage, Progress, Good / damaged, Made by,
 *   Started, Next step) or the make list.
 *
 * The next step is the board's single button per row. The app's other batch
 * corrections (step back, change details, cancel, re-open, delete) sit behind
 * the row's DotsThree. Saved recipes, which fill in a batch's material, sit
 * under the make list.
 */
const STAGE = {
  Queued: { label: "Planned", verb: "Start making", step: 1, className: "border-border-subtle bg-card text-fg-2", dot: "bg-muted-2" },
  "In Progress": { label: "In production", verb: "Send to check", step: 2, className: "border-border bg-muted text-ink", dot: "bg-inverse" },
  "Quality Check": { label: "Quality check", verb: "Count and finish", step: 3, className: "border-warning-bd bg-warning-bg text-warning-fg", dot: "bg-warning" },
  Completed: { label: "Completed", verb: "", step: 4, className: "border-success-bd bg-success-bg text-success-fg", dot: "bg-success" },
  Cancelled: { label: "Cancelled", verb: "", step: 0, className: "border-border-subtle bg-card text-muted-fg", dot: "bg-border" },
};

const FLOW = [
  ["1. Plan", "Choose the product and the material. The material is set aside, not used up."],
  ["2. Make and check", "Start production, then send the finished pieces to quality check."],
  ["3. Finish", "Count good and damaged pieces. Good pieces go into inventory in the same step."],
];

const WEEK = 7 * 86_400_000;

function Progress({ step, done }) {
  return (
    <span role="img" aria-label={`Step ${Math.max(0, step)} of 4`} className="inline-flex gap-0.5">
      {[1, 2, 3, 4].map((n) => (
        <span key={n} className={cn("h-1.5 w-4 rounded-sm", step >= n ? (done ? "bg-success" : "bg-fg-3") : "bg-muted-strong")} />
      ))}
    </span>
  );
}

export default function BatchesSection({ ws }) {
  const { batches, materials, recipes, nextToMake, canMake, canCorrect, canRemoveRecords, manager, mat, prod, worker, change, now } = ws;
  const [tab, setTab] = useState("batches");
  const [show, setShow] = useState(ws.initialFilter === "all" ? "all" : "active");

  const unfinished = batches.filter((b) => ["Queued", "In Progress", "Quality Check"].includes(b.status));
  const inCheck = unfinished.filter((b) => b.status === "Quality Check").length;
  const completed = batches.filter((b) => b.status === "Completed");
  const madeThisWeek = completed
    .filter((b) => b.completed_at && now - new Date(b.completed_at).getTime() < WEEK)
    .reduce((sum, b) => sum + (b.good_output_qty || 0), 0);
  const totals = productionTotals(batches);
  const shortMaterials = materials.filter((m) => m.status !== "Archived" && materialShortfall(m, batches) > 0);
  const shown = batches
    .filter((b) => show === "all" || unfinished.includes(b) || ws.justChanged("batch", b.id))
    .slice()
    .reverse();

  const coverFor = (productId) => unfinished.filter((b) => b.target_product_id === productId);

  const nextStep = (b) => {
    if (!canMake) return null;
    if (b.status === "Queued") {
      return () => ws.showConfirm("batch_status", b.id, "In Progress", "Start production?", `${b.batch_code} will be marked as in production. Its material stays set aside and is deducted only when the batch is finished.`);
    }
    if (b.status === "In Progress") {
      return () => ws.showConfirm("batch_status", b.id, "Quality Check", "Send to quality check?", `The pieces for ${b.batch_code} are ready to count and inspect. Stock changes only when the batch is finished after the check.`);
    }
    if (b.status === "Quality Check") return () => ws.setDialog({ kind: "complete", record: b });
    return null;
  };

  const moreFor = (b) => {
    const open = ["Queued", "In Progress", "Quality Check"].includes(b.status);
    const batchMaterial = mat(b.raw_material_id);
    return [
      ["In Progress", "Quality Check"].includes(b.status) && canMake && {
        label: b.status === "In Progress" ? "Back to planned" : "Back to in production",
        icon: <ArrowUUpLeft aria-hidden="true" />,
        onClick: () => ws.showConfirm("batch_step_back", b.id, undefined,
          b.status === "In Progress" ? "Move back to planned?" : "Move back to in production?",
          `${b.batch_code} goes back one step, for a step pressed by mistake. Its material stays set aside, and no stock changes.`),
      },
      open && canCorrect && {
        label: "Change details",
        icon: <PencilSimple aria-hidden="true" />,
        onClick: () => ws.setDialog({ kind: "edit-batch", record: b }),
      },
      b.status === "Completed" && canRemoveRecords && {
        label: "Re-open batch",
        icon: <ArrowUUpLeft aria-hidden="true" />,
        onClick: () => ws.askWhy("reopen_batch", b.id, {
          title: `Re-open ${b.batch_code}?`,
          description: `For a batch finished with the wrong counts. The ${b.good_output_qty} good pieces come back off Inventory, the ${units(b.raw_material_used_qty, batchMaterial?.unit)} used go back to the material, and the damage record is removed. It returns to quality check to be finished again. Refused if those pieces are already sold or set aside for orders.`,
          verb: "Re-open batch", question: "What was recorded wrong?",
        }),
      },
      open && (b.status === "Queued" ? canMake : canCorrect) && {
        label: "Cancel batch",
        icon: <X aria-hidden="true" />,
        danger: true,
        separatorBefore: true,
        onClick: () => ws.askWhy("cancel_batch", b.id, {
          title: `Cancel ${b.batch_code}?`,
          description: `${units(b.raw_material_used_qty, batchMaterial?.unit)} set aside for it becomes free for other batches. No stock is deducted, and the batch stays in the history as cancelled. If material was already cut, record it as damage on the material.`,
          verb: "Cancel batch", question: "Why is this batch being cancelled?",
        }),
      },
      ["Queued", "Cancelled"].includes(b.status) && canRemoveRecords && {
        label: "Delete batch",
        icon: <Trash aria-hidden="true" />,
        danger: true,
        separatorBefore: !(open && (b.status === "Queued" ? canMake : canCorrect)),
        onClick: () => ws.askWhy("delete_batch", b.id, {
          title: `Delete ${b.batch_code}?`,
          description: "For a batch entered by mistake. It is removed from the list for good; no stock moved, so none changes. The activity log keeps a line saying who deleted it and why.",
          verb: "Delete batch", question: "Why is it being deleted?",
        }),
      },
    ].filter(Boolean);
  };

  return (
    <Page>
      <PageHeader
        icon={Hammer}
        title="Batches"
        description="Batches on the workshop floor, and what the open orders still need made."
        actions={
          <>
            {ws.canSeeReport ? (
              <Button variant="outline" onClick={() => ws.onNavigate("production-report")}>
                <ChartLine aria-hidden="true" />
                Production report
              </Button>
            ) : null}
            {canMake ? (
              <Button onClick={() => ws.setDialog({ kind: "start" })} aria-haspopup="dialog">
                <Plus aria-hidden="true" />
                Start batch
              </Button>
            ) : null}
          </>
        }
      />

      <StatCards label="Production totals" min={180}>
        <StatCard compact label="Unfinished batches" value={unfinished.length} caption={`${inCheck} waiting for quality check`} />
        <StatCard compact label="Made this week" value={madeThisWeek.toLocaleString("en-US")} caption="good pieces" />
        <StatCard compact label="Damaged" value={totals.damageRate === null ? "—" : `${totals.damageRate.toFixed(1)}%`} caption="of everything finished" />
        <StatCard
          compact
          label="Waiting on material"
          value={shortMaterials.length}
          caption={shortMaterials[0] ? `${shortMaterials[0].name}, short ${units(materialShortfall(shortMaterials[0], batches), shortMaterials[0].unit)}` : "nothing short"}
        />
      </StatCards>

      <FlowStrip label="How a batch moves" steps={FLOW} />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <ToggleGroup
          label="Production sections"
          value={tab}
          onValueChange={setTab}
          options={[
            { value: "batches", label: <>Batches <span className="text-xs text-muted-fg">{batches.length}</span></> , ariaLabel: "Batches" },
            { value: "make", label: <>Make list <span className="text-xs text-muted-fg">{nextToMake.length}</span></>, ariaLabel: "Make list" },
          ]}
        />
        {tab === "batches" ? (
          <ToggleChips
            label="Show batches"
            value={show}
            onChange={setShow}
            chips={[
              { value: "active", label: "Unfinished", count: unfinished.length },
              { value: "all", label: "All batches", count: batches.length },
            ]}
          />
        ) : null}
      </div>

      {tab === "batches" ? (
        <section aria-label="Batches" className="rounded-lg border border-border bg-card shadow-xs">
          {shown.length === 0 ? (
            <EmptyState
              icon={Hammer}
              title={show === "active" ? "No unfinished batches" : "No batches yet"}
              description="A batch is one job on the floor: what to make, how much material to set aside, and who is making it."
              action={show === "active" && batches.length ? <Button variant="outline" onClick={() => setShow("all")}>Show all batches</Button> : null}
            />
          ) : (
            <Table minWidth={1080} aria-label="Batches">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[110px]">Batch</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead className="w-[90px] text-right">Planned</TableHead>
                  <TableHead className="w-[130px]">Stage</TableHead>
                  <TableHead className="w-[100px]">Progress</TableHead>
                  <TableHead className="w-[120px]">Good / damaged</TableHead>
                  <TableHead className="w-[160px]">Made by</TableHead>
                  <TableHead className="w-[100px]">Started</TableHead>
                  <TableHead className="w-[190px]"><span className="sr-only">Next step</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shown.map((b) => {
                  const look = STAGE[b.status] ?? STAGE.Queued;
                  const landed = landedRow(change, "batch", b.id);
                  const go = nextStep(b);
                  const by = worker(b.assigned_staff_id);
                  return (
                    <TableRow key={landed.key} className={landed.className}>
                      <TableCell><Mono className="text-fg-2">{b.batch_code}</Mono></TableCell>
                      <TableCell className="max-w-[240px] truncate font-medium">
                        {prod(b.target_product_id)?.name}
                        {b.order_id ? <Badge variant="outline" className="ml-2">Order #{b.order_id}</Badge> : null}
                      </TableCell>
                      <TableCell className="text-right">{b.target_output_qty}</TableCell>
                      <TableCell><LookBadge look={look} /></TableCell>
                      <TableCell><Progress step={look.step} done={b.status === "Completed"} /></TableCell>
                      <TableCell className="text-fg-2">
                        {b.status === "Completed" ? `${b.good_output_qty} / ${b.damaged_qty}` : "—"}
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex min-w-0 items-center gap-2">
                          <Avatar name={by} />
                          <span className="truncate">{by}</span>
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-fg">{formatShortDate(b.started_at || b.created_at) || "—"}</TableCell>
                      <TableCell>
                        <span className="flex items-center justify-end gap-1">
                          {go && look.verb ? <Button variant="outline" size="sm" onClick={go}>{look.verb}</Button> : null}
                          <MoreActions label={`More for ${b.batch_code}`} items={moreFor(b)} />
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </section>
      ) : (
        <>
          <SectionCard
            aria-label="Make list"
            title="What open orders still need"
            description="Ordered quantities minus what is on the shelf and what is already being made."
          >
            {nextToMake.length === 0 ? (
              <div className="border-t border-border">
                <EmptyState icon={Hammer} title="Nothing to make" description="Every product is above the level it should be." />
              </div>
            ) : (
              <div className="border-t border-border">
                <Table minWidth={860} aria-label="Make list">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>For orders</TableHead>
                      <TableHead className="text-right">Needed</TableHead>
                      <TableHead className="text-right">On shelf</TableHead>
                      <TableHead className="text-right">Short by</TableHead>
                      <TableHead>Covered by</TableHead>
                      <TableHead className="w-[120px]"><span className="sr-only">Action</span></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {nextToMake.map(({ product, needed, onShelf, backorder }) => {
                      const cover = coverFor(product.id);
                      const planned = cover.reduce((sum, b) => sum + b.target_output_qty, 0);
                      const short = Math.max(0, needed - planned);
                      return (
                        <TableRow key={`${backorder ? "owed" : "low"}-${product.id}`}>
                          <TableCell className="font-medium">{product.name}</TableCell>
                          <TableCell className="text-fg-2">{backorder ? "Owed to a customer" : "Shelf stock"}</TableCell>
                          <TableCell className="text-right">{needed}</TableCell>
                          <TableCell className="text-right text-muted-fg">{onShelf}</TableCell>
                          <TableCell className={cn("text-right", short > 0 && "font-medium text-danger-fg")}>{short}</TableCell>
                          <TableCell>
                            {cover.length ? (
                              <span className="text-fg-2">{cover.map((b) => b.batch_code).join(", ")} · {planned} pcs</span>
                            ) : (
                              <LookBadge look={{ label: "Nothing planned", className: "border-warning-bd bg-warning-bg text-warning-fg", dot: "bg-warning" }} />
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {canMake && !cover.length ? (
                              <Button variant="outline" size="sm" onClick={() => ws.setDialog({ kind: "start", productId: product.id, needed: needed * (product.packSize || 1) })}>
                                Start batch
                              </Button>
                            ) : null}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </SectionCard>

          <SectionCard
            title="Usual material recipes"
            description="A recipe fills in the material count when a batch is started."
            action={manager ? (
              <Button variant="outline" size="sm" onClick={() => ws.setDialog({ kind: "recipe" })}>
                <Plus aria-hidden="true" />
                Save a recipe
              </Button>
            ) : null}
          >
            {recipes.length === 0 ? (
              <p className="m-0 border-t border-border px-4 py-6 text-13 text-muted-fg">
                No recipes yet. Without one, a batch still takes a custom count.
              </p>
            ) : (
              <ul className="m-0 list-none border-t border-border p-0">
                {recipes.map((r) => (
                  <li key={r.id} className="relative flex flex-wrap items-center gap-3 border-t border-row-divider px-4 py-2.5 first:border-t-0">
                    <span className="min-w-0 flex-1">
                      <span className="block text-13 font-medium">{prod(r.product_id)?.name}</span>
                      <span className="block text-13 text-muted-fg">{units(r.material_qty, mat(r.raw_material_id)?.unit)} of {mat(r.raw_material_id)?.name}</span>
                    </span>
                    <span className="text-13 text-muted-fg">makes about <span className="font-medium text-foreground">{r.output_qty} pieces</span></span>
                    {manager ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => ws.setDialog({
                          kind: "confirm", action: "delete_recipe", initial: { id: r.id },
                          title: `Remove the recipe for ${prod(r.product_id)?.name ?? "this product"}?`,
                          description: "New batches stop filling in this material count. Batches already planned or finished keep their own counts.",
                        })}
                      >
                        Remove
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </>
      )}
    </Page>
  );
}
