const CliStatusViewer = require('../../src/cli/status-viewer');
const { ApplicationError, CliError } = require('../../src/lib/utils/errors'); // CliError をインポート
const { createMockDependencies } = require('../helpers/mock-factory'); // createMockDependencies をインポート
// expectStandardizedEventEmittedAsync をインポート
const {
  expectStandardizedEventEmittedAsync,
} = require('../helpers/test-helpers');
// emitErrorEvent をトップレベルでモック化
jest.mock('../../src/lib/utils/error-helpers', () => ({
  emitErrorEvent: jest.fn(),
}));
const { emitErrorEvent } = require('../../src/lib/utils/error-helpers');

describe('CliStatusViewer', () => {
  let mockLogger;
  let mockEventEmitter;
  let mockStateManagerAdapter;
  let mockTaskManagerAdapter;
  let mockSessionManagerAdapter;
  let mockErrorHandler;
  let cliStatusViewer;

  let mockDependencies; // モック依存関係を保持する変数

  beforeEach(() => {
    mockDependencies = createMockDependencies(); // 共通モックを生成
    mockLogger = mockDependencies.logger; // 個別変数にも代入
    mockEventEmitter = mockDependencies.eventEmitter; // 個別変数にも代入
    mockStateManagerAdapter = mockDependencies.stateManagerAdapter; // 共通モックから取得
    mockTaskManagerAdapter = mockDependencies.taskManagerAdapter; // 共通モックから取得
    mockSessionManagerAdapter = mockDependencies.sessionManagerAdapter; // 共通モックから取得
    mockErrorHandler = mockDependencies.errorHandler; // 共通モックから取得

    // モックメソッドを再設定 (必要に応じて)
    mockStateManagerAdapter.getCurrentState = jest
      .fn()
      .mockReturnValue('task_in_progress');
    mockTaskManagerAdapter.getAllTasks = jest.fn();
    mockSessionManagerAdapter.getLatestSession = jest.fn();
    mockErrorHandler.handle = jest.fn();

    // テスト対象インスタンスを作成
    cliStatusViewer = new CliStatusViewer({
      logger: mockLogger,
      eventEmitter: mockEventEmitter,
      stateManagerAdapter: mockStateManagerAdapter,
      taskManagerAdapter: mockTaskManagerAdapter,
      sessionManagerAdapter: mockSessionManagerAdapter,
      traceIdGenerator: mockDependencies.traceIdGenerator, // 注入
      requestIdGenerator: mockDependencies.requestIdGenerator, // 注入
      // errorHandler: mockErrorHandler,
    });

    // 各テスト前に emitErrorEvent のモックをクリア
    emitErrorEvent.mockClear();
  });

  describe('constructor', () => {
    test('should throw ApplicationError if required dependencies are missing', () => {
      expect(() => new CliStatusViewer({})).toThrow(ApplicationError);
      // taskManagerAdapter も必須
      expect(
        () =>
          new CliStatusViewer({
            logger: mockLogger,
            eventEmitter: mockEventEmitter,
            stateManagerAdapter: mockStateManagerAdapter,
            // taskManagerAdapter: mockTaskManagerAdapter, // ← これがないとエラー
            sessionManagerAdapter: mockSessionManagerAdapter,
          })
      ).toThrow(ApplicationError);
    });
  });

  describe('getWorkflowStatus', () => {
    const operation = 'getWorkflowStatus';
    const mockTasksResult = {
      decomposed_tasks: [
        {
          id: 'T1',
          title: 'Task 1',
          status: 'completed',
          progress_percentage: 100,
        },
        {
          id: 'T2',
          title: 'Task 2',
          status: 'in_progress',
          progress_percentage: 50,
        },
        {
          id: 'T3',
          title: 'Task 3',
          status: 'pending',
          progress_percentage: 0,
        },
      ],
      current_focus: 'T2',
    };
    const mockSessionResult = {
      session_id: 'S1',
      created_at: '2025-01-01T10:00:00Z',
      session_handover: { session_timestamp: '2025-01-01T10:00:00Z' },
    };
    const expectedStatusInfo = {
      currentState: 'task_in_progress',
      tasks: {
        count: 3,
        statusCounts: { completed: 1, in_progress: 1, pending: 1, blocked: 0 },
        currentFocus: {
          id: 'T2',
          title: 'Task 2',
          status: 'in_progress',
          progress: 50,
        },
      },
      session: {
        id: 'S1',
        timestamp: '2025-01-01T10:00:00Z',
        previousSessionId: undefined,
      },
    };

    test('should call adapters, format data, and return status info on success', async () => {
      mockStateManagerAdapter.getCurrentState.mockReturnValue(
        'task_in_progress'
      );
      mockTaskManagerAdapter.getAllTasks.mockResolvedValue(mockTasksResult);
      mockSessionManagerAdapter.getLatestSession.mockResolvedValue(
        mockSessionResult
      );

      const result = await cliStatusViewer.getWorkflowStatus();

      expect(mockStateManagerAdapter.getCurrentState).toHaveBeenCalledTimes(1);
      expect(mockTaskManagerAdapter.getAllTasks).toHaveBeenCalledTimes(1);
      expect(mockSessionManagerAdapter.getLatestSession).toHaveBeenCalledTimes(
        1
      );
      expect(result).toEqual(expectedStatusInfo);
      // logger.info が2回呼び出されることを確認
      expect(mockLogger.info).toHaveBeenCalledTimes(2);
      // 1回目の呼び出しを検証
      expect(mockLogger.info).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('Getting workflow status...'), // メッセージ修正
        expect.objectContaining({
          operation,
          traceId: expect.any(String),
          requestId: expect.any(String),
        })
      );
      // 2回目の呼び出しを検証
      expect(mockLogger.info).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('Workflow status retrieved successfully.'), // メッセージ修正
        expect.objectContaining({
          traceId: expect.any(String),
          requestId: expect.any(String),
        })
      );
    });

    test('should emit _before and _after events on success', async () => {
      mockTaskManagerAdapter.getAllTasks.mockResolvedValue(mockTasksResult);
      mockSessionManagerAdapter.getLatestSession.mockResolvedValue(
        mockSessionResult
      );
      await cliStatusViewer.getWorkflowStatus();
      // expectStandardizedEventEmittedAsync に変更
      expectStandardizedEventEmittedAsync(
        mockEventEmitter,
        'cli',
        'status_get_before', // イベント名を修正
        {} // データなし
      );
      expectStandardizedEventEmittedAsync(
        mockEventEmitter,
        'cli',
        'status_get_after', // イベント名を修正
        { statusInfo: expectedStatusInfo } // データ修正
      );
    });

    test('should handle null results from adapters gracefully', async () => {
      mockStateManagerAdapter.getCurrentState.mockReturnValue('initialized');
      mockTaskManagerAdapter.getAllTasks.mockResolvedValue(null); // タスクなし
      mockSessionManagerAdapter.getLatestSession.mockResolvedValue(null); // セッションなし

      const result = await cliStatusViewer.getWorkflowStatus();

      expect(result).toEqual({
        currentState: 'initialized',
        tasks: {
          count: 0,
          statusCounts: {
            completed: 0,
            in_progress: 0,
            pending: 0,
            blocked: 0,
          },
          currentFocus: null,
        },
        session: null,
      });
      // expectStandardizedEventEmittedAsync に変更
      expectStandardizedEventEmittedAsync(
        mockEventEmitter,
        'cli',
        'status_get_after', // イベント名を修正
        { statusInfo: result } // データ修正
      );
    });

    test('should throw CliError and emit error event if taskManager fails', async () => {
      const originalError = new Error('Task DB error');
      mockTaskManagerAdapter.getAllTasks.mockRejectedValue(originalError);
      mockSessionManagerAdapter.getLatestSession.mockResolvedValue(
        mockSessionResult
      ); // session は成功

      // await expect(...).rejects.toThrow(...) を削除

      let caughtError;
      try {
        // getWorkflowStatus を1回だけ呼び出す
        await cliStatusViewer.getWorkflowStatus();
      } catch (error) {
        caughtError = error;
      }

      // エラーがスローされたことを確認し、CliError であることを検証
      expect(caughtError).toBeInstanceOf(CliError);
      // エラーオブジェクトの code と cause を検証
      expect(caughtError).toHaveProperty(
        'code',
        'ERR_CLI_STATUSVIEWER_GETWORKFLOWSTATUS' // 修正: クラス名を含むエラーコード
      ); // _handleError が生成するコードに修正
      expect(caughtError).toHaveProperty('cause', originalError);

      // emitErrorEvent が1回呼び出されたことを確認
      expect(emitErrorEvent).toHaveBeenCalledTimes(1);
      // emitErrorEvent に渡されたエラーオブジェクト (5番目の引数) を検証
      expect(emitErrorEvent).toHaveBeenCalledWith(
        mockEventEmitter,
        mockLogger,
        'CliStatusViewer',
        operation,
        expect.objectContaining({
          // ObjectContaining を維持しつつ、期待するプロパティを修正
          name: 'CliError',
          code: 'ERR_CLI_STATUSVIEWER_GETWORKFLOWSTATUS', // 修正後のコード
          cause: originalError,
        }),
        null,
        expect.objectContaining({
          traceId: expect.any(String),
          requestId: expect.any(String),
        }) // traceId, requestId を追加
      );
    });

    test('should throw CliError and emit error event if sessionManager fails', async () => {
      const originalError = new Error('Session DB error');
      mockTaskManagerAdapter.getAllTasks.mockResolvedValue(mockTasksResult); // task は成功
      mockSessionManagerAdapter.getLatestSession.mockRejectedValue(
        originalError
      );

      // await expect(...).rejects.toThrow(...) を削除

      let caughtError;
      try {
        // getWorkflowStatus を1回だけ呼び出す
        await cliStatusViewer.getWorkflowStatus();
      } catch (error) {
        caughtError = error;
      }

      // エラーがスローされたことを確認し、CliError であることを検証
      expect(caughtError).toBeInstanceOf(CliError);
      // エラーオブジェクトの code と cause を検証
      expect(caughtError).toHaveProperty(
        'code',
        'ERR_CLI_STATUSVIEWER_GETWORKFLOWSTATUS' // 修正: クラス名を含むエラーコード
      ); // _handleError が生成するコードに修正
      expect(caughtError).toHaveProperty('cause', originalError);

      // emitErrorEvent が1回呼び出されたことを確認
      expect(emitErrorEvent).toHaveBeenCalledTimes(1);
      // emitErrorEvent に渡されたエラーオブジェクト (5番目の引数) を検証
      expect(emitErrorEvent).toHaveBeenCalledWith(
        mockEventEmitter,
        mockLogger,
        'CliStatusViewer',
        operation,
        expect.objectContaining({
          // ObjectContaining を維持しつつ、期待するプロパティを修正
          name: 'CliError',
          code: 'ERR_CLI_STATUSVIEWER_GETWORKFLOWSTATUS', // 修正後のコード
          cause: originalError,
        }),
        null,
        expect.objectContaining({
          traceId: expect.any(String),
          requestId: expect.any(String),
        }) // traceId, requestId を追加
      );
    });

    test('should call errorHandler.handle if provided on adapter failure', async () => {
      // errorHandler を設定してインスタンス再作成
      cliStatusViewer = new CliStatusViewer({
        logger: mockLogger,
        eventEmitter: mockEventEmitter,
        stateManagerAdapter: mockStateManagerAdapter,
        taskManagerAdapter: mockTaskManagerAdapter,
        sessionManagerAdapter: mockSessionManagerAdapter,
        errorHandler: mockErrorHandler,
        traceIdGenerator: mockDependencies.traceIdGenerator, // 注入
        requestIdGenerator: mockDependencies.requestIdGenerator, // 注入
      });
      // }); // ここで beforeEach を閉じるべきではない -> 削除済みのはず

      // test ケースを beforeEach の外に移動 -> test ケース定義内にコードを移動
      const originalError = new Error('Task DB error');
      mockTaskManagerAdapter.getAllTasks.mockRejectedValue(originalError);
      const errorHandlerResult = { error: 'Failed to get tasks' };
      mockErrorHandler.handle.mockReturnValue(errorHandlerResult);

      const result = await cliStatusViewer.getWorkflowStatus();

      expect(mockErrorHandler.handle).toHaveBeenCalledTimes(1);
      expect(mockErrorHandler.handle).toHaveBeenCalledWith(
        expect.objectContaining({
          // CliError インスタンスであることを期待
          name: 'CliError',
          code: 'ERR_CLI_STATUSVIEWER_GETWORKFLOWSTATUS', // 修正: クラス名を含むエラーコード
          cause: originalError,
        }),
        'CliStatusViewer',
        operation,
        expect.objectContaining({
          traceId: expect.any(String),
          requestId: expect.any(String),
        }) // traceId, requestId を追加
      );
      expect(result).toEqual(errorHandlerResult);
      expect(emitErrorEvent).toHaveBeenCalledTimes(1); // エラーイベントは発行される
    }); // test(...) の閉じ括弧
  }); // describe('getWorkflowStatus', ...) の閉じ括弧
}); // describe('CliStatusViewer', ...) の閉じ括弧
