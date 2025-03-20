# フィードバック管理システム

フィードバック管理システムは、テスト実行と結果フィードバックの流れを確立するためのコンポーネントです。このシステムにより、実装結果の検証とそのフィードバックを開発フローに反映することができます。

## 1. 概要

フィードバック管理システムは以下の機能を提供します：

- テスト結果の自動収集と解析
- フィードバックの優先順位付け
- フィードバックの状態管理
- フィードバックレポートの生成
- Gitコミットとの関連付け
- セッションとの連携
- タスクとの連携

## 2. コンポーネント構成

### 2.1 フィードバックスキーマ

フィードバックの構造は`src/schemas/feedback.schema.json`で定義されています。主な構造は以下の通りです：

```json
{
  "feedback_loop": {
    "task_id": "タスクID",
    "implementation_attempt": 実装試行回数,
    "git_commit": "Gitコミットハッシュ",
    "test_execution": {
      "command": "テストコマンド",
      "timestamp": "実行日時",
      "duration_ms": 実行時間,
      "test_types": ["テスト種別"]
    },
    "verification_results": {
      "passes_tests": テスト成功フラグ,
      "test_summary": {
        "total": テスト総数,
        "passed": 成功数,
        "failed": 失敗数,
        "skipped": スキップ数
      },
      "failed_tests": [
        {
          "test_name": "テスト名",
          "error": "エラー内容",
          "expected": "期待値",
          "actual": "実際値",
          "file_path": "ファイルパス",
          "line_number": 行番号
        }
      ],
      "suggestions": [
        {
          "content": "提案内容",
          "type": "提案種別",
          "priority": 優先度,
          "affected_files": ["影響ファイル"]
        }
      ]
    },
    "iteration_plan": {
      "focus_areas": ["焦点領域"],
      "approach": "アプローチ",
      "specific_actions": [
        {
          "description": "アクション内容",
          "file_path": "ファイルパス",
          "priority": 優先度,
          "related_task": "関連タスクID"
        }
      ]
    },
    "feedback_status": "フィードバック状態",
    "related_sessions": ["関連セッションID"],
    "created_at": "作成日時",
    "updated_at": "更新日時"
  }
}
```

### 2.2 フィードバック管理ユーティリティ

フィードバック管理ユーティリティ（`src/utils/feedback-manager.js`）は、フィードバックの管理に関する機能を提供します。主なメソッドは以下の通りです：

- `validateFeedback`: フィードバックの検証
- `getPendingFeedback`: 保留中のフィードバックを取得
- `getFeedbackByTaskId`: タスクIDでフィードバックを取得
- `getFeedbackByCommit`: コミットハッシュでフィードバックを取得
- `getFeedbacksByStatus`: 状態でフィードバックをフィルタリング
- `createNewFeedback`: 新しいフィードバックを作成
- `saveFeedback`: フィードバックを保存
- `collectTestResults`: テスト結果を自動収集
- `prioritizeFeedback`: フィードバックの優先順位付け
- `updateFeedbackStatus`: フィードバックの状態を更新
- `linkFeedbackToGitCommit`: フィードバックにGitコミットを関連付ける
- `linkFeedbackToSession`: フィードバックにセッションを関連付ける
- `moveFeedbackToHistory`: フィードバックを履歴に移動
- `searchFeedbackHistory`: 履歴からフィードバックを検索
- `generateFeedbackMarkdown`: フィードバックのマークダウンを生成
- `integrateFeedbackWithSession`: フィードバックをセッションに統合
- `integrateFeedbackWithTask`: フィードバックをタスクに統合

### 2.3 フィードバック管理CLI

フィードバック管理CLI（`src/cli/feedback.js`）は、コマンドラインからフィードバック管理ユーティリティを操作するためのインターフェースを提供します。主なコマンドは以下の通りです：

