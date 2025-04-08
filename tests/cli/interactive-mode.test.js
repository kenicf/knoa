const CliInteractiveMode = require('../../src/cli/interactive-mode');
const { ApplicationError } = require('../../src/lib/core/error-framework');
const { createMockDependencies } = require('../helpers/mock-factory'); // createMockDependencies をインポート
const {
  expectStandardizedEventEmittedAsync,
} = require('../helpers/test-helpers');
const readline = require('readline');
const colors = require('colors/safe');

// emitErrorEvent もモック化
jest.mock('../../src/lib/utils/error-helpers', () => ({
  emitErrorEvent: jest.fn(),
}));
const { emitErrorEvent } = require('../../src/lib/utils/error-helpers');

// readline と colors をモック化
jest.mock('readline');
jest.mock('colors/safe', () => {
  // 各色関数を jest.fn() でラップするヘルパー関数
  const createMockColor = () => jest.fn((str) => str);
  return {
    cyan: createMockColor(),
    green: createMockColor(),
    red: createMockColor(),
    yellow: createMockColor(),
    blue: createMockColor(),
    white: createMockColor(),
  };
});

describe('CliInteractiveMode', () => {
  let mockLogger;
  let mockEventEmitter;
  let mockCliFacade;
  let mockErrorHandler;
  let cliInteractiveMode;
  let mockRlInstance;
  let consoleErrorSpy;
  let consoleLogSpy; // console.log のスパイも追加

  let mockDependencies; // モック依存関係を保持する変数

  beforeEach(() => {
    mockDependencies = createMockDependencies(); // 共通モックを生成
    mockLogger = mockDependencies.logger; // 個別変数にも代入
    mockEventEmitter = mockDependencies.eventEmitter; // 個別変数にも代入
    mockCliFacade = { execute: jest.fn() }; // Facade は別途モック
    mockErrorHandler = mockDependencies.errorHandler; // 共通モックから取得

    mockRlInstance = {
      prompt: jest.fn(),
      on: jest.fn(),
      close: jest.fn(),
    };
    readline.createInterface.mockReturnValue(mockRlInstance);

    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {}); // console.log をモック化

    // テスト対象インスタンスを作成 (errorHandler も渡す場合があるため beforeEach 外で生成)
    // cliInteractiveMode = new CliInteractiveMode({ ... }); // 下の describe 内で生成

    // モッククリア
    emitErrorEvent.mockClear();
    Object.values(colors).forEach((mockFn) => mockFn.mockClear());
    readline.createInterface.mockClear();
    mockRlInstance.prompt.mockClear();
    mockRlInstance.on.mockClear();
    mockRlInstance.close.mockClear();
    mockCliFacade.execute.mockClear();
    mockErrorHandler.handle.mockClear(); // ErrorHandler のモックもクリア
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    consoleLogSpy.mockRestore(); // console.log のリストア
    jest.restoreAllMocks(); // Jest のモックをリストア
  });

  describe('constructor', () => {
    test('should throw ApplicationError if required dependencies are missing', () => {
      expect(() => new CliInteractiveMode({})).toThrow(ApplicationError);
      expect(
        () =>
          new CliInteractiveMode({
            logger: mockLogger,
            eventEmitter: mockEventEmitter,
            // cliFacade が欠けている
          })
      ).toThrow(ApplicationError);
    });

    test('should initialize correctly with required dependencies', () => {
      const instance = new CliInteractiveMode({
        logger: mockLogger,
        eventEmitter: mockEventEmitter,
        cliFacade: mockCliFacade,
        traceIdGenerator: mockDependencies.traceIdGenerator, // 注入
        requestIdGenerator: mockDependencies.requestIdGenerator, // 注入
      });
      expect(instance.logger).toBe(mockLogger);
      expect(instance.eventEmitter).toBe(mockEventEmitter);
      expect(instance.facade).toBe(mockCliFacade);
      expect(instance.errorHandler).toBeUndefined(); // オプションなので undefined
      expect(instance.rl).toBeNull();
    });

    test('should initialize correctly with errorHandler', () => {
      const instance = new CliInteractiveMode({
        logger: mockLogger,
        eventEmitter: mockEventEmitter,
        cliFacade: mockCliFacade,
        errorHandler: mockErrorHandler, // errorHandler を渡す
        traceIdGenerator: mockDependencies.traceIdGenerator, // 注入
        requestIdGenerator: mockDependencies.requestIdGenerator, // 注入
      });
      expect(instance.errorHandler).toBe(mockErrorHandler);
    });
  });

  describe('start', () => {
    const operation = 'startInteractiveMode';
    let lineCallback;
    let closeCallback;
    let errorCallback;

    // start テスト用のインスタンス生成
    beforeEach(() => {
      cliInteractiveMode = new CliInteractiveMode({
        logger: mockLogger,
        eventEmitter: mockEventEmitter,
        cliFacade: mockCliFacade,
        traceIdGenerator: mockDependencies.traceIdGenerator, // 注入
        requestIdGenerator: mockDependencies.requestIdGenerator, // 注入
        // errorHandler はテストケースに応じて設定
      });

      // rl.on のコールバックを取得できるように設定
      mockRlInstance.on.mockImplementation((event, callback) => {
        if (event === 'line') lineCallback = callback;
        if (event === 'close') closeCallback = callback;
        if (event === 'error') errorCallback = callback;
      });
    });

    test('should initialize readline, show prompt, and emit _before event', async () => {
      const startPromise = cliInteractiveMode.start(); // Promise を保持 (await しない)

      // 非同期イベント発行を待機
      await expectStandardizedEventEmittedAsync(
        mockEventEmitter,
        'cli',
        'interactive_start_before',
        {}
      );
      // 次のティックでログが出力されることを期待
      await new Promise(process.nextTick);

      // ロガー呼び出しを検証
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Starting interactive mode'),
        expect.any(Object)
      );
      expect(readline.createInterface).toHaveBeenCalledTimes(1);
      expect(mockRlInstance.prompt).toHaveBeenCalledTimes(1);
      expect(mockRlInstance.on).toHaveBeenCalledWith(
        'line',
        expect.any(Function)
      );
      expect(mockRlInstance.on).toHaveBeenCalledWith(
        'close',
        expect.any(Function)
      );
      expect(mockRlInstance.on).toHaveBeenCalledWith(
        'error',
        expect.any(Function)
      );
      expect(colors.cyan).toHaveBeenCalledWith(
        expect.stringContaining('インタラクティブモードを開始します')
      );
      expect(colors.cyan).toHaveBeenCalledWith(
        expect.stringContaining('終了するには')
      );
      expect(colors.cyan).toHaveBeenCalledWith(
        expect.stringContaining('利用可能なコマンドを表示するには')
      );
    });

    test('should call facade.execute with parsed command and args on line event', async () => {
      const startPromise = cliInteractiveMode.start();
      await new Promise(process.nextTick); // コールバック設定を待つ

      await lineCallback('status --verbose');

      expect(mockCliFacade.execute).toHaveBeenCalledTimes(1);
      expect(mockCliFacade.execute).toHaveBeenCalledWith(
        'status',
        expect.objectContaining({ verbose: true, _: [] })
      );
      // await を追加して非同期処理完了後にプロンプトが呼ばれることを確認
      await new Promise(process.nextTick);
      expect(mockRlInstance.prompt).toHaveBeenCalledTimes(2); // 初期 + 再プロンプト

      closeCallback(); // テストを終了させる
      await startPromise;
    });

    test('should call _displayHelp on "help" command', async () => {
      const startPromise = cliInteractiveMode.start();
      await new Promise(process.nextTick);
      const displayHelpSpy = jest.spyOn(cliInteractiveMode, '_displayHelp');

      await lineCallback('help');

      expect(displayHelpSpy).toHaveBeenCalledTimes(1);
      expect(mockCliFacade.execute).not.toHaveBeenCalled();
      expect(mockRlInstance.prompt).toHaveBeenCalledTimes(2);

      displayHelpSpy.mockRestore();
      closeCallback();
      await startPromise;
    });

    test('should handle empty input by re-prompting', async () => {
      const startPromise = cliInteractiveMode.start();
      await new Promise(process.nextTick);
      await lineCallback('');
      await lineCallback('   ');

      expect(mockCliFacade.execute).not.toHaveBeenCalled();
      // 初期プロンプト + 2回の再プロンプト
      expect(mockRlInstance.prompt).toHaveBeenCalledTimes(3);

      closeCallback();
      await startPromise;
    });

    test('should display result using _displayResult after successful facade execution', async () => {
      const startPromise = cliInteractiveMode.start();
      await new Promise(process.nextTick);
      const mockResult = { data: 'some result' };
      mockCliFacade.execute.mockResolvedValue(mockResult);
      const displayResultSpy = jest.spyOn(cliInteractiveMode, '_displayResult');

      await lineCallback('status');

      expect(mockCliFacade.execute).toHaveBeenCalledWith(
        'status',
        expect.any(Object)
      );
      // Facade の非同期処理完了を待つ
      await new Promise(process.nextTick);

      expect(displayResultSpy).toHaveBeenCalledWith('status', mockResult);
      expect(mockRlInstance.prompt).toHaveBeenCalledTimes(2);

      displayResultSpy.mockRestore();
      closeCallback();
      await startPromise;
    });

    test('should display error message if facade.execute rejects', async () => {
      const startPromise = cliInteractiveMode.start();
      await new Promise(process.nextTick);
      const error = new Error('Command failed');
      error.context = { detail: 'test context' };
      mockCliFacade.execute.mockRejectedValue(error);

      await lineCallback('init P1 Fail');

      expect(mockCliFacade.execute).toHaveBeenCalledWith(
        'init',
        expect.any(Object)
      );
      // Facade の非同期処理完了を待つ
      await new Promise(process.nextTick);

      expect(colors.red).toHaveBeenCalledWith('エラー:');
      expect(consoleErrorSpy).toHaveBeenCalledWith('エラー:', 'Command failed');
      expect(colors.red).toHaveBeenCalledWith('詳細:');
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '詳細:',
        JSON.stringify(error.context, null, 2)
      );
      expect(mockRlInstance.prompt).toHaveBeenCalledTimes(2);

      closeCallback();
      await startPromise;
    });

    test('should close readline, emit _after event, and resolve promise on "exit" command', async () => {
      const startPromise = cliInteractiveMode.start();
      await new Promise(process.nextTick);

      lineCallback('exit'); // exit コマンド
      await new Promise(process.nextTick); // コールバック処理を待つ

      closeCallback(); // close イベントを発火
      await startPromise; // Promise が解決されるのを待つ

      expect(mockRlInstance.close).toHaveBeenCalledTimes(1);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Interactive mode ended'),
        expect.any(Object)
      );
      // イベント名を end_after に修正
      await expectStandardizedEventEmittedAsync(
        mockEventEmitter,
        'cli',
        'interactive_end_after', // イベント名を修正
        {} // データなし
      );
      expect(colors.cyan).toHaveBeenCalledWith(
        expect.stringContaining('インタラクティブモードを終了します')
      );
    });

    test('should handle readline error event and reject', async () => {
      const startPromise = cliInteractiveMode.start();
      const readlineError = new Error('Readline internal error');
      await new Promise(process.nextTick);

      errorCallback(readlineError); // エラーを発火

      await expect(startPromise).rejects.toThrow(ApplicationError);
      await expect(startPromise).rejects.toHaveProperty(
        'code',
        'ERR_CLI_READLINE'
      );
      await expect(startPromise).rejects.toHaveProperty('cause', readlineError);

      // emitErrorEvent の期待値に details (元の context) を追加
      expect(emitErrorEvent).toHaveBeenCalledWith(
        mockEventEmitter,
        mockLogger,
        'CliInteractiveMode',
        operation,
        expect.objectContaining({
          // processedError (ApplicationError)
          code: 'ERR_CLI_READLINE',
          cause: readlineError,
        }),
        null, // OperationContext (ここでは未使用)
        expect.objectContaining({
          // details (元の opContext)
          traceId: expect.any(String),
          requestId: expect.any(String),
        })
      );
      expect(colors.red).toHaveBeenCalledWith('インタフェースエラー:');
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'インタフェースエラー:',
        readlineError
      );
    });
  });

  // _parseArgs のテスト (強化)
  describe('_parseArgs', () => {
    let instance;
    beforeEach(() => {
      instance = new CliInteractiveMode({
        logger: mockLogger,
        eventEmitter: mockEventEmitter,
        cliFacade: mockCliFacade,
        traceIdGenerator: mockDependencies.traceIdGenerator, // 注入
        requestIdGenerator: mockDependencies.requestIdGenerator, // 注入
      });
    });

    test('should parse basic arguments', () => {
      expect(instance._parseArgs(['arg1', 'arg2'])).toEqual({
        _: ['arg1', 'arg2'],
      });
    });

    test('should parse options with values (=)', () => {
      expect(
        instance._parseArgs([
          '--option1=value1',
          '--another-option="quoted value"',
        ])
      ).toEqual({ _: [], option1: 'value1', anotherOption: 'quoted value' });
    });

    test('should parse options with values (space)', () => {
      expect(
        instance._parseArgs(['--level', 'debug', '--user', 'admin'])
      ).toEqual({ _: [], level: 'debug', user: 'admin' });
    });

    test('should parse boolean flags', () => {
      expect(instance._parseArgs(['--verbose', '--dry-run'])).toEqual({
        _: [],
        verbose: true,
        dryRun: true,
      });
    });

    test('should parse mixed arguments and options', () => {
      expect(
        instance._parseArgs([
          'commandArg',
          '--flag',
          '--option=value',
          'anotherArg',
        ])
      ).toEqual({
        _: ['commandArg', 'anotherArg'],
        flag: true,
        option: 'value',
      });
    });

    test('should parse short options as flags', () => {
      expect(instance._parseArgs(['-v', '-f'])).toEqual({
        _: [],
        v: true,
        f: true,
      });
    });

    test('should handle options after positional arguments correctly', () => {
      // 簡易パーサーはフラグの後の引数を値として解釈する
      expect(
        instance._parseArgs(['arg1', '--flag', 'arg2', '--option=value'])
      ).toEqual({ _: ['arg1'], flag: 'arg2', option: 'value' });
    });

    test('should handle quoted arguments', () => {
      expect(
        instance._parseArgs(['"hello world"', '--message="quoted message"'])
      ).toEqual({ _: ['hello world'], message: 'quoted message' });
    });

    test('should handle empty array', () => {
      expect(instance._parseArgs([])).toEqual({ _: [] });
    });

    test('should handle option without value at the end', () => {
      expect(instance._parseArgs(['--option'])).toEqual({
        _: [],
        option: true,
      });
    });

    test('should handle flag followed by option', () => {
      expect(instance._parseArgs(['--flag', '--option=value'])).toEqual({
        _: [],
        flag: true,
        option: 'value',
      });
    });
  });

  // _displayResult のテスト (分岐網羅性を向上)
  describe('_displayResult', () => {
    let instance;
    let displayStatusSpy,
      displaySessionListSpy,
      displayTaskListSpy,
      displaySessionInfoSpy,
      displayTaskInfoSpy,
      displayFeedbackStatusSpy;

    beforeEach(() => {
      instance = new CliInteractiveMode({
        logger: mockLogger,
        eventEmitter: mockEventEmitter,
        cliFacade: mockCliFacade,
        traceIdGenerator: mockDependencies.traceIdGenerator, // 注入
        requestIdGenerator: mockDependencies.requestIdGenerator, // 注入
      });
      // プライベートメソッドの spyOn は削除
      // displayStatusSpy = jest.spyOn(instance, '_displayStatusResult').mockImplementation();
      // displaySessionListSpy = jest.spyOn(instance, '_displaySessionListResult').mockImplementation();
      // displayTaskListSpy = jest.spyOn(instance, '_displayTaskListResult').mockImplementation();
      // displaySessionInfoSpy = jest.spyOn(instance, '_displaySessionInfoResult').mockImplementation();
      // displayTaskInfoSpy = jest.spyOn(instance, '_displayTaskInfoResult').mockImplementation();
      // displayFeedbackStatusSpy = jest.spyOn(instance, '_displayFeedbackStatusResult').mockImplementation();
      // console.log のスパイは beforeEach の外で行うか、各テストケースで必要に応じて設定
      // jest.spyOn(console, 'log').mockImplementation();
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    // display.js の formatResult をインポート
    const { formatResult } = require('../../src/cli/display');

    test('should call console.log with formatted status for status command', () => {
      const result = {
        currentState: 'TESTING',
        tasks: { count: 0, statusCounts: {} },
        session: null,
      };
      const expectedOutput = formatResult('status', result); // 期待される出力を生成
      instance._displayResult('status', result);
      expect(console.log).toHaveBeenCalledWith(expectedOutput); // console.log を検証
    });

    test('should call console.log with formatted session list for list-sessions command', () => {
      const result = [
        { session_id: 's1', created_at: new Date().toISOString() },
      ]; // formatResult が期待する形式に合わせる
      const expectedOutput = formatResult('list-sessions', result);
      instance._displayResult('list-sessions', result);
      expect(console.log).toHaveBeenCalledWith(expectedOutput);
    });

    test('should call console.log with formatted task list for list-tasks command', () => {
      const result = {
        decomposed_tasks: [{ id: 't1', title: 'Task 1', status: 'pending' }],
      }; // formatResult が期待する形式に合わせる
      const expectedOutput = formatResult('list-tasks', result);
      instance._displayResult('list-tasks', result);
      expect(console.log).toHaveBeenCalledWith(expectedOutput);
    });

    test('should call console.log with formatted session info for session-info command', () => {
      const result = { session_id: 's1', created_at: new Date().toISOString() }; // formatResult が期待する形式に合わせる
      const expectedOutput = formatResult('session-info', result);
      instance._displayResult('session-info', result);
      expect(console.log).toHaveBeenCalledWith(expectedOutput);
    });

    test('should call console.log with formatted session info for current-session command', () => {
      const result = {
        session_id: 's_current',
        created_at: new Date().toISOString(),
      }; // formatResult が期待する形式に合わせる
      const expectedOutput = formatResult('current-session', result);
      instance._displayResult('current-session', result);
      expect(console.log).toHaveBeenCalledWith(expectedOutput);
    });

    test('should call console.log with formatted task info for task-info command', () => {
      const result = {
        id: 't1',
        title: 'Task 1',
        status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }; // formatResult が期待する形式に合わせる
      const expectedOutput = formatResult('task-info', result);
      instance._displayResult('task-info', result);
      expect(console.log).toHaveBeenCalledWith(expectedOutput);
    });

    test('should call console.log with formatted feedback status for feedback-status command', () => {
      const result = {
        feedback_loop: { task_id: 't1', updated_at: new Date().toISOString() },
      }; // formatResult が期待する形式に合わせる
      const expectedOutput = formatResult('feedback-status', result);
      instance._displayResult('feedback-status', result);
      expect(console.log).toHaveBeenCalledWith(expectedOutput);
    });

    test('should call console.log with JSON for other object results', () => {
      const result = { id: 'T123', title: 'New Task' };
      const expectedOutput = formatResult('create-task', result); // JSON 文字列が返るはず
      instance._displayResult('create-task', result);
      expect(console.log).toHaveBeenCalledWith(expectedOutput);
    });

    test('should call console.log with string result directly', () => {
      const result = 'task-T123-export.json';
      const expectedOutput = formatResult('export-task', result); // 文字列がそのまま返るはず
      instance._displayResult('export-task', result);
      expect(console.log).toHaveBeenCalledWith(expectedOutput);
    });

    test('should call console.log with completion message for boolean result', () => {
      const commandTrue = 'sync';
      const expectedOutputTrue = formatResult(commandTrue, true);
      instance._displayResult(commandTrue, true);
      expect(console.log).toHaveBeenCalledWith(expectedOutputTrue);

      const commandFalse = 'delete-task';
      const expectedOutputFalse = formatResult(commandFalse, false);
      instance._displayResult(commandFalse, false);
      expect(console.log).toHaveBeenCalledWith(expectedOutputFalse);
    });

    test('should not call console.log for null/undefined result', () => {
      // テスト名を修正
      const commandNull = 'some-command';
      instance._displayResult(commandNull, null);
      // formatResult が null を返すため、console.log は呼ばれない
      expect(consoleLogSpy).not.toHaveBeenCalled();

      const commandUndefined = 'other-command';
      instance._displayResult(commandUndefined, undefined);
      // formatResult が null を返すため、console.log は呼ばれない
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });
  });

  // errorHandler のテスト (強化)
  describe('errorHandler integration', () => {
    let instanceWithErrorHandler;
    let lineCallback, errorCallback, closeCallback; // closeCallback も追加

    beforeEach(() => {
      instanceWithErrorHandler = new CliInteractiveMode({
        logger: mockLogger,
        eventEmitter: mockEventEmitter,
        cliFacade: mockCliFacade,
        errorHandler: mockErrorHandler, // エラーハンドラーを渡す
        traceIdGenerator: mockDependencies.traceIdGenerator, // 注入
        requestIdGenerator: mockDependencies.requestIdGenerator, // 注入
      });
      // rl.on のコールバックを取得
      mockRlInstance.on.mockImplementation((event, callback) => {
        if (event === 'line') lineCallback = callback;
        if (event === 'error') errorCallback = callback;
        if (event === 'close') closeCallback = callback; // close も取得
      });
    });

    test('should call errorHandler.handle when readline emits error', async () => {
      const startPromise = instanceWithErrorHandler.start();
      const readlineError = new Error('Test readline error');
      await new Promise(process.nextTick); // コールバック設定を待つ

      errorCallback(readlineError); // エラーを発生させる

      await expect(startPromise).rejects.toThrow(ApplicationError); // エラーはスローされる

      expect(mockErrorHandler.handle).toHaveBeenCalledTimes(1);
      // errorHandler.handle の期待値に第4引数 (元の context) を追加
      expect(mockErrorHandler.handle).toHaveBeenCalledWith(
        expect.objectContaining({
          // processedError (ApplicationError)
          code: 'ERR_CLI_READLINE',
          cause: readlineError,
        }),
        'CliInteractiveMode',
        'startInteractiveMode',
        expect.objectContaining({
          // context (元の opContext)
          traceId: expect.any(String),
          requestId: expect.any(String),
        })
      );
      // console.error も呼ばれる
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'インタフェースエラー:',
        readlineError
      );
    });

    // Facade からのエラー時に errorHandler が呼ばれないことを確認するテストは不要
    // (エラーは Facade -> runCommand -> main で処理され、InteractiveMode は関与しない)
  });
});
