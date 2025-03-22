/**
 * エラー処理フレームワークの使用例
 */

const { 
  ErrorHandler, 
  ValidationError, 
  StateError, 
  TimeoutError 
} = require('../lib/core/error-handler');
const { EnhancedEventEmitter } = require('../lib/core/event-system');

// ロガーの設定
const logger = console;

// イベントエミッターの設定
const eventEmitter = new EnhancedEventEmitter();
eventEmitter.on('error', (data) => {
  logger.debug('エラーイベントを受信:', data);
});

// エラーハンドラーの初期化
const errorHandler = new ErrorHandler({
  logger,
  eventEmitter
});

// カスタム回復戦略の登録
errorHandler.registerRecoveryStrategy('ERR_VALIDATION', async (error, component, operation, options) => {
  logger.info(`バリデーションエラーの回復を試みます: ${component}.${operation}`, {
    trace_id: options.traceId,
    request_id: options.requestId
  });
  
  // 実際の回復ロジック
  // 例: デフォルト値を使用する
  return {
    recovered: true,
    result: { useDefault: true, defaultValue: 'default' }
  };
});

// カスタムエラーパターンの登録
errorHandler.registerErrorPattern(
  'validation_errors_in_task_manager',
  (error, component) => error instanceof ValidationError && component === 'TaskManager',
  () => {
    logger.info('TaskManagerでバリデーションエラーが検出されました。入力検証を強化してください。');
  }
);

// カスタムアラート閾値の登録
errorHandler.registerAlertThreshold(
  'frequent_timeouts',
  (error) => error instanceof TimeoutError,
  {
    severity: 'major',
    description: 'タイムアウトエラーが頻発しています。ネットワーク状態を確認してください。'
  }
);

// 使用例1: バリデーションエラーの処理
async function example1() {
  try {
    // バリデーションエラーをスロー
    throw new ValidationError('入力データが不正です', {
      code: 'ERR_VALIDATION',
      context: { field: 'username', value: '' }
    });
  } catch (error) {
    // エラーハンドラーでエラーを処理
    const result = await errorHandler.handle(error, 'TaskManager', 'createTask');
    
    // 回復結果を確認
    if (result && result.recovered) {
      logger.info('エラーから回復しました:', result);
      return result.result;
    } else {
      logger.error('エラーから回復できませんでした');
      throw error;
    }
  }
}

// 使用例2: 状態エラーの処理
async function example2() {
  try {
    // 状態エラーをスロー
    throw new StateError('無効な状態遷移です', {
      context: { currentState: 'pending', targetState: 'completed' }
    });
  } catch (error) {
    // エラーハンドラーでエラーを処理
    await errorHandler.handle(error, 'SessionManager', 'changeState');
    
    // 状態エラーは回復不可能なので、常に再スロー
    throw error;
  }
}

// 使用例3: タイムアウトエラーの処理
async function example3() {
  try {
    // タイムアウトエラーをスロー
    throw new TimeoutError('操作がタイムアウトしました', {
      code: 'ERR_TIMEOUT',
      context: { operation: 'fetchData', timeout: 5000 }
    });
  } catch (error) {
    // エラーハンドラーでエラーを処理
    const result = await errorHandler.handle(error, 'DataService', 'fetchData');
    
    // 回復結果を確認
    if (result && result.retried) {
      logger.info('リトライに成功しました:', result);
      return result.result;
    } else {
      logger.error('リトライに失敗しました');
      throw error;
    }
  }
}

// 統計情報の表示
function showStatistics() {
  const stats = errorHandler.getErrorStatistics();
  logger.info('エラー統計情報:', stats);
  
  const dashboardData = errorHandler.getDashboardData();
  logger.info('ダッシュボードデータ:', dashboardData);
}

// 使用例の実行
async function runExamples() {
  try {
    await example1();
  } catch (error) {
    logger.error('例1でエラーが発生しました:', error);
  }
  
  try {
    await example2();
  } catch (error) {
    logger.error('例2でエラーが発生しました:', error);
  }
  
  try {
    await example3();
  } catch (error) {
    logger.error('例3でエラーが発生しました:', error);
  }
  
  showStatistics();
}

// コマンドラインから実行された場合
if (require.main === module) {
  runExamples().catch(error => {
    console.error('エラーが発生しました:', error);
    process.exit(1);
  });
}

module.exports = {
  runExamples,
  errorHandler,
  example1,
  example2,
  example3,
  showStatistics
};