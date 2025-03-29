/**
 * タスクリポジトリクラスのテスト
 */

const { TaskRepository } = require('../../../src/lib/data/task-repository');
const { NotFoundError } = require('../../../src/lib/data/repository');
const { createMockDependencies } = require('../../helpers/mock-factory');

describe('TaskRepository', () => {
  let taskRepository;
  let mockDeps;
  let mockValidator;

  beforeEach(() => {
    mockDeps = createMockDependencies();
    mockValidator = {
      validate: jest.fn().mockReturnValue({ isValid: true }),
    };
    // logger をオプションで渡すように修正
    taskRepository = new TaskRepository(mockDeps.storageService, mockValidator, { logger: mockDeps.logger });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    test('should create repository with default options', () => {
      expect(taskRepository.entityName).toBe('task');
      expect(taskRepository.directory).toBe('ai-context/tasks');
      expect(taskRepository.currentFile).toBe('current-tasks.json');
      expect(taskRepository.historyDirectory).toBe('task-history');
      expect(taskRepository.validator).toBe(mockValidator);

      // 進捗状態と状態遷移の定義が正しいか確認
      expect(Object.keys(taskRepository.progressStates)).toContain(
        'not_started'
      );
      expect(Object.keys(taskRepository.progressStates)).toContain('completed');
      expect(Object.keys(taskRepository.stateTransitions)).toContain(
        'not_started'
      );
      expect(Object.keys(taskRepository.stateTransitions)).toContain(
        'completed'
      );
    });

    test('should create repository with custom options', () => {
      const customOptions = {
        directory: 'custom-tasks',
        currentFile: 'custom-tasks.json',
        historyDirectory: 'custom-history',
      };

      const customRepo = new TaskRepository(
        mockDeps.storageService,
        mockValidator,
        { ...customOptions, logger: mockDeps.logger } // logger を追加
      );

      expect(customRepo.directory).toBe('custom-tasks');
      expect(customRepo.currentFile).toBe('custom-tasks.json');
      expect(customRepo.historyDirectory).toBe('custom-history');
    });
  });

  describe('getTasksByStatus', () => {
    test('should return tasks with matching status', async () => {
      const mockTasks = {
        tasks: [
          { id: 'T001', status: 'pending' },
          { id: 'T002', status: 'in_progress' },
          { id: 'T003', status: 'pending' },
        ],
      };

      mockDeps.storageService.fileExists.mockReturnValue(true);
      mockDeps.storageService.readJSON.mockResolvedValue(mockTasks);

      const result = await taskRepository.getTasksByStatus('pending');

      expect(result).toEqual([
        { id: 'T001', status: 'pending' },
        { id: 'T003', status: 'pending' },
      ]);
    });

    test('should return empty array if no tasks match status', async () => {
      const mockTasks = {
        tasks: [
          { id: 'T001', status: 'pending' },
          { id: 'T002', status: 'in_progress' },
        ],
      };

      mockDeps.storageService.fileExists.mockReturnValue(true);
      mockDeps.storageService.readJSON.mockResolvedValue(mockTasks);

      const result = await taskRepository.getTasksByStatus('completed');

      expect(result).toEqual([]);
    });

    test('should return empty array if tasks is not an array', async () => {
      mockDeps.storageService.fileExists.mockReturnValue(true);
      mockDeps.storageService.readJSON.mockResolvedValue({
        tasks: 'not an array',
      });

      const result = await taskRepository.getTasksByStatus('pending');

      expect(result).toEqual([]);
    });

    test('should handle error from storage service', async () => {
      mockDeps.storageService.fileExists.mockReturnValue(true);
      mockDeps.storageService.readJSON.mockRejectedValue(
        new Error('Read error')
      );

      await expect(taskRepository.getTasksByStatus('pending')).rejects.toThrow(
        'Failed to get tasks by status pending: Read error'
      );
    });
  });

  describe('getTasksByDependency', () => {
    test('should return tasks with matching dependency', async () => {
      const mockTasks = {
        tasks: [
          { id: 'T001', dependencies: [{ task_id: 'T000', type: 'strong' }] },
          { id: 'T002', dependencies: [{ task_id: 'T001', type: 'weak' }] },
          {
            id: 'T003',
            dependencies: [
              { task_id: 'T000', type: 'weak' },
              { task_id: 'T001', type: 'strong' },
            ],
          },
        ],
      };

      mockDeps.storageService.fileExists.mockReturnValue(true);
      mockDeps.storageService.readJSON.mockResolvedValue(mockTasks);

      const result = await taskRepository.getTasksByDependency('T000');

      expect(result).toEqual([
        { id: 'T001', dependencies: [{ task_id: 'T000', type: 'strong' }] },
        {
          id: 'T003',
          dependencies: [
            { task_id: 'T000', type: 'weak' },
            { task_id: 'T001', type: 'strong' },
          ],
        },
      ]);
    });

    test('should return empty array if no tasks have matching dependency', async () => {
      const mockTasks = {
        tasks: [
          { id: 'T001', dependencies: [{ task_id: 'T000', type: 'strong' }] },
          { id: 'T002', dependencies: [{ task_id: 'T001', type: 'weak' }] },
        ],
      };

      mockDeps.storageService.fileExists.mockReturnValue(true);
      mockDeps.storageService.readJSON.mockResolvedValue(mockTasks);

      const result = await taskRepository.getTasksByDependency('T003');

      expect(result).toEqual([]);
    });

    test('should handle tasks without dependencies', async () => {
      const mockTasks = {
        tasks: [
          { id: 'T001' }, // No dependencies
          { id: 'T002', dependencies: [{ task_id: 'T001', type: 'weak' }] },
        ],
      };

      mockDeps.storageService.fileExists.mockReturnValue(true);
      mockDeps.storageService.readJSON.mockResolvedValue(mockTasks);

      const result = await taskRepository.getTasksByDependency('T001');

      expect(result).toEqual([
        { id: 'T002', dependencies: [{ task_id: 'T001', type: 'weak' }] },
      ]);
    });
  });

  describe('getTasksByPriority', () => {
    test('should return tasks with matching priority', async () => {
      const mockTasks = {
        tasks: [
          { id: 'T001', priority: 1 },
          { id: 'T002', priority: 2 },
          { id: 'T003', priority: 1 },
        ],
      };

      mockDeps.storageService.fileExists.mockReturnValue(true);
      mockDeps.storageService.readJSON.mockResolvedValue(mockTasks);

      const result = await taskRepository.getTasksByPriority(1);

      expect(result).toEqual([
        { id: 'T001', priority: 1 },
        { id: 'T003', priority: 1 },
      ]);
    });
  });

  describe('getTasksByProgressState', () => {
    test('should return tasks with matching progress state', async () => {
      const mockTasks = {
        tasks: [
          { id: 'T001', progress_state: 'in_development' },
          { id: 'T002', progress_state: 'completed' },
          { id: 'T003', progress_state: 'in_development' },
        ],
      };

      mockDeps.storageService.fileExists.mockReturnValue(true);
      mockDeps.storageService.readJSON.mockResolvedValue(mockTasks);

      const result =
        await taskRepository.getTasksByProgressState('in_development');

      expect(result).toEqual([
        { id: 'T001', progress_state: 'in_development' },
        { id: 'T003', progress_state: 'in_development' },
      ]);
    });
  });

  describe('updateTaskProgress', () => {
    test('should throw NotFoundError if task not found', async () => {
      mockDeps.storageService.fileExists.mockReturnValue(true);
      mockDeps.storageService.readJSON.mockResolvedValue({ tasks: [] });

      await expect(
        taskRepository.updateTaskProgress('T001', 'in_development')
      ).rejects.toThrow(NotFoundError);
    });

    test('should throw error if progress state is invalid', async () => {
      const mockTask = { id: 'T001', progress_state: 'not_started' };
      mockDeps.storageService.fileExists.mockReturnValue(true);
      mockDeps.storageService.readJSON.mockResolvedValue({ tasks: [mockTask] });

      await expect(
        taskRepository.updateTaskProgress('T001', 'invalid_state')
      ).rejects.toThrow('Invalid progress state: invalid_state');
    });

    test('should throw error if transition is not allowed', async () => {
      const mockTask = { id: 'T001', progress_state: 'not_started' };
      mockDeps.storageService.fileExists.mockReturnValue(true);
      mockDeps.storageService.readJSON.mockResolvedValue({ tasks: [mockTask] });

      // not_started から completed への直接遷移は許可されていない
      await expect(
        taskRepository.updateTaskProgress('T001', 'completed')
      ).rejects.toThrow(
        'Transition from not_started to completed is not allowed'
      );
    });

    test('should update task progress with default percentage', async () => {
      const mockTask = {
        id: 'T001',
        progress_state: 'not_started',
        status: 'pending',
      };
      mockDeps.storageService.fileExists.mockReturnValue(true);
      mockDeps.storageService.readJSON.mockResolvedValue({ tasks: [mockTask] });

      // Mock update method
      jest.spyOn(taskRepository, 'update').mockResolvedValue({
        id: 'T001',
        progress_state: 'in_development',
        progress_percentage: 30,
        status: 'in_progress',
      });

      const result = await taskRepository.updateTaskProgress(
        'T001',
        'in_development'
      );

      expect(result).toEqual({
        id: 'T001',
        progress_state: 'in_development',
        progress_percentage: 30,
        status: 'in_progress',
      });

      expect(taskRepository.update).toHaveBeenCalledWith('T001', {
        id: 'T001',
        progress_state: 'in_development',
        progress_percentage: 30,
        status: 'in_progress',
      });
    });

    test('should update task progress with custom percentage', async () => {
      const mockTask = {
        id: 'T001',
        progress_state: 'not_started',
        status: 'pending',
      };
      mockDeps.storageService.fileExists.mockReturnValue(true);
      mockDeps.storageService.readJSON.mockResolvedValue({ tasks: [mockTask] });

      // Mock update method
      jest.spyOn(taskRepository, 'update').mockResolvedValue({
        id: 'T001',
        progress_state: 'in_development',
        progress_percentage: 25,
        status: 'in_progress',
      });

      const result = await taskRepository.updateTaskProgress(
        'T001',
        'in_development',
        25
      );

      expect(result).toEqual({
        id: 'T001',
        progress_state: 'in_development',
        progress_percentage: 25,
        status: 'in_progress',
      });

      expect(taskRepository.update).toHaveBeenCalledWith('T001', {
        id: 'T001',
        progress_state: 'in_development',
        progress_percentage: 25,
        status: 'in_progress',
      });
    });

    test('should update status to completed when progress state is completed', async () => {
      const mockTask = {
        id: 'T001',
        progress_state: 'in_testing',
        status: 'in_progress',
      };
      mockDeps.storageService.fileExists.mockReturnValue(true);
      mockDeps.storageService.readJSON.mockResolvedValue({ tasks: [mockTask] });

      // Mock update method
      jest.spyOn(taskRepository, 'update').mockResolvedValue({
        id: 'T001',
        progress_state: 'completed',
        progress_percentage: 100,
        status: 'completed',
      });

      const result = await taskRepository.updateTaskProgress(
        'T001',
        'completed'
      );

      expect(result.status).toBe('completed');
    });
  });

  describe('associateCommitWithTask', () => {
    test('should throw NotFoundError if task not found', async () => {
      mockDeps.storageService.fileExists.mockReturnValue(true);
      mockDeps.storageService.readJSON.mockResolvedValue({ tasks: [] });

      await expect(
        taskRepository.associateCommitWithTask('T001', 'commit-hash')
      ).rejects.toThrow(NotFoundError);
    });

    test('should add commit hash to git_commits array', async () => {
      const mockTask = { id: 'T001', git_commits: ['previous-hash'] };
      mockDeps.storageService.fileExists.mockReturnValue(true);
      mockDeps.storageService.readJSON.mockResolvedValue({ tasks: [mockTask] });

      // Mock update method
      jest.spyOn(taskRepository, 'update').mockResolvedValue({
        id: 'T001',
        git_commits: ['previous-hash', 'new-hash'],
      });

      const result = await taskRepository.associateCommitWithTask(
        'T001',
        'new-hash'
      );

      expect(result).toEqual({
        id: 'T001',
        git_commits: ['previous-hash', 'new-hash'],
      });

      expect(taskRepository.update).toHaveBeenCalledWith('T001', {
        id: 'T001',
        git_commits: ['previous-hash', 'new-hash'],
      });
    });

    test('should create git_commits array if it does not exist', async () => {
      const mockTask = { id: 'T001' }; // No git_commits
      mockDeps.storageService.fileExists.mockReturnValue(true);
      mockDeps.storageService.readJSON.mockResolvedValue({ tasks: [mockTask] });

      // Mock update method
      jest.spyOn(taskRepository, 'update').mockResolvedValue({
        id: 'T001',
        git_commits: ['new-hash'],
      });

      const result = await taskRepository.associateCommitWithTask(
        'T001',
        'new-hash'
      );

      expect(result).toEqual({
        id: 'T001',
        git_commits: ['new-hash'],
      });

      expect(taskRepository.update).toHaveBeenCalledWith('T001', {
        id: 'T001',
        git_commits: ['new-hash'],
      });
    });

    test('should not add duplicate commit hash', async () => {
      const mockTask = { id: 'T001', git_commits: ['existing-hash'] };
      mockDeps.storageService.fileExists.mockReturnValue(true);
      mockDeps.storageService.readJSON.mockResolvedValue({ tasks: [mockTask] });

      // Mock update method
      jest.spyOn(taskRepository, 'update').mockImplementation();

      const result = await taskRepository.associateCommitWithTask(
        'T001',
        'existing-hash'
      );

      expect(result).toEqual(mockTask);
      expect(taskRepository.update).not.toHaveBeenCalled();
    });
  });

  describe('checkDependencies', () => {
    test('should detect circular dependencies', async () => {
      const mockTasks = {
        tasks: [
          { id: 'T001', dependencies: [{ task_id: 'T003', type: 'strong' }] },
          { id: 'T002', dependencies: [{ task_id: 'T001', type: 'strong' }] },
          { id: 'T003', dependencies: [{ task_id: 'T002', type: 'strong' }] },
        ],
      };

      mockDeps.storageService.fileExists.mockReturnValue(true);
      mockDeps.storageService.readJSON.mockResolvedValue(mockTasks);

      const result = await taskRepository.checkDependencies('T001');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('循環依存が検出されました');
    });

    test('should check strong dependencies completion status', async () => {
      const mockTasks = {
        tasks: [
          {
            id: 'T001',
            dependencies: [
              { task_id: 'T002', type: 'strong' },
              { task_id: 'T003', type: 'weak' },
            ],
          },
          { id: 'T002', status: 'in_progress' }, // Not completed
          { id: 'T003', status: 'completed' },
        ],
      };

      mockDeps.storageService.fileExists.mockReturnValue(true);
      mockDeps.storageService.readJSON.mockResolvedValue(mockTasks);

      const result = await taskRepository.checkDependencies('T001');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        '強い依存関係のタスク T002 がまだ完了していません'
      );
    });

    test('should return valid result for valid dependencies', async () => {
      const mockTasks = {
        tasks: [
          {
            id: 'T001',
            dependencies: [
              { task_id: 'T002', type: 'strong' },
              { task_id: 'T003', type: 'weak' },
            ],
          },
          { id: 'T002', status: 'completed' },
          { id: 'T003', status: 'in_progress' }, // Weak dependency doesn't need to be completed
        ],
      };

      mockDeps.storageService.fileExists.mockReturnValue(true);
      mockDeps.storageService.readJSON.mockResolvedValue(mockTasks);

      const result = await taskRepository.checkDependencies('T001');

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    test('should handle missing dependencies', async () => {
      const mockTasks = {
        tasks: [
          { id: 'T001', dependencies: [{ task_id: 'T999', type: 'strong' }] }, // T999 doesn't exist
        ],
      };

      mockDeps.storageService.fileExists.mockReturnValue(true);
      mockDeps.storageService.readJSON.mockResolvedValue(mockTasks);

      const result = await taskRepository.checkDependencies('T001');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('依存タスク T999 が見つかりません');
    });
  });

  describe('getTaskHierarchy', () => {
    test('should return task hierarchy', async () => {
      const mockHierarchy = {
        epics: [{ epic_id: 'E001', title: 'Epic 1', stories: ['S001'] }],
        stories: [
          { story_id: 'S001', title: 'Story 1', tasks: ['T001', 'T002'] },
        ],
      };

      const mockData = { tasks: [], task_hierarchy: mockHierarchy };

      mockDeps.storageService.fileExists.mockReturnValue(true);
      mockDeps.storageService.readJSON.mockResolvedValue(mockData);

      const result = await taskRepository.getTaskHierarchy();

      expect(result).toEqual(mockHierarchy);
    });

    test('should return empty hierarchy if not found', async () => {
      mockDeps.storageService.fileExists.mockReturnValue(true);
      mockDeps.storageService.readJSON.mockResolvedValue({ tasks: [] });

      const result = await taskRepository.getTaskHierarchy();

      expect(result).toEqual({ epics: [], stories: [] });
    });
  });

  describe('updateTaskHierarchy', () => {
    test('should update task hierarchy', async () => {
      const mockData = {
        tasks: [],
        task_hierarchy: { epics: [], stories: [] },
      };

      mockDeps.storageService.fileExists.mockReturnValue(true);
      mockDeps.storageService.readJSON.mockResolvedValue(mockData);

      const newHierarchy = {
        epics: [{ epic_id: 'E001', title: 'Epic 1', stories: ['S001'] }],
        stories: [
          { story_id: 'S001', title: 'Story 1', tasks: ['T001', 'T002'] },
        ],
      };

      const result = await taskRepository.updateTaskHierarchy(newHierarchy);

      expect(result).toEqual(newHierarchy);
      expect(mockDeps.storageService.writeJSON).toHaveBeenCalledWith(
        'ai-context/tasks',
        'current-tasks.json',
        { tasks: [], task_hierarchy: newHierarchy }
      );
    });
  });

  describe('getCurrentFocus and setCurrentFocus', () => {
    test('should get current focus', async () => {
      mockDeps.storageService.fileExists.mockReturnValue(true);
      mockDeps.storageService.readJSON.mockResolvedValue({
        tasks: [],
        current_focus: 'T001',
      });

      const result = await taskRepository.getCurrentFocus();

      expect(result).toBe('T001');
    });

    test('should return null if current focus not set', async () => {
      mockDeps.storageService.fileExists.mockReturnValue(true);
      mockDeps.storageService.readJSON.mockResolvedValue({ tasks: [] });

      const result = await taskRepository.getCurrentFocus();

      expect(result).toBeNull();
    });

    test('should set current focus', async () => {
      const mockTask = { id: 'T001' };
      mockDeps.storageService.fileExists.mockReturnValue(true);
      mockDeps.storageService.readJSON.mockResolvedValue({ tasks: [mockTask] });

      const result = await taskRepository.setCurrentFocus('T001');

      expect(result).toBe('T001');
      expect(mockDeps.storageService.writeJSON).toHaveBeenCalledWith(
        'ai-context/tasks',
        'current-tasks.json',
        { tasks: [mockTask], current_focus: 'T001' }
      );
    });

    test('should throw NotFoundError if task not found when setting focus', async () => {
      mockDeps.storageService.fileExists.mockReturnValue(true);
      mockDeps.storageService.readJSON.mockResolvedValue({ tasks: [] });

      await expect(taskRepository.setCurrentFocus('T001')).rejects.toThrow(
        NotFoundError
      );
    });
  });
});
