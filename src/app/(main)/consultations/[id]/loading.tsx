export default function ConsultationDetailLoading() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="h-6 w-24 animate-pulse rounded bg-muted" />
      <div className="h-8 w-4/5 animate-pulse rounded bg-muted" />
      <div className="space-y-3 rounded-xl border border-border bg-card/60 p-4">
        <div className="h-4 w-full animate-pulse rounded bg-muted" />
        <div className="h-4 w-full animate-pulse rounded bg-muted" />
        <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
      </div>
      <div className="space-y-3 rounded-xl border border-border p-4">
        <div className="h-5 w-28 animate-pulse rounded bg-muted" />
        <div className="h-16 w-full animate-pulse rounded bg-muted" />
      </div>
    </div>
  );
}
