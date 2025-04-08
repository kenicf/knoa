/**
 * bootstrap.js のテスト
 */
const { bootstrap } = require('../../src/cli/bootstrap'); // テスト対象

// 依存モジュールのモック
jest.mock('../../src/lib/core/service-container');
jest.mock('../../src/lib/core/service-definitions');
jest.mock('../../src/config', () => ({})); // 空オブジェクトでモック
jest.mock('../../src/cli/facade');
jest.mock('../../src/cli/workflow-manager');
jest.mock('../../src/cli/session-manager');
jest.mock('../../src/cli/task-manager');
jest.mock('../../src/cli/feedback-handler');
jest.mock('../../src/cli/report-generator');
jest.mock('../../src/cli/status-viewer');
jest.mock('../../src/cli/interactive-mode');
jest.mock('../../src/cli/component-syncer');
// Logger など、コンテナから取得するサービスもモックファクトリで準備
const {
  createMockDependencies, // createMockDependencies のみインポート
} = require('../helpers/mock-factory');

// モックされたクラス/関数をインポート
const ServiceContainer = require('../../src/lib/core/service-container');
const { registerServices } = require('../../src/lib/core/service-definitions');
const CliFacade = require('../../src/cli/facade');
const CliWorkflowManager = require('../../src/cli/workflow-manager');
const CliSessionManager = require('../../src/cli/session-manager');
const CliTaskManager = require('../../src/cli/task-manager');
const CliFeedbackHandler = require('../../src/cli/feedback-handler');
const CliReportGenerator = require('../../src/cli/report-generator');
const CliStatusViewer = require('../../src/cli/status-viewer');
const CliInteractiveMode = require('../../src/cli/interactive-mode');
const CliComponentSyncer = require('../../src/cli/component-syncer');

describe('bootstrap', () => {
  let mockContainerInstance;
  let mockLoggerInstance;
  let mockCliFacadeInstance;
  let mockCliInteractiveModeInstance;
  let mockDependencies; // createMockDependencies の結果を保持

  beforeEach(() => {
    jest.clearAllMocks();

    // モック依存関係を作成
    mockDependencies = createMockDependencies();
    mockLoggerInstance = mockDependencies.logger; // モックロガーを取得
    mockCliFacadeInstance = { interactiveMode: null }; // Facade のモックインスタンス
    mockCliInteractiveModeInstance = {}; // InteractiveMode のモックインスタンス

    // ServiceContainer のモック設定
    mockContainerInstance = {
      get: jest.fn((serviceName) => {
        // createMockDependencies から対応するモックを返す
        // eslint-disable-next-line security/detect-object-injection
        if (mockDependencies[serviceName]) {
          // eslint-disable-next-line security/detect-object-injection
          return mockDependencies[serviceName];
        }
        // アダプターなど、他の依存関係も必要に応じて返す
        if (serviceName === 'integrationManagerAdapter') return {};
        if (serviceName === 'sessionManagerAdapter') return {};
        if (serviceName === 'taskManagerAdapter') return {};
        if (serviceName === 'feedbackManagerAdapter')
          return mockDependencies.feedbackManagerAdapter;
        if (serviceName === 'stateManagerAdapter')
          return mockDependencies.stateManagerAdapter;
        if (serviceName === 'traceIdGenerator')
          return mockDependencies.traceIdGenerator; // ID生成関数も返す
        if (serviceName === 'requestIdGenerator')
          return mockDependencies.requestIdGenerator; // ID生成関数も返す
        return undefined; // 見つからない場合は undefined
      }),
    };
    ServiceContainer.mockImplementation(() => mockContainerInstance);

    // Facade と InteractiveMode のコンストラクタモック
    CliFacade.mockImplementation(() => mockCliFacadeInstance);
    CliInteractiveMode.mockImplementation(() => mockCliInteractiveModeInstance);
  });

  test('should initialize container, register services, and get dependencies', () => {
    // Act
    bootstrap();

    // Assert
    expect(ServiceContainer).toHaveBeenCalledTimes(1);
    expect(registerServices).toHaveBeenCalledWith(
      mockContainerInstance,
      expect.any(Object)
    ); // config はモック
    // 主要なサービスの get が呼ばれたことを確認
    expect(mockContainerInstance.get).toHaveBeenCalledWith('logger');
    expect(mockContainerInstance.get).toHaveBeenCalledWith('eventEmitter');
    expect(mockContainerInstance.get).toHaveBeenCalledWith('storageService');
    expect(mockContainerInstance.get).toHaveBeenCalledWith('validator');
    expect(mockContainerInstance.get).toHaveBeenCalledWith(
      'integrationManagerAdapter'
    );
    expect(mockContainerInstance.get).toHaveBeenCalledWith(
      'sessionManagerAdapter'
    );
    expect(mockContainerInstance.get).toHaveBeenCalledWith(
      'taskManagerAdapter'
    );
    expect(mockContainerInstance.get).toHaveBeenCalledWith(
      'feedbackManagerAdapter'
    );
    expect(mockContainerInstance.get).toHaveBeenCalledWith(
      'stateManagerAdapter'
    );
    expect(mockContainerInstance.get).toHaveBeenCalledWith('traceIdGenerator'); // 追加
    expect(mockContainerInstance.get).toHaveBeenCalledWith(
      'requestIdGenerator'
    ); // 追加
    expect(mockContainerInstance.get).toHaveBeenCalledWith(
      'stateManagerAdapter'
    );
  });

  test('should instantiate all CLI components with correct dependencies', () => {
    // Act
    bootstrap();

    // Assert
    // 各 CLI コンポーネントのコンストラクタが期待される依存関係で呼ばれたか検証
    expect(CliWorkflowManager).toHaveBeenCalledWith({
      logger: mockDependencies.logger,
      eventEmitter: mockDependencies.eventEmitter,
      integrationManagerAdapter: mockDependencies.integrationManagerAdapter,
      stateManagerAdapter: mockDependencies.stateManagerAdapter,
      traceIdGenerator: mockDependencies.traceIdGenerator, // 追加
      requestIdGenerator: mockDependencies.requestIdGenerator, // 追加
    });
    expect(CliSessionManager).toHaveBeenCalledWith({
      logger: mockDependencies.logger,
      eventEmitter: mockDependencies.eventEmitter,
      integrationManagerAdapter: expect.any(Object),
      sessionManagerAdapter: mockDependencies.sessionManagerAdapter,
      storageService: mockDependencies.storageService,
      traceIdGenerator: mockDependencies.traceIdGenerator, // 追加
      requestIdGenerator: mockDependencies.requestIdGenerator, // 追加
    });
    expect(CliTaskManager).toHaveBeenCalledWith({
      logger: mockDependencies.logger,
      eventEmitter: mockDependencies.eventEmitter,
      integrationManagerAdapter: expect.any(Object),
      taskManagerAdapter: mockDependencies.taskManagerAdapter,
      storageService: mockDependencies.storageService,
      validator: mockDependencies.validator,
      traceIdGenerator: mockDependencies.traceIdGenerator, // 追加
      requestIdGenerator: mockDependencies.requestIdGenerator, // 追加
    });
    expect(CliFeedbackHandler).toHaveBeenCalledWith({
      logger: mockDependencies.logger,
      eventEmitter: mockDependencies.eventEmitter,
      integrationManagerAdapter: mockDependencies.integrationManagerAdapter,
      feedbackManagerAdapter: mockDependencies.feedbackManagerAdapter,
      storageService: mockDependencies.storageService,
      validator: mockDependencies.validator,
      traceIdGenerator: mockDependencies.traceIdGenerator, // 追加
      requestIdGenerator: mockDependencies.requestIdGenerator, // 追加
    });
    expect(CliReportGenerator).toHaveBeenCalledWith({
      logger: mockDependencies.logger,
      eventEmitter: mockDependencies.eventEmitter,
      integrationManagerAdapter: mockDependencies.integrationManagerAdapter,
      storageService: mockDependencies.storageService,
      traceIdGenerator: mockDependencies.traceIdGenerator, // 追加
      requestIdGenerator: mockDependencies.requestIdGenerator, // 追加
    });
    expect(CliStatusViewer).toHaveBeenCalledWith({
      logger: mockDependencies.logger,
      eventEmitter: mockDependencies.eventEmitter,
      stateManagerAdapter: mockDependencies.stateManagerAdapter,
      taskManagerAdapter: mockDependencies.taskManagerAdapter,
      sessionManagerAdapter: mockDependencies.sessionManagerAdapter,
      traceIdGenerator: mockDependencies.traceIdGenerator, // 追加
      requestIdGenerator: mockDependencies.requestIdGenerator, // 追加
    });
    expect(CliComponentSyncer).toHaveBeenCalledWith({
      logger: mockDependencies.logger,
      eventEmitter: mockDependencies.eventEmitter,
      integrationManagerAdapter: mockDependencies.integrationManagerAdapter,
      traceIdGenerator: mockDependencies.traceIdGenerator, // 追加
      requestIdGenerator: mockDependencies.requestIdGenerator, // 追加
    });
    // Facade と InteractiveMode の検証は別のテストで行う
  });

  test('should instantiate CliFacade and CliInteractiveMode correctly and link them', () => {
    // Act
    bootstrap();

    // Assert
    // Facade のインスタンス化検証
    expect(CliFacade).toHaveBeenCalledWith({
      logger: mockDependencies.logger,
      eventEmitter: mockDependencies.eventEmitter,
      cliWorkflowManager: expect.any(CliWorkflowManager), // モックではなく実際のクラス
      cliSessionManager: expect.any(CliSessionManager),
      cliTaskManager: expect.any(CliTaskManager),
      cliFeedbackHandler: expect.any(CliFeedbackHandler),
      cliReportGenerator: expect.any(CliReportGenerator),
      cliStatusViewer: expect.any(CliStatusViewer),
      cliComponentSyncer: expect.any(CliComponentSyncer),
      cliInteractiveMode: null, // 初期値は null
    });

    // InteractiveMode のインスタンス化検証
    expect(CliInteractiveMode).toHaveBeenCalledWith({
      logger: mockDependencies.logger,
      eventEmitter: mockDependencies.eventEmitter,
      cliFacade: mockCliFacadeInstance, // Facade のモックインスタンスが渡される
      traceIdGenerator: mockDependencies.traceIdGenerator, // 追加
      requestIdGenerator: mockDependencies.requestIdGenerator, // 追加
    });

    // Facade に InteractiveMode が設定されたか検証
    expect(mockCliFacadeInstance.interactiveMode).toBe(
      mockCliInteractiveModeInstance
    );
  });

  test('should return logger and cliFacade instances', () => {
    // Act
    const result = bootstrap();

    // Assert
    expect(result).toEqual({
      logger: mockLoggerInstance,
      cliFacade: mockCliFacadeInstance,
    });
    expect(mockLoggerInstance.info).toHaveBeenCalledWith(
      'Application bootstrapped successfully.'
    );
  });

  test('should throw error if container.get fails', () => {
    // Arrange
    const error = new Error('Service not found');
    mockContainerInstance.get.mockImplementation((serviceName) => {
      if (serviceName === 'logger') {
        throw error;
      }
      return undefined;
    });
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(); // console.error をスパイ

    // Act & Assert
    expect(() => bootstrap()).toThrow(
      `Application bootstrap failed: ${error.message}`
    );
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Fatal error during application bootstrap:',
      error
    );

    consoleErrorSpy.mockRestore(); // スパイをリストア
  });

  test('should throw error if component instantiation fails', () => {
    // Arrange
    const error = new Error('WorkflowManager instantiation failed');
    CliWorkflowManager.mockImplementation(() => {
      // コンストラクタモックでエラーをスロー
      throw error;
    });
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

    // Act & Assert
    expect(() => bootstrap()).toThrow(
      `Application bootstrap failed: ${error.message}`
    );
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Fatal error during application bootstrap:',
      error
    );

    consoleErrorSpy.mockRestore();
  });
});
