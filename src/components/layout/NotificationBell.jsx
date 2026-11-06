import { useState } from "react";

import { Bell } from "../icons";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { whenLabel } from "../../utils/activityLog";

/**
 * The bell in the top bar: the signed-in person's own alerts, newest first,
 * with a count of the unread ones. Choosing an alert opens what it is about
 * and marks it read; "Mark all as read" clears the count.
 *
 * Which events reach a person is theirs to choose, on Settings · Notifications.
 */
export default function NotificationBell({ notifications = [], onOpen, onMarkAllRead, onOpenSettings }) {
  const unread = notifications.filter((n) => !n.readAt).length;
  // Held here so choosing an alert -- which navigates away -- also closes the list.
  const [open, setOpen] = useState(false);
  const choose = (n) => { setOpen(false); onOpen?.(n); };
  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
        className="relative inline-flex size-8 shrink-0 items-center justify-center rounded-md text-fg-2 hover:bg-muted data-[popup-open]:bg-muted"
      >
        <Bell className="size-4" aria-hidden="true" />
        {unread ? (
          <span aria-hidden="true" className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold leading-none text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        ) : null}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[340px] p-0">
        <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2.5">
          <span className="text-sm font-semibold">Notifications</span>
          {unread ? (
            <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={onMarkAllRead}>Mark all as read</Button>
          ) : null}
        </div>
        {notifications.length === 0 ? (
          <p className="m-0 px-3 py-6 text-center text-13 text-muted-fg">Nothing yet. Alerts you choose show up here.</p>
        ) : (
          <ul aria-label="Notifications" className="m-0 max-h-[360px] list-none overflow-y-auto p-0">
            {notifications.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => choose(n)}
                  className={cn(
                    "flex w-full items-start gap-2 border-0 border-b border-row-divider bg-transparent px-3 py-2.5 text-left hover:bg-muted",
                    !n.readAt && "bg-surface-2"
                  )}
                >
                  <span aria-hidden="true" className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.readAt ? "bg-transparent" : "bg-primary")} />
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className={cn("text-13", n.readAt ? "text-fg-2" : "font-medium text-foreground")}>{n.title}</span>
                    {n.body ? <span className="text-xs text-muted-fg">{n.body}</span> : null}
                    <span className="text-xs text-muted-fg">{whenLabel(n.createdAt)}{n.readAt ? "" : " · New"}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {onOpenSettings ? (
          <div className="px-3 py-2">
            <button type="button" data-slot="text-link" onClick={() => { setOpen(false); onOpenSettings(); }} className="border-0 bg-transparent p-0 text-xs text-primary-text hover:underline">
              Choose what you hear about
            </button>
          </div>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