- `collect`: テスト結果を収集してフィードバックを生成
- `status`: フィードバックの状態を表示
- `resolve`: フィードバックを解決済みとしてマーク
- `reopen`: フィードバックを再オープン
- `report`: フィードバックレポートを生成
- `prioritize`: フィードバックの優先順位付け
- `link-git`: フィードバックにGitコミットを関連付け
- `link-session`: フィードバックにセッションを関連付け
- `integrate-task`: フィードバックをタスクに統合
- `integrate-session`: フィードバックをセッションに統合

## 3. フィードバックの状態遷移

フィードバックは以下の状態を持ちます：

- `open`: 初期状態
- `in_progress`: 対応中
- `resolved`: 解決済み
- `wontfix`: 対応しない

状態遷移は以下のように定義されています：

```
open → in_progress, resolved, wontfix
in_progress → resolved, wontfix, open
resolved → open
wontfix → open
```

## 4. フィードバックの優先順位付け

フィードバックの提案は、種類と優先度に基づいて優先順位付けされます。種類ごとの重み付けは以下の通りです：

- `security`: 5（最高）
- `functional`: 5（最高）
- `performance`: 4
- `ux`: 3
- `code_quality`: 2

優先度は1から5の整数で表され、5が最高優先度です。

## 5. テスト結果の解析

テスト結果の解析は、テストフレームワークに応じて異なる方法で行われます。現在、以下のテストフレームワークに対応しています：

- Jest
- カスタムテスト
- 汎用テスト

テスト結果の解析では、以下の情報を抽出します：

- テスト総数
- 成功したテスト数
- 失敗したテスト数
- スキップされたテスト数
- 失敗したテストの詳細（テスト名、エラー内容、期待値、実際値、ファイルパス、行番号）

## 6. フィードバックレポートの生成

フィードバックレポートは、マークダウン形式で生成されます。レポートには以下の情報が含まれます：

- タスクID
- 実装試行回数
- Gitコミットハッシュ
- フィードバック状態
- テスト実行情報
- テスト結果サマリー
- 失敗したテストの詳細
- 改善提案
- 次のイテレーション計画

レポートのテンプレートは`src/templates/docs/feedback-markdown-template.md`で定義されています。テンプレート処理にはHandlebarsを使用しています。

## 7. 統合フロー

フィードバック管理システムは、タスク管理システムとセッション管理システムと統合することができます。

### 7.1 タスクとの統合

フィードバックをタスクに統合すると、以下の処理が行われます：

- フィードバックの状態に基づいてタスクの進捗状態を更新
- フィードバックのGitコミットをタスクに関連付け

### 7.2 セッションとの統合

フィードバックをセッションに統合すると、以下の処理が行われます：

- フィードバックの失敗したテストをセッションの課題として反映
- フィードバックのアクションアイテムをセッションのアクションアイテムとして反映
- フィードバックとセッションを相互に関連付け

## 8. 使用例

### 8.1 テスト結果の収集

```bash
node src/cli/feedback.js collect T001 "npm test"
```

### 8.2 フィードバックの状態表示

```bash
node src/cli/feedback.js status T001
```

### 8.3 フィードバックレポートの生成

```bash
node src/cli/feedback.js report T001
```

### 8.4 フィードバックの優先順位付け

```bash
node src/cli/feedback.js prioritize T001
```

### 8.5 フィードバックの解決

```bash
node src/cli/feedback.js resolve T001
```

## 9. 今後の改善点

フィードバック管理システムの今後の改善点として、以下が挙げられます：

1. **テスト結果解析の対応フォーマットの拡充**
   - より多くのテストフレームワーク（Mocha, AVA, Tape など）に対応
   - カスタムフォーマットの柔軟な解析

2. **フィードバック管理システムの詳細なドキュメント作成**
   - API リファレンスの充実
   - ユースケース別のガイド

3. **タスク管理、セッション管理、フィードバック管理の統合フローの確立**
   - 統合マネージャーの実装
   - 一貫したワークフローの確立

4. **フィードバックの可視化**
   - ダッシュボードの実装
   - グラフィカルなレポート生成

5. **自動化の強化**
   - CI/CD パイプラインとの連携
   - 自動テスト実行とフィードバック生成