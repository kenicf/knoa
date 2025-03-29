/**
 * タスクバリデータクラスのテスト
 */

const {
  TaskValidator,
} = require('../../../../src/lib/data/validators/task-validator');

describe('TaskValidator', () => {
  let taskValidator;

  beforeEach(() => {
    taskValidator = new TaskValidator();
  });

  describe('constructor', () => {
    test('should create validator with default options', () => {
      expect(taskValidator.progressStates).toBeDefined();
      expect(Object.keys(taskValidator.progressStates)).toContain(
        'not_started'
      );
      expect(Object.keys(taskValidator.progressStates)).toContain('completed');
    });

    test('should create validator with custom options', () => {
      const customProgressStates = {
        custom_state: {
          description: 'Custom state',
          default_percentage: 50,
        },
      };

      const customValidator = new TaskValidator({
        progressStates: customProgressStates,
      });

      expect(customValidator.progressStates).toBe(customProgressStates);
    });
  });

  describe('validate', () => {
    test('should validate valid task', () => {
      const validTask = {
        id: 'T001',
        title: 'Test Task',
        description: 'Test Description',
        status: 'pending',
        dependencies: [],
        priority: 3,
        estimated_hours: 5,
        progress_percentage: 50,
        progress_state: 'in_development',
        git_commits: ['commit-1', 'commit-2'],
      };

      const result = taskValidator.validate(validTask);

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    test('should validate task with minimum required fields', () => {
      const minimalTask = {
        id: 'T001',
        title: 'Test Task',
        description: 'Test Description',
        status: 'pending',
        dependencies: [],
      };

      const result = taskValidator.validate(minimalTask);

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    test('should return errors for missing required fields', () => {
      const invalidTask = {
        id: 'T001',
        title: 'Test Task',
        // Missing description
        status: 'pending',
        // Missing dependencies
      };

      const result = taskValidator.validate(invalidTask);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('dependenciesは必須フィールドです');
    });

    test('should validate ID format', () => {
      const invalidTask = {
        id: 'invalid-id', // Invalid format
        title: 'Test Task',
        description: 'Test Description',
        status: 'pending',
        dependencies: [],
      };

      const result = taskValidator.validate(invalidTask);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('IDはT001形式である必要があります');
    });

    test('should validate status', () => {
      const invalidTask = {
        id: 'T001',
        title: 'Test Task',
        description: 'Test Description',
        status: 'invalid-status', // Invalid status
        dependencies: [],
      };

      const result = taskValidator.validate(invalidTask);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'ステータスはpending, in_progress, completed, blockedのいずれかである必要があります'
      );
    });

    test('should validate priority', () => {
      const invalidTask = {
        id: 'T001',
        title: 'Test Task',
        description: 'Test Description',
        status: 'pending',
        dependencies: [],
        priority: 10, // Invalid priority (should be 1-5)
      };

      const result = taskValidator.validate(invalidTask);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        '優先度は1から5の整数である必要があります'
      );
    });

    test('should validate estimated hours', () => {
      const invalidTask = {
        id: 'T001',
        title: 'Test Task',
        description: 'Test Description',
        status: 'pending',
        dependencies: [],
        estimated_hours: -5, // Invalid (should be >= 0)
      };

      const result = taskValidator.validate(invalidTask);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        '見積もり時間は0以上の数値である必要があります'
      );
    });

    test('should validate progress percentage', () => {
      const invalidTask = {
        id: 'T001',
        title: 'Test Task',
        description: 'Test Description',
        status: 'pending',
        dependencies: [],
        progress_percentage: 101, // Invalid (should be 0-100)
      };

      const result = taskValidator.validate(invalidTask);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        '進捗率は0から100の整数である必要があります'
      );
    });

    test('should validate progress state', () => {
      const invalidTask = {
        id: 'T001',
        title: 'Test Task',
        description: 'Test Description',
        status: 'pending',
        dependencies: [],
        progress_state: 'invalid-state', // Invalid state
      };

      const result = taskValidator.validate(invalidTask);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        `進捗状態は${Object.keys(taskValidator.progressStates).join(', ')}のいずれかである必要があります`
      );
    });

    test('should validate dependencies', () => {
      const invalidTask = {
        id: 'T001',
        title: 'Test Task',
        description: 'Test Description',
        status: 'pending',
        dependencies: [
          { task_id: 'invalid-id', type: 'strong' }, // Invalid task_id
          { type: 'weak' }, // Missing task_id
        ],
      };

      const result = taskValidator.validate(invalidTask);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        '依存関係[0]のtask_idはT001形式である必要があります'
      );
      expect(result.errors).toContain('依存関係[1]のtask_idは必須です');
    });

    test('should validate git_commits', () => {
      const invalidTask = {
        id: 'T001',
        title: 'Test Task',
        description: 'Test Description',
        status: 'pending',
        dependencies: [],
        git_commits: 'not-an-array', // Invalid (should be an array)
      };

      const result = taskValidator.validate(invalidTask);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('git_commitsは配列である必要があります');
    });
  });

  describe('validateHierarchy', () => {
    test('should validate valid hierarchy', () => {
      const validHierarchy = {
        epics: [
          {
            epic_id: 'E001',
            title: 'Epic 1',
            stories: ['S001'],
          },
        ],
        stories: [
          {
            story_id: 'S001',
            title: 'Story 1',
            tasks: ['T001', 'T002'],
          },
        ],
      };

      const result = taskValidator.validateHierarchy(validHierarchy);

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    test('should return errors for missing hierarchy', () => {
      const result = taskValidator.validateHierarchy(null);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('タスク階層が指定されていません');
    });

    test('should validate epics', () => {
      const invalidHierarchy = {
        epics: 'not-an-array', // Invalid (should be an array)
        stories: [],
      };

      const result = taskValidator.validateHierarchy(invalidHierarchy);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('epicsは配列である必要があります');
    });

    test('should validate epic_id format', () => {
      const invalidHierarchy = {
        epics: [
          {
            epic_id: 'invalid-id', // Invalid format
            title: 'Epic 1',
            stories: ['S001'],
          },
        ],
        stories: [],
      };

      const result = taskValidator.validateHierarchy(invalidHierarchy);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'epic[0]のepic_idはE001形式である必要があります'
      );
    });

    test('should validate epic title', () => {
      const invalidHierarchy = {
        epics: [
          {
            epic_id: 'E001',
            // Missing title
            stories: ['S001'],
          },
        ],
        stories: [],
      };

      const result = taskValidator.validateHierarchy(invalidHierarchy);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('epic[0]のtitleは必須です');
    });

    test('should validate epic stories', () => {
      const invalidHierarchy = {
        epics: [
          {
            epic_id: 'E001',
            title: 'Epic 1',
            stories: 'not-an-array', // Invalid (should be an array)
          },
        ],
        stories: [],
      };

      const result = taskValidator.validateHierarchy(invalidHierarchy);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'epic[0]のstoriesは配列である必要があります'
      );
    });

    test('should validate story_id format in epics', () => {
      const invalidHierarchy = {
        epics: [
          {
            epic_id: 'E001',
            title: 'Epic 1',
            stories: ['invalid-id'], // Invalid format
          },
        ],
        stories: [],
      };

      const result = taskValidator.validateHierarchy(invalidHierarchy);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'epic[0].stories[0]はS001形式である必要があります'
      );
    });

    test('should validate stories', () => {
      const invalidHierarchy = {
        epics: [],
        stories: 'not-an-array', // Invalid (should be an array)
      };

      const result = taskValidator.validateHierarchy(invalidHierarchy);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('storiesは配列である必要があります');
    });

    test('should validate story_id format', () => {
      const invalidHierarchy = {
        epics: [],
        stories: [
          {
            story_id: 'invalid-id', // Invalid format
            title: 'Story 1',
            tasks: ['T001'],
          },
        ],
      };

      const result = taskValidator.validateHierarchy(invalidHierarchy);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'story[0]のstory_idはS001形式である必要があります'
      );
    });

    test('should validate story title', () => {
      const invalidHierarchy = {
        epics: [],
        stories: [
          {
            story_id: 'S001',
            // Missing title
            tasks: ['T001'],
          },
        ],
      };

      const result = taskValidator.validateHierarchy(invalidHierarchy);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('story[0]のtitleは必須です');
    });

    test('should validate story tasks', () => {
      const invalidHierarchy = {
        epics: [],
        stories: [
          {
            story_id: 'S001',
            title: 'Story 1',
            tasks: 'not-an-array', // Invalid (should be an array)
          },
        ],
      };

      const result = taskValidator.validateHierarchy(invalidHierarchy);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'story[0]のtasksは配列である必要があります'
      );
    });

    test('should validate task_id format in stories', () => {
      const invalidHierarchy = {
        epics: [],
        stories: [
          {
            story_id: 'S001',
            title: 'Story 1',
            tasks: ['invalid-id'], // Invalid format
          },
        ],
      };

      const result = taskValidator.validateHierarchy(invalidHierarchy);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'story[0].tasks[0]はT001形式である必要があります'
      );
    });
  });

  describe('validateDependencies', () => {
    test('should validate valid dependencies', () => {
      const tasks = [
        {
          id: 'T001',
          dependencies: [{ task_id: 'T002', type: 'strong' }],
        },
        {
          id: 'T002',
          dependencies: [],
        },
      ];

      const result = taskValidator.validateDependencies(tasks);

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.circularDependencies).toEqual([]);
    });

    test('should return errors for missing tasks', () => {
      const result = taskValidator.validateDependencies(null);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('tasksは配列である必要があります');
    });

    test('should detect circular dependencies', () => {
      const tasks = [
        {
          id: 'T001',
          dependencies: [{ task_id: 'T002', type: 'strong' }],
        },
        {
          id: 'T002',
          dependencies: [{ task_id: 'T001', type: 'strong' }],
        },
      ];

      const result = taskValidator.validateDependencies(tasks);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('循環依存が検出されました');
      expect(result.circularDependencies.length).toBeGreaterThan(0);
    });

    test('should detect missing dependency tasks', () => {
      const tasks = [
        {
          id: 'T001',
          dependencies: [
            { task_id: 'T999', type: 'strong' }, // T999 doesn't exist
          ],
        },
      ];

      const result = taskValidator.validateDependencies(tasks);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'タスク T001 の依存タスク T999 が存在しません'
      );
    });
  });
});
