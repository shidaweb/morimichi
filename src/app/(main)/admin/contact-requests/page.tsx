import { AdminContactRequestsClient } from "./AdminContactRequestsClient";

export default function AdminContactRequestsPage() {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold tracking-tight">相談リクエスト</h2>
      <AdminContactRequestsClient />
    </div>
  );
}
