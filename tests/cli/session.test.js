/**
 * session.jsのテスト
 */
const { createMocks, captureConsole } = require('./helpers/cli-test-helper');

// モジュールのモック
jest.mock('../../src/lib/core/service-container');
jest.mock('../../src/lib/core/service-definitions');
jest.mock('../../src/config');
jest.mock('fs');
jest.mock('path');
jest.mock('colors/safe');

describe('session CLI', () => {
  let mocks;
  let consoleCapture;
  
  beforeEach(() => {
    // モックの作成
    mocks = createMocks();
    
    // コンソール出力をキャプチャ
    consoleCapture = captureConsole();
    
    // ServiceContainerのモックを設定
    const ServiceContainer = require('../../src/lib/core/service-container');
    ServiceContainer.mockImplementation(() => mocks.container);
    
    const serviceDefinitions = require('../../src/lib/core/service-definitions');
    serviceDefinitions.registerServices = jest.fn();
    
    // fs, path, colorsのモックを設定
    jest.mock('fs', () => mocks.fs);
    jest.mock('path', () => mocks.path);
    jest.mock('colors/safe', () => mocks.colors);
    
    // process.argvをリセット
    process.argv = ['node', 'session.js'];
  });
  
  afterEach(() => {
    // コンソール出力のリセット
    consoleCapture.restore();
    
    // モジュールのモックをクリア
    jest.resetModules();
  });
  
  test('helpコマンドでヘルプメッセージが表示される', () => {
    // コマンドライン引数を設定
    process.argv = ['node', 'session.js', 'help'];
    
    // session.jsを実行
    jest.isolateModules(() => {
      require('../../src/cli/session');
    });
    
    // ヘルプメッセージが表示されることを確認
    expect(consoleCapture.consoleOutput.join('\n')).toContain('セッション管理CLI');
    expect(consoleCapture.consoleOutput.join('\n')).toContain('使用方法:');
    expect(consoleCapture.consoleOutput.join('\n')).toContain('コマンド:');
  });
  
  test('startコマンドでセッションが開始される', async () => {
    // コマンドライン引数を設定
    process.argv = ['node', 'session.js', 'start'];
    
    // session.jsを実行
    jest.isolateModules(() => {
      require('../../src/cli/session');
    });
    
    // 非同期処理の完了を待つ
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // セッションが開始されることを確認
    expect(mocks.adapters.sessionManagerAdapter.createNewSession).toHaveBeenCalled();
    expect(consoleCapture.consoleOutput.join('\n')).toContain('新しいセッションを開始します');
    expect(consoleCapture.consoleOutput.join('\n')).toContain('セッションを開始しました');
    expect(consoleCapture.consoleOutput.join('\n')).toContain('S001');
  });
  
  test('startコマンドで前回のセッションIDを指定できる', async () => {
    // コマンドライン引数を設定
    process.argv = ['node', 'session.js', 'start', 'S000'];
    
    // session.jsを実行
    jest.isolateModules(() => {
      require('../../src/cli/session');
    });
    
    // 非同期処理の完了を待つ
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // セッションが開始されることを確認
    expect(mocks.adapters.sessionManagerAdapter.createNewSession).toHaveBeenCalledWith('S000');
    expect(consoleCapture.consoleOutput.join('\n')).toContain('前回のセッションID: S000');
  });
  
  test('endコマンドでセッションが終了される', async () => {
    // コマンドライン引数を設定
    process.argv = ['node', 'session.js', 'end', 'S001'];
    
    // session.jsを実行
    jest.isolateModules(() => {
      require('../../src/cli/session');
    });
    
    // 非同期処理の完了を待つ
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // セッションが終了されることを確認
    expect(mocks.adapters.sessionManagerAdapter.endSession).toHaveBeenCalledWith('S001');
    expect(consoleCapture.consoleOutput.join('\n')).toContain('セッションを終了します');
    expect(consoleCapture.consoleOutput.join('\n')).toContain('セッションを終了しました');
    expect(consoleCapture.consoleOutput.join('\n')).toContain('S001');
  });
  
  test('endコマンドでセッションIDを省略すると最新のセッションが終了される', async () => {
    // コマンドライン引数を設定
    process.argv = ['node', 'session.js', 'end'];
    
    // session.jsを実行
    jest.isolateModules(() => {
      require('../../src/cli/session');
    });
    
    // 非同期処理の完了を待つ
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // 最新のセッションが取得されることを確認
    expect(mocks.adapters.sessionManagerAdapter.getLatestSession).toHaveBeenCalled();
    
    // セッションが終了されることを確認
    expect(mocks.adapters.sessionManagerAdapter.endSession).toHaveBeenCalledWith('S001');
    expect(consoleCapture.consoleOutput.join('\n')).toContain('セッションを終了します');
  });
  
  test('listコマンドでセッション一覧が表示される', async () => {
    // コマンドライン引数を設定
    process.argv = ['node', 'session.js', 'list'];
    
    // session.jsを実行
    jest.isolateModules(() => {
      require('../../src/cli/session');
    });
    
    // 非同期処理の完了を待つ
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // セッション一覧が取得されることを確認
    expect(mocks.adapters.sessionManagerAdapter.getAllSessions).toHaveBeenCalled();
    expect(consoleCapture.consoleOutput.join('\n')).toContain('セッション一覧を表示します');
    expect(consoleCapture.consoleOutput.join('\n')).toContain('S001');
    expect(consoleCapture.consoleOutput.join('\n')).toContain('S002');
  });
  
  test('currentコマンドで現在のセッションが表示される', async () => {
    // コマンドライン引数を設定
    process.argv = ['node', 'session.js', 'current'];
    
    // session.jsを実行
    jest.isolateModules(() => {
      require('../../src/cli/session');
    });
    
    // 非同期処理の完了を待つ
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // 最新のセッションが取得されることを確認
    expect(mocks.adapters.sessionManagerAdapter.getLatestSession).toHaveBeenCalled();
    expect(consoleCapture.consoleOutput.join('\n')).toContain('現在のセッションを表示します');
    expect(consoleCapture.consoleOutput.join('\n')).toContain('現在のセッション');
    expect(consoleCapture.consoleOutput.join('\n')).toContain('S001');
  });
  
  test('infoコマンドでセッション情報が表示される', async () => {
    // コマンドライン引数を設定
    process.argv = ['node', 'session.js', 'info', 'S001'];
    
    // session.jsを実行
    jest.isolateModules(() => {
      require('../../src/cli/session');
    });
    
    // 非同期処理の完了を待つ
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // セッション情報が取得されることを確認
    expect(mocks.adapters.sessionManagerAdapter.getSession).toHaveBeenCalledWith('S001');
    expect(consoleCapture.consoleOutput.join('\n')).toContain('セッション情報を表示します');
    expect(consoleCapture.consoleOutput.join('\n')).toContain('セッション情報');
    expect(consoleCapture.consoleOutput.join('\n')).toContain('S001');
  });
  
  test('infoコマンドでセッションIDが指定されていない場合はエラーメッセージが表示される', async () => {
    // コマンドライン引数を設定
    process.argv = ['node', 'session.js', 'info'];
    
    // session.jsを実行
    jest.isolateModules(() => {
      require('../../src/cli/session');
    });
    
    // 非同期処理の完了を待つ
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // エラーメッセージが表示されることを確認
    expect(consoleCapture.consoleOutput.join('\n')).toContain('セッションIDを指定してください');
    expect(consoleCapture.consoleOutput.join('\n')).toContain('使用方法: node session.js info <session-id>');
  });
  
  test('exportコマンドでセッション情報がエクスポートされる', async () => {
    // コマンドライン引数を設定
    process.argv = ['node', 'session.js', 'export', 'S001', 'output.json'];
    
    // session.jsを実行
    jest.isolateModules(() => {
      require('../../src/cli/session');
    });
    
    // 非同期処理の完了を待つ
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // セッション情報が取得されることを確認
    expect(mocks.adapters.sessionManagerAdapter.getSession).toHaveBeenCalledWith('S001');
    
    // ファイルに書き込まれることを確認
    expect(mocks.fs.writeFileSync).toHaveBeenCalled();
    expect(mocks.fs.writeFileSync.mock.calls[0][0]).toBe('output.json');
    
    // 成功メッセージが表示されることを確認
    expect(consoleCapture.consoleOutput.join('\n')).toContain('セッション情報をエクスポートします');
    expect(consoleCapture.consoleOutput.join('\n')).toContain('セッション情報を output.json にエクスポートしました');
  });
  
  test('importコマンドでセッション情報がインポートされる', async () => {
    // コマンドライン引数を設定
    process.argv = ['node', 'session.js', 'import', 'input.json'];
    
    // session.jsを実行
    jest.isolateModules(() => {
      require('../../src/cli/session');
    });
    
    // 非同期処理の完了を待つ
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // ファイルが存在するか確認されることを確認
    expect(mocks.fs.existsSync).toHaveBeenCalledWith('input.json');
    
    // ファイルが読み込まれることを確認
    expect(mocks.fs.readFileSync).toHaveBeenCalled();
    expect(mocks.fs.readFileSync.mock.calls[0][0]).toBe('input.json');
    
    // セッション情報がインポートされることを確認
    expect(mocks.adapters.sessionManagerAdapter.importSession).toHaveBeenCalled();
    
    // 成功メッセージが表示されることを確認
    expect(consoleCapture.consoleOutput.join('\n')).toContain('セッション情報をインポートします');
    expect(consoleCapture.consoleOutput.join('\n')).toContain('セッション情報をインポートしました');
  });
  
  test('不明なコマンドが指定された場合はエラーメッセージとヘルプが表示される', () => {
    // コマンドライン引数を設定
    process.argv = ['node', 'session.js', 'unknown'];
    
    // session.jsを実行
    jest.isolateModules(() => {
      require('../../src/cli/session');
    });
    
    // エラーメッセージとヘルプが表示されることを確認
    expect(consoleCapture.consoleOutput.join('\n')).toContain('不明なコマンド: unknown');
    expect(consoleCapture.consoleOutput.join('\n')).toContain('セッション管理CLI');
    expect(consoleCapture.consoleOutput.join('\n')).toContain('使用方法:');
    expect(consoleCapture.consoleOutput.join('\n')).toContain('コマンド:');
  });
  
  test('エラー発生時に適切なエラーメッセージが表示される', async () => {
    // エラーを発生させる
    mocks.adapters.sessionManagerAdapter.createNewSession.mockImplementationOnce(() => {
      throw new Error('テストエラー');
    });
    
    // コマンドライン引数を設定
    process.argv = ['node', 'session.js', 'start'];
    
    // session.jsを実行
    jest.isolateModules(() => {
      require('../../src/cli/session');
    });
    
    // 非同期処理の完了を待つ
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // エラーメッセージが表示されることを確認
    expect(consoleCapture.consoleErrors.join('\n')).toContain('セッション開始エラー');
    expect(consoleCapture.consoleErrors.join('\n')).toContain('テストエラー');
  });
});