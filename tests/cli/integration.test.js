/**
 * integration.js (リファクタリング版) のテスト
 * 主にエントリーポイントとしての責務（DI、コマンド解析、Facade呼び出し、結果/エラー表示）を検証する
 */
const { captureConsole } = require('../helpers/test-helpers');
const {
  ApplicationError, // ApplicationError は constructor のチェックで使う可能性があるので残す
  CliError,
  ValidationError,
} = require('../../src/lib/utils/errors'); // インポート元を変更

// --- モックの設定 ---
// integration.js が依存するモジュールをモック

// integration モジュールをモックするが、main は実際の実装を使用する
// integration.js のモック設定を見直し
// initializeContainerAndComponents は実際の関数を使うようにし、
// 必要に応じてテストケース内で spyOn を使用する
// integration.js のモック設定を見直し
// initializeContainerAndComponents と runCommand は実際の関数を使うようにし、
// 必要に応じてテストケース内で spyOn を使用する
// integration.js のモック設定を見直し
// initializeContainerAndComponents, runCommand, parseArguments は実際の関数を使うようにし、
// 必要に応じてテストケース内で spyOn を使用するか、内部依存 (yargs) をモックする
// integration モジュール全体のモックは解除

jest.mock('../../src/lib/core/service-container');
jest.mock('../../src/lib/core/service-definitions');
jest.mock('../../src/config');
jest.mock('../../src/cli/bootstrap'); // bootstrap 関数をモック
jest.mock('../../src/cli/facade');
// 他の Cli* クラスもモック (コンストラクタ呼び出し検証用)
jest.mock('../../src/cli/workflow-manager');
jest.mock('../../src/cli/session-manager');
jest.mock('../../src/cli/task-manager');
jest.mock('../../src/cli/feedback-handler');
jest.mock('../../src/cli/report-generator');
jest.mock('../../src/cli/status-viewer');
// yargs のモックは削除し、parseArguments を spyOn でモックする方針に戻す

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
// yargs のモックは parseArguments のテストで必要になる可能性があるため残す
// ただし、main のテストでは直接使わない
// jest.mock('yargs/yargs'); // yargs のモックは削除

jest.mock('yargs/helpers', () => ({
  hideBin: jest.fn((argv) => argv.slice(2)),
}));

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
  createMockDependencies, // <--- 追加
} = require('../helpers/mock-factory');
const { emitErrorEvent } = require('../../src/lib/utils/error-helpers');

// テスト対象の関数をインポート
const integration = require('../../src/cli/integration'); // integration モジュール自体は必要
const { bootstrap } = require('../../src/cli/bootstrap'); // bootstrap をインポート
const {
  main,
  runCommand,
  // initializeContainerAndComponents, // 削除
  parseArguments,
} = require('../../src/cli/integration');

// --- テストスイート ---
let originalProcessArgv;
describe('Integration CLI Entry Point (Refactored)', () => {
  let mockContainer;
  let mockColors;
  let mockCliFacadeInstance; // CliFacade のモックインスタンス
  let consoleCapture;

  let mockExit;
  let mockRequiredServices;
  let mockLoggerInstance; // logger インスタンスを保持
  originalProcessArgv = process.argv; // Save original argv
  let mockArgv; // beforeEach 内で初期化
  let mockYargsInstance; // beforeEach 内で初期化

  beforeEach(() => {
    // モジュールキャッシュをリセットして、doMock が確実に適用されるようにする
    jest.resetModules();

    consoleCapture = captureConsole();
    mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {}); // ← 元に戻す

    // 必要なサービスのモックを作成
    mockLoggerInstance = createMockLogger(); // logger インスタンスを作成

    mockRequiredServices = {
      logger: mockLoggerInstance,
      eventEmitter: createMockEventEmitter(),
      storageService: createMockStorageService(),
      validator: createMockValidator(),
      // アダプターのモックもここで定義（必要に応じてメソッドもモック）
      integrationManagerAdapter: {
        /* メソッドのモック */
      },
      sessionManagerAdapter: {
        /* メソッドのモック */
      },
      taskManagerAdapter: {
        /* メソッドのモック */
      },
      feedbackManagerAdapter: {
        /* メソッドのモック */
      },
      stateManagerAdapter: {
        /* メソッドのモック */
      },
    };

    // モックの ServiceContainer を作成
    mockContainer = {
      get: jest.fn((serviceName) => {
        if (mockRequiredServices[serviceName]) {
          return mockRequiredServices[serviceName];
        }
        return undefined;
      }),
    };

    // モックの colors オブジェクトを作成
    mockColors = {
      cyan: jest.fn((text) => text),
      green: jest.fn((text) => text),
      yellow: jest.fn((text) => text),
      red: jest.fn((text) => text),
      blue: jest.fn((text) => text),
    };
    Object.keys(mockColors).forEach((key) => {
      colors[key] = mockColors[key];
    });

    // ServiceContainer のモック設定
    ServiceContainer.mockImplementation(() => mockContainer);
    registerServices.mockClear();

    // CliFacade のモック設定
    mockCliFacadeInstance = { execute: jest.fn() };
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
  });

  afterEach(() => {
    process.argv = originalProcessArgv; // Restore original argv
    consoleCapture.restore();
    mockExit.mockRestore(); // ← 元に戻す
    jest.resetAllMocks();
  });

  // initializeContainerAndComponents のテストは bootstrap.test.js で行うため削除

  // runCommand のテスト
  test('指定されたコマンドと引数が CliFacade.execute に渡される', async () => {
    const command = 'create-task';
    const mockArgv = {
      _: [command],
      title: 'New Task',
      description: 'Details',
      priority: 1,
    };
    // runCommand に beforeEach で作成したモックインスタンスを渡す
    await runCommand(mockArgv, mockCliFacadeInstance, mockLoggerInstance);

    expect(mockCliFacadeInstance.execute).toHaveBeenCalledTimes(1);
    expect(mockCliFacadeInstance.execute).toHaveBeenCalledWith(
      command,
      mockArgv
    ); // 検証対象をモックインスタンスに変更
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
    expect(mockExit).not.toHaveBeenCalled();
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
    expect(mockExit).not.toHaveBeenCalled();
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
    expect(mockExit).not.toHaveBeenCalled();
  });

  test('CliFacade.execute がエラーをスローした場合、エラーメッセージとコンテキストが表示され、exit(1)が呼ばれる', async () => {
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

    await runCommand(mockArgv, mockCliFacadeInstance, mockLoggerInstance);

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
    expect(mockExit).toHaveBeenCalledWith(1);
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
    expect(mockExit).not.toHaveBeenCalled();
  });

  // --- main 関数のテスト (修正) ---

  test('main 関数が正常に実行されること（エラーなし）', async () => {
    // main 関数が正常に実行されることを検証
    // main 関数が正常に実行されることを検証
    process.argv = ['node', 'knoa-cli', 'status']; // Jest 引数の影響を排除
    const originalArgv = process.argv; // 元の argv を保持

    // 依存関係のモック設定
    const { bootstrap } = require('../../src/cli/bootstrap'); // モックされた bootstrap
    const integration = require('../../src/cli/integration'); // 実際の integration モジュール
    const { runCommand } = integration; // runCommand は実際のコードを使うが、内部の Facade はモック

    bootstrap.mockReturnValue({
      logger: mockLoggerInstance,
      cliFacade: mockCliFacadeInstance, // bootstrap が返す Facade をモック
    });
    // parseArguments を spyOn でモック
    const parseSpy = jest
      .spyOn(integration, 'parseArguments')
      .mockReturnValue({ _: ['status'], $0: 'knoa-cli' });
    // runCommand 内の CliFacade.execute をモック
    mockCliFacadeInstance.execute.mockResolvedValue({}); // 正常終了をシミュレート

    await main();

    // アサーション (E2E視点: 最終的な副作用のみ検証)
    expect(mockExit).not.toHaveBeenCalled();
    expect(consoleCapture.errorMock).not.toHaveBeenCalled();

    // スパイをリストア
    parseSpy.mockRestore();
    process.argv = originalArgv;
  });

  test('main 関数が初期化エラーを捕捉し、exit(1) を呼ぶ', async () => {
    process.argv = ['node', 'knoa-cli', 'status']; // ① argv 設定
    const initError = new Error('Initialization failed');

    // ② bootstrap 関数自体をモックしてエラーをスローさせる
    const { bootstrap } = require('../../src/cli/bootstrap'); // モックされた bootstrap
    const bootstrapSpy = jest.spyOn(
      require('../../src/cli/bootstrap'),
      'bootstrap'
    ); // spyOn を使う
    bootstrapSpy.mockImplementation(() => {
      throw initError;
    });
    // parseArguments の spyOn は不要 (bootstrap でエラーになるため)
    const { parseArguments, runCommand } = require('../../src/cli/integration'); // モックされていない関数を取得

    await main(); // ③ main を実行

    // ④ エラーハンドリングを検証 (E2E視点: 最終的な副作用のみ検証)
    expect(consoleCapture.errorMock).toHaveBeenCalledWith(
      expect.stringContaining('致命的エラーが発生しました:'),
      initError
    );
    expect(mockExit).toHaveBeenCalledWith(1);

    // ⑤ スパイをリストア
    bootstrapSpy.mockRestore();
  });

  test('main 関数が引数解析エラーを捕捉し、exit(1) を呼ぶ', async () => {
    process.argv = ['node', 'knoa-cli', 'invalid-command']; // ① argv 設定
    const parseError = new Error('Argument parsing failed');

    // ② bootstrap は成功させ、parseArguments がエラーをスローするようにモック
    const { bootstrap } = require('../../src/cli/bootstrap'); // モックされた bootstrap
    const integration = require('../../src/cli/integration'); // 実際の integration モジュール
    const { runCommand } = integration; // runCommand は実際のコード

    bootstrap.mockReturnValue({
      logger: mockLoggerInstance,
      cliFacade: mockCliFacadeInstance,
    }); // bootstrap は成功
    const parseSpy = jest
      .spyOn(integration, 'parseArguments')
      .mockImplementation(() => {
        throw parseError;
      }); // parseArguments でエラー

    await main(); // ③ main を実行

    // ④ エラーハンドリングを検証 (E2E視点: 最終的な副作用のみ検証)
    expect(consoleCapture.errorMock).toHaveBeenCalledWith(
      expect.stringContaining('致命的エラーが発生しました:'),
      parseError
    );
    expect(mockExit).toHaveBeenCalledWith(1);

    // ⑤ スパイをリストア
    parseSpy.mockRestore();
  });
});
