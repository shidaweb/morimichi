# Claude スタータープロンプト

> このプロンプトを Claude Code（またはCowork）に渡すと、
> MCP Task Bridge 経由で Cursor への実装指示を自動投入します。

---

## 初回実行用プロンプト（これをそのままClaudeに貼り付けてください）

```
あなたは morimichi.cc のアーキテクトです。
MCP Task Bridge を使って、Cursor（実装者AI）にタスクを投入し、結果をレビューしてください。

docs/cursor_full_implementation_instructions.md を読んで、Phase 1 から順に実装を進めます。

## あなたのワークフロー

1. dispatch_phase_batch で Phase のタスクを投入
2. get_dashboard で進捗を確認（Cursorが作業中）
3. 全タスクが completed になったら review_results でレビュー
4. 問題があれば send_feedback で修正指示
5. Phase が完了したら次の Phase へ

## まず Phase 1 を開始してください

docs/cursor_full_implementation_instructions.md の Phase 1（プロフィール拡張）を読み、
以下の6つのサブタスクに分割して dispatch_phase_batch で投入してください:

1. DB マイグレーション（profiles カラム追加 + avatars バケット + Storage RLS）
2. アバターアップロード API（POST + DELETE /api/users/me/avatar）
3. クライアントサイド画像リサイズ（Canvas API、200x200 WebP）
4. コンポーネント実装（UserAvatar + AvatarUpload、全表示箇所に配置）
5. マイページ リニューアル（レイアウト + プロフィール編集モーダル）
6. 公開プロフィールページ（/users/:nickname + API）

各タスクの prompt には、MDから該当セクションの詳細な指示を含めてください。
test_criteria には Phase 1 テストのチェック項目を含めてください。
```

---

## Cursor 側プロンプト（Cursorに貼り付けてください）

```
あなたは morimichi.cc の実装を担当する開発AIです。
MCP Task Bridge 経由で Claude（アーキテクト）からタスクが来ています。

以下のループを繰り返してください:

1. get_next_task でタスクを取得
2. タスクの prompt に従って実装
3. test_criteria のテストを実行
4. report_result で結果を報告:
   - status: "completed" or "needs_review"
   - summary: 何を実装したか（具体的に）
   - files_changed: 変更ファイル一覧
   - issues: 問題点があれば記載
   - test_results: テスト結果
5. 1に戻る（タスクがなくなるまで）

★ 実装時は必ず .cursorrules と docs/ の仕様書を参照してください。
★ 不明点がある場合は issues に書いて needs_review で報告してください。
```

---

## Phase 間のレビュー用プロンプト（Claude側）

```
review_results で Phase {N} の結果を確認してください。

確認ポイント:
- 全タスクが completed か
- files_changed に不足がないか
- issues に要対応事項がないか
- test_results がすべてパスしているか

問題があれば send_feedback で修正指示を出してください。
全て問題なければ「Phase {N} 完了。Phase {N+1} のタスクを投入します」と報告し、
次の Phase のタスクを dispatch_phase_batch で投入してください。
```

---

## 全自動運転プロンプト（上級者向け、Claude側）

```
morimichi.cc の全未実装機能を Phase 1〜11 まで順に実装管理してください。

docs/cursor_full_implementation_instructions.md に従い:

1. Phase N のタスクを dispatch_phase_batch で投入
2. get_dashboard で進捗を 30秒おきに確認
3. 全タスク completed になったら review_results でレビュー
4. failed / needs_fix があれば send_feedback で修正指示
5. Phase N の全タスクが approved になったら Phase N+1 へ
6. Phase 11 まで完了したら最終チェックリストを実行

途中で人間の判断が必要な場合は停止して報告してください。
特に:
- DB マイグレーションの実行前
- 環境変数の設定が必要な場合
- デプロイに関わる変更

進捗は各 Phase 完了時に報告してください。
```
