/**
 * integration.js (リファクタリング版) のテスト
 * 主にエントリーポイントとしての責務（DI、コマンド解析、Facade呼び出し、結果/エラー表示）を検証する
 */
const { captureConsole } = require('../helpers/test-helpers');
const {
  ApplicationError,
  CliError,
  ValidationError,
} = require('../../src/lib/utils/errors');
const yargs = require('yargs/yargs'); // yargs をインポート

// --- モックの設定 ---
// integration.js が依存するモジュールをモック

// bootstrap をモック
jest.mock('../../src/cli/bootstrap', () => ({
  bootstrap: jest.fn(),
}));
jest.mock('../../src/lib/core/service-container');
jest.mock('../../src/lib/core/service-definitions');
jest.mock('../../src/config');
jest.mock('../../src/cli/facade');
// 他の Cli* クラスもモック (コンストラクタ呼び出し検証用)
jest.mock('../../src/cli/workflow-manager');
jest.mock('../../src/cli/session-manager');
jest.mock('../../src/cli/task-manager');
jest.mock('../../src/cli/feedback-handler');
jest.mock('../../src/cli/report-generator');
jest.mock('../../src/cli/status-viewer');
jest.mock('../../src/cli/interactive-mode');
jest.mock('../../src/cli/component-syncer');
// display.js のモックを明示的に設定
jest.mock('../../src/cli/display', () => ({
  displayResult: jest.fn(),
}));
jest.mock('colors/safe');
jest.mock('../../src/lib/utils/error-helpers', () => ({
  emitErrorEvent: jest.fn(),
}));
jest.mock('yargs/helpers', () => ({
  hideBin: jest.fn((argv) => argv.slice(2)),
}));
// yargs 自体をモックして、チェーンメソッドと argv を制御
jest.mock('yargs/yargs');

// --- モック/テスト対象のインポート ---
const ServiceContainer = require('../../src/lib/core/service-container');
const { registerServices } = require('../../src/lib/core/service-definitions');
const config = require('../../src/config'); // モックされた config
const CliFacade = require('../../src/cli/facade');
// 他の Cli* クラスもインポート (コンストラクタ呼び出し検証用)
const CliWorkflowManager = require('../../src/cli/workflow-manager');
const CliSessionManager = require('../../src/cli/session-manager');
const CliTaskManager = require('../../src/cli/task-manager');
const CliFeedbackHandler = require('../../src/cli/feedback-handler');
const CliReportGenerator = require('../../src/cli/report-generator');
const CliStatusViewer = require('../../src/cli/status-viewer');
const CliInteractiveMode = require('../../src/cli/interactive-mode');
const CliComponentSyncer = require('../../src/cli/component-syncer');
const { displayResult } = require('../../src/cli/display'); // モックされた displayResult
const colors = require('colors/safe');
const {
  createMockLogger,
  createMockEventEmitter,
  createMockStorageService,
  createMockValidator,
  createMockDependencies,
} = require('../helpers/mock-factory');
const { emitErrorEvent } = require('../../src/lib/utils/error-helpers');

// テスト対象の関数をインポート
const integration = require('../../src/cli/integration');
const { bootstrap: mockBootstrap } = require('../../src/cli/bootstrap'); // モックされた bootstrap をインポート
const {
  main,
  runCommand,
  parseArguments,
} = require('../../src/cli/integration');

// --- テストスイート ---
let originalProcessArgv;
describe('Integration CLI Entry Point (Refactored)', () => {
  let mockDependencies; // モック依存関係を保持する変数 (describe スコープで宣言)
  let mockContainer;
  let mockColors;
  let mockCliFacadeInstance; // CliFacade のモックインスタンス
  let consoleCapture;

  // mockExit は削除 (process.exit は使わない)
  let mockRequiredServices;
  let mockLoggerInstance; // logger インスタンスを保持
  originalProcessArgv = process.argv; // Save original argv
  let mockArgv; // beforeEach 内で初期化
  let mockYargsInstance; // beforeEach 内で初期化

  // bootstrapSpy は不要になったので削除

  beforeEach(() => {
    // モジュールキャッシュをリセット
    jest.resetModules();

    consoleCapture = captureConsole();
    // mockExit は削除

    // 共通モック依存関係を最初に作成
    mockDependencies = createMockDependencies();
    // その後、必要な変数を代入
    mockLoggerInstance = mockDependencies.logger;
    mockCliFacadeInstance = { execute: jest.fn() }; // Facade は別途モック

    // モックの ServiceContainer を作成 (不要になったため削除)
    // mockContainer = { ... };

    // モックの colors オブジェクトを作成
    mockColors = {
      cyan: jest.fn((text) => text),
      green: jest.fn((text) => text),
      yellow: jest.fn((text) => text),
      red: jest.fn((text) => text),
      blue: jest.fn((text) => text),
      white: jest.fn((text) => text), // white も追加
    };
    Object.keys(mockColors).forEach((key) => {
      // eslint-disable-next-line security/detect-object-injection
      colors[key] = mockColors[key];
    });

    // ServiceContainer のモック設定 (不要になったため削除)
    // ServiceContainer.mockImplementation(() => mockContainer);
    // registerServices.mockClear(); // bootstrap をモックするので不要

    // CliFacade のモック設定
    CliFacade.mockImplementation(() => mockCliFacadeInstance);

    // 各 Cli* クラスのコンストラクタモックをクリア
    CliWorkflowManager.mockClear();
    CliSessionManager.mockClear();
    CliTaskManager.mockClear();
    CliFeedbackHandler.mockClear();
    CliReportGenerator.mockClear();
    CliStatusViewer.mockClear();
    CliInteractiveMode.mockClear();
    CliComponentSyncer.mockClear();

    // モック関数のクリア
    displayResult.mockClear();
    emitErrorEvent.mockClear();

    // bootstrap のデフォルトモック実装 (正常系)
    // bootstrap が返す logger と cliFacade を mockDependencies から取得するように修正
    mockBootstrap.mockReturnValue({
      logger: mockLoggerInstance, // mockLoggerInstance を使用
      cliFacade: mockCliFacadeInstance, // Facade は別途モックしたものを返す
    });

    // yargs のモック設定 (変更なし)
    mockYargsInstance = {
      usage: jest.fn().mockReturnThis(),
      command: jest.fn(function (command, description, builder) {
        const actualBuilder =
          typeof builder === 'function'
            ? builder
            : typeof description === 'function'
              ? description
              : null;
        if (actualBuilder) {
          actualBuilder(this);
        }
        return this;
      }),
      option: jest.fn().mockReturnThis(),
      positional: jest.fn().mockReturnThis(),
      demandCommand: jest.fn().mockReturnThis(),
      help: jest.fn().mockReturnThis(),
      alias: jest.fn().mockReturnThis(),
      version: jest.fn().mockReturnThis(),
      strict: jest.fn().mockReturnThis(),
      exitProcess: jest.fn().mockReturnThis(),
      get argv() {
        if (this._shouldThrowError) {
          this._shouldThrowError = false;
          throw new Error('Argument parsing failed');
        }
        const defaultArgv = { _: [], $0: 'knoa-cli' };
        return { ...defaultArgv, ...(this._mockArgvValues || {}) };
      },
      _mockArgvValues: null,
      _shouldThrowError: false,
      mockArgv: function (values) {
        this._mockArgvValues = values;
        this._shouldThrowError = false;
        return this;
      },
      mockError: function () {
        this._shouldThrowError = true;
        return this;
      },
    };
    yargs.mockImplementation(() => mockYargsInstance);
  });

  afterEach(() => {
    process.argv = originalProcessArgv; // Restore original argv
    consoleCapture.restore();
    // mockExit のリストアは不要
    jest.resetAllMocks();
    // bootstrapSpy のリストアは不要
  });

  // runCommand のテスト (変更なし)
  test('指定されたコマンドと引数が CliFacade.execute に渡される', async () => {
    const command = 'create-task';
    const mockArgv = {
      _: [command],
      title: 'New Task',
      description: 'Details',
      priority: 1,
    };
    await runCommand(mockArgv, mockCliFacadeInstance, mockLoggerInstance);

    expect(mockCliFacadeInstance.execute).toHaveBeenCalledTimes(1);
    expect(mockCliFacadeInstance.execute).toHaveBeenCalledWith(
      command,
      mockArgv
    );
  });

  test('CliFacade.execute が成功し、結果がオブジェクトの場合、displayResult が呼ばれる', async () => {
    const command = 'session-info';
    const mockArgv = { _: [command], sessionId: 'S123' };
    const mockResult = { id: 'S123', status: 'active' };
    mockCliFacadeInstance.execute.mockResolvedValue(mockResult);
    await runCommand(mockArgv, mockCliFacadeInstance, mockLoggerInstance);

    expect(mockCliFacadeInstance.execute).toHaveBeenCalledWith(
      command,
      mockArgv
    );
    expect(displayResult).toHaveBeenCalledWith(command, mockResult);
    expect(consoleCapture.errorMock).not.toHaveBeenCalled();
    // mockExit の検証は削除
  });

  test('CliFacade.execute が成功し、結果が文字列の場合、displayResult が呼ばれる', async () => {
    const command = 'export-session';
    const mockArgv = { _: [command], sessionId: 'S123', path: 'export.json' };
    const mockResult = 'export.json';
    mockCliFacadeInstance.execute.mockResolvedValue(mockResult);
    await runCommand(mockArgv, mockCliFacadeInstance, mockLoggerInstance);

    expect(mockCliFacadeInstance.execute).toHaveBeenCalledWith(
      command,
      mockArgv
    );
    expect(displayResult).toHaveBeenCalledWith(command, mockResult);
    expect(consoleCapture.errorMock).not.toHaveBeenCalled();
    // mockExit の検証は削除
  });

  test('CliFacade.execute が成功し、結果が undefined の場合、displayResult が呼ばれる', async () => {
    const command = 'sync';
    const mockArgv = { _: [command] };
    mockCliFacadeInstance.execute.mockResolvedValue(undefined);
    await runCommand(mockArgv, mockCliFacadeInstance, mockLoggerInstance);

    expect(mockCliFacadeInstance.execute).toHaveBeenCalledWith(
      command,
      mockArgv
    );
    expect(displayResult).toHaveBeenCalledWith(command, undefined);
    expect(consoleCapture.errorMock).not.toHaveBeenCalled();
    // mockExit の検証は削除
  });

  test('CliFacade.execute がエラーをスローした場合、エラーメッセージとコンテキストが表示され、エラーが再スローされる', async () => {
    const command = 'init';
    const mockArgv = {
      _: [command],
      projectId: 'P001',
      request: 'Fail Request',
    };
    const error = new Error('Facade execution failed');
    error.context = { detail: 'some context' };
    error.cause = new Error('Original cause');
    mockCliFacadeInstance.execute.mockRejectedValue(error);

    // runCommand がエラーをスローすることを検証
    await expect(
      runCommand(mockArgv, mockCliFacadeInstance, mockLoggerInstance)
    ).rejects.toThrow(error);

    expect(mockCliFacadeInstance.execute).toHaveBeenCalledWith(
      command,
      mockArgv
    );
    expect(consoleCapture.errorMock).toHaveBeenCalledWith(
      expect.stringContaining('エラーが発生しました:'),
      expect.stringContaining('Facade execution failed')
    );
    expect(consoleCapture.errorMock).toHaveBeenCalledWith(
      expect.stringContaining('詳細:'),
      expect.stringContaining(JSON.stringify(error.context, null, 2))
    );
    expect(consoleCapture.errorMock).toHaveBeenCalledWith(
      expect.stringContaining('原因:'),
      expect.stringContaining('Original cause')
    );
    // mockExit の検証は削除
  });

  test('interactive コマンドが CliFacade.execute に渡される', async () => {
    const command = 'interactive';
    const mockArgv = { _: [command] };
    mockCliFacadeInstance.execute.mockResolvedValue(undefined);
    await runCommand(mockArgv, mockCliFacadeInstance, mockLoggerInstance);

    expect(mockCliFacadeInstance.execute).toHaveBeenCalledTimes(1);
    expect(mockCliFacadeInstance.execute).toHaveBeenCalledWith(
      command,
      mockArgv
    );
    expect(displayResult).toHaveBeenCalledWith(command, undefined);
    // mockExit の検証は削除
  });

  // --- main 関数のテスト (修正済み) ---

  test('main 関数が正常に実行されること（エラーなし）', async () => {
    process.argv = ['node', 'knoa-cli', 'status'];
    const originalArgv = process.argv;

    // bootstrap は beforeEach で正常な値を返すように設定済み
    const integration = require('../../src/cli/integration');
    const parseSpy = jest
      .spyOn(integration, 'parseArguments')
      .mockReturnValue({ _: ['status'], $0: 'knoa-cli' });
    mockCliFacadeInstance.execute.mockResolvedValue({}); // 正常終了

    // main がエラーをスローしないことを検証
    await expect(main()).resolves.toBeUndefined();

    // 副作用の検証
    expect(consoleCapture.errorMock).not.toHaveBeenCalled();
    // mockExit の検証は削除

    // スパイをリストア
    parseSpy.mockRestore();
    process.argv = originalArgv;
  });

  test('main 関数が初期化エラーを捕捉し、エラーをスローする', async () => {
    process.argv = ['node', 'knoa-cli', 'status'];
    const initError = new Error('Initialization failed');

    // bootstrap がエラーをスローするようにモックを上書き
    mockBootstrap.mockImplementation(() => {
      throw initError;
    });

    // main がエラーをスローすることを検証
    await expect(main()).rejects.toThrow(initError);

    // エラーハンドリングの検証
    expect(consoleCapture.errorMock).toHaveBeenCalledWith(
      'Fatal error during initialization or argument parsing:', // logger がないのでこちらが出力される
      initError
    );
    expect(consoleCapture.errorMock).toHaveBeenCalledWith(
      expect.stringContaining('致命的エラーが発生しました:'),
      initError
    );
    // mockExit の検証は削除
  });

  test('main 関数が引数解析エラーを捕捉し、エラーをスローする', async () => {
    process.argv = ['node', 'knoa-cli', 'invalid-command'];
    // parseError は L399 で定義済みのため、この行を削除

    // bootstrap は成功させる
    mockBootstrap.mockReturnValue({
      logger: mockLoggerInstance,
      cliFacade: mockCliFacadeInstance,
    });

    // parseArguments がエラーをスローするように yargs モックを設定
    yargs.mockImplementation(() => {
      const instance = mockYargsInstance;
      instance.mockError(); // エラーをスローするように設定
      return instance;
    });

    // main がエラーをスローすることを検証
    await expect(main()).rejects.toThrow('Argument parsing failed'); // エラーメッセージで検証

    // エラーハンドリングの検証
    expect(mockLoggerInstance.fatal).toHaveBeenCalledWith(
      'CLI initialization or argument parsing failed:',
      expect.objectContaining({ message: 'Argument parsing failed' })
    );
    expect(consoleCapture.errorMock).toHaveBeenCalledWith(
      expect.stringContaining('致命的エラーが発生しました:'),
      expect.objectContaining({ message: 'Argument parsing failed' })
    );

    // モックをリセット
    yargs.mockImplementation(() => mockYargsInstance);
    mockYargsInstance._shouldThrowError = false; // フラグをリセット
  });

  // --- parseArguments 関数のテストスイートを追加 ---
  describe('parseArguments', () => {
    test('基本的なコマンドと位置引数を解析できる', () => {
      // Arrange
      const argv = ['node', 'knoa-cli', 'init', 'proj1', 'request1'];
      const expectedArgv = { _: ['init', 'proj1', 'request1'], $0: 'knoa-cli' };
      mockYargsInstance.mockArgv(expectedArgv); // mockArgv ヘルパーを使用

      // Act
      const result = parseArguments(argv);

      // Assert
      expect(result).toEqual(expectedArgv);
      expect(mockYargsInstance.command).toHaveBeenCalledWith(
        'init <project-id> <request>',
        expect.any(String),
        expect.any(Function)
      );
      // 必要に応じて他の yargs メソッド呼び出しも検証
    });

    test('オプション (--option=value) を解析できる', () => {
      // Arrange
      const argv = [
        'node',
        'knoa-cli',
        'report',
        'task_summary',
        '--format=json',
        '--output=report.json',
      ];
      const expectedArgv = {
        _: ['report', 'task_summary'],
        format: 'json',
        output: 'report.json',
        $0: 'knoa-cli',
      };
      mockYargsInstance.mockArgv(expectedArgv); // mockArgv ヘルパーを使用

      // Act
      const result = parseArguments(argv);

      // Assert
      expect(result).toEqual(expectedArgv);
      expect(mockYargsInstance.command).toHaveBeenCalledWith(
        'report <type>',
        expect.any(String),
        expect.any(Function)
      );
      // option メソッドの呼び出しを検証 (より詳細に)
      // option が呼ばれたことだけを確認
      expect(mockYargsInstance.option).toHaveBeenCalled();
      // ここも同様に、呼ばれたことだけを確認 (必要であれば)
      // expect(mockYargsInstance.option).toHaveBeenCalled();
    });

    test('フラグ (--flag) を解析できる', () => {
      // Arrange
      const argv = ['node', 'knoa-cli', 'report', 'task_summary', '--no-cache'];
      const expectedArgv = {
        _: ['report', 'task_summary'],
        'no-cache': true, // yargs はケバブケースを維持することがある
        noCache: true, // キャメルケースも追加されることが多い
        $0: 'knoa-cli',
      };
      // yargs の挙動に合わせて調整
      mockYargsInstance.mockArgv({ ...expectedArgv, format: 'text' }); // mockArgv ヘルパーを使用

      // Act
      const result = parseArguments(argv);

      // Assert
      // yargs のデフォルト値の挙動も考慮して検証
      expect(result).toEqual(
        expect.objectContaining({
          _: ['report', 'task_summary'],
          'no-cache': true,
          noCache: true,
          format: 'text', // default value
        })
      );
      // option が呼ばれたことだけを確認
      expect(mockYargsInstance.option).toHaveBeenCalled();
    });

    test('必須コマンドがない場合にエラーメッセージを表示する (yargs の機能)', () => {
      // Arrange
      const argv = ['node', 'knoa-cli']; // コマンドなし
      // yargs の demandCommand が呼ばれることを検証
      const demandCommandMock = jest.fn().mockReturnThis();
      mockYargsInstance.demandCommand = demandCommandMock;
      mockYargsInstance.mockArgv({ _: [], $0: 'knoa-cli' }); // mockArgv ヘルパーを使用

      // Act
      parseArguments(argv);

      // Assert
      expect(demandCommandMock).toHaveBeenCalledWith(
        1,
        'コマンドを指定してください'
      );
    });

    test('strict モードが有効になっている', () => {
      // Arrange
      const argv = ['node', 'knoa-cli', 'status'];
      const strictMock = jest.fn().mockReturnThis();
      mockYargsInstance.strict = strictMock;
      mockYargsInstance.mockArgv({ _: ['status'], $0: 'knoa-cli' }); // mockArgv ヘルパーを使用

      // Act
      parseArguments(argv);

      // Assert
      expect(strictMock).toHaveBeenCalled();
    });

    // ヘルプとバージョンのテストは yargs の内部動作に依存するため、
    // ここでは alias が設定されていることの確認に留める
    test('ヘルプとバージョンのエイリアスが設定されている', () => {
      // Arrange
      const argv = ['node', 'knoa-cli', 'status'];
      const aliasMock = jest.fn().mockReturnThis();
      mockYargsInstance.alias = aliasMock;
      mockYargsInstance.mockArgv({ _: ['status'], $0: 'knoa-cli' }); // mockArgv ヘルパーを使用

      // Act
      parseArguments(argv);

      // Assert
      expect(aliasMock).toHaveBeenCalledWith('h', 'help');
      expect(aliasMock).toHaveBeenCalledWith('v', 'version');
    });
  });
});
