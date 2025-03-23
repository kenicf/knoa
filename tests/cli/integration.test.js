/**
 * integration.jsのテスト
 */
const { createMocks, captureConsole } = require('./helpers/cli-test-helper');

// モジュールのモック
jest.mock('../../src/lib/core/service-container');
jest.mock('../../src/lib/core/service-definitions');
jest.mock('../../src/config');
jest.mock('fs');
jest.mock('path');
jest.mock('colors/safe');
jest.mock('yargs', () => {
  return {
    hideBin: jest.fn().mockReturnValue(['node', 'integration.js']),
  };
});

describe('integration CLI', () => {
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
    
    // yargsのモックを設定
    jest.mock('yargs', () => ({
      hideBin: jest.fn().mockReturnValue([]),
      usage: jest.fn().mockReturnThis(),
      command: jest.fn().mockReturnThis(),
      option: jest.fn().mockReturnThis(),
      help: jest.fn().mockReturnThis(),
      parse: jest.fn().mockReturnValue({})
    }));
    
    // process.argvをリセット
    process.argv = ['node', 'integration.js'];
  });
  
  afterEach(() => {
    // コンソール出力のリセット
    consoleCapture.restore();
    
    // モジュールのモックをクリア
    jest.resetModules();
  });
  
  test('initコマンドでワークフローが初期化される', async () => {
    // yargsのparseメソッドをモック
    const yargs = require('yargs');
    yargs.parse.mockReturnValue({
      _: ['init'],
      projectId: 'P001',
      request: 'テストリクエスト'
    });
    
    // integration.jsを実行
    jest.isolateModules(() => {
      require('../../src/cli/integration');
    });
    
    // 非同期処理の完了を待つ
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // ワークフローが初期化されることを確認
    expect(mocks.adapters.integrationManagerAdapter.initializeWorkflow).toHaveBeenCalled();
    expect(consoleCapture.consoleOutput.join('\n')).toContain('ワークフローを初期化します');
  });
  
  test('startコマンドでセッションが開始される', async () => {
    // yargsのparseメソッドをモック
    const yargs = require('yargs');
    yargs.parse.mockReturnValue({
      _: ['start'],
      previousSessionId: 'S000'
    });
    
    // integration.jsを実行
    jest.isolateModules(() => {
      require('../../src/cli/integration');
    });
    
    // 非同期処理の完了を待つ
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // セッションが開始されることを確認
    expect(mocks.adapters.integrationManagerAdapter.startSession).toHaveBeenCalled();
    expect(consoleCapture.consoleOutput.join('\n')).toContain('セッションを開始します');
  });
  
  test('endコマンドでセッションが終了される', async () => {
    // yargsのparseメソッドをモック
    const yargs = require('yargs');
    yargs.parse.mockReturnValue({
      _: ['end'],
      sessionId: 'S001'
    });
    
    // integration.jsを実行
    jest.isolateModules(() => {
      require('../../src/cli/integration');
    });
    
    // 非同期処理の完了を待つ
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // セッションが終了されることを確認
    expect(mocks.adapters.integrationManagerAdapter.endSession).toHaveBeenCalledWith('S001');
    expect(consoleCapture.consoleOutput.join('\n')).toContain('セッションを終了します');
  });
  
  test('endコマンドでセッションIDが指定されていない場合は最新のセッションが取得される', async () => {
    // yargsのparseメソッドをモック
    const yargs = require('yargs');
    yargs.parse.mockReturnValue({
      _: ['end']
    });
    
    // integration.jsを実行
    jest.isolateModules(() => {
      require('../../src/cli/integration');
    });
    
    // 非同期処理の完了を待つ
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // 最新のセッションが取得されることを確認
    expect(mocks.adapters.sessionManagerAdapter.getLatestSession).toHaveBeenCalled();
    
    // セッションが終了されることを確認
    expect(mocks.adapters.integrationManagerAdapter.endSession).toHaveBeenCalledWith('S001');
    expect(consoleCapture.consoleOutput.join('\n')).toContain('セッションを終了します');
  });
  
  test('createTaskコマンドでタスクが作成される', async () => {
    // yargsのparseメソッドをモック
    const yargs = require('yargs');
    yargs.parse.mockReturnValue({
      _: ['createTask'],
      title: 'テストタスク',
      description: 'テスト説明'
    });
    
    // integration.jsを実行
    jest.isolateModules(() => {
      require('../../src/cli/integration');
    });
    
    // 非同期処理の完了を待つ
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // タスクが作成されることを確認
    expect(mocks.adapters.integrationManagerAdapter.createTask).toHaveBeenCalledWith({
      title: 'テストタスク',
      description: 'テスト説明'
    });
    expect(consoleCapture.consoleOutput.join('\n')).toContain('タスクを作成します');
  });
  
  test('updateTaskコマンドでタスク状態が更新される', async () => {
    // yargsのparseメソッドをモック
    const yargs = require('yargs');
    yargs.parse.mockReturnValue({
      _: ['updateTask'],
      taskId: 'T001',
      status: 'in_progress'
    });
    
    // integration.jsを実行
    jest.isolateModules(() => {
      require('../../src/cli/integration');
    });
    
    // 非同期処理の完了を待つ
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // タスク状態が更新されることを確認
    expect(mocks.adapters.integrationManagerAdapter.updateTaskStatus).toHaveBeenCalledWith('T001', 'in_progress');
    expect(consoleCapture.consoleOutput.join('\n')).toContain('タスク状態を更新します');
  });
  
  test('collectFeedbackコマンドでフィードバックが収集される', async () => {
    // yargsのparseメソッドをモック
    const yargs = require('yargs');
    yargs.parse.mockReturnValue({
      _: ['collectFeedback'],
      taskId: 'T001',
      content: 'テストフィードバック'
    });
    
    // integration.jsを実行
    jest.isolateModules(() => {
      require('../../src/cli/integration');
    });
    
    // 非同期処理の完了を待つ
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // フィードバックが収集されることを確認
    expect(mocks.adapters.integrationManagerAdapter.collectFeedback).toHaveBeenCalledWith('T001', {
      content: 'テストフィードバック'
    });
    expect(consoleCapture.consoleOutput.join('\n')).toContain('フィードバックを収集します');
  });
  
  test('resolveFeedbackコマンドでフィードバックが解決される', async () => {
    // yargsのparseメソッドをモック
    const yargs = require('yargs');
    yargs.parse.mockReturnValue({
      _: ['resolveFeedback'],
      feedbackId: 'F001',
      resolution: 'fixed'
    });
    
    // integration.jsを実行
    jest.isolateModules(() => {
      require('../../src/cli/integration');
    });
    
    // 非同期処理の完了を待つ
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // フィードバックが解決されることを確認
    expect(mocks.adapters.integrationManagerAdapter.resolveFeedback).toHaveBeenCalledWith('F001', {
      action: 'fixed'
    });
    expect(consoleCapture.consoleOutput.join('\n')).toContain('フィードバックを解決します');
  });
  
  test('syncコマンドでコンポーネント間の同期が実行される', async () => {
    // yargsのparseメソッドをモック
    const yargs = require('yargs');
    yargs.parse.mockReturnValue({
      _: ['sync']
    });
    
    // integration.jsを実行
    jest.isolateModules(() => {
      require('../../src/cli/integration');
    });
    
    // 非同期処理の完了を待つ
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // コンポーネント間の同期が実行されることを確認
    expect(mocks.adapters.integrationManagerAdapter.syncComponents).toHaveBeenCalled();
    expect(consoleCapture.consoleOutput.join('\n')).toContain('コンポーネント間の同期を実行します');
  });
  
  test('reportコマンドでレポートが生成される', async () => {
    // yargsのparseメソッドをモック
    const yargs = require('yargs');
    yargs.parse.mockReturnValue({
      _: ['report'],
      format: 'markdown',
      includeDetails: true
    });
    
    // integration.jsを実行
    jest.isolateModules(() => {
      require('../../src/cli/integration');
    });
    
    // 非同期処理の完了を待つ
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // レポートが生成されることを確認
    expect(mocks.adapters.integrationManagerAdapter.generateReport).toHaveBeenCalledWith({
      format: 'markdown',
      includeDetails: true
    });
    expect(consoleCapture.consoleOutput.join('\n')).toContain('レポートを生成します');
  });
  
  test('statusコマンドでワークフロー状態が表示される', async () => {
    // yargsのparseメソッドをモック
    const yargs = require('yargs');
    yargs.parse.mockReturnValue({
      _: ['status']
    });
    
    // integration.jsを実行
    jest.isolateModules(() => {
      require('../../src/cli/integration');
    });
    
    // 非同期処理の完了を待つ
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // ワークフロー状態が取得されることを確認
    expect(mocks.adapters.integrationManagerAdapter.getWorkflowStatus).toHaveBeenCalled();
    
    // 現在の状態が取得されることを確認
    expect(mocks.adapters.stateManagerAdapter.getCurrentState).toHaveBeenCalled();
    
    // タスク一覧が取得されることを確認
    expect(mocks.adapters.taskManagerAdapter.getAllTasks).toHaveBeenCalled();
    
    expect(consoleCapture.consoleOutput.join('\n')).toContain('ワークフロー状態を取得します');
    expect(consoleCapture.consoleOutput.join('\n')).toContain('現在の状態');
  });
  
  test('エラー発生時に適切なエラーメッセージが表示される', async () => {
    // エラーを発生させる
    mocks.adapters.integrationManagerAdapter.initializeWorkflow.mockImplementationOnce(() => {
      throw new Error('テストエラー');
    });
    
    // yargsのparseメソッドをモック
    const yargs = require('yargs');
    yargs.parse.mockReturnValue({
      _: ['init'],
      projectId: 'P001',
      request: 'テストリクエスト'
    });
    
    // integration.jsを実行
    jest.isolateModules(() => {
      require('../../src/cli/integration');
    });
    
    // 非同期処理の完了を待つ
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // エラーメッセージが表示されることを確認
    expect(consoleCapture.consoleErrors.join('\n')).toContain('ワークフロー初期化エラー');
    expect(consoleCapture.consoleErrors.join('\n')).toContain('テストエラー');
  });
});