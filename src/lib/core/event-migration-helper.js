/**
 * イベント駆動アーキテクチャへの移行ヘルパー
 *
 * 直接メソッド呼び出しからイベントベースの連携に移行するための
 * 支援機能を提供します。移行期間中の両方式の並行動作を管理し、
 * 移行の進捗を追跡します。
 */

const { EnhancedEventEmitter } = require('./event-system');

/**
 * イベント駆動アーキテクチャへの移行を支援するクラス
 */
class EventMigrationHelper {
  /**
   * コンストラクタ
   * @param {EnhancedEventEmitter} eventEmitter - イベントエミッターインスタンス
   * @param {Object} options - オプション
   * @param {boolean} options.debugMode - デバッグモードを有効にするかどうか
   * @param {Object} options.logger - ロガーインスタンス
   */
  constructor(eventEmitter, options = {}) {
    this.eventEmitter = eventEmitter;
    this.migrationLog = [];
    this.directCallCount = new Map();
    this.eventCallCount = new Map();
    this.debugMode = options.debugMode || false;
    this.logger = options.logger || console;
    this.startTime = new Date();
  }

  /**
   * 直接メソッド呼び出しをログに記録
   * @param {string} component - コンポーネント名
   * @param {string} method - メソッド名
   * @param {Array} args - 引数
   */
  logDirectCall(component, method, args) {
    const key = `${component}.${method}`;
    this.directCallCount.set(key, (this.directCallCount.get(key) || 0) + 1);

    if (this.debugMode) {
      this.migrationLog.push({
        type: 'direct',
        component,
        method,
        args,
        timestamp: new Date().toISOString(),
      });

      this.logger.debug(`[DIRECT CALL] ${key}`, { args });
    }
  }

  /**
   * イベントベースの呼び出しをログに記録
   * @param {string} eventName - イベント名
   * @param {Object} data - イベントデータ
   */
  logEventCall(eventName, data) {
    this.eventCallCount.set(
      eventName,
      (this.eventCallCount.get(eventName) || 0) + 1
    );

    if (this.debugMode) {
      this.migrationLog.push({
        type: 'event',
        eventName,
        data,
        timestamp: new Date().toISOString(),
      });

      this.logger.debug(`[EVENT CALL] ${eventName}`, { data });
    }
  }

  /**
   * 移行状況レポートを生成
   * @returns {Object} 移行状況レポート
   */
  generateMigrationReport() {
    const directMethods = Array.from(this.directCallCount.entries())
      .map(([key, count]) => ({ key, count }))
      .sort((a, b) => b.count - a.count);

    const eventMethods = Array.from(this.eventCallCount.entries())
      .map(([key, count]) => ({ key, count }))
      .sort((a, b) => b.count - a.count);

    // 直接呼び出しとイベントの対応関係を推測
    const mappings = [];
    for (const { key: directKey } of directMethods) {
      const [component, method] = directKey.split('.');
      const possibleEventNames = [
        `${component}:${method}`,
        `${component}:${method}ed`,
        `${component}:${method}d`,
      ];

      for (const eventName of possibleEventNames) {
        if (this.eventCallCount.has(eventName)) {
          mappings.push({
            directMethod: directKey,
            eventName,
            directCount: this.directCallCount.get(directKey),
            eventCount: this.eventCallCount.get(eventName),
          });
          break;
        }
      }
    }

    // 未マッピングの直接メソッド呼び出し
    const unmappedDirectMethods = directMethods.filter(({ key }) => {
      return !mappings.some((mapping) => mapping.directMethod === key);
    });

    // 未マッピングのイベント
    const unmappedEvents = eventMethods.filter(({ key }) => {
      return !mappings.some((mapping) => mapping.eventName === key);
    });

    // 移行進捗の計算
    const totalDirectCalls = Array.from(this.directCallCount.values()).reduce(
      (sum, count) => sum + count,
      0
    );
    const totalEventCalls = Array.from(this.eventCallCount.values()).reduce(
      (sum, count) => sum + count,
      0
    );
    const totalCalls = totalDirectCalls + totalEventCalls;
    const migrationPercentage =
      totalCalls > 0 ? (totalEventCalls / totalCalls) * 100 : 0;

    return {
      timestamp: new Date().toISOString(),
      runningTime: (new Date() - this.startTime) / 1000, // 秒単位
      directMethods,
      eventMethods,
      mappings,
      unmappedDirectMethods,
      unmappedEvents,
      migrationProgress: {
        totalDirectCalls,
        totalEventCalls,
        totalCalls,
        migrationPercentage: Math.round(migrationPercentage * 100) / 100, // 小数点2桁まで
        mappedMethods: mappings.length,
        unmappedDirectMethods: unmappedDirectMethods.length,
        unmappedEvents: unmappedEvents.length,
      },
      recentLogs: this.migrationLog.slice(-100),
    };
  }

  /**
   * 移行ラッパーを作成
   * @param {Object} originalObject - 元のオブジェクト
   * @param {string} component - コンポーネント名
   * @param {Object} methodToEventMap - メソッド名とイベント名のマッピング
   * @returns {Object} 移行ラッパー
   */
  createMigrationWrapper(originalObject, component, methodToEventMap) {
    const wrapper = Object.create(Object.getPrototypeOf(originalObject));
    const self = this;

    // 元のオブジェクトのすべてのプロパティをコピー
    for (const prop of Object.getOwnPropertyNames(originalObject)) {
      const descriptor = Object.getOwnPropertyDescriptor(originalObject, prop);
      if (descriptor) {
        Object.defineProperty(wrapper, prop, descriptor);
      }
    }

    // メソッドをラップ
    for (const methodName of Object.keys(methodToEventMap)) {
      const originalMethod = originalObject[methodName];

      if (typeof originalMethod === 'function') {
        wrapper[methodName] = function (...args) {
          // 直接メソッド呼び出しをログ
          self.logDirectCall(component, methodName, args);

          // 元のメソッドを呼び出し
          const result = originalMethod.apply(originalObject, args);

          // 対応するイベントがあれば発行
          const eventName = methodToEventMap[methodName];
          if (eventName && self.eventEmitter) {
            // メソッド名からイベントデータを生成
            const eventData = {};

            // 引数からイベントデータを推測
            if (args.length === 1 && typeof args[0] === 'object') {
              // 最初の引数がオブジェクトの場合はそのまま使用
              Object.assign(eventData, args[0]);
            } else if (args.length > 0) {
              // 複数の引数がある場合は引数の名前を推測
              const paramNames = self._guessParamNames(methodName, args);
              args.forEach((arg, index) => {
                if (index < paramNames.length) {
                  eventData[paramNames[index]] = arg;
                }
              });
            }

            // 結果がオブジェクトの場合は結果も含める
            if (result && typeof result === 'object') {
              eventData.result = result;
            }

            // イベントを発行
            const [eventComponent, eventAction] = eventName.split(':');
            self.eventEmitter.emitStandardized(
              eventComponent,
              eventAction,
              eventData
            );

            // イベント呼び出しをログ
            self.logEventCall(eventName, eventData);
          }

          return result;
        };
      }
    }

    return wrapper;
  }

  /**
   * パラメータ名を推測
   * @private
   * @param {string} methodName - メソッド名
   * @param {Array} args - 引数
   * @returns {Array<string>} パラメータ名の配列
   */
  _guessParamNames(methodName, args) {
    // メソッド名から推測されるパラメータ名のマッピング
    const commonPatterns = {
      get: ['id', 'options'],
      find: ['query', 'options'],
      create: ['data', 'options'],
      update: ['id', 'data', 'options'],
      delete: ['id', 'options'],
      add: ['item', 'options'],
      remove: ['id', 'options'],
      save: ['data', 'options'],
      load: ['id', 'options'],
    };

    // メソッド名からパターンを検索
    for (const [pattern, paramNames] of Object.entries(commonPatterns)) {
      if (methodName.startsWith(pattern) || methodName.includes(pattern)) {
        return paramNames;
      }
    }

    // デフォルトのパラメータ名
    return args.map((_, index) => `param${index + 1}`);
  }

  /**
   * 移行ガイドを生成
   * @returns {string} 移行ガイド（マークダウン形式）
   */
  generateMigrationGuide() {
    const report = this.generateMigrationReport();

    let guide = `# イベント駆動アーキテクチャへの移行ガイド\n\n`;
    guide += `## 現在の移行状況\n\n`;
    guide += `- 移行率: ${report.migrationProgress.migrationPercentage}%\n`;
    guide += `- 直接メソッド呼び出し: ${report.migrationProgress.totalDirectCalls}回\n`;
    guide += `- イベントベース呼び出し: ${report.migrationProgress.totalEventCalls}回\n`;
    guide += `- マッピング済みメソッド: ${report.migrationProgress.mappedMethods}個\n`;
    guide += `- 未マッピングメソッド: ${report.migrationProgress.unmappedDirectMethods}個\n\n`;

    guide += `## 推奨される移行マッピング\n\n`;
    guide += `| 直接メソッド | イベント名 | 呼び出し回数比率 |\n`;
    guide += `|------------|----------|----------------|\n`;

    report.mappings.forEach((mapping) => {
      const ratio =
        mapping.directCount > 0
          ? `${mapping.eventCount} / ${mapping.directCount} (${Math.round((mapping.eventCount / mapping.directCount) * 100)}%)`
          : 'N/A';
      guide += `| \`${mapping.directMethod}\` | \`${mapping.eventName}\` | ${ratio} |\n`;
    });

    guide += `\n## 未マッピングの直接メソッド\n\n`;
    if (report.unmappedDirectMethods.length > 0) {
      guide += `以下のメソッドはまだイベントにマッピングされていません：\n\n`;
      report.unmappedDirectMethods.forEach((method) => {
        guide += `- \`${method.key}\` (${method.count}回呼び出し)\n`;
      });

      guide += `\n推奨されるイベント名：\n\n`;
      report.unmappedDirectMethods.forEach((method) => {
        const [component, methodName] = method.key.split('.');
        guide += `- \`${method.key}\` → \`${component}:${methodName}\`\n`;
      });
    } else {
      guide += `すべての直接メソッド呼び出しがイベントにマッピングされています。\n`;
    }

    guide += `\n## 移行手順\n\n`;
    guide += `1. 未マッピングのメソッドに対応するイベントを定義する\n`;
    guide += `2. 移行ラッパーを使用して両方式を並行実行する\n`;
    guide += `3. イベントリスナーを実装して機能を検証する\n`;
    guide += `4. 十分なテスト後、直接メソッド呼び出しを廃止する\n\n`;

    guide += `## 移行ラッパーの使用例\n\n`;
    guide += '```javascript\n';
    guide += `const { EventMigrationHelper } = require('./event-migration-helper');\n`;
    guide += `const { EnhancedEventEmitter } = require('./event-system');\n\n`;
    guide += `// イベントエミッターの作成\n`;
    guide += `const eventEmitter = new EnhancedEventEmitter({ debugMode: true });\n\n`;
    guide += `// 移行ヘルパーの作成\n`;
    guide += `const migrationHelper = new EventMigrationHelper(eventEmitter, { debugMode: true });\n\n`;
    guide += `// タスク管理クラスの例\n`;
    guide += `class TaskManager {\n`;
    guide += `  createTask(data) {\n`;
    guide += `    // タスク作成の実装\n`;
    guide += `    return { id: 'T001', ...data };\n`;
    guide += `  }\n\n`;
    guide += `  updateTask(id, data) {\n`;
    guide += `    // タスク更新の実装\n`;
    guide += `    return { id, ...data };\n`;
    guide += `  }\n`;
    guide += `}\n\n`;
    guide += `// メソッドとイベントのマッピング\n`;
    guide += `const methodToEventMap = {\n`;
    guide += `  createTask: 'task:created',\n`;
    guide += `  updateTask: 'task:updated'\n`;
    guide += `};\n\n`;
    guide += `// 移行ラッパーの作成\n`;
    guide += `const taskManager = new TaskManager();\n`;
    guide += `const wrappedTaskManager = migrationHelper.createMigrationWrapper(\n`;
    guide += `  taskManager,\n`;
    guide += `  'task',\n`;
    guide += `  methodToEventMap\n`;
    guide += `);\n\n`;
    guide += `// イベントリスナーの登録\n`;
    guide += `eventEmitter.on('task:created', (data) => {\n`;
    guide += `  console.log('タスク作成イベントを受信:', data);\n`;
    guide += `});\n\n`;
    guide += `// ラップされたメソッドの使用\n`;
    guide += `const task = wrappedTaskManager.createTask({ title: 'テストタスク' });\n`;
    guide += `console.log('作成されたタスク:', task);\n\n`;
    guide += `// 移行レポートの生成\n`;
    guide += `const report = migrationHelper.generateMigrationReport();\n`;
    guide += `console.log('移行レポート:', report);\n`;
    guide += '```\n';

    return guide;
  }
}

module.exports = {
  EventMigrationHelper,
};
