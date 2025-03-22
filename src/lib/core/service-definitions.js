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
const { EnhancedEventEmitter, EventCatalog } = require('./event-system');
const EventMigrationHelper = require('./event-migration-helper');

// ユーティリティ
const StorageService = require('../utils/storage');
const GitService = require('../utils/git');

// マネージャークラス
const { SessionManager } = require('../../utils/session-manager');
const { FeedbackManager } = require('../../utils/feedback-manager');
const taskManager = require('../../utils/task-manager');
const StateManager = require('../../utils/state-manager');
const CacheManager = require('../../utils/cache-manager');
const LockManager = require('../../utils/lock-manager');
const Logger = require('../../utils/logger');
const PluginManager = require('../../utils/plugin-manager');
const Validator = require('../../utils/validator');

// アダプター
const TaskManagerAdapter = require('../../utils/adapters/task-manager-adapter');
const SessionManagerAdapter = require('../../utils/adapters/session-manager-adapter');
const FeedbackManagerAdapter = require('../../utils/adapters/feedback-manager-adapter');

// 統合マネージャー
const IntegrationManager = require('../../utils/integration-manager');

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
  container.registerFactory('logger', (c) => {
    const loggerConfig = c.get('config').logger || {};
    return new Logger(loggerConfig);
  });
  
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
  
  container.registerFactory('eventCatalog', (c) => {
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
    return new EventMigrationHelper(c.get('eventEmitter'), c.get('eventCatalog'));
  });
  
  // ユーティリティ
  container.registerFactory('storageService', (c) => {
    const storageConfig = c.get('config').storage || {};
    return new StorageService({
      basePath: storageConfig.basePath || process.cwd(),
      logger: c.get('logger'),
      eventEmitter: c.get('eventEmitter'),
      errorHandler: c.get('errorHandler')
    });
  });
  
  container.registerFactory('gitService', (c) => {
    const gitConfig = c.get('config').git || {};
    return new GitService({
      repoPath: gitConfig.repoPath || process.cwd(),
      logger: c.get('logger'),
      eventEmitter: c.get('eventEmitter'),
      errorHandler: c.get('errorHandler')
    });
  });
  
  container.registerFactory('stateManager', (c) => {
    const stateConfig = c.get('config').state || {};
    return new StateManager(stateConfig);
  });
  
  container.registerFactory('cacheManager', (c) => {
    const cacheConfig = c.get('config').cache || {};
    return new CacheManager(cacheConfig);
  });
  
  container.registerFactory('lockManager', (c) => {
    const lockConfig = c.get('config').lock || {};
    return new LockManager(lockConfig);
  });
  
  container.registerFactory('pluginManager', (c) => {
    return new PluginManager({
      logger: c.get('logger')
    });
  });
  
  container.register('validator', Validator);
  
  // マネージャークラス
  container.registerFactory('sessionManager', (c) => {
    const sessionConfig = c.get('config').session || {};
    return new SessionManager(
      c.get('storageService'),
      c.get('gitService'),
      c.get('logger'),
      c.get('eventEmitter'),
      c.get('errorHandler'),
      {
        sessionsDir: sessionConfig.sessionsDir,
        templateDir: sessionConfig.templateDir
      }
    );
  });
  
  container.registerFactory('feedbackManager', (c) => {
    const feedbackConfig = c.get('config').feedback || {};
    return new FeedbackManager(
      c.get('storageService'),
      c.get('gitService'),
      c.get('logger'),
      c.get('eventEmitter'),
      c.get('errorHandler'),
      c.get('handlebars'),
      {
        feedbackDir: feedbackConfig.feedbackDir,
        templateDir: feedbackConfig.templateDir
      }
    );
  });
  
  container.registerFactory('taskManager', (c) => {
    const taskConfig = c.get('config').task || {};
    return new TaskManager(
      c.get('storageService'),
      c.get('gitService'),
      c.get('logger'),
      c.get('eventEmitter'),
      c.get('errorHandler'),
      {
        tasksDir: taskConfig.tasksDir,
        currentTasksFile: taskConfig.currentTasksFile
      }
    );
  });
  
  // アダプター
  container.registerFactory('taskManagerAdapter', (c) => {
    return new TaskManagerAdapter(c.get('taskManager'));
  });
  
  container.registerFactory('sessionManagerAdapter', (c) => {
    return new SessionManagerAdapter(c.get('sessionManager'));
  });
  
  container.registerFactory('feedbackManagerAdapter', (c) => {
    return new FeedbackManagerAdapter(c.get('feedbackManager'));
  });
  
  // 統合マネージャー
  container.registerFactory('integrationManager', (c) => {
    const integrationConfig = c.get('config').integration || {};
    return new IntegrationManager(
      c.get('taskManagerAdapter'),
      c.get('sessionManagerAdapter'),
      c.get('feedbackManagerAdapter'),
      c.get('stateManager'),
      c.get('cacheManager'),
      c.get('eventEmitter'),
      c.get('lockManager'),
      c.get('logger'),
      c.get('pluginManager'),
      c.get('validator'),
      c.get('errorHandler'),
      {
        syncInterval: integrationConfig.syncInterval
      }
    );
  });
}

module.exports = {
  registerServices
};