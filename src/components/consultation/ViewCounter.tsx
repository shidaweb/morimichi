type Props = {
  count: number;
  className?: string;
};

export function ViewCounter({ count, className }: Props) {
  return (
    <span className={className} title="閲覧数" suppressHydrationWarning>
      👁 {count.toLocaleString("ja-JP")}閲覧
    </span>
  );
}
