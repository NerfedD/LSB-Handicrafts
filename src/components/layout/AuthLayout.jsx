import { useEffect, useState } from "react";

import logo from "../../assets/Logo-128.png";
import workshopStock from "../../assets/workshop-stock.jpg";
import workshopStore from "../../assets/workshop-store.webp";
import workshopBench from "../../assets/workshop-bench.jpg";
import { cn } from "@/lib/utils";

/**
 * The shell behind every screen you can reach without signing in: sign in,
 * forgot password, choose a new password.
 *
 * TWO PANELS. The left one is navy and 44% wide, and it earns that space by
 * carrying the workshop itself: three real photographs of LSB's own floor --
 * the stacked sheets and columns, the store room, the bench where the balls
 * are cut. This is a business that makes physical, visible things, and the
 * sign-in screen is the one place the software gets to say so.
 *
 * The photographs fill the panel edge to edge under a navy wash that is
 * deepest at the top and the foot, where the name and the tagline sit, so the
 * white type keeps its contrast whichever photograph is behind it.
 *
 * THE MOTION is this screen's one authored moment, and it keeps the house
 * rules in index.css: opacity and transform only. Each photograph cross-fades
 * into the next and drifts very slowly while it is up. The three bars at the
 * foot are both the timer and the control: picking one shows that photograph
 * and stops the rotation for good, which is the way to stop moving content
 * that WCAG 2.2.2 asks for. The rotation also stops while the tab is hidden,
 * and never starts on a device that asks for reduced motion -- that person
 * gets the first photograph, still, and the bars to look at the others.
 *
 * The panel hides below 1024px rather than shrinking. A 44% brand column on a
 * phone leaves the form in a gutter, and the form is the only thing on this
 * screen anybody actually needs.
 *
 * "STAFF ACCESS ONLY" is at the foot for a practical reason as much as a
 * decorative one: this is an internal system with no public sign-up, and
 * somebody who has found it by accident should be told so before they start
 * guessing passwords.
 */
const PHOTOS = [
  // `origin` is where each one's slow drift settles, chosen per photograph so
  // the movement ends on its subject rather than on an empty corner.
  { src: workshopStock, position: "50% 50%", origin: "30% 40%" },
  { src: workshopStore, position: "50% 60%", origin: "60% 70%" },
  { src: workshopBench, position: "30% 50%", origin: "25% 45%" },
];
const HOLD_MS = 6500;

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

