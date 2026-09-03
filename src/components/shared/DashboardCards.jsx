import { Activity } from "../icons";
import { Card } from "@/components/ui/card";

/**
 * The building blocks every role dashboard is made of — Figma screens #13
 * (admin), #23 (cashier / sales staff) and #24 (production staff).
 *
 * These started out private to DashboardPage. The two role dashboards are the
 * same furniture arranged around different data, so they live here rather than
 * being copied three times and drifting apart.
 */

export function StatCard({ icon, tone, value, label, description, onView }) {
  return (
    <div className="rounded-xl border border-[#17263a14] bg-white px-6 pb-6 pt-6 shadow-[0_1px_2px_rgba(23,38,58,0.05)]">
      <div className="flex items-start justify-between">
        <div className={`flex size-[42px] items-center justify-center rounded-[10px] ${tone}`}>
          {icon}
        </div>
        {onView && (
          <button
            type="button"
            onClick={onView}
            className="rounded-md px-2 py-1 text-[12.5px] font-semibold text-[#1746d1] transition hover:bg-[#1746d10f]"
          >
            View →
          </button>
        )}
      </div>
      <p className="pt-4 text-[32px] font-bold leading-8 tracking-[-0.96px] text-[#17263a]">
        {value}
      </p>
      <p className="pt-2 text-[14px] font-semibold text-[#17263a]">{label}</p>
      <p className="pt-1 text-[12.5px] text-[#5f6875]">{description}</p>
    </div>
  );
}

export function Panel({ title, icon, onViewAll, footer, children }) {
  return (
    <Card className="flex flex-col">
      <div className="flex items-center justify-between border-b border-[#17263a12] px-5 pb-4 pt-4">
        <div className="flex items-center gap-3">
          {icon}
          <h3 className="text-[14.5px] font-bold tracking-[-0.145px] text-[#17263a]">
            {title}
          </h3>
        </div>
        {onViewAll && (
          <button
            type="button"
            onClick={onViewAll}
            className="rounded-md px-2 py-1 text-[12.5px] font-semibold text-[#1746d1] transition hover:bg-[#1746d10f]"
          >
            View All →
          </button>
        )}
      </div>
      <div className="flex-1">{children}</div>
      <p className="border-t border-[#17263a0f] bg-[#fafaf8] px-5 py-3 text-[12px] text-[#5f6875]/60">
        {footer}
      </p>
    </Card>
  );
}

/** The "No recent activity" state a panel falls back to (Figma #23/#24 State 2). */
export function PanelEmptyState({ title, description }) {
  return (
    <div className="flex flex-col items-center justify-center px-8 py-14 text-center">
      <div className="flex size-11 items-center justify-center rounded-full bg-[#17263a0a]">
        <Activity className="h-4 w-4 text-[#5f6875]/60" />
      </div>
      <p className="pt-4 text-[14px] font-bold text-[#17263a]">{title}</p>
      <p className="max-w-[340px] pt-2 text-[12.5px] leading-[1.55] text-[#5f6875]">
        {description}
      </p>
    </div>
  );
}

export function QuickAction({ icon, label, onClick, primary = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        primary
          ? "flex h-11 items-center gap-2 rounded-[9px] bg-[#1746d1] px-4 text-[13.5px] font-semibold text-white shadow-[0_2px_6px_rgba(23,70,209,0.24)] transition hover:bg-[#1238ad]"
          : "flex h-11 items-center gap-2 rounded-[9px] border border-[#17263a2e] px-4 text-[13.5px] font-semibold text-[#17263a] transition hover:bg-[#17263a08]"
      }
    >
      {icon}
      {label}
    </button>
  );
}

export function QuickActionsCard({ children }) {
  return (
    <div className="rounded-xl border border-[#17263a14] bg-white px-6 py-5 shadow-[0_1px_2px_rgba(23,38,58,0.05)]">
      <h3 className="text-[14.5px] font-bold tracking-[-0.145px] text-[#17263a]">
        Quick Actions
      </h3>
      <div className="flex flex-wrap gap-3 pt-4">{children}</div>
    </div>
  );
}
