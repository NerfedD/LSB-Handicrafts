import { ArrowRight, TriangleAlert } from "../icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import IconChip from "./Chip";
import { EmptySlot } from "./PageStates";
import { tone as toneOf } from "./tones";

/**
 * The dashboard furniture.
 *
 * The three role dashboards and the large-text view are the same pieces
 * arranged around different data, so they live here rather than being copied
 * four times and drifting apart — which is exactly what happened to the
 * previous three dashboards.
 */

/**
 * "Needs your attention" — the centrepiece of every standard dashboard.
 *
 * This is the screen's teaching mechanism, and that is a design claim worth
 * spelling out: a new user learns what this system is FOR by reading three
 * sentences about their own day, each with one button whose label is a verb.
 * Not "7 low stock items" with a link to a list, but "Seven products are
 * running low" → "Restock these".
 *
 * The 5px clay left border and the lifted shadow are what make it the first
 * thing on the page. It is the only element in the app that gets them.
 */
export function AttentionCard({ title, updatedAt, items, emptyMessage, className }) {
  return (
    <Card variant="lift" className={cn("border-l-[5px] border-l-clay", className)}>
      <CardHeader>
        <IconChip icon={<TriangleAlert />} tone="amber" size="sm" />
        <CardTitle className="text-[19px]">{title}</CardTitle>
        {updatedAt && (
          <span className="ml-auto shrink-0 text-[14px] text-muted">
            {updatedAt}
          </span>
        )}
      </CardHeader>

      {items.length === 0 ? (
        <EmptySlot className="py-10 text-[15.5px]">{emptyMessage}</EmptySlot>
      ) : (
        <ul>
          {items.map((item) => (
            <li
              key={item.key ?? item.title}
              className="flex flex-wrap items-center gap-4.5 border-b border-hair px-5.5 py-4.5 last:border-b-0"
            >
              <IconChip icon={item.icon} tone={item.tone} size="lg" />
              <div className="min-w-[220px] flex-1">
                <p className="text-[17.5px] font-bold leading-[1.35] text-ink">
                  {item.title}
                </p>
                <p className="pt-1 text-[15px] leading-[1.45] text-muted">
                  {item.body}
                </p>
              </div>
              {/* Full width on a phone: the handoff turns each item's CTA into
                  a full-width 50px button there rather than letting three
                  buttons wrap into a ragged column. */}
              <Button
                variant="cobalt"
                onClick={item.onAction}
                className="w-full sm:w-auto"
              >
                {item.actionIcon}
                {item.actionLabel}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/**
 * Four numbers in ONE bordered card, divided by rules — not four separate
 * cards.
 *
 * Four cards give four equal-weight objects each demanding its own read. One
 * card with rules in it reads as a single strip you scan, which is all these
 * numbers are worth: they are context, and the attention card above them is
 * the content. Demoting them is the point.
 */
// Rules BETWEEN cells, never around the outside — the card's own border does
// that. Written out per position rather than derived, because "which edges does
// cell 2 of 4 need at each breakpoint" is not something a modulo expression
// says clearly: at two columns the strip needs a rule under the top pair, at
// four columns it does not.
const STRIP_EDGES = [
  "border-r border-b lg:border-b-0",
  "border-b lg:border-b-0 lg:border-r",
  "border-r",
];

export function StatStrip({ stats, className }) {
  return (
    <Card className={cn("grid grid-cols-2 lg:grid-cols-4", className)}>
      {stats.map((stat, index) => (
        <div
          key={stat.label}
          className={cn(
            "px-5 py-4.5 border-hair",
            STRIP_EDGES[index] ?? ""
          )}
        >
          <div className="flex items-center gap-2.5">
            <span className={cn("shrink-0 text-[18px]", toneOf(stat.tone).text)} aria-hidden="true">
              {stat.icon}
            </span>
            <p className="text-[14px] font-bold text-muted">{stat.label}</p>
          </div>
          <p className="pt-2.5 text-[32px] font-extrabold leading-none tracking-[-0.03em] tabular-nums text-ink">
            {stat.value}
          </p>
          <p className="pt-1.5 text-[13.5px] text-muted">{stat.hint}</p>
        </div>
      ))}
    </Card>
  );
}

/**
 * A standalone stat card, for the role dashboards that show three rather than
 * a strip of four.
 */
export function StatCard({ icon, tone = "cobalt", value, label, hint, className }) {
  return (
    <Card className={cn("p-5", className)}>
      <IconChip icon={icon} tone={tone} size="md" />
      <p className="pt-4 text-[32px] font-extrabold leading-none tracking-[-0.03em] tabular-nums text-ink">
        {value}
      </p>
      <p className="pt-2 text-[16px] font-bold text-ink">{label}</p>
      <p className="pt-1 text-[14px] text-muted">{hint}</p>
    </Card>
  );
}

/**
 * The large-text dashboard's hero stat: a 2px tone-tinted border, a 48px chip
 * and a 56px number.
 *
 * Nothing on that screen is below 15px, and the numbers are set at a size that
 * is readable across a workshop — it is the same system at kiosk scale, for
 * somebody who is not going to lean in.
 */
export function HeroStat({ icon, tone = "cobalt", value, label, hint, className }) {
  const t = toneOf(tone);
  return (
    <div className={cn("rounded-card border-2 bg-surface p-5.5", t.border, className)}>
      <IconChip icon={icon} tone={tone} size="xl" className="size-12 text-[22px]" />
      <p className="pt-4 text-[56px] font-extrabold leading-none tracking-[-0.04em] tabular-nums text-ink">
        {value}
      </p>
      <p className="pt-3 text-[18px] font-extrabold text-ink">{label}</p>
      <p className="pt-1.5 text-[16.5px] leading-[1.4] text-muted">{hint}</p>
    </div>
  );
}

/**
 * A destination tile on the large-text dashboard — "WHERE DO YOU WANT TO GO?".
 *
 * Six of these in a 3-column grid replace a sidebar somebody has to read down.
 * Each is a 96px target with a 60px icon, which is a very large thing to aim
 * at, and that is the requirement being met rather than an aesthetic.
 */
export function DestinationTile({ icon, tone = "cobalt", label, hint, onClick, className }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex min-h-24 items-center gap-4 rounded-feature border border-card bg-surface p-5 text-left shadow-card transition duration-150",
        "hover:border-cobalt/40 hover:shadow-lift",
        className
      )}
    >
      <IconChip icon={icon} tone={tone} size="2xl" />
      <span className="min-w-0">
        <span className="block text-[21px] font-extrabold leading-tight text-ink">{label}</span>
        <span className="block pt-1 text-[15.5px] leading-[1.4] text-muted">{hint}</span>
      </span>
    </button>
  );
}

/**
 * "What happened recently" — a feed of sentences, not a table of event types.
 *
 * Each entry is one line somebody can read at speed: the staff name in bold,
 * then what they did, then when. The old version put the event TYPE in a pill
 * on the right ("Stock Edit"), which is a category the reader has to translate
 * back into a sentence themselves.
 */
export function ActivityFeed({ entries, onSeeAll, title = "What happened recently", className }) {
  return (
    <Card className={cn("flex flex-col", className)}>
      <CardHeader className="justify-between">
        <CardTitle>{title}</CardTitle>
        {onSeeAll && (
          <Button variant="link" size="sm" className="px-0" onClick={onSeeAll}>
            See all
            <ArrowRight className="h-4.5 w-4.5" />
          </Button>
        )}
      </CardHeader>

      {entries.length === 0 ? (
        <EmptySlot className="py-10 text-[15.5px]">
          Nothing has happened yet today.
        </EmptySlot>
      ) : (
        <ul className="flex-1">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className="flex items-start gap-3.5 border-b border-hair px-5 py-3.5 last:border-b-0"
            >
              <IconChip icon={entry.icon} tone={entry.tone} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="text-[15.5px] leading-[1.45] text-ink">
                  <strong className="font-extrabold">{entry.who}</strong> {entry.what}
                </p>
                <p className="pt-0.5 text-[13.5px] text-muted">{entry.when}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/**
 * "Things you do often" — four stacked 56px buttons, the first one cobalt.
 *
 * Only the first is filled. Four primary-coloured buttons is no priority at
 * all, and the one that is filled is the one this role reaches for most.
 */
export function QuickActions({ actions, title = "Things you do often", className }) {
  return (
    <Card className={cn("p-5", className)}>
      <CardTitle>{title}</CardTitle>
      <div className="flex flex-col gap-2.5 pt-4">
        {actions.map((action, index) => (
          <Button
            key={action.label}
            variant={index === 0 ? "cobalt" : "outline"}
            size="xl"
            block
            className="justify-start gap-3"
            onClick={action.onClick}
          >
            {action.icon}
            {action.label}
          </Button>
        ))}
      </div>
    </Card>
  );
}

/**
 * The page greeting: "Good morning, Maria." over one line about the day.
 *
 * The second line is the one that does the work — "Three things need you
 * today. Everything else is running normally." tells somebody whether to
 * settle in or carry on, which is the actual question they open a dashboard
 * with.
 */
export function Greeting({ greeting, name, summary, className }) {
  return (
    <div className={className}>
      <h2 className="text-[29px] font-extrabold leading-tight tracking-[-0.025em] text-ink">
        {greeting}, {name}.
      </h2>
      <p className="pt-1.5 text-[16px] leading-[1.45] text-muted">{summary}</p>
    </div>
  );
}