function useWorkshopPhotos() {
  const [active, setActive] = useState(0);
  const [previous, setPrevious] = useState(null);
  // Off for good once somebody picks a photograph, and from the start on a
  // device that asks for less motion.
  const [rotating, setRotating] = useState(() => !prefersReducedMotion());

  useEffect(() => {
    if (!rotating) return undefined;
    let timer = null;
    const start = () => {
      clearInterval(timer);
      timer = setInterval(() => {
        setActive((current) => {
          setPrevious(current);
          return (current + 1) % PHOTOS.length;
        });
      }, HOLD_MS);
    };
    // A hidden tab runs nothing: the loop pauses with it and starts its count
    // again on return, rather than catching up with three cuts in a row.
    const onVisibility = () => (document.hidden ? clearInterval(timer) : start());
    start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [rotating]);

  function pick(index) {
    setRotating(false);
    if (index === active) return;
    setPrevious(active);
    setActive(index);
  }

  return { active, previous, rotating, pick };
}

function PhotoStack({ active, previous }) {
  return (
    <div
      className="lsb-photos-in absolute inset-0"
      role="img"
      aria-label="Photographs of the LSB Handicrafts workshop in Davao City"
    >
      {PHOTOS.map((photo, index) => {
        const shown = index === active;
        return (
          <img
            key={photo.src}
            src={photo.src}
            alt=""
            decoding="async"
            fetchPriority={index === 0 ? "high" : "low"}
            className={cn(
              "absolute inset-0 size-full object-cover transition-opacity ease-in-out [transition-duration:1400ms]",
              shown ? "opacity-100" : "opacity-0",
              // The drift runs on the photograph coming in AND the one going
              // out, so the outgoing one does not snap back to its starting
              // scale halfway through its fade.
              (shown || index === previous) && "lsb-drift"
            )}
            style={{ objectPosition: photo.position, transformOrigin: photo.origin }}
          />
        );
      })}

      {/* The navy wash: deep at the top and the foot where the type sits,
          thinner through the middle where the photograph is the point. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgb(14 47 92 / 0.92) 0%, rgb(14 47 92 / 0.45) 22%, rgb(14 47 92 / 0.15) 46%, rgb(14 47 92 / 0.55) 68%, rgb(14 47 92 / 0.96) 100%)",
        }}
      />
    </div>
  );
}

function PhotoBars({ active, rotating, pick }) {
  return (
    <div className="flex gap-2 pt-4" role="group" aria-label="Workshop photographs">
      {PHOTOS.map((photo, index) => (
        <button
          key={photo.src}
          type="button"
          // Not "Show photograph…": the password field's reveal button is
          // "Show", and two controls answering to the same word on one form
          // is a guess for anybody navigating by name. aria-pressed says
          // which one is up.
          aria-label={`Photograph ${index + 1} of ${PHOTOS.length}`}
          aria-pressed={index === active}
          onClick={() => pick(index)}
          // 44px tall to be pressable; the bar itself is 3px of it.
          className="group flex h-11 w-14 items-center rounded-btn"
        >
          <span className="relative block h-[3px] w-full overflow-hidden rounded-full bg-white/25 transition-colors duration-150 group-hover:bg-white/45">
            {index === active && (
              <span
                // Keyed on the photograph, so the fill restarts with each one.
                key={`${active}-${rotating}`}
                className={cn(
                  "absolute inset-0 origin-left rounded-full bg-white",
                  rotating && "lsb-photo-timer"
                )}
                style={rotating ? { animationDuration: `${HOLD_MS}ms` } : undefined}
              />
            )}
          </span>
        </button>
      ))}
    </div>
  );
}

export default function AuthLayout({ children, width = 420 }) {
  const photos = useWorkshopPhotos();

  return (
    <div className="flex min-h-screen w-full items-stretch bg-paper">
      <div className="relative hidden w-[44%] shrink-0 flex-col overflow-hidden bg-navy p-10 text-white lg:flex">
        <PhotoStack active={photos.active} previous={photos.previous} />

        <div className="lsb-auth-late relative flex items-center gap-3.5">
          <img src={logo} alt="" className="size-12 shrink-0 rounded-field object-cover" />
          <div>
            <p className="text-[18px] font-extrabold leading-tight">LSB Handicrafts</p>
            <p className="pt-0.5 text-[11px] font-bold uppercase tracking-[0.13em] text-white/70">
              Management system
            </p>
          </div>
        </div>

        <div className="lsb-auth-late relative mt-auto">
          <p className="max-w-[360px] text-[20px] font-bold leading-[1.45] tracking-[-0.01em]">
            Styrofoam decor made in Davao City — centrepieces, wall art, stage backdrops,
            custom sculptures.
          </p>
          <p className="pt-4.5 text-[12px] font-bold uppercase tracking-[0.13em] text-white/70">
            Staff access only
          </p>
          <PhotoBars active={photos.active} rotating={photos.rotating} pick={photos.pick} />
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center px-6 py-10 tab:px-8">
        {/* lsb-auth-enter: the form's parts arrive one after another, once,
            when the screen opens. See index.css. */}
        <div className="lsb-auth-enter w-full" style={{ maxWidth: width }}>
          {/* Below 1024px the navy panel is gone, and with it the only place
              the screen said whose system this is and that it is staff-only.
              A phone -- which is where delivery crew sign in -- showed a bare
              "Sign in" form belonging to nobody. The compact row puts both
              back without the panel's width. */}
          <div className="mb-9 flex items-center gap-3 lg:hidden">
            <img src={logo} alt="" className="size-11 shrink-0 rounded-field object-cover" />
            <div className="min-w-0">
              <p className="text-[17px] font-extrabold leading-tight text-ink">LSB Handicrafts</p>
              <p className="pt-0.5 text-[10.5px] font-bold uppercase tracking-[0.13em] text-muted">
                Management system · Staff access only
              </p>
            </div>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

/**
 * The segmented progress bar on the forgot-password flow: three 8px bars, the
 * done ones cobalt.
 *
 * A three-step flow with no progress indicator is a flow of unknown length,
 * and "how many more of these are there" is the question that makes somebody
 * abandon a password reset and phone the office instead.
 */
export function StepBar({ step, steps = 3, className }) {
  return (
    <div className={cn("flex gap-2", className)} role="img" aria-label={`Step ${step} of ${steps}`}>
      {Array.from({ length: steps }).map((_, index) => (
        <div
          key={index}
          className={cn(
            "h-2 flex-1 rounded-full",
            index < step ? "bg-cobalt" : "bg-rule"
          )}
        />
      ))}
    </div>
  );
}
