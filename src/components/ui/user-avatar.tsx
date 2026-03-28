import { cn } from "@/lib/utils";

export type UserAvatarSize = "sm" | "md" | "lg" | "xl";

const sizeMap: Record<UserAvatarSize, string> = {
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-12 w-12 text-base",
  xl: "h-24 w-24 text-2xl",
};

const bgColors = [
  "bg-emerald-100 text-emerald-800",
  "bg-amber-100 text-amber-800",
  "bg-sky-100 text-sky-800",
  "bg-rose-100 text-rose-800",
  "bg-violet-100 text-violet-800",
  "bg-teal-100 text-teal-800",
];

type Props = {
  avatarUrl: string | null | undefined;
  nickname: string;
  size?: UserAvatarSize;
  className?: string;
};

/** 公開 URL（クエリは表示時のみ付与可）。src はそのまま渡す */
export function UserAvatar({ avatarUrl, nickname, size = "md", className }: Props) {
  const displayName = nickname.trim() || "?";
  const initial = displayName.charAt(0) || "?";
  const colorIndex = displayName.charCodeAt(0) % bgColors.length;
  const dim = sizeMap[size];

  if (avatarUrl) {
    return (
      <span
        className={cn("relative inline-flex shrink-0 overflow-hidden rounded-full ring-1 ring-border/60", dim, className)}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- 外部ストレージの動的 URL */}
        <img
          src={avatarUrl}
          alt={`${displayName}のアバター`}
          className="aspect-square h-full w-full object-cover"
          loading="lazy"
        />
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold ring-1 ring-border/60",
        dim,
        bgColors[colorIndex],
        className,
      )}
      aria-hidden={initial === "?"}
    >
      {initial}
    </span>
  );
}
