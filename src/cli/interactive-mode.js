const { ApplicationError, CliError } = require('../lib/core/error-framework'); // CliError も core から？ utils かもしれないので要確認 -> utils でした
// const { CliError } = require('../lib/utils/errors'); // CliError は utils から
const { emitErrorEvent } = require('../lib/utils/error-helpers');
const readline = require('readline');
const colors = require('colors/safe');
const { formatResult } = require('./display'); // 整形関数をインポート
// ID生成関数をインポート (EventEmitter から取得するため不要)
// const { generateTraceId, generateRequestId } = require('../lib/utils/id-generators');

/**
 * CLIのインタラクティブモードを管理するクラス
 */
class CliInteractiveMode {
  /**
   * @param {object} options - オプション
   * @param {object} options.logger - Loggerインスタンス (必須)
   * @param {object} options.eventEmitter - EventEmitterインスタンス (必須)
   * @param {object} options.cliFacade - CliFacadeインスタンス (必須、コマンド実行用)
   * @param {object} [options.errorHandler] - エラーハンドラー (オプション)
   * @param {Function} options.traceIdGenerator - トレースID生成関数 (必須)
   * @param {Function} options.requestIdGenerator - リクエストID生成関数 (必須)
   */
  constructor(options = {}) {
    // 分割代入で依存関係を取得
    const {
      logger,
      eventEmitter,
      cliFacade,
      errorHandler, // 任意
      traceIdGenerator,
      requestIdGenerator,
    } = options;

    // 必須依存関係のチェック
    if (!logger)
      throw new ApplicationError(
        'CliInteractiveMode requires logger instance.'
      );
    if (!eventEmitter)
      throw new ApplicationError(
        'CliInteractiveMode requires eventEmitter instance.'
      );
    if (!cliFacade)
      throw new ApplicationError(
        'CliInteractiveMode requires cliFacade instance.'
      );
    if (!traceIdGenerator)
      throw new ApplicationError(
        'CliInteractiveMode requires traceIdGenerator function.'
      );
    if (!requestIdGenerator)
      throw new ApplicationError(
        'CliInteractiveMode requires requestIdGenerator function.'
      );

    this.logger = logger;
    this.eventEmitter = eventEmitter;
    this.facade = cliFacade;
    this.errorHandler = errorHandler; // 任意なのでチェック不要
    this.rl = null; // readline インスタンスは start() で初期化
    this._traceIdGenerator = traceIdGenerator;
    this._requestIdGenerator = requestIdGenerator;

    this.logger.debug('CliInteractiveMode initialized');
  }

  /**
   * 標準化されたイベントを発行する内部ヘルパー
   * @param {string} action - アクション名 (例: 'start_before')
   * @param {object} [data={}] - イベントデータ
   * @param {string} [traceId] - トレースID (指定されなければ生成)
   * @param {string} [requestId] - リクエストID (指定されなければ生成)
   * @returns {Promise<void>}
   * @private
   */
  async _emitEvent(action, data = {}, traceId, requestId) {
    if (
      !this.eventEmitter ||
      typeof this.eventEmitter.emitStandardizedAsync !== 'function'
    ) {
      this.logger.warn(
        `Cannot emit event interactive_${action}: eventEmitter or emitStandardizedAsync is missing.`
      );
      return;
    }
    const finalTraceId = traceId || this._traceIdGenerator();
    const finalRequestId = requestId || this._requestIdGenerator();
    const eventData = {
      ...data,
      traceId: finalTraceId,
      requestId: finalRequestId,
    };
    try {
      // コンポーネント名を 'cli'、アクション名を 'interactive_action' 形式に統一
      await this.eventEmitter.emitStandardizedAsync(
        'cli',
        `interactive_${action}`,
        eventData
      );
    } catch (error) {
      this.logger.warn(`イベント発行中にエラー: cli:interactive_${action}`, {
        error,
      });
    }
  }

  /**
   * エラー処理を行う内部ヘルパー (主に readline のエラー用)
   * @param {Error} error - 発生したエラー
   * @param {string} operation - 操作名
   * @param {object} [context={}] - エラーコンテキスト
   * @returns {*} エラーハンドラーの戻り値、またはエラーを再スロー
   * @throws {CliError|ApplicationError} エラーハンドラーがない場合、またはエラーハンドラーがエラーをスローした場合
   * @private
   */
  _handleError(error, operation, context = {}) {
    // readline エラーは ApplicationError でラップ
    const processedError = new ApplicationError(`Error during ${operation}`, {
      cause: error,
      code: 'ERR_CLI_READLINE', // readline 固有のエラーコード
      ...context,
    });

    emitErrorEvent(
      this.eventEmitter,
      this.logger,
      'CliInteractiveMode',
      operation,
      processedError,
      null,
      context
    );

    console.error(colors.red('インタフェースエラー:'), error); // コンソールにも出力

    if (this.errorHandler) {
      return this.errorHandler.handle(
        processedError,
        'CliInteractiveMode',
        operation,
        context
      );
    } else {
      // エラーハンドラがない場合は、reject するためにエラーをスロー
      throw processedError;
    }
  }

  /**
   * インタラクティブモードを開始する
   * @returns {Promise<void>} モード終了時に解決される Promise
   * @throws {ApplicationError} readline インターフェースのエラー発生時
   */
  async start() {
    const operation = 'startInteractiveMode';
    const traceId = this._traceIdGenerator(); // この操作のトレースID
    const requestId = this._requestIdGenerator(); // この操作のリクエストID
    const opContext = { traceId, requestId }; // ログ用コンテキスト

    await this._emitEvent('start_before', {}, traceId, requestId);
    this.logger.info('Starting interactive mode...', opContext);

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
        const lineTraceId = this._traceIdGenerator(); // 各行処理のトレースID
        const lineRequestId = this._requestIdGenerator(); // 各行処理のリクエストID
        const lineContext = { traceId: lineTraceId, requestId: lineRequestId };

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
          this.rl.prompt();
          return;
        }

        const argsArray = input.match(/(?:[^\s"]+|"[^"]*")+/g) || [];
        const command = argsArray.shift()?.replace(/"/g, '');
        const parsedArgs = this._parseArgs(argsArray);

        if (!command) {
          this.rl.prompt();
          return;
        }

        try {
          this.logger.info(`Executing interactive command: ${command}`, {
            ...lineContext,
            args: parsedArgs,
          });
          // Facade 実行時にトレースIDなどを引き継ぐか検討 (現状は Facade 内で生成)
          const result = await this.facade.execute(command, parsedArgs);
          this._displayResult(command, result); // display.js の formatResult を使うように変更
        } catch (error) {
          // Facade からスローされたエラーを表示 (CliError を想定)
          this.logger.error(`Interactive command failed: ${command}`, {
            ...lineContext,
            error,
          });
          console.error(colors.red('エラー:'), error.message || error);
          if (error.context) {
            console.error(
              colors.red('詳細:'),
              JSON.stringify(error.context, null, 2)
            );
          }
          if (error.cause) {
            console.error(
              colors.red('原因:'),
              error.cause.message || error.cause
            );
          }
          // ここでは _handleError は呼ばない (Facade で処理済みのため)
        } finally {
          this.rl.prompt();
        }
      });

      this.rl.on('close', async () => {
        await this._emitEvent('end_after', {}, traceId, requestId); // イベント名を修正
        this.logger.info('Interactive mode ended.', opContext);
        console.log(colors.cyan('\nインタラクティブモードを終了します'));
        resolve();
      });

      this.rl.on('error', (error) => {
        try {
          // エラーハンドリングをヘルパーに委譲
          this._handleError(error, operation, opContext);
          // エラーハンドラがエラーをスローしない場合も考慮し、reject を呼ぶ
          reject(
            new ApplicationError('Readline interface error', {
              cause: error,
              code: 'ERR_CLI_READLINE',
            })
          );
        } catch (processedError) {
          // _handleError がエラーをスローした場合 (errorHandlerがない場合など)
          reject(processedError);
        }
      });
    });
  }

  /**
   * ヘルプメッセージを表示する内部ヘルパー
   * @private
   */
  _displayHelp() {
    // 実装は変更なし (TODO は残る)
    console.log(colors.cyan('\n利用可能なコマンド:'));
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
   * コマンド実行結果を表示する内部ヘルパー
   * @param {string} command - 実行されたコマンド
   * @param {*} result - コマンドの実行結果
   * @private
   */
  _displayResult(command, result) {
    // display.formatResult を使用して整形された文字列を取得
    const formattedOutput = formatResult(command, result);
    if (formattedOutput !== null) {
      console.log(formattedOutput); // 整形結果を出力
    }
    // 以前の _display*Result ヘルパーは不要になったため削除
  }

  // _displayStatusResult, _displaySessionListResult などは削除

  /**
   * 簡易的な引数パーサー (変更なし)
   * @param {Array<string>} argsArray - コマンドラインから分割された引数の配列
   * @returns {object} パースされた引数オブジェクト
   * @private
   */
  _parseArgs(argsArray) {
    const args = { _: [] };
    let currentOption = null;
    let expectingValue = false;

    for (let i = 0; i < argsArray.length; i++) {
      const arg = argsArray[i];
      const cleanArg = arg.replace(/^"|"$/g, '');

      if (arg.startsWith('--')) {
        const parts = arg.substring(2).split('=');
        const optionName = parts[0];
        const camelCaseName = optionName.replace(/-([a-z])/g, (g) =>
          g[1].toUpperCase()
        );

        if (parts.length > 1) {
          // eslint-disable-next-line security/detect-object-injection
          args[camelCaseName] = parts[1].replace(/^"|"$/g, '');
          expectingValue = false;
          currentOption = null;
        } else {
          // eslint-disable-next-line security/detect-object-injection
          args[camelCaseName] = true;
          expectingValue = true;
          currentOption = camelCaseName;
        }
      } else if (arg.startsWith('-')) {
        const flags = arg.substring(1);
        for (const flag of flags) {
          // eslint-disable-next-line security/detect-object-injection
          args[flag] = true;
        }
        expectingValue = false;
        currentOption = null;
      } else if (expectingValue && currentOption) {
        // eslint-disable-next-line security/detect-object-injection
        args[currentOption] = cleanArg;
        expectingValue = false;
        currentOption = null;
      } else {
        args._.push(cleanArg);
        expectingValue = false;
        currentOption = null;
      }
    }
    return args;
  }
}

module.exports = CliInteractiveMode;
