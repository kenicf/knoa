# LockManager 利用ガイド (`src/lib/utils/lock-manager.js`)

## 1. 目的

共有リソースへの同時アクセスを制御し、競合状態を防ぐためのシンプルなインメモリロック機構を提供します。特定のリソースに対してロックを取得・解放する機能を提供し、ロック取得時のタイムアウトとリトライ処理をサポートします。

**注意:** この LockManager は単一プロセス内での利用を想定したインメモリロックです。複数のプロセスやサーバーインスタンス間での分散ロックには対応していません。分散環境でのロックが必要な場合は、Redis やデータベースなどの外部システムを利用したロック機構を検討してください。

## 2. コンストラクタ (`new LockManager(options)`)

*   **`options`** (Object): 設定オプション。
    *   **`logger` (Object): 必須。** ロック操作に関するログを出力するために使用される Logger インスタンス。
    *   **`lockTimeout` (number):** オプション。ロックの有効期間（ミリ秒）。この時間を超えたロックは期限切れとみなされ、他のプロセスが取得できるようになります。デフォルトは `30000` (30秒)。
    *   **`retryInterval` (number):** オプション。ロック取得に失敗した場合の再試行間隔（ミリ秒）。デフォルトは `100`。
    *   **`maxRetries` (number):** オプション。ロック取得を試みる最大再試行回数。デフォルトは `50`。タイムアウト前でも、この回数に達するとロック取得は失敗します。

*   **例:**
    ```javascript
    const Logger = require('./logger'); // 仮
    const logger = new Logger();

    const lockManager = new LockManager({
      logger: logger,
      lockTimeout: 10000, // 10秒
      retryInterval: 50,
      maxRetries: 100
    });
    ```

## 3. 主要メソッド

*   **`acquireLock(resourceId, lockerId, [timeout])`:**
    *   指定された `resourceId` に対するロックの取得を試みます。
    *   `lockerId` は、どのプロセスや操作がロックを取得しようとしているかを識別するためのユニークなIDです。
    *   オプションの `timeout` (ミリ秒) を指定すると、コンストラクタの `lockTimeout` の代わりに、このロック取得試行のタイムアウト時間を設定できます。
    *   ロックがすぐに取得できた場合、またはリトライ中に取得できた場合は `true` を解決する Promise を返します。
    *   指定された `timeout` または `maxRetries` に達してもロックを取得できなかった場合は、`TimeoutError` (コード: `ERR_LOCK_TIMEOUT`) を拒否 (reject) する Promise を返します。
    *   戻り値: `Promise<boolean>` (常に `true` を解決するか、`TimeoutError` で拒否される)
*   **`releaseLock(resourceId, lockerId)`:**
    *   指定された `resourceId` に対するロックを解放します。
    *   ロックを解放できるのは、そのロックを現在保持している `lockerId` のみです。
    *   ロックが存在しない場合、または指定された `lockerId` がロックを保持していない場合は、エラーをスローします（ただし、ロックが存在しない場合はデバッグログを出力して `true` を返します）。
    *   戻り値: `boolean` (解放に成功したか、ロックが存在しなかった場合は `true`、エラー時は例外スロー)
*   **`getLockStatus()`:**
    *   現在のすべてのロックの状態（どのリソースが、どの `lockerId` によって、いつからロックされているか、期限切れか）を含む Map を返します。デバッグや監視に役立ちます。
    *   戻り値: `Map<string, Object>`
        *   キー: `resourceId`
        *   値: `{ lockerId, timestamp, age, isExpired }`

*   **例:**
    ```javascript
    const resource = 'critical-data-file.json';
    const myLockerId = `process-${process.pid}`;

    async function updateCriticalData(newData) {
      let lockAcquired = false;
      try {
        logger.info(`Attempting to acquire lock for ${resource}...`);
        await lockManager.acquireLock(resource, myLockerId, 5000); // 5秒タイムアウト
        lockAcquired = true;
        logger.info(`Lock acquired for ${resource}.`);

        // --- クリティカルセクション ---
        const currentData = storageService.readJSON('data', resource);
        const updatedData = { ...currentData, ...newData };
        storageService.writeJSON('data', resource, updatedData);
        logger.info(`Successfully updated ${resource}.`);
        // --- クリティカルセクション終了 ---

      } catch (error) {
        if (error.name === 'TimeoutError' && error.code === 'ERR_LOCK_TIMEOUT') {
          logger.warn(`Failed to acquire lock for ${resource} within timeout.`);
        } else {
          logger.error(`Error updating ${resource}:`, error);
        }
        // 必要に応じてエラーを再スロー
        throw error;
      } finally {
        if (lockAcquired) {
          try {
            lockManager.releaseLock(resource, myLockerId);
            logger.info(`Lock released for ${resource}.`);
          } catch (releaseError) {
            // ロック解放エラーは通常致命的ではないが、ログには残す
            logger.error(`Failed to release lock for ${resource}:`, releaseError);
          }
        }
      }
    }
    ```

## 4. 発行されるイベント

現在の `LockManager` 実装では、イベントは発行されません。ロックの取得・解放・タイムアウトなどの状況は、メソッドの戻り値やスローされるエラー、およびログ出力によって判断します。

## 5. 注意点とベストプラクティス

*   **インメモリロック:** この LockManager は単一プロセス内でのみ有効です。複数の Node.js プロセスやサーバーインスタンス間でリソースを共有する場合は、この LockManager は適していません。
*   **`lockerId` の一意性:** `acquireLock` と `releaseLock` で使用する `lockerId` は、ロックを取得・解放する主体を確実に識別できるように、ユニークな値を設定してください（例: プロセスID、リクエストIDなど）。
*   **`finally` ブロックでの解放:** ロックを取得した後は、処理が成功した場合でもエラーが発生した場合でも、必ず `finally` ブロック内で `releaseLock` を呼び出してロックを解放してください。解放漏れはデッドロックの原因となります。
*   **タイムアウトとリトライ:** `lockTimeout`, `retryInterval`, `maxRetries` の値は、リソースへのアクセス頻度やクリティカルセクションの実行時間に応じて適切に調整してください。タイムアウトが短すぎると不要なエラーが発生し、長すぎるとリソースの解放が遅れる可能性があります。
*   **デッドロック:** 複数のリソースに対してロックを取得する場合、ロックを取得する順序を常に一定に保つなど、デッドロックが発生しないように注意深く設計してください。