import { useMemo } from "react";
import {
  BookUser,
  CheckCircle2,
  CircleSlash,
  FileText,
  History,
  Package,
  UserPlus,
  Users,
} from "./icons";
import ManagementShell from "./layout/ManagementShell";
import StatusPill from "./shared/StatusPill";
import {
  Panel,
  QuickAction,
  QuickActionsCard,
  StatCard,
} from "./shared/DashboardCards";
import { avatarColorOf } from "./shared/avatarColors";
import { initialsOf } from "../utils/staffData";
import { greeting } from "../utils/profileFormat";
import { ACTION_PILL_STYLES, SAMPLE_ENTRIES } from "../utils/activityData";

/**
 * LSB Handicrafts — Dashboard
 * Figma: Screen #13, node 158:2
 *
 * Landing screen for every signed-in role. The four counters and both panels
 * are derived from the `staff` rows App.jsx already holds plus the activity
 * entries in utils/activityData — nothing here fetches on its own.
 */

const PANEL_ROWS = 5;

export default function DashboardPage({
  staff = [],
  activityEntries = SAMPLE_ENTRIES,
  profile,
  onNavigate,
  onSignOut,
}) {
  const counts = useMemo(
    () => ({
      total: staff.length,
      active: staff.filter((s) => s.status === "Active").length,
      blocked: staff.filter((s) => s.status === "Blocked").length,
    }),
    [staff]
  );

  const isAdmin = profile?.role === "Admin";
  const displayName = isAdmin ? "Administrator" : profile?.name;

  return (
    <ManagementShell
      active="dashboard"
      title="Dashboard"
      subtitle="Overview of your system"
      profile={profile}
      onNavigate={onNavigate}
      onSignOut={onSignOut}
    >
      <div className="mx-auto w-full max-w-[1160px]">
        <h2 className="text-[24px] font-bold leading-9 tracking-[-0.48px] text-[#17263a]">
          {greeting()}, {displayName}.
        </h2>
        <p className="pt-1 text-[14.5px] text-[#5f6875]">
          Here&rsquo;s an overview of LSB Handicrafts.
        </p>

        <div className="grid grid-cols-1 gap-4 pt-7 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            icon={<Users className="h-5 w-5 text-[#1b3a6b]" />}
            tone="bg-[#1b3a6b14]"
            value={counts.total}
            label="Total Users"
            description="Registered staff accounts"
          />
          <StatCard
            icon={<CheckCircle2 className="h-5 w-5 text-[#287a55]" />}
            tone="bg-[#287a5517]"
            value={counts.active}
            label="Active Users"
            description="Currently able to log in"
          />
          <StatCard
            icon={<CircleSlash className="h-5 w-5 text-[#b54747]" />}
            tone="bg-[#b5474714]"
            value={counts.blocked}
            label="Blocked Users"
            description="Access currently restricted"
          />
          <StatCard
            icon={<FileText className="h-5 w-5 text-[#653eb5]" />}
            tone="bg-[#653eb514]"
            value={activityEntries.length}
            label="Activity Entries"
            description="Total recorded actions"
          />
        </div>

        <div className="grid grid-cols-1 gap-5 pt-7 lg:grid-cols-2">
          <Panel
            title="User Management"
            onViewAll={() => onNavigate("accounts")}
            footer={`${staff.length} staff ${
              staff.length === 1 ? "member" : "members"
            } total`}
          >
            <div className="flex items-center gap-4 bg-[#fafaf8] px-5 py-2.5">
              <span className="flex-[2] text-[10.5px] font-bold uppercase tracking-[0.945px] text-[#5f6875]">
                Name
              </span>
              <span className="flex-[1.4] text-[10.5px] font-bold uppercase tracking-[0.945px] text-[#5f6875]">
                Role
              </span>
              <span className="w-[104px] text-[10.5px] font-bold uppercase tracking-[0.945px] text-[#5f6875]">
                Status
              </span>
            </div>
            {staff.slice(0, PANEL_ROWS).map((member, index) => (
              <div
                key={member.id}
                className={`flex items-center gap-4 px-5 py-3 ${
                  index > 0 ? "border-t border-[#17263a0d]" : ""
                }`}
              >
                <div className="flex flex-[2] min-w-0 items-center gap-2.5">
                  <span
                    className={`flex size-7 shrink-0 items-center justify-center rounded-full text-[9.5px] font-bold text-white ${avatarColorOf(
                      member.name
                    )}`}
                  >
                    {initialsOf(member.name)}
                  </span>
                  <span className="truncate text-[13.5px] font-medium text-[#17263a]">
                    {member.name}
                  </span>
                </div>
                <span className="flex-[1.4] truncate text-[12.5px] text-[#5f6875]">
                  {member.role}
                </span>
                <span className="w-[104px]">
                  <StatusPill status={member.status} />
                </span>
              </div>
            ))}
          </Panel>

          <Panel
            title="Recent Activity"
            onViewAll={() => onNavigate("activity")}
            footer={`${activityEntries.length} ${
              activityEntries.length === 1 ? "entry" : "entries"
            } recorded`}
          >
            {activityEntries.slice(0, PANEL_ROWS).map((entry, index) => (
              <div
                key={entry.id}
                className={`flex items-center gap-3.5 px-5 py-3 ${
                  index > 0 ? "border-t border-[#17263a0d]" : ""
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] text-[#17263a]">
                    <span className="font-semibold">{entry.staff}</span>
                    <span className="font-medium"> — {entry.action}</span>
                  </p>
                  <p className="pt-0.5 text-[12px] text-[#5f6875]">
                    {entry.date} · {entry.time}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-[3px] text-[11.5px] font-semibold tracking-[0.115px] ${
                    ACTION_PILL_STYLES[entry.type] ?? ACTION_PILL_STYLES.Login
                  }`}
                >
                  {entry.type}
                </span>
              </div>
            ))}
          </Panel>
        </div>

        <div className="mt-5">
          <QuickActionsCard>
            {isAdmin && (
              <>
                <QuickAction
                  icon={<UserPlus className="h-[15px] w-[15px]" />}
                  label="Create User Account"
                  onClick={() => onNavigate("create")}
                />
                <QuickAction
                  icon={<Users className="h-[15px] w-[15px]" />}
                  label="View User Accounts"
                  onClick={() => onNavigate("accounts")}
                />
                <QuickAction
                  icon={<History className="h-[15px] w-[15px]" />}
                  label="Activity Log"
                  onClick={() => onNavigate("activity")}
                />
                <QuickAction
                  icon={<BookUser className="h-[15px] w-[15px]" />}
                  label="Staff Directory"
                  onClick={() => onNavigate("directory")}
                />
              </>
            )}
            {/* Not in the Figma quick-action row, but the inventory/deliveries/
                orders workspace has no other way in now that this screen is the
                landing page. */}
            <QuickAction
              icon={<Package className="h-[15px] w-[15px]" />}
              label="Inventory Workspace"
              onClick={() => onNavigate("workspace")}
            />
          </QuickActionsCard>
        </div>
      </div>
    </ManagementShell>
  );
}
