/**
 * display.js のテスト
 */
const {
  formatStatus, // displayStatus -> formatStatus
  formatSessionList, // displaySessionList -> formatSessionList
  formatTaskList, // displayTaskList -> formatTaskList
  displayResult, // displayResult はそのまま
  // formatSessionInfo, // 必要に応じて追加
  // formatTaskInfo, // 必要に応じて追加
  // formatFeedbackStatus, // 必要に応じて追加
} = require('../../src/cli/display');
const { captureConsole } = require('../helpers/test-helpers');
const colors = require('colors/safe'); // colors モジュールをインポート

// colors モジュールをモック化
jest.mock('colors/safe', () => {
  // 各色関数が、渡された文字列をそのまま返すようにモック
  const identity = (str) => str;
  return {
    yellow: identity,
    green: identity,
    red: identity,
    blue: identity,
    cyan: identity,
    white: identity, // 必要に応じて他の色も追加
  };
});

describe('display.js', () => {
  let consoleCapture;

  beforeEach(() => {
    consoleCapture = captureConsole(); // 各テスト前にコンソール出力をキャプチャ
  });

  afterEach(() => {
    consoleCapture.restore(); // 各テスト後にキャプチャを解除
    jest.clearAllMocks(); // モックのクリア
  });

  describe('formatStatus', () => {
    // displayStatus -> formatStatus
    test('should display current state, task counts, and session info', () => {
      // Arrange
      const statusInfo = {
        currentState: 'IDLE',
        tasks: {
          count: 5,
          statusCounts: { completed: 2, in_progress: 1, pending: 2 },
          currentFocus: {
            id: 'T003',
            title: 'Focus Task',
            status: 'in_progress',
            progress: 50,
          },
        },
        session: {
          id: 'S123',
          timestamp: '2025-04-07T10:00:00Z',
          previousSessionId: 'S122',
        },
      };

      // Act
      const output = formatStatus(statusInfo); // displayStatus -> formatStatus

      // Assert
      // const output = consoleCapture.logMock.mock.calls.flat().join('\n'); // console.log は使わない
      expect(output).toContain('現在の状態: IDLE');
      expect(output).toContain('タスク状態:');
      expect(output).toContain('タスク数: 5');
      expect(output).toContain('状態別カウント:');
      expect(output).toContain('完了: 2');
      expect(output).toContain('進行中: 1');
      expect(output).toContain('保留中: 2');
      expect(output).toContain('ブロック中: 0'); // デフォルト値
      expect(output).toContain('現在のフォーカス:');
      expect(output).toContain('- T003: Focus Task');
      expect(output).toContain('状態: in_progress, 進捗率: 50%');
      expect(output).toContain('セッション状態:');
      expect(output).toContain('セッションID: S123');
      expect(output).toContain('タイムスタンプ: 2025-04-07T10:00:00Z');
      expect(output).toContain('前回のセッションID: S122');
    });

    test('should display correctly when no focus task', () => {
      // Arrange
      const statusInfo = {
        currentState: 'PROCESSING',
        tasks: {
          count: 3,
          statusCounts: { pending: 3 },
          currentFocus: null, // フォーカスタスクなし
        },
        session: null, // セッションなし
      };
      // Act
      const output = formatStatus(statusInfo); // displayStatus -> formatStatus
      // Assert
      // const output = consoleCapture.logMock.mock.calls.flat().join('\n'); // console.log は使わない
      expect(output).toContain('現在の状態: PROCESSING');
      expect(output).toContain('タスク数: 3');
      expect(output).toContain('保留中: 3');
      expect(output).not.toContain('現在のフォーカス:');
      expect(output).toContain('アクティブなセッションはありません');
    });
  });

  describe('formatSessionList', () => {
    // displaySessionList -> formatSessionList
    test('should display list of sessions sorted by creation date', () => {
      // Arrange
      const sessions = [
        {
          session_id: 'S123',
          created_at: '2025-04-06T10:00:00Z',
          ended_at: null,
        }, // Active
        {
          session_id: 'S122',
          created_at: '2025-04-05T15:00:00Z',
          ended_at: '2025-04-05T18:00:00Z',
        }, // Ended
        {
          session_id: 'S124',
          created_at: '2025-04-07T09:00:00Z',
          ended_at: null,
        }, // Active (latest)
      ];
      // Act
      const output = formatSessionList(sessions); // displaySessionList -> formatSessionList
      // Assert
      // const output = consoleCapture.logMock.mock.calls.flat().join('\n'); // console.log は使わない
      expect(output).toContain('3件のセッション:');
      // Check order (latest first)
      expect(output.indexOf('S124')).toBeLessThan(output.indexOf('S123'));
      expect(output.indexOf('S123')).toBeLessThan(output.indexOf('S122'));
      // Check content
      expect(output).toContain('1. S124 [アクティブ]');
      expect(output).toContain('作成: 2025-04-07T09:00:00Z');
      expect(output).toContain('2. S123 [アクティブ]');
      expect(output).toContain('作成: 2025-04-06T10:00:00Z');
      expect(output).toContain('3. S122 [終了]');
      expect(output).toContain('作成: 2025-04-05T15:00:00Z');
      expect(output).toContain('終了: 2025-04-05T18:00:00Z');
    });

    test('should display message if no sessions found', () => {
      // Arrange
      const sessions = [];
      // Act
      const output = formatSessionList(sessions); // displaySessionList -> formatSessionList
      // Assert
      // const output = consoleCapture.logMock.mock.calls.flat().join('\n'); // console.log は使わない
      expect(output).toContain('セッションが見つかりません');
    });

    test('should display message if sessions is null or undefined', () => {
      // Arrange
      // Act
      const outputNull = formatSessionList(null); // displaySessionList -> formatSessionList
      const outputUndefined = formatSessionList(undefined); // displaySessionList -> formatSessionList
      // Assert
      // const output = consoleCapture.logMock.mock.calls.flat().join('\n'); // console.log は使わない
      expect(outputNull).toContain('セッションが見つかりません');
      expect(outputUndefined).toContain('セッションが見つかりません');
    });
  });

  // formatSessionInfo のテストを追加
  describe('formatSessionInfo', () => {
    const { formatSessionInfo } = require('../../src/cli/display'); // 関数をインポート

    test('should display session details correctly', () => {
      const session = {
        session_id: 'S456',
        created_at: '2025-04-08T11:00:00Z',
        ended_at: '2025-04-08T12:30:00Z',
        previous_session_id: 'S455',
        session_handover: {
          project_id: 'P789',
          session_timestamp: '2025-04-08T12:30:00Z',
        },
      };
      const output = formatSessionInfo(session);
      expect(output).toContain('セッション情報 (S456):');
      expect(output).toContain('作成日時: 2025-04-08T11:00:00Z');
      expect(output).toContain('終了日時: 2025-04-08T12:30:00Z');
      expect(output).toContain('前回のセッションID: S455');
      expect(output).toContain('引継ぎ情報:');
      expect(output).toContain('プロジェクトID: P789');
      expect(output).toContain('タイムスタンプ: 2025-04-08T12:30:00Z');
    });

    test('should display correctly when session is null', () => {
      const output = formatSessionInfo(null);
      expect(output).toContain('セッション情報が見つかりません。');
    });

    test('should display correctly without previous session id', () => {
      const session = {
        session_id: 'S457',
        created_at: '2025-04-09T10:00:00Z',
        ended_at: null,
        session_handover: null,
      };
      const output = formatSessionInfo(session);
      expect(output).toContain('セッション情報 (S457):');
      expect(output).toContain('終了日時: 未終了');
      expect(output).not.toContain('前回のセッションID:');
      expect(output).not.toContain('引継ぎ情報:');
    });

    test('should display correctly without handover info', () => {
      const session = {
        session_id: 'S458',
        created_at: '2025-04-10T10:00:00Z',
        ended_at: null,
        previous_session_id: 'S457',
        session_handover: null, // 引継ぎ情報なし
      };
      const output = formatSessionInfo(session);
      expect(output).toContain('セッション情報 (S458):');
      expect(output).toContain('前回のセッションID: S457');
      expect(output).not.toContain('引継ぎ情報:');
    });
  });

  // formatTaskInfo のテストを追加
  describe('formatTaskInfo', () => {
    const { formatTaskInfo } = require('../../src/cli/display'); // 関数をインポート

    test('should display task details correctly', () => {
      const task = {
        id: 'T789',
        title: 'Detailed Task',
        description: 'A task with all fields.',
        status: 'in_progress',
        priority: 1,
        progress_percentage: 60,
        estimated_hours: 8,
        dependencies: [{ task_id: 'T788', type: 'strong' }],
        git_commits: ['abc123def', 'ghi456jkl'],
        created_at: '2025-04-08T13:00:00Z',
        updated_at: '2025-04-08T14:00:00Z',
      };
      const output = formatTaskInfo(task);
      expect(output).toContain('タスク情報 (T789):');
      expect(output).toContain('タイトル: Detailed Task');
      expect(output).toContain('説明: A task with all fields.');
      expect(output).toContain('状態: in_progress');
      expect(output).toContain('優先度: 1');
      expect(output).toContain('進捗率: 60%');
      expect(output).toContain('見積もり時間: 8 時間');
      expect(output).toContain('依存関係: T788');
      expect(output).toContain('関連コミット: abc123def, ghi456jkl');
      expect(output).toContain('作成日時: 2025-04-08T13:00:00Z');
      expect(output).toContain('更新日時: 2025-04-08T14:00:00Z');
    });

    test('should display correctly when task is null', () => {
      const output = formatTaskInfo(null);
      expect(output).toContain('タスク情報が見つかりません。');
    });

    test('should display correctly without optional fields', () => {
      const task = {
        id: 'T790',
        title: 'Minimal Task',
        description: 'Only required fields.',
        status: 'pending',
        priority: 3,
        created_at: '2025-04-09T11:00:00Z',
        updated_at: '2025-04-09T11:00:00Z',
        // estimated_hours, dependencies, git_commits なし
      };
      const output = formatTaskInfo(task);
      expect(output).toContain('タスク情報 (T790):');
      expect(output).toContain('進捗率: 0%'); // デフォルト値
      expect(output).not.toContain('見積もり時間:');
      expect(output).not.toContain('依存関係:');
      expect(output).not.toContain('関連コミット:');
    });

    test('should display correctly with empty dependencies and commits', () => {
      const task = {
        id: 'T791',
        title: 'Empty Arrays Task',
        description: 'Task with empty arrays.',
        status: 'completed',
        priority: 5,
        progress_percentage: 100,
        dependencies: [], // 空配列
        git_commits: [], // 空配列
        created_at: '2025-04-10T11:00:00Z',
        updated_at: '2025-04-10T12:00:00Z',
      };
      const output = formatTaskInfo(task);
      expect(output).toContain('タスク情報 (T791):');
      expect(output).not.toContain('依存関係:');
      expect(output).not.toContain('関連コミット:');
    });
  });

  // formatFeedbackStatus のテストを追加
  describe('formatFeedbackStatus', () => {
    const { formatFeedbackStatus } = require('../../src/cli/display'); // 関数をインポート

    test('should display feedback details correctly', () => {
      const feedback = {
        feedback_loop: {
          task_id: 'T123',
          feedback_status: 'resolved',
          verification_results: {
            passes_tests: true,
            details: 'All tests passed.',
          },
          analysis_results: { summary: 'Code looks good.' },
          related_commits: ['fedcba9'],
          related_sessions: ['S987'],
          updated_at: '2025-04-08T15:00:00Z',
        },
      };
      const output = formatFeedbackStatus(feedback);
      expect(output).toContain('フィードバック状態 (タスク: T123):');
      expect(output).toContain('状態: resolved');
      expect(output).toContain('テスト結果: 成功');
      expect(output).toContain('詳細: All tests passed.');
      expect(output).toContain('分析サマリー: Code looks good.');
      expect(output).toContain('関連コミット: fedcba9');
      expect(output).toContain('関連セッション: S987');
      expect(output).toContain('最終更新: 2025-04-08T15:00:00Z');
    });

    test('should display correctly when feedback or feedback_loop is null', () => {
      expect(formatFeedbackStatus(null)).toContain(
        'フィードバック情報が見つかりません。'
      );
      expect(formatFeedbackStatus({})).toContain(
        'フィードバック情報が見つかりません。'
      );
    });

    test('should display correctly without optional fields', () => {
      const feedback = {
        feedback_loop: {
          task_id: 'T124',
          verification_results: { passes_tests: false }, // details なし
          // analysis_results なし
          // related_commits なし
          // related_sessions なし
          updated_at: '2025-04-09T12:00:00Z',
        },
      };
      const output = formatFeedbackStatus(feedback);
      expect(output).toContain('フィードバック状態 (タスク: T124):');
      expect(output).toContain('状態: N/A'); // デフォルト
      expect(output).toContain('テスト結果: 失敗');
      expect(output).not.toContain('詳細:');
      expect(output).not.toContain('分析サマリー:');
      expect(output).not.toContain('関連コミット:');
      expect(output).not.toContain('関連セッション:');
    });

    test('should display correctly with empty related arrays', () => {
      const feedback = {
        feedback_loop: {
          task_id: 'T125',
          verification_results: { passes_tests: true },
          related_commits: [], // 空配列
          related_sessions: [], // 空配列
          updated_at: '2025-04-10T13:00:00Z',
        },
      };
      const output = formatFeedbackStatus(feedback);
      expect(output).toContain('フィードバック状態 (タスク: T125):');
      expect(output).not.toContain('関連コミット:');
      expect(output).not.toContain('関連セッション:');
    });
  });

  describe('formatTaskList', () => {
    // displayTaskList -> formatTaskList
    test('should display tasks grouped by status', () => {
      // Arrange
      const tasksResult = {
        decomposed_tasks: [
          { id: 'T001', title: 'Task 1', status: 'completed' },
          {
            id: 'T002',
            title: 'Task 2',
            status: 'in_progress',
            progress_percentage: 75,
          },
          { id: 'T003', title: 'Task 3', status: 'pending' },
          {
            id: 'T004',
            title: 'Task 4',
            status: 'in_progress',
            progress_percentage: 20,
          },
          { id: 'T005', title: 'Task 5', status: 'blocked' },
        ],
      };
      // Act
      const output = formatTaskList(tasksResult); // displayTaskList -> formatTaskList
      // Assert
      // const output = consoleCapture.logMock.mock.calls.flat().join('\n'); // console.log は使わない
      expect(output).toContain('5件のタスク:');
      // Check groups and order
      expect(output).toContain('進行中のタスク:');
      expect(output).toContain('1. T002: Task 2 (75%)');
      expect(output).toContain('2. T004: Task 4 (20%)');
      expect(output).toContain('保留中のタスク:');
      expect(output).toContain('1. T003: Task 3');
      expect(output).toContain('完了したタスク:');
      expect(output).toContain('1. T001: Task 1');
      expect(output).toContain('ブロックされたタスク:');
      expect(output).toContain('1. T005: Task 5');
    });

    test('should display message if no tasks found', () => {
      // Arrange
      const tasksResult = { decomposed_tasks: [] };
      // Act
      const output = formatTaskList(tasksResult); // displayTaskList -> formatTaskList
      // Assert
      // const output = consoleCapture.logMock.mock.calls.flat().join('\n'); // console.log は使わない
      expect(output).toContain('タスクが見つかりません');
    });

    test('should display message if tasksResult is null or undefined', () => {
      // Arrange
      // Act
      const outputNull = formatTaskList(null); // displayTaskList -> formatTaskList
      const outputUndefined = formatTaskList(undefined); // displayTaskList -> formatTaskList
      // Assert
      // const output = consoleCapture.logMock.mock.calls.flat().join('\n'); // console.log は使わない
      expect(outputNull).toContain('タスクが見つかりません');
      expect(outputUndefined).toContain('タスクが見つかりません');
    });
  });

  describe('displayResult', () => {
    test('should not display anything for interactive command', () => {
      displayResult('interactive', {});
      expect(consoleCapture.logMock).not.toHaveBeenCalled();
    });

    test('should not display anything for null or undefined result', () => {
      displayResult('some-command', null);
      displayResult('other-command', undefined);
      expect(consoleCapture.logMock).not.toHaveBeenCalled();
    });

    test('should call formatStatus and log result for status command', () => {
      // displayStatus -> formatStatus
      const statusData = {
        currentState: 'TESTING',
        tasks: { count: 0, statusCounts: {} }, // formatStatus が参照するためダミーデータを追加
        session: null,
      };
      displayResult('status', statusData);
      // Check if console.log was called with the formatted string
      expect(consoleCapture.logMock).toHaveBeenCalledWith(
        expect.stringContaining('現在の状態: TESTING')
      );
    });

    test('should call formatSessionList and log result for list-sessions command', () => {
      // displaySessionList -> formatSessionList
      const sessionData = [
        { session_id: 'S999', created_at: new Date().toISOString() },
      ]; // created_at を追加
      displayResult('list-sessions', sessionData);
      // Check if console.log was called with the formatted string
      expect(consoleCapture.logMock).toHaveBeenCalledWith(
        expect.stringContaining('1件のセッション:')
      );
      expect(consoleCapture.logMock).toHaveBeenCalledWith(
        expect.stringContaining('S999')
      );
    });

    test('should call formatTaskList and log result for list-tasks command', () => {
      // displayTaskList -> formatTaskList
      const taskData = {
        decomposed_tasks: [
          { id: 'T999', title: 'Test Task', status: 'pending' },
        ],
      };
      displayResult('list-tasks', taskData);
      // Check if console.log was called with the formatted string
      expect(consoleCapture.logMock).toHaveBeenCalledWith(
        expect.stringContaining('1件のタスク:')
      );
      expect(consoleCapture.logMock).toHaveBeenCalledWith(
        expect.stringContaining('T999: Test Task')
      );
    });

    // session-info, task-info, feedback-status のテストは上記で追加済み

    test('should display JSON for other object results', () => {
      const command = 'some-other-command';
      const result = { data: 'some data', value: 123 };
      displayResult(command, result);
      expect(consoleCapture.logMock).toHaveBeenCalledWith(
        JSON.stringify(result, null, 2)
      );
    });

    test('should display string result directly', () => {
      const command = 'export-task';
      const result = '/path/to/export.json';
      displayResult(command, result);
      expect(consoleCapture.logMock).toHaveBeenCalledWith(result);
    });

    test('should display JSON for number result', () => {
      const command = 'some-number-command';
      const result = 12345;
      displayResult(command, result);
      // 数値も JSON.stringify で文字列化されることを期待
      expect(consoleCapture.logMock).toHaveBeenCalledWith(
        JSON.stringify(result, null, 2)
      );
    });

    test('should display JSON for unknown command object result', () => {
      const command = 'unknown-object-command';
      const result = { key: 'value' };
      displayResult(command, result);
      expect(consoleCapture.logMock).toHaveBeenCalledWith(
        JSON.stringify(result, null, 2)
      );
    });
  });
});
