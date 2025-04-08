/**
 * 統合マネージャーCLI (リファクタリング版)
 *
 * 各種CLI操作のエントリーポイント。コマンドを解析し、CliFacadeに処理を委譲する。
 */

const colors = require('colors/safe');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');

// 初期化処理と表示関数をインポート
const { bootstrap } = require('./bootstrap'); // bootstrap 関数をインポート
const { displayResult } = require('./display'); // 表示用関数をインポート

// CliFacade は runCommand で必要
const CliFacade = require('./facade'); // Facade は必要

// initializeContainerAndComponents 関数は bootstrap.js に移動

/**
 * コマンドライン引数を解析する
 * @param {Array<string>} processArgv - process.argv
 * @returns {object} 解析された引数オブジェクト (yargs の argv)
 */
function parseArguments(processArgv) {
  return (
    yargs(hideBin(processArgv))
      .usage('使用方法: $0 <コマンド> [オプション]')
      // --- Workflow ---
      .command(
        'init <project-id> <request>',
        'ワークフローの初期化',
        (yargs) => {
          return yargs
            .positional('project-id', {
              describe: 'プロジェクトID',
              type: 'string',
            })
            .positional('request', {
              describe: '元のリクエスト',
              type: 'string',
            });
        }
      )
      .command('status', 'ワークフロー状態の取得')
      // --- Session ---
      .command(
        'start-session [previous-session-id]',
        'セッションの開始',
        (yargs) => {
          return yargs.positional('previous-session-id', {
            describe: '前回のセッションID',
            type: 'string',
          });
        }
      )
      .command(
        'end-session [session-id]',
        'セッションの終了 (引数なしで最新)',
        (yargs) => {
          return yargs.positional('session-id', {
            describe: 'セッションID',
            type: 'string',
          });
        }
      )
      .command('list-sessions', 'セッション一覧を表示')
      .command('current-session', '現在のセッションを表示')
      .command('session-info <session-id>', 'セッション情報を表示', (yargs) => {
        return yargs.positional('session-id', {
          describe: 'セッションID',
          type: 'string',
        });
      })
      .command(
        'export-session <session-id> [path]',
        'セッション情報をエクスポート',
        (yargs) => {
          return yargs
            .positional('session-id', {
              describe: 'セッションID',
              type: 'string',
            })
            .positional('path', {
              describe: '出力ファイルパス',
              type: 'string',
            });
        }
      )
      .command(
        'import-session <path>',
        'セッション情報をインポート',
        (yargs) => {
          return yargs.positional('path', {
            describe: '入力ファイルパス',
            type: 'string',
          });
        }
      )
      // --- Task ---
      .command('create-task <title> <description>', 'タスクの作成', (yargs) => {
        return yargs
          .positional('title', { describe: 'タスクタイトル', type: 'string' })
          .positional('description', { describe: 'タスク説明', type: 'string' })
          .option('status', {
            describe: 'タスク状態',
            type: 'string',
            choices: ['pending', 'in_progress', 'completed', 'blocked'],
            default: 'pending',
          })
          .option('priority', {
            describe: '優先度',
            type: 'number',
            choices: [1, 2, 3, 4, 5],
            default: 3,
          })
          .option('estimated-hours', {
            describe: '見積もり時間',
            type: 'number',
          }) // default は CliTaskManager で設定
          .option('dependencies', {
            describe: '依存タスクID（カンマ区切り）',
            type: 'string',
          });
      })
      .command(
        'update-task <task-id> <status> [progress]',
        'タスク状態/進捗を更新',
        (yargs) => {
          return yargs
            .positional('task-id', { describe: 'タスクID', type: 'string' })
            .positional('status', {
              describe: 'タスク状態',
              type: 'string',
              choices: ['pending', 'in_progress', 'completed', 'blocked'],
            })
            .positional('progress', {
              describe: '進捗率（0-100）',
              type: 'number',
            });
        }
      )
      .command('list-tasks', 'タスク一覧を表示')
      .command('task-info <task-id>', 'タスク情報を表示', (yargs) => {
        return yargs.positional('task-id', {
          describe: 'タスクID',
          type: 'string',
        });
      })
      .command(
        'update-task-progress <task-id> <progress>',
        'タスク進捗を更新',
        (yargs) => {
          return yargs
            .positional('task-id', { describe: 'タスクID', type: 'string' })
            .positional('progress', {
              describe: '進捗率（0-100）',
              type: 'number',
            });
        }
      )
      .command('delete-task <task-id>', 'タスクを削除', (yargs) => {
        return yargs.positional('task-id', {
          describe: 'タスクID',
          type: 'string',
        });
      })
      .command(
        'link-task-commit <task-id> <commit-hash>',
        'タスクにGitコミットを関連付け',
        (yargs) => {
          return yargs
            .positional('task-id', { describe: 'タスクID', type: 'string' })
            .positional('commit-hash', {
              describe: 'コミットハッシュ',
              type: 'string',
            });
        }
      )
      .command(
        'export-task <task-id> [path]',
        'タスク情報をエクスポート',
        (yargs) => {
          return yargs
            .positional('task-id', { describe: 'タスクID', type: 'string' })
            .positional('path', {
              describe: '出力ファイルパス',
              type: 'string',
            });
        }
      )
      .command('import-task <path>', 'タスク情報をインポート', (yargs) => {
        return yargs.positional('path', {
          describe: '入力ファイルパス',
          type: 'string',
        });
      })
      // --- Feedback ---
      .command(
        'collect-feedback <task-id> <test-command>',
        'フィードバックの収集',
        (yargs) => {
          return yargs
            .positional('task-id', { describe: 'タスクID', type: 'string' })
            .positional('test-command', {
              describe: 'テストコマンド',
              type: 'string',
            });
        }
      )
      .command(
        'resolve-feedback <feedback-id>',
        'フィードバックの解決',
        (yargs) => {
          // feedbackId は taskId のこと？
          return yargs.positional('feedback-id', {
            describe: 'フィードバックID (通常タスクID)',
            type: 'string',
          });
        }
      )
      .command(
        'feedback-status <task-id>',
        'フィードバックの状態を表示',
        (yargs) => {
          return yargs.positional('task-id', {
            describe: 'タスクID',
            type: 'string',
          });
        }
      )
      .command(
        'reopen-feedback <task-id>',
        'フィードバックを再オープン',
        (yargs) => {
          return yargs.positional('task-id', {
            describe: 'タスクID',
            type: 'string',
          });
        }
      )
      .command(
        'report-feedback <task-id> [output-path]',
        'フィードバックレポートを生成',
        (yargs) => {
          return yargs
            .positional('task-id', { describe: 'タスクID', type: 'string' })
            .positional('output-path', {
              describe: '出力ファイルパス',
              type: 'string',
            });
        }
      )
      .command(
        'prioritize-feedback <task-id>',
        'フィードバックの優先順位付け',
        (yargs) => {
          return yargs.positional('task-id', {
            describe: 'タスクID',
            type: 'string',
          });
        }
      )
      .command(
        'link-feedback-commit <task-id> <commit-hash>',
        'フィードバックにGitコミットを関連付け',
        (yargs) => {
          return yargs
            .positional('task-id', { describe: 'タスクID', type: 'string' })
            .positional('commit-hash', {
              describe: 'コミットハッシュ',
              type: 'string',
            });
        }
      )
      .command(
        'link-feedback-session <task-id> <session-id>',
        'フィードバックにセッションを関連付け',
        (yargs) => {
          return yargs
            .positional('task-id', { describe: 'タスクID', type: 'string' })
            .positional('session-id', {
              describe: 'セッションID',
              type: 'string',
            });
        }
      )
      .command(
        'integrate-feedback-task <task-id>',
        'フィードバックをタスクに統合',
        (yargs) => {
          return yargs.positional('task-id', {
            describe: 'タスクID',
            type: 'string',
          });
        }
      )
      .command(
        'integrate-feedback-session <task-id> <session-id>',
        'フィードバックをセッションに統合',
        (yargs) => {
          return yargs
            .positional('task-id', { describe: 'タスクID', type: 'string' })
            .positional('session-id', {
              describe: 'セッションID',
              type: 'string',
            });
        }
      )
      // --- Sync ---
      .command('sync', 'コンポーネントの同期')
      // --- Report ---
      .command('report <type>', 'レポートの生成', (yargs) => {
        return yargs
          .positional('type', {
            describe: 'レポートタイプ',
            type: 'string',
            choices: [
              'task_summary',
              'session_summary',
              'feedback_summary',
              'workflow_status',
              'integration_status',
            ],
          }) // 選択肢を更新
          .option('format', {
            describe: '出力形式',
            type: 'string',
            choices: ['text', 'json', 'markdown'],
            default: 'text',
          })
          .option('output', { describe: '出力ファイルパス', type: 'string' })
          .option('no-cache', {
            describe: 'キャッシュを使用しない',
            type: 'boolean',
            default: false,
          });
      })
      // --- Interactive ---
      .command('interactive', 'インタラクティブモード', {})
      // --- General ---
      .demandCommand(1, 'コマンドを指定してください')
      .help()
      .alias('h', 'help')
      .version()
      .alias('v', 'version')
      .strict()
      .exitProcess(false).argv // exitProcess を argv の前に移動
  ); // 未定義のコマンドやオプションをエラーにする
}

