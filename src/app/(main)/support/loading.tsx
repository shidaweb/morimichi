export default function SupportLoading() {
  return (
    <div className="space-y-4">
      <div className="h-8 w-28 animate-pulse rounded bg-muted" />
      <div className="space-y-3 rounded-lg border border-border p-4">
        <div className="h-5 w-2/5 animate-pulse rounded bg-muted" />
        <div className="h-4 w-full animate-pulse rounded bg-muted" />
        <div className="h-4 w-4/5 animate-pulse rounded bg-muted" />
      </div>
      <div className="space-y-3 rounded-lg border border-border p-4">
        <div className="h-5 w-1/3 animate-pulse rounded bg-muted" />
        <div className="h-4 w-full animate-pulse rounded bg-muted" />
      </div>
    </div>
  );
}
