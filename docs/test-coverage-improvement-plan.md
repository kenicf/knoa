# テストカバレッジ向上計画 (目標: src/lib/data 配下 90%+)

## 1. 現状分析

`npm test --coverage tests/lib/data` の結果に基づき、`src/lib/data` 配下のカバレッジ状況は以下の通りです。

*   **全体:** Stmts: 60.7%, Branch: 50.25%, Funcs: 69.86%, Lines: 61.93%
*   **ファイル別 (Lines %):**
    *   `feedback-repository.js`: 74.76%
    *   `repository.js`: 79.47%
    *   `session-repository.js`: 67.25% (**要改善**)
    *   `task-repository.js`: 30.13% (**最優先改善**)
    *   `validators/feedback-validator.js`: 99.16% (ほぼ達成)
    *   `validators/session-validator.js`: 89.58% (あと少し)
    *   `validators/task-validator.js`: 94.33% (達成)

特に `task-repository.js` と `session-repository.js` のカバレッジ向上が急務です。

## 2. 戦略

*   **優先順位:** カバレッジが低い順 (`task-repository.js` -> `session-repository.js` -> `repository.js` -> `feedback-repository.js` -> `session-validator.js`) で対応します。
*   **テストケース追加方針:**
    *   **エラーハンドリング:** `errorHandler` の有無による分岐、カスタムエラー (`NotFoundError`, `ValidationError`, `DataConsistencyError`) のスロー/ハンドリングをテストします。
    *   **分岐網羅:** テストレポートの `Uncovered Line #s` や `% Branch` を参考に、未実行のコードパスを通過するテストケースを追加します。
    *   **依存関係モック:** `storageService`, `gitService`, 各 `Validator` などを適切にモックし、メソッド呼び出しやエラー時の挙動をテストします。
    *   **イベント発行:** `eventEmitter.emitStandardized` の呼び出しを `expectStandardizedEventEmitted` で検証します。
    *   **基準ドキュメント準拠:** `testing-guidelines.md` に従い、ヘルパー関数を活用します。

## 3. 計画図

```mermaid
graph TD
    subgraph Test Coverage Improvement Plan (Goal: 90%+)
        direction LR
        Start[開始] --> P1(TaskRepository);
        P1 --> P2(SessionRepository);
        P2 --> P3(Repository);
        P3 --> P4(FeedbackRepository);
        P4 --> P5(SessionValidator);
        P5 --> Goal[完了];
    end

    subgraph P1_Details [P1: TaskRepository (現在 30%)]
        P1_1[エラーハンドリング: errorHandler有無、各種エラー];
        P1_2[分岐網羅: updateTaskProgress(依存/状態遷移/進捗率), checkDependencies(循環/未完了)];
        P1_3[メソッド網羅: associateCommit, updateHierarchy, setFocus等のエラーパス];
        P1_4[基底クラスメソッド: delete, archive, find等エラーパス];
        P1_1 & P1_2 & P1_3 & P1_4 --> P1_Goal(TaskRepo 90%+);
    end

    subgraph P2_Details [P2: SessionRepository (現在 67%)]
        P2_1[エラーハンドリング: errorHandler有無、各種エラー];
        P2_2[分岐網羅: getSessionById(latest/history), createNewSession(prev有無), saveSession(isLatest)];
        P2_3[メソッド網羅: createFromGitCommits, getStateChangesのエラーパス];
        P2_4[プライベートメソッド: _calculateChangeSummary, _getKeyArtifactCandidatesのエラーパス];
        P2_1 & P2_2 & P2_3 & P2_4 --> P2_Goal(SessionRepo 90%+);
    end

    subgraph P3_Details [P3: Repository (現在 79%)]
        P3_1[エラーハンドリング: errorHandler無しの場合のログ出力/再スロー/デフォルト値返却];
        P3_2[分岐網羅: getAll(ファイル無), getById(コレクション型不正), create(ID重複), update/delete/archive(NotFound)];
        P3_3[Many系メソッド: createMany, updateMany, deleteManyのエラーパス(一部失敗含む)];
        P3_1 & P3_2 & P3_3 --> P3_Goal(Repo 90%+);
    end

    subgraph P4_Details [P4: FeedbackRepository (現在 75%)]
        P4_1[エラーハンドリング: errorHandler有無、各種エラー];
        P4_2[分岐網羅: getPending(データ型不正), save(新規/更新), move(削除)];
        P4_3[メソッド網羅: getHistory(listFiles/readJSON失敗), updateStatus(NotFound/Validation), calculatePriority(内部ロジック失敗), getStats/search(内部エラー)];
        P4_1 & P4_2 & P4_3 --> P4_Goal(FeedbackRepo 90%+);
    end

    subgraph P5_Details [P5: SessionValidator (現在 90%)]
        P5_1[分岐網羅: validate内のオプショナル項目(key_artifacts等)のundefinedチェック];
        P5_2[詳細バリデーション: 配列内要素の必須フィールド、型、フォーマットチェック];
        P5_3[validateStateChanges: handover/summary無しケース];
        P5_1 & P5_2 & P5_3 --> P5_Goal(SessionValidator 100%);
    end

    Start --> P1_Details --> P2_Details --> P3_Details --> P4_Details --> P5_Details --> Goal;

```

