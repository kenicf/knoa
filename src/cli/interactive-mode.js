const { ApplicationError } = require('../lib/core/error-framework');
const { emitErrorEvent } = require('../lib/utils/error-helpers');
const readline = require('readline');
const colors = require('colors/safe'); // 色付けのため

/**
 * CLIのインタラクティブモードを管理するクラス
 */
class CliInteractiveMode {
  /**
   * @param {object} options - オプション
   * @param {object} options.logger - Loggerインスタンス (必須)
   * @param {object} options.eventEmitter - EventEmitterインスタンス (必須)
   * @param {object} options.cliFacade - CliFacadeインスタンス (必須、コマンド実行用)
   * @param {object} options.errorHandler - エラーハンドラー (オプション)
   */
  constructor(options = {}) {
    // 必須依存関係のチェック
    const requiredDependencies = ['logger', 'eventEmitter', 'cliFacade'];
    for (const dep of requiredDependencies) {
      if (!options[dep]) {
        throw new ApplicationError(
          `CliInteractiveMode requires ${dep} instance.`
        );
      }
    }

    this.logger = options.logger;
    this.eventEmitter = options.eventEmitter;
    this.facade = options.cliFacade; // コマンド実行のために Facade を保持
    this.errorHandler = options.errorHandler;
    this.rl = null; // readline インターフェース

    this.logger.debug('CliInteractiveMode initialized');
  }

