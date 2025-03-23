#!/usr/bin/env node
/**
 * 統合マネージャーCLI
 * 
 * 統合マネージャーを使用するためのコマンドラインインターフェース
 */

const colors = require('colors/safe');
const readline = require('readline');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const fs = require('fs');
const path = require('path');

// 依存性注入
const ServiceContainer = require('../lib/core/service-container');
const { registerServices } = require('../lib/core/service-definitions');
const config = require('../config');

// サービスコンテナの作成と初期化
const container = new ServiceContainer();
registerServices(container, config);

// 統合マネージャーのインスタンスを取得
const integrationManager = container.get('integrationManagerAdapter');

// コマンドライン引数の解析
const argv = yargs(hideBin(process.argv))
  .usage('使用方法: $0 <コマンド> [オプション]')
  .command('init <project-id> <request>', 'ワークフローの初期化', (yargs) => {
    return yargs
      .positional('project-id', {
        describe: 'プロジェクトID',
        type: 'string'
      })
      .positional('request', {
        describe: '元のリクエスト',
        type: 'string'
      });
  })
  .command('start-session [previous-session-id]', 'セッションの開始', (yargs) => {
    return yargs
      .positional('previous-session-id', {
        describe: '前回のセッションID',
        type: 'string'
      });
  })
  .command('end-session [session-id]', 'セッションの終了', (yargs) => {
    return yargs
      .positional('session-id', {
        describe: 'セッションID',
        type: 'string'
      });
  })
  .command('create-task <title> <description>', 'タスクの作成', (yargs) => {
    return yargs
      .positional('title', {
        describe: 'タスクタイトル',
        type: 'string'
      })
      .positional('description', {
        describe: 'タスク説明',
        type: 'string'
      })
      .option('status', {
        describe: 'タスク状態',
        type: 'string',
        choices: ['pending', 'in_progress', 'completed', 'blocked'],
        default: 'pending'
      })
      .option('priority', {
        describe: '優先度',
        type: 'number',
        choices: [1, 2, 3, 4, 5],
        default: 3
      })
      .option('estimated-hours', {
        describe: '見積もり時間',
        type: 'number',
        default: 1
      })
      .option('dependencies', {
        describe: '依存タスクID（カンマ区切り）',
        type: 'string'
      });
  })
  .command('update-task <task-id> <status> [progress]', 'タスクの更新', (yargs) => {
    return yargs
      .positional('task-id', {
        describe: 'タスクID',
        type: 'string'
      })
      .positional('status', {
        describe: 'タスク状態',
        type: 'string',
        choices: ['pending', 'in_progress', 'completed', 'blocked']
      })
      .positional('progress', {
        describe: '進捗率（0-100）',
        type: 'number'
      });
  })
  .command('collect-feedback <task-id> <test-command>', 'フィードバックの収集', (yargs) => {
    return yargs
      .positional('task-id', {
        describe: 'タスクID',
        type: 'string'
      })
      .positional('test-command', {
        describe: 'テストコマンド',
        type: 'string'
      });
  })
  .command('resolve-feedback <feedback-id>', 'フィードバックの解決', (yargs) => {
    return yargs
      .positional('feedback-id', {
        describe: 'フィードバックID',
        type: 'string'
      });
  })
  .command('sync', 'コンポーネントの同期')
  .command('report <type>', 'レポートの生成', (yargs) => {
    return yargs
      .positional('type', {
        describe: 'レポートタイプ',
        type: 'string',
        choices: ['task_summary', 'session_summary', 'feedback_summary', 'workflow_status', 'integration_status']
      })
      .option('format', {
        describe: '出力形式',
        type: 'string',
        choices: ['text', 'json', 'markdown'],
        default: 'text'
      })
      .option('output', {
        describe: '出力ファイルパス',
        type: 'string'
      });
  })
  .command('status', 'ワークフロー状態の取得')
  .command('interactive', 'インタラクティブモード', {})
  .demandCommand(1, 'コマンドを指定してください')
  .help()
  .alias('h', 'help')
  .version()
  .alias('v', 'version')
  .argv;

// コマンド分岐処理を実装
async function executeCommand(command, args) {
  try {
    switch (command) {
      case 'init':
        return await initializeWorkflow(args.projectId, args.request);
      
      case 'start-session':
        return await startSession(args.previousSessionId);
      
      case 'end-session':
        return await endSession(args.sessionId);
      
      case 'create-task':
        return await createTask(args.title, args.description, args);
      
      case 'update-task':
        return await updateTask(args.taskId, args.status, args.progress);
      
      case 'collect-feedback':
        return await collectFeedback(args.taskId, args.testCommand);
      
      case 'resolve-feedback':
        return await resolveFeedback(args.feedbackId);
      
      case 'sync':
        return await syncComponents();
      
      case 'report':
        return await generateReport(args.type, args);
      
      case 'status':
        return await getWorkflowStatus();
      
      case 'interactive':
        return await startInteractiveMode();
      
      default:
        console.error(colors.red('不明なコマンド:'), command);
        process.exit(1);
    }
  } catch (error) {
    console.error(colors.red('エラーが発生しました:'), error.message);
    process.exit(1);
  }
}

/**
 * ワークフローを初期化
 * @param {string} projectId - プロジェクトID
 * @param {string} request - 元のリクエスト
 */
async function initializeWorkflow(projectId, request) {
  console.log(colors.cyan('ワークフローの初期化...'), projectId);
  
  const result = await integrationManager.initializeWorkflow(projectId, request);
  
  if (result.error) {
    console.error(colors.red('初期化エラー:'), result.error);
    return;
  }
  
  console.log(colors.green('ワークフローを初期化しました:'));
  console.log(colors.yellow('プロジェクトID:'), result.project);
  console.log(colors.yellow('リクエスト:'), result.original_request);
}

/**
 * セッションを開始
 * @param {string} previousSessionId - 前回のセッションID
 */
async function startSession(previousSessionId) {
  console.log(colors.cyan('セッションを開始します...'));
  
  const result = await integrationManager.startSession(previousSessionId);
  
  if (result.error) {
    console.error(colors.red('セッション開始エラー:'), result.error);
    return;
  }
  
  console.log(colors.green('セッションを開始しました:'));
  console.log(colors.yellow('セッションID:'), result.session_id);
  
  if (previousSessionId) {
    console.log(colors.yellow('前回のセッションID:'), previousSessionId);
  }
}

/**
 * セッションを終了
 * @param {string} sessionId - セッションID
 */
async function endSession(sessionId) {
  console.log(colors.cyan('セッションを終了します...'));
  
  // セッションIDが指定されていない場合は最新のセッションを取得
  if (!sessionId) {
    const sessionManager = container.get('sessionManagerAdapter');
    const session = await sessionManager.getLatestSession();
    if (session) {
      sessionId = session.session_id;
    } else {
      console.error(colors.red('アクティブなセッションが見つかりません'));
      return;
    }
  }
  
  const result = await integrationManager.endSession(sessionId);
  
  if (result.error) {
    console.error(colors.red('セッション終了エラー:'), result.error);
    return;
  }
  
  console.log(colors.green('セッションを終了しました:'));
  console.log(colors.yellow('セッションID:'), result.session_id);
  
  // 引継ぎドキュメントを保存
  const handoverPath = path.join(process.cwd(), 'ai-context', 'sessions', 'session-handover.md');
  fs.writeFileSync(handoverPath, result.handover_document, 'utf8');
  console.log(colors.green('引継ぎドキュメントを保存しました:'), handoverPath);
}

/**
 * タスクを作成
 * @param {string} title - タスクタイトル
 * @param {string} description - タスク説明
 * @param {Object} options - その他のオプション
 */
async function createTask(title, description, options) {
  console.log(colors.cyan('タスクを作成します...'));
  
  // タスクデータの構築
  const taskData = {
    title,
    description,
    status: options.status,
    priority: options.priority,
    estimated_hours: options.estimatedHours,
    dependencies: []
  };
  
  // 依存関係の処理
  if (options.dependencies) {
    const deps = options.dependencies.split(',').map(d => d.trim());
    taskData.dependencies = deps.map(taskId => ({
      task_id: taskId,
      type: 'strong'
    }));
  }
  
  const result = await integrationManager.createTask(taskData);
  
  if (result.error) {
    console.error(colors.red('タスク作成エラー:'), result.error);
    return;
  }
  
  console.log(colors.green('タスクを作成しました:'));
  console.log(colors.yellow('タスクID:'), result.id);
  console.log(colors.yellow('タイトル:'), result.title);
  console.log(colors.yellow('説明:'), result.description);
  console.log(colors.yellow('状態:'), result.status);
  console.log(colors.yellow('優先度:'), result.priority);
}

/**
 * タスク状態を更新
 * @param {string} taskId - タスクID
 * @param {string} status - 新しい状態
 * @param {number} progress - 進捗率
 */
async function updateTask(taskId, status, progress) {
  console.log(colors.cyan('タスク状態を更新します...'), taskId);
  
  const result = await integrationManager.updateTaskStatus(taskId, status, progress);
  
  if (result.error) {
    console.error(colors.red('タスク更新エラー:'), result.error);
    return;
  }
  
  console.log(colors.green('タスク状態を更新しました:'));
  console.log(colors.yellow('タスクID:'), result.id);
  console.log(colors.yellow('状態:'), result.status);
  console.log(colors.yellow('進捗率:'), result.progress_percentage);
  console.log(colors.yellow('進捗状態:'), result.progress_state);
}

/**
 * フィードバックを収集
 * @param {string} taskId - タスクID
 * @param {string} testCommand - テストコマンド
 */
async function collectFeedback(taskId, testCommand) {
  console.log(colors.cyan('フィードバックを収集します...'), taskId);
  console.log(colors.cyan('テストコマンド:'), testCommand);
  
  const result = await integrationManager.collectFeedback(taskId, testCommand);
  
  if (result.error) {
    console.error(colors.red('フィードバック収集エラー:'), result.error);
    return;
  }
  
  console.log(colors.green('フィードバックを収集しました:'));
  console.log(colors.yellow('タスクID:'), result.feedback_loop.task_id);
  
  const verificationResults = result.feedback_loop.verification_results;
  console.log(colors.yellow('テスト結果:'), verificationResults.passes_tests ? colors.green('成功') : colors.red('失敗'));
  
  if (verificationResults.test_summary) {
    const summary = verificationResults.test_summary;
    console.log(colors.yellow('テスト概要:'), `合計: ${summary.total}, 成功: ${summary.passed}, 失敗: ${summary.failed}, スキップ: ${summary.skipped}`);
  }
  
  // 失敗したテストがある場合は表示
  if (verificationResults.failed_tests && verificationResults.failed_tests.length > 0) {
    console.log(colors.yellow('\n失敗したテスト:'));
    for (const test of verificationResults.failed_tests) {
      console.log(`- ${test.test_name}: ${test.error}`);
    }
  }
  
  // 提案がある場合は表示
  if (verificationResults.suggestions && verificationResults.suggestions.length > 0) {
    console.log(colors.yellow('\n提案:'));
    for (const suggestion of verificationResults.suggestions) {
      if (typeof suggestion === 'string') {
        console.log(`- ${suggestion}`);
      } else {
        console.log(`- [${suggestion.type || 'その他'}] ${suggestion.content}`);
      }
    }
  }
}

/**
 * フィードバックを解決
 * @param {string} feedbackId - フィードバックID
 */
async function resolveFeedback(feedbackId) {
  console.log(colors.cyan('フィードバックを解決します...'), feedbackId);
  
  const result = await integrationManager.resolveFeedback(feedbackId);
  
  if (result.error) {
    console.error(colors.red('フィードバック解決エラー:'), result.error);
    return;
  }
  
  console.log(colors.green('フィードバックを解決しました:'));
  console.log(colors.yellow('フィードバックID:'), result.feedback_loop.task_id);
  console.log(colors.yellow('ステータス:'), result.feedback_loop.feedback_status);
  
  const verificationResults = result.feedback_loop.verification_results;
  console.log(colors.yellow('テスト結果:'), verificationResults.passes_tests ? colors.green('成功') : colors.red('失敗'));
}

/**
 * コンポーネント間の同期を実行
 */
async function syncComponents() {
  console.log(colors.cyan('コンポーネント間の同期を実行します...'));
  
  const result = await integrationManager.syncComponents();
  
  if (result === true) {
    console.log(colors.green('コンポーネント間の同期が完了しました'));
  } else {
    console.error(colors.red('同期中にエラーが発生しました'));
  }
}

/**
 * レポートを生成
 * @param {string} reportType - レポートタイプ
 * @param {Object} options - レポートオプション
 */
async function generateReport(reportType, options) {
  console.log(colors.cyan('レポートを生成します...'), reportType);
  
  const reportOptions = {
    format: options.format || 'text',
    noCache: options.noCache || false
  };
  
  const report = await integrationManager.generateReport(reportType, reportOptions);
  
  if (typeof report === 'object' && report.error) {
    console.error(colors.red('レポート生成エラー:'), report.error);
    return;
  }
  
  // 出力ファイルが指定されている場合はファイルに保存
  if (options.output) {
    fs.writeFileSync(options.output, report, 'utf8');
    console.log(colors.green('レポートを保存しました:'), options.output);
  } else {
    // 標準出力に表示
    console.log(report);
  }
}

/**
 * ワークフロー状態を取得
 */
async function getWorkflowStatus() {
  console.log(colors.cyan('ワークフロー状態を取得します...'));
  
  // 現在の状態を取得
  const stateManager = container.get('stateManagerAdapter');
  const currentState = stateManager.getCurrentState();
  console.log(colors.yellow('現在の状態:'), currentState);
  
  // タスク状態の取得
  try {
    const taskManager = container.get('taskManagerAdapter');
    const tasks = await taskManager.getAllTasks();
    
    console.log(colors.yellow('\nタスク状態:'));
    console.log(colors.yellow('プロジェクト:'), tasks.project);
    console.log(colors.yellow('タスク数:'), tasks.decomposed_tasks.length);
    
    const statusCounts = {
      completed: tasks.decomposed_tasks.filter(t => t.status === 'completed').length,
      in_progress: tasks.decomposed_tasks.filter(t => t.status === 'in_progress').length,
      pending: tasks.decomposed_tasks.filter(t => t.status === 'pending').length,
      blocked: tasks.decomposed_tasks.filter(t => t.status === 'blocked').length
    };
    
    console.log(colors.yellow('タスク状態カウント:'));
    console.log(`- 完了: ${statusCounts.completed}`);
    console.log(`- 進行中: ${statusCounts.in_progress}`);
    console.log(`- 保留中: ${statusCounts.pending}`);
    console.log(`- ブロック中: ${statusCounts.blocked}`);
    
    if (tasks.current_focus) {
      const focusTask = tasks.decomposed_tasks.find(t => t.id === tasks.current_focus);
      if (focusTask) {
        console.log(colors.yellow('\n現在のフォーカス:'));
        console.log(`- ${focusTask.id}: ${focusTask.title}`);
        console.log(`  状態: ${focusTask.status}, 進捗率: ${focusTask.progress_percentage}%`);
      }
    }
  } catch (error) {
    console.error(colors.red('タスク状態の取得に失敗しました:'), error.message);
  }
  
  // セッション状態の取得
  try {
    const sessionManager = container.get('sessionManager');
    const session = await sessionManager.getLatestSession();
    
    if (session) {
      console.log(colors.yellow('\nセッション状態:'));
      console.log(colors.yellow('セッションID:'), session.session_id);
      console.log(colors.yellow('タイムスタンプ:'), session.session_handover.session_timestamp);
      
      if (session.session_handover.previous_session_id) {
        console.log(colors.yellow('前回のセッションID:'), session.session_handover.previous_session_id);
      }
    } else {
      console.log(colors.yellow('\nアクティブなセッションはありません'));
    }
  } catch (error) {
    console.error(colors.red('セッション状態の取得に失敗しました:'), error.message);
  }
}

/**
 * インタラクティブモードを開始
 */
async function startInteractiveMode() {
  console.log(colors.cyan('インタラクティブモードを開始します...'));
  console.log(colors.cyan('終了するには "exit" または "quit" と入力してください'));
  
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: colors.green('knoa> ')
  });
  
  rl.prompt();
  
  rl.on('line', async (line) => {
    const input = line.trim();
    
    if (input === 'exit' || input === 'quit') {
      rl.close();
      return;
    }
    
    const args = input.split(' ');
    const command = args.shift();
    
    try {
      switch (command) {
        case 'help':
          console.log(colors.cyan('\n利用可能なコマンド:'));
          console.log('  status - ワークフロー状態の取得');
          console.log('  init <project-id> <request> - ワークフローの初期化');
          console.log('  start-session [previous-session-id] - セッションの開始');
          console.log('  end-session [session-id] - セッションの終了');
          console.log('  create-task <title> <description> - タスクの作成');
          console.log('  update-task <task-id> <status> [progress] - タスクの更新');
          console.log('  collect-feedback <task-id> <test-command> - フィードバックの収集');
          console.log('  resolve-feedback <feedback-id> - フィードバックの解決');
          console.log('  sync - コンポーネントの同期');
          console.log('  report <type> - レポートの生成');
          console.log('  exit, quit - インタラクティブモードの終了');
          break;
        
        case 'status':
          await getWorkflowStatus();
          break;
        
        case 'init':
          if (args.length < 2) {
            console.error(colors.red('使用方法: init <project-id> <request>'));
            break;
          }
          await initializeWorkflow(args[0], args.slice(1).join(' '));
          break;
        
        case 'start-session':
          await startSession(args[0]);
          break;
        
        case 'end-session':
          await endSession(args[0]);
          break;
        
        case 'create-task':
          if (args.length < 2) {
            console.error(colors.red('使用方法: create-task <title> <description>'));
            break;
          }
          await createTask(args[0], args.slice(1).join(' '), {
            status: 'pending',
            priority: 3,
            estimatedHours: 1
          });
          break;
        
        case 'update-task':
          if (args.length < 2) {
            console.error(colors.red('使用方法: update-task <task-id> <status> [progress]'));
            break;
          }
          await updateTask(args[0], args[1], args[2] ? parseInt(args[2], 10) : undefined);
          break;
        
        case 'collect-feedback':
          if (args.length < 2) {
            console.error(colors.red('使用方法: collect-feedback <task-id> <test-command>'));
            break;
          }
          await collectFeedback(args[0], args.slice(1).join(' '));
          break;
        
        case 'resolve-feedback':
          if (args.length < 1) {
            console.error(colors.red('使用方法: resolve-feedback <feedback-id>'));
            break;
          }
          await resolveFeedback(args[0]);
          break;
        
        case 'sync':
          await syncComponents();
          break;
        
        case 'report':
          if (args.length < 1) {
            console.error(colors.red('使用方法: report <type>'));
            break;
          }
          await generateReport(args[0], {
            format: 'text'
          });
          break;
        
        default:
          console.error(colors.red('不明なコマンド:'), command);
          console.log('ヘルプを表示するには "help" と入力してください');
      }
    } catch (error) {
      console.error(colors.red('エラーが発生しました:'), error.message);
    }
    
    rl.prompt();
  }).on('close', () => {
    console.log(colors.cyan('インタラクティブモードを終了します'));
    process.exit(0);
  });
  
  return new Promise((resolve) => {
    rl.on('close', resolve);
  });
}

// メイン処理
async function main() {
  await executeCommand(argv._[0], argv);
}

main().catch(console.error);