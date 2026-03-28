import { cn } from "@/lib/utils";
import type { ProSpecialtyBadge } from "@/lib/pro/pro-specialty-badge";

export type CertifiedProBadgeProps = {
  specialty?: ProSpecialtyBadge | null;
  size?: "sm" | "md" | "lg";
  showSpecialty?: boolean;
  className?: string;
};

const sizeMap = {
  sm: "text-[10px] px-1.5 py-0.5 gap-0.5",
  md: "text-xs px-2 py-0.5 gap-1",
  lg: "text-sm px-3 py-1 gap-1",
};

export function CertifiedProBadge({
  specialty,
  size = "md",
  showSpecialty = true,
  className,
}: CertifiedProBadgeProps) {
  return (
    <span className={cn("inline-flex max-w-full flex-wrap items-center gap-1.5", className)}>
      <span
        className={cn(
          "inline-flex shrink-0 items-center rounded-full font-medium",
          "border border-amber-400/50 bg-gradient-to-r from-amber-200 via-yellow-300 to-amber-200",
          "text-amber-900 shadow-sm",
          sizeMap[size],
        )}
      >
        <span aria-hidden>🏆</span>
        <span className="whitespace-nowrap">公認再生プロ</span>
      </span>
      {showSpecialty && specialty ? (
        <span
          className={cn(
            "inline-flex shrink-0 items-center rounded-full font-medium",
            "border border-stone-200 bg-stone-100 text-stone-700",
            sizeMap[size],
          )}
        >
          {specialty.icon ? <span aria-hidden>{specialty.icon}</span> : null}
          <span className="whitespace-nowrap">{specialty.name}</span>
        </span>
      ) : null}
    </span>
  );
}