## 4. 計画詳細

*   **フェーズ1: `TaskRepository` (`task-repository.test.js`)**
    *   `create`, `update`, `delete`, `archive`, `find`, `findOne`, `createMany`, `updateMany`, `deleteMany` の各メソッドについて、`errorHandler` が指定されていない場合にエラーログが出力され、適切なエラーが再スローされるか、またはデフォルト値が返ることを確認するテストを追加します。
    *   `create`: `DataConsistencyError` 時の `errorHandler` 呼び出しテスト。
    *   `update`: `NotFoundError`, `ValidationError` 時の `errorHandler` 呼び出しテスト。
    *   `delete`: `NotFoundError`, `archive` 失敗、`writeJSON` 失敗時の `errorHandler` 呼び出しテスト。
    *   `archive`: `NotFoundError`, `writeJSON` 失敗時の `errorHandler` 呼び出しテスト。
    *   `getTasksBy*`: `getAll` 失敗時の `errorHandler` 呼び出しテスト。
    *   `updateTaskProgress`:
        *   `checkDependencies` が `isValid: false` を返す場合の `ValidationError` スローと `errorHandler` 呼び出しテスト。
        *   不正な状態遷移 (`STATE_TRANSITIONS` に反する) の場合の `ValidationError` スローと `errorHandler` 呼び出しテスト。
        *   不正な `customPercentage` (範囲外、数値以外) の場合の `ValidationError` スローと `errorHandler` 呼び出しテスト。
    *   `associateCommitWithTask`: `NotFoundError` 時、`update` 失敗時の `errorHandler` 呼び出しテスト。
    *   `checkDependencies`: 循環依存検出時、依存先タスクが見つからない/未完了時のエラー配列確認テスト。`getAll` 失敗時の `errorHandler` 呼び出しテスト。
    *   `updateTaskHierarchy`: `validateHierarchy` が `isValid: false` を返す場合の `ValidationError` スローと `errorHandler` 呼び出しテスト。`getAll` または `writeJSON` 失敗時の `errorHandler` 呼び出しテスト。
    *   `setCurrentFocus`: `getById` で `NotFoundError` 時、`getAll` または `writeJSON` 失敗時の `errorHandler` 呼び出しテスト。
*   **フェーズ2: `SessionRepository` (`session-repository.test.js`)**
    *   `getLatestSession`, `getSessionById`: `errorHandler` なしの場合のエラー再スローテスト。`getSessionById` で `getLatestSession` が失敗しても履歴を読みに行くテスト。履歴の `readJSON` 失敗時の `errorHandler` 呼び出しテスト。
    *   `createNewSession`: `getSessionById`/`getLatestSession` 失敗、`_getCurrentGitCommitHash` 失敗、生成データ検証失敗 (`ValidationError`) 時の `errorHandler` 呼び出しテスト。
    *   `saveSession`: `ValidationError`、`writeJSON` (history/latest) 失敗時の `errorHandler` 呼び出しテスト。`isLatest=false` の場合のテスト。
    *   `createSessionFromGitCommits`: `createNewSession` 失敗、`_getCommitsBetween` 等の内部ヘルパー失敗、生成データ検証失敗 (`ValidationError`) 時の `errorHandler` 呼び出しテスト。
    *   `getSessionStateChanges`: `getSessionById` 失敗 (`NotFoundError`) 時の `errorHandler` 呼び出しテスト。`validateStateChanges` が `isValid: false` を返す場合の `logger.warn` 呼び出しテスト。
    *   プライベートメソッドのエラーパス: `_getCurrentGitCommitHash`, `_getCommitsBetween`, `_calculateChangeSummary`, `_getKeyArtifactCandidates` が内部でエラー（例: `gitService` 呼び出し失敗）になった場合に、呼び出し元のパブリックメソッド (`createNewSession`, `createSessionFromGitCommits`) が適切に `errorHandler` を呼び出すか、またはエラーをスローするかを確認するテスト。
*   **フェーズ3: `FeedbackRepository` (`feedback-repository.test.js`)**
    *   `getPendingFeedback`: `errorHandler` なしの場合のエラー再スローテスト。データが配列でない場合のテスト。
    *   `saveFeedback`: `ValidationError`、`writeJSON` 失敗時の `errorHandler` 呼び出しテスト。新規作成 (`created`) と更新 (`updated`) の両方のイベント発行テスト。
    *   `moveFeedbackToHistory`: `ValidationError`、`writeJSON` (history/pending) 失敗時の `errorHandler` 呼び出しテスト。
    *   `getFeedbackHistoryByTaskId`: `listFiles` 失敗時の `logger.warn` テスト。`readJSON` 失敗時の `logger.warn` テスト。
    *   `updateFeedbackStatus`: `NotFoundError`、`ValidationError` (不正遷移)、`writeJSON` 失敗時の `errorHandler` 呼び出しテスト。
    *   `calculatePriority`: バリデータにメソッドがない場合の内部ロジック失敗時のデフォルト値返却テスト (`logger.error` が呼ばれないことも確認)。
    *   `getFeedbackStats`, `searchFeedback`: `getPendingFeedback` 失敗時の `errorHandler` 呼び出しテスト。`listFiles` 失敗時の `logger.warn` テスト。
*   **フェーズ4: `Repository` (`repository.test.js`)**
    *   `getAll`, `getById`, `create`, `update`, `delete`, `archive`, `find`, `findOne`, `createMany`, `updateMany`, `deleteMany` の各メソッドについて、`errorHandler` が *指定されていない* 場合に、エラーログ (`logger.error`) が記録され、適切なエラーが再スローされるか、またはデフォルト値 (`null`, `false`, `[]`) が返ることを確認するテストを追加します。
*   **フェーズ5: `SessionValidator` (`session-validator.test.js`)**
    *   `validate`: `key_artifacts`, `git_changes`, `current_challenges`, `action_items` が `undefined` の場合のテスト。各配列内のオブジェクトの必須フィールド (`path`, `description`, `hash`, `message` など) が欠落している場合のテスト。`git_changes.summary` の数値フィールドが数値でない、または負の場合のテスト。`current_challenges` の `priority`/`severity` が範囲外の場合のテスト。`action_items` の `priority` が範囲外の場合のテスト。関連タスクID (`related_tasks`, `related_task`) の形式チェックテスト。
    *   `validateStateChanges`: `previousSession` または `currentSession` の `session_handover` が `null` または `undefined` の場合のテスト。`project_state_summary` が `null` または `undefined` の場合のテスト。