const CliTaskManager = require('../../src/cli/task-manager');
const {
  ApplicationError,
  ValidationError,
  CliError,
  NotFoundError,
  StorageError, // FileReadError, FileWriteError を StorageError に変更
} = require('../../src/lib/utils/errors');
const {
  createMockLogger,
  createMockEventEmitter,
  createMockStorageService,
  createMockValidator,
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

  beforeEach(() => {
    mockLogger = createMockLogger();
    mockEventEmitter = createMockEventEmitter();
    mockIntegrationManagerAdapter = {
      createTask: jest.fn(),
      updateTaskStatus: jest.fn(),
    };
    mockTaskManagerAdapter = {
      getAllTasks: jest.fn(),
      getTaskById: jest.fn(),
      updateTaskProgress: jest.fn(),
      deleteTask: jest.fn(),
      addGitCommitToTask: jest.fn(),
      importTask: jest.fn(),
    };
    mockStorageService = createMockStorageService();
    mockValidator = createMockValidator();
    mockErrorHandler = {
      handle: jest.fn(),
    };

    // テスト対象インスタンスを作成
    cliTaskManager = new CliTaskManager({
      logger: mockLogger,
      eventEmitter: mockEventEmitter,
      integrationManagerAdapter: mockIntegrationManagerAdapter,
      taskManagerAdapter: mockTaskManagerAdapter,
      storageService: mockStorageService,
      validator: mockValidator,
      // errorHandler: mockErrorHandler,
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
        expect.objectContaining({ title }) // コンテキストをチェック
      );
      // ロガー検証修正
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining(
          `Task created successfully: ${mockSuccessResult.id}`
        )
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
        // await を追加
        mockEventEmitter,
        'cli_task',
        `${operation}_before`,
        { title, description, taskOptions }
      );
      await expectStandardizedEventEmittedAsync(
        // await を追加
        mockEventEmitter,
        'cli_task',
        `${operation}_after`,
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
        { title, description, taskOptions }
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
      ).rejects.toHaveProperty('code', 'ERR_CLI_TASK_CREATE'); // Specific code
      await expect(
        cliTaskManager.createTask(title, description, taskOptions)
      ).rejects.toHaveProperty('cause', originalError);

      expect(emitErrorEvent).toHaveBeenCalledWith(
        mockEventEmitter,
        mockLogger,
        'CliTaskManager',
        operation,
        expect.any(CliError), // Verify it's a CliError instance
        null,
        { title, description, taskOptions }
      );
    });
  });

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
        expect.objectContaining({ taskId })
      );
      // ロガー検証修正
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining(`Task updated successfully: ${taskId}`)
      );
    });

    test('should emit _before and _after events on success', async () => {
      mockIntegrationManagerAdapter.updateTaskStatus.mockResolvedValue(
        mockSuccessResult
      );
      await cliTaskManager.updateTask(taskId, status, progress);
      // expectStandardizedEventEmittedAsync に変更
      await expectStandardizedEventEmittedAsync(
        // await を追加
        mockEventEmitter,
        'cli_task',
        `${operation}_before`,
        { taskId, status, progress }
      );
      await expectStandardizedEventEmittedAsync(
        // await を追加
        mockEventEmitter,
        'cli_task',
        `${operation}_after`,
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
      ).rejects.toHaveProperty('code', 'ERR_CLI_TASK_UPDATE'); // Specific code

      expect(emitErrorEvent).toHaveBeenCalledWith(
        mockEventEmitter,
        mockLogger,
        'CliTaskManager',
        operation,
        expect.any(CliError), // Verify it's a CliError instance
        null,
        { taskId, status, progress }
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
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Listing all tasks'),
        expect.objectContaining({ operation }) // コンテキストをチェック
      );
      // ロガー検証修正
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining(
          `Found ${mockTasksResult.decomposed_tasks.length} tasks.`
        )
      );
      // expectStandardizedEventEmittedAsync に変更
      await expectStandardizedEventEmittedAsync(
        // await を追加
        mockEventEmitter,
        'cli_task',
        `${operation}_before`
      );
      await expectStandardizedEventEmittedAsync(
        // await を追加
        mockEventEmitter,
        'cli_task',
        `${operation}_after`,
        { count: mockTasksResult.decomposed_tasks.length }
      );
    });

    test('should return empty array structure if no tasks found', async () => {
      mockTaskManagerAdapter.getAllTasks.mockResolvedValue(null);
      const result = await cliTaskManager.listTasks();
      expect(result).toEqual({ decomposed_tasks: [] });
      // ロガー検証修正
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Found 0 tasks.')
      );
      // expectStandardizedEventEmittedAsync に変更
      await expectStandardizedEventEmittedAsync(
        // await を追加
        mockEventEmitter,
        'cli_task',
        `${operation}_after`,
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
        'ERR_CLI_TASK_LIST' // Specific code
      );
      expect(emitErrorEvent).toHaveBeenCalledWith(
        mockEventEmitter,
        mockLogger,
        'CliTaskManager',
        operation,
        expect.any(CliError) // Verify it's a CliError instance
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
        expect.objectContaining({ taskId })
      );
      // ロガー検証修正
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining(`Task info retrieved for: ${taskId}`)
      );
      // expectStandardizedEventEmittedAsync に変更
      await expectStandardizedEventEmittedAsync(
        // await を追加
        mockEventEmitter,
        'cli_task',
        `${operation}_before`,
        { taskId }
      );
      await expectStandardizedEventEmittedAsync(
        // await を追加
        mockEventEmitter,
        'cli_task',
        `${operation}_after`,
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
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Task not found'),
        expect.objectContaining({ taskId })
      );
      expect(emitErrorEvent).toHaveBeenCalledWith(
        mockEventEmitter,
        mockLogger,
        'CliTaskManager',
        operation,
        expect.any(NotFoundError), // Verify it's a NotFoundError instance
        null,
        { taskId }
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
        'ERR_CLI_TASK_INFO' // Specific code
      );
      expect(emitErrorEvent).toHaveBeenCalledWith(
        mockEventEmitter,
        mockLogger,
        'CliTaskManager',
        operation,
        expect.any(CliError), // Verify it's a CliError instance
        null,
        { taskId }
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
        expect.objectContaining({ taskId, progress })
      );
      // ロガー検証修正
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining(
          `Task progress updated successfully for: ${taskId}`
        )
      );
      // expectStandardizedEventEmittedAsync に変更
      await expectStandardizedEventEmittedAsync(
        // await を追加
        mockEventEmitter,
        'cli_task',
        `${operation}_before`,
        { taskId, progress }
      );
      await expectStandardizedEventEmittedAsync(
        // await を追加
        mockEventEmitter,
        'cli_task',
        `${operation}_after`,
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
      ).rejects.toHaveProperty('code', 'ERR_CLI_TASK_PROGRESS'); // Specific code
      expect(emitErrorEvent).toHaveBeenCalledWith(
        mockEventEmitter,
        mockLogger,
        'CliTaskManager',
        operation,
        expect.any(CliError), // Verify it's a CliError instance
        null,
        { taskId, progress }
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
        expect.objectContaining({ taskId })
      );
      // ロガー検証修正
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining(`Task deleted successfully: ${taskId}`)
      );
      // expectStandardizedEventEmittedAsync に変更
      await expectStandardizedEventEmittedAsync(
        // await を追加
        mockEventEmitter,
        'cli_task',
        `${operation}_before`,
        { taskId }
      );
      await expectStandardizedEventEmittedAsync(
        // await を追加
        mockEventEmitter,
        'cli_task',
        `${operation}_after`,
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
        expect.any(CliError), // Verify it's a CliError instance
        null,
        { taskId }
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
        'ERR_CLI_TASK_DELETE' // Specific code
      );
      expect(emitErrorEvent).toHaveBeenCalledWith(
        mockEventEmitter,
        mockLogger,
        'CliTaskManager',
        operation,
        expect.any(CliError), // Verify it's a CliError instance
        null,
        { taskId }
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
        expect.objectContaining({ taskId, commitHash })
      );
      // ロガー検証修正
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining(
          `Commit ${commitHash} linked to task ${taskId} successfully.`
        )
      );
      // expectStandardizedEventEmittedAsync に変更
      await expectStandardizedEventEmittedAsync(
        // await を追加
        mockEventEmitter,
        'cli_task',
        `${operation}_before`,
        { taskId, commitHash }
      );
      await expectStandardizedEventEmittedAsync(
        // await を追加
        mockEventEmitter,
        'cli_task',
        `${operation}_after`,
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
      ).rejects.toHaveProperty('code', 'ERR_CLI_TASK_LINK_COMMIT'); // Specific code
      expect(emitErrorEvent).toHaveBeenCalledWith(
        mockEventEmitter,
        mockLogger,
        'CliTaskManager',
        operation,
        expect.any(CliError), // Verify it's a CliError instance
        null,
        { taskId, commitHash }
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
        expect.objectContaining({ taskId })
      );
      // ロガー検証修正
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining(`Task exported successfully to: ${defaultPath}`)
      );
      // expectStandardizedEventEmittedAsync に変更
      await expectStandardizedEventEmittedAsync(
        // await を追加
        mockEventEmitter,
        'cli_task',
        `${operation}_before`,
        { taskId, outputPath: null }
      );
      await expectStandardizedEventEmittedAsync(
        // await を追加
        mockEventEmitter,
        'cli_task',
        `${operation}_after`,
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
        expect.any(NotFoundError), // Verify it's a NotFoundError instance
        null,
        { taskId, outputPath: null }
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
        expect.any(StorageError), // Verify it's a StorageError instance
        null,
        { taskId, outputPath: null }
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
        expect.objectContaining({ inputPath })
      );
      // ロガー検証修正
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining(
          `Task imported successfully: ${mockImportResult.id}`
        )
      );
      // expectStandardizedEventEmittedAsync に変更
      await expectStandardizedEventEmittedAsync(
        // await を追加
        mockEventEmitter,
        'cli_task',
        `${operation}_before`,
        { inputPath }
      );
      await expectStandardizedEventEmittedAsync(
        // await を追加
        mockEventEmitter,
        'cli_task',
        `${operation}_after`,
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
        expect.any(StorageError), // Verify it's a StorageError instance
        null,
        { inputPath }
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
        expect.any(CliError), // Verify it's a CliError instance
        null,
        { inputPath }
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
        'ERR_CLI_TASK_IMPORT' // Specific code
      );
      expect(emitErrorEvent).toHaveBeenCalledWith(
        mockEventEmitter,
        mockLogger,
        'CliTaskManager',
        operation,
        expect.any(CliError), // Verify it's a CliError instance
        null,
        { inputPath }
      );
    });
  });
});
