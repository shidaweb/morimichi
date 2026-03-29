# Claude ↔ Cursor MCP双方向連携 セットアップガイド

## 全体像

```
┌─────────────────┐                          ┌─────────────────┐
│                  │     dispatch_task        │                  │
│   Claude         │    ─────────────→       │   Cursor         │
│   (アーキテクト)  │                          │   (実装者)        │
│                  │     report_result        │                  │
│   - 設計         │    ←─────────────       │   - コーディング  │
│   - レビュー     │                          │   - テスト        │
│   - 承認         │     send_feedback        │   - デバッグ      │
│   - 修正指示     │    ─────────────→       │                  │
│                  │                          │                  │
└────────┬────────┘                          └────────┬────────┘
         │              ┌──────────┐                  │
         └──── MCP ────→│  Task    │←──── MCP ────────┘
                        │  Bridge  │
                        │  Server  │
                        └────┬─────┘
                             │
                      .bridge/
                      ├── tasks/      ← タスクキュー
                      ├── results/    ← 実行結果
                      └── state.json  ← 全体進捗
```

## Claude の役割（アーキテクト）

| ツール | 説明 |
|--------|------|
| `dispatch_task` | Phase ごとにタスクを投入 |
| `dispatch_phase_batch` | Phase 内の全タスクを一括投入 |
| `review_results` | Cursor の実装結果をレビュー |
| `send_feedback` | 承認 or 修正指示 |
| `get_dashboard` | 全体進捗確認 |

## Cursor の役割（実装者）

| ツール | 説明 |
|--------|------|
| `get_next_task` | 次のタスクを取得 |
| `report_result` | 実装結果を報告 |
| `get_dashboard` | 全体進捗確認 |

---

## セットアップ手順

### Step 1: MCP Task Bridge をプロジェクトに配置

```bash
# morimichi プロジェクトのルートで実行
cp -r mcp-task-bridge/ /path/to/morimichi/mcp-task-bridge/
cd /path/to/morimichi/mcp-task-bridge
npm install
```

### Step 2: .cursorrules をプロジェクトルートに配置

```bash
cp .cursorrules /path/to/morimichi/.cursorrules
```

### Step 3: Cursor に MCP サーバーを登録

Cursor の Settings → MCP Servers で以下を追加:

```json
{
  "task-bridge": {
    "command": "node",
    "args": ["/path/to/morimichi/mcp-task-bridge/src/server.js"],
    "env": {
      "BRIDGE_DIR": "/path/to/morimichi/.bridge"
    }
  }
}
```

※ `/path/to/morimichi/` は実際のパスに置き換えてください。

### Step 4: Claude Code に MCP サーバーを登録

```bash
# Claude Code の設定ファイル（~/.claude.json または プロジェクトの .claude/settings.json）に追加:
claude mcp add task-bridge node /path/to/morimichi/mcp-task-bridge/src/server.js
```

または、`claude_mcp_config.json` の内容を Claude Code の設定にマージ。

### Step 5: .gitignore に追加

```bash
echo ".bridge/" >> /path/to/morimichi/.gitignore
```

### Step 6: 仕様書MDをプロジェクトに配置

```bash
# 既存の MD ファイルをプロジェクトの docs/ に配置
mkdir -p /path/to/morimichi/docs
cp cursor_full_implementation_instructions.md /path/to/morimichi/docs/
cp jigyou_saisei_community_MVP_spec_v3.md /path/to/morimichi/docs/
# ... 他のMDも同様
```

---

## 使い方

### 方法A: Claude から Phase を一括投入 → Cursor が順次実行

これが最も効率的な使い方です。

#### 1. Claude に以下を指示:

```
morimichi の cursor_full_implementation_instructions.md を読んで、
Phase 1 のタスクを dispatch_phase_batch で投入してください。
```

Claude が MCP 経由で Task Bridge にタスクを投入します。

#### 2. Cursor に以下を指示:

```
get_next_task でタスクを取得して実装してください。
完了したら report_result で報告してください。
タスクがなくなるまで繰り返してください。
```

Cursor はタスクを順次取得 → 実装 → 報告 を繰り返します。

#### 3. Claude にレビューを依頼:

```
review_results で Phase 1 の結果を確認し、
問題があれば send_feedback で修正指示を出してください。
```

Claude が結果をレビューし、必要に応じて修正タスクを作成します。

#### 4. 次の Phase へ:

```
Phase 1 が完了したので、Phase 2 のタスクを投入してください。
```

### 方法B: 対話的に進める

1. Claude: 「Phase 1-1 のDBマイグレーションタスクを投入して」
2. Cursor: 「タスクを取得して実装、報告」
3. Claude: 「結果を確認… avatar_url の型が違う、修正して」
4. Cursor: 「修正タスクを取得、修正、報告」
5. Claude: 「OK、承認。次の 1-2 を投入」

### 方法C: 自動運転（上級）

Claude に以下のような包括的な指示を出すと、半自動で進みます:

```
morimichi の全未実装機能を Phase 1 から順に実装してください。

手順:
1. cursor_full_implementation_instructions.md の Phase 1 のタスクを dispatch_phase_batch で投入
2. 60秒待ってから review_results で進捗確認
3. 全タスクが completed になるまで待つ（in_progress があれば再確認）
4. failed や needs_fix があれば send_feedback で修正指示
5. Phase 1 が全完了したら Phase 2 に進む
6. これを Phase 11 まで繰り返す
```

---

## 対話例

### Claude 側の会話

```
あなた: Phase 1 のプロフィール拡張を開始して

Claude: dispatch_phase_batch を呼びます...
  Phase 1 に 6件のタスクを投入しました:
  - task_xxx1: DB マイグレーション
  - task_xxx2: アバターアップロード API
  - task_xxx3: クライアントサイド画像リサイズ
  - task_xxx4: コンポーネント実装
  - task_xxx5: マイページリニューアル
  - task_xxx6: 公開プロフィールページ

  Cursor に切り替えて「get_next_task で作業を開始して」と指示してください。
```

### Cursor 側の会話

```
あなた: get_next_task で作業を開始して。完了したら report_result で報告して。

Cursor: get_next_task を呼びます...
  タスク "DB マイグレーション" (Phase 1) を取得しました。
  実装を開始します...

  [SQL を実行、カラム追加、Storage バケット作成...]

  report_result を呼びます...
  結果: completed
  変更ファイル: supabase/migrations/20260329_add_profile_fields.sql
  テスト: Supabase ダッシュボードでカラム確認済み

  次のタスクを取得します...
  タスク "アバターアップロード API" (Phase 1) を取得しました...
```

### Claude に戻ってレビュー

```
あなた: Phase 1 の進捗を確認して

Claude: review_results を呼びます...
  Phase 1: 6/6 completed

  確認結果:
  - ✅ DB マイグレーション: OK
  - ✅ アバター API: OK
  - ⚠️ コンポーネント実装: UserAvatar に loading="lazy" が抜けている

  send_feedback で修正指示を出します...
  修正タスク task_xxx7 を作成しました。Cursor に実行させてください。
```

---

## Tips

1. **Cursor に .cursorrules を活用させる**: プロジェクトルートに配置すれば Cursor は自動で読み込みます
2. **タスク粒度は小さく**: 1タスク = 1ファイル or 1機能が理想。大きすぎると報告が曖昧になります
3. **テスト項目を必ず含める**: `test_criteria` に具体的なテスト項目を書くと、Cursor が自発的にテストします
4. **GitHub との連携**: 各 Phase 完了時に `git commit` → PR を作ると管理しやすい
5. **.bridge/ は gitignore**: タスク状態はローカルのみで管理

---

## トラブルシューティング

| 問題 | 対処 |
|------|------|
| MCP サーバーが見つからない | `node mcp-task-bridge/src/server.js` を直接実行して動作確認 |
| Cursor が get_next_task を使えない | Cursor Settings → MCP で task-bridge が有効か確認 |
| タスクが stuck（in_progress のまま） | `.bridge/tasks/` 内の JSON を直接編集して status を pending に戻す |
| 全リセットしたい | `rm -rf .bridge/` で初期化 |

---

*version: 1.0 | 作成日: 2026年3月29日*