  /**
   * インタラクティブモードを開始する
   * @returns {Promise<void>} モード終了時に解決される Promise
   */
  async start() {
    const operation = 'startInteractiveMode';
    this.logger.info('Starting interactive mode...', { operation });
    await this.eventEmitter.emitStandardizedAsync(
      'cli_interactive',
      `${operation}_before`
    );

    console.log(colors.cyan('インタラクティブモードを開始します...'));
    console.log(
      colors.cyan('終了するには "exit" または "quit" と入力してください')
    );
    console.log(
      colors.cyan('利用可能なコマンドを表示するには "help" と入力してください')
    );

    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: colors.green('knoa> '),
    });

    this.rl.prompt();

    return new Promise((resolve, reject) => {
      this.rl.on('line', async (line) => {
        const input = line.trim();

        if (input === 'exit' || input === 'quit') {
          this.rl.close();
          return;
        }

        if (input === 'help') {
          this._displayHelp();
          this.rl.prompt();
          return;
        }

        if (!input) {
          // 空行の場合はプロンプト再表示
          this.rl.prompt();
          return;
        }

        // 入力をコマンドと引数に分割 (簡易的なパース)
        // TODO: yargs のようなより堅牢なパーサーを使うか検討
        const argsArray = input.match(/(?:[^\s"]+|"[^"]*")+/g) || [];
        const command = argsArray.shift()?.replace(/"/g, ''); // ダブルクォート除去
        const parsedArgs = this._parseArgs(argsArray); // 簡易的な引数オブジェクト生成

        if (!command) {
          this.rl.prompt();
          return;
        }

        try {
          // CliFacade を通じてコマンドを実行
          const result = await this.facade.execute(command, parsedArgs);
          // 結果を整形して表示 (コマンドごとに調整が必要)
          this._displayResult(command, result);
        } catch (error) {
          // Facade で捕捉されたエラーを表示
          console.error(colors.red('エラー:'), error.message || error);
          // 必要であればエラーの詳細も表示
          if (error.context) {
            console.error(
              colors.red('詳細:'),
              JSON.stringify(error.context, null, 2)
            );
          }
          // エラーイベントは Facade 内で発行済み
        } finally {
          this.rl.prompt();
        }
      });

      this.rl.on('close', async () => {
        this.logger.info('Interactive mode ended.', { operation });
        await this.eventEmitter.emitStandardizedAsync(
          'cli_interactive',
          `${operation}_after`
        );
        console.log(colors.cyan('\nインタラクティブモードを終了します'));
        resolve(); // モード終了時に Promise を解決
      });

      // エラーハンドリング (readline 自体のエラーなど)
      this.rl.on('error', (error) => {
        // ApplicationError のコンストラクタシグネチャ (message, options) に合わせる
        const cliError = new ApplicationError('Readline interface error', {
          // options オブジェクト
          cause: error, // 元のエラーを cause に設定
          code: 'ERR_CLI_READLINE',
        });
        emitErrorEvent(
          this.eventEmitter,
          this.logger,
          'CliInteractiveMode',
          operation,
          cliError
        );
        console.error(colors.red('インタフェースエラー:'), error);
        if (this.errorHandler) {
          this.errorHandler.handle(cliError, 'CliInteractiveMode', operation);
        }
        reject(cliError); // モード終了時に Promise を拒否
      });
    });
  }

  /**
   * ヘルプメッセージを表示する内部ヘルパー
   * @private
   */
  _displayHelp() {
    console.log(colors.cyan('\n利用可能なコマンド:'));
    // TODO: CliFacade が持つコマンドリストから動的に生成する方が望ましい
    // 現状は integration.js の yargs 定義と同期させる必要がある
    console.log(colors.yellow('  Workflow:'));
    console.log('    init <project-id> <request> - ワークフローの初期化');
    console.log('    status - ワークフロー状態の取得');
    console.log(colors.yellow('\n  Session Management:'));
    console.log('    start-session [previous-session-id] - セッションの開始');
    console.log(
      '    end-session [session-id] - セッションの終了 (引数なしで最新)'
    );
    console.log('    list-sessions - セッション一覧を表示');
    console.log('    current-session - 現在のセッションを表示');
    console.log('    session-info <session-id> - セッション情報を表示');
    console.log(
      '    export-session <session-id> [path] - セッション情報をエクスポート'
    );
    console.log('    import-session <path> - セッション情報をインポート');
    console.log(colors.yellow('\n  Task Management:'));
    console.log(
      '    create-task <title> <description> [options] - タスクの作成'
    );
    console.log(
      '      options: --status, --priority, --estimated-hours, --dependencies'
    );
    console.log(
      '    update-task <task-id> <status> [progress] - タスク状態/進捗を更新'
    );
    console.log('    list-tasks - タスク一覧を表示');
    console.log('    task-info <task-id> - タスク情報を表示');
    console.log(
      '    update-task-progress <task-id> <progress> - タスク進捗を更新'
    );
    console.log('    delete-task <task-id> - タスクを削除');
    console.log(
      '    link-task-commit <task-id> <commit-hash> - タスクにGitコミットを関連付け'
    );
    console.log('    export-task <task-id> [path] - タスク情報をエクスポート');
    console.log('    import-task <path> - タスク情報をインポート');
    console.log(colors.yellow('\n  Feedback Loop:'));
    console.log(
      '    collect-feedback <task-id> <test-command> - フィードバックの収集'
    );
    console.log('    resolve-feedback <feedback-id> - フィードバックの解決');
    console.log('    feedback-status <task-id> - フィードバックの状態を表示');
    console.log('    reopen-feedback <task-id> - フィードバックを再オープン');
    console.log(
      '    report-feedback <task-id> [outputPath] - フィードバックレポートを生成'
    );
    console.log(
      '    prioritize-feedback <task-id> - フィードバックの優先順位付け'
    );
    console.log(
      '    link-feedback-commit <task-id> <commit-hash> - フィードバックにGitコミットを関連付け'
    );
    console.log(
      '    link-feedback-session <task-id> <sessionId> - フィードバックにセッションを関連付け'
    );
    console.log(
      '    integrate-feedback-task <task-id> - フィードバックをタスクに統合'
    );
    console.log(
      '    integrate-feedback-session <task-id> <sessionId> - フィードバックをセッションに統合'
    );
    console.log(colors.yellow('\n  Other:'));
    console.log('    sync - コンポーネントの同期');
    console.log('    report <type> [options] - レポートの生成');
    console.log('      options: --format, --output, --no-cache');
    console.log('    help - このヘルプメッセージを表示');
    console.log('    exit, quit - インタラクティブモードの終了');
  }

  /**
   * コマンド実行結果を表示する内部ヘルパー (要改善)
   * @param {string} command - 実行されたコマンド
   * @param {*} result - コマンドの実行結果
   * @private
   */
  _displayResult(command, result) {
    if (result === undefined || result === null) {
      console.log(colors.green(`${command} コマンドが正常に完了しました。`));
      return;
    }

    // 特定コマンドの結果を整形して表示
    if (command === 'status') {
      this._displayStatusResult(result);
    } else if (command === 'list-sessions') {
      this._displaySessionListResult(result);
    } else if (command === 'list-tasks') {
      this._displayTaskListResult(result);
    } else if (command === 'current-session' || command === 'session-info') {
      this._displaySessionInfoResult(result);
    } else if (command === 'task-info') {
      this._displayTaskInfoResult(result);
    } else if (command === 'feedback-status') {
      this._displayFeedbackStatusResult(result);
    } else if (typeof result === 'object') {
      // その他のオブジェクト結果は JSON で表示
      console.log(colors.yellow('結果:'), JSON.stringify(result, null, 2));
    } else {
      // 文字列などの結果はそのまま表示
      console.log(colors.yellow('結果:'), result);
    }
  }

  // --- 結果表示ヘルパー (integration.js から移植・調整) ---

  _displayStatusResult(statusInfo) {
    console.log(colors.yellow('現在の状態:'), statusInfo.currentState);
    console.log(colors.yellow('\nタスク状態:'));
    console.log(`  タスク数: ${statusInfo.tasks.count}`);
    console.log(colors.yellow('  状態別カウント:'));
    console.log(`    完了: ${statusInfo.tasks.statusCounts.completed || 0}`);
    console.log(
      `    進行中: ${statusInfo.tasks.statusCounts.in_progress || 0}`
    );
    console.log(`    保留中: ${statusInfo.tasks.statusCounts.pending || 0}`);
    console.log(
      `    ブロック中: ${statusInfo.tasks.statusCounts.blocked || 0}`
    );
    if (statusInfo.tasks.currentFocus) {
      const focus = statusInfo.tasks.currentFocus;
      console.log(colors.yellow('\n  現在のフォーカス:'));
      console.log(`    - ${focus.id}: ${focus.title}`);
      console.log(`      状態: ${focus.status}, 進捗率: ${focus.progress}%`);
    }
    if (statusInfo.session) {
      console.log(colors.yellow('\nセッション状態:'));
      console.log(`  セッションID: ${statusInfo.session.id}`);
      console.log(`  タイムスタンプ: ${statusInfo.session.timestamp}`);
      if (statusInfo.session.previousSessionId) {
        console.log(
          `  前回のセッションID: ${statusInfo.session.previousSessionId}`
        );
      }
    } else {
      console.log(colors.yellow('\nアクティブなセッションはありません'));
    }
  }

  _displaySessionListResult(sessions) {
    if (!sessions || sessions.length === 0) {
      console.log(colors.yellow('セッションが見つかりません'));
      return;
    }
    console.log(colors.green(`\n${sessions.length}件のセッション:`));
    sessions.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    sessions.forEach((session, index) => {
      const status = session.ended_at
        ? colors.red('終了')
        : colors.green('アクティブ');
      console.log(
        `${index + 1}. ${colors.yellow(session.session_id)} [${status}]`
      );
      console.log(`   作成: ${session.created_at}`);
      if (session.ended_at) console.log(`   終了: ${session.ended_at}`);
    });
  }

  _displayTaskListResult(tasksResult) {
    const tasks = tasksResult?.decomposed_tasks || [];
    if (tasks.length === 0) {
      console.log(colors.yellow('タスクが見つかりません'));
      return;
    }
    console.log(colors.green(`\n${tasks.length}件のタスク:`));
    const groupedTasks = tasks.reduce((groups, task) => {
      (groups[task.status] = groups[task.status] || []).push(task);
      return groups;
    }, {});

    const displayGroup = (title, group, colorFunc = colors.white) => {
      if (group && group.length > 0) {
        console.log(colorFunc(`\n${title}:`));
        group.forEach((task, index) => {
          let line = `${index + 1}. ${colors.yellow(task.id)}: ${task.title}`;
          if (task.status === 'in_progress') {
            line += ` (${task.progress_percentage || 0}%)`;
          }
          console.log(line);
        });
      }
    };

    displayGroup('進行中のタスク', groupedTasks.in_progress, colors.green);
    displayGroup('保留中のタスク', groupedTasks.pending, colors.yellow);
    displayGroup('完了したタスク', groupedTasks.completed, colors.blue);
    displayGroup('ブロックされたタスク', groupedTasks.blocked, colors.red);
  }

  _displaySessionInfoResult(session) {
    if (!session) {
      console.log(colors.yellow('セッション情報が見つかりません。'));
      return;
    }
    console.log(colors.yellow(`\nセッション情報 (${session.session_id}):`));
    console.log(`  作成日時: ${session.created_at}`);
    console.log(`  終了日時: ${session.ended_at || '未終了'}`);
    if (session.previous_session_id) {
      console.log(`  前回のセッションID: ${session.previous_session_id}`);
    }
    // 必要に応じて session_handover の内容も表示
    if (session.session_handover) {
      console.log(colors.yellow('  引継ぎ情報:'));
      console.log(`    プロジェクトID: ${session.session_handover.project_id}`);
      console.log(
        `    タイムスタンプ: ${session.session_handover.session_timestamp}`
      );
      // サマリーなども表示可能
    }
  }

  _displayTaskInfoResult(task) {
    if (!task) {
      console.log(colors.yellow('タスク情報が見つかりません。'));
      return;
    }
    console.log(colors.yellow(`\nタスク情報 (${task.id}):`));
    console.log(`  タイトル: ${task.title}`);
    console.log(`  説明: ${task.description}`);
    console.log(`  状態: ${task.status}`);
    console.log(`  優先度: ${task.priority}`);
    console.log(`  進捗率: ${task.progress_percentage || 0}%`);
    if (task.estimated_hours) {
      console.log(`  見積もり時間: ${task.estimated_hours} 時間`);
    }
    if (task.dependencies && task.dependencies.length > 0) {
      console.log(
        `  依存関係: ${task.dependencies.map((d) => d.task_id).join(', ')}`
      );
    }
    if (task.git_commits && task.git_commits.length > 0) {
      console.log(`  関連コミット: ${task.git_commits.join(', ')}`);
    }
    console.log(`  作成日時: ${task.created_at}`);
    console.log(`  更新日時: ${task.updated_at}`);
  }

  _displayFeedbackStatusResult(feedback) {
    if (!feedback || !feedback.feedback_loop) {
      console.log(colors.yellow('フィードバック情報が見つかりません。'));
      return;
    }
    const loop = feedback.feedback_loop;
    console.log(
      colors.yellow(`\nフィードバック状態 (タスク: ${loop.task_id}):`)
    );
    console.log(`  状態: ${loop.feedback_status || 'N/A'}`);
    console.log(
      `  テスト結果: ${loop.verification_results?.passes_tests ? colors.green('成功') : colors.red('失敗')}`
    );
    if (loop.verification_results?.details) {
      console.log(`  詳細: ${loop.verification_results.details}`);
    }
    if (loop.analysis_results?.summary) {
      console.log(`  分析サマリー: ${loop.analysis_results.summary}`);
    }
    if (loop.related_commits && loop.related_commits.length > 0) {
      console.log(`  関連コミット: ${loop.related_commits.join(', ')}`);
    }
    if (loop.related_sessions && loop.related_sessions.length > 0) {
      console.log(`  関連セッション: ${loop.related_sessions.join(', ')}`);
    }
    console.log(`  最終更新: ${loop.updated_at}`);
  }

  /**
   * 簡易的な引数パーサー (yargs の代替)
   * @param {Array<string>} argsArray - コマンドラインから分割された引数の配列
   * @returns {object} パースされた引数オブジェクト
   * @private
   */
  _parseArgs(argsArray) {
    const args = { _: [] };
    let currentOption = null;
    let expectingValue = false; // オプションの値を期待しているか

    for (let i = 0; i < argsArray.length; i++) {
      const arg = argsArray[i];
      const cleanArg = arg.replace(/^"|"$/g, ''); // 前後のダブルクォートを除去

      if (arg.startsWith('--')) {
        const parts = arg.substring(2).split('=');
        const optionName = parts[0];
        const camelCaseName = optionName.replace(/-([a-z])/g, (g) =>
          g[1].toUpperCase()
        );

        if (parts.length > 1) {
          // --option=value 形式
          args[camelCaseName] = parts[1].replace(/^"|"$/g, '');
          expectingValue = false;
          currentOption = null;
        } else {
          // --option 形式 (フラグまたは値が続く)
          args[camelCaseName] = true; // デフォルトはフラグ
          expectingValue = true; // 次が値の可能性
          currentOption = camelCaseName;
        }
      } else if (arg.startsWith('-')) {
        // 短いオプション (例: -v) - 簡単なフラグとしてのみ扱う
        const flags = arg.substring(1);
        for (const flag of flags) {
          // ここでは長いオプション名へのマッピングは行わない
          // 必要であれば yargs のようなライブラリを使う
          args[flag] = true;
        }
        expectingValue = false;
        currentOption = null;
      } else if (expectingValue && currentOption) {
        // 前の引数が --option 形式で、これがその値
        args[currentOption] = cleanArg;
        expectingValue = false;
        currentOption = null;
      } else {
        // 位置引数
        args._.push(cleanArg);
        expectingValue = false; // 位置引数の後はオプション値を期待しない
        currentOption = null;
      }
    }

    // 位置引数の意味付けは削除し、CliFacade 側で行う
    // 例: args._[0] が taskId か title かはコマンドによって異なる

    return args;
  }
}

module.exports = CliInteractiveMode;
