# Validator 利用ガイド (`src/lib/utils/validator.js`)

## 1. 目的

アプリケーション内で使用される特定のデータ構造（タスクデータ、セッションデータ、フィードバックデータなど）の妥当性を検証する機能を提供します。また、基本的な文字列サニタイズ機能も提供します。

## 2. コンストラクタ (`new Validator(options)`)

*   **`options`** (Object): 設定オプション。
    *   **`logger` (Object): 必須。** 検証処理に関するログ（現在は未使用ですが、将来的な拡張のため）を出力するために使用される Logger インスタンス。

*   **例:**
    ```javascript
    const Logger = require('./logger'); // 仮
    const logger = new Logger();

    const validator = new Validator({ logger: logger });
    ```

## 3. 主要メソッド

### 3.1 データ検証メソッド

これらのメソッドは、特定のデータ構造を受け取り、その妥当性を検証します。検証結果として、`isValid` (boolean) と `errors` (文字列の配列) を含むオブジェクトを返します。

*   **`validateTaskInput(taskData)`:**
    *   タスクデータの検証を行います。
    *   **検証項目:**
        *   `title`: 必須、文字列、最大200文字。
        *   `description`: 必須、文字列。
        *   `status`: オプション、`'pending'`, `'in_progress'`, `'completed'`, `'blocked'` のいずれか。
        *   `priority`: オプション、1から5の整数。
        *   `estimated_hours`: オプション、0以上の数値。
        *   `progress_percentage`: オプション、0から100の数値。
        *   `dependencies`: オプション、配列である必要があり、各要素は `{ task_id: string (Txxx形式), type?: 'strong'|'weak' }` の形式。
    *   戻り値: `{ isValid: boolean, errors: Array<string> }`
*   **`validateSessionInput(sessionData)`:**
    *   セッションハンドオーバーデータの検証を行います。
    *   **検証項目:**
        *   `session_handover` オブジェクトの存在。
        *   必須フィールド (`project_id`, `session_id`, `session_timestamp`, `project_state_summary`) の存在。
        *   `project_state_summary` 内のタスクリスト (`completed_tasks`, `current_tasks`, `pending_tasks`) が配列であること。
        *   `project_state_summary` 内のすべてのタスクIDが `Txxx` 形式であること。
    *   戻り値: `{ isValid: boolean, errors: Array<string> }`
*   **`validateFeedbackInput(feedbackData)`:**
    *   フィードバックループデータの検証を行います。
    *   **検証項目:**
        *   `feedback_loop` オブジェクトの存在。
        *   必須フィールド (`task_id`, `verification_results`) の存在。
        *   `task_id` が `Txxx` 形式であること。
        *   `verification_results.passes_tests` がブール値であること。
        *   `feedback_status` (オプション) が `'open'`, `'in_progress'`, `'resolved'`, `'wontfix'` のいずれかであること。
    *   戻り値: `{ isValid: boolean, errors: Array<string> }`

*   **検証結果の利用例:**
    ```javascript
    const taskData = { title: 'New Task', description: 'Details...' };
    const validationResult = validator.validateTaskInput(taskData);

    if (!validationResult.isValid) {
      logger.warn('Task validation failed:', { errors: validationResult.errors });
      // エラーレスポンスを返すなどの処理
      throw new ValidationError('Invalid task data provided', { errors: validationResult.errors });
    } else {
      // 検証成功時の処理
      taskService.createTask(taskData);
    }
    ```

### 3.2 サニタイズメソッド

*   **`sanitizeString(str)`:**
    *   入力文字列に対して基本的な HTML エスケープ処理（`<`, `>`, `"`, `'` を HTML エンティティに変換）を行います。クロスサイトスクリプティング (XSS) 攻撃のリスクを低減するために使用します。
    *   入力が文字列でない場合は、空文字列 (`''`) を返します。
    *   戻り値: `string` (サニタイズされた文字列)

*   **例:**
    ```javascript
    const userInput = '<script>alert("danger!");</script>';
    const sanitizedInput = validator.sanitizeString(userInput);
    // sanitizedInput は "<script>alert("danger!");</script>" となる

    // 安全な形で表示や保存を行う
    displayElement.innerHTML = sanitizedInput;
    ```

## 4. 発行されるイベント

現在の `Validator` 実装では、イベントは発行されません。検証結果はメソッドの戻り値として直接返されます。

## 5. 注意点とベストプラクティス

*   **必須依存関係:** `Validator` は `logger` を**必須**とします。
*   **検証のタイミング:** 外部からの入力（APIリクエスト、ファイル読み込みなど）を受け取った直後や、データを永続化する直前に検証を行うことが推奨されます。
*   **エラー処理:** 検証メソッド (`validate*Input`) は例外をスローしません。戻り値オブジェクトの `isValid` プロパティを確認し、`false` であれば `errors` 配列の内容に基づいて適切なエラー処理（例: `ValidationError` のスロー、ユーザーへのエラーメッセージ表示）を行ってください。
*   **サニタイズの限界:** `sanitizeString` は基本的な HTML エスケープのみを行います。より高度なサニタイズ（特定のタグのみ許可、属性のフィルタリングなど）が必要な場合は、専用のライブラリ（例: `DOMPurify`）の使用を検討してください。サニタイズは、主に出力時の XSS 対策として有効です。
*   **拡張性:** 新しいデータ構造の検証が必要になった場合は、`Validator` クラスに新しい `validate*Input` メソッドを追加することを検討してください。