/**
 * サービス定義
 *
 * システム全体で使用されるサービスの定義を一元管理します。
 * ServiceContainerに登録するサービスとファクトリー関数を定義します。
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const Handlebars = require('handlebars');

// コアコンポーネント
const { ErrorHandler } = require('./error-handler');
const { EventCatalog } = require('./event-system'); // EnhancedEventEmitter を削除
const EventMigrationHelper = require('./event-migration-helper');

// ユーティリティ
const StorageService = require('../utils/storage');
const GitService = require('../utils/git');

// マネージャークラス
// 新しいパスを使用
const { SessionManager } = require('../managers/session-manager');
const { FeedbackManager } = require('../managers/feedback-manager');
const { TaskManager } = require('../managers/task-manager');
const IntegrationManager = require('../managers/integration-manager');
const EventEmitter = require('../utils/event-emitter');
const StateManager = require('../managers/state-manager');
const CacheManager = require('../utils/cache-manager');
const LockManager = require('../utils/lock-manager');
const Logger = require('../utils/logger');
const PluginManager = require('../utils/plugin-manager');
const Validator = require('../utils/validator');

// アダプター
// 新しいパスを使用
const TaskManagerAdapter = require('../adapters/task-manager-adapter');
const SessionManagerAdapter = require('../adapters/session-manager-adapter');
const FeedbackManagerAdapter = require('../adapters/feedback-manager-adapter');
const StateManagerAdapter = require('../adapters/state-manager-adapter');
const IntegrationManagerAdapter = require('../adapters/integration-manager-adapter');

/**
 * サービス定義を登録
 * @param {ServiceContainer} container - サービスコンテナ
 * @param {Object} config - 設定オブジェクト
 */
function registerServices(container, config = {}) {
  // 基本サービス
  container.register('fs', fs);
  container.register('path', path);
  container.register('execSync', execSync);
  container.register('handlebars', Handlebars);
  container.register('config', config);

  // コアコンポーネント
  // 一時的なロガーを作成（eventEmitter なし）
  container.registerFactory('tempLogger', (c) => {
    const loggerConfig = c.get('config').logger || {};
    return new Logger(loggerConfig);
  });

  container.registerFactory('eventEmitter', (c) => {
    const eventEmitterConfig = c.get('config').eventEmitter || {};
    return new EventEmitter({
      logger: c.get('tempLogger'),
      debugMode: eventEmitterConfig.debugMode || false,
      keepHistory: eventEmitterConfig.keepHistory || false,
      historyLimit: eventEmitterConfig.historyLimit || 100,
    });
  });

  // 実際のロガーを登録（eventEmitter あり）
  container.registerFactory('logger', (c) => {
    const loggerConfig = c.get('config').logger || {};
    return new Logger({
      ...loggerConfig,
      eventEmitter: c.get('eventEmitter'),
    });
  });

  container.registerFactory('eventCatalog', (_c) => {
    // c -> _c
    return new EventCatalog();
  });

  container.registerFactory('errorHandler', (c) => {
    const errorHandlerConfig = c.get('config').errorHandler || {};
    return new ErrorHandler(
      c.get('logger'),
      c.get('eventEmitter'),
      errorHandlerConfig
    );
  });

  container.registerFactory('eventMigrationHelper', (c) => {
    return new EventMigrationHelper(
      c.get('eventEmitter'),
      c.get('eventCatalog')
    );
  });

  // ユーティリティ
  container.registerFactory('storageService', (c) => {
    const storageConfig = c.get('config').storage || {};
    return new StorageService({
      basePath: storageConfig.basePath || process.cwd(),
      logger: c.get('logger'),
      eventEmitter: c.get('eventEmitter'),
      errorHandler: c.get('errorHandler'),
    });
  });

  container.registerFactory('gitService', (c) => {
    const gitConfig = c.get('config').git || {};
    return new GitService({
      repoPath: gitConfig.repoPath || process.cwd(),
      logger: c.get('logger'),
      eventEmitter: c.get('eventEmitter'),
      errorHandler: c.get('errorHandler'),
    });
  });

  container.registerFactory('stateManager', (c) => {
    return new StateManager({
      logger: c.get('logger'),
      eventEmitter: c.get('eventEmitter'),
      errorHandler: c.get('errorHandler'),
      config: c.get('config').state || {},
    });
  });

  container.registerFactory('cacheManager', (c) => {
    const cacheConfig = c.get('config').cache || {};
    return new CacheManager({
      ...cacheConfig,
      logger: c.get('logger'),
      eventEmitter: c.get('eventEmitter'),
    });
  });

  container.registerFactory('lockManager', (c) => {
    const lockConfig = c.get('config').lock || {};
    return new LockManager(lockConfig);
  });

  container.registerFactory('pluginManager', (c) => {
    return new PluginManager({
      logger: c.get('logger'),
      eventEmitter: c.get('eventEmitter'),
    });
  });

  container.registerFactory('validator', (c) => {
    return new Validator({
      logger: c.get('logger'),
    });
  });

  // マネージャークラス
  // 新しいオプションオブジェクトパターンを使用
  container.registerFactory('sessionManager', (c) => {
    const sessionConfig = c.get('config').session || {};
    return new SessionManager({
      storageService: c.get('storageService'),
      gitService: c.get('gitService'),
      logger: c.get('logger'),
      eventEmitter: c.get('eventEmitter'),
      errorHandler: c.get('errorHandler'),
      config: {
        sessionsDir: sessionConfig.sessionsDir,
        templateDir: sessionConfig.templateDir,
      },
    });
  });

  // 新しいオプションオブジェクトパターンを使用
  container.registerFactory('feedbackManager', (c) => {
    const feedbackConfig = c.get('config').feedback || {};
    return new FeedbackManager({
      storageService: c.get('storageService'),
      gitService: c.get('gitService'),
      logger: c.get('logger'),
      eventEmitter: c.get('eventEmitter'),
      errorHandler: c.get('errorHandler'),
      handlebars: c.get('handlebars'),
      config: {
        feedbackDir: feedbackConfig.feedbackDir,
        templateDir: feedbackConfig.templateDir,
      },
    });
  });

  // 新しいオプションオブジェクトパターンを使用
  container.registerFactory('taskManager', (c) => {
    const taskConfig = c.get('config').task || {};
    return new TaskManager({
      storageService: c.get('storageService'),
      gitService: c.get('gitService'),
      logger: c.get('logger'),
      eventEmitter: c.get('eventEmitter'),
      errorHandler: c.get('errorHandler'),
      config: {
        tasksDir: taskConfig.tasksDir,
        currentTasksFile: taskConfig.currentTasksFile,
      },
    });
  });

  // アダプター
  // 新しいオプションを追加
  container.registerFactory('taskManagerAdapter', (c) => {
    return new TaskManagerAdapter(c.get('taskManager'), {
      logger: c.get('logger'),
      errorHandler: c.get('errorHandler'),
    });
  });

  // 新しいオプションを追加
  container.registerFactory('sessionManagerAdapter', (c) => {
    return new SessionManagerAdapter(c.get('sessionManager'), {
      logger: c.get('logger'),
      errorHandler: c.get('errorHandler'),
    });
  });

  // 新しいオプションを追加
  container.registerFactory('feedbackManagerAdapter', (c) => {
    return new FeedbackManagerAdapter(c.get('feedbackManager'), {
      logger: c.get('logger'),
      errorHandler: c.get('errorHandler'),
    });
  });

  // 統合マネージャー
  // 新しいオプションオブジェクトパターンを使用
  container.registerFactory('integrationManager', (c) => {
    const integrationConfig = c.get('config').integration || {};
    // 環境変数でテストモードを判定
    const isTestMode = process.env.NODE_ENV === 'test';

    return new IntegrationManager({
      taskManager: c.get('taskManagerAdapter'),
      sessionManager: c.get('sessionManagerAdapter'),
      feedbackManager: c.get('feedbackManagerAdapter'),
      stateManager: c.get('stateManager'),
      cacheManager: c.get('cacheManager'),
      eventEmitter: c.get('eventEmitter'),
      lockManager: c.get('lockManager'),
      logger: c.get('logger'),
      pluginManager: c.get('pluginManager'),
      validator: c.get('validator'),
      errorHandler: c.get('errorHandler'),
      config: {
        syncInterval: integrationConfig.syncInterval,
        enablePeriodicSync: isTestMode
          ? false
          : integrationConfig.enablePeriodicSync !== false,
      },
    });
  });

  // 状態管理アダプター
  container.registerFactory('stateManagerAdapter', (c) => {
    return new StateManagerAdapter(c.get('stateManager'), {
      logger: c.get('logger'),
      errorHandler: c.get('errorHandler'),
      eventEmitter: c.get('eventEmitter'),
    });
  });

  // 統合マネージャーアダプター
  container.registerFactory('integrationManagerAdapter', (c) => {
    return new IntegrationManagerAdapter(c.get('integrationManager'), {
      logger: c.get('logger'),
      errorHandler: c.get('errorHandler'),
      eventEmitter: c.get('eventEmitter'),
    });
  });
}

module.exports = {
  registerServices,
};
