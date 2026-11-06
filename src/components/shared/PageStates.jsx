import { cloneElement, isValidElement } from "react";

import { ArrowClockwise, CloudSlash, ShieldWarning, Tray } from "../icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { NOT_ALLOWED_TITLE, roleLabel } from "../../utils/copy";

/**
 * The states a screen can be in besides "here are the rows", drawn as the
 * boards' EmptyState: an icon in a 40px bordered box, a 14/20 title, one 13px
 * line of help and one outline button. Each sits in a card where the table
 * would be, or inside it.
 *
 * The words are the app's: each state says what happened and what to do.
 */
function Frame({ children, bare = false, className }) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-2 px-4 py-12 text-center",
        !bare && "rounded-lg border border-border bg-card shadow-xs",
        className
      )}
    >
      {children}
    </div>
  );
}

function StateIcon({ icon }) {
  return (
    <span aria-hidden="true" className="flex size-10 items-center justify-center rounded-lg border border-border text-muted-fg">
      {isValidElement(icon) ? cloneElement(icon, { className: "size-5" }) : icon}
    </span>
  );
}

const Heading = ({ children }) => <h2 className="m-0 mt-1 text-sm font-semibold text-foreground">{children}</h2>;
const Body = ({ children }) => <p className="m-0 max-w-md text-13 text-muted-fg">{children}</p>;
const Actions = ({ children }) => <div className="mt-1 flex flex-wrap justify-center gap-2">{children}</div>;

export function EmptyState({
  icon = <Tray />,
  title,
  description,
  query,
  onClearSearch,
  filtered = false,
  onClearFilters,
  actionLabel,
  onAction,
  bare = false,
}) {
  const isSearch = Boolean(query);
  const isFiltered = !isSearch && filtered;
  return (
    <Frame bare={bare}>
      <StateIcon icon={icon} />
      <Heading>{isSearch ? "Nothing matched that" : isFiltered ? "Nothing matches these filters" : title}</Heading>
      <Body>
        {isSearch ? (
          <>Nothing here matches &ldquo;<strong className="font-medium text-foreground">{query}</strong>&rdquo;. Check the spelling, or clear the search.</>
        ) : isFiltered ? (
          "Try another filter, or clear them to see everything."
        ) : (
          description
        )}
      </Body>
      <Actions>
        {isSearch ? (
          <Button variant="outline" onClick={onClearSearch}>Clear the search box</Button>
        ) : isFiltered ? (
          <Button variant="outline" onClick={onClearFilters}>Clear filters</Button>
        ) : onAction ? (
          <Button variant="outline" onClick={onAction}>{actionLabel}</Button>
        ) : null}
      </Actions>
    </Frame>
  );
}

/** Loading: the table's shape in --muted bars, so the page does not jump when rows arrive. */
export function LoadingState({ noun = "records", rows = 5, bare = false }) {
  return (
    <div aria-busy="true" aria-live="polite" className={cn(!bare && "rounded-lg border border-border bg-card shadow-xs")}>
      <span className="sr-only">Loading {noun}…</span>
      <div className="h-9 border-b border-border" />
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="flex h-9 items-center gap-3 border-b border-row-divider px-4 last:border-0">
          <div className="size-6 shrink-0 animate-pulse rounded-full bg-muted" />
          <div className="h-3 w-[34%] animate-pulse rounded bg-muted" />
          <div className="ml-auto h-3 w-[12%] animate-pulse rounded bg-muted" />
        </div>
      ))}
    </div>
  );
}

export function ErrorState({ onRetry, onGoToDashboard, noun = "records" }) {
  return (
    <Frame>
      <StateIcon icon={<CloudSlash />} />
      <Heading>We could not reach the system</Heading>
      <Body>
        Your {noun} could not be loaded, and nothing you have done was lost. This is almost always the internet connection.
      </Body>
      <Actions>
        {onRetry ? (
          <Button variant="outline" onClick={onRetry}>
            <ArrowClockwise aria-hidden="true" />
            Try again
          </Button>
        ) : null}
        {onGoToDashboard ? <Button variant="ghost" onClick={onGoToDashboard}>Go to the dashboard</Button> : null}
      </Actions>
    </Frame>
  );
}

export function NotAllowedState({ role, onGoToDashboard, onSignOut }) {
  return (
    <div className="p-4">
      <Frame>
        <StateIcon icon={<ShieldWarning />} />
        <Heading>{NOT_ALLOWED_TITLE}</Heading>
        <Body>
          {role ? (
            <>
              Your account is set up as <strong className="font-medium text-foreground">{roleLabel(role)}</strong>, and this screen belongs to someone else&rsquo;s work. If you need it, an administrator can change what your account does.
            </>
          ) : (
            "Nobody has set up what your account does yet, so nothing is open to it. An administrator needs to give your account a job before you can get in."
          )}
        </Body>
        <Actions>
          {onGoToDashboard ? <Button variant="outline" onClick={onGoToDashboard}>Back to the dashboard</Button> : null}
          {onSignOut ? <Button variant="ghost" onClick={onSignOut}>Log out</Button> : null}
        </Actions>
      </Frame>
    </div>
  );
}

export function NotFoundState({ noun, onBack }) {
  return (
    <div className="p-4">
      <Frame>
        <StateIcon icon={<Tray />} />
        <Heading>That {noun} is not here any more</Heading>
        <Body>It may have been removed, or the link you followed is out of date. The list shows what is there now.</Body>
        <Actions>
          <Button variant="outline" onClick={onBack}>Back to the list</Button>
        </Actions>
      </Frame>
    </div>
  );
}

/** A quiet one-line note inside a card where a list would be. */
export function EmptySlot({ children, className }) {
  return <p className={cn("m-0 px-4 py-6 text-center text-13 text-muted-fg", className)}>{children}</p>;
}
