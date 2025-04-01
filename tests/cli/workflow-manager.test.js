const CliWorkflowManager = require('../../src/cli/workflow-manager');
const { ApplicationError, CliError } = require('../../src/lib/utils/errors'); // CliError をインポート
const {
  createMockLogger,
  createMockEventEmitter,
} = require('../helpers/mock-factory');
// expectStandardizedEventEmittedAsync をインポート
const {
  expectStandardizedEventEmittedAsync,
} = require('../helpers/test-helpers');
// emitErrorEvent もモック化
jest.mock('../../src/lib/utils/error-helpers', () => ({
  emitErrorEvent: jest.fn(),
}));
const { emitErrorEvent } = require('../../src/lib/utils/error-helpers');

describe('CliWorkflowManager', () => {
  let mockLogger;
  let mockEventEmitter;
  let mockIntegrationManagerAdapter;
  let mockStateManagerAdapter;
  let mockErrorHandler;
  let cliWorkflowManager;

  beforeEach(() => {
    mockLogger = createMockLogger();
    mockEventEmitter = createMockEventEmitter();
    mockIntegrationManagerAdapter = {
      initializeWorkflow: jest.fn(),
    };
    mockStateManagerAdapter = {
      // 必要に応じて stateManager のメソッドをモック
    };
    mockErrorHandler = {
      handle: jest.fn(),
    };

    // テスト対象インスタンスを作成 (errorHandler はオプション)
    cliWorkflowManager = new CliWorkflowManager({
      logger: mockLogger,
      eventEmitter: mockEventEmitter,
      integrationManagerAdapter: mockIntegrationManagerAdapter,
      stateManagerAdapter: mockStateManagerAdapter,
      // errorHandler: mockErrorHandler, // エラーハンドラーテスト時に有効化
    });

    emitErrorEvent.mockClear();
  });

  describe('constructor', () => {
    test('should throw ApplicationError if required dependencies are missing', () => {
      expect(() => new CliWorkflowManager({})).toThrow(ApplicationError);
      expect(() => new CliWorkflowManager({ logger: mockLogger })).toThrow(
        ApplicationError
      );
      // 他の必須依存関係も同様にテスト
      expect(
        () =>
          new CliWorkflowManager({
            logger: mockLogger,
            eventEmitter: mockEventEmitter,
            // integrationManagerAdapter: mockIntegrationManagerAdapter, // ← これがないとエラー
            stateManagerAdapter: mockStateManagerAdapter,
          })
      ).toThrow(ApplicationError);
    });

    test('should initialize successfully with required dependencies', () => {
      expect(cliWorkflowManager.logger).toBe(mockLogger);
      expect(cliWorkflowManager.eventEmitter).toBe(mockEventEmitter);
      expect(cliWorkflowManager.integrationManager).toBe(
        mockIntegrationManagerAdapter
      );
      expect(cliWorkflowManager.stateManager).toBe(mockStateManagerAdapter);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'CliWorkflowManager initialized'
      );
    });
  });

  describe('initializeWorkflow', () => {
    const projectId = 'P123';
    const request = 'Initialize project';
    const mockSuccessResult = {
      project: projectId,
      initialized: true,
      original_request: request,
    };
    const operation = 'initializeWorkflow';

    test('should call integrationManager.initializeWorkflow and return result on success', async () => {
      mockIntegrationManagerAdapter.initializeWorkflow.mockResolvedValue(
        mockSuccessResult
      );

      const result = await cliWorkflowManager.initializeWorkflow(
        projectId,
        request
      );

      expect(
        mockIntegrationManagerAdapter.initializeWorkflow
      ).toHaveBeenCalledTimes(1);
      expect(
        mockIntegrationManagerAdapter.initializeWorkflow
      ).toHaveBeenCalledWith(projectId, request);
      expect(result).toEqual(mockSuccessResult);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Initializing workflow'),
        expect.objectContaining({ operation }) // コンテキストを修正
      );
      // ロガー検証修正
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining(
          `Workflow initialized successfully for project: ${projectId}`
        )
      );
    });

    test('should emit _before and _after events on success', async () => {
      mockIntegrationManagerAdapter.initializeWorkflow.mockResolvedValue(
        mockSuccessResult
      );

      await cliWorkflowManager.initializeWorkflow(projectId, request);

      // expectStandardizedEventEmittedAsync に変更
      expectStandardizedEventEmittedAsync(
        mockEventEmitter,
        'cli_workflow',
        `${operation}_before`,
        { projectId, request }
      );
      expectStandardizedEventEmittedAsync(
        mockEventEmitter,
        'cli_workflow',
        `${operation}_after`,
        { projectId, request, result: mockSuccessResult }
      );
    });

    test('should throw ApplicationError if integrationManager returns an error object', async () => {
      const errorResult = { error: 'Initialization failed internally' };
      mockIntegrationManagerAdapter.initializeWorkflow.mockResolvedValue(
        errorResult
      );

      await expect(
        cliWorkflowManager.initializeWorkflow(projectId, request)
      ).rejects.toThrow(ApplicationError);
      // エラーコード検証修正
      await expect(
        cliWorkflowManager.initializeWorkflow(projectId, request)
      ).rejects.toHaveProperty('code', 'ERR_WORKFLOW_INIT');

      // エラーイベントが発行されることを確認
      expect(emitErrorEvent).toHaveBeenCalledWith(
        mockEventEmitter,
        mockLogger,
        'CliWorkflowManager',
        operation,
        expect.objectContaining({ code: 'ERR_WORKFLOW_INIT' }),
        null,
        { projectId, request }
      );
    });

    test('should throw ApplicationError if integrationManager returns unexpected result', async () => {
      const unexpectedResult = { message: 'Something went wrong' }; // project プロパティがない
      mockIntegrationManagerAdapter.initializeWorkflow.mockResolvedValue(
        unexpectedResult
      );

      await expect(
        cliWorkflowManager.initializeWorkflow(projectId, request)
      ).rejects.toThrow(ApplicationError);
      // エラーコード検証修正
      await expect(
        cliWorkflowManager.initializeWorkflow(projectId, request)
      ).rejects.toHaveProperty('code', 'ERR_WORKFLOW_INIT_UNEXPECTED');

      expect(emitErrorEvent).toHaveBeenCalledWith(
        mockEventEmitter,
        mockLogger,
        'CliWorkflowManager',
        operation,
        expect.objectContaining({ code: 'ERR_WORKFLOW_INIT_UNEXPECTED' }),
        null,
        { projectId, request }
      );
    });

    test('should throw CliError and emit error event if integrationManager throws an error', async () => {
      const originalError = new Error('Network error');
      mockIntegrationManagerAdapter.initializeWorkflow.mockRejectedValue(
        originalError
      );

      // await expect(...).rejects.toThrow(...) を削除

      let caughtError;
      try {
        // initializeWorkflow を1回だけ呼び出す
        await cliWorkflowManager.initializeWorkflow(projectId, request);
      } catch (error) {
        caughtError = error;
      }

      // エラーがスローされたことを確認し、CliError であることを検証
      expect(caughtError).toBeInstanceOf(CliError);
      // エラーオブジェクトの code と cause を検証
      expect(caughtError).toHaveProperty('code', 'ERR_CLI_WORKFLOW_INIT'); // コードは CliError で指定したもの
      expect(caughtError).toHaveProperty('cause', originalError);

      // エラーイベントが発行されることを確認
      expect(emitErrorEvent).toHaveBeenCalledTimes(1); // 1回だけ呼ばれる
      expect(emitErrorEvent).toHaveBeenCalledWith(
        mockEventEmitter,
        mockLogger,
        'CliWorkflowManager',
        operation,
        caughtError, // 捕捉したエラーオブジェクトを期待値とする
        null,
        { projectId, request }
      );
    });

    test('should call errorHandler.handle if errorHandler is provided and integrationManager throws error', async () => {
      // errorHandler を設定してインスタンス再作成
      cliWorkflowManager = new CliWorkflowManager({
        logger: mockLogger,
        eventEmitter: mockEventEmitter,
        integrationManagerAdapter: mockIntegrationManagerAdapter,
        stateManagerAdapter: mockStateManagerAdapter,
        errorHandler: mockErrorHandler,
      });

      const originalError = new Error('Network error');
      mockIntegrationManagerAdapter.initializeWorkflow.mockRejectedValue(
        originalError
      );
      const errorHandlerResult = { handled: true, fallback: null };
      mockErrorHandler.handle.mockReturnValue(errorHandlerResult); // errorHandler の戻り値を設定

      const result = await cliWorkflowManager.initializeWorkflow(
        projectId,
        request
      );

      expect(mockErrorHandler.handle).toHaveBeenCalledTimes(1);
      // errorHandler.handle に CliError インスタンスが渡されることを検証
      expect(mockErrorHandler.handle).toHaveBeenCalledWith(
        expect.objectContaining({
          // CliError インスタンスであることを期待
          name: 'CliError',
          code: 'ERR_CLI_WORKFLOW_INIT',
          cause: originalError,
        }),
        'CliWorkflowManager',
        operation,
        { projectId, request }
      );
      expect(result).toEqual(errorHandlerResult); // errorHandler の戻り値が返される
      expect(emitErrorEvent).toHaveBeenCalledTimes(1); // errorHandler があってもエラーイベントは発行される
    });
  });

  // 他のメソッド (getWorkflowStatus など) のテストをここに追加
  // getWorkflowStatus は CliStatusViewer に移譲されるため、ここでは不要かもしれない
});
