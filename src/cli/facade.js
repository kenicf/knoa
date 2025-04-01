const {
  ApplicationError,
  CliError,
  ValidationError,
} = require('../lib/utils/errors'); // ValidationError をインポート
const { emitErrorEvent } = require('../lib/utils/error-helpers'); // エラーイベント発行用

/**
 * CLIコマンドの実行と関連クラスを統合するファサードクラス
 */
class CliFacade {
  /**
   * @param {object} options - オプション
   * @param {object} options.logger - Loggerインスタンス (必須)
   * @param {object} options.eventEmitter - EventEmitterインスタンス (必須)
   * @param {object} options.cliWorkflowManager - CliWorkflowManagerインスタンス (必須)
   * @param {object} options.cliSessionManager - CliSessionManagerインスタンス (必須)
   * @param {object} options.cliTaskManager - CliTaskManagerインスタンス (必須)
   * @param {object} options.cliFeedbackHandler - CliFeedbackHandlerインスタンス (必須)
   * @param {object} options.cliReportGenerator - CliReportGeneratorインスタンス (必須)
   * @param {object} options.cliStatusViewer - CliStatusViewerインスタンス (必須)
   * @param {object} options.cliInteractiveMode - CliInteractiveModeインスタンス (必須)
   * @param {object} options.cliComponentSyncer - CliComponentSyncerインスタンス (必須)
   */
  constructor(options = {}) {
    // 必須依存関係のチェック
    const requiredDependencies = [
      'logger',
      'eventEmitter',
      'cliWorkflowManager',
      'cliSessionManager',
      'cliTaskManager',
      'cliFeedbackHandler',
      'cliReportGenerator',
      'cliStatusViewer',
      'cliInteractiveMode',
      'cliComponentSyncer',
    ];
    for (const dep of requiredDependencies) {
      if (!options[dep]) {
        // コンストラクタでのエラーは ApplicationError のままでも良いか、
        // ConfigurationError などが適切かもしれないが、一旦そのままにする
        throw new ApplicationError(`CliFacade requires ${dep} instance.`);
      }
    }

    this.logger = options.logger;
    this.eventEmitter = options.eventEmitter;
    this.workflowManager = options.cliWorkflowManager;
    this.sessionManager = options.cliSessionManager;
    this.taskManager = options.cliTaskManager;
    this.feedbackHandler = options.cliFeedbackHandler;
    this.reportGenerator = options.cliReportGenerator;
    this.statusViewer = options.cliStatusViewer;
    this.interactiveMode = options.cliInteractiveMode;
    this.componentSyncer = options.cliComponentSyncer;

    this.logger.debug('CliFacade initialized');
  }

