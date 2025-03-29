/**
 * イベント後方互換性のテスト
 *
 * このテストでは、イベント駆動アーキテクチャの移行において、
 * 古いイベント名と新しいイベント名の両方が発行されることを確認します。
 */

const { EnhancedEventEmitter } = require('../../../src/lib/core/event-system');
const TaskManagerAdapter = require('../../../src/lib/adapters/task-manager-adapter');
const SessionManagerAdapter = require('../../../src/lib/adapters/session-manager-adapter');
const FeedbackManagerAdapter = require('../../../src/lib/adapters/feedback-manager-adapter');

describe('イベント後方互換性', () => {
  let eventEmitter;
  let mockLogger;

  beforeEach(() => {
    // 開発環境を模倣
    process.env.NODE_ENV = 'development';

    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    eventEmitter = new EnhancedEventEmitter({
      logger: mockLogger,
      debugMode: true,
    });
  });

  afterEach(() => {
    // 環境変数をリセット
    delete process.env.NODE_ENV;
  });

  describe('TaskManagerAdapter', () => {
    test('古いイベント名と新しいイベント名の両方を発行する', async () => {
      // モックの作成
      const mockTaskManager = {
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

      // アダプターの作成
      const adapter = new TaskManagerAdapter(mockTaskManager, {
        eventEmitter,
        logger: mockLogger,
      });

      // 古いイベント名と新しいイベント名のリスナーを登録
      const oldEventListeners = {
        'task:created': jest.fn(),
        'task:updated': jest.fn(),
        'task:progress': jest.fn(),
        'task:commit': jest.fn(),
        'task:initialized': jest.fn(),
      };

      const newEventListeners = {
        'task:task_created': jest.fn(),
        'task:task_updated': jest.fn(),
        'task:task_progress_updated': jest.fn(),
        'task:git_commit_added': jest.fn(),
        'task:tasks_initialized': jest.fn(),
      };

      // リスナーを登録
      Object.entries(oldEventListeners).forEach(([event, listener]) => {
        eventEmitter.on(event, listener);
      });

      Object.entries(newEventListeners).forEach(([event, listener]) => {
        eventEmitter.on(event, listener);
      });

      // 各メソッドを呼び出し
      await adapter.createTask({ title: 'テストタスク' });
      await adapter.updateTask({ id: 'T001', title: '更新されたタスク' });
      await adapter.updateTaskProgress('T001', 50, 'in_progress');
      await adapter.addGitCommitToTask('T001', 'abc123');
      await adapter.initializeTasks({ id: 'test-project' });

      // 古いイベント名のリスナーが呼び出されたことを確認
      Object.values(oldEventListeners).forEach((listener) => {
        expect(listener).toHaveBeenCalled();
      });

      // 新しいイベント名のリスナーが呼び出されたことを確認
      Object.values(newEventListeners).forEach((listener) => {
        expect(listener).toHaveBeenCalled();
      });

      // 警告ログが出力されたことを確認
      expect(mockLogger.warn).toHaveBeenCalledTimes(5);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('非推奨のイベント名'),
        expect.any(Object)
      );
    });
  });

  describe('SessionManagerAdapter', () => {
    test('古いイベント名と新しいイベント名の両方を発行する', async () => {
      // モックの作成
      const mockSessionManager = {
        createNewSession: jest.fn().mockImplementation(() => ({
          session_handover: { session_id: 'S001' },
        })),
        updateSession: jest
          .fn()
          .mockImplementation((sessionId, updateData) => ({
            session_handover: { session_id: sessionId },
            ...updateData,
          })),
        endSession: jest.fn().mockImplementation((sessionId) => ({
          session_handover: { session_id: sessionId },
          ended: true,
          duration: 3600,
        })),
        addTaskToSession: jest.fn().mockImplementation((sessionId, taskId) => ({
          session_handover: { session_id: sessionId },
          tasks: [taskId],
        })),
        removeTaskFromSession: jest
          .fn()
          .mockImplementation((sessionId, taskId) => ({
            session_handover: { session_id: sessionId },
            tasks: [],
          })),
        addGitCommitToSession: jest
          .fn()
          .mockImplementation((sessionId, commitHash) => ({
            session_handover: { session_id: sessionId },
            commits: [commitHash],
          })),
      };

      // アダプターの作成
      const adapter = new SessionManagerAdapter(mockSessionManager, {
        eventEmitter,
        logger: mockLogger,
      });

      // 古いイベント名と新しいイベント名のリスナーを登録
      const oldEventListeners = {
        'session:started': jest.fn(),
        'session:updated': jest.fn(),
        'session:ended': jest.fn(),
        'session:task:added': jest.fn(),
        'session:task:removed': jest.fn(),
        'session:commit:added': jest.fn(),
      };

      const newEventListeners = {
        'session:session_created': jest.fn(),
        'session:session_updated': jest.fn(),
        'session:session_ended': jest.fn(),
        'session:task_added': jest.fn(),
        'session:task_removed': jest.fn(),
        'session:git_commit_added': jest.fn(),
      };

      // リスナーを登録
      Object.entries(oldEventListeners).forEach(([event, listener]) => {
        eventEmitter.on(event, listener);
      });

      Object.entries(newEventListeners).forEach(([event, listener]) => {
        eventEmitter.on(event, listener);
      });

      // 各メソッドを呼び出し
      await adapter.createNewSession();
      await adapter.updateSession('S001', { status: 'active' });
      await adapter.endSession('S001');
      await adapter.addTaskToSession('S001', 'T001');
      await adapter.removeTaskFromSession('S001', 'T001');
      await adapter.addGitCommitToSession('S001', 'abc123');

      // 古いイベント名のリスナーが呼び出されたことを確認
      Object.values(oldEventListeners).forEach((listener) => {
        expect(listener).toHaveBeenCalled();
      });

      // 新しいイベント名のリスナーが呼び出されたことを確認
      Object.values(newEventListeners).forEach((listener) => {
        expect(listener).toHaveBeenCalled();
      });

      // 警告ログが出力されたことを確認
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('非推奨のイベント名'),
        expect.any(Object)
      );
    });
  });

  describe('FeedbackManagerAdapter', () => {
    test('古いイベント名と新しいイベント名の両方を発行する', async () => {
      // モックの作成
      const mockFeedbackManager = {
        createNewFeedback: jest.fn().mockImplementation((taskId, attempt) => ({
          id: 'F001',
          task_id: taskId,
          attempt: attempt || 1,
        })),
        collectTestResults: jest
          .fn()
          .mockImplementation((taskId, testCommand, testTypes) => ({
            task_id: taskId,
            results: [{ type: 'unit', passed: true }],
          })),
        prioritizeFeedback: jest.fn().mockImplementation((feedback) => ({
          ...feedback,
          priorities: { high: ['issue1'], medium: ['issue2'] },
        })),
        updateFeedbackStatus: jest
          .fn()
          .mockImplementation((feedback, newStatus) => ({
            ...feedback,
            status: newStatus,
          })),
        integrateFeedbackWithSession: jest.fn().mockImplementation(() => true),
        integrateFeedbackWithTask: jest.fn().mockImplementation(() => true),
      };

      // アダプターの作成
      const adapter = new FeedbackManagerAdapter(mockFeedbackManager, {
        eventEmitter,
        logger: mockLogger,
      });

      // 古いイベント名と新しいイベント名のリスナーを登録
      const oldEventListeners = {
        'feedback:created': jest.fn(),
        'feedback:test:collected': jest.fn(),
        'feedback:prioritized': jest.fn(),
        'feedback:status:updated': jest.fn(),
        'feedback:integrated:session': jest.fn(),
        'feedback:integrated:task': jest.fn(),
      };

      const newEventListeners = {
        'feedback:feedback_created': jest.fn(),
        'feedback:test_results_collected': jest.fn(),
        'feedback:feedback_prioritized': jest.fn(),
        'feedback:status_updated': jest.fn(),
        'feedback:integrated_with_session': jest.fn(),
        'feedback:integrated_with_task': jest.fn(),
      };

      // リスナーを登録
      Object.entries(oldEventListeners).forEach(([event, listener]) => {
        eventEmitter.on(event, listener);
      });

      Object.entries(newEventListeners).forEach(([event, listener]) => {
        eventEmitter.on(event, listener);
      });

      // 各メソッドを呼び出し
      await adapter.createNewFeedback('T001', 1);
      await adapter.collectTestResults('T001', 'npm test', ['unit']);
      await adapter.prioritizeFeedback({
        id: 'F001',
        task_id: 'T001',
        status: 'open',
      });
      await adapter.updateFeedbackStatus(
        { id: 'F001', task_id: 'T001', status: 'open' },
        'in_progress'
      );
      await adapter.integrateFeedbackWithSession('F001', 'S001');
      await adapter.integrateFeedbackWithTask('F001', 'T001');

      // 古いイベント名のリスナーが呼び出されたことを確認
      Object.values(oldEventListeners).forEach((listener) => {
        expect(listener).toHaveBeenCalled();
      });

      // 新しいイベント名のリスナーが呼び出されたことを確認
      Object.values(newEventListeners).forEach((listener) => {
        expect(listener).toHaveBeenCalled();
      });

      // 警告ログが出力されたことを確認
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('非推奨のイベント名'),
        expect.any(Object)
      );
    });
  });

  describe('本番環境での動作', () => {
    test('本番環境では警告ログが出力されない', async () => {
      // 本番環境を模倣
      process.env.NODE_ENV = 'production';

      // 新しいEventEmitterを作成
      const prodEventEmitter = new EnhancedEventEmitter({
        logger: mockLogger,
      });

      // モックの作成
      const mockTaskManager = {
        createTask: jest
          .fn()
          .mockImplementation((data) => ({ id: 'T001', ...data })),
      };

      // アダプターの作成
      const adapter = new TaskManagerAdapter(mockTaskManager, {
        eventEmitter: prodEventEmitter,
        logger: mockLogger,
      });

      // 古いイベント名と新しいイベント名のリスナーを登録
      const oldEventListener = jest.fn();
      const newEventListener = jest.fn();

      prodEventEmitter.on('task:created', oldEventListener);
      prodEventEmitter.on('task:task_created', newEventListener);

      // タスクを作成
      await adapter.createTask({ title: '本番環境テスト' });

      // 両方のリスナーが呼び出されることを確認
      expect(oldEventListener).toHaveBeenCalled();
      expect(newEventListener).toHaveBeenCalled();

      // 警告ログが出力されないことを確認
      expect(mockLogger.warn).not.toHaveBeenCalledWith(
        expect.stringContaining('非推奨のイベント名'),
        expect.any(Object)
      );
    });
  });
});
