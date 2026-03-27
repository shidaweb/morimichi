export default function NewConsultationLoading() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="h-8 w-40 animate-pulse rounded bg-muted" />
      <div className="space-y-3 rounded-xl border border-border p-4">
        <div className="h-10 w-full animate-pulse rounded bg-muted" />
        <div className="h-10 w-full animate-pulse rounded bg-muted" />
        <div className="h-32 w-full animate-pulse rounded bg-muted" />
      </div>
    </div>
  );
}
