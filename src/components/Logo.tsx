import { LOGO_PATHS, LOGO_VIEWBOX } from "@/lib/logo";

export default function Logo({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width={LOGO_VIEWBOX.w}
      height={LOGO_VIEWBOX.h}
      viewBox={`0 0 ${LOGO_VIEWBOX.w} ${LOGO_VIEWBOX.h}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="7TECH"
    >
      {LOGO_PATHS.map((d) => (
        <path key={d.slice(0, 12)} d={d} fill="currentColor" />
      ))}
    </svg>
  );
}
