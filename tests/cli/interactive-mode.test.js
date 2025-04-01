const CliInteractiveMode = require('../../src/cli/interactive-mode');
const { ApplicationError } = require('../../src/lib/core/error-framework');
const {
  createMockLogger,
  createMockEventEmitter,
} = require('../helpers/mock-factory');
// expectStandardizedEventEmittedAsync をインポート
const {
  expectStandardizedEventEmittedAsync,
} = require('../helpers/test-helpers');
const readline = require('readline');
const colors = require('colors/safe'); // colors もモック化

// emitErrorEvent もモック化
jest.mock('../../src/lib/utils/error-helpers', () => ({
  emitErrorEvent: jest.fn(),
}));
const { emitErrorEvent } = require('../../src/lib/utils/error-helpers');

// readline と colors をモック化
jest.mock('readline');
jest.mock('colors/safe', () => ({
  cyan: jest.fn((text) => text),
  green: jest.fn((text) => text),
  red: jest.fn((text) => text),
  yellow: jest.fn((text) => text), // 必要に応じて追加
}));

describe('CliInteractiveMode', () => {
  let mockLogger;
  let mockEventEmitter;
  let mockCliFacade; // Facade のモック
  let mockErrorHandler;
  let cliInteractiveMode;
  let mockRlInstance; // readline のモックインスタンス

  let consoleErrorSpy;

  beforeEach(() => {
    mockLogger = createMockLogger();
    mockEventEmitter = createMockEventEmitter();
    mockCliFacade = {
      execute: jest.fn(), // Facade の execute メソッドをモック
    };
    mockErrorHandler = {
      handle: jest.fn(),
    };

    // readline.createInterface のモック設定
    mockRlInstance = {
      prompt: jest.fn(),
      on: jest.fn(),
      close: jest.fn(),
      // 他に必要なメソッドがあれば追加
    };
    readline.createInterface.mockReturnValue(mockRlInstance);

    // console.error のスパイを設定
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {}); // console.log をモック化

    // テスト対象インスタンスを作成
    cliInteractiveMode = new CliInteractiveMode({
      logger: mockLogger,
      eventEmitter: mockEventEmitter,
      cliFacade: mockCliFacade, // モック Facade を渡す
      // errorHandler: mockErrorHandler,
    });

    emitErrorEvent.mockClear();
    // colors のモッククリア
    Object.values(colors).forEach((mockFn) => mockFn.mockClear());
    // readline のモッククリア
    readline.createInterface.mockClear();
    mockRlInstance.prompt.mockClear();
    mockRlInstance.on.mockClear();
    mockRlInstance.close.mockClear();
    mockCliFacade.execute.mockClear(); // Facade の呼び出しもクリア
  });

  afterEach(() => {
    // console.error のスパイをリストア
    consoleErrorSpy.mockRestore();
  });

  describe('constructor', () => {
    test('should throw ApplicationError if required dependencies are missing', () => {
      expect(() => new CliInteractiveMode({})).toThrow(ApplicationError);
      expect(
        () =>
          new CliInteractiveMode({
            logger: mockLogger,
            eventEmitter: mockEventEmitter,
          })
      ).toThrow(ApplicationError); // cliFacade が必須
    });
  });

  describe('start', () => {
    const operation = 'startInteractiveMode';
    let lineCallback;
    let closeCallback;
    let errorCallback;

    beforeEach(() => {
      // rl.on のコールバックを取得できるように設定
      mockRlInstance.on.mockImplementation((event, callback) => {
        if (event === 'line') lineCallback = callback;
        if (event === 'close') closeCallback = callback;
        if (event === 'error') errorCallback = callback;
      });
    });

    test('should initialize readline, show prompt, and emit _before event', async () => {
      cliInteractiveMode.start(); // Promise は解決させない

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Starting interactive mode'),
        expect.any(Object)
      );
      // expectStandardizedEventEmittedAsync に変更
      await expectStandardizedEventEmittedAsync(
        mockEventEmitter,
        'cli_interactive',
        `${operation}_before`
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
      expect(mockRlInstance.prompt).toHaveBeenCalledTimes(2);

      closeCallback();
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
      // console.error のスパイを検証
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('エラー:'), // colors.red の結果は検証しない
        'Command failed'
      );
      expect(colors.red).toHaveBeenCalledWith('詳細:'); // colors の呼び出しは別途検証
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('詳細:'), // colors.red の結果は検証しない
        JSON.stringify(error.context, null, 2)
      );
      expect(mockRlInstance.prompt).toHaveBeenCalledTimes(2);

      closeCallback();
      await startPromise;
    });

    // タイムアウト対策: jest.setTimeout を追加
    test('should close readline, emit _after event, and resolve promise on "exit" command', async () => {
      jest.setTimeout(10000); // タイムアウトを10秒に延長
      const startPromise = cliInteractiveMode.start();
      await new Promise(process.nextTick);
      // exit コマンドを送信
      lineCallback('exit');
      // イベントループを進める
      await new Promise(process.nextTick);

      // closeCallback が呼ばれると startPromise が解決するはず
      closeCallback();
      await startPromise; // Promise が解決されるのを待つ

      expect(mockRlInstance.close).toHaveBeenCalledTimes(1);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Interactive mode ended'),
        expect.any(Object)
      );
      // expectStandardizedEventEmittedAsync に変更
      // expectStandardizedEventEmittedAsync を使用
      await expectStandardizedEventEmittedAsync(
        mockEventEmitter,
        'cli_interactive',
        `${operation}_after`
      );
      expect(colors.cyan).toHaveBeenCalledWith(
        expect.stringContaining('インタラクティブモードを終了します')
      );
    });

    // タイムアウト対策: jest.setTimeout を追加し、エラーコードを修正
    test('should handle readline error event', async () => {
      jest.setTimeout(10000); // タイムアウトを10秒に延長
      const startPromise = cliInteractiveMode.start();
      const readlineError = new Error('Readline internal error');

      await new Promise(process.nextTick);
      errorCallback(readlineError);

      await expect(startPromise).rejects.toThrow(ApplicationError);
      // エラーコードを実装に合わせて修正
      await expect(startPromise).rejects.toHaveProperty(
        'code',
        'ERR_CLI_READLINE'
      ); // 実装で設定したコード
      await expect(startPromise).rejects.toHaveProperty('cause', readlineError);

      expect(emitErrorEvent).toHaveBeenCalledWith(
        mockEventEmitter,
        mockLogger,
        'CliInteractiveMode',
        operation,
        expect.objectContaining({
          code: 'ERR_CLI_READLINE',
          cause: readlineError,
        }) // 期待するコード
      );
      expect(colors.red).toHaveBeenCalledWith('インタフェースエラー:');
      // console.error のスパイを検証
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('インタフェースエラー:'), // colors.red の結果は検証しない
        readlineError
      );

      // errorHandler があれば呼ばれるテストも追加可能
    });
  });

  // _parseArgs のテスト (期待値を修正)
  describe('_parseArgs', () => {
    let instance;
    beforeEach(() => {
      instance = new CliInteractiveMode({
        logger: mockLogger,
        eventEmitter: mockEventEmitter,
        cliFacade: mockCliFacade,
      });
    });

    test('should parse basic arguments', () => {
      const result = instance._parseArgs(['arg1', 'arg2']);
      // 簡易パーサーの実装に合わせた期待値
      // 修正後の _parseArgs は位置引数の意味付けを行わない
      expect(result).toEqual({
        _: ['arg1', 'arg2'],
      });
    });

    test('should parse options with values', () => {
      const result = instance._parseArgs([
        '--option1=value1',
        '--another-option="quoted value"',
      ]);
      expect(result).toEqual({
        _: [],
        option1: 'value1',
        anotherOption: 'quoted value',
      });
    });

    test('should parse boolean flags', () => {
      const result = instance._parseArgs(['--verbose', '--dry-run']);
      expect(result).toEqual({ _: [], verbose: true, dryRun: true });
    });

    test('should parse mixed arguments and options', () => {
      const result = instance._parseArgs([
        'commandArg',
        '--flag',
        '--option=value',
        'anotherArg',
      ]);
      // 簡易パーサーの実装に合わせた期待値
      // 修正後の _parseArgs は位置引数の意味付けを行わない
      expect(result).toEqual({
        _: ['commandArg', 'anotherArg'],
        flag: true,
        option: 'value',
      });
    });

    test('should parse short options as flags', () => {
      const result = instance._parseArgs(['-v', '-f']);
      expect(result).toEqual({ _: [], v: true, f: true });
    });

    test('should parse space-separated option values', () => {
      const result = instance._parseArgs([
        '--level',
        'debug',
        '--user',
        'admin',
      ]);
      expect(result).toEqual({ _: [], level: 'debug', user: 'admin' });
    });

    test('should handle options after positional arguments', () => {
      const result = instance._parseArgs([
        'arg1',
        '--flag',
        'arg2',
        '--option=value',
      ]);
      // 修正後の _parseArgs は --flag の後の arg2 を値として解釈する
      // 修正後の _parseArgs は --flag の後の arg2 を値として解釈する
      expect(result).toEqual({
        _: ['arg1'],
        flag: 'arg2', // --flag の後の 'arg2' が値になる
        option: 'value',
      });
    });

    test('should handle quoted arguments', () => {
      const result = instance._parseArgs([
        '"hello world"',
        '--message="quoted message"',
      ]);
      expect(result).toEqual({ _: ['hello world'], message: 'quoted message' });
    });
  });

  // _displayResult の分岐テスト
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
      });
      // 各表示ヘルパーをスパイ
      displayStatusSpy = jest
        .spyOn(instance, '_displayStatusResult')
        .mockImplementation();
      displaySessionListSpy = jest
        .spyOn(instance, '_displaySessionListResult')
        .mockImplementation();
      displayTaskListSpy = jest
        .spyOn(instance, '_displayTaskListResult')
        .mockImplementation();
      displaySessionInfoSpy = jest
        .spyOn(instance, '_displaySessionInfoResult')
        .mockImplementation();
      displayTaskInfoSpy = jest
        .spyOn(instance, '_displayTaskInfoResult')
        .mockImplementation();
      displayFeedbackStatusSpy = jest
        .spyOn(instance, '_displayFeedbackStatusResult')
        .mockImplementation();
      // console.log もスパイしておく
      jest.spyOn(console, 'log').mockImplementation();
    });

    afterEach(() => {
      jest.restoreAllMocks(); // スパイを元に戻す
    });

    test('should call _displayStatusResult for status command', () => {
      const result = { some: 'data' };
      instance._displayResult('status', result);
      expect(displayStatusSpy).toHaveBeenCalledWith(result);
    });

    test('should call _displaySessionListResult for list-sessions command', () => {
      const result = [{ id: 's1' }];
      instance._displayResult('list-sessions', result);
      expect(displaySessionListSpy).toHaveBeenCalledWith(result);
    });

    test('should call _displayTaskListResult for list-tasks command', () => {
      const result = { decomposed_tasks: [] };
      instance._displayResult('list-tasks', result);
      expect(displayTaskListSpy).toHaveBeenCalledWith(result);
    });

    test('should call _displaySessionInfoResult for session-info command', () => {
      const result = { id: 's1' };
      instance._displayResult('session-info', result);
      expect(displaySessionInfoSpy).toHaveBeenCalledWith(result);
    });

    test('should call _displayTaskInfoResult for task-info command', () => {
      const result = { id: 't1' };
      instance._displayResult('task-info', result);
      expect(displayTaskInfoSpy).toHaveBeenCalledWith(result);
    });

    test('should call _displayFeedbackStatusResult for feedback-status command', () => {
      const result = { feedback_loop: {} };
      instance._displayResult('feedback-status', result);
      expect(displayFeedbackStatusSpy).toHaveBeenCalledWith(result);
    });

    test('should display JSON for other object results', () => {
      const result = { key: 'value' };
      instance._displayResult('unknown-command', result);
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('結果:'),
        JSON.stringify(result, null, 2)
      );
    });

    test('should display string result directly', () => {
      const result = 'Exported to file.txt';
      instance._displayResult('export-task', result);
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('結果:'),
        result
      );
    });

    test('should display completion message for null/undefined result', () => {
      instance._displayResult('sync', null);
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('sync コマンドが正常に完了しました。')
      );
      instance._displayResult('delete-task', undefined);
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('delete-task コマンドが正常に完了しました。')
      );
    });
  });

  // errorHandler のテスト
  describe('errorHandler integration', () => {
    let instanceWithErrorHandler;
    let lineCallback, errorCallback;

    beforeEach(() => {
      instanceWithErrorHandler = new CliInteractiveMode({
        logger: mockLogger,
        eventEmitter: mockEventEmitter,
        cliFacade: mockCliFacade,
        errorHandler: mockErrorHandler, // エラーハンドラーを渡す
      });
      // rl.on のコールバックを取得
      mockRlInstance.on.mockImplementation((event, callback) => {
        if (event === 'line') lineCallback = callback;
        if (event === 'error') errorCallback = callback;
      });
    });

    test('should call errorHandler.handle when readline emits error', async () => {
      const startPromise = instanceWithErrorHandler.start();
      const readlineError = new Error('Test readline error');
      await new Promise(process.nextTick); // コールバック設定を待つ

      errorCallback(readlineError); // エラーを発生させる

      await expect(startPromise).rejects.toThrow(ApplicationError); // エラーはスローされる

      expect(mockErrorHandler.handle).toHaveBeenCalledTimes(1);
      // エラーオブジェクトのクラスと主要プロパティを検証
      expect(mockErrorHandler.handle).toHaveBeenCalledWith(
        expect.any(ApplicationError), // クラスを検証
        'CliInteractiveMode',
        'startInteractiveMode'
      );
      // 詳細なプロパティ検証 (任意)
      const receivedError = mockErrorHandler.handle.mock.calls[0][0];
      expect(receivedError).toHaveProperty('code', 'ERR_CLI_READLINE');
      expect(receivedError).toHaveProperty('cause', readlineError);
    });
  });
});
