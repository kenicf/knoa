# セッション管理システム

## 概要

セッション管理システムは、AI駆動開発における複数のセッションをまたいだ開発コンテキストの維持を実現するためのシステムです。セッションの状態、変更履歴、課題、アクションアイテムなどを構造化された形式で管理し、セッション間の連続性と追跡可能性を向上させます。

## 主な機能

- **セッション状態の管理**: セッションの開始・終了時刻、タスク状態、重要なファイルなどの管理
- **Git連携**: セッションとGitコミットの関連付け、変更差分の記録
- **課題とアクションアイテムの管理**: 優先度と重要度の2軸での評価、状態管理
- **マークダウン形式の引継ぎドキュメント生成**: カスタマイズ可能なテンプレートを使用

## セッションスキーマ

セッションは以下のスキーマに基づいて構造化されています：

```json
{
  "session_handover": {
    "project_id": "プロジェクトID",
    "session_id": "セッションID（Gitコミットハッシュ）",
    "previous_session_id": "前回のセッションID",
    "session_timestamp": "セッション終了時刻",
    "session_start_timestamp": "セッション開始時刻",
    "project_state_summary": {
      "completed_tasks": ["完了したタスクID"],
      "current_tasks": ["進行中のタスクID"],
      "pending_tasks": ["保留中のタスクID"],
      "blocked_tasks": ["ブロックされているタスクID"]
    },
    "key_artifacts": [
      {
        "path": "ファイルパス",
        "description": "ファイルの説明",
        "last_modified": "最終更新日時",
        "git_status": "Gitの状態",
        "previous_path": "リネーム前のパス",
        "related_tasks": ["関連するタスクID"],
        "importance": "重要度"
      }
    ],
    "git_changes": {
      "commits": [
        {
          "hash": "コミットハッシュ",
          "message": "コミットメッセージ",
          "timestamp": "コミット日時",
          "related_tasks": ["関連するタスクID"],
          "author": "コミット作者"
        }
      ],
      "summary": {
        "files_added": 0,
        "files_modified": 0,
        "files_deleted": 0,
        "lines_added": 0,
        "lines_deleted": 0
      }
    },
    "other_changes": {
      "config_changes": [
        {
          "config_type": "設定タイプ",
          "description": "変更の説明",
          "timestamp": "変更日時"
        }
      ],
      "external_changes": [
        {
          "system": "外部システム名",
          "change_type": "変更タイプ",
          "description": "変更の説明",
          "timestamp": "変更日時"
        }
      ]
    },
    "current_challenges": [
      {
        "description": "課題の説明",
        "related_tasks": ["関連するタスクID"],
        "priority": 3,
        "severity": 3,
        "status": "課題の状態",
        "resolution_plan": "解決計画"
      }
    ],
    "next_session_focus": "次のセッションでの焦点",
    "action_items": [
      {
        "description": "アクションの説明",
        "related_task": "関連するタスクID",
        "priority": 3,
        "severity": 3,
        "due_date": "期限",
        "assignee": "担当者"
      }
    ]
  }
}
```

## セッション管理ユーティリティ

セッション管理ユーティリティ（`SessionManager`）は、セッションの作成、取得、更新、保存などの機能を提供します。

### 主なメソッド

#### セッション基本操作

- **validateSession(session)**: セッションの検証
- **getLatestSession()**: 最新のセッションを取得
- **getSessionById(sessionId)**: セッションIDでセッションを取得
- **createNewSession(previousSessionId)**: 新しいセッションを作成
- **saveSession(session, isLatest)**: セッションを保存

#### Git連携

- **createSessionFromGitCommits(startCommit, endCommit)**: Gitコミットからセッション情報を生成
- **updateSessionWithGitChanges(sessionId, commits)**: セッションをGit変更で更新
- **extractTaskIdsFromCommitMessage(message)**: コミットメッセージからタスクIDを抽出
- **calculateChangeSummary(commits)**: 変更サマリーを計算

#### セッション内容管理

- **addKeyArtifact(sessionId, artifact)**: key_artifactを追加
- **addChallenge(sessionId, challenge)**: 課題を追加
- **addActionItem(sessionId, actionItem)**: アクションアイテムを追加
- **getKeyArtifactCandidates(commits)**: key_artifactの候補を取得
- **linkActionItemsToTasks(sessionId)**: アクションアイテムとタスクを関連付け

#### セッション分析

- **getSessionDiff(sessionId1, sessionId2)**: セッション間の差分を取得
- **generateSessionHandoverMarkdown(sessionId, templateName)**: マークダウン形式の引継ぎドキュメントを生成

## 使用例

### 新しいセッションの作成

```javascript
const { SessionManager } = require('../src/utils/session-manager');

// SessionManagerのインスタンスを作成
const sessionManager = new SessionManager();

// 新しいセッションを作成
const newSession = sessionManager.createNewSession();

// セッションを保存
sessionManager.saveSession(newSession, true);
```

### Gitコミットからセッション情報を生成

```javascript
// 開始コミットと終了コミットを指定してセッション情報を生成
const session = sessionManager.createSessionFromGitCommits('start-commit-hash', 'end-commit-hash');

// セッションを保存
sessionManager.saveSession(session, true);
```

### 課題の追加

```javascript
// 課題を追加
const updatedSession = sessionManager.addChallenge('session-id', {
  description: '新しい課題',
  related_tasks: ['T001'],
  priority: 4,
  severity: 3,
  status: 'in_progress',
  resolution_plan: '解決計画'
});

// 更新されたセッションを保存
sessionManager.saveSession(updatedSession, true);
```

### マークダウン形式の引継ぎドキュメントの生成

