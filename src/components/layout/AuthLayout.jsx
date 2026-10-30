import { useEffect, useState } from "react";

import logo from "../../assets/Logo-128.png";
import workshopStock from "../../assets/workshop-stock.webp";
import workshopStore from "../../assets/workshop-store.webp";
import workshopBench from "../../assets/workshop-bench.webp";
import { cn } from "@/lib/utils";

/**
 * The signed-out layout, drawn to the "1 · Login" and "1b · Forgot password"
 * boards: the workshop photo panel on the left (44%, from 1024px up) and the
 * card centred on --background to its right, with the compact brand row
 * above it where the panel is hidden and a © line under it.
 *
 * The photographs cross-fade on their own, 6.5 seconds each, and stop when
 * somebody picks one, when the tab is hidden, and under reduced motion.
 */
const PHOTOS = [
  { src: workshopStock, position: "50% 50%", origin: "30% 40%" },
  { src: workshopStore, position: "50% 60%", origin: "60% 70%" },
  { src: workshopBench, position: "30% 50%", origin: "25% 45%" },
];
const HOLD_MS = 6500;

const prefersReducedMotion = () =>
  typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

function useWorkshopPhotos() {
  const [active, setActive] = useState(0);
  const [rotating, setRotating] = useState(() => !prefersReducedMotion());

  useEffect(() => {
    if (!rotating) return undefined;
    let timer = null;
    const start = () => {
      clearInterval(timer);
      timer = setInterval(() => setActive((current) => (current + 1) % PHOTOS.length), HOLD_MS);
    };
    const onVisibility = () => (document.hidden ? clearInterval(timer) : start());
    start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [rotating]);

  const pick = (index) => {
    setRotating(false);
    setActive(index);
  };
  return { active, rotating, pick };
}

function PhotoPanel() {
  const { active, rotating, pick } = useWorkshopPhotos();
  return (
    <aside aria-label="LSB Handicrafts" className="lsb-panel relative hidden shrink-0 basis-[44%] flex-col overflow-hidden p-10 text-on-primary lg:flex">
      <div role="img" aria-label="Photographs of the LSB Handicrafts workshop in Davao City" className="absolute inset-0">
        {PHOTOS.map((photo, index) => (
          <img
            key={photo.src}
            src={photo.src}
            alt=""
            decoding="async"
            loading="lazy"
            fetchPriority={index === 0 ? "high" : "low"}
            className={cn(
              "absolute inset-0 size-full object-cover transition-[opacity,transform] duration-1400 ease-in-out",
              index === active ? "scale-[1.04] opacity-100" : "scale-100 opacity-0"
            )}
            style={{ objectPosition: photo.position, transformOrigin: photo.origin }}
          />
        ))}
        <div className="lsb-panel-wash absolute inset-0" />
      </div>

      <div className="relative flex items-center gap-3.5">
        <img src={logo} alt="" className="size-12 shrink-0 rounded-lg object-cover" />
        <div>
          <p className="m-0 text-lg font-semibold leading-[22px]">LSB Handicrafts</p>
          <p className="lsb-panel-caption m-0 mt-0.5 text-[11px] font-semibold uppercase leading-[14px] tracking-[0.13em]">Management system</p>
        </div>
      </div>

      <div className="relative mt-auto">
        <p className="m-0 max-w-[380px] text-xl font-medium leading-[29px] tracking-[-0.01em]">
          Styrofoam decor made in Davao City — centrepieces, wall art, stage backdrops, custom sculptures.
        </p>
        <p className="lsb-panel-caption m-0 mt-[18px] text-xs font-semibold uppercase tracking-[0.13em]">Staff access only</p>
        <div role="group" aria-label="Workshop photographs" className="flex gap-2 pt-3">
          {PHOTOS.map((photo, index) => (
            <button
              key={photo.src}
              type="button"
              aria-label={`Photograph ${index + 1} of ${PHOTOS.length}`}
              aria-pressed={index === active}
              onClick={() => pick(index)}
              className="flex h-11 w-14 items-center rounded-md"
            >
              <span className="lsb-panel-track relative block h-[3px] w-full overflow-hidden rounded-[3px]">
                {index === active ? (
                  <span
                    key={`${active}-${rotating}`}
                    className={cn("absolute inset-0 origin-left rounded-[3px] bg-card", rotating && "lsb-photo-timer")}
                    style={rotating ? { animationDuration: `${HOLD_MS}ms` } : undefined}
                  />
                ) : null}
              </span>
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
}

export default function AuthLayout({ children }) {
  return (
    <div className="flex min-h-svh items-stretch bg-background text-sm text-foreground">
      <PhotoPanel />
      <div className="flex min-w-0 flex-1 flex-col items-center justify-center gap-6 px-4 py-12">
        <div className="flex items-center gap-2.5 lg:hidden">
          <img src={logo} alt="" className="size-8 rounded-md object-cover" />
          <span className="flex flex-col">
            <span className="text-sm font-semibold leading-[18px]">LSB Handicrafts</span>
            <span className="text-xs text-muted-fg">Management system · Staff access only</span>
          </span>
        </div>
        {children}
        <p className="m-0 text-xs text-muted-fg">© {new Date().getFullYear()} LSB Handicrafts</p>
      </div>
    </div>
  );
}

/**
 * The sign-in card: 24px in, a 20/28 title and 13/18 muted description, the
 * form 20px below, and a ruled-off footer note. `step` draws the three 4px
 * progress bars the password-reset flow puts above the title.
 */
export function AuthCard({ title, description, step, footer, width = 380, children }) {
  return (
    <main className="w-full rounded-lg border border-border bg-card shadow-xs" style={{ maxWidth: width }}>
      <div className="px-6 pt-6">
        {step ? <StepBar step={step} /> : null}
        <h1 className="m-0 text-xl font-semibold tracking-[-0.01em]">{title}</h1>
        {description ? <p className="m-0 mt-1 text-13 text-muted-fg">{description}</p> : null}
      </div>
      <div className="flex flex-col gap-4 px-6 pb-6 pt-5">{children}</div>
      {footer ? <div className="border-t border-border px-6 py-3 text-13 text-muted-fg">{footer}</div> : null}
    </main>
  );
}

function StepBar({ step, steps = 3 }) {
  return (
    <div role="img" aria-label={`Step ${step} of ${steps}`} className="mb-4 grid grid-cols-3 gap-1.5">
      {Array.from({ length: steps }).map((_, index) => (
        <span key={index} className={cn("h-1 rounded-sm", index < step ? "bg-primary" : "bg-muted-strong")} />
      ))}
    </div>
  );
}
