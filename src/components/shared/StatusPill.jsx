import { cn } from "@/lib/utils";

/**
 * The app's one status chip.
 *
 * There were six of these. `StatusPill` (this file, the dot-and-label version
 * on the dashboard and product screens), a private `StatusBadge` copied into
 * UserAccountsPage, ManageUserAccountPage and AssignStaffRolePage — identical
 * apart from one having `py-1` instead of `py-1.5` — and inline copies in
 * UpdateProfilePage and ViewProfilePage.
 *
 * The inline pair carried a real bug: they were hardcoded to the green "Active"
 * palette and printed `profile.status` next to it, so a Blocked user looking at
 * their own profile saw a green chip reading "Blocked". Deriving the tone from
 * the status, in one place, is what fixes that.
 *
 * `variant="badge"` is the solid, dot-less treatment the AppShell screens used;
 * the default keeps the bordered dot-and-label look. Both are the original
 * colours, so no screen changes appearance.
 */
const TONES = {
  Active: "border-[#287a5533] bg-[#287a5517] text-[#287a55]",
  Blocked: "border-[#b547473d] bg-[#b5474714] text-[#b54747]",
  Inactive: "border-[#17263a1f] bg-[#17263a0d] text-[#5f6875]",
};

const DOTS = {
  Active: "bg-[#287a55]",
  Blocked: "bg-[#b54747]",
  Inactive: "bg-[#5f6875]",
};

export default function StatusPill({ status, variant = "dot", className }) {
  const tone = TONES[status] ?? TONES.Inactive;
  const dot = DOTS[status] ?? DOTS.Inactive;

  if (variant === "badge") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[13px] font-semibold",
          tone,
          className
        )}
      >
        <span className={cn("size-1.5 rounded-full", dot)} />
        {status}
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-[3px] text-[12px] font-medium",
        tone,
        className
      )}
    >
      <span className={cn("size-[5px] rounded-sm", dot)} />
      {status}
    </span>
  );
}

/**
 * Marks the permanent owner account in the accounts list and directory.
 *
 * Deliberately a separate mark rather than a sixth role: the role stays
 * "Admin", so nothing that branches on role has to learn a new value.
 */
export function SuperAdminPill({ className }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-[#1746d13d] bg-[#1746d114] px-2.5 py-[3px] text-[12px] font-medium text-brand",
        className
      )}
    >
      Super Admin
    </span>
  );
}
