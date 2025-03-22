/**
 * タスク管理ユーティリティのテスト
 */

const taskManager = require('../src/utils/task-manager');

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
      const cyclicTasks = [
        ...tasksWithDependencies,
        {
          id: "T004",
          title: "タスク4",
          description: "タスク4の説明",
          status: "pending",
          dependencies: [
            {
              task_id: "T005",
              type: "strong"
            }
          ]
        },
        {
          id: "T005",
          title: "タスク5",
          description: "タスク5の説明",
          status: "pending",
          dependencies: [
            {
              task_id: "T004",
              type: "strong"
            }
          ]
        }
      ];
      
      const result = taskManager.checkDependencies("T004", cyclicTasks);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
  
  // 進捗管理のテスト
  describe('calculateProgress', () => {
    test('タスクT002の進捗率は50%', () => {
      const progress = taskManager.calculateProgress("T002", tasksWithDependencies);
      expect(progress).toBe(50);
    });
    
    test('完了したタスクの進捗率は100%', () => {
      const progress = taskManager.calculateProgress("T001", tasksWithDependencies);
      expect(progress).toBe(100);
    });
  });
  
  // タスクフィルタリングのテスト
  describe('taskFiltering', () => {
    test('進行中のタスクは1つ', () => {
      const inProgressTasks = taskManager.getTasksByStatus(tasksWithDependencies, "in_progress");
      expect(inProgressTasks.length).toBe(1);
      expect(inProgressTasks[0].id).toBe("T002");
    });
    
    test('開発中のタスクは1つ', () => {
      const inDevTasks = taskManager.getTasksByProgressState(tasksWithDependencies, "in_development");
      expect(inDevTasks.length).toBe(1);
      expect(inDevTasks[0].id).toBe("T002");
    });
  });
  
  // 進捗更新のテスト
  describe('updateTaskProgress', () => {
    test('タスクの進捗更新は成功する', () => {
      const tasks = JSON.parse(JSON.stringify(tasksWithDependencies)); // ディープコピー
      
      const result = taskManager.updateTaskProgress("T003", 30, "in_development", tasks);
      expect(result.success).toBe(true);
      
      const updatedTask = result.updatedTasks.find(t => t.id === "T003");
      expect(updatedTask.progress_percentage).toBe(30);
      expect(updatedTask.progress_state).toBe("in_development");
      expect(updatedTask.status).toBe("in_progress");
    });
  });
  
  // Git連携のテスト
  describe('gitIntegration', () => {
    test('Gitコミットの追加は成功する', () => {
      const tasks = JSON.parse(JSON.stringify(tasksWithDependencies)); // ディープコピー
      
      const result = taskManager.addGitCommitToTask("T002", "abc123", tasks);
      expect(result.success).toBe(true);
      
      const updatedTask = result.updatedTasks.find(t => t.id === "T002");
      expect(updatedTask.git_commits).toContain("abc123");
    });
    
    test('コミットメッセージからタスクIDを抽出できる', () => {
      const extractedIds = taskManager.extractTaskIdsFromCommitMessage("Fix bug in login form #T001 and add tests #T002");
      expect(extractedIds.length).toBe(2);
      expect(extractedIds).toContain("T001");
      expect(extractedIds).toContain("T002");
    });
  });
  
  // 進捗状態遷移のテスト
  describe('progressStateTransition', () => {
    test('開発中の次の状態は実装完了', () => {
      const nextState = taskManager.getNextProgressState("in_development");
      expect(nextState).toBe("implementation_complete");
    });
    
    test('完了状態の次の状態はない', () => {
      const nextState = taskManager.getNextProgressState("completed");
      expect(nextState).toBeNull();
    });
  });
  
  // タスク移行のテスト
  describe('taskMigration', () => {
    test('古い形式のタスクを新しい形式に変換できる', () => {
      const oldTask = {
        id: "T001",
        title: "古い形式のタスク",
        description: "古い形式のタスクの説明",
        status: "in_progress",
        dependencies: ["T002"]
      };
      
      const migratedTask = taskManager.migrateTaskToNewFormat(oldTask);
      expect(migratedTask.dependencies[0].task_id).toBe("T002");
      expect(migratedTask.dependencies[0].type).toBe("strong");
      expect(migratedTask.priority).toBe(3);
      expect(migratedTask.progress_percentage).toBe(50);
      expect(migratedTask.progress_state).toBe("in_development");
      expect(Array.isArray(migratedTask.git_commits)).toBe(true);
    });
  });
});