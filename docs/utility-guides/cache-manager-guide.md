# CacheManager 利用ガイド (`src/lib/utils/cache-manager.js`)

## 1. 目的

頻繁にアクセスされるデータや計算結果をメモリ内に一時的に保存（キャッシュ）し、アプリケーションのパフォーマンスを向上させます。Time-to-Live (TTL) に基づく有効期限管理と、最大キャッシュサイズに基づく自動削除（Eviction）機能を提供します。

## 2. コンストラクタ (`new CacheManager(options)`)

*   **`options`** (Object): 設定オプション。
    *   **`logger` (Object): 必須。** キャッシュ操作に関するログを出力するために使用される Logger インスタンス。
    *   **`eventEmitter` (Object): 必須。** キャッシュイベントを発行するために使用する EventEmitter インスタンス。
    *   **`ttlMs` (number):** オプション。キャッシュエントリのデフォルト有効期間（ミリ秒）。デフォルトは `300000` (5分)。`set` メソッドで個別に指定することも可能です。
    *   **`maxSize` (number):** オプション。キャッシュが保持できる最大エントリ数。デフォルトは `1000`。上限に達すると、最も古いエントリが自動的に削除されます。

*   **例:**
    ```javascript
    const Logger = require('./logger'); // 仮
    const EventEmitter = require('./event-emitter'); // 仮

    const logger = new Logger();
    const eventEmitter = new EventEmitter({ logger });

    const cacheManager = new CacheManager({
      logger: logger,
      eventEmitter: eventEmitter,
      ttlMs: 60000, // 1分
      maxSize: 500
    });
    ```
*   **初期化イベント:** コンストラクタ呼び出し時に `cache:system_initialized` イベントが発行されます。

## 3. 主要メソッド

*   **`get(key)`:**
    *   指定された `key` に対応するキャッシュデータを取得します。
    *   キャッシュが存在し、かつ有効期限内であれば、その値を返します (キャッシュヒット)。
    *   キャッシュが存在しない、または有効期限切れの場合は `null` を返します (キャッシュミス)。
    *   戻り値: `* | null` (キャッシュされた値、または null)
    *   イベント (ヒット時): `cache:item_accessed`
    *   イベント (ミス時): `cache:item_missed`
    *   イベント (期限切れ時): `cache:item_expired` (その後 `cache:item_missed` も発行される可能性があります)
*   **`set(key, value, [ttl])`:**
    *   指定された `key` と `value` をキャッシュに保存します。
    *   オプションの `ttl` (ミリ秒) を指定すると、そのエントリ固有の有効期間を設定できます。指定しない場合は、コンストラクタで設定されたデフォルト `ttlMs` が使用されます。
    *   キャッシュサイズが `maxSize` に達している場合は、最も古いエントリが削除されてから新しいエントリが追加されます。
    *   イベント (削除発生時): `cache:item_evicted`
    *   イベント (設定完了時): `cache:item_set`
*   **`invalidate(keyPattern)`:**
    *   指定された `keyPattern` (文字列または正規表現) に一致するキーを持つキャッシュエントリをすべて削除します。
    *   戻り値: `number` (削除されたエントリ数)
    *   イベント (1つ以上削除された場合): `cache:items_invalidated`
*   **`clear()`:**
    *   キャッシュ内のすべてのエントリを削除します。
    *   イベント (1つ以上削除された場合): `cache:cleared`
*   **`getStats()`:**
    *   現在のキャッシュの統計情報を取得します。
    *   戻り値: `Object`
        *   統計情報: `{ size, maxSize, hitCount, missCount, hitRate }`

*   **例:**
    ```javascript
    // データのキャッシュ
    async function getUserWithCache(userId) {
      const cacheKey = `user:${userId}`;
      let user = cacheManager.get(cacheKey);

      if (user === null) {
        logger.debug(`Cache miss for ${cacheKey}`);
        user = await database.fetchUser(userId); // DBなどから取得
        if (user) {
          cacheManager.set(cacheKey, user, 60000); // 1分間キャッシュ
        }
      } else {
        logger.debug(`Cache hit for ${cacheKey}`);
      }
      return user;
    }

    // キャッシュの無効化
    function onUserUpdate(userId) {
      const cacheKeyPattern = `user:${userId}`; // 特定ユーザーのキャッシュを無効化
      const invalidatedCount = cacheManager.invalidate(cacheKeyPattern);
      logger.info(`Invalidated ${invalidatedCount} cache entries for user ${userId}`);
    }

    // 統計情報の取得
    const stats = cacheManager.getStats();
    logger.info(`Cache stats: Size=${stats.size}, HitRate=${(stats.hitRate * 100).toFixed(1)}%`);
    ```

## 4. 発行されるイベント (EventEmitter が必須)

キャッシュのライフサイクルや操作に応じて、`cache:` プレフィックスを持つ以下のイベントが発行されます。

*   `cache:system_initialized`: CacheManager インスタンス生成時。
*   `cache:item_accessed`: `get` でキャッシュヒットした時。
*   `cache:item_missed`: `get` でキャッシュミスした時（期限切れ含む）。
*   `cache:item_expired`: `get` でキャッシュが期限切れだった時。
*   `cache:item_set`: `set` でデータがキャッシュされた時。
*   `cache:item_evicted`: `set` 時に `maxSize` 超過で最も古いデータが削除された時。
*   `cache:items_invalidated`: `invalidate` で1つ以上のデータが削除された時。
*   `cache:cleared`: `clear` で1つ以上のデータが削除された時。

イベントデータには、関連するキー、TTL、削除数などの情報が含まれます。

## 5. 注意点とベストプラクティス

*   **必須依存関係:** `CacheManager` は `logger` と `eventEmitter` を**必須**とします。コンストラクタで必ず渡してください。
*   **キャッシュキーの設計:** 一意で、キャッシュされるデータを適切に識別できるキーを設計してください。プレフィックス（例: `user:`, `product:`）を使用すると、`invalidate` でのパターンマッチングが容易になります。
*   **TTLの選択:** キャッシュするデータの性質や更新頻度に応じて、適切な TTL を設定してください。短すぎるとキャッシュ効果が薄れ、長すぎると古いデータが表示される可能性があります。`set` で個別に TTL を指定することも可能です。
*   **`maxSize` の設定:** アプリケーションのメモリ使用量とキャッシュヒット率のバランスを考慮して、適切な `maxSize` を設定してください。小さすぎると頻繁に Eviction が発生し、キャッシュ効果が低下します。
*   **キャッシュ無効化:** データが更新された際には、関連するキャッシュを `invalidate` メソッドで適切に無効化してください。無効化漏れは古いデータを返し続ける原因となります。
*   **シリアライズ:** キャッシュされる値 (`value`) は、メモリ上でそのまま保持されます。複雑なオブジェクトや循環参照を持つオブジェクトをキャッシュする場合、メモリリークや意図しない挙動に注意してください。必要であれば、シリアライズ/デシリアライズ可能な単純なデータ構造に変換してからキャッシュすることを検討します。