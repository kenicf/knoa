/**
 * task.jsのテスト
 */
const { createMocks, captureConsole } = require('./helpers/cli-test-helper');

// モジュールのモック
jest.mock('../../src/lib/core/service-container');
jest.mock('../../src/lib/core/service-definitions');
jest.mock('../../src/config');
jest.mock('fs');
jest.mock('path');
jest.mock('colors/safe');

describe('task CLI', () => {
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
    process.argv = ['node', 'task.js'];
  });

  afterEach(() => {
    // コンソール出力のリセット
    consoleCapture.restore();

    // モジュールのモックをクリア
    jest.resetModules();
  });

  test('helpコマンドでヘルプメッセージが表示される', () => {
    // コマンドライン引数を設定
    process.argv = ['node', 'task.js', 'help'];

    // task.jsを実行
    jest.isolateModules(() => {
      require('../../src/cli/task');
    });

    // ヘルプメッセージが表示されることを確認
    expect(consoleCapture.consoleOutput.join('\n')).toContain('タスク管理CLI');
    expect(consoleCapture.consoleOutput.join('\n')).toContain('使用方法:');
    expect(consoleCapture.consoleOutput.join('\n')).toContain('コマンド:');
  });

  test('createコマンドでタスクが作成される', async () => {
    // コマンドライン引数を設定
    process.argv = ['node', 'task.js', 'create', 'テストタスク', 'テスト説明'];

    // task.jsを実行
    jest.isolateModules(() => {
      require('../../src/cli/task');
    });

    // 非同期処理の完了を待つ
    await new Promise((resolve) => setTimeout(resolve, 100));

    // タスクが作成されることを確認
    expect(mocks.adapters.taskManagerAdapter.createTask).toHaveBeenCalledWith({
      title: 'テストタスク',
      description: 'テスト説明',
      status: 'pending',
      priority: 3,
      estimated_hours: 1,
    });
    expect(consoleCapture.consoleOutput.join('\n')).toContain(
      '新しいタスクを作成します'
    );
    expect(consoleCapture.consoleOutput.join('\n')).toContain(
      'タスクを作成しました'
    );
    expect(consoleCapture.consoleOutput.join('\n')).toContain('T001');
  });

  test('createコマンドでタイトルが指定されていない場合はエラーメッセージが表示される', async () => {
    // コマンドライン引数を設定
    process.argv = ['node', 'task.js', 'create'];

    // task.jsを実行
    jest.isolateModules(() => {
      require('../../src/cli/task');
    });

    // 非同期処理の完了を待つ
    await new Promise((resolve) => setTimeout(resolve, 100));

    // エラーメッセージが表示されることを確認
    expect(consoleCapture.consoleOutput.join('\n')).toContain(
      'タイトルを指定してください'
    );
    expect(consoleCapture.consoleOutput.join('\n')).toContain(
      '使用方法: node task.js create <title> <description>'
    );
  });

  test('listコマンドでタスク一覧が表示される', async () => {
    // コマンドライン引数を設定
    process.argv = ['node', 'task.js', 'list'];

    // task.jsを実行
    jest.isolateModules(() => {
      require('../../src/cli/task');
    });

    // 非同期処理の完了を待つ
    await new Promise((resolve) => setTimeout(resolve, 100));

    // タスク一覧が取得されることを確認
    expect(mocks.adapters.taskManagerAdapter.getAllTasks).toHaveBeenCalled();
    expect(consoleCapture.consoleOutput.join('\n')).toContain(
      'タスク一覧を表示します'
    );
    expect(consoleCapture.consoleOutput.join('\n')).toContain('タスク1');
    expect(consoleCapture.consoleOutput.join('\n')).toContain('タスク2');
  });

  test('infoコマンドでタスク情報が表示される', async () => {
    // コマンドライン引数を設定
    process.argv = ['node', 'task.js', 'info', 'T001'];

    // task.jsを実行
    jest.isolateModules(() => {
      require('../../src/cli/task');
    });

    // 非同期処理の完了を待つ
    await new Promise((resolve) => setTimeout(resolve, 100));

    // タスク情報が取得されることを確認
    expect(mocks.adapters.taskManagerAdapter.getTaskById).toHaveBeenCalledWith(
      'T001'
    );
    expect(consoleCapture.consoleOutput.join('\n')).toContain(
      'タスク情報を表示します'
    );
    expect(consoleCapture.consoleOutput.join('\n')).toContain('タスク情報');
    expect(consoleCapture.consoleOutput.join('\n')).toContain('T001');
    expect(consoleCapture.consoleOutput.join('\n')).toContain('テストタスク');
  });

  test('infoコマンドでタスクIDが指定されていない場合はエラーメッセージが表示される', async () => {
    // コマンドライン引数を設定
    process.argv = ['node', 'task.js', 'info'];

    // task.jsを実行
    jest.isolateModules(() => {
      require('../../src/cli/task');
    });

    // 非同期処理の完了を待つ
    await new Promise((resolve) => setTimeout(resolve, 100));

    // エラーメッセージが表示されることを確認
    expect(consoleCapture.consoleOutput.join('\n')).toContain(
      'タスクIDを指定してください'
    );
    expect(consoleCapture.consoleOutput.join('\n')).toContain(
      '使用方法: node task.js info <task-id>'
    );
  });

  test('updateコマンドでタスク状態が更新される', async () => {
    // コマンドライン引数を設定
    process.argv = ['node', 'task.js', 'update', 'T001', 'in_progress'];

    // task.jsを実行
    jest.isolateModules(() => {
      require('../../src/cli/task');
    });

    // 非同期処理の完了を待つ
    await new Promise((resolve) => setTimeout(resolve, 100));

    // タスク情報が取得されることを確認
    expect(mocks.adapters.taskManagerAdapter.getTaskById).toHaveBeenCalledWith(
      'T001'
    );

    // タスクが更新されることを確認
    expect(mocks.adapters.taskManagerAdapter.updateTask).toHaveBeenCalled();
    expect(
      mocks.adapters.taskManagerAdapter.updateTask.mock.calls[0][0].status
    ).toBe('in_progress');

    // 成功メッセージが表示されることを確認
    expect(consoleCapture.consoleOutput.join('\n')).toContain(
      'タスク T001 の状態を in_progress に更新します'
    );
    expect(consoleCapture.consoleOutput.join('\n')).toContain(
      'タスクを更新しました'
    );
  });

  test('updateコマンドでタスクIDと状態が指定されていない場合はエラーメッセージが表示される', async () => {
    // コマンドライン引数を設定
    process.argv = ['node', 'task.js', 'update'];

    // task.jsを実行
    jest.isolateModules(() => {
      require('../../src/cli/task');
    });

    // 非同期処理の完了を待つ
    await new Promise((resolve) => setTimeout(resolve, 100));

    // エラーメッセージが表示されることを確認
    expect(consoleCapture.consoleOutput.join('\n')).toContain(
      'タスクIDと状態を指定してください'
    );
    expect(consoleCapture.consoleOutput.join('\n')).toContain(
      '使用方法: node task.js update <task-id> <status>'
    );
  });

  test('progressコマンドでタスク進捗が更新される', async () => {
    // コマンドライン引数を設定
    process.argv = ['node', 'task.js', 'progress', 'T001', '75'];

    // task.jsを実行
    jest.isolateModules(() => {
      require('../../src/cli/task');
    });

    // 非同期処理の完了を待つ
    await new Promise((resolve) => setTimeout(resolve, 100));

    // タスク進捗が更新されることを確認
    expect(
      mocks.adapters.taskManagerAdapter.updateTaskProgress
    ).toHaveBeenCalledWith('T001', 75, expect.any(String));

    // 成功メッセージが表示されることを確認
    expect(consoleCapture.consoleOutput.join('\n')).toContain(
      'タスク T001 の進捗率を 75% に更新します'
    );
    expect(consoleCapture.consoleOutput.join('\n')).toContain(
      'タスク進捗を更新しました'
    );
  });

  test('progressコマンドでタスクIDと進捗率が指定されていない場合はエラーメッセージが表示される', async () => {
    // コマンドライン引数を設定
    process.argv = ['node', 'task.js', 'progress'];

    // task.jsを実行
    jest.isolateModules(() => {
      require('../../src/cli/task');
    });

    // 非同期処理の完了を待つ
    await new Promise((resolve) => setTimeout(resolve, 100));

    // エラーメッセージが表示されることを確認
    expect(consoleCapture.consoleOutput.join('\n')).toContain(
      'タスクIDと進捗率を指定してください'
    );
    expect(consoleCapture.consoleOutput.join('\n')).toContain(
      '使用方法: node task.js progress <task-id> <progress>'
    );
  });

  test('deleteコマンドでタスクが削除される', async () => {
    // コマンドライン引数を設定
    process.argv = ['node', 'task.js', 'delete', 'T001'];

    // task.jsを実行
    jest.isolateModules(() => {
      require('../../src/cli/task');
    });

    // 非同期処理の完了を待つ
    await new Promise((resolve) => setTimeout(resolve, 100));

    // タスクが削除されることを確認
    expect(mocks.adapters.taskManagerAdapter.deleteTask).toHaveBeenCalledWith(
      'T001'
    );

    // 成功メッセージが表示されることを確認
    expect(consoleCapture.consoleOutput.join('\n')).toContain(
      'タスク T001 を削除します'
    );
    expect(consoleCapture.consoleOutput.join('\n')).toContain(
      'タスク T001 を削除しました'
    );
  });

  test('deleteコマンドでタスクIDが指定されていない場合はエラーメッセージが表示される', async () => {
    // コマンドライン引数を設定
    process.argv = ['node', 'task.js', 'delete'];

    // task.jsを実行
    jest.isolateModules(() => {
      require('../../src/cli/task');
    });

    // 非同期処理の完了を待つ
    await new Promise((resolve) => setTimeout(resolve, 100));

    // エラーメッセージが表示されることを確認
    expect(consoleCapture.consoleOutput.join('\n')).toContain(
      'タスクIDを指定してください'
    );
    expect(consoleCapture.consoleOutput.join('\n')).toContain(
      '使用方法: node task.js delete <task-id>'
    );
  });

  test('linkコマンドでタスクにGitコミットが関連付けられる', async () => {
    // コマンドライン引数を設定
    process.argv = ['node', 'task.js', 'link', 'T001', 'abc123'];

    // task.jsを実行
    jest.isolateModules(() => {
      require('../../src/cli/task');
    });

    // 非同期処理の完了を待つ
    await new Promise((resolve) => setTimeout(resolve, 100));

    // タスクにGitコミットが関連付けられることを確認
    expect(
      mocks.adapters.taskManagerAdapter.addGitCommitToTask
    ).toHaveBeenCalledWith('T001', 'abc123');

    // 成功メッセージが表示されることを確認
    expect(consoleCapture.consoleOutput.join('\n')).toContain(
      'タスク T001 にコミット abc123 を関連付けます'
    );
    expect(consoleCapture.consoleOutput.join('\n')).toContain(
      'コミットを関連付けました'
    );
  });

  test('linkコマンドでタスクIDとコミットハッシュが指定されていない場合はエラーメッセージが表示される', async () => {
    // コマンドライン引数を設定
    process.argv = ['node', 'task.js', 'link'];

    // task.jsを実行
    jest.isolateModules(() => {
      require('../../src/cli/task');
    });

    // 非同期処理の完了を待つ
    await new Promise((resolve) => setTimeout(resolve, 100));

    // エラーメッセージが表示されることを確認
    expect(consoleCapture.consoleOutput.join('\n')).toContain(
      'タスクIDとコミットハッシュを指定してください'
    );
    expect(consoleCapture.consoleOutput.join('\n')).toContain(
      '使用方法: node task.js link <task-id> <commit-hash>'
    );
  });

  test('exportコマンドでタスク情報がエクスポートされる', async () => {
    // コマンドライン引数を設定
    process.argv = ['node', 'task.js', 'export', 'T001', 'output.json'];

    // task.jsを実行
    jest.isolateModules(() => {
      require('../../src/cli/task');
    });

    // 非同期処理の完了を待つ
    await new Promise((resolve) => setTimeout(resolve, 100));

    // タスク情報が取得されることを確認
    expect(mocks.adapters.taskManagerAdapter.getTaskById).toHaveBeenCalledWith(
      'T001'
    );

    // ファイルに書き込まれることを確認
    expect(mocks.fs.writeFileSync).toHaveBeenCalled();
    expect(mocks.fs.writeFileSync.mock.calls[0][0]).toBe('output.json');

    // 成功メッセージが表示されることを確認
    expect(consoleCapture.consoleOutput.join('\n')).toContain(
      'タスク情報をエクスポートします'
    );
    expect(consoleCapture.consoleOutput.join('\n')).toContain(
      'タスク情報を output.json にエクスポートしました'
    );
  });

  test('importコマンドでタスク情報がインポートされる', async () => {
    // コマンドライン引数を設定
    process.argv = ['node', 'task.js', 'import', 'input.json'];

    // task.jsを実行
    jest.isolateModules(() => {
      require('../../src/cli/task');
    });

    // 非同期処理の完了を待つ
    await new Promise((resolve) => setTimeout(resolve, 100));

    // ファイルが存在するか確認されることを確認
    expect(mocks.fs.existsSync).toHaveBeenCalledWith('input.json');

    // ファイルが読み込まれることを確認
    expect(mocks.fs.readFileSync).toHaveBeenCalled();
    expect(mocks.fs.readFileSync.mock.calls[0][0]).toBe('input.json');

    // タスク情報がインポートされることを確認
    expect(mocks.adapters.taskManagerAdapter.importTask).toHaveBeenCalled();

    // 成功メッセージが表示されることを確認
    expect(consoleCapture.consoleOutput.join('\n')).toContain(
      'タスク情報をインポートします'
    );
    expect(consoleCapture.consoleOutput.join('\n')).toContain(
      'タスク情報をインポートしました'
    );
  });

  test('不明なコマンドが指定された場合はエラーメッセージとヘルプが表示される', () => {
    // コマンドライン引数を設定
    process.argv = ['node', 'task.js', 'unknown'];

    // task.jsを実行
    jest.isolateModules(() => {
      require('../../src/cli/task');
    });

    // エラーメッセージとヘルプが表示されることを確認
    expect(consoleCapture.consoleOutput.join('\n')).toContain(
      '不明なコマンド: unknown'
    );
    expect(consoleCapture.consoleOutput.join('\n')).toContain('タスク管理CLI');
    expect(consoleCapture.consoleOutput.join('\n')).toContain('使用方法:');
    expect(consoleCapture.consoleOutput.join('\n')).toContain('コマンド:');
  });

  test('エラー発生時に適切なエラーメッセージが表示される', async () => {
    // エラーを発生させる
    mocks.adapters.taskManagerAdapter.createTask.mockImplementationOnce(() => {
      throw new Error('テストエラー');
    });

    // コマンドライン引数を設定
    process.argv = ['node', 'task.js', 'create', 'テストタスク', 'テスト説明'];

    // task.jsを実行
    jest.isolateModules(() => {
      require('../../src/cli/task');
    });

    // 非同期処理の完了を待つ
    await new Promise((resolve) => setTimeout(resolve, 100));

    // エラーメッセージが表示されることを確認
    expect(consoleCapture.consoleErrors.join('\n')).toContain(
      'タスク作成エラー'
    );
    expect(consoleCapture.consoleErrors.join('\n')).toContain('テストエラー');
  });
});
