/**
 * TaskManagerAdapterのテスト
 */

const TaskManagerAdapter = require('../../../src/lib/adapters/task-manager-adapter');
const { EnhancedEventEmitter } = require('../../../src/lib/core/event-system');
const { ValidationError } = require('../../../src/lib/utils/errors');

describe('TaskManagerAdapter', () => {
  let adapter;
  let mockTaskManager;
  let mockEventEmitter;
  let mockLogger;
  let emittedEvents;

  beforeEach(() => {
    emittedEvents = [];

    // モックの作成
    mockTaskManager = {
      createTask: jest
        .fn()
        .mockImplementation((data) => ({ id: 'T001', ...data })),
      updateTask: jest
        .fn()
        .mockImplementation((task) => ({ ...task, updated: true })),
      updateTaskProgress: jest
        .fn()
        .mockImplementation((taskId, progress, state) => ({
          id: taskId,
          progress,
          state,
          previousProgress: 0,
          previousState: 'pending',
        })),
      addGitCommitToTask: jest
        .fn()
        .mockImplementation((taskId, commitHash) => ({
          id: taskId,
          commits: [commitHash],
        })),
      initializeTasks: jest.fn().mockImplementation(() => ({
        tasks: [{ id: 'T001' }, { id: 'T002' }],
      })),
    };

    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    // 実際のEventEmitterを使用
    mockEventEmitter = new EnhancedEventEmitter({ logger: mockLogger });

    // イベントをキャプチャ
    mockEventEmitter.on('*', (data, eventName) => {
      emittedEvents.push({ name: eventName, data });
    });

    // アダプターの作成
    adapter = new TaskManagerAdapter(mockTaskManager, {
      eventEmitter: mockEventEmitter,
      logger: mockLogger,
    });
  });

  // 基本機能のテスト
  describe('基本機能', () => {
    test('インスタンスが正しく作成される', () => {
      expect(adapter).toBeInstanceOf(TaskManagerAdapter);
      expect(adapter.manager).toBe(mockTaskManager);
      expect(adapter.eventEmitter).toBe(mockEventEmitter);
      expect(adapter.logger).toBe(mockLogger);
    });
  });

  // createTaskのテスト
  describe('createTask', () => {
    test('タスクを作成し、イベントを発行する', async () => {
      const taskData = { title: 'テストタスク' };
      const result = await adapter.createTask(taskData);

      // 基本的な機能のテスト
      expect(mockTaskManager.createTask).toHaveBeenCalledWith(taskData);
      expect(result).toEqual({ id: 'T001', title: 'テストタスク' });

      // イベント発行のテスト
      expect(emittedEvents.length).toBeGreaterThan(0);
      const taskCreatedEvent = emittedEvents.find(
        (e) => e.name === 'task:task_created'
      );
      expect(taskCreatedEvent).toBeDefined();
      expect(taskCreatedEvent.data.title).toBe('テストタスク');
      expect(taskCreatedEvent.data.timestamp).toBeDefined();
    });

    test('エラー時に適切に処理する', async () => {
      mockTaskManager.createTask.mockImplementationOnce(() => {
        throw new Error('テストエラー');
      });

      const taskData = { title: 'エラーテスト' };
      const result = await adapter.createTask(taskData);
      // 修正された期待値 - 部分一致で検証
      expect(result).toMatchObject({
        error: true,
        message: 'テストエラー',
        operation: 'createTask',
      });

      // タイムスタンプなどの動的な値が存在することを確認
      expect(result.timestamp).toBeDefined();
      expect(result.code).toBeDefined();
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  // updateTaskのテスト
  describe('updateTask', () => {
    test('タスクを更新し、イベントを発行する', async () => {
      const task = { id: 'T001', title: '更新前のタスク' };
      const result = await adapter.updateTask(task);

      // 基本的な機能のテスト
      expect(mockTaskManager.updateTask).toHaveBeenCalledWith(task);
      expect(result).toEqual({
        id: 'T001',
        title: '更新前のタスク',
        updated: true,
      });

      // イベント発行のテスト
      const taskUpdatedEvent = emittedEvents.find(
        (e) => e.name === 'task:task_updated'
      );
      expect(taskUpdatedEvent).toBeDefined();
      expect(taskUpdatedEvent.data.id).toBe('T001');
      expect(taskUpdatedEvent.data.timestamp).toBeDefined();
    });

    test('エラー時に適切に処理する', async () => {
      mockTaskManager.updateTask.mockImplementationOnce(() => {
        throw new Error('更新エラー');
      });

      const task = { id: 'T001', title: 'エラーテスト' };
      const result = await adapter.updateTask(task);
      // 修正された期待値 - 部分一致で検証
      expect(result).toMatchObject({
        error: true,
        message: '更新エラー',
        operation: 'updateTask',
      });

      // タイムスタンプなどの動的な値が存在することを確認
      expect(result.timestamp).toBeDefined();
      expect(result.code).toBeDefined();
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  // updateTaskProgressのテスト
  describe('updateTaskProgress', () => {
    test('タスクの進捗を更新し、イベントを発行する', async () => {
      const taskId = 'T001';
      const progress = 50;
      const state = 'in_progress';

      const result = await adapter.updateTaskProgress(taskId, progress, state);
      // 基本的な機能のテスト
      expect(mockTaskManager.updateTaskProgress).toHaveBeenCalledWith(
        taskId,
        progress,
        state,
        undefined
      );
      expect(result).toEqual({
        id: taskId,
        progress,
        state,
        previousProgress: 0,
        previousState: 'pending',
      });

      // イベント発行のテスト
      const progressUpdatedEvent = emittedEvents.find(
        (e) => e.name === 'task:task_progress_updated'
      );
      expect(progressUpdatedEvent).toBeDefined();
      expect(progressUpdatedEvent.data.id).toBe(taskId);
      expect(progressUpdatedEvent.data.progress).toBe(progress);
      expect(progressUpdatedEvent.data.state).toBe(state);
      expect(progressUpdatedEvent.data.timestamp).toBeDefined();
    });

    test('エラー時に適切に処理する', async () => {
      mockTaskManager.updateTaskProgress.mockImplementationOnce(() => {
        throw new Error('進捗更新エラー');
      });

      const result = await adapter.updateTaskProgress(
        'T001',
        50,
        'in_progress'
      );
      // 修正された期待値 - 部分一致で検証
      expect(result).toMatchObject({
        error: true,
        message: '進捗更新エラー',
        operation: 'updateTaskProgress',
      });

      // タイムスタンプなどの動的な値が存在することを確認
      expect(result.timestamp).toBeDefined();
      expect(result.code).toBeDefined();
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  // addGitCommitToTaskのテスト
  describe('addGitCommitToTask', () => {
    test('タスクにGitコミットを関連付け、イベントを発行する', async () => {
      const taskId = 'T001';
      const commitHash = 'abc123';

      const result = await adapter.addGitCommitToTask(taskId, commitHash);

      // 基本的な機能のテスト
      expect(mockTaskManager.addGitCommitToTask).toHaveBeenCalledWith(
        taskId,
        commitHash
      );
      expect(result).toEqual({ id: taskId, commits: [commitHash] });

      // イベント発行のテスト
      const commitAddedEvent = emittedEvents.find(
        (e) => e.name === 'task:git_commit_added'
      );
      expect(commitAddedEvent).toBeDefined();
      expect(commitAddedEvent.data.taskId).toBe(taskId);
      expect(commitAddedEvent.data.commitHash).toBe(commitHash);
      expect(commitAddedEvent.data.timestamp).toBeDefined();
    });

    test('エラー時に適切に処理する', async () => {
      mockTaskManager.addGitCommitToTask.mockImplementationOnce(() => {
        throw new Error('コミット関連付けエラー');
      });

      const result = await adapter.addGitCommitToTask('T001', 'abc123');
      // 修正された期待値 - 部分一致で検証
      expect(result).toMatchObject({
        error: true,
        message: 'コミット関連付けエラー',
        operation: 'addGitCommitToTask',
      });

      // タイムスタンプなどの動的な値が存在することを確認
      expect(result.timestamp).toBeDefined();
      expect(result.code).toBeDefined();
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  // initializeTasksのテスト
  describe('initializeTasks', () => {
    test('タスクを初期化し、イベントを発行する', async () => {
      const projectData = { id: 'test-project' };

      const result = await adapter.initializeTasks(projectData);

      // 基本的な機能のテスト
      expect(mockTaskManager.initializeTasks).toHaveBeenCalledWith(projectData);
      expect(result).toEqual({ tasks: [{ id: 'T001' }, { id: 'T002' }] });

      // イベント発行のテスト
      const tasksInitializedEvent = emittedEvents.find(
        (e) => e.name === 'task:tasks_initialized'
      );
      expect(tasksInitializedEvent).toBeDefined();
      expect(tasksInitializedEvent.data.projectId).toBe('test-project');
      expect(tasksInitializedEvent.data.taskCount).toBe(2);
      expect(tasksInitializedEvent.data.timestamp).toBeDefined();
    });

    test('エラー時に適切に処理する', async () => {
      mockTaskManager.initializeTasks.mockImplementationOnce(() => {
        throw new Error('初期化エラー');
      });

      const result = await adapter.initializeTasks({ id: 'test-project' });
      // 修正された期待値 - 部分一致で検証
      expect(result).toMatchObject({
        error: true,
        message: '初期化エラー',
        operation: 'initializeTasks',
      });

      // タイムスタンプなどの動的な値が存在することを確認
      expect(result.timestamp).toBeDefined();
      expect(result.code).toBeDefined();
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  // 後方互換性のテスト
  describe('後方互換性', () => {
    test('古いイベント名と新しいイベント名の両方が発行される', async () => {
      // 古いイベント名と新しいイベント名のリスナーを登録
      const oldEventListener = jest.fn();
      const newEventListener = jest.fn();

      mockEventEmitter.on('task:created', oldEventListener);
      mockEventEmitter.on('task:task_created', newEventListener);

      // タスクを作成
      await adapter.createTask({ title: 'テストタスク' });

      // 両方のリスナーが呼び出されることを確認
      expect(oldEventListener).toHaveBeenCalled();
      expect(newEventListener).toHaveBeenCalled();
    });

    // 開発環境でのみ警告ログのテストを実行
    if (process.env.NODE_ENV !== 'development') {
      test.skip('開発環境では非推奨イベントの警告ログが出力される', () => {});
    } else {
      test('開発環境では非推奨イベントの警告ログが出力される', async () => {
        mockEventEmitter.on('task:created', jest.fn()); // リスナー登録が必要
        await adapter.createTask({ title: 'テストタスク' });
        // eslint-disable-next-line jest/no-standalone-expect
        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.stringContaining('非推奨のイベント名'),
          expect.any(Object)
        );
      });
    }
  });

  // バリデーションのテスト
  describe('バリデーション', () => {
    test('必須パラメータがない場合はエラーを返す', async () => {
      // _validateParamsをスパイ
      jest.spyOn(adapter, '_validateParams').mockImplementationOnce(() => {
        throw new ValidationError('必須パラメータがありません');
      });

      const result = await adapter.createTask(undefined);
      // 修正された期待値 - 部分一致で検証
      expect(result).toMatchObject({
        error: true,
        message: '必須パラメータがありません',
        operation: 'createTask',
      });

      // タイムスタンプなどの動的な値が存在することを確認
      expect(result.timestamp).toBeDefined();
      expect(result.code).toBeDefined();
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });
});
