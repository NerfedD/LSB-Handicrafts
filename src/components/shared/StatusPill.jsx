/**
 * Dot-and-label status chip used on the Dashboard's user table and the product
 * screens (Figma 158:250 / 158:282, 172:2119).
 *
 * The existing shared/StatusDotLabel is the dark workspace's flavour of this;
 * these are the management-system colours (#287a55 / #b54747 / slate) and the
 * pill border the design gives them, so they stay separate rather than one
 * component growing a theme prop.
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

export default function StatusPill({ status }) {
  const tone = TONES[status] ?? TONES.Inactive;
  const dot = DOTS[status] ?? DOTS.Inactive;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-[3px] text-[12px] font-medium ${tone}`}
    >
      <span className={`size-[5px] rounded-sm ${dot}`} />
      {status}
    </span>
  );
}
