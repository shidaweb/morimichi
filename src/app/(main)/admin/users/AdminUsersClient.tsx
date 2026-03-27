"use client";

import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import type { UserRole, UserStatus } from "@/types/database";

type ProfileRow = {
  user_id: string;
  nickname: string;
  role: UserRole;
  status: UserStatus;
  created_at: string;
};

const ROLE_LABEL: Record<UserRole, string> = {
  consulter: "相談者",
  advisor: "アドバイザー",
  both: "両方",
  moderator: "モデレーター",
  admin: "管理者",
};

const STATUS_LABEL: Record<UserStatus, string> = {
  active: "有効",
  suspended: "停止",
  banned: "利用禁止",
  withdrawn: "退会",
};

export function AdminUsersClient() {
  const [users, setUsers] = useState<ProfileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/users");
      const data = (await res.json()) as { users?: ProfileRow[]; error?: string };
      if (!res.ok) {
        setError(data.error ?? "読み込みに失敗しました");
        return;
      }
      setUsers(data.users ?? []);
    } catch {
      setError("読み込みに失敗しました");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && users.length === 0) {
    return <p className="text-muted-foreground text-sm">読み込み中…</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-semibold tracking-tight">ユーザー一覧</h2>
        <Button type="button" variant="outline" size="sm" onClick={() => void load()}>
          再読み込み
        </Button>
      </div>

      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}

      {users.length === 0 ? (
        <p className="text-muted-foreground text-sm">ユーザーがいません。</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">登録日</th>
                <th className="px-3 py-2 font-medium">ニックネーム</th>
                <th className="px-3 py-2 font-medium">ロール</th>
                <th className="px-3 py-2 font-medium">状態</th>
                <th className="px-3 py-2 font-medium">ユーザーID</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.user_id} className="border-t border-border">
                  <td className="px-3 py-2 whitespace-nowrap text-xs">
                    {new Date(u.created_at).toLocaleString("ja-JP")}
                  </td>
                  <td className="px-3 py-2">{u.nickname}</td>
                  <td className="px-3 py-2 text-xs">{ROLE_LABEL[u.role]}</td>
                  <td className="px-3 py-2 text-xs">{STATUS_LABEL[u.status]}</td>
                  <td className="text-muted-foreground px-3 py-2 font-mono text-xs">
                    {u.user_id}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