```javascript
// マークダウン形式の引継ぎドキュメントを生成
const markdown = sessionManager.generateSessionHandoverMarkdown('session-id');

// マークダウンをファイルに保存
const fs = require('fs');
fs.writeFileSync('session-handover.md', markdown, 'utf8');
```

## 優先度と重要度の2軸管理

課題とアクションアイテムは、優先度と重要度の2軸で評価されます：

### 優先度（Priority）

ビジネス価値や機能的重要性を表します：

- **1**: 最低優先度（あれば便利だが、なくても問題ない）
- **2**: 低優先度（将来的に必要だが、今すぐではない）
- **3**: 中優先度（標準的な優先度）
- **4**: 高優先度（重要な機能や改善）
- **5**: 最高優先度（ビジネスクリティカルな機能）

### 重要度（Severity）

技術的影響や緊急性を表します：

- **1**: 最低重要度（小さな問題、影響が限定的）
- **2**: 低重要度（軽微な問題、回避策がある）
- **3**: 中重要度（標準的な重要度）
- **4**: 高重要度（深刻な問題、大きな影響がある）
- **5**: 最高重要度（クリティカルな問題、即時対応が必要）

### 組み合わせの解釈

- **高優先度・高重要度**: 即時対応が必要
- **高優先度・低重要度**: 重要だが緊急ではない
- **低優先度・高重要度**: 技術的に重要だが、ビジネス価値は低い
- **低優先度・低重要度**: 後回しにできる

## 課題の状態

課題は以下の状態を持ちます：

- **identified**: 特定済み（課題が特定されたが、まだ分析されていない）
- **analyzing**: 分析中（課題の原因や影響を分析中）
- **in_progress**: 対応中（課題の解決に取り組んでいる）
- **resolved**: 解決済み（課題が解決された）
- **wontfix**: 対応しない（課題を解決しないことを決定）

## マークダウンテンプレート

マークダウン形式の引継ぎドキュメントは、テンプレートに基づいて生成されます。テンプレートは `src/templates/docs/session-handover-template.md` に定義されています。

テンプレートでは、以下のようなプレースホルダーを使用できます：

- **{{project_id}}**: プロジェクトID
- **{{session_timestamp}}**: セッションのタイムスタンプ
- **{{session_duration}}**: セッション時間
- **{{session_id}}**: セッションID
- **{{previous_session_id}}**: 前回のセッションID
- **{{completed_tasks_formatted}}**: フォーマットされた完了タスク
- **{{current_tasks_formatted}}**: フォーマットされた進行中タスク
- **{{pending_tasks_formatted}}**: フォーマットされた保留中タスク
- **{{blocked_tasks_formatted}}**: フォーマットされたブロック中タスク
- **{{implementation_summary}}**: 実装サマリー
- **{{key_changes}}**: 主な変更点
- **{{key_artifacts_formatted}}**: フォーマットされたkey_artifact
- **{{commit_count}}**: コミット数
- **{{files_added}}**: 追加ファイル数
- **{{files_modified}}**: 変更ファイル数
- **{{files_deleted}}**: 削除ファイル数
- **{{lines_added}}**: 追加行数
- **{{lines_deleted}}**: 削除行数
- **{{commits_formatted}}**: フォーマットされたコミット
- **{{other_changes_formatted}}**: フォーマットされたその他の変更
- **{{resolved_challenges}}**: 解決済みの課題
- **{{current_challenges_formatted}}**: フォーマットされた現在の課題
- **{{next_session_focus}}**: 次のセッションでの焦点
- **{{action_items_formatted}}**: フォーマットされたアクションアイテム
- **{{recommendations}}**: 推奨事項

## ベストプラクティス

### セッション管理

- **セッションの境界を明確に**: セッションの開始時と終了時に明示的にコミットを作成し、セッションの境界を明確にします。
- **定期的なセッション作成**: 長時間の作業では、定期的にセッションを作成して状態を保存します。
- **セッションIDの一貫性**: セッションIDとしてGitコミットハッシュを使用し、一貫性を確保します。

### Git連携

- **コミットメッセージの標準化**: コミットメッセージにタスクIDを含める形式を標準化します（例: `"機能実装 #T001"`）。
- **関連タスクの明示**: コミットメッセージに関連するタスクIDを明示的に記載します。
- **適切な粒度のコミット**: 適切な粒度でコミットを作成し、変更の追跡性を向上させます。

### 課題とアクションアイテム

- **優先度と重要度の適切な評価**: 課題とアクションアイテムの優先度と重要度を適切に評価します。
- **解決計画の明確化**: 課題の解決計画を明確に記載します。
- **期限の設定**: アクションアイテムには適切な期限を設定します。

### マークダウン生成

- **テンプレートのカスタマイズ**: プロジェクトの要件に合わせてマークダウンテンプレートをカスタマイズします。
- **重要な情報のハイライト**: 重要な情報を適切にハイライトします。
- **定期的なドキュメント生成**: 定期的にマークダウン形式の引継ぎドキュメントを生成し、共有します。

## トラブルシューティング

### セッションの検証エラー

セッションの検証エラーが発生した場合は、以下を確認してください：

- 必須フィールドが存在するか
- タスクIDの形式が正しいか（`T001`形式）
- 日時形式が正しいか（ISO 8601形式）

### Git連携の問題

Git連携に問題がある場合は、以下を確認してください：

- Gitリポジトリが正しく設定されているか
- 必要なGitコマンドが実行可能か
- コミットメッセージの形式が標準化されているか

### マークダウン生成の問題

マークダウン生成に問題がある場合は、以下を確認してください：

- テンプレートファイルが存在するか
- テンプレート内のプレースホルダーが正しいか
- セッション情報が正しく設定されているか