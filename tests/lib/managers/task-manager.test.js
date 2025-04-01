/**
 * タスク管理ユーティリティのテスト
 */

const { TaskManager } = require('../../../src/lib/managers/task-manager');
const { createMockDependencies } = require('../../helpers/mock-factory');

// テストデータ
const validTask = {
  id: 'T001',
  title: 'テストタスク',
  description: 'テスト用のタスク',
  status: 'in_progress',
  dependencies: [],
  priority: 3,
  estimated_hours: 2,
  progress_percentage: 50,
  progress_state: 'in_development',
  git_commits: [],
};

const tasksWithDependencies = [
  {
    id: 'T001',
    title: 'タスク1',
    description: 'タスク1の説明',
    status: 'completed',
    dependencies: [],
    priority: 5,
    progress_percentage: 100,
    progress_state: 'completed',
  },
  {
    id: 'T002',
    title: 'タスク2',
    description: 'タスク2の説明',
    status: 'in_progress',
    dependencies: [
      {
        task_id: 'T001',
        type: 'strong',
      },
    ],
    priority: 4,
    progress_percentage: 50,
    progress_state: 'in_development',
  },
  {
    id: 'T003',
    title: 'タスク3',
    description: 'タスク3の説明',
    status: 'pending',
    dependencies: [
      {
        task_id: 'T002',
        type: 'strong',
      },
      {
        task_id: 'T001',
        type: 'weak',
      },
    ],
    priority: 3,
    progress_percentage: 0,
    progress_state: 'not_started',
  },
];

// Jestのテスト
describe('TaskManager', () => {
  let taskManager;
  let mockDeps;
  let mockTaskRepository;
  let mockTaskValidator;

  beforeEach(() => {
    // モック依存関係の作成
    mockDeps = createMockDependencies();
    mockTaskRepository = {
      // TaskRepository のモックを作成
      getAll: jest.fn(),
      getById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      // 他に必要なメソッドがあれば追加
    };
    mockTaskValidator = {
      // TaskValidator のモックを作成
      validate: jest.fn().mockReturnValue({ isValid: true, errors: [] }),
      validateHierarchy: jest
        .fn()
        .mockReturnValue({ isValid: true, errors: [] }),
    };

    // TaskManagerのインスタンスを作成 (新しいコンストラクタに合わせて修正)
    taskManager = new TaskManager({
      taskRepository: mockTaskRepository, // storageService の代わりに taskRepository を注入
      taskValidator: mockTaskValidator, // taskValidator を注入
      gitService: mockDeps.gitService,
      logger: mockDeps.logger,
      eventEmitter: mockDeps.eventEmitter,
      errorHandler: mockDeps.errorHandler,
      config: {
        // tasksDir や currentTasksFile は TaskManager では不要になった
      },
    });
  });

  test('コンストラクタで依存関係を正しく設定する', () => {
    expect(taskManager.taskRepository).toBe(mockTaskRepository); // storageService -> taskRepository
    console.log('TaskManager instance in test:', taskManager);
    console.log('taskValidator property:', taskManager.taskValidator);
    expect(taskManager.taskValidator).toBe(mockTaskValidator); // taskValidator を確認
    expect(taskManager.gitService).toBe(mockDeps.gitService);
    expect(taskManager.logger).toBe(mockDeps.logger);
    expect(taskManager.eventEmitter).toBe(mockDeps.eventEmitter);
    expect(taskManager.errorHandler).toBe(mockDeps.errorHandler);
    // expect(taskManager.tasksDir).toBe('test-tasks'); // tasksDir は削除された
  });

  test('必須の依存関係が欠けている場合はエラーをスローする', () => {
    const validOptions = {
      taskRepository: mockTaskRepository,
      taskValidator: mockTaskValidator,
      gitService: mockDeps.gitService,
      logger: mockDeps.logger,
      eventEmitter: mockDeps.eventEmitter,
      errorHandler: mockDeps.errorHandler,
    };

    expect(
      () => new TaskManager({ ...validOptions, taskRepository: null })
    ).toThrow('TaskManager requires a taskRepository instance');
    expect(
      () => new TaskManager({ ...validOptions, taskValidator: null })
    ).toThrow('TaskManager requires a taskValidator instance');
    expect(
      () => new TaskManager({ ...validOptions, gitService: null })
    ).toThrow('TaskManager requires a gitService instance');
    expect(() => new TaskManager({ ...validOptions, logger: null })).toThrow(
      'TaskManager requires a logger instance'
    );
    expect(
      () => new TaskManager({ ...validOptions, eventEmitter: null })
    ).toThrow('TaskManager requires an eventEmitter instance');
    expect(
      () => new TaskManager({ ...validOptions, errorHandler: null })
    ).toThrow('TaskManager requires an errorHandler instance');
  });

  // タスク検証のテスト (validateTask は TaskValidator に移動したので、ここでは不要)
  // describe('validateTask', () => { ... });

  // getAllTasks のテスト
  describe('getAllTasks', () => {
    test('should return tasks from repository', async () => {
      const mockTaskData = { tasks: [validTask] };
      mockTaskRepository.getAll.mockResolvedValue(mockTaskData);

      const result = await taskManager.getAllTasks();

      expect(result).toEqual(mockTaskData.tasks); // Returns the tasks array directly
      expect(mockTaskRepository.getAll).toHaveBeenCalledTimes(1);
    });

    test('should return empty array if repository returns null or invalid data', async () => {
      mockTaskRepository.getAll.mockResolvedValueOnce(null);
      let result = await taskManager.getAllTasks();
      expect(result).toEqual([]);

      mockTaskRepository.getAll.mockResolvedValueOnce({
        tasks: 'not an array',
      });
      result = await taskManager.getAllTasks();
      expect(result).toEqual([]);
    });

    test('should handle error from repository and return empty array', async () => {
      const error = new Error('Repo error');
      mockTaskRepository.getAll.mockRejectedValue(error);

      const result = await taskManager.getAllTasks();

      expect(result).toEqual([]);
      expect(mockDeps.errorHandler.handle).toHaveBeenCalledWith(
        error,
        'TaskManager',
        'getAllTasks'
      );
    });
  });

  // getTaskById のテスト
  describe('getTaskById', () => {
    test('should return task from repository if found', async () => {
      mockTaskRepository.getById.mockResolvedValue(validTask);

      const result = await taskManager.getTaskById('T001');

      expect(result).toEqual(validTask);
      expect(mockTaskRepository.getById).toHaveBeenCalledWith('T001');
    });

    test('should return null if repository returns null', async () => {
      mockTaskRepository.getById.mockResolvedValue(null);

      const result = await taskManager.getTaskById('T999');

      expect(result).toBeNull();
      expect(mockTaskRepository.getById).toHaveBeenCalledWith('T999');
    });

    test('should throw error if task ID format is invalid', async () => {
      await expect(taskManager.getTaskById('invalid-id')).rejects.toThrow(
        '不正なタスクID形式です: invalid-id'
      );
      expect(mockTaskRepository.getById).not.toHaveBeenCalled(); // Repository method should not be called
    });

    test('should handle error from repository and return null', async () => {
      const error = new Error('Repo error');
      mockTaskRepository.getById.mockRejectedValue(error);

      const result = await taskManager.getTaskById('T001');

      expect(result).toBeNull();
      expect(mockDeps.errorHandler.handle).toHaveBeenCalledWith(
        error,
        'TaskManager',
        'getTaskById',
        { taskId: 'T001' }
      );
    });
  });

  // createTask のテスト
  describe('createTask', () => {
    // beforeEach で mockTaskValidator と mockTaskRepository を設定済み

    test('should create task successfully if validation passes', async () => {
      const newTaskData = {
        id: 'T004',
        title: 'New Task',
        description: 'Desc',
        priority: 1,
        status: 'pending',
      };
      mockTaskValidator.validate.mockReturnValue({ isValid: true, errors: [] }); // Ensure validation passes
      mockTaskRepository.create.mockResolvedValue({
        ...newTaskData,
        createdAt: new Date().toISOString(),
      }); // Mock repository create

      const result = await taskManager.createTask(newTaskData);

      expect(mockTaskValidator.validate).toHaveBeenCalledWith(newTaskData);
      expect(mockTaskRepository.create).toHaveBeenCalledWith(newTaskData);
      expect(mockDeps.eventEmitter.emitStandardized).toHaveBeenCalledWith(
        'task_manager',
        'task_created',
        { task: expect.objectContaining(newTaskData) }
      );
      expect(mockDeps.logger.info).toHaveBeenCalledWith('Task created: T004', {
        taskId: 'T004',
      });
      expect(result).toEqual(expect.objectContaining(newTaskData));
    });

    test('should throw validation error if validation fails', async () => {
      const invalidTaskData = { title: 'Invalid Task' };
      const validationErrors = ['ID is required'];
      mockTaskValidator.validate.mockReturnValue({
        isValid: false,
        errors: validationErrors,
      });

      await expect(taskManager.createTask(invalidTaskData)).rejects.toThrow(
        `Invalid task data: ${validationErrors.join(', ')}`
      );
      expect(mockTaskRepository.create).not.toHaveBeenCalled();
      expect(mockDeps.eventEmitter.emitStandardized).not.toHaveBeenCalledWith(
        'task_manager',
        'task_created',
        expect.anything()
      );
    });

    test('should handle error from taskRepository.create', async () => {
      const newTaskData = {
        id: 'T005',
        title: 'New Task 2',
        description: 'Desc',
        priority: 1,
        status: 'pending',
      };
      const createError = new Error('DB error');
      mockTaskValidator.validate.mockReturnValue({ isValid: true, errors: [] }); // Ensure validation passes
      mockTaskRepository.create.mockRejectedValue(createError);

      await expect(taskManager.createTask(newTaskData)).rejects.toThrow(
        'Failed to create task: DB error'
      );
      expect(mockDeps.errorHandler.handle).toHaveBeenCalledWith(
        createError,
        'TaskManager',
        'createTask',
        { taskData: newTaskData }
      );
      expect(mockDeps.eventEmitter.emitStandardized).not.toHaveBeenCalledWith(
        'task_manager',
        'task_created',
        expect.anything()
      );
    });
  });

  // updateTask のテスト
  describe('updateTask', () => {
    // beforeEach で mockTaskValidator と mockTaskRepository を設定済み (update メソッドもモックする)
    beforeEach(() => {
      mockTaskRepository.update = jest
        .fn()
        .mockImplementation(async (id, data) => ({
          id,
          ...data,
          updatedAt: new Date().toISOString(),
        }));
    });

    test('should update task successfully if validation passes', async () => {
      const taskId = 'T001';
      const updateData = { status: 'completed', progress_percentage: 100 };
      const expectedUpdatedTask = { id: taskId, ...updateData };
      mockTaskValidator.validate.mockReturnValue({ isValid: true, errors: [] }); // Ensure validation passes
      mockTaskRepository.update.mockResolvedValue({
        ...expectedUpdatedTask,
        updatedAt: new Date().toISOString(),
      }); // Mock repository update

      const result = await taskManager.updateTask(taskId, updateData);

      expect(mockTaskValidator.validate).toHaveBeenCalledWith({
        ...updateData,
        id: taskId,
      });
      expect(mockTaskRepository.update).toHaveBeenCalledWith(
        taskId,
        updateData
      );
      expect(mockDeps.eventEmitter.emitStandardized).toHaveBeenCalledWith(
        'task_manager',
        'task_updated',
        { taskId, updateData }
      );
      expect(mockDeps.logger.info).toHaveBeenCalledWith(
        `Task updated: ${taskId}`,
        { taskId }
      );
      expect(result).toEqual(expect.objectContaining(expectedUpdatedTask));
    });

    test('should throw validation error if validation fails', async () => {
      const taskId = 'T001';
      const invalidUpdateData = { status: 'invalid_status' };
      const validationErrors = ['Invalid status'];
      mockTaskValidator.validate.mockReturnValue({
        isValid: false,
        errors: validationErrors,
      });

      await expect(
        taskManager.updateTask(taskId, invalidUpdateData)
      ).rejects.toThrow(`Invalid task data: ${validationErrors.join(', ')}`);
      expect(mockTaskRepository.update).not.toHaveBeenCalled();
      expect(mockDeps.eventEmitter.emitStandardized).not.toHaveBeenCalledWith(
        'task_manager',
        'task_updated',
        expect.anything()
      );
    });

    test('should handle NotFoundError from taskRepository.update', async () => {
      const taskId = 'T999'; // Non-existent task
      const updateData = { status: 'completed' };
      const notFoundError = new Error('Task not found'); // Simulate NotFoundError
      notFoundError.name = 'NotFoundError';
      mockTaskValidator.validate.mockReturnValue({ isValid: true, errors: [] }); // Ensure validation passes
      mockTaskRepository.update.mockRejectedValue(notFoundError);

      await expect(taskManager.updateTask(taskId, updateData)).rejects.toThrow(
        `Failed to update task ${taskId}: Task not found`
      );
      expect(mockDeps.errorHandler.handle).toHaveBeenCalledWith(
        notFoundError,
        'TaskManager',
        'updateTask',
        { taskId, updateData }
      );
      expect(mockDeps.eventEmitter.emitStandardized).not.toHaveBeenCalledWith(
        'task_manager',
        'task_updated',
        expect.anything()
      );
    });

    test('should handle other errors from taskRepository.update', async () => {
      const taskId = 'T001';
      const updateData = { status: 'completed' };
      const updateError = new Error('DB error');
      mockTaskValidator.validate.mockReturnValue({ isValid: true, errors: [] }); // Ensure validation passes
      mockTaskRepository.update.mockRejectedValue(updateError);

      await expect(taskManager.updateTask(taskId, updateData)).rejects.toThrow(
        `Failed to update task ${taskId}: DB error`
      );
      expect(mockDeps.errorHandler.handle).toHaveBeenCalledWith(
        updateError,
        'TaskManager',
        'updateTask',
        { taskId, updateData }
      );
      expect(mockDeps.eventEmitter.emitStandardized).not.toHaveBeenCalledWith(
        'task_manager',
        'task_updated',
        expect.anything()
      );
    });
  });
});
