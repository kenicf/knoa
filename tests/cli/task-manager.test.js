const CliTaskManager = require('../../src/cli/task-manager');
const {
  ApplicationError,
  ValidationError,
  CliError,
  NotFoundError,
  StorageError, // FileReadError, FileWriteError を StorageError に変更
} = require('../../src/lib/utils/errors');
const { createMockDependencies } = require('../helpers/mock-factory'); // createMockDependencies をインポート済み
// expectStandardizedEventEmittedAsync をインポート
const {
  expectStandardizedEventEmittedAsync,
} = require('../helpers/test-helpers');
// emitErrorEvent もモック化済み
jest.mock('../../src/lib/utils/error-helpers', () => ({
  emitErrorEvent: jest.fn(),
}));
const { emitErrorEvent } = require('../../src/lib/utils/error-helpers');
const path = require('path'); // path.join のモック解除のため必要

describe('CliTaskManager', () => {
  let mockLogger;
  let mockEventEmitter;
  let mockIntegrationManagerAdapter;
  let mockTaskManagerAdapter;
  let mockStorageService;
  let mockValidator;
  let mockErrorHandler;
  let cliTaskManager;

  let mockDependencies; // モック依存関係を保持する変数

  beforeEach(() => {
    mockDependencies = createMockDependencies(); // 共通モックを生成
    mockLogger = mockDependencies.logger; // 個別変数にも代入
    mockEventEmitter = mockDependencies.eventEmitter; // 個別変数にも代入
    mockIntegrationManagerAdapter = mockDependencies.integrationManagerAdapter; // 共通モックから取得
    mockTaskManagerAdapter = mockDependencies.taskManagerAdapter; // 共通モックから取得
    mockStorageService = mockDependencies.storageService; // 共通モックから取得
    mockValidator = mockDependencies.validator; // 共通モックから取得
    mockErrorHandler = mockDependencies.errorHandler; // 共通モックから取得

    // モックメソッドを再設定 (必要に応じて)
    mockIntegrationManagerAdapter.createTask = jest.fn();
    mockIntegrationManagerAdapter.updateTaskStatus = jest.fn();
    mockTaskManagerAdapter.getAllTasks = jest.fn();
    mockTaskManagerAdapter.getTaskById = jest.fn();
    mockTaskManagerAdapter.updateTaskProgress = jest.fn();
    mockTaskManagerAdapter.deleteTask = jest.fn();
    mockTaskManagerAdapter.addGitCommitToTask = jest.fn();
    mockTaskManagerAdapter.importTask = jest.fn();
    mockStorageService.writeJSON = jest.fn();
    mockStorageService.readJSON = jest.fn();
    mockValidator.validateTaskInput = jest
      .fn()
      .mockReturnValue({ isValid: true, errors: [] }); // デフォルトで成功
    // テスト対象インスタンスを作成
    cliTaskManager = new CliTaskManager({
      logger: mockLogger,
      eventEmitter: mockEventEmitter,
      integrationManagerAdapter: mockIntegrationManagerAdapter,
      taskManagerAdapter: mockTaskManagerAdapter,
      storageService: mockStorageService,
      validator: mockValidator,
      traceIdGenerator: mockDependencies.traceIdGenerator, // 注入済み
      requestIdGenerator: mockDependencies.requestIdGenerator, // 注入済み
      // errorHandler: mockErrorHandler, // コメントアウトのまま
    });

    emitErrorEvent.mockClear();
  });

  describe('constructor', () => {
    test('should throw ApplicationError if required dependencies are missing', () => {
      expect(() => new CliTaskManager({})).toThrow(ApplicationError);
      // validator も必須
      expect(
        () =>
          new CliTaskManager({
            logger: mockLogger,
            eventEmitter: mockEventEmitter,
            integrationManagerAdapter: mockIntegrationManagerAdapter,
            taskManagerAdapter: mockTaskManagerAdapter,
            storageService: mockStorageService,
            // validator: mockValidator, // ← これがないとエラー
          })
      ).toThrow(ApplicationError);
    });
  });

  describe('createTask', () => {
    const title = 'New Task';
    const description = 'Task Description';
    const taskOptions = { priority: 1, dependencies: 'T000' };
    const operation = 'createTask';
    const mockSuccessResult = { id: 'T001', title, description };

    test('should validate input, call integrationManager.createTask and return result on success', async () => {
      mockValidator.validateTaskInput.mockReturnValue({
        isValid: true,
        errors: [],
      });
      mockIntegrationManagerAdapter.createTask.mockResolvedValue(
        mockSuccessResult
      );

      const result = await cliTaskManager.createTask(
        title,
        description,
        taskOptions
      );

      expect(mockValidator.validateTaskInput).toHaveBeenCalledWith(
        expect.objectContaining({ title, description, priority: 1 })
      );
      expect(mockIntegrationManagerAdapter.createTask).toHaveBeenCalledTimes(1);
      expect(mockIntegrationManagerAdapter.createTask).toHaveBeenCalledWith(
        expect.objectContaining({ title, description, priority: 1 })
      );
      expect(result).toEqual(mockSuccessResult);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Creating new task'),
        expect.objectContaining({
          title,
          traceId: expect.any(String),
          requestId: expect.any(String),
        }) // traceId, requestId を追加
      );
      // ロガー検証修正
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining(
          `Task created successfully: ${mockSuccessResult.id}`
        ),
        expect.objectContaining({
          traceId: expect.any(String),
          requestId: expect.any(String),
        }) // traceId, requestId を追加
      );
    });

    test('should emit _before and _after events on success', async () => {
      mockValidator.validateTaskInput.mockReturnValue({
        isValid: true,
        errors: [],
      });
      mockIntegrationManagerAdapter.createTask.mockResolvedValue(
        mockSuccessResult
      );
      await cliTaskManager.createTask(title, description, taskOptions);
      // expectStandardizedEventEmittedAsync に変更
      await expectStandardizedEventEmittedAsync(
        mockEventEmitter,
        'cli',
        'task_create_before',
        { title, description, taskOptions }
      );
      await expectStandardizedEventEmittedAsync(
        mockEventEmitter,
        'cli',
        'task_create_after',
        { result: mockSuccessResult }
      );
    });

    test('should throw ValidationError if validation fails', async () => {
      const validationErrors = ['Title is too long'];
      mockValidator.validateTaskInput.mockReturnValue({
        isValid: false,
        errors: validationErrors,
      });

      await expect(
        cliTaskManager.createTask(title, description, taskOptions)
      ).rejects.toThrow(ValidationError);
      await expect(
        cliTaskManager.createTask(title, description, taskOptions)
      ).rejects.toHaveProperty('context.errors', validationErrors);

      expect(mockIntegrationManagerAdapter.createTask).not.toHaveBeenCalled();
      expect(emitErrorEvent).toHaveBeenCalledWith(
        mockEventEmitter,
        mockLogger,
        'CliTaskManager',
        operation,
        expect.any(ValidationError),
        null,
        expect.objectContaining({
          title,
          description,
          taskOptions,
          traceId: expect.any(String),
          requestId: expect.any(String),
        }) // traceId, requestId を追加
      );
    });

    test('should throw CliError and emit error event if integrationManager throws error', async () => {
      mockValidator.validateTaskInput.mockReturnValue({
        isValid: true,
        errors: [],
      });
      const originalError = new Error('API error');
      mockIntegrationManagerAdapter.createTask.mockRejectedValue(originalError);

      await expect(
        cliTaskManager.createTask(title, description, taskOptions)
      ).rejects.toThrow(CliError); // ApplicationError -> CliError
      // エラーコード検証修正
      await expect(
        cliTaskManager.createTask(title, description, taskOptions)
      ).rejects.toHaveProperty('code', 'ERR_CLI_TASKMANAGER_CREATETASK'); // 修正: クラス名を含むエラーコード
      await expect(
        cliTaskManager.createTask(title, description, taskOptions)
      ).rejects.toHaveProperty('cause', originalError);

      expect(emitErrorEvent).toHaveBeenCalledWith(
        mockEventEmitter,
        mockLogger,
        'CliTaskManager',
        operation,
        expect.objectContaining({
          // CliError でラップされていることを確認
          name: 'CliError',
          code: 'ERR_CLI_TASKMANAGER_CREATETASK', // 修正後のコード
          cause: originalError,
        }),
        null,
        expect.objectContaining({
          title,
          description,
          taskOptions,
          traceId: expect.any(String),
          requestId: expect.any(String),
        }) // traceId, requestId を追加
      );
    }); // ネストされていたテストを外に出すため、このテストケースの閉じ括弧を修正

    // ネストされていたテストケースをここに移動
    test('should call errorHandler.handle if provided on adapter failure', async () => {
      // Arrange
      // errorHandler を設定してインスタンス再作成
      cliTaskManager = new CliTaskManager({
        logger: mockLogger,
        eventEmitter: mockEventEmitter,
        integrationManagerAdapter: mockIntegrationManagerAdapter,
        taskManagerAdapter: mockTaskManagerAdapter,
        storageService: mockStorageService,
        validator: mockValidator,
        errorHandler: mockErrorHandler, // errorHandler を提供
        traceIdGenerator: mockDependencies.traceIdGenerator,
        requestIdGenerator: mockDependencies.requestIdGenerator,
      });
      mockValidator.validateTaskInput.mockReturnValue({
        isValid: true,
        errors: [],
      });
      const originalError = new Error('API error');
      mockIntegrationManagerAdapter.createTask.mockRejectedValue(originalError);
      const errorHandlerResult = { handled: true, fallbackTask: null };
      mockErrorHandler.handle.mockReturnValue(errorHandlerResult);

      // Act
      const result = await cliTaskManager.createTask(
        title,
        description,
        taskOptions
      );

      // Assert
      expect(mockErrorHandler.handle).toHaveBeenCalledTimes(1);
      expect(mockErrorHandler.handle).toHaveBeenCalledWith(
        expect.objectContaining({
          // CliError を期待
          name: 'CliError',
          code: 'ERR_CLI_TASKMANAGER_CREATETASK', // 修正後のコード
          cause: originalError,
        }),
        'CliTaskManager',
        operation,
        expect.objectContaining({ title, description, taskOptions })
      );
      expect(result).toEqual(errorHandlerResult); // errorHandler の戻り値が返る
      expect(emitErrorEvent).toHaveBeenCalledTimes(1); // エラーイベントは発行される
    });
  }); // describe('createTask', ...) の閉じ括弧を追加

  describe('updateTask', () => {
    const taskId = 'T001';
    const status = 'in_progress';
    const progress = 50;
    const operation = 'updateTask';
    const mockSuccessResult = {
      id: taskId,
      status,
      progress_percentage: progress,
    };

    test('should validate input, call integrationManager.updateTaskStatus and return result on success', async () => {
      mockIntegrationManagerAdapter.updateTaskStatus.mockResolvedValue(
        mockSuccessResult
      );

      const result = await cliTaskManager.updateTask(taskId, status, progress);

      expect(
        mockIntegrationManagerAdapter.updateTaskStatus
      ).toHaveBeenCalledWith(taskId, status, progress);
      expect(result).toEqual(mockSuccessResult);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Updating task'),
        expect.objectContaining({
          taskId,
          traceId: expect.any(String),
          requestId: expect.any(String),
        }) // traceId, requestId を追加
      );
      // ロガー検証修正
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining(`Task updated successfully: ${taskId}`),
        expect.objectContaining({
          traceId: expect.any(String),
          requestId: expect.any(String),
        }) // traceId, requestId を追加
      );
    });

    test('should emit _before and _after events on success', async () => {
      mockIntegrationManagerAdapter.updateTaskStatus.mockResolvedValue(
        mockSuccessResult
      );
      await cliTaskManager.updateTask(taskId, status, progress);
      // expectStandardizedEventEmittedAsync に変更
      await expectStandardizedEventEmittedAsync(
        mockEventEmitter,
        'cli',
        'task_update_before',
        { taskId, status, progress }
      );
      await expectStandardizedEventEmittedAsync(
        mockEventEmitter,
        'cli',
        'task_update_after',
        { taskId, status, progress, result: mockSuccessResult }
      );
    });

    test('should throw ValidationError for invalid status', async () => {
      await expect(
        cliTaskManager.updateTask(taskId, 'invalid_status', progress)
      ).rejects.toThrow(ValidationError);
      expect(
        mockIntegrationManagerAdapter.updateTaskStatus
      ).not.toHaveBeenCalled();
    });

    test('should throw ValidationError for invalid progress', async () => {
      await expect(
        cliTaskManager.updateTask(taskId, status, 101)
      ).rejects.toThrow(ValidationError);
      await expect(
        cliTaskManager.updateTask(taskId, status, -1)
      ).rejects.toThrow(ValidationError);
      await expect(
        cliTaskManager.updateTask(taskId, status, 'abc')
      ).rejects.toThrow(ValidationError);
      expect(
        mockIntegrationManagerAdapter.updateTaskStatus
      ).not.toHaveBeenCalled();
    });

    test('should throw CliError and emit error event if integrationManager throws error', async () => {
      const originalError = new Error('Update API error');
      mockIntegrationManagerAdapter.updateTaskStatus.mockRejectedValue(
        originalError
      );

      await expect(
        cliTaskManager.updateTask(taskId, status, progress)
      ).rejects.toThrow(CliError); // ApplicationError -> CliError
      // エラーコード検証修正
      await expect(
        cliTaskManager.updateTask(taskId, status, progress)
      ).rejects.toHaveProperty('code', 'ERR_CLI_TASKMANAGER_UPDATETASK'); // 修正: クラス名を含むエラーコード

      expect(emitErrorEvent).toHaveBeenCalledWith(
        mockEventEmitter,
        mockLogger,
        'CliTaskManager',
        operation,
        expect.objectContaining({
          // CliError でラップされていることを確認
          name: 'CliError',
          code: 'ERR_CLI_TASKMANAGER_UPDATETASK', // 修正後のコード
          cause: originalError,
        }),
        null,
        expect.objectContaining({
          taskId,
          status,
          progress,
          traceId: expect.any(String),
          requestId: expect.any(String),
        }) // traceId, requestId を追加
      );
    });
  });

  describe('listTasks', () => {
    const operation = 'listTasks';
    const mockTasksResult = { decomposed_tasks: [{ id: 'T1' }] };

    test('should call taskManager.getAllTasks and return result', async () => {
      mockTaskManagerAdapter.getAllTasks.mockResolvedValue(mockTasksResult);
      const result = await cliTaskManager.listTasks();
      expect(mockTaskManagerAdapter.getAllTasks).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockTasksResult);
      // logger.info が2回呼び出されることを確認
      expect(mockLogger.info).toHaveBeenCalledTimes(2);
      // 1回目の呼び出しを検証
      expect(mockLogger.info).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('Listing all tasks...'), // メッセージ修正
        expect.objectContaining({
          // operation を削除
          traceId: expect.any(String),
          requestId: expect.any(String),
        })
      );
      // 2回目の呼び出しを検証
      expect(mockLogger.info).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining(
          `Found ${mockTasksResult.decomposed_tasks.length} tasks.`
        ), // メッセージ修正
        expect.objectContaining({
          traceId: expect.any(String),
          requestId: expect.any(String),
        })
      );
      // ロガー検証修正
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining(
          `Found ${mockTasksResult.decomposed_tasks.length} tasks.`
        ),
        expect.objectContaining({
          // operation を削除
          traceId: expect.any(String),
          requestId: expect.any(String),
        })
      );
      // expectStandardizedEventEmittedAsync に変更
      await expectStandardizedEventEmittedAsync(
        mockEventEmitter,
        'cli',
        'task_list_before',
        {}
      );
      await expectStandardizedEventEmittedAsync(
        mockEventEmitter,
        'cli',
        'task_list_after',
        { count: mockTasksResult.decomposed_tasks.length }
      );
    });

    test('should return empty array structure if no tasks found', async () => {
      mockTaskManagerAdapter.getAllTasks.mockResolvedValue(null);
      const result = await cliTaskManager.listTasks();
      expect(result).toEqual({ decomposed_tasks: [] });
      // ロガー検証修正
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Found 0 tasks.'),
        expect.objectContaining({
          traceId: expect.any(String),
          requestId: expect.any(String),
        }) // traceId, requestId を追加
      );
      // expectStandardizedEventEmittedAsync に変更
      await expectStandardizedEventEmittedAsync(
        mockEventEmitter,
        'cli',
        'task_list_after',
        { count: 0 }
      );
    });

    test('should throw CliError and emit error event on failure', async () => {
      const originalError = new Error('DB error');
      mockTaskManagerAdapter.getAllTasks.mockRejectedValue(originalError);
      await expect(cliTaskManager.listTasks()).rejects.toThrow(
        CliError // ApplicationError -> CliError
      );
      // エラーコード検証修正
      await expect(cliTaskManager.listTasks()).rejects.toHaveProperty(
        'code',
        'ERR_CLI_TASKMANAGER_LISTTASKS' // 修正: クラス名を含むエラーコード
      );
      expect(emitErrorEvent).toHaveBeenCalledWith(
        mockEventEmitter,
        mockLogger,
        'CliTaskManager',
        operation,
        expect.objectContaining({
          // CliError でラップされていることを確認
          name: 'CliError',
          code: 'ERR_CLI_TASKMANAGER_LISTTASKS', // 修正後のコード
          cause: originalError,
        }),
        null,
        expect.objectContaining({
          traceId: expect.any(String),
          requestId: expect.any(String),
        }) // traceId, requestId を追加
      );
    });
  });

  describe('getTaskInfo', () => {
    const taskId = 'T123';
    const operation = 'getTaskInfo';
    const mockTask = { id: taskId, title: 'Test Task' };

    test('should call taskManager.getTaskById and return result', async () => {
      mockTaskManagerAdapter.getTaskById.mockResolvedValue(mockTask);
      const result = await cliTaskManager.getTaskInfo(taskId);
      expect(mockTaskManagerAdapter.getTaskById).toHaveBeenCalledWith(taskId);
      expect(result).toEqual(mockTask);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Getting task info'),
        expect.objectContaining({
          taskId,
          traceId: expect.any(String),
          requestId: expect.any(String),
        }) // traceId, requestId を追加
      );
      // ロガー検証修正
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining(`Task info retrieved for: ${taskId}`),
        expect.objectContaining({
          traceId: expect.any(String),
          requestId: expect.any(String),
        }) // traceId, requestId を追加
      );
      // expectStandardizedEventEmittedAsync に変更
      await expectStandardizedEventEmittedAsync(
        mockEventEmitter,
        'cli',
        'task_info_get_before',
        { taskId }
      );
      await expectStandardizedEventEmittedAsync(
        mockEventEmitter,
        'cli',
        'task_info_get_after',
        { taskId, taskFound: true }
      );
    });

    test('should throw NotFoundError if task not found', async () => {
      mockTaskManagerAdapter.getTaskById.mockResolvedValue(null);
      await expect(cliTaskManager.getTaskInfo(taskId)).rejects.toThrow(
        NotFoundError // ApplicationError -> NotFoundError
      );
      // エラーコード検証修正
      await expect(cliTaskManager.getTaskInfo(taskId)).rejects.toHaveProperty(
        'code',
        'ERR_CLI_TASK_NOT_FOUND' // Specific code
      );
      // _handleError 内で emitErrorEvent が呼ばれることを検証
      expect(emitErrorEvent).toHaveBeenCalledWith(
        mockEventEmitter,
        mockLogger,
        'CliTaskManager',
        operation,
        expect.objectContaining({
          // NotFoundError を期待
          name: 'NotFoundError',
          code: 'ERR_CLI_TASK_NOT_FOUND',
          context: expect.objectContaining({ taskId }),
        }),
        null,
        expect.objectContaining({
          // 元の context
          taskId,
          traceId: expect.any(String),
          requestId: expect.any(String),
        })
      );
      // logger.warn は呼ばれないはずなので削除
      expect(emitErrorEvent).toHaveBeenCalledWith(
        mockEventEmitter,
        mockLogger,
        'CliTaskManager',
        operation,
        expect.objectContaining({
          // NotFoundError を期待
          name: 'NotFoundError',
          code: 'ERR_CLI_TASK_NOT_FOUND',
        }),
        null,
        expect.objectContaining({
          taskId,
          traceId: expect.any(String),
          requestId: expect.any(String),
        }) // traceId, requestId を追加
      );
    });

    test('should throw CliError and emit error event on adapter failure', async () => {
      const originalError = new Error('Adapter error');
      mockTaskManagerAdapter.getTaskById.mockRejectedValue(originalError);
      await expect(cliTaskManager.getTaskInfo(taskId)).rejects.toThrow(
        CliError // ApplicationError -> CliError
      );
      // エラーコード検証修正
      await expect(cliTaskManager.getTaskInfo(taskId)).rejects.toHaveProperty(
        'code',
        'ERR_CLI_TASKMANAGER_GETTASKINFO' // 修正: クラス名を含むエラーコード
      );
      expect(emitErrorEvent).toHaveBeenCalledWith(
        mockEventEmitter,
        mockLogger,
        'CliTaskManager',
        operation,
        expect.objectContaining({
          // CliError でラップされていることを確認
          name: 'CliError',
          code: 'ERR_CLI_TASKMANAGER_GETTASKINFO', // 修正後のコード
          cause: originalError,
        }),
        null,
        expect.objectContaining({
          taskId,
          traceId: expect.any(String),
          requestId: expect.any(String),
        }) // traceId, requestId を追加
      );
    });
  });

  describe('updateTaskProgress', () => {
    const taskId = 'T1';
    const progress = 75;
    const operation = 'updateTaskProgress';
    const mockSuccessResult = { id: taskId, progress_percentage: progress };

    test('should validate progress, call taskManager.updateTaskProgress and return result', async () => {
      mockTaskManagerAdapter.updateTaskProgress.mockResolvedValue(
        mockSuccessResult
      );
      const result = await cliTaskManager.updateTaskProgress(taskId, progress);
      expect(mockTaskManagerAdapter.updateTaskProgress).toHaveBeenCalledWith(
        taskId,
        progress,
        'in_progress'
      );
      expect(result).toEqual(mockSuccessResult);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Updating task progress'),
        expect.objectContaining({
          taskId,
          progress,
          traceId: expect.any(String),
          requestId: expect.any(String),
        }) // traceId, requestId を追加
      );
      // ロガー検証修正
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining(
          `Task progress updated successfully for: ${taskId}`
        ),
        expect.objectContaining({
          traceId: expect.any(String),
          requestId: expect.any(String),
        }) // traceId, requestId を追加
      );
      // expectStandardizedEventEmittedAsync に変更
      await expectStandardizedEventEmittedAsync(
        mockEventEmitter,
        'cli',
        'task_progress_update_before',
        { taskId, progress }
      );
      await expectStandardizedEventEmittedAsync(
        mockEventEmitter,
        'cli',
        'task_progress_update_after',
        { taskId, progress, result: mockSuccessResult }
      );
    });

    test('should throw ValidationError for invalid progress', async () => {
      await expect(
        cliTaskManager.updateTaskProgress(taskId, 101)
      ).rejects.toThrow(ValidationError);
      await expect(
        cliTaskManager.updateTaskProgress(taskId, -1)
      ).rejects.toThrow(ValidationError);
      await expect(
        cliTaskManager.updateTaskProgress(taskId, 'abc')
      ).rejects.toThrow(ValidationError);
      expect(mockTaskManagerAdapter.updateTaskProgress).not.toHaveBeenCalled();
    });

    test('should throw CliError and emit error event on adapter failure', async () => {
      const originalError = new Error('Update progress error');
      mockTaskManagerAdapter.updateTaskProgress.mockRejectedValue(
        originalError
      );
      await expect(
        cliTaskManager.updateTaskProgress(taskId, progress)
      ).rejects.toThrow(CliError); // ApplicationError -> CliError
      // エラーコード検証修正
      await expect(
        cliTaskManager.updateTaskProgress(taskId, progress)
      ).rejects.toHaveProperty(
        'code',
        'ERR_CLI_TASKMANAGER_UPDATETASKPROGRESS'
      ); // 修正: クラス名を含むエラーコード
      expect(emitErrorEvent).toHaveBeenCalledWith(
        mockEventEmitter,
        mockLogger,
        'CliTaskManager',
        operation,
        expect.objectContaining({
          // CliError でラップされていることを確認
          name: 'CliError',
          code: 'ERR_CLI_TASKMANAGER_UPDATETASKPROGRESS', // 修正後のコード
          cause: originalError,
        }),
        null,
        expect.objectContaining({
          taskId,
          progress,
          traceId: expect.any(String),
          requestId: expect.any(String),
        }) // traceId, requestId を追加
      );
    });
  });

  describe('deleteTask', () => {
    const taskId = 'T1';
    const operation = 'deleteTask';

    test('should call taskManager.deleteTask and return result', async () => {
      mockTaskManagerAdapter.deleteTask.mockResolvedValue(true);
      const result = await cliTaskManager.deleteTask(taskId);
      expect(mockTaskManagerAdapter.deleteTask).toHaveBeenCalledWith(taskId);
      expect(result).toBe(true);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Deleting task'),
        expect.objectContaining({
          taskId,
          traceId: expect.any(String),
          requestId: expect.any(String),
        }) // traceId, requestId を追加
      );
      // ロガー検証修正
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining(`Task deleted successfully: ${taskId}`),
        expect.objectContaining({
          traceId: expect.any(String),
          requestId: expect.any(String),
        }) // traceId, requestId を追加
      );
      // expectStandardizedEventEmittedAsync に変更
      await expectStandardizedEventEmittedAsync(
        mockEventEmitter,
        'cli',
        'task_delete_before',
        { taskId }
      );
      await expectStandardizedEventEmittedAsync(
        mockEventEmitter,
        'cli',
        'task_delete_after',
        { taskId, success: true }
      );
    });

    test('should throw CliError if adapter returns false', async () => {
      // TaskDeleteError -> CliError
      mockTaskManagerAdapter.deleteTask.mockResolvedValue(false);
      await expect(cliTaskManager.deleteTask(taskId)).rejects.toThrow(
        CliError // ApplicationError -> CliError
      );
      // エラーコード検証修正
      await expect(cliTaskManager.deleteTask(taskId)).rejects.toHaveProperty(
        'code',
        'ERR_CLI_TASK_DELETE_FAILED' // Specific code
      );
      expect(emitErrorEvent).toHaveBeenCalledWith(
        mockEventEmitter,
        mockLogger,
        'CliTaskManager',
        operation,
        expect.objectContaining({
          // CliError を期待
          name: 'CliError',
          code: 'ERR_CLI_TASK_DELETE_FAILED',
        }),
        null,
        expect.objectContaining({
          taskId,
          traceId: expect.any(String),
          requestId: expect.any(String),
        }) // traceId, requestId を追加
      );
    });

    test('should throw CliError and emit error event on adapter failure', async () => {
      const originalError = new Error('Delete error');
      mockTaskManagerAdapter.deleteTask.mockRejectedValue(originalError);
      await expect(cliTaskManager.deleteTask(taskId)).rejects.toThrow(
        CliError // ApplicationError -> CliError
      );
      // エラーコード検証修正
      await expect(cliTaskManager.deleteTask(taskId)).rejects.toHaveProperty(
        'code',
        'ERR_CLI_TASKMANAGER_DELETETASK' // 修正: クラス名を含むエラーコード
      );
      expect(emitErrorEvent).toHaveBeenCalledWith(
        mockEventEmitter,
        mockLogger,
        'CliTaskManager',
        operation,
        expect.objectContaining({
          // CliError でラップされていることを確認
          name: 'CliError',
          code: 'ERR_CLI_TASKMANAGER_DELETETASK', // 修正後のコード
          cause: originalError,
        }),
        null,
        expect.objectContaining({
          taskId,
          traceId: expect.any(String),
          requestId: expect.any(String),
        }) // traceId, requestId を追加
      );
    });
  });

  describe('linkTaskToCommit', () => {
    const taskId = 'T1';
    const commitHash = 'abcdef1';
    const operation = 'linkTaskToCommit';
    const mockTask = { id: taskId, commits: [commitHash] };

    test('should call taskManager.addGitCommitToTask and return result', async () => {
      mockTaskManagerAdapter.addGitCommitToTask.mockResolvedValue(mockTask);
      const result = await cliTaskManager.linkTaskToCommit(taskId, commitHash);
      expect(mockTaskManagerAdapter.addGitCommitToTask).toHaveBeenCalledWith(
        taskId,
        commitHash
      );
      expect(result).toEqual(mockTask);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Linking commit'),
        expect.objectContaining({
          taskId,
          commitHash,
          traceId: expect.any(String),
          requestId: expect.any(String),
        }) // traceId, requestId を追加
      );
      // ロガー検証修正
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining(
          `Commit ${commitHash} linked to task ${taskId} successfully.`
        ),
        expect.objectContaining({
          traceId: expect.any(String),
          requestId: expect.any(String),
        }) // traceId, requestId を追加
      );
      // expectStandardizedEventEmittedAsync に変更
      await expectStandardizedEventEmittedAsync(
        mockEventEmitter,
        'cli',
        'task_link_commit_before',
        { taskId, commitHash }
      );
      await expectStandardizedEventEmittedAsync(
        mockEventEmitter,
        'cli',
        'task_link_commit_after',
        { taskId, commitHash, task: mockTask }
      );
    });

    test('should throw CliError and emit error event on adapter failure', async () => {
      const originalError = new Error('Link error');
      mockTaskManagerAdapter.addGitCommitToTask.mockRejectedValue(
        originalError
      );
      await expect(
        cliTaskManager.linkTaskToCommit(taskId, commitHash)
      ).rejects.toThrow(CliError); // ApplicationError -> CliError
      // エラーコード検証修正
      await expect(
        cliTaskManager.linkTaskToCommit(taskId, commitHash)
      ).rejects.toHaveProperty(
        'code',
        'ERR_CLI_TASKMANAGER_LINKTASKTOCOMMIT' // 修正: クラス名を含むエラーコード
      );
      expect(emitErrorEvent).toHaveBeenCalledWith(
        mockEventEmitter,
        mockLogger,
        'CliTaskManager',
        operation,
        expect.objectContaining({
          // CliError でラップされていることを確認
          name: 'CliError',
          code: 'ERR_CLI_TASKMANAGER_LINKTASKTOCOMMIT', // 修正後のコード
          cause: originalError,
        }),
        null,
        expect.objectContaining({
          taskId,
          commitHash,
          traceId: expect.any(String),
          requestId: expect.any(String),
        }) // traceId, requestId を追加
      );
    });
  });

  describe('exportTask', () => {
    const taskId = 'T1';
    const operation = 'exportTask';
    const mockTask = { id: taskId, title: 'Export Me' };
    const defaultPath = `task-${taskId}-export.json`;

    test('should get task, write to default path using StorageService, and return path', async () => {
      mockTaskManagerAdapter.getTaskById.mockResolvedValue(mockTask);
      mockStorageService.writeJSON.mockResolvedValue(true);

      const resultPath = await cliTaskManager.exportTask(taskId);

      expect(mockTaskManagerAdapter.getTaskById).toHaveBeenCalledWith(taskId);
      expect(mockStorageService.writeJSON).toHaveBeenCalledWith(
        '.',
        defaultPath,
        mockTask
      );
      expect(resultPath).toBe(defaultPath);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Exporting task'),
        expect.objectContaining({
          taskId,
          outputPath: null,
          traceId: expect.any(String),
          requestId: expect.any(String),
        }) // traceId, requestId を追加
      );
      // ロガー検証修正
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining(
          `Task exported successfully to: ${defaultPath}`
        ),
        expect.objectContaining({
          traceId: expect.any(String),
          requestId: expect.any(String),
        }) // traceId, requestId を追加
      );
      // expectStandardizedEventEmittedAsync に変更
      await expectStandardizedEventEmittedAsync(
        mockEventEmitter,
        'cli',
        'task_export_before',
        { taskId, outputPath: null }
      );
      await expectStandardizedEventEmittedAsync(
        mockEventEmitter,
        'cli',
        'task_export_after',
        { taskId, path: defaultPath }
      );
    });

    test('should use provided output path', async () => {
      const customPath = 'exports/task.json';
      mockTaskManagerAdapter.getTaskById.mockResolvedValue(mockTask);
      mockStorageService.writeJSON.mockResolvedValue(true);
      const resultPath = await cliTaskManager.exportTask(taskId, customPath);
      expect(mockStorageService.writeJSON).toHaveBeenCalledWith(
        '.',
        customPath,
        mockTask
      );
      expect(resultPath).toBe(customPath);
    });

    test('should throw NotFoundError if task not found', async () => {
      mockTaskManagerAdapter.getTaskById.mockResolvedValue(null);
      await expect(cliTaskManager.exportTask(taskId)).rejects.toThrow(
        NotFoundError // ApplicationError -> NotFoundError
      );
      // エラーコード検証修正
      await expect(cliTaskManager.exportTask(taskId)).rejects.toHaveProperty(
        'code',
        'ERR_CLI_TASK_NOT_FOUND' // Specific code
      );
      expect(emitErrorEvent).toHaveBeenCalledWith(
        mockEventEmitter,
        mockLogger,
        'CliTaskManager',
        operation,
        expect.objectContaining({
          // NotFoundError を期待
          name: 'NotFoundError',
          code: 'ERR_CLI_TASK_NOT_FOUND',
        }),
        null,
        expect.objectContaining({
          taskId,
          outputPath: null,
          traceId: expect.any(String),
          requestId: expect.any(String),
        }) // traceId, requestId を追加
      );
    });

    test('should throw StorageError if StorageService fails', async () => {
      // テスト名修正
      mockTaskManagerAdapter.getTaskById.mockResolvedValue(mockTask);
      mockStorageService.writeJSON.mockResolvedValue(false); // 書き込み失敗
      await expect(cliTaskManager.exportTask(taskId)).rejects.toThrow(
        StorageError // FileWriteError -> StorageError
      );
      // エラーコード検証修正
      await expect(cliTaskManager.exportTask(taskId)).rejects.toHaveProperty(
        'code',
        'ERR_CLI_FILE_WRITE' // Specific code
      );
      expect(emitErrorEvent).toHaveBeenCalledWith(
        mockEventEmitter,
        mockLogger,
        'CliTaskManager',
        operation,
        expect.objectContaining({
          // StorageError を期待
          name: 'StorageError',
          code: 'ERR_CLI_FILE_WRITE',
        }),
        null,
        expect.objectContaining({
          taskId,
          outputPath: null,
          traceId: expect.any(String),
          requestId: expect.any(String),
        }) // traceId, requestId を追加
      );
    });
  });

  describe('importTask', () => {
    const inputPath = 'import/task.json';
    const operation = 'importTask';
    const mockTaskData = { title: 'Imported Task' };
    const mockImportResult = { id: 'T_IMPORTED', ...mockTaskData };

    test('should read file using StorageService, call taskManager.importTask, and return result', async () => {
      mockStorageService.readJSON.mockResolvedValue(mockTaskData);
      mockTaskManagerAdapter.importTask.mockResolvedValue(mockImportResult);

      const result = await cliTaskManager.importTask(inputPath);

      expect(mockStorageService.readJSON).toHaveBeenCalledWith('.', inputPath);
      expect(mockTaskManagerAdapter.importTask).toHaveBeenCalledWith(
        mockTaskData
      );
      expect(result).toEqual(mockImportResult);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Importing task'),
        expect.objectContaining({
          inputPath,
          traceId: expect.any(String),
          requestId: expect.any(String),
        }) // traceId, requestId を追加
      );
      // ロガー検証修正
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining(
          `Task imported successfully: ${mockImportResult.id}`
        ),
        expect.objectContaining({
          traceId: expect.any(String),
          requestId: expect.any(String),
        }) // traceId, requestId を追加
      );
      // expectStandardizedEventEmittedAsync に変更
      await expectStandardizedEventEmittedAsync(
        mockEventEmitter,
        'cli',
        'task_import_before',
        { inputPath }
      );
      await expectStandardizedEventEmittedAsync(
        mockEventEmitter,
        'cli',
        'task_import_after',
        { inputPath, taskId: mockImportResult.id }
      );
    });

    test('should throw StorageError if StorageService fails to read', async () => {
      // テスト名修正
      mockStorageService.readJSON.mockResolvedValue(null); // 読み込み失敗
      await expect(cliTaskManager.importTask(inputPath)).rejects.toThrow(
        StorageError // FileReadError -> StorageError
      );
      // エラーコード検証修正
      await expect(cliTaskManager.importTask(inputPath)).rejects.toHaveProperty(
        'code',
        'ERR_CLI_FILE_READ' // Specific code
      );
      expect(mockTaskManagerAdapter.importTask).not.toHaveBeenCalled();
      expect(emitErrorEvent).toHaveBeenCalledWith(
        mockEventEmitter,
        mockLogger,
        'CliTaskManager',
        operation,
        expect.objectContaining({
          // StorageError を期待
          name: 'StorageError',
          code: 'ERR_CLI_FILE_READ',
        }),
        null,
        expect.objectContaining({
          inputPath,
          traceId: expect.any(String),
          requestId: expect.any(String),
        }) // traceId, requestId を追加
      );
    });

    test('should throw CliError if importTask returns unexpected result', async () => {
      // ImportUnexpectedError -> CliError
      mockStorageService.readJSON.mockResolvedValue(mockTaskData);
      mockTaskManagerAdapter.importTask.mockResolvedValue({
        message: 'wrong format',
      }); // 期待しない結果
      await expect(cliTaskManager.importTask(inputPath)).rejects.toThrow(
        CliError // 実装に合わせて CliError を期待
      );
      // エラーコード検証修正
      await expect(cliTaskManager.importTask(inputPath)).rejects.toHaveProperty(
        'code',
        'ERR_CLI_TASK_IMPORT_UNEXPECTED' // 実装に合わせてCLI固有コードを期待
      );
      expect(emitErrorEvent).toHaveBeenCalledWith(
        mockEventEmitter,
        mockLogger,
        'CliTaskManager',
        operation,
        expect.objectContaining({
          // CliError を期待
          name: 'CliError',
          code: 'ERR_CLI_TASK_IMPORT_UNEXPECTED',
        }),
        null,
        expect.objectContaining({
          inputPath,
          traceId: expect.any(String),
          requestId: expect.any(String),
        }) // traceId, requestId を追加
      );
    });

    test('should throw CliError and emit error event on adapter failure', async () => {
      const originalError = new Error('Import conflict');
      mockStorageService.readJSON.mockResolvedValue(mockTaskData);
      mockTaskManagerAdapter.importTask.mockRejectedValue(originalError);
      await expect(cliTaskManager.importTask(inputPath)).rejects.toThrow(
        CliError // ApplicationError -> CliError
      );
      // エラーコード検証修正
      await expect(cliTaskManager.importTask(inputPath)).rejects.toHaveProperty(
        'code',
        'ERR_CLI_TASKMANAGER_IMPORTTASK' // 修正: クラス名を含むエラーコード
      );
      expect(emitErrorEvent).toHaveBeenCalledWith(
        mockEventEmitter,
        mockLogger,
        'CliTaskManager',
        operation,
        expect.objectContaining({
          // CliError でラップされていることを確認
          name: 'CliError',
          code: 'ERR_CLI_TASKMANAGER_IMPORTTASK', // 修正後のコード
          cause: originalError,
        }),
        null,
        expect.objectContaining({
          inputPath,
          traceId: expect.any(String),
          requestId: expect.any(String),
        }) // traceId, requestId を追加
      );
    });
  });
}); // トップレベルの describe('CliTaskManager', ...) を閉じる
