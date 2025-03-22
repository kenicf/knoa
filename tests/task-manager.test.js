/**
 * タスク管理ユーティリティのテスト
 */

const { TaskManager } = require('../src/utils/task-manager');
const { createMockDependencies } = require('./helpers/mock-factory');

// テストデータ
const validTask = {
  id: "T001",
  title: "テストタスク",
  description: "テスト用のタスク",
  status: "in_progress",
  dependencies: [],
  priority: 3,
  estimated_hours: 2,
  progress_percentage: 50,
  progress_state: "in_development",
  git_commits: []
};

const tasksWithDependencies = [
  {
    id: "T001",
    title: "タスク1",
    description: "タスク1の説明",
    status: "completed",
    dependencies: [],
    priority: 5,
    progress_percentage: 100,
    progress_state: "completed"
  },
  {
    id: "T002",
    title: "タスク2",
    description: "タスク2の説明",
    status: "in_progress",
    dependencies: [
      {
        task_id: "T001",
        type: "strong"
      }
    ],
    priority: 4,
    progress_percentage: 50,
    progress_state: "in_development"
  },
  {
    id: "T003",
    title: "タスク3",
    description: "タスク3の説明",
    status: "pending",
    dependencies: [
      {
        task_id: "T002",
        type: "strong"
      },
      {
        task_id: "T001",
        type: "weak"
      }
    ],
    priority: 3,
    progress_percentage: 0,
    progress_state: "not_started"
  }
];

// Jestのテスト
describe('TaskManager', () => {
  let taskManager;
  let mockDeps;
  
  beforeEach(() => {
    // モック依存関係の作成
    mockDeps = createMockDependencies();
    
    // TaskManagerのインスタンスを作成
    taskManager = new TaskManager(
      mockDeps.storageService,
      mockDeps.gitService,
      mockDeps.logger,
      mockDeps.eventEmitter,
      mockDeps.errorHandler,
      {
        tasksDir: 'test-tasks'
      }
    );
  });
  
  test('コンストラクタで依存関係を正しく設定する', () => {
    expect(taskManager.storageService).toBe(mockDeps.storageService);
    expect(taskManager.gitService).toBe(mockDeps.gitService);
    expect(taskManager.logger).toBe(mockDeps.logger);
    expect(taskManager.eventEmitter).toBe(mockDeps.eventEmitter);
    expect(taskManager.errorHandler).toBe(mockDeps.errorHandler);
    expect(taskManager.tasksDir).toBe('test-tasks');
  });
  
  test('必須の依存関係が欠けている場合はエラーをスローする', () => {
    expect(() => new TaskManager(null, mockDeps.gitService, mockDeps.logger, mockDeps.eventEmitter, mockDeps.errorHandler))
      .toThrow('TaskManager requires a storageService instance');
    
    expect(() => new TaskManager(mockDeps.storageService, null, mockDeps.logger, mockDeps.eventEmitter, mockDeps.errorHandler))
      .toThrow('TaskManager requires a gitService instance');
    
    expect(() => new TaskManager(mockDeps.storageService, mockDeps.gitService, null, mockDeps.eventEmitter, mockDeps.errorHandler))
      .toThrow('TaskManager requires a logger instance');
    
    expect(() => new TaskManager(mockDeps.storageService, mockDeps.gitService, mockDeps.logger, null, mockDeps.errorHandler))
      .toThrow('TaskManager requires an eventEmitter instance');
    
    expect(() => new TaskManager(mockDeps.storageService, mockDeps.gitService, mockDeps.logger, mockDeps.eventEmitter, null))
      .toThrow('TaskManager requires an errorHandler instance');
  });
  
  // タスク検証のテスト
  describe('validateTask', () => {
    test('有効なタスクは検証に合格する', () => {
      const result = taskManager.validateTask(validTask);
      expect(result.isValid).toBe(true);
      expect(result.errors.length).toBe(0);
    });
    
    test('無効なIDを持つタスクは検証に失敗する', () => {
      const invalidTask = { ...validTask, id: "invalid" };
      const result = taskManager.validateTask(invalidTask);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
    
    test('必須フィールドがないタスクは検証に失敗する', () => {
      const missingFieldTask = { id: "T001", title: "Missing Fields" };
      const result = taskManager.validateTask(missingFieldTask);
      expect(result.isValid).toBe(false);
    });
  });
  
  // 依存関係管理のテスト
  describe('checkDependencies', () => {
    test('依存関係が正しいタスクは検証に合格する', () => {
      const result = taskManager.checkDependencies("T003", tasksWithDependencies);
      expect(result.isValid).toBe(true);
    });
    
    test('循環依存があるタスクは検証に失敗する', () => {
      // 循環依存のテスト
      const circularTasks = [...tasksWithDependencies];
      circularTasks[0] = {
        ...circularTasks[0],
        dependencies: [
          {
            task_id: "T003",
            type: "strong"
          }
        ]
      };
      
      const result = taskManager.checkDependencies("T003", circularTasks);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("循環依存が検出されました");
    });
  });
  
  // タスク状態管理のテスト
  describe('updateTaskProgress', () => {
    test('タスクの進捗状態を更新できる', () => {
      const task = { ...validTask };
      const updatedTask = taskManager.updateTaskProgress(task, "in_review");
      
      expect(updatedTask.progress_state).toBe("in_review");
      expect(updatedTask.progress_percentage).toBe(70); // in_reviewの標準進捗率
    });
    
    test('無効な進捗状態への更新は失敗する', () => {
      const task = { ...validTask };
      expect(() => taskManager.updateTaskProgress(task, "invalid_state"))
        .toThrow();
    });
  });
  
  // タスク保存のテスト
  describe('saveTask', () => {
    test('タスクを保存できる', () => {
      // モックの設定
      mockDeps.storageService.fileExists.mockReturnValue(true);
      mockDeps.storageService.readJSON.mockReturnValue({
        decomposed_tasks: []
      });
      
      const result = taskManager.saveTask(validTask);
      
      expect(result).toBe(true);
      expect(mockDeps.storageService.writeJSON).toHaveBeenCalled();
      expect(mockDeps.eventEmitter.emit).toHaveBeenCalledWith('task:saved', expect.any(Object));
    });
    
    test('無効なタスクは保存できない', () => {
      // validateTaskをモック
      taskManager.validateTask = jest.fn().mockReturnValue({
        isValid: false,
        errors: ["エラー"]
      });
      
      const result = taskManager.saveTask(validTask);
      
      expect(result).toBe(false);
      expect(mockDeps.storageService.writeJSON).not.toHaveBeenCalled();
      expect(mockDeps.logger.error).toHaveBeenCalled();
    });
  });
});