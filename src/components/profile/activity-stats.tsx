type Props = {
  totalConsultations: number;
  totalReplies: number;
  totalReactionsReceived: number;
};

export function ActivityStats({
  totalConsultations,
  totalReplies,
  totalReactionsReceived,
}: Props) {
  const stats = [
    { label: "相談", value: totalConsultations },
    { label: "回答", value: totalReplies },
    { label: "共感", value: totalReactionsReceived },
  ];

  return (
    <div className="grid grid-cols-3 gap-3 sm:gap-4">
      {stats.map(({ label, value }) => (
        <div
          key={label}
          className="bg-muted/50 flex flex-col items-center rounded-lg p-3 sm:p-4"
        >
          <span className="text-foreground text-xl font-bold sm:text-2xl">
            {value.toLocaleString("ja-JP")}
          </span>
          <span className="text-muted-foreground text-xs sm:text-sm">{label}</span>
        </div>
      ))}
    </div>
  );
}
