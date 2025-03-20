# タスク管理システム詳細ドキュメント

## 概要

タスク管理システムは、AI駆動開発の中核となるコンポーネントで、ユーザーからの大きな指示をAIが処理可能な粒度のタスクに分解し、それらのタスクの進捗を追跡するための仕組みです。このドキュメントでは、タスク管理システムの詳細な仕様と使用方法について説明します。

## 1. タスク管理の基本構造

タスク管理システムは以下のコンポーネントで構成されています：

1. **タスク定義スキーマ**: `src/schemas/task.schema.json`
2. **タスクテンプレート**: `src/templates/docs/task.json`
3. **タスク管理ユーティリティ**: `src/utils/task-manager.js`
4. **タスク情報ストレージ**: `ai-context/tasks/current-tasks.json`

## 2. タスクスキーマ

タスクは以下の構造で定義されます：

```json
{
  "project": "プロジェクト名",
  "original_request": "ユーザーからの元の指示",
  "task_hierarchy": {
    "epics": [...],
    "stories": [...]
  },
  "decomposed_tasks": [
    {
      "id": "T001",
      "title": "タスクタイトル",
      "description": "タスクの詳細説明",
      "status": "pending|in_progress|completed|blocked",
      "dependencies": [
        {
          "task_id": "T002",
          "type": "strong|weak"
        }
      ],
      "priority": 1-5,
      "estimated_hours": 数値,
      "progress_percentage": 0-100,
      "progress_state": "not_started|planning|in_development|implementation_complete|in_review|review_complete|in_testing|completed",
      "git_commits": ["コミットハッシュ1", "コミットハッシュ2"]
    }
  ],
  "current_focus": "T001"
}
```

### 2.1 フィールドの説明

#### プロジェクト情報
- `project`: プロジェクト名
- `original_request`: ユーザーからの元の指示

#### 階層構造（将来的な拡張用）
- `task_hierarchy`: タスクの階層構造
  - `epics`: エピック（大きな機能単位）のリスト
  - `stories`: ストーリー（ユーザーストーリー）のリスト

#### タスク情報
- `decomposed_tasks`: 分解されたタスクのリスト
  - `id`: タスクID（T001形式）
  - `title`: タスクタイトル
  - `description`: タスクの詳細説明
  - `status`: タスクの状態
    - `pending`: 保留中
    - `in_progress`: 進行中
    - `completed`: 完了
    - `blocked`: ブロック中
  - `dependencies`: 依存するタスクのリスト
    - `task_id`: 依存するタスクのID
    - `type`: 依存タイプ
      - `strong`: 強い依存（タスク完了が必須）
      - `weak`: 弱い依存（参照のみ）
  - `priority`: 優先度（1:最低 〜 5:最高）
  - `estimated_hours`: 見積もり時間（時間単位）
  - `progress_percentage`: 進捗率（0-100%）
  - `progress_state`: 進捗状態
    - `not_started`: 未開始
    - `planning`: 計画中
    - `in_development`: 開発中
    - `implementation_complete`: 実装完了
    - `in_review`: レビュー中
    - `review_complete`: レビュー完了
    - `in_testing`: テスト中
    - `completed`: 完了
  - `git_commits`: 関連するGitコミットハッシュのリスト

#### 現在のフォーカス
- `current_focus`: 現在フォーカスしているタスクID

## 3. 進捗状態と進捗率

各進捗状態には、デフォルトの進捗率が設定されています：

| 進捗状態 | 説明 | デフォルト進捗率 |
|---------|------|--------------|
| not_started | タスクがまだ開始されていない状態 | 0% |
| planning | タスクの計画段階 | 10% |
| in_development | 開発中の状態 | 30% |
| implementation_complete | 実装が完了した状態 | 60% |
| in_review | レビュー中の状態 | 70% |
| review_complete | レビューが完了した状態 | 80% |
| in_testing | テスト中の状態 | 90% |
| completed | タスクが完了した状態 | 100% |

### 3.1 状態遷移

進捗状態は以下の遷移に従います：

```
not_started → planning → in_development → implementation_complete → in_review → review_complete → in_testing → completed
```

特殊な遷移：
- `in_development` → `in_review`（小規模タスク）
- `in_review` → `in_development`（レビュー指摘）
- `in_testing` → `in_development`（テスト不合格）

## 4. 依存関係の管理

タスク間の依存関係は2種類あります：

1. **強い依存（strong）**: 依存先のタスクが完了しないと、このタスクを開始できない
2. **弱い依存（weak）**: 依存先のタスクの情報を参照するが、完了を待たずに開始できる

依存関係の循環（A→B→C→A）は検出され、エラーとして報告されます。

## 5. Git連携

タスクとGitコミットを関連付けることで、変更履歴とタスク進捗の一元管理が可能になります。

### 5.1 コミットメッセージからのタスクID抽出

コミットメッセージに `#T001` 形式でタスクIDを含めることで、自動的にタスクとコミットが関連付けられます。

例：
```
git commit -m "ログイン機能の実装 #T001"
```

## 6. タスク管理ユーティリティ

`src/utils/task-manager.js` には、タスク管理に関する様々なユーティリティ関数が実装されています：