/**
 * 解析された引数に基づいてコマンドを実行する
 * @param {object} argv - 解析された引数オブジェクト
 * @param {CliFacade} cliFacade - CliFacade インスタンス
 * @param {Logger} logger - Logger インスタンス
 */
async function runCommand(argv, cliFacade, logger) {
  // 引数に cliFacade と logger を追加
  const command = argv._[0];

  try {
    // CliFacade を通じてコマンドを実行
    const result = await cliFacade.execute(command, argv);

    // 結果の表示 (displayResult 関数を使用)
    displayResult(command, result);
  } catch (error) {
    // CliFacade からスローされたエラーを最終的にここで捕捉
    // logger は main 関数スコープから渡す必要があるため、ここでは console.error を使用
    console.error(
      colors.red('\nエラーが発生しました:'),
      error.message || error
    );
    if (error.context) {
      console.error(
        colors.red('詳細:'),
        JSON.stringify(error.context, null, 2)
      );
    }
    if (error.cause) {
      console.error(colors.red('原因:'), error.cause.message || error.cause);
    }
    // process.exit(1); // エラー終了 -> エラーをスローするように変更
    throw error; // エラーを再スロー
  }
}

/**
 * メイン処理
 */
async function main() {
  let logger; // logger を main スコープで定義 (エラーハンドリング用)
  try {
    // bootstrap 関数を呼び出して初期化
    const { logger: initializedLogger, cliFacade } = bootstrap();
    logger = initializedLogger; // logger を設定

    const argv = parseArguments(process.argv);
    // runCommand に logger と cliFacade を渡す
    await runCommand(argv, cliFacade, logger);
  } catch (error) {
    // bootstrap や parseArguments でのエラーを捕捉
    // logger が利用可能であれば logger.fatal を使う
    if (logger) {
      logger.fatal('CLI initialization or argument parsing failed:', error);
    } else {
      // logger が利用できない場合は console.error で代替
      console.error(
        'Fatal error during initialization or argument parsing:',
        error
      );
    }
    // 常にコンソールにエラーを出力し、プロセスを終了する
    console.error(colors.red('\n致命的エラーが発生しました:'), error);
    // process.exit(1); -> エラーをスローするように変更
    throw error; // エラーを再スロー
  }
}

// main 関数と parseArguments をエクスポート (テスト用)
module.exports = {
  main,
  parseArguments, // テスト用にエクスポート
  runCommand, // テスト用にエクスポート
  // initializeContainerAndComponents は削除
};

// スクリプトとして直接実行された場合のみ main を実行
if (require.main === module) {
  main().catch((error) => {
    // main 内で捕捉されなかった予期せぬエラー
    // logger が利用可能であれば logger.fatal を使うべきだが、
    // main 実行前の初期化エラーの可能性も考慮し console.error を残す
    console.error(colors.red('\n予期せぬ致命的エラーが発生しました:'), error);
    // process.exit(1); -> エラーをスローするように変更
    // ここでエラーをスローしても、Node.js のデフォルトの動作でプロセスは終了する
    // throw error; // 必要であれば再スロー
  });
}
