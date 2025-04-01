/**
 * リポジトリとバリデータの統合テスト
 */

// エラークラスは utils からインポート
const {
  ValidationError,
  NotFoundError,
} = require('../../../../src/lib/utils/errors');
const { TaskRepository } = require('../../../../src/lib/data/task-repository');
const {
  SessionRepository,
} = require('../../../../src/lib/data/session-repository');
const {
  FeedbackRepository,
} = require('../../../../src/lib/data/feedback-repository');
const {
  TaskValidator,
} = require('../../../../src/lib/data/validators/task-validator');
const {
  SessionValidator,
} = require('../../../../src/lib/data/validators/session-validator');
const {
  FeedbackValidator,
} = require('../../../../src/lib/data/validators/feedback-validator');
const { createMockDependencies } = require('../../../helpers/mock-factory');
const {
  expectStandardizedEventEmitted,
} = require('../../../helpers/test-helpers');

describe('Repository and Validator Integration', () => {
  let mockDeps;

  beforeEach(() => {
    mockDeps = createMockDependencies();
    // errorHandler はデフォルトでエラーを再スローするようにモック
    mockDeps.errorHandler.handle.mockImplementation((err) => {
      throw err;
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('TaskRepository with TaskValidator', () => {
    let taskRepository;
    let taskValidator; // 実インスタンスを使用

    beforeEach(() => {
      // 実インスタンスを使用するが、logger はモックを渡す
      taskValidator = new TaskValidator({ logger: mockDeps.logger });
      // TaskRepository のコンストラクタに合わせて修正
      taskRepository = new TaskRepository({
        storageService: mockDeps.storageService,
        taskValidator: taskValidator, // 実インスタンスを渡す
        logger: mockDeps.logger,
        eventEmitter: mockDeps.eventEmitter,
        errorHandler: mockDeps.errorHandler,
      });
    });

    test('should validate task on create and emit event', async () => {
      const validTask = {
        id: 'T001',
        title: 'Test Task',
        description: 'Test Description',
        status: 'pending',
        dependencies: [],
        priority: 3,
      };
      mockDeps.storageService.fileExists.mockReturnValue(true);
      mockDeps.storageService.readJSON.mockResolvedValue({ tasks: [] });
      const validateSpy = jest.spyOn(taskValidator, 'validate'); // spyOn を使用

      await taskRepository.create(validTask);

      expect(validateSpy).toHaveBeenCalledWith(validTask);
      expect(mockDeps.storageService.writeJSON).toHaveBeenCalled();
      expectStandardizedEventEmitted(mockDeps.eventEmitter, 'task', 'created', {
        entity: validTask,
      });
    });

    test('should reject invalid task on create with ValidationError', async () => {
      const invalidTask = { id: 'invalid-id', title: 'Test' }; // 不正なIDと不足フィールド
      // バリデータは実際のエラーを返すようにする
      const validationResult = taskValidator.validate(invalidTask);
      expect(validationResult.isValid).toBe(false); // バリデーションが失敗することを確認

      mockDeps.storageService.fileExists.mockReturnValue(true);
      mockDeps.storageService.readJSON.mockResolvedValue({ tasks: [] });

      // エラーハンドラーが ValidationError を再スローすることを期待
      await expect(taskRepository.create(invalidTask)).rejects.toThrow(
        ValidationError
      );
      // 修正: 基本的なエラーメッセージのみを期待
      await expect(taskRepository.create(invalidTask)).rejects.toThrow(
        'Invalid task data'
      );
      expect(mockDeps.storageService.writeJSON).not.toHaveBeenCalled();
      expect(mockDeps.eventEmitter.emitStandardized).not.toHaveBeenCalled();
      // errorHandler が呼び出されたことも確認
      expect(mockDeps.errorHandler.handle).toHaveBeenCalledWith(
        expect.any(ValidationError), // エラータイプ
        'TaskRepository', // コンポーネント名
        'create', // 操作名
        { data: invalidTask } // コンテキスト
      );
    });

    test('should validate task hierarchy on updateTaskHierarchy', async () => {
      const validHierarchy = { epics: [], stories: [] };
      mockDeps.storageService.fileExists.mockReturnValue(true);
      mockDeps.storageService.readJSON.mockResolvedValue({
        tasks: [],
        task_hierarchy: {},
      });
      const validateHierarchySpy = jest.spyOn(
        taskValidator,
        'validateHierarchy'
      );

      await taskRepository.updateTaskHierarchy(validHierarchy);

      expect(validateHierarchySpy).toHaveBeenCalledWith(validHierarchy);
      expect(mockDeps.storageService.writeJSON).toHaveBeenCalled();
      // updateTaskHierarchy はイベントを発行しない想定
    });

    test('should reject invalid task hierarchy on updateTaskHierarchy with ValidationError', async () => {
      const invalidHierarchy = { epics: 'not-an-array' };
      const validationResult =
        taskValidator.validateHierarchy(invalidHierarchy);
      expect(validationResult.isValid).toBe(false);

      mockDeps.storageService.fileExists.mockReturnValue(true);
      mockDeps.storageService.readJSON.mockResolvedValue({
        tasks: [],
        task_hierarchy: {},
      });

      await expect(
        taskRepository.updateTaskHierarchy(invalidHierarchy)
      ).rejects.toThrow(ValidationError);
      // 修正: 基本的なエラーメッセージのみを期待
      await expect(
        taskRepository.updateTaskHierarchy(invalidHierarchy)
      ).rejects.toThrow('Invalid task hierarchy');
      expect(mockDeps.storageService.writeJSON).not.toHaveBeenCalled();
      expect(mockDeps.errorHandler.handle).toHaveBeenCalledWith(
        expect.any(ValidationError),
        'TaskRepository',
        'updateTaskHierarchy',
        { hierarchy: invalidHierarchy }
      );
    });

    test('should reject progress update if dependency check fails', async () => {
      const mockTask = {
        id: 'T001',
        progress_state: 'not_started',
        dependencies: [{ task_id: 'T000', type: 'strong' }],
      };
      const dependencyErrors = [
        '強い依存関係のタスク T000 がまだ完了していません',
      ];
      jest.spyOn(taskRepository, 'getById').mockResolvedValue(mockTask);
      // checkDependencies がエラーを返すようにモック
      jest
        .spyOn(taskRepository, 'checkDependencies')
        .mockResolvedValue({ isValid: false, errors: dependencyErrors });

      await expect(
        taskRepository.updateTaskProgress('T001', 'in_development')
      ).rejects.toThrow(ValidationError); // 依存関係エラーもValidationErrorとして扱う
      // 修正: 基本的なエラーメッセージのみを期待
      await expect(
        taskRepository.updateTaskProgress('T001', 'in_development')
      ).rejects.toThrow('Dependency check failed');
      expect(taskRepository.checkDependencies).toHaveBeenCalledWith('T001');
      expect(mockDeps.storageService.writeJSON).not.toHaveBeenCalled();
      expect(mockDeps.errorHandler.handle).toHaveBeenCalledWith(
        expect.any(ValidationError), // エラータイプ
        'TaskRepository',
        'updateTaskProgress',
        { id: 'T001', newState: 'in_development', customPercentage: undefined }
      );
    });
  });

  describe('SessionRepository with SessionValidator', () => {
    let sessionRepository;
    let sessionValidator; // 実インスタンスを使用

    beforeEach(() => {
      sessionValidator = new SessionValidator();
      // SessionRepository のコンストラクタに合わせて修正
      sessionRepository = new SessionRepository({
        storageService: mockDeps.storageService,
        sessionValidator: sessionValidator, // 実インスタンスを渡す
        gitService: mockDeps.gitService,
        logger: mockDeps.logger,
        eventEmitter: mockDeps.eventEmitter,
        errorHandler: mockDeps.errorHandler,
      });
    });

    test('should validate session on saveSession and emit event', async () => {
      const validSession = {
        session_handover: {
          project_id: 'knoa',
          session_id: 'session-123',
          session_timestamp: '2025-03-22T12:00:00Z',
          project_state_summary: {
            completed_tasks: [],
            current_tasks: [],
            pending_tasks: [],
          },
          next_session_focus: 'Focus',
        },
      };
      const validateSpy = jest.spyOn(sessionValidator, 'validate');

      await sessionRepository.saveSession(validSession, true); // isLatest = true

      expect(validateSpy).toHaveBeenCalledWith(validSession);
      expect(mockDeps.storageService.writeJSON).toHaveBeenCalledTimes(2); // history と latest
      expectStandardizedEventEmitted(
        mockDeps.eventEmitter,
        'session',
        'saved',
        { sessionId: 'session-123', isLatest: true }
      );
    });

    test('should reject invalid session on saveSession with ValidationError', async () => {
      const invalidSession = { session_handover: {} }; // 不正なデータ
      const validationResult = sessionValidator.validate(invalidSession);
      expect(validationResult.isValid).toBe(false);

      await expect(
        sessionRepository.saveSession(invalidSession)
      ).rejects.toThrow(ValidationError);
      // 修正: 基本的なエラーメッセージのみを期待
      await expect(
        sessionRepository.saveSession(invalidSession)
      ).rejects.toThrow('Invalid session data');
      expect(mockDeps.storageService.writeJSON).not.toHaveBeenCalled();
      expect(mockDeps.eventEmitter.emitStandardized).not.toHaveBeenCalled();
      expect(mockDeps.errorHandler.handle).toHaveBeenCalledWith(
        expect.any(ValidationError),
        'SessionRepository',
        'saveSession',
        { sessionId: undefined, isLatest: true }
      );
    });

    test('should call validateStateChanges on getSessionStateChanges', async () => {
      const previousSession = {
        session_handover: {
          session_id: 'session-123',
          session_timestamp: '2025-03-22T10:00:00Z',
          project_state_summary: {
            completed_tasks: [],
            current_tasks: [],
            pending_tasks: [],
          },
        },
      };
      const currentSession = {
        session_handover: {
          session_id: 'session-456',
          previous_session_id: 'session-123',
          session_timestamp: '2025-03-22T12:00:00Z',
          project_state_summary: {
            completed_tasks: [],
            current_tasks: [],
            pending_tasks: [],
          },
        },
      };
      jest
        .spyOn(sessionRepository, 'getSessionById')
        .mockResolvedValueOnce(previousSession)
        .mockResolvedValueOnce(currentSession);
      const validateStateChangesSpy = jest.spyOn(
        sessionValidator,
        'validateStateChanges'
      );

      await sessionRepository.getSessionStateChanges(
        'session-123',
        'session-456'
      );

      expect(validateStateChangesSpy).toHaveBeenCalledWith(
        previousSession,
        currentSession
      );
      // validateStateChanges が false を返してもエラーはスローされず、警告ログが出る想定
    });
  });

  describe('FeedbackRepository with FeedbackValidator', () => {
    let feedbackRepository;
    let feedbackValidator; // 実インスタンスを使用

    beforeEach(() => {
      feedbackValidator = new FeedbackValidator();
      // FeedbackRepository のコンストラクタに合わせて修正
      feedbackRepository = new FeedbackRepository({
        storageService: mockDeps.storageService,
        feedbackValidator: feedbackValidator, // 実インスタンスを渡す
        logger: mockDeps.logger,
        eventEmitter: mockDeps.eventEmitter,
        errorHandler: mockDeps.errorHandler,
      });
    });

    test('should validate feedback on saveFeedback and emit event', async () => {
      const validFeedback = {
        feedback_id: 'fb1',
        feedback_loop: {
          task_id: 'T001',
          // 修正: 必須フィールドを追加
          test_execution: {
            command: 'test',
            timestamp: 'ts',
            environment: 'env',
          },
          verification_results: { status: 'passed', timestamp: 'ts' },
          feedback_items: [{ description: 'desc' }],
          status: 'open',
        },
      };
      mockDeps.storageService.fileExists.mockReturnValue(true);
      mockDeps.storageService.readJSON.mockResolvedValue([]);
      const validateSpy = jest.spyOn(feedbackValidator, 'validate');

      await feedbackRepository.saveFeedback(validFeedback);

      expect(validateSpy).toHaveBeenCalledWith(validFeedback);
      expect(mockDeps.storageService.writeJSON).toHaveBeenCalled();
      expectStandardizedEventEmitted(
        mockDeps.eventEmitter,
        'feedback',
        'created',
        { feedback: validFeedback }
      ); // 新規作成なので created
    });

    test('should reject invalid feedback on saveFeedback with ValidationError', async () => {
      const invalidFeedback = { feedback_loop: {} }; // 不正
      const validationResult = feedbackValidator.validate(invalidFeedback);
      expect(validationResult.isValid).toBe(false);

      mockDeps.storageService.fileExists.mockReturnValue(true);
      mockDeps.storageService.readJSON.mockResolvedValue([]);

      await expect(
        feedbackRepository.saveFeedback(invalidFeedback)
      ).rejects.toThrow(ValidationError);
      // 修正: 基本的なエラーメッセージのみを期待
      await expect(
        feedbackRepository.saveFeedback(invalidFeedback)
      ).rejects.toThrow('Invalid feedback data');
      expect(mockDeps.storageService.writeJSON).not.toHaveBeenCalled();
      expect(mockDeps.eventEmitter.emitStandardized).not.toHaveBeenCalled();
      expect(mockDeps.errorHandler.handle).toHaveBeenCalledWith(
        expect.any(ValidationError),
        'FeedbackRepository',
        'saveFeedback',
        { feedbackId: undefined }
      );
    });

    test('should validate status transition on updateFeedbackStatus and emit event', async () => {
      const feedbackId = 'fb1';
      const currentFeedback = {
        feedback_id: feedbackId,
        feedback_loop: {
          status: 'open',
          task_id: 'T001',
          test_execution: {},
          verification_results: {},
          feedback_items: [],
        },
      };
      const newStatus = 'resolved';
      const resolutionDetails = { comment: 'Fixed' };
      mockDeps.storageService.fileExists.mockReturnValue(true);
      mockDeps.storageService.readJSON.mockResolvedValue([currentFeedback]);
      const validateStatusTransitionSpy = jest.spyOn(
        feedbackValidator,
        'validateStatusTransition'
      );

      const updatedFeedback = await feedbackRepository.updateFeedbackStatus(
        feedbackId,
        newStatus,
        resolutionDetails
      );

      expect(validateStatusTransitionSpy).toHaveBeenCalledWith(
        'open',
        newStatus
      );
      expect(updatedFeedback.feedback_loop.status).toBe(newStatus);
      expect(mockDeps.storageService.writeJSON).toHaveBeenCalled();
      expectStandardizedEventEmitted(
        mockDeps.eventEmitter,
        'feedback',
        'status_updated',
        {
          feedbackId,
          oldStatus: 'open',
          newStatus,
          resolutionDetails,
          feedback: updatedFeedback,
        }
      );
    });

    test('should reject invalid status transition with ValidationError', async () => {
      const feedbackId = 'fb1';
      const currentFeedback = {
        feedback_id: feedbackId,
        feedback_loop: { status: 'resolved' },
      }; // resolved からは open にしか遷移できない
      const newStatus = 'in_progress';
      mockDeps.storageService.fileExists.mockReturnValue(true);
      mockDeps.storageService.readJSON.mockResolvedValue([currentFeedback]);
      const validationResult = feedbackValidator.validateStatusTransition(
        currentFeedback.feedback_loop.status,
        newStatus
      );
      expect(validationResult.isValid).toBe(false);

      await expect(
        feedbackRepository.updateFeedbackStatus(feedbackId, newStatus)
      ).rejects.toThrow(ValidationError);
      await expect(
        feedbackRepository.updateFeedbackStatus(feedbackId, newStatus)
      ).rejects.toThrow(validationResult.error);
      expect(mockDeps.storageService.writeJSON).not.toHaveBeenCalled();
      expect(mockDeps.eventEmitter.emitStandardized).not.toHaveBeenCalled();
      expect(mockDeps.errorHandler.handle).toHaveBeenCalledWith(
        expect.any(ValidationError),
        'FeedbackRepository',
        'updateFeedbackStatus',
        { feedbackId, newStatus, resolutionDetails: {} }
      );
    });

    // calculatePriority はリポジトリの責務ではないため、テストを削除またはバリデータのテストに移動
  });
});