### 6.1 タスク検証

```javascript
const result = taskManager.validateTask(task);
if (result.isValid) {
  console.log("タスクは有効です");
} else {
  console.error("タスクエラー:", result.errors);
}
```

### 6.2 依存関係チェック

```javascript
const result = taskManager.checkDependencies(taskId, tasks);
if (result.isValid) {
  console.log("依存関係は正常です");
} else {
  console.error("依存関係エラー:", result.errors);
  console.warn("警告:", result.warnings);
}
```

### 6.3 進捗管理

```javascript
// 進捗率の計算
const progress = taskManager.calculateProgress(taskId, tasks);

// 進捗の更新
const result = taskManager.updateTaskProgress(taskId, percentage, state, tasks);
if (result.success) {
  console.log(result.message);
  // 更新されたタスクリストを保存
  saveTasks(result.updatedTasks);
}
```

### 6.4 タスクフィルタリング

```javascript
// ステータスでフィルタリング
const inProgressTasks = taskManager.getTasksByStatus(tasks, "in_progress");

// 進捗状態でフィルタリング
const inReviewTasks = taskManager.getTasksByProgressState(tasks, "in_review");

// Gitコミットでフィルタリング
const tasksWithCommit = taskManager.getTasksWithGitCommit(tasks, commitHash);
```

### 6.5 Git連携

```javascript
// コミットの関連付け
const result = taskManager.addGitCommitToTask(taskId, commitHash, tasks);

// コミットメッセージからタスクID抽出
const taskIds = taskManager.extractTaskIdsFromCommitMessage(commitMessage);
```

### 6.6 タスク移行

```javascript
// 古い形式から新しい形式への変換
const newTask = taskManager.migrateTaskToNewFormat(oldTask);
```

## 7. 使用例

### 7.1 タスクの作成

```javascript
const newTask = {
  id: "T010",
  title: "新機能の実装",
  description: "新機能の詳細説明",
  status: "pending",
  dependencies: [
    {
      task_id: "T009",
      type: "strong"
    }
  ],
  priority: 4,
  estimated_hours: 8,
  progress_percentage: 0,
  progress_state: "not_started",
  git_commits: []
};

// タスクの検証
const validationResult = taskManager.validateTask(newTask);
if (validationResult.isValid) {
  // タスクリストに追加
  tasks.decomposed_tasks.push(newTask);
  // 保存
  saveTasks(tasks);
}
```

### 7.2 タスクの進捗更新

```javascript
// タスクの進捗を更新
const result = taskManager.updateTaskProgress("T010", 30, "in_development", tasks);
if (result.success) {
  // 更新されたタスクリストを保存
  saveTasks(result.updatedTasks);
}
```

### 7.3 Gitコミットの関連付け

```javascript
// コミットメッセージからタスクIDを抽出
const commitMessage = "新機能の実装 #T010";
const taskIds = taskManager.extractTaskIdsFromCommitMessage(commitMessage);

// 各タスクにコミットを関連付け
for (const taskId of taskIds) {
  const result = taskManager.addGitCommitToTask(taskId, "abc123", tasks);
  if (result.success) {
    // 更新されたタスクリストを保存
    saveTasks(result.updatedTasks);
  }
}
```

## 8. ベストプラクティス

### 8.1 タスク分解

- タスクは1-4時間程度で完了できる粒度に分解する
- 依存関係は明確に定義し、循環依存を避ける
- 優先度は適切に設定し、重要なタスクを先に実施する

### 8.2 進捗管理

- 進捗状態は実際の作業状況を反映するよう定期的に更新する
- レビューやテストのフェーズも含めて進捗を管理する
- ブロッカーが発生した場合は、すぐにステータスを「blocked」に変更する

### 8.3 Git連携

- コミットメッセージには必ず関連するタスクIDを `#T001` 形式で含める
- 複数のタスクに関連する変更の場合は、すべてのタスクIDを記載する
- 大きな変更は複数の小さなコミットに分割し、各コミットを適切なタスクに関連付ける

## 9. 将来の拡張

タスク管理システムは、フェーズ1以降で以下の拡張が予定されています：

1. **JSONスキーマによる厳密な検証**: より詳細なバリデーションルールの追加
2. **階層構造の本格的な導入**: エピック、ストーリー、タスクの階層管理
3. **外部システムとの連携**: JIRAやGitHubなどの外部タスク管理システムとの連携
4. **自動化機能の強化**: 進捗の自動検出、依存関係の自動解決など

## 10. トラブルシューティング

### 10.1 よくある問題

1. **タスク検証エラー**
   - 必須フィールドが欠けていないか確認
   - IDの形式が正しいか確認（T001形式）
   - 依存関係が正しく定義されているか確認

2. **循環依存エラー**
   - 依存関係のグラフを確認し、循環を解消
   - 必要に応じて弱い依存に変更

3. **進捗状態の不整合**
   - 進捗状態と進捗率が一致しているか確認
   - 状態遷移のルールに従っているか確認

### 10.2 サポート

問題が解決しない場合は、以下の方法でサポートを受けることができます：

- GitHub Issueの作成
- プロジェクト管理者への連絡