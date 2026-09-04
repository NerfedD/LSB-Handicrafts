import { CloudOff, Inbox, LoaderCircle, RotateCw, ShieldAlert } from "../icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { tone as toneOf } from "./tones";
import { NOT_ALLOWED_TITLE, roleLabel } from "../../utils/copy";

/**
 * The four states that are not "here is your data".
 *
 * They were one state before — an empty list — which meant a failed read, a
 * read still in flight, and a genuinely empty table all showed the same "No
 * customer records yet" panel. Those are three different situations with three
 * different next actions, and telling somebody "there is nothing here" while
 * their data is still arriving is simply false.
 *
 * ALL FOUR OFFER A WAY OUT. That is the part that makes them states rather
 * than dead ends: an empty list offers the button that fills it, a failed read
 * offers a retry AND a route off the screen, and a permission wall names who
 * to ask.
 */

function Frame({ children, className }) {
  return (
    <Card
      className={cn("flex min-h-[380px] flex-col items-center justify-center px-6 py-16 text-center", className)}
      clip={false}
    >
      {children}
    </Card>
  );
}

/** The 76px circle every one of these leads with. */
function StateIcon({ icon, tone = "neutral" }) {
  const t = toneOf(tone);
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-19 items-center justify-center rounded-full text-[30px]",
        t.tint,
        t.text
      )}
    >
      {icon}
    </span>
  );
}

function Heading({ children }) {
  return (
    <h2 className="pt-5 text-[21px] font-extrabold tracking-[-0.01em] text-ink">
      {children}
    </h2>
  );
}

function Body({ children }) {
  return (
    <p className="max-w-80 pt-2.5 text-[15.5px] leading-[1.55] text-muted">
      {children}
    </p>
  );
}

function Actions({ children }) {
  return <div className="flex flex-wrap justify-center gap-3 pt-6">{children}</div>;
}

/**
 * Nothing there yet.
 *
 * Two flavours, decided by whether a search is active: a never-populated list
 * gets the button that populates it, a filtered-to-nothing list gets the
 * control that undoes the filter. Offering "Add a product" to somebody who has
 * simply mistyped a search is answering a question they did not ask.
 */
export function EmptyState({
  icon = <Inbox />,
  title,
  description,
  query,
  onClearSearch,
  actionLabel,
  onAction,
}) {
  const isSearch = Boolean(query);

  return (
    <Frame>
      <StateIcon icon={icon} />
      <Heading>{isSearch ? "Nothing matched that" : title}</Heading>
      <Body>
        {isSearch ? (
          <>
            Nothing here matches &ldquo;<strong className="font-bold text-ink">{query}</strong>&rdquo;.
            Check the spelling, or clear the search box to see everything again.
          </>
        ) : (
          description
        )}
      </Body>
      <Actions>
        {isSearch ? (
          <Button variant="outline" size="lg" onClick={onClearSearch}>
            Clear the search box
          </Button>
        ) : (
          onAction && (
            <Button variant="cobalt" size="lg" onClick={onAction}>
              {actionLabel}
            </Button>
          )
        )}
      </Actions>
    </Frame>
  );
}

/**
 * Still loading.
 *
 * Skeleton rows that MIRROR THE REAL ROW GEOMETRY — a 44px chip block, two
 * bars, a pill block, on a 62px row. That matching matters: a skeleton whose
 * shape is wrong makes the content jump when it lands, which reads as the page
 * having reloaded itself.
 *
 * The spinner and the sentence are underneath rather than instead, so somebody
 * on a slow connection has words confirming that waiting is the right thing to
 * do.
 */
export function LoadingState({ noun = "records", rows = 5 }) {
  return (
    <Card aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading {noun}…</span>
      <div className="h-12 border-b border-hair bg-paper-2" />
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          className="flex h-15.5 items-center gap-3.5 border-b border-hair px-5.5"
        >
          <div className="size-11 shrink-0 animate-pulse rounded-field bg-rule" />
          <div className="min-w-0 flex-1">
            <div className="h-4 w-[38%] animate-pulse rounded-full bg-rule" />
            <div className="mt-2 h-3 w-[22%] animate-pulse rounded-full bg-wash" />
          </div>
          <div className="h-11 w-28 shrink-0 animate-pulse rounded-full bg-wash" />
        </div>
      ))}
      <div className="flex items-center justify-center gap-3 bg-paper-2 py-4">
        <LoaderCircle className="h-5 w-5 animate-spin text-muted" aria-hidden="true" />
        <p className="text-[15px] text-muted">Fetching your {noun}…</p>
      </div>
    </Card>
  );
}

/**
 * Something went wrong.
 *
 * The reassurance is deliberate. Somebody who has just filled in a form and
 * seen an error assumes they have destroyed something; saying plainly that
 * nothing was lost is most of what this screen is for. Then two ways out, not
 * one — a retry for a blip, and a route off the screen for an outage.
 */
export function ErrorState({ onRetry, onGoToDashboard, noun = "records" }) {
  return (
    <Frame>
      <StateIcon icon={<CloudOff />} tone="red" />
      <Heading>We could not reach the system</Heading>
      <Body>
        Your {noun} could not be loaded, and nothing you have done was lost. This is almost
        always the internet connection rather than anything you did.
      </Body>
      <Actions>
        {onRetry && (
          <Button variant="cobalt" size="lg" onClick={onRetry}>
            <RotateCw className="h-5 w-5" />
            Try again
          </Button>
        )}
        {onGoToDashboard && (
          <Button variant="outline" size="lg" onClick={onGoToDashboard}>
            Go to the dashboard
          </Button>
        )}
      </Actions>
    </Frame>
  );
}

/**
 * Not allowed.
 *
 * "This screen is not part of your job" instead of "You don't have access to
 * this screen" — the second reads as an accusation and leaves the person
 * wondering whether something is broken. This one names their role, says what
 * that role does reach, and tells them who can change it.
 */
export function NotAllowedState({ role, onGoToDashboard, onSignOut }) {
  return (
    <Frame>
      <StateIcon icon={<ShieldAlert />} tone="amber" />
      <Heading>{NOT_ALLOWED_TITLE}</Heading>
      <Body>
        {role ? (
          <>
            Your account is set up as <strong className="font-bold text-ink">{roleLabel(role)}</strong>,
            and this screen belongs to someone else&rsquo;s work. If you need it, an
            administrator can change what your account does.
          </>
        ) : (
          <>
            Nobody has set up what your account does yet, so nothing is open to it. An
            administrator needs to give your account a job before you can get in.
          </>
        )}
      </Body>
      <Actions>
        {onGoToDashboard && (
          <Button variant="cobalt" size="lg" onClick={onGoToDashboard}>
            Back to the dashboard
          </Button>
        )}
        {onSignOut && (
          <Button variant="outline" size="lg" onClick={onSignOut}>
            Sign out
          </Button>
        )}
      </Actions>
    </Frame>
  );
}

/** A record that has gone away — deleted, or a stale selection after a reload. */
export function NotFoundState({ noun, onBack }) {
  return (
    <Frame>
      <StateIcon icon={<Inbox />} />
      <Heading>That {noun} is not here any more</Heading>
      <Body>
        It may have been removed, or the link you followed is out of date. The list will
        show you what is there now.
      </Body>
      <Actions>
        <Button variant="outline" size="lg" onClick={onBack}>
          Back to the list
        </Button>
      </Actions>
    </Frame>
  );
}

/**
 * The per-container empty state — a board column with nothing in it, a panel
 * with no rows.
 *
 * Empty states are per-container, not per-page: a deliveries board with one
 * empty column should not replace the whole board with an empty state, and a
 * column left blank reads as a rendering fault rather than as "nothing due
 * today".
 */
export function EmptySlot({ children, className }) {
  return (
    <p
      className={cn(
        "px-4 py-6 text-center text-[14px] text-muted-2",
        className
      )}
    >
      {children}
    </p>
  );
}
