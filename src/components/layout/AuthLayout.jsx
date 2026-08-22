/**
 * Shared shell for the public auth screens (Login, Forgot Password, Verify
 * Identity, Reset Password): dark brand sidebar on the left, gradient panel
 * with a white card on the right.
 */
export default function AuthLayout({ children, cardClassName = "" }) {
  return (
    <div className="flex min-h-screen w-full items-stretch bg-[#f7f4ec]">
      {/* Left panel — brand */}
      <div className="relative hidden w-[42%] flex-col justify-between overflow-hidden bg-[#17263a] px-12 py-13 lg:flex">
        <div className="relative w-fit rounded-md border border-white/[0.14] bg-white/[0.03] px-7 py-6">
          <span className="absolute left-3 top-3 text-white/40">+</span>
          <span className="absolute right-3 top-3 text-white/40">+</span>
          <span className="absolute bottom-3 left-3 text-white/40">+</span>
          <span className="absolute bottom-3 right-3 text-white/40">+</span>
          <div className="flex flex-col items-center gap-1 px-6">
            <span className="text-3xl font-bold tracking-tight text-white">
              LSB
            </span>
            <div className="h-px w-16 bg-white/40" />
            <span className="text-[10px] tracking-[2px] text-white/70">
              HANDICRAFTS
            </span>
          </div>
        </div>

        <div className="flex flex-1 items-center">
          <p className="max-w-[290px] text-justify text-[15px] leading-relaxed text-white/50">
            Your styrofoam specialist in creating unique decor pieces! From
            event centerpieces and wall art to stage backdrops and custom
            sculptures. Based in Davao City.
          </p>
        </div>

        <p className="text-[11px] uppercase tracking-[1.4px] text-white/30">
          The official LSB internal system
        </p>
      </div>

      {/* Right panel — card */}
      <div className="relative flex flex-1 items-center justify-center bg-[linear-gradient(145deg,#ddd8c8_8%,#e8e4d8_25%,#f0edE4_50%,#e9e5da_75%,#dfd9cb_92%)] px-6 py-12">
        <div
          className={`w-full max-w-[460px] rounded-2xl border border-[#17263a0f] bg-white p-8 shadow-[0_8px_24px_rgba(17,30,50,0.12),0_2px_4px_rgba(17,30,50,0.07)] sm:p-12 ${cardClassName}`}
        >
          <div>
            <p className="text-xs font-semibold uppercase tracking-[2.4px] text-[#17263a]">
              LSB Handicrafts
            </p>
            <div className="mt-2 h-px w-[120px] bg-gradient-to-r from-[#e8dcc8] to-transparent" />
          </div>

          {children}

          <div className="mt-11 flex flex-col items-center gap-3">
            <div className="h-px w-8 bg-[#5f687533]" />
            <p className="text-[12.5px] tracking-[0.25px] text-[#5f687588]">
              LSB Handicrafts · Internal Management System
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}