/**
 * feedback.jsのテスト
 */
const { createMocks, captureConsole } = require('./helpers/cli-test-helper');

// モジュールのモック
jest.mock('../../src/lib/core/service-container');
jest.mock('../../src/lib/core/service-definitions');
jest.mock('../../src/config');
jest.mock('fs');
jest.mock('path');
jest.mock('colors/safe');

describe('feedback CLI', () => {
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
    process.argv = ['node', 'feedback.js'];
  });
  
  afterEach(() => {
    // コンソール出力のリセット
    consoleCapture.restore();
    
    // モジュールのモックをクリア
    jest.resetModules();
  });
  
  test('helpコマンドでヘルプメッセージが表示される', () => {
    // コマンドライン引数を設定
    process.argv = ['node', 'feedback.js', 'help'];
    
    // feedback.jsを実行
    jest.isolateModules(() => {
      require('../../src/cli/feedback');
    });
    
    // ヘルプメッセージが表示されることを確認
    expect(consoleCapture.consoleOutput.join('\n')).toContain('フィードバック管理CLI');
    expect(consoleCapture.consoleOutput.join('\n')).toContain('使用方法:');
    expect(consoleCapture.consoleOutput.join('\n')).toContain('コマンド:');
  });
  
  test('collectコマンドでフィードバックが収集される', async () => {
    // コマンドライン引数を設定
    process.argv = ['node', 'feedback.js', 'collect', 'T001', 'テスト結果'];
    
    // feedback.jsを実行
    jest.isolateModules(() => {
      require('../../src/cli/feedback');
    });
    
    // 非同期処理の完了を待つ
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // フィードバックが収集されることを確認
    expect(mocks.adapters.feedbackManagerAdapter.collectTestResults).toHaveBeenCalledWith('T001', 'テスト結果');
    expect(consoleCapture.consoleOutput.join('\n')).toContain('フィードバックを収集します');
    expect(consoleCapture.consoleOutput.join('\n')).toContain('フィードバックを収集しました');
  });
  
  test('collectコマンドでタスクIDとテスト結果が指定されていない場合はエラーメッセージが表示される', async () => {
    // コマンドライン引数を設定
    process.argv = ['node', 'feedback.js', 'collect'];
    
    // feedback.jsを実行
    jest.isolateModules(() => {
      require('../../src/cli/feedback');
    });
    
    // 非同期処理の完了を待つ
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // エラーメッセージが表示されることを確認
    expect(consoleCapture.consoleOutput.join('\n')).toContain('タスクIDとテスト結果を指定してください');
    expect(consoleCapture.consoleOutput.join('\n')).toContain('使用方法: node feedback.js collect <task-id> <test-results>');
  });
  
  test('listコマンドでフィードバック一覧が表示される', async () => {
    // コマンドライン引数を設定
    process.argv = ['node', 'feedback.js', 'list', 'T001'];
    
    // feedback.jsを実行
    jest.isolateModules(() => {
      require('../../src/cli/feedback');
    });
    
    // 非同期処理の完了を待つ
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // フィードバック一覧が取得されることを確認
    expect(mocks.adapters.feedbackManagerAdapter.getFeedbackByTaskId).toHaveBeenCalledWith('T001');
    expect(consoleCapture.consoleOutput.join('\n')).toContain('フィードバック一覧を表示します');
    expect(consoleCapture.consoleOutput.join('\n')).toContain('テストフィードバック1');
    expect(consoleCapture.consoleOutput.join('\n')).toContain('テストフィードバック2');
  });
  
  test('listコマンドでタスクIDが指定されていない場合はエラーメッセージが表示される', async () => {
    // コマンドライン引数を設定
    process.argv = ['node', 'feedback.js', 'list'];
    
    // feedback.jsを実行
    jest.isolateModules(() => {
      require('../../src/cli/feedback');
    });
    
    // 非同期処理の完了を待つ
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // エラーメッセージが表示されることを確認
    expect(consoleCapture.consoleOutput.join('\n')).toContain('タスクIDを指定してください');
    expect(consoleCapture.consoleOutput.join('\n')).toContain('使用方法: node feedback.js list <task-id>');
  });
  
  test('updateコマンドでフィードバック状態が更新される', async () => {
    // コマンドライン引数を設定
    process.argv = ['node', 'feedback.js', 'update', 'F001', 'resolved'];
    
    // feedback.jsを実行
    jest.isolateModules(() => {
      require('../../src/cli/feedback');
    });
    
    // 非同期処理の完了を待つ
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // フィードバック状態が更新されることを確認
    expect(mocks.adapters.feedbackManagerAdapter.updateFeedbackStatus).toHaveBeenCalledWith('F001', 'resolved');
    expect(consoleCapture.consoleOutput.join('\n')).toContain('フィードバック状態を更新します');
    expect(consoleCapture.consoleOutput.join('\n')).toContain('フィードバック状態を更新しました');
  });
  
  test('updateコマンドでフィードバックIDと状態が指定されていない場合はエラーメッセージが表示される', async () => {
    // コマンドライン引数を設定
    process.argv = ['node', 'feedback.js', 'update'];
    
    // feedback.jsを実行
    jest.isolateModules(() => {
      require('../../src/cli/feedback');
    });
    
    // 非同期処理の完了を待つ
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // エラーメッセージが表示されることを確認
    expect(consoleCapture.consoleOutput.join('\n')).toContain('フィードバックIDと状態を指定してください');
    expect(consoleCapture.consoleOutput.join('\n')).toContain('使用方法: node feedback.js update <feedback-id> <status>');
  });
  
  test('generateコマンドでフィードバックレポートが生成される', async () => {
    // コマンドライン引数を設定
    process.argv = ['node', 'feedback.js', 'generate', 'T001', 'report.md'];
    
    // feedback.jsを実行
    jest.isolateModules(() => {
      require('../../src/cli/feedback');
    });
    
    // 非同期処理の完了を待つ
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // フィードバックレポートが生成されることを確認
    expect(mocks.adapters.feedbackManagerAdapter.generateFeedbackMarkdown).toHaveBeenCalledWith('T001');
    
    // ファイルに書き込まれることを確認
    expect(mocks.fs.writeFileSync).toHaveBeenCalled();
    expect(mocks.fs.writeFileSync.mock.calls[0][0]).toBe('report.md');
    
    // 成功メッセージが表示されることを確認
    expect(consoleCapture.consoleOutput.join('\n')).toContain('フィードバックレポートを生成します');
    expect(consoleCapture.consoleOutput.join('\n')).toContain('フィードバックレポートを report.md に保存しました');
  });
  
  test('generateコマンドでタスクIDが指定されていない場合はエラーメッセージが表示される', async () => {
    // コマンドライン引数を設定
    process.argv = ['node', 'feedback.js', 'generate'];
    
    // feedback.jsを実行
    jest.isolateModules(() => {
      require('../../src/cli/feedback');
    });
    
    // 非同期処理の完了を待つ
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // エラーメッセージが表示されることを確認
    expect(consoleCapture.consoleOutput.join('\n')).toContain('タスクIDを指定してください');
    expect(consoleCapture.consoleOutput.join('\n')).toContain('使用方法: node feedback.js generate <task-id> [output-path]');
  });
  
  test('prioritizeコマンドでフィードバックが優先順位付けされる', async () => {
    // コマンドライン引数を設定
    process.argv = ['node', 'feedback.js', 'prioritize', 'T001'];
    
    // feedback.jsを実行
    jest.isolateModules(() => {
      require('../../src/cli/feedback');
    });
    
    // 非同期処理の完了を待つ
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // フィードバックが優先順位付けされることを確認
    expect(mocks.adapters.feedbackManagerAdapter.prioritizeFeedback).toHaveBeenCalledWith('T001');
    expect(consoleCapture.consoleOutput.join('\n')).toContain('フィードバックを優先順位付けします');
  });
  
  test('linkコマンドでフィードバックがGitコミットに関連付けられる', async () => {
    // コマンドライン引数を設定
    process.argv = ['node', 'feedback.js', 'link', 'F001', 'abc123'];
    
    // feedback.jsを実行
    jest.isolateModules(() => {
      require('../../src/cli/feedback');
    });
    
    // 非同期処理の完了を待つ
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // フィードバックがGitコミットに関連付けられることを確認
    expect(mocks.adapters.feedbackManagerAdapter.linkFeedbackToGitCommit).toHaveBeenCalledWith('F001', 'abc123');
    expect(consoleCapture.consoleOutput.join('\n')).toContain('フィードバックをGitコミットに関連付けます');
  });
  
  test('linkコマンドでフィードバックIDとコミットハッシュが指定されていない場合はエラーメッセージが表示される', async () => {
    // コマンドライン引数を設定
    process.argv = ['node', 'feedback.js', 'link'];
    
    // feedback.jsを実行
    jest.isolateModules(() => {
      require('../../src/cli/feedback');
    });
    
    // 非同期処理の完了を待つ
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // エラーメッセージが表示されることを確認
    expect(consoleCapture.consoleOutput.join('\n')).toContain('フィードバックIDとコミットハッシュを指定してください');
    expect(consoleCapture.consoleOutput.join('\n')).toContain('使用方法: node feedback.js link <feedback-id> <commit-hash>');
  });
  
  test('linkSessionコマンドでフィードバックがセッションに関連付けられる', async () => {
    // コマンドライン引数を設定
    process.argv = ['node', 'feedback.js', 'linkSession', 'F001', 'S001'];
    
    // feedback.jsを実行
    jest.isolateModules(() => {
      require('../../src/cli/feedback');
    });
    
    // 非同期処理の完了を待つ
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // フィードバックがセッションに関連付けられることを確認
    expect(mocks.adapters.feedbackManagerAdapter.linkFeedbackToSession).toHaveBeenCalledWith('F001', 'S001');
    expect(consoleCapture.consoleOutput.join('\n')).toContain('フィードバックをセッションに関連付けます');
  });
  
  test('integrateTaskコマンドでフィードバックがタスクと統合される', async () => {
    // コマンドライン引数を設定
    process.argv = ['node', 'feedback.js', 'integrateTask', 'F001', 'T001'];
    
    // feedback.jsを実行
    jest.isolateModules(() => {
      require('../../src/cli/feedback');
    });
    
    // 非同期処理の完了を待つ
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // フィードバックがタスクと統合されることを確認
    expect(mocks.adapters.feedbackManagerAdapter.integrateFeedbackWithTask).toHaveBeenCalledWith('F001', 'T001');
    expect(consoleCapture.consoleOutput.join('\n')).toContain('フィードバックをタスクと統合します');
  });
  
  test('integrateSessionコマンドでフィードバックがセッションと統合される', async () => {
    // コマンドライン引数を設定
    process.argv = ['node', 'feedback.js', 'integrateSession', 'F001', 'S001'];
    
    // feedback.jsを実行
    jest.isolateModules(() => {
      require('../../src/cli/feedback');
    });
    
    // 非同期処理の完了を待つ
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // フィードバックがセッションと統合されることを確認
    expect(mocks.adapters.feedbackManagerAdapter.integrateFeedbackWithSession).toHaveBeenCalledWith('F001', 'S001');
    expect(consoleCapture.consoleOutput.join('\n')).toContain('フィードバックをセッションと統合します');
  });
  
  test('不明なコマンドが指定された場合はエラーメッセージとヘルプが表示される', () => {
    // コマンドライン引数を設定
    process.argv = ['node', 'feedback.js', 'unknown'];
    
    // feedback.jsを実行
    jest.isolateModules(() => {
      require('../../src/cli/feedback');
    });
    
    // エラーメッセージとヘルプが表示されることを確認
    expect(consoleCapture.consoleOutput.join('\n')).toContain('不明なコマンド: unknown');
    expect(consoleCapture.consoleOutput.join('\n')).toContain('フィードバック管理CLI');
    expect(consoleCapture.consoleOutput.join('\n')).toContain('使用方法:');
    expect(consoleCapture.consoleOutput.join('\n')).toContain('コマンド:');
  });
  
  test('エラー発生時に適切なエラーメッセージが表示される', async () => {
    // エラーを発生させる
    mocks.adapters.feedbackManagerAdapter.collectTestResults.mockImplementationOnce(() => {
      throw new Error('テストエラー');
    });
    
    // コマンドライン引数を設定
    process.argv = ['node', 'feedback.js', 'collect', 'T001', 'テスト結果'];
    
    // feedback.jsを実行
    jest.isolateModules(() => {
      require('../../src/cli/feedback');
    });
    
    // 非同期処理の完了を待つ
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // エラーメッセージが表示されることを確認
    expect(consoleCapture.consoleErrors.join('\n')).toContain('フィードバック収集エラー');
    expect(consoleCapture.consoleErrors.join('\n')).toContain('テストエラー');
  });
});