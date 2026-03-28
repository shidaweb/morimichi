import { AdminProApplicationsClient } from "./AdminProApplicationsClient";

export default function AdminProApplicationsPage() {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold tracking-tight">公認再生プロ申請</h2>
      <AdminProApplicationsClient />
    </div>
  );
}
