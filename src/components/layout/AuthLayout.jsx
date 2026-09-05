import logo from "../../assets/Logo-128.png";
import { cn } from "@/lib/utils";

/**
 * The shell behind every screen you can reach without signing in: sign in,
 * forgot password, choose a new password.
 *
 * TWO PANELS. The left one is navy and 44% wide, and it earns that space by
 * carrying a real product photograph rather than a boxed monogram — this is a
 * business that makes physical, visible things, and the sign-in screen is the
 * one place the software gets to say so. The slot is dashed and labelled with
 * the size it wants, because real photography is one of the handoff's open
 * questions and a stock image of somebody else's styrofoam would be worse than
 * an honest placeholder.
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
export default function AuthLayout({ children, width = 420 }) {
  return (
    <div className="flex min-h-screen w-full items-stretch bg-paper">
      <div className="relative hidden w-[44%] shrink-0 flex-col justify-between overflow-hidden bg-navy p-10 text-white lg:flex">
        <div className="flex items-center gap-3.5">
          <img src={logo} alt="" className="size-12 shrink-0 rounded-field object-cover" />
          <div>
            <p className="text-[18px] font-extrabold leading-tight">LSB Handicrafts</p>
            <p className="pt-0.5 text-[11px] font-bold uppercase tracking-[0.13em] text-white/60">
              Management system
            </p>
          </div>
        </div>

        <div className="flex flex-1 items-center py-9">
          <div
            className="flex w-full items-center justify-center rounded-card border border-dashed border-white/[0.34]"
            style={{
              aspectRatio: "4 / 3",
              backgroundImage:
                "repeating-linear-gradient(135deg, rgba(255,255,255,.06) 0 8px, transparent 8px 16px)",
            }}
          >
            <p className="text-center font-mono text-[12.5px] leading-[1.6] tracking-[0.05em] text-white/[0.72]">
              workshop / product photo
              <br />
              1600 × 1200
            </p>
          </div>
        </div>

        <div>
          <p className="max-w-[340px] text-[18px] font-semibold leading-[1.55]">
            Styrofoam decor made in Davao City — centrepieces, wall art, stage backdrops,
            custom sculptures.
          </p>
          <p className="pt-4.5 text-[12px] font-bold uppercase tracking-[0.13em] text-white/[0.55]">
            Staff access only
          </p>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center px-6 py-10 tab:px-8">
        <div className={cn("w-full")} style={{ maxWidth: width }}>
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
