/**
 * サービス定義のテスト
 */

const ServiceContainer = require('../../../src/lib/core/service-container');
const {
  registerServices,
} = require('../../../src/lib/core/service-definitions');

// モック
jest.mock('../../../src/lib/core/error-handler');
jest.mock('../../../src/lib/core/event-system');
jest.mock('../../../src/lib/core/event-catalog');
jest.mock('../../../src/lib/core/event-migration-helper');
jest.mock('../../../src/lib/utils/storage');
jest.mock('../../../src/lib/utils/git');
jest.mock('../../../src/lib/managers/session-manager');
jest.mock('../../../src/lib/managers/feedback-manager');
jest.mock('../../../src/lib/managers/task-manager', () => ({}));
jest.mock('../../../src/lib/managers/state-manager'); // Path was already correct, re-checking
jest.mock('../../../src/lib/utils/cache-manager');
jest.mock('../../../src/lib/utils/lock-manager');
jest.mock('../../../src/lib/utils/logger');
jest.mock('../../../src/lib/utils/plugin-manager');
jest.mock('../../../src/lib/utils/validator', () => ({}));
jest.mock('../../../src/lib/adapters/task-manager-adapter');
jest.mock('../../../src/lib/adapters/session-manager-adapter');
jest.mock('../../../src/lib/adapters/feedback-manager-adapter');
jest.mock('../../../src/lib/managers/integration-manager');

describe('ServiceDefinitions', () => {
  let container;
  let config;

  beforeEach(() => {
    container = new ServiceContainer();
    config = {
      storage: {
        basePath: '/test/path',
      },
      git: {
        repoPath: '/test/repo',
      },
      session: {
        sessionsDir: '/test/sessions',
        templateDir: '/test/templates',
      },
      feedback: {
        feedbackDir: '/test/feedback',
        templateDir: '/test/templates',
      },
      logger: {
        level: 'debug',
      },
      cache: {
        ttl: 60000,
      },
      lock: {
        timeout: 5000,
      },
      state: {
        persistPath: '/test/state',
      },
    };
  });

  test('基本サービスが登録されること', () => {
    registerServices(container, config);

    // 基本サービス
    expect(container.has('fs')).toBe(true);
    expect(container.has('path')).toBe(true);
    expect(container.has('execSync')).toBe(true);
    expect(container.has('handlebars')).toBe(true);
    expect(container.has('config')).toBe(true);
  });

  test('コアコンポーネントが登録されること', () => {
    registerServices(container, config);

    // コアコンポーネント
    expect(container.has('eventEmitter')).toBe(true);
    expect(container.has('eventCatalog')).toBe(true);
    expect(container.has('logger')).toBe(true);
    expect(container.has('errorHandler')).toBe(true);
    expect(container.has('eventMigrationHelper')).toBe(true);
  });

  test('ユーティリティが登録されること', () => {
    registerServices(container, config);

    // ユーティリティ
    expect(container.has('storageService')).toBe(true);
    expect(container.has('gitService')).toBe(true);
    expect(container.has('stateManager')).toBe(true);
    expect(container.has('cacheManager')).toBe(true);
    expect(container.has('lockManager')).toBe(true);
    expect(container.has('pluginManager')).toBe(true);
    expect(container.has('validator')).toBe(true);
  });

  test('マネージャークラスが登録されること', () => {
    registerServices(container, config);

    // マネージャークラス
    expect(container.has('sessionManager')).toBe(true);
    expect(container.has('feedbackManager')).toBe(true);
    expect(container.has('taskManager')).toBe(true);
  });

  test('アダプターが登録されること', () => {
    registerServices(container, config);

    // アダプター
    expect(container.has('taskManagerAdapter')).toBe(true);
    expect(container.has('sessionManagerAdapter')).toBe(true);
    expect(container.has('feedbackManagerAdapter')).toBe(true);
  });

  test('統合マネージャーが登録されること', () => {
    registerServices(container, config);

    // 統合マネージャー
    expect(container.has('integrationManager')).toBe(true);
  });

  test('依存関係が正しく解決されること', () => {
    // モックの実装をクリア
    jest.clearAllMocks();

    // 依存関係のモック
    const ErrorHandler = require('../../../src/lib/core/error-handler');
    const EnhancedEventEmitter = require('../../../src/lib/core/event-system');
    const EventCatalog = require('../../../src/lib/core/event-catalog');
    const EventMigrationHelper = require('../../../src/lib/core/event-migration-helper');
    const StorageService = require('../../../src/lib/utils/storage');
    const GitService = require('../../../src/lib/utils/git');
    const SessionManager = require('../../../src/lib/managers/session-manager');
    const FeedbackManager = require('../../../src/lib/managers/feedback-manager');
    const StateManager = require('../../../src/lib/managers/state-manager'); // Corrected path
    const CacheManager = require('../../../src/lib/utils/cache-manager');
    const LockManager = require('../../../src/lib/utils/lock-manager');
    const Logger = require('../../../src/lib/utils/logger');
    const PluginManager = require('../../../src/lib/utils/plugin-manager');
    const TaskManagerAdapter = require('../../../src/lib/adapters/task-manager-adapter');
    const SessionManagerAdapter = require('../../../src/lib/adapters/session-manager-adapter');
    const FeedbackManagerAdapter = require('../../../src/lib/adapters/feedback-manager-adapter');
    const IntegrationManager = require('../../../src/lib/managers/integration-manager');

    // サービスを登録
    registerServices(container, config);

    // 依存関係の解決をテスト
    container.get('integrationManager');

    // 各コンストラクタが呼ばれたことを確認
    expect(EnhancedEventEmitter).toHaveBeenCalled();
    expect(EventCatalog).toHaveBeenCalled();
    expect(Logger).toHaveBeenCalled();
    expect(ErrorHandler).toHaveBeenCalled();
    expect(EventMigrationHelper).toHaveBeenCalled();
    expect(StorageService).toHaveBeenCalled();
    expect(GitService).toHaveBeenCalled();
    expect(StateManager).toHaveBeenCalled();
    expect(CacheManager).toHaveBeenCalled();
    expect(LockManager).toHaveBeenCalled();
    expect(PluginManager).toHaveBeenCalled();
    expect(SessionManager).toHaveBeenCalled();
    expect(FeedbackManager).toHaveBeenCalled();
    expect(TaskManagerAdapter).toHaveBeenCalled();
    expect(SessionManagerAdapter).toHaveBeenCalled();
    expect(FeedbackManagerAdapter).toHaveBeenCalled();
    expect(IntegrationManager).toHaveBeenCalled();
  });
});
