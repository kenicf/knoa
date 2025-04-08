/**
 * アプリケーションの初期化処理
 * ServiceContainer の設定、依存関係の解決、主要コンポーネントのインスタンス化を行う
 */
const ServiceContainer = require('../lib/core/service-container');
const { registerServices } = require('../lib/core/service-definitions');
const config = require('../config');

// CLIクラス群
const CliFacade = require('./facade');
const CliWorkflowManager = require('./workflow-manager');
const CliSessionManager = require('./session-manager');
const CliTaskManager = require('./task-manager');
const CliFeedbackHandler = require('./feedback-handler');
const CliReportGenerator = require('./report-generator');
const CliStatusViewer = require('./status-viewer');
const CliInteractiveMode = require('./interactive-mode');
const CliComponentSyncer = require('./component-syncer');

/**
 * サービスコンテナとCLIコンポーネントを初期化し、必要なインスタンスを返す
 * @returns {{ logger: Logger, cliFacade: CliFacade }} 初期化されたロガーとCLIファサード
 * @throws {Error} 初期化中にエラーが発生した場合
 */
function bootstrap() {
  try {
    const container = new ServiceContainer();
    registerServices(container, config);

    // 必要なサービスの取得
    const logger = container.get('logger');
    const eventEmitter = container.get('eventEmitter');
    const storageService = container.get('storageService');
    const validator = container.get('validator');
    const integrationManagerAdapter = container.get(
      'integrationManagerAdapter'
    );
    const sessionManagerAdapter = container.get('sessionManagerAdapter');
    const taskManagerAdapter = container.get('taskManagerAdapter');
    const feedbackManagerAdapter = container.get('feedbackManagerAdapter');
    const stateManagerAdapter = container.get('stateManagerAdapter');
    const traceIdGenerator = container.get('traceIdGenerator'); // ID生成関数を取得
    const requestIdGenerator = container.get('requestIdGenerator'); // ID生成関数を取得

    // CLIクラス群のインスタンス化
    const cliWorkflowManager = new CliWorkflowManager({
      logger,
      eventEmitter,
      integrationManagerAdapter,
      stateManagerAdapter,
      traceIdGenerator, // 注入
      requestIdGenerator, // 注入
    });
    const cliSessionManager = new CliSessionManager({
      logger,
      eventEmitter,
      integrationManagerAdapter,
      sessionManagerAdapter,
      storageService,
      traceIdGenerator, // 注入
      requestIdGenerator, // 注入
    });
    const cliTaskManager = new CliTaskManager({
      logger,
      eventEmitter,
      integrationManagerAdapter,
      taskManagerAdapter,
      storageService,
      validator,
      traceIdGenerator, // 注入
      requestIdGenerator, // 注入
    });
    const cliFeedbackHandler = new CliFeedbackHandler({
      logger,
      eventEmitter,
      integrationManagerAdapter,
      feedbackManagerAdapter,
      storageService,
      validator,
      traceIdGenerator, // 注入
      requestIdGenerator, // 注入
    });
    const cliReportGenerator = new CliReportGenerator({
      logger,
      eventEmitter,
      integrationManagerAdapter,
      storageService,
      traceIdGenerator, // 注入
      requestIdGenerator, // 注入
    });
    const cliStatusViewer = new CliStatusViewer({
      logger,
      eventEmitter,
      stateManagerAdapter,
      taskManagerAdapter,
      sessionManagerAdapter,
      traceIdGenerator, // 注入
      requestIdGenerator, // 注入
    });
    const cliComponentSyncer = new CliComponentSyncer({
      logger,
      eventEmitter,
      integrationManagerAdapter,
      traceIdGenerator, // 注入
      requestIdGenerator, // 注入
    });

    // CliFacade のインスタンス化 (CliInteractiveMode は Facade を必要とするため後で)
    const cliFacade = new CliFacade({
      logger,
      eventEmitter,
      cliWorkflowManager,
      cliSessionManager,
      cliTaskManager,
      cliFeedbackHandler,
      cliReportGenerator,
      cliStatusViewer,
      cliComponentSyncer,
      cliInteractiveMode: null, // 後で設定
    });

    // CliInteractiveMode のインスタンス化 (Facade を渡す)
    const cliInteractiveMode = new CliInteractiveMode({
      logger,
      eventEmitter,
      cliFacade,
      traceIdGenerator, // 注入
      requestIdGenerator, // 注入
    });
    // Facade に InteractiveMode インスタンスを設定
    cliFacade.interactiveMode = cliInteractiveMode;

    logger.info('Application bootstrapped successfully.');
    return { logger, cliFacade };
  } catch (error) {
    // 初期化エラーはここで捕捉し、呼び出し元にスローする
    console.error('Fatal error during application bootstrap:', error);
    throw new Error(`Application bootstrap failed: ${error.message}`);
  }
}

module.exports = { bootstrap };
