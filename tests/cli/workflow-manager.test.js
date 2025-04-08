const CliWorkflowManager = require('../../src/cli/workflow-manager');
const { ApplicationError, CliError } = require('../../src/lib/utils/errors'); // CliError をインポート
const { createMockDependencies } = require('../helpers/mock-factory'); // createMockDependencies をインポート
// expectStandardizedEventEmittedAsync をインポート
const {
  expectStandardizedEventEmittedAsync,
} = require('../helpers/test-helpers');
// emitErrorEvent もモック化
jest.mock('../../src/lib/utils/error-helpers', () => ({
  emitErrorEvent: jest.fn(),
})); // jest.mock の閉じ括弧
const { emitErrorEvent } = require('../../src/lib/utils/error-helpers');

describe('CliWorkflowManager', () => {
  let mockLogger;
  let mockEventEmitter;
  let mockIntegrationManagerAdapter;
  let mockStateManagerAdapter;
  let mockErrorHandler;
  let cliWorkflowManager;

  let mockDependencies; // モック依存関係を保持する変数

  beforeEach(() => {
    mockDependencies = createMockDependencies(); // 共通モックを生成
    mockLogger = mockDependencies.logger; // 個別変数にも代入 (既存コードのため)
    mockEventEmitter = mockDependencies.eventEmitter; // 個別変数にも代入
    mockIntegrationManagerAdapter = mockDependencies.integrationManagerAdapter; // 共通モックから取得
    mockStateManagerAdapter = mockDependencies.stateManagerAdapter; // 共通モックから取得
    mockErrorHandler = mockDependencies.errorHandler; // 共通モックから取得

    // モックメソッドを再設定 (必要に応じて)
    mockIntegrationManagerAdapter.initializeWorkflow = jest.fn();
    // テスト対象インスタンスを作成 (errorHandler はオプション)
    cliWorkflowManager = new CliWorkflowManager({
      logger: mockLogger,
      eventEmitter: mockEventEmitter,
      integrationManagerAdapter: mockIntegrationManagerAdapter,
      stateManagerAdapter: mockStateManagerAdapter,
      traceIdGenerator: mockDependencies.traceIdGenerator, // 注入済み
      requestIdGenerator: mockDependencies.requestIdGenerator, // 注入済み
      // errorHandler: mockErrorHandler, // コメントアウトのまま
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
            // traceIdGenerator と requestIdGenerator も必須になった
          })
      ).toThrow(ApplicationError);
      expect(
        () =>
          new CliWorkflowManager({
            logger: mockLogger,
            eventEmitter: mockEventEmitter,
            integrationManagerAdapter: mockIntegrationManagerAdapter,
            stateManagerAdapter: mockStateManagerAdapter,
            traceIdGenerator: mockDependencies.traceIdGenerator,
            // requestIdGenerator がない
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
        expect.objectContaining({
          projectId,
          request,
          traceId: expect.any(String),
          requestId: expect.any(String),
        }) // traceId, requestId を追加
      );
      // ロガー検証修正
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining(
          `Workflow initialized successfully for project: ${projectId}`
        ),
        expect.objectContaining({
          traceId: expect.any(String),
          requestId: expect.any(String),
        }) // traceId, requestId を追加
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
        'cli',
        'workflow_init_before', // イベント名を修正
        { projectId, request } // データ修正
      );
      expectStandardizedEventEmittedAsync(
        mockEventEmitter,
        'cli',
        'workflow_init_after', // イベント名を修正
        { projectId, request, result: mockSuccessResult } // データ修正
      );
    });

    test('should throw ApplicationError if integrationManager returns an error object', async () => {
      const errorResult = { error: 'Initialization failed internally' };
      mockIntegrationManagerAdapter.initializeWorkflow.mockResolvedValue(
        errorResult
      );

      // エラーのスローとプロパティ検証を1つにまとめる
      await expect(
        cliWorkflowManager.initializeWorkflow(projectId, request)
      ).rejects.toThrow(
        expect.objectContaining({
          name: 'ApplicationError',
          code: 'ERR_WORKFLOW_INIT',
          context: expect.objectContaining({
            errorDetail: 'Initialization failed internally',
          }),
        })
      );

      // エラーイベントが発行されることを確認
      expect(emitErrorEvent).toHaveBeenCalledWith(
        mockEventEmitter,
        mockLogger,
        'CliWorkflowManager',
        operation,
        // エラーオブジェクトの name と code を直接検証
        expect.objectContaining({
          name: 'ApplicationError',
          code: 'ERR_WORKFLOW_INIT',
          context: expect.objectContaining({
            errorDetail: 'Initialization failed internally',
          }),
        }),
        null,
        expect.objectContaining({
          projectId,
          request,
          traceId: expect.any(String),
          requestId: expect.any(String),
        })
      );
    });

    test('should throw ApplicationError if integrationManager returns unexpected result', async () => {
      const unexpectedResult = { message: 'Something went wrong' }; // project プロパティがない
      mockIntegrationManagerAdapter.initializeWorkflow.mockResolvedValue(
        unexpectedResult
      );

      // エラーのスローとプロパティ検証を1つにまとめる
      await expect(
        cliWorkflowManager.initializeWorkflow(projectId, request)
      ).rejects.toThrow(
        expect.objectContaining({
          name: 'ApplicationError',
          code: 'ERR_WORKFLOW_INIT_UNEXPECTED',
          context: expect.objectContaining({ result: unexpectedResult }),
        })
      );

      expect(emitErrorEvent).toHaveBeenCalledWith(
        mockEventEmitter,
        mockLogger,
        'CliWorkflowManager',
        operation,
        // エラーオブジェクトの name と code を直接検証
        expect.objectContaining({
          name: 'ApplicationError',
          code: 'ERR_WORKFLOW_INIT_UNEXPECTED',
          context: expect.objectContaining({
            result: unexpectedResult,
          }),
        }),
        null,
        expect.objectContaining({
          projectId,
          request,
          traceId: expect.any(String),
          requestId: expect.any(String),
        })
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
      expect(caughtError).toHaveProperty(
        'code',
        'ERR_CLI_WORKFLOWMANAGER_INITIALIZEWORKFLOW' // 修正: クラス名を含むエラーコード
      ); // _handleError が生成するコードに修正
      expect(caughtError).toHaveProperty('cause', originalError);

      // エラーイベントが発行されることを確認
      expect(emitErrorEvent).toHaveBeenCalledTimes(1); // 1回だけ呼ばれる
      expect(emitErrorEvent).toHaveBeenCalledWith(
        mockEventEmitter,
        mockLogger,
        'CliWorkflowManager',
        operation,
        expect.objectContaining({
          // CliError でラップされていることを確認
          name: 'CliError',
          code: 'ERR_CLI_WORKFLOWMANAGER_INITIALIZEWORKFLOW', // 修正後のコード
          cause: originalError,
        }),
        null,
        expect.objectContaining({
          projectId,
          request,
          traceId: expect.any(String),
          requestId: expect.any(String),
        }) // traceId, requestId を追加
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
        traceIdGenerator: mockDependencies.traceIdGenerator, // 注入
        requestIdGenerator: mockDependencies.requestIdGenerator, // 注入
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
          // CliError でラップされていることを確認
          name: 'CliError',
          code: 'ERR_CLI_WORKFLOWMANAGER_INITIALIZEWORKFLOW', // 修正: クラス名を含むエラーコード
          cause: originalError,
        }),
        'CliWorkflowManager',
        operation,
        expect.objectContaining({
          projectId,
          request,
          traceId: expect.any(String),
          requestId: expect.any(String),
        }) // traceId, requestId を追加
      );
      expect(result).toEqual(errorHandlerResult); // errorHandler の戻り値が返される
      expect(emitErrorEvent).toHaveBeenCalledTimes(1); // errorHandler があってもエラーイベントは発行される
    });
  });

  // 他のメソッド (getWorkflowStatus など) のテストをここに追加
  // getWorkflowStatus は CliStatusViewer に移譲されるため、ここでは不要かもしれない
}); // describe('CliWorkflowManager', ...) の閉じ括弧
