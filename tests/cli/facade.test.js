/**
 * @fileoverview CliFacade クラスのテスト
 */
const CliFacade = require('../../src/cli/facade');
const {
  ApplicationError,
  ValidationError,
  CliError,
} = require('../../src/lib/utils/errors');
const { createMockDependencies } = require('../helpers/mock-factory'); // createMockDependencies をインポート
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

  let mockDependencies; // モック依存関係を保持する変数

  beforeEach(() => {
    // Arrange (Common setup)
    mockDependencies = createMockDependencies(); // 共通モックを生成
    mockLogger = mockDependencies.logger; // 個別変数にも代入
    mockEventEmitter = mockDependencies.eventEmitter; // 個別変数にも代入

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
      linkFeedbackToCommit: jest.fn().mockResolvedValue(undefined),
      linkFeedbackToSession: jest.fn().mockResolvedValue(undefined),
      integrateFeedbackWithTask: jest.fn().mockResolvedValue(true),
      integrateFeedbackWithSession: jest.fn().mockResolvedValue(true),
    };
    mockReportGenerator = {
      generateReport: jest.fn().mockResolvedValue('# Report Content'),
    };
    mockStatusViewer = {
      getWorkflowStatus: jest.fn().mockResolvedValue({ currentState: 'ready' }),
    };
    mockInteractiveMode = { start: jest.fn().mockResolvedValue(undefined) };
    mockComponentSyncer = { syncComponents: jest.fn().mockResolvedValue(true) };

    // モックマネージャーのルックアップオブジェクトを作成 (共通モックから取得)
    managers = {
      workflowManager:
        mockDependencies.cliWorkflowManager || mockWorkflowManager, // 共通モックにあれば使う
      sessionManager: mockDependencies.cliSessionManager || mockSessionManager,
      taskManager: mockDependencies.cliTaskManager || mockTaskManager,
      feedbackHandler:
        mockDependencies.cliFeedbackHandler || mockFeedbackHandler,
      reportGenerator:
        mockDependencies.cliReportGenerator || mockReportGenerator,
      statusViewer: mockDependencies.cliStatusViewer || mockStatusViewer,
      interactiveMode:
        mockDependencies.cliInteractiveMode || mockInteractiveMode,
      componentSyncer:
        mockDependencies.cliComponentSyncer || mockComponentSyncer,
    };

    // CliFacade インスタンスを作成
    // CliFacade インスタンスを作成 (依存関係は共通モックから取得したものを渡す)
    cliFacade = new CliFacade({
      logger: mockLogger,
      eventEmitter: mockEventEmitter,
      cliWorkflowManager: managers.workflowManager,
      cliSessionManager: managers.sessionManager,
      cliTaskManager: managers.taskManager,
      cliFeedbackHandler: managers.feedbackHandler,
      cliReportGenerator: managers.reportGenerator,
      cliStatusViewer: managers.statusViewer,
      cliInteractiveMode: managers.interactiveMode,
      cliComponentSyncer: managers.componentSyncer,
      // Facade 自体は ID 生成関数を直接必要としない
    });

    // emitErrorEvent のモックをクリア
    emitErrorEvent.mockClear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // 各コマンドに対するテストケース
  const testCases = [
    // command, args, managerName (string), expectedMethod, expectedArgs
    [
      'init',
      { projectId: 'P1', request: 'Req1' },
      'workflowManager',
      'initializeWorkflow',
      ['P1', 'Req1'],
    ],
    [
      'start-session',
      { previousSessionId: 'S0' },
      'sessionManager',
      'startSession',
      ['S0'],
    ],
    [
      'end-session',
      { sessionId: 'S1' },
      'sessionManager',
      'endSession',
      ['S1'],
    ],
    [
      'create-task',
      { title: 'T', description: 'D', priority: 1 },
      'taskManager',
      'createTask',
      ['T', 'D', expect.objectContaining({ priority: 1 })],
    ],
    [
      'update-task',
      { taskId: 'T1', status: 'done', progress: 100 },
      'taskManager',
      'updateTask',
      ['T1', 'done', 100],
    ],
    [
      'collect-feedback',
      { taskId: 'T1', testCommand: 'npm test' },
      'feedbackHandler',
      'collectFeedback',
      ['T1', 'npm test'],
    ],
    [
      'resolve-feedback',
      { feedbackId: 'F1' },
      'feedbackHandler',
      'resolveFeedback',
      ['F1'],
    ],
    ['sync', {}, 'componentSyncer', 'syncComponents', []],
    [
      'report',
      { type: 'task_summary', format: 'json' },
      'reportGenerator',
      'generateReport',
      ['task_summary', expect.objectContaining({ format: 'json' })],
    ],
    ['status', {}, 'statusViewer', 'getWorkflowStatus', []],
    ['interactive', {}, 'interactiveMode', 'start', []],
    ['list-sessions', {}, 'sessionManager', 'listSessions', []],
    ['current-session', {}, 'sessionManager', 'getCurrentSessionInfo', []],
    [
      'session-info',
      { sessionId: 'S2' },
      'sessionManager',
      'getSessionInfo',
      ['S2'],
    ],
    [
      'export-session',
      { sessionId: 'S2', path: 'out.json' },
      'sessionManager',
      'exportSession',
      ['S2', 'out.json'],
    ],
    [
      'import-session',
      { path: 'in.json' },
      'sessionManager',
      'importSession',
      ['in.json'],
    ],
    ['list-tasks', {}, 'taskManager', 'listTasks', []],
    ['task-info', { taskId: 'T2' }, 'taskManager', 'getTaskInfo', ['T2']],
    [
      'update-task-progress',
      { taskId: 'T2', progress: 75 },
      'taskManager',
      'updateTaskProgress',
      ['T2', 75],
    ],
    ['delete-task', { taskId: 'T2' }, 'taskManager', 'deleteTask', ['T2']],
    [
      'link-task-commit',
      { taskId: 'T2', commitHash: 'abc' },
      'taskManager',
      'linkTaskToCommit',
      ['T2', 'abc'],
    ],
    [
      'export-task',
      { taskId: 'T2', path: 'task.json' },
      'taskManager',
      'exportTask',
      ['T2', 'task.json'],
    ],
    [
      'import-task',
      { path: 'task_in.json' },
      'taskManager',
      'importTask',
      ['task_in.json'],
    ],
    [
      'feedback-status',
      { taskId: 'T3' },
      'feedbackHandler',
      'getFeedbackStatus',
      ['T3'],
    ],
    [
      'reopen-feedback',
      { taskId: 'T3' },
      'feedbackHandler',
      'reopenFeedback',
      ['T3'],
    ],
    [
      'report-feedback',
      { taskId: 'T3', outputPath: 'fb.md' },
      'feedbackHandler',
      'generateFeedbackReport',
      ['T3', 'fb.md'],
    ],
    [
      'prioritize-feedback',
      { taskId: 'T3' },
      'feedbackHandler',
      'prioritizeFeedback',
      ['T3'],
    ],
    [
      'link-feedback-commit',
      { taskId: 'T3', commitHash: 'def' },
      'feedbackHandler',
      'linkFeedbackToCommit',
      ['T3', 'def'],
    ],
    [
      'link-feedback-session',
      { taskId: 'T3', sessionId: 'S3' },
      'feedbackHandler',
      'linkFeedbackToSession',
      ['T3', 'S3'],
    ],
    [
      'integrate-feedback-task',
      { taskId: 'T3' },
      'feedbackHandler',
      'integrateFeedbackWithTask',
      ['T3'],
    ],
    [
      'integrate-feedback-session',
      { taskId: 'T3', sessionId: 'S3' },
      'feedbackHandler',
      'integrateFeedbackWithSession',
      ['T3', 'S3'],
    ],
  ];

  describe.each(testCases)(
    'execute(%s)',
    (command, args, managerName, expectedMethod, expectedArgs) => {
      test(`should call correct manager method with correct arguments`, async () => {
        // Arrange
        // eslint-disable-next-line security/detect-object-injection
        const expectedManager = managers[managerName];
        if (
          !expectedManager ||
          typeof expectedManager[expectedMethod] !== 'function'
        ) {
          throw new Error(
            `Mock manager or method not found: ${managerName}.${expectedMethod}`
          );
        }
        const mockResult = { success: true, data: 'mock data' };
        // eslint-disable-next-line security/detect-object-injection
        expectedManager[expectedMethod].mockResolvedValue(mockResult);

        // Act
        const result = await cliFacade.execute(command, args);

        // Assert
        // eslint-disable-next-line security/detect-object-injection
        expect(expectedManager[expectedMethod]).toHaveBeenCalledTimes(1);
        // eslint-disable-next-line security/detect-object-injection
        expect(expectedManager[expectedMethod]).toHaveBeenCalledWith(
          ...expectedArgs
        );
        expect(result).toEqual(mockResult);
      });

      test('should emit _before and _after events', async () => {
        // Arrange
        // eslint-disable-next-line security/detect-object-injection
        const expectedManager = managers[managerName];
        if (
          !expectedManager ||
          typeof expectedManager[expectedMethod] !== 'function'
        ) {
          throw new Error(
            `Mock manager or method not found: ${managerName}.${expectedMethod}`
          );
        }
        const mockResult = { success: true };
        // eslint-disable-next-line security/detect-object-injection
        expectedManager[expectedMethod].mockResolvedValue(mockResult);

        // Act
        await cliFacade.execute(command, args);

        // Assert
        // イベント名とデータ構造を修正
        await expectStandardizedEventEmittedAsync(
          mockEventEmitter,
          'cli',
          `${command}_before`,
          { args }
        );
        await expectStandardizedEventEmittedAsync(
          mockEventEmitter,
          'cli',
          `${command}_after`,
          { args, result: mockResult }
        );
      });
    }
  );

  test('should throw CliError for unknown command and emit error event', async () => {
    // Arrange
    const unknownCommand = 'unknown_command';
    const args = {};

    // Act & Assert
    await expect(cliFacade.execute(unknownCommand, args)).rejects.toThrow(
      CliError
    );
    await expect(
      cliFacade.execute(unknownCommand, args)
    ).rejects.toHaveProperty('code', 'ERR_CLI_UNKNOWN_COMMAND');

    // エラーイベント発行の検証
    expect(emitErrorEvent).toHaveBeenCalledWith(
      mockEventEmitter,
      mockLogger,
      'CliFacade',
      `execute_${unknownCommand}`,
      expect.objectContaining({
        // CliError インスタンス
        name: 'CliError',
        code: 'ERR_CLI_UNKNOWN_COMMAND',
        context: expect.objectContaining({ command: unknownCommand }),
      }),
      null,
      { args }
    );
  });

  test('should re-throw error from manager/handler as CliError and emit error event', async () => {
    // Arrange
    const command = 'init';
    const args = { projectId: 'P_ERR', request: 'Fail' };
    const originalError = new Error('Manager failed');
    mockWorkflowManager.initializeWorkflow.mockRejectedValue(originalError);

    // Act & Assert
    await expect(cliFacade.execute(command, args)).rejects.toThrow(CliError);
    await expect(cliFacade.execute(command, args)).rejects.toHaveProperty(
      'cause',
      originalError
    );
    await expect(cliFacade.execute(command, args)).rejects.toHaveProperty(
      'code',
      'ERR_CLI'
    ); // Default CliError code

    // エラーイベント発行の検証
    expect(emitErrorEvent).toHaveBeenCalledWith(
      mockEventEmitter,
      mockLogger,
      'CliFacade',
      `execute_${command}`,
      expect.objectContaining({
        // CliError インスタンス
        name: 'CliError',
        code: 'ERR_CLI',
        cause: originalError,
        context: expect.objectContaining({
          command,
          args,
          originalErrorName: 'Error',
        }), // originalErrorName を追加
      }),
      null,
      { args }
    );
  });

  test('should pass through ValidationError and emit error event', async () => {
    // Arrange
    const command = 'create-task';
    const args = { title: '', description: 'Invalid' };
    const validationError = new ValidationError('Invalid task data', {
      context: { errors: ['Title is required'] },
    });
    mockTaskManager.createTask.mockRejectedValue(validationError);

    // Act & Assert
    await expect(cliFacade.execute(command, args)).rejects.toBe(
      validationError
    ); // ValidationError はそのままスローされる

    // エラーイベント発行の検証
    expect(emitErrorEvent).toHaveBeenCalledWith(
      mockEventEmitter,
      mockLogger,
      'CliFacade',
      `execute_${command}`,
      validationError, // ValidationError がそのまま渡される
      null,
      { args }
    );
  });
});