  /**
   * コマンドを実行し、対応するマネージャー/ハンドラーに処理を委譲する
   * @param {string} command - 実行するコマンド名
   * @param {object} args - コマンド引数 (yargsでパースされたオブジェクト)
   * @returns {Promise<*>} コマンド実行結果
   * @throws {CliError} コマンドが見つからない場合や実行時エラー
   */
  async execute(command, args) {
    this.logger.info(`Executing command: ${command}`, { args });
    // イベント発行: コマンド実行前
    await this.eventEmitter.emitStandardizedAsync('cli', `${command}_before`, {
      args,
    });

    try {
      let result;
      switch (command) {
        case 'init':
          result = await this.workflowManager.initializeWorkflow(
            args.projectId,
            args.request
          );
          break;
        case 'start-session':
          result = await this.sessionManager.startSession(
            args.previousSessionId
          );
          break;
        case 'end-session':
          result = await this.sessionManager.endSession(args.sessionId);
          break;
        case 'create-task':
          result = await this.taskManager.createTask(
            args.title,
            args.description,
            args
          );
          break;
        case 'update-task':
          result = await this.taskManager.updateTask(
            args.taskId,
            args.status,
            args.progress
          );
          break;
        case 'collect-feedback':
          result = await this.feedbackHandler.collectFeedback(
            args.taskId,
            args.testCommand
          );
          break;
        case 'resolve-feedback':
          result = await this.feedbackHandler.resolveFeedback(args.feedbackId);
          break;
        case 'sync':
          result = await this.componentSyncer.syncComponents();
          break;
        case 'report':
          result = await this.reportGenerator.generateReport(args.type, args);
          break;
        case 'status':
          result = await this.statusViewer.getWorkflowStatus();
          break;
        case 'interactive':
          result = await this.interactiveMode.start();
          break;
        // --- session.js 由来のコマンド ---
        case 'list-sessions': // 'list' から変更
          result = await this.sessionManager.listSessions();
          break;
        case 'current-session': // 'current' から変更
          result = await this.sessionManager.getCurrentSessionInfo();
          break;
        case 'session-info': // 'info' から変更
          result = await this.sessionManager.getSessionInfo(args.sessionId);
          break;
        case 'export-session': // 'export' から変更
          result = await this.sessionManager.exportSession(
            args.sessionId,
            args.path
          );
          break;
        case 'import-session': // 'import' から変更
          result = await this.sessionManager.importSession(args.path);
          break;
        // --- task.js 由来のコマンド ---
        case 'list-tasks': // 'list' から変更
          result = await this.taskManager.listTasks();
          break;
        case 'task-info': // 'info' から変更
          result = await this.taskManager.getTaskInfo(args.taskId);
          break;
        case 'update-task-progress': // 'progress' から変更
          result = await this.taskManager.updateTaskProgress(
            args.taskId,
            args.progress
          );
          break;
        case 'delete-task': // 'delete' から変更
          result = await this.taskManager.deleteTask(args.taskId);
          break;
        case 'link-task-commit': // 'link' から変更
          result = await this.taskManager.linkTaskToCommit(
            args.taskId,
            args.commitHash
          );
          break;
        case 'export-task': // 'export' から変更
          result = await this.taskManager.exportTask(args.taskId, args.path);
          break;
        case 'import-task': // 'import' から変更
          result = await this.taskManager.importTask(args.path);
          break;
        // --- feedback.js 由来のコマンド (一部は integration.js と重複) ---
        case 'feedback-status': // 'status' から変更
          result = await this.feedbackHandler.getFeedbackStatus(args.taskId);
          break;
        case 'reopen-feedback': // 'reopen' から変更
          result = await this.feedbackHandler.reopenFeedback(args.taskId);
          break;
        case 'report-feedback': // 'report' から変更
          result = await this.feedbackHandler.generateFeedbackReport(
            args.taskId,
            args.outputPath
          );
          break;
        case 'prioritize-feedback': // 'prioritize' から変更
          result = await this.feedbackHandler.prioritizeFeedback(args.taskId);
          break;
        case 'link-feedback-commit': // 'link-git' から変更
          result = await this.feedbackHandler.linkFeedbackToCommit(
            args.taskId,
            args.commitHash
          );
          break;
        case 'link-feedback-session': // 'link-session' から変更
          result = await this.feedbackHandler.linkFeedbackToSession(
            args.taskId,
            args.sessionId
          );
          break;
        case 'integrate-feedback-task': // 'integrate-task' から変更
          result = await this.feedbackHandler.integrateFeedbackWithTask(
            args.taskId
          );
          break;
        case 'integrate-feedback-session': // 'integrate-session' から変更
          result = await this.feedbackHandler.integrateFeedbackWithSession(
            args.taskId,
            args.sessionId
          );
          break;

        default:
          // 未知のコマンドエラーは CliError を使用
          throw new CliError(`Unknown command: ${command}`, null, {
            code: 'ERR_CLI_UNKNOWN_COMMAND', // より具体的なコード
            command,
          });
      }

      // イベント発行: コマンド実行後
      await this.eventEmitter.emitStandardizedAsync('cli', `${command}_after`, {
        args,
        result,
      });
      this.logger.info(`Command ${command} executed successfully.`);
      return result;
    } catch (originalError) {
      this.logger.error(`Error executing command ${command}:`, originalError);

      // エラーラップロジック修正
      const cliError =
        originalError instanceof ValidationError || // ValidationError はそのまま
        originalError instanceof CliError // 既に CliError ならそのまま
          ? originalError
          : new CliError( // それ以外は CliError でラップ
              `Command '${command}' failed: ${originalError.message}`,
              originalError, // cause
              {
                // context
                command,
                args,
                originalErrorName: originalError.name,
                // 元のエラーコードを保持する場合 (オプション)
                // originalCode: originalError.code
              }
              // code は CliError のデフォルト 'ERR_CLI' が使用される
            );

      // エラーイベント発行 (ラップしたエラーを使用)
      emitErrorEvent(
        this.eventEmitter,
        this.logger,
        'CliFacade',
        `execute_${command}`,
        cliError, // ラップしたエラーを渡す
        null,
        { args }
      );
      // ラップしたエラーを再スローして上位で処理させる
      throw cliError;
    }
  }
}

module.exports = CliFacade;
