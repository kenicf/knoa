const CliFacade = require('../../src/cli/facade');
const {
  ApplicationError,
  ValidationError,
  CliError, // 追加
} = require('../../src/lib/utils/errors'); // インポート元を変更
const {
  createMockLogger,
  createMockEventEmitter,
} = require('../helpers/mock-factory'); // 共通ヘルパーを利用
// expectStandardizedEventEmittedAsync をインポート
const {
  expectStandardizedEventEmittedAsync,
} = require('../helpers/test-helpers');
// emitErrorEvent もモック化
jest.mock('../../src/lib/utils/error-helpers', () => ({
  emitErrorEvent: jest.fn(),
}));
const { emitErrorEvent } = require('../../src/lib/utils/error-helpers');

// 各マネージャー/ハンドラークラスをモック化
jest.mock('../../src/cli/workflow-manager');
jest.mock('../../src/cli/session-manager');
jest.mock('../../src/cli/task-manager');
jest.mock('../../src/cli/feedback-handler');
jest.mock('../../src/cli/report-generator');
jest.mock('../../src/cli/status-viewer');
jest.mock('../../src/cli/interactive-mode');
jest.mock('../../src/cli/component-syncer');

describe('CliFacade', () => {
  let mockLogger;
  let mockEventEmitter;
  let mockWorkflowManager;
  let mockSessionManager;
  let mockTaskManager;
  let mockFeedbackHandler;
  let mockReportGenerator;
  let mockStatusViewer;
  let mockInteractiveMode;
  let mockComponentSyncer;
  let cliFacade;
  let managers; // モックマネージャーへの参照を保持するオブジェクト

  beforeEach(() => {
    mockLogger = createMockLogger();
    mockEventEmitter = createMockEventEmitter();

    // 各マネージャー/ハンドラーのモックインスタンスを作成し、メソッドもモック化
    mockWorkflowManager = {
      initializeWorkflow: jest
        .fn()
        .mockResolvedValue({ project: 'P001', initialized: true }),
    };
    mockSessionManager = {
      startSession: jest.fn().mockResolvedValue({ session_id: 'S001' }),
      endSession: jest.fn().mockResolvedValue({
        session_id: 'S001',
        ended_at: new Date().toISOString(),
        handover_document: 'doc',
      }),
      listSessions: jest.fn().mockResolvedValue([{ session_id: 'S001' }]),
      getCurrentSessionInfo: jest
        .fn()
        .mockResolvedValue({ session_id: 'S001' }),
      getSessionInfo: jest.fn().mockResolvedValue({ session_id: 'S001' }),
      exportSession: jest.fn().mockResolvedValue('session-S001-export.json'),
      importSession: jest.fn().mockResolvedValue({ session_id: 'S002' }),
    };
    mockTaskManager = {
      createTask: jest.fn().mockResolvedValue({ id: 'T001' }),
      updateTask: jest
        .fn()
        .mockResolvedValue({ id: 'T001', status: 'in_progress' }),
      listTasks: jest
        .fn()
        .mockResolvedValue({ decomposed_tasks: [{ id: 'T001' }] }),
      getTaskInfo: jest.fn().mockResolvedValue({ id: 'T001' }),
      updateTaskProgress: jest
        .fn()
        .mockResolvedValue({ id: 'T001', progress_percentage: 50 }),
      deleteTask: jest.fn().mockResolvedValue(true),
      linkTaskToCommit: jest.fn().mockResolvedValue({ id: 'T001' }),
      exportTask: jest.fn().mockResolvedValue('task-T001-export.json'),
      importTask: jest.fn().mockResolvedValue({ id: 'T002' }),
    };
    mockFeedbackHandler = {
      collectFeedback: jest
        .fn()
        .mockResolvedValue({ feedback_loop: { task_id: 'T001' } }),
      resolveFeedback: jest.fn().mockResolvedValue({
        feedback_loop: { task_id: 'T001', feedback_status: 'resolved' },
      }),
      getFeedbackStatus: jest.fn().mockResolvedValue({
        feedback_loop: { task_id: 'T001', feedback_status: 'open' },
      }),
      reopenFeedback: jest.fn().mockResolvedValue({
        feedback_loop: { task_id: 'T001', feedback_status: 'open' },
      }),
      generateFeedbackReport: jest.fn().mockResolvedValue('# Report'),
      prioritizeFeedback: jest
        .fn()
        .mockResolvedValue({ feedback_loop: { task_id: 'T001' } }),
      linkFeedbackToCommit: jest.fn().mockResolvedValue(undefined), // void
      linkFeedbackToSession: jest.fn().mockResolvedValue(undefined), // void
      integrateFeedbackWithTask: jest.fn().mockResolvedValue(true),
      integrateFeedbackWithSession: jest.fn().mockResolvedValue(true),
    };
    mockReportGenerator = {
      generateReport: jest.fn().mockResolvedValue('# Report Content'),
    };
    mockStatusViewer = {
      getWorkflowStatus: jest.fn().mockResolvedValue({ currentState: 'ready' }),
    };
    mockInteractiveMode = { start: jest.fn().mockResolvedValue(undefined) }; // void
    mockComponentSyncer = { syncComponents: jest.fn().mockResolvedValue(true) };

    // モックマネージャーのルックアップオブジェクトを作成
    managers = {
      workflowManager: mockWorkflowManager,
      sessionManager: mockSessionManager,
      taskManager: mockTaskManager,
      feedbackHandler: mockFeedbackHandler,
      reportGenerator: mockReportGenerator,
      statusViewer: mockStatusViewer,
      interactiveMode: mockInteractiveMode,
      componentSyncer: mockComponentSyncer,
    };

    // CliFacade インスタンスを作成
    cliFacade = new CliFacade({
      logger: mockLogger,
      eventEmitter: mockEventEmitter,
      cliWorkflowManager: mockWorkflowManager,
      cliSessionManager: mockSessionManager,
      cliTaskManager: mockTaskManager,
      cliFeedbackHandler: mockFeedbackHandler,
      cliReportGenerator: mockReportGenerator,
      cliStatusViewer: mockStatusViewer,
      cliInteractiveMode: mockInteractiveMode,
      cliComponentSyncer: mockComponentSyncer,
    });

    // emitErrorEvent のモックをクリア
    emitErrorEvent.mockClear();
  });

  // 各コマンドに対するテストケース
  // expectedManager を文字列に変更
  const testCases = [
    // command, args, managerName (string), expectedMethod, expectedArgs
    [
      'init',
      { projectId: 'P1', request: 'Req1' },
      'workflowManager', // 文字列に変更
      'initializeWorkflow',
      ['P1', 'Req1'],
    ],
    [
      'start-session',
      { previousSessionId: 'S0' },
      'sessionManager', // 文字列に変更
      'startSession',
      ['S0'],
    ],
    [
      'end-session',
      { sessionId: 'S1' },
      'sessionManager', // 文字列に変更
      'endSession',
      ['S1'],
    ],
    [
      'create-task',
      { title: 'T', description: 'D', priority: 1 },
      'taskManager', // 文字列に変更
      'createTask',
      ['T', 'D', expect.objectContaining({ priority: 1 })],
    ],
    [
      'update-task',
      { taskId: 'T1', status: 'done', progress: 100 },
      'taskManager', // 文字列に変更
      'updateTask',
      ['T1', 'done', 100],
    ],
    [
      'collect-feedback',
      { taskId: 'T1', testCommand: 'npm test' },
      'feedbackHandler', // 文字列に変更
      'collectFeedback',
      ['T1', 'npm test'],
    ],
    [
      'resolve-feedback',
      { feedbackId: 'F1' },
      'feedbackHandler', // 文字列に変更
      'resolveFeedback',
      ['F1'],
    ],
    ['sync', {}, 'componentSyncer', 'syncComponents', []], // 文字列に変更
    [
      'report',
      { type: 'task_summary', format: 'json' },
      'reportGenerator', // 文字列に変更
      'generateReport',
      ['task_summary', expect.objectContaining({ format: 'json' })],
    ],
    ['status', {}, 'statusViewer', 'getWorkflowStatus', []], // 文字列に変更
    ['interactive', {}, 'interactiveMode', 'start', []], // 文字列に変更
    // session.js 由来
    ['list-sessions', {}, 'sessionManager', 'listSessions', []], // 文字列に変更
    ['current-session', {}, 'sessionManager', 'getCurrentSessionInfo', []], // 文字列に変更
    [
      'session-info',
      { sessionId: 'S2' },
      'sessionManager', // 文字列に変更
      'getSessionInfo',
      ['S2'],
    ],
    [
      'export-session',
      { sessionId: 'S2', path: 'out.json' },
      'sessionManager', // 文字列に変更
      'exportSession',
      ['S2', 'out.json'],
    ],
    [
      'import-session',
      { path: 'in.json' },
      'sessionManager', // 文字列に変更
      'importSession',
      ['in.json'],
    ],
    // task.js 由来
    ['list-tasks', {}, 'taskManager', 'listTasks', []], // 文字列に変更
    ['task-info', { taskId: 'T2' }, 'taskManager', 'getTaskInfo', ['T2']], // 文字列に変更
    [
      'update-task-progress',
      { taskId: 'T2', progress: 75 },
      'taskManager', // 文字列に変更
      'updateTaskProgress',
      ['T2', 75],
    ],
    ['delete-task', { taskId: 'T2' }, 'taskManager', 'deleteTask', ['T2']], // 文字列に変更
    [
      'link-task-commit',
      { taskId: 'T2', commitHash: 'abc' },
      'taskManager', // 文字列に変更
      'linkTaskToCommit',
      ['T2', 'abc'],
    ],
    [
      'export-task',
      { taskId: 'T2', path: 'task.json' },
      'taskManager', // 文字列に変更
      'exportTask',
      ['T2', 'task.json'],
    ],
    [
      'import-task',
      { path: 'task_in.json' },
      'taskManager', // 文字列に変更
      'importTask',
      ['task_in.json'],
    ],
    // feedback.js 由来
    [
      'feedback-status',
      { taskId: 'T3' },
      'feedbackHandler', // 文字列に変更
      'getFeedbackStatus',
      ['T3'],
    ],
    [
      'reopen-feedback',
      { taskId: 'T3' },
      'feedbackHandler', // 文字列に変更
      'reopenFeedback',
      ['T3'],
    ],
    [
      'report-feedback',
      { taskId: 'T3', outputPath: 'fb.md' },
      'feedbackHandler', // 文字列に変更
      'generateFeedbackReport',
      ['T3', 'fb.md'],
    ],
    [
      'prioritize-feedback',
      { taskId: 'T3' },
      'feedbackHandler', // 文字列に変更
      'prioritizeFeedback',
      ['T3'],
    ],
    [
      'link-feedback-commit',
      { taskId: 'T3', commitHash: 'def' },
      'feedbackHandler', // 文字列に変更
      'linkFeedbackToCommit',
      ['T3', 'def'],
    ],
    [
      'link-feedback-session',
      { taskId: 'T3', sessionId: 'S3' },
      'feedbackHandler', // 文字列に変更
      'linkFeedbackToSession',
      ['T3', 'S3'],
    ],
    [
      'integrate-feedback-task',
      { taskId: 'T3' },
      'feedbackHandler', // 文字列に変更
      'integrateFeedbackWithTask',
      ['T3'],
    ],
    [
      'integrate-feedback-session',
      { taskId: 'T3', sessionId: 'S3' },
      'feedbackHandler', // 文字列に変更
      'integrateFeedbackWithSession',
      ['T3', 'S3'],
    ],
  ];

  describe.each(testCases)(
    'execute(%s)',
    // managerName を受け取るように変更
    (command, args, managerName, expectedMethod, expectedArgs) => {
      test(`should call correct manager method with correct arguments`, async () => {
        // managerName から実際のモックオブジェクトを取得
        // eslint-disable-next-line security/detect-object-injection
        const expectedManager = managers[managerName];
        if (!expectedManager) {
          throw new Error(`Mock manager not found for name: ${managerName}`);
        }
        // eslint-disable-next-line security/detect-object-injection
        if (typeof expectedManager[expectedMethod] !== 'function') {
          throw new Error(
            `Mock method ${expectedMethod} not found on manager ${managerName}`
          );
        }

        const mockResult = { success: true, data: 'mock data' };
        // eslint-disable-next-line security/detect-object-injection
        expectedManager[expectedMethod].mockResolvedValue(mockResult); // メソッドの戻り値を設定

        const result = await cliFacade.execute(command, args);

        // eslint-disable-next-line security/detect-object-injection
        expect(expectedManager[expectedMethod]).toHaveBeenCalledTimes(1);
        // eslint-disable-next-line security/detect-object-injection
        expect(expectedManager[expectedMethod]).toHaveBeenCalledWith(
          ...expectedArgs
        );
        expect(result).toEqual(mockResult); // Facade が結果をそのまま返すことを確認
      });

      test('should emit _before and _after events', async () => {
        // managerName から実際のモックオブジェクトを取得
        // eslint-disable-next-line security/detect-object-injection
        const expectedManager = managers[managerName];
        if (!expectedManager) {
          throw new Error(`Mock manager not found for name: ${managerName}`);
        }
        // eslint-disable-next-line security/detect-object-injection
        if (typeof expectedManager[expectedMethod] !== 'function') {
          throw new Error(
            `Mock method ${expectedMethod} not found on manager ${managerName}`
          );
        }
        // eslint-disable-next-line security/detect-object-injection
        expectedManager[expectedMethod].mockResolvedValue({ success: true }); // イベントテスト用に最低限の戻り値を設定
        await cliFacade.execute(command, args);

        // expectStandardizedEventEmittedAsync に変更
        expectStandardizedEventEmittedAsync(
          mockEventEmitter,
          'cli',
          `${command}_before`,
          { args }
        );
        expectStandardizedEventEmittedAsync(
          mockEventEmitter,
          'cli',
          `${command}_after`,
          { args, result: expect.anything() }
        );
      });
    }
  );

  test('should throw CliError for unknown command', async () => {
    // ApplicationError -> CliError
    const unknownCommand = 'unknown_command';
    const args = {};

    await expect(cliFacade.execute(unknownCommand, args)).rejects.toThrow(
      CliError
    );
    await expect(
      cliFacade.execute(unknownCommand, args)
    ).rejects.toHaveProperty('code', 'ERR_CLI_UNKNOWN_COMMAND');

    // エラーイベントが発行されることを確認
    expect(emitErrorEvent).toHaveBeenCalledWith(
      mockEventEmitter,
      mockLogger,
      'CliFacade',
      `execute_${unknownCommand}`,
      expect.any(CliError), // スローされたエラーオブジェクトの型を確認
      null,
      { args }
    );
  });

  test('should re-throw error from manager/handler and emit error event', async () => {
    const command = 'init';
    const args = { projectId: 'P_ERR', request: 'Fail' };
    const originalError = new Error('Manager failed');
    mockWorkflowManager.initializeWorkflow.mockRejectedValue(originalError); // マネージャーがエラーをスロー

    let thrownError;
    try {
      await cliFacade.execute(command, args);
    } catch (error) {
      thrownError = error;
    }

    // エラーがスローされたことを確認
    expect(thrownError).toBeDefined();
    // スローされたエラーが CliError のインスタンスであることを確認
    expect(thrownError).toBeInstanceOf(CliError);
    // cause プロパティが元のエラーと一致することを確認
    expect(thrownError.cause).toBe(originalError);
    // code プロパティが期待通りであることを確認 (CliError のデフォルト)
    expect(thrownError.code).toBe('ERR_CLI');

    // エラーイベントが発行されることを確認
    expect(emitErrorEvent).toHaveBeenCalledTimes(1);
    expect(emitErrorEvent).toHaveBeenCalledWith(
      mockEventEmitter,
      mockLogger,
      'CliFacade',
      `execute_${command}`,
      thrownError, // スローされたエラーオブジェクト (ラップ後のもの)
      null,
      { args }
    );
  });

  test('should handle ValidationError specifically if needed', async () => {
    const command = 'create-task';
    const args = { title: '', description: 'Invalid' }; // title が空でバリデーションエラー想定
    const validationError = new ValidationError('Invalid task data', {
      context: { errors: ['Title is required'] },
    });
    mockTaskManager.createTask.mockRejectedValue(validationError); // バリデーションエラーをスロー

    await expect(cliFacade.execute(command, args)).rejects.toBe(
      validationError
    );

    expect(emitErrorEvent).toHaveBeenCalledWith(
      mockEventEmitter,
      mockLogger,
      'CliFacade',
      `execute_${command}`,
      validationError,
      null,
      { args }
    );
  });
});
