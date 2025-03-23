# src/utils/ ディレクトリから src/lib/utils/ への移行計画

## 概要

フェーズ4「移行と統合」の一環として、`src/utils/` ディレクトリのユーティリティクラスを `src/lib/utils/` ディレクトリに移行します。これにより、パッケージ構造が統一され、依存関係が明確になります。

## 移行対象ファイル

以下のファイルを移行します：

1. ✅ `errors.js` → `src/lib/utils/errors.js`
2. ✅ `validator.js` → `src/lib/utils/validator.js`
3. ✅ `event-emitter.js` → `src/lib/utils/event-emitter.js`
4. ✅ `state-manager.js` → `src/lib/utils/state-manager.js`
5. ✅ `cache-manager.js` → `src/lib/utils/cache-manager.js`
6. ✅ `logger.js` → `src/lib/utils/logger.js`
7. ✅ `plugin-manager.js` → `src/lib/utils/plugin-manager.js`

## 移行手順

各ファイルの移行は以下の手順で行います：

1. 新しいファイルを `src/lib/utils/` ディレクトリに作成
2. 既存のコードを新しいファイルにコピー
3. 必要に応じてコードを修正
   - 依存性注入の粒度を改善（オプションオブジェクトパターンの採用）
   - 新しいコアコンポーネントとの統合
   - インポートパスの修正
4. `src/lib/core/service-definitions.js` を更新
5. テストを実行して動作確認

## 実施内容

### 1. errors.js の移行

**実施内容**:
- `src/lib/utils/errors.js` を作成
- `src/lib/core/error-framework.js` で定義されているエラークラスを継承するように修正
- `LockTimeoutError` クラスを追加（`TimeoutError` を継承）
- `src/lib/utils/lock-manager.js` のインポートパスを修正

**変更点**:
```javascript
// 変更前
const { LockTimeoutError } = require('../../utils/errors');

// 変更後
const { LockTimeoutError } = require('./errors');
```

### 2. validator.js の移行

**実施内容**:
- `src/lib/utils/validator.js` を作成
- オプションオブジェクトパターンを採用
- 後方互換性のために静的メソッドを維持
- `src/lib/core/service-definitions.js` のインポートパスを修正

**変更点**:
```javascript
// 変更前
container.register('validator', Validator);

// 変更後
container.registerFactory('validator', (c) => {
  return new Validator({
    logger: c.get('logger')
  });
});
```

### 3. event-emitter.js の移行

**実施内容**:
- `src/lib/utils/event-emitter.js` を作成
- `EnhancedEventEmitter` を継承するように修正
- 無限再帰を防ぐための修正
- `src/lib/core/service-definitions.js` のインポートパスを修正

**変更点**:
```javascript
// 変更前
container.registerFactory('eventEmitter', (c) => {
  const eventEmitterConfig = c.get('config').eventEmitter || {};
  return new EnhancedEventEmitter(
    c.get('logger'),
    {
      debugMode: eventEmitterConfig.debugMode || false,
      keepHistory: eventEmitterConfig.keepHistory || false,
      historyLimit: eventEmitterConfig.historyLimit || 100
    }
  );
});

// 変更後
container.registerFactory('eventEmitter', (c) => {
  const eventEmitterConfig = c.get('config').eventEmitter || {};
  return new EventEmitter({
    logger: c.get('logger'),
    debugMode: eventEmitterConfig.debugMode || false,
    keepHistory: eventEmitterConfig.keepHistory || false,
    historyLimit: eventEmitterConfig.historyLimit || 100
  });
});
```

### 4. state-manager.js の移行

**実施内容**:
- `src/lib/utils/state-manager.js` を作成
- `StateError` を使用するように修正
- イベント発行機能を追加
- `src/lib/core/service-definitions.js` のインポートパスを修正

**変更点**:
```javascript
// 変更前
container.registerFactory('stateManager', (c) => {
  const stateConfig = c.get('config').state || {};
  return new StateManager(stateConfig);
});

// 変更後
container.registerFactory('stateManager', (c) => {
  const stateConfig = c.get('config').state || {};
  return new StateManager({
    ...stateConfig,
    logger: c.get('logger'),
    eventEmitter: c.get('eventEmitter')
  });
});
```

### 5. cache-manager.js の移行

**実施内容**:
- `src/lib/utils/cache-manager.js` を作成
- イベント発行機能を追加
- `src/lib/core/service-definitions.js` のインポートパスを修正

**変更点**:
```javascript
// 変更前
container.registerFactory('cacheManager', (c) => {
  const cacheConfig = c.get('config').cache || {};
  return new CacheManager(cacheConfig);
});

// 変更後
container.registerFactory('cacheManager', (c) => {
  const cacheConfig = c.get('config').cache || {};
  return new CacheManager({
    ...cacheConfig,
    logger: c.get('logger'),
    eventEmitter: c.get('eventEmitter')
  });
});
```

### 6. logger.js の移行

**実施内容**:
- `src/lib/utils/logger.js` を作成
- トレースIDとリクエストID生成機能を追加
- イベント発行機能を追加
- `src/lib/core/service-definitions.js` のインポートパスを修正
- 循環依存を解決するために登録順序を変更

**変更点**:
```javascript
// 変更前
container.registerFactory('logger', (c) => {
  const loggerConfig = c.get('config').logger || {};
  return new Logger(loggerConfig);
});

// 変更後
// 一時的なロガーを作成（eventEmitter なし）
container.registerFactory('tempLogger', (c) => {
  const loggerConfig = c.get('config').logger || {};
  return new Logger(loggerConfig);
});

container.registerFactory('eventEmitter', (c) => {
  // ...
  return new EventEmitter({
    logger: c.get('tempLogger'),
    // ...
  });
});

// 実際のロガーを登録（eventEmitter あり）
container.registerFactory('logger', (c) => {
  const loggerConfig = c.get('config').logger || {};
  return new Logger({
    ...loggerConfig,
    eventEmitter: c.get('eventEmitter')
  });
});
```

## 次のステップ

1. ✅ すべてのユーティリティクラスの移行完了
2. イベント名の標準化
3. 依存性注入の粒度の改善を継続
4. テストの強化

## 注意点

- 移行中は後方互換性を維持
- 各ファイルの移行後にテストを実行して動作確認
- 非標準のイベント名は警告を出力するが、エラーにはしない

### 7. plugin-manager.js の移行

**実施内容**:
- `src/lib/utils/plugin-manager.js` を作成
- イベント発行機能を追加
- `src/lib/core/service-definitions.js` のインポートパスを修正

**変更点**:
```javascript
// 変更前
container.registerFactory('pluginManager', (c) => {
  return new PluginManager({
    logger: c.get('logger')
  });
});

// 変更後
container.registerFactory('pluginManager', (c) => {
  return new PluginManager({
    logger: c.get('logger'),
    eventEmitter: c.get('eventEmitter')
  });
});
```