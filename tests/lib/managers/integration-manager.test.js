/**
 * 統合マネージャーのテスト
 */

const {
  IntegrationManager,
} = require('../../../src/lib/managers/integration-manager');
const { createMockDependencies } = require('../../helpers/mock-factory');

describe('IntegrationManager', () => {
  let integrationManager;
  let mockDeps;

  beforeEach(() => {
    // モック依存関係の作成
    mockDeps = createMockDependencies();

    // IntegrationManagerのインスタンスを作成
    integrationManager = new IntegrationManager(
      mockDeps.taskManagerAdapter,
      mockDeps.sessionManagerAdapter,
      mockDeps.feedbackManagerAdapter,
      mockDeps.stateManager,
      mockDeps.cacheManager,
      mockDeps.eventEmitter,
      mockDeps.lockManager,
      mockDeps.logger,
      mockDeps.pluginManager,
      mockDeps.validator,
      mockDeps.errorHandler,
      {
        syncInterval: 10000,
      }
    );
  });

  test('コンストラクタで依存関係を正しく設定する', () => {
    expect(integrationManager.taskManager).toBe(mockDeps.taskManagerAdapter);
    expect(integrationManager.sessionManager).toBe(
      mockDeps.sessionManagerAdapter
    );
    expect(integrationManager.feedbackManager).toBe(
      mockDeps.feedbackManagerAdapter
    );
    expect(integrationManager.stateManager).toBe(mockDeps.stateManager);
    expect(integrationManager.cacheManager).toBe(mockDeps.cacheManager);
    expect(integrationManager.eventEmitter).toBe(mockDeps.eventEmitter);
    expect(integrationManager.lockManager).toBe(mockDeps.lockManager);
    expect(integrationManager.logger).toBe(mockDeps.logger);
    expect(integrationManager.pluginManager).toBe(mockDeps.pluginManager);
    expect(integrationManager.validator).toBe(mockDeps.validator);
    expect(integrationManager.errorHandler).toBe(mockDeps.errorHandler);
  });

  test('必須の依存関係が欠けている場合はエラーをスローする', () => {
    expect(
      () =>
        new IntegrationManager(
          null,
          mockDeps.sessionManagerAdapter,
          mockDeps.feedbackManagerAdapter,
          mockDeps.stateManager,
          mockDeps.cacheManager,
          mockDeps.eventEmitter,
          mockDeps.lockManager,
          mockDeps.logger,
          mockDeps.pluginManager,
          mockDeps.validator,
          mockDeps.errorHandler
        )
    ).toThrow('IntegrationManager requires a taskManager instance');

    expect(
      () =>
        new IntegrationManager(
          mockDeps.taskManagerAdapter,
          null,
          mockDeps.feedbackManagerAdapter,
          mockDeps.stateManager,
          mockDeps.cacheManager,
          mockDeps.eventEmitter,
          mockDeps.lockManager,
          mockDeps.logger,
          mockDeps.pluginManager,
          mockDeps.validator,
          mockDeps.errorHandler
        )
    ).toThrow('IntegrationManager requires a sessionManager instance');

    expect(
      () =>
        new IntegrationManager(
          mockDeps.taskManagerAdapter,
          mockDeps.sessionManagerAdapter,
          null,
          mockDeps.stateManager,
          mockDeps.cacheManager,
          mockDeps.eventEmitter,
          mockDeps.lockManager,
          mockDeps.logger,
          mockDeps.pluginManager,
          mockDeps.validator,
          mockDeps.errorHandler
        )
    ).toThrow('IntegrationManager requires a feedbackManager instance');

    expect(
      () =>
        new IntegrationManager(
          mockDeps.taskManagerAdapter,
          mockDeps.sessionManagerAdapter,
          mockDeps.feedbackManagerAdapter,
          null,
          mockDeps.cacheManager,
          mockDeps.eventEmitter,
          mockDeps.lockManager,
          mockDeps.logger,
          mockDeps.pluginManager,
          mockDeps.validator,
          mockDeps.errorHandler
        )
    ).toThrow('IntegrationManager requires a stateManager instance');

    expect(
      () =>
        new IntegrationManager(
          mockDeps.taskManagerAdapter,
          mockDeps.sessionManagerAdapter,
          mockDeps.feedbackManagerAdapter,
          mockDeps.stateManager,
          null,
          mockDeps.eventEmitter,
          mockDeps.lockManager,
          mockDeps.logger,
          mockDeps.pluginManager,
          mockDeps.validator,
          mockDeps.errorHandler
        )
    ).toThrow('IntegrationManager requires a cacheManager instance');

    expect(
      () =>
        new IntegrationManager(
          mockDeps.taskManagerAdapter,
          mockDeps.sessionManagerAdapter,
          mockDeps.feedbackManagerAdapter,
          mockDeps.stateManager,
          mockDeps.cacheManager,
          null,
          mockDeps.lockManager,
          mockDeps.logger,
          mockDeps.pluginManager,
          mockDeps.validator,
          mockDeps.errorHandler
        )
    ).toThrow('IntegrationManager requires an eventEmitter instance');

    expect(
      () =>
        new IntegrationManager(
          mockDeps.taskManagerAdapter,
          mockDeps.sessionManagerAdapter,
          mockDeps.feedbackManagerAdapter,
          mockDeps.stateManager,
          mockDeps.cacheManager,
          mockDeps.eventEmitter,
          null,
          mockDeps.logger,
          mockDeps.pluginManager,
          mockDeps.validator,
          mockDeps.errorHandler
        )
    ).toThrow('IntegrationManager requires a lockManager instance');

    expect(
      () =>
        new IntegrationManager(
          mockDeps.taskManagerAdapter,
          mockDeps.sessionManagerAdapter,
          mockDeps.feedbackManagerAdapter,
          mockDeps.stateManager,
          mockDeps.cacheManager,
          mockDeps.eventEmitter,
          mockDeps.lockManager,
          null,
          mockDeps.pluginManager,
          mockDeps.validator,
          mockDeps.errorHandler
        )
    ).toThrow('IntegrationManager requires a logger instance');

    expect(
      () =>
        new IntegrationManager(
          mockDeps.taskManagerAdapter,
          mockDeps.sessionManagerAdapter,
          mockDeps.feedbackManagerAdapter,
          mockDeps.stateManager,
          mockDeps.cacheManager,
          mockDeps.eventEmitter,
          mockDeps.lockManager,
          mockDeps.logger,
          null,
          mockDeps.validator,
          mockDeps.errorHandler
        )
    ).toThrow('IntegrationManager requires a pluginManager instance');

    expect(
      () =>
        new IntegrationManager(
          mockDeps.taskManagerAdapter,
          mockDeps.sessionManagerAdapter,
          mockDeps.feedbackManagerAdapter,
          mockDeps.stateManager,
          mockDeps.cacheManager,
          mockDeps.eventEmitter,
          mockDeps.lockManager,
          mockDeps.logger,
          mockDeps.pluginManager,
          null,
          mockDeps.errorHandler
        )
    ).toThrow('IntegrationManager requires a validator instance');

    expect(
      () =>
        new IntegrationManager(
          mockDeps.taskManagerAdapter,
          mockDeps.sessionManagerAdapter,
          mockDeps.feedbackManagerAdapter,
          mockDeps.stateManager,
          mockDeps.cacheManager,
          mockDeps.eventEmitter,
          mockDeps.lockManager,
          mockDeps.logger,
          mockDeps.pluginManager,
          mockDeps.validator,
          null
        )
    ).toThrow('IntegrationManager requires an errorHandler instance');
  });

  // ワークフロー初期化のテスト
  describe('initializeWorkflow', () => {
    test('ワークフローを初期化できる', async () => {
      // モックの設定
      mockDeps.stateManager.getCurrentState = jest
        .fn()
        .mockReturnValue('uninitialized');
      mockDeps.lockManager.acquireLock = jest.fn().mockResolvedValue(true);
      mockDeps.taskManagerAdapter.createTask = jest
        .fn()
        .mockResolvedValue({ id: 'T001' });

      const result = await integrationManager.initializeWorkflow(
        'test-project',
        'テスト用リクエスト'
      );

      expect(result).toBeDefined();
      expect(mockDeps.stateManager.transitionTo).toHaveBeenCalledWith(
        'initialized',
        expect.any(Object)
      );
      expect(mockDeps.eventEmitter.emit).toHaveBeenCalledWith(
        'workflow:initialized',
        expect.any(Object)
      );
    });

    test('無効な入力でワークフローを初期化できない', async () => {
      await expect(
        integrationManager.initializeWorkflow(null, 'テスト用リクエスト')
      ).rejects.toThrow();

      await expect(
        integrationManager.initializeWorkflow('test-project', null)
      ).rejects.toThrow();
    });
  });

  // セッション開始のテスト
  describe('startSession', () => {
    test('セッションを開始できる', async () => {
      // モックの設定
      mockDeps.stateManager.getCurrentState = jest
        .fn()
        .mockReturnValue('initialized');
      mockDeps.lockManager.acquireLock = jest.fn().mockResolvedValue(true);
      mockDeps.sessionManagerAdapter.createNewSession = jest
        .fn()
        .mockResolvedValue({ session_id: 'session-001' });

      const result = await integrationManager.startSession();

      expect(result).toBeDefined();
      expect(mockDeps.stateManager.transitionTo).toHaveBeenCalledWith(
        'session_started',
        expect.any(Object)
      );
      expect(mockDeps.eventEmitter.emit).toHaveBeenCalledWith(
        'session:started',
        expect.any(Object)
      );
    });
  });
});
