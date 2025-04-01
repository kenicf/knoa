const CliStatusViewer = require('../../src/cli/status-viewer');
const { ApplicationError, CliError } = require('../../src/lib/utils/errors'); // CliError をインポート
const {
  createMockLogger,
  createMockEventEmitter,
} = require('../helpers/mock-factory');
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

  beforeEach(() => {
    mockLogger = createMockLogger();
    mockEventEmitter = createMockEventEmitter();
    mockStateManagerAdapter = {
      getCurrentState: jest.fn().mockReturnValue('task_in_progress'),
    };
    mockTaskManagerAdapter = {
      getAllTasks: jest.fn(),
    };
    mockSessionManagerAdapter = {
      getLatestSession: jest.fn(),
    };
    mockErrorHandler = {
      handle: jest.fn(),
    };

    // テスト対象インスタンスを作成
    cliStatusViewer = new CliStatusViewer({
      logger: mockLogger,
      eventEmitter: mockEventEmitter,
      stateManagerAdapter: mockStateManagerAdapter,
      taskManagerAdapter: mockTaskManagerAdapter,
      sessionManagerAdapter: mockSessionManagerAdapter,
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
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Getting workflow status'),
        expect.objectContaining({ operation })
      );
      // 成功ログの期待値を修正 (第2引数なし)
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Workflow status retrieved successfully')
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
        'cli_status',
        `${operation}_before`
      );
      expectStandardizedEventEmittedAsync(
        mockEventEmitter,
        'cli_status',
        `${operation}_after`,
        { statusInfo: expectedStatusInfo }
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
        'cli_status',
        `${operation}_after`,
        { statusInfo: result }
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
      expect(caughtError).toHaveProperty('code', 'ERR_CLI_STATUS_GET'); // コードは CliError で指定したもの
      expect(caughtError).toHaveProperty('cause', originalError);

      // emitErrorEvent が1回呼び出されたことを確認
      expect(emitErrorEvent).toHaveBeenCalledTimes(1);
      // emitErrorEvent に渡されたエラーオブジェクト (5番目の引数) を検証
      expect(emitErrorEvent).toHaveBeenCalledWith(
        mockEventEmitter,
        mockLogger,
        'CliStatusViewer',
        operation,
        caughtError, // 捕捉したエラーオブジェクトを期待値とする
        null
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
      expect(caughtError).toHaveProperty('code', 'ERR_CLI_STATUS_GET'); // コードは CliError で指定したもの
      expect(caughtError).toHaveProperty('cause', originalError);

      // emitErrorEvent が1回呼び出されたことを確認
      expect(emitErrorEvent).toHaveBeenCalledTimes(1);
      // emitErrorEvent に渡されたエラーオブジェクト (5番目の引数) を検証
      expect(emitErrorEvent).toHaveBeenCalledWith(
        mockEventEmitter,
        mockLogger,
        'CliStatusViewer',
        operation,
        caughtError, // 捕捉したエラーオブジェクトを期待値とする
        null
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
      });
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
          code: 'ERR_CLI_STATUS_GET',
          cause: originalError,
        }),
        'CliStatusViewer',
        operation,
        null // context は null が渡されるはず
      );
      expect(result).toEqual(errorHandlerResult);
      expect(emitErrorEvent).toHaveBeenCalledTimes(1); // エラーイベントは発行される
    });
  });
});
