/**
 * エラー処理ハンドラー
 * 
 * アプリケーション全体で一貫したエラー処理を提供するためのフレームワーク。
 * エラーの処理、ログ記録、回復、監視を一元管理します。
 */

const { 
  ApplicationError, 
  ValidationError,
  StateError,
  DataConsistencyError,
  StorageError,
  GitError,
  LockError,
  TimeoutError,
  ConfigurationError,
  DependencyError
} = require('./error-framework');

/**
 * エラーハンドラークラス
 * エラーの処理と回復を担当
 */
class ErrorHandler {
  /**
   * コンストラクタ
   * @param {Object} options - オプション
   * @param {Object} options.logger - ロガーインスタンス
   * @param {Object} options.eventEmitter - イベントエミッターインスタンス
   */
  constructor(options = {}) {
    this.logger = options.logger || console;
    this.eventEmitter = options.eventEmitter;
    this.recoveryStrategies = new Map();
    this.errorPatterns = new Map();
    this.alertThresholds = new Map();
    this.errorCounts = new Map();
    
    // デフォルトの回復戦略を登録
    this._registerDefaultRecoveryStrategies();
    
    // デフォルトのエラーパターンを登録
    this._registerDefaultErrorPatterns();
    
    // デフォルトのアラート閾値を登録
    this._registerDefaultAlertThresholds();
  }

  /**
   * エラーを処理
   * @param {Error} error - 処理するエラー
   * @param {string} component - エラーが発生したコンポーネント
   * @param {string} operation - エラーが発生した操作
   * @param {Object} options - 追加オプション
   * @param {string} options.traceId - トレースID（オプション）
   * @param {string} options.requestId - リクエストID（オプション）
   * @param {Object} options.additionalContext - 追加コンテキスト情報（オプション）
   * @returns {Error} 処理されたエラー
   */
  async handle(error, component, operation, options = {}) {
    const traceId = options.traceId || this._generateTraceId();
    const requestId = options.requestId || this._generateRequestId();
    const timestamp = new Date().toISOString();
    
    // アプリケーションエラーでなければラップする
    if (!(error instanceof ApplicationError)) {
      error = new ApplicationError(error.message, {
        cause: error,
        context: { 
          component, 
          operation,
          traceId,
          requestId,
          ...options.additionalContext
        }
      });
    } else if (error.context) {
      // 既存のコンテキストにトレース情報を追加
      error.context.traceId = traceId;
      error.context.requestId = requestId;
      
      // 追加コンテキスト情報があれば追加
      if (options.additionalContext) {
        error.context = {
          ...error.context,
          ...options.additionalContext
        };
      }
    }
    
    // エラーパターンの検出
    this._detectErrorPatterns(error, component, operation);
    
    // エラーカウントの更新
    this._updateErrorCounts(error, component, operation);
    
    // アラート条件の確認
    this._checkAlertThresholds(error, component, operation);
    
    // エラーをログに記録
    this._logError(error, component, operation, traceId, requestId);
    
    // エラーイベントを発行
    this._emitErrorEvent(error, component, operation, traceId, requestId);
    
    // 回復可能なエラーの場合は回復を試みる
    if (error.recoverable) {
      try {
        // エラーコードに対応する回復戦略があるか確認
        if (this.recoveryStrategies.has(error.code)) {
          return await this._executeRecoveryStrategy(
            error.code, 
            error, 
            component, 
            operation, 
            traceId, 
            requestId
          );
        }
        
        // エラータイプに対応する回復戦略があるか確認
        const errorType = error.constructor.name;
        if (this.recoveryStrategies.has(errorType)) {
          return await this._executeRecoveryStrategy(
            errorType, 
            error, 
            component, 
            operation, 
            traceId, 
            requestId
          );
        }
      } catch (recoveryError) {
        this.logger.error(`Recovery failed for ${error.code || error.constructor.name}:`, {
          original_error: error.message,
          recovery_error: recoveryError.message,
          trace_id: traceId,
          request_id: requestId,
          component,
          operation,
          stack: recoveryError.stack
        });
        
        // 回復戦略が失敗した場合は例外を再スロー
        throw recoveryError;
      }
    }
    
    return error;
  }

  /**
   * エラーをログに記録
   * @private
   */
  _logError(error, component, operation, traceId, requestId) {
    const logData = {
      error_name: error.name,
      error_message: error.message,
      error_code: error.code,
      stack: error.stack,
      context: error.context,
      trace_id: traceId,
      request_id: requestId,
      timestamp: new Date().toISOString()
    };
    
    // エラーの重大度に応じてログレベルを変更
    if (error instanceof StateError || error instanceof DataConsistencyError) {
      this.logger.error(`[${component}] ${operation} failed - CRITICAL:`, logData);
    } else if (error instanceof ConfigurationError || error instanceof DependencyError) {
      this.logger.error(`[${component}] ${operation} failed - MAJOR:`, logData);
    } else {
      this.logger.error(`[${component}] ${operation} failed:`, logData);
    }
  }

  /**
   * エラーイベントを発行
   * @private
   */
  _emitErrorEvent(error, component, operation, traceId, requestId) {
    if (!this.eventEmitter) return;
    
    const eventData = {
      error,
      component,
      operation,
      traceId,
      requestId,
      errorCode: error.code,
      recoverable: error.recoverable,
      timestamp: new Date().toISOString()
    };
    
    // 標準化されたイベント発行を使用
    if (typeof this.eventEmitter.emitStandardized === 'function') {
      this.eventEmitter.emitStandardized('error', 'occurred', eventData);
    } else {
      // 後方互換性のために従来のイベント発行も維持
      this.eventEmitter.emit('error', eventData);
    }
  }

  /**
   * 回復戦略を実行
   * @private
   */
  async _executeRecoveryStrategy(strategyKey, error, component, operation, traceId, requestId) {
    const strategy = this.recoveryStrategies.get(strategyKey);
    
    try {
      // 回復処理の開始をイベントで通知
      if (this.eventEmitter) {
        const eventData = {
          error,
          component,
          operation,
          errorCode: error.code,
          traceId,
          requestId,
          timestamp: new Date().toISOString()
        };
        
        if (typeof this.eventEmitter.emitStandardized === 'function') {
          this.eventEmitter.emitStandardized('error', 'recovery_started', eventData);
        } else {
          this.eventEmitter.emit('error:recovery_started', eventData);
        }
      }
      
      // 回復戦略を実行
      const result = await Promise.resolve(strategy(error, component, operation, { traceId, requestId }));
      
      // 回復成功をイベントで通知
      if (this.eventEmitter) {
        const eventData = {
          error,
          component,
          operation,
          errorCode: error.code,
          result,
          traceId,
          requestId,
          timestamp: new Date().toISOString()
        };
        
        if (typeof this.eventEmitter.emitStandardized === 'function') {
          this.eventEmitter.emitStandardized('error', 'recovery_succeeded', eventData);
        } else {
          this.eventEmitter.emit('error:recovery_succeeded', eventData);
        }
      }
      
      // 回復成功カウントを更新
      this._updateRecoverySuccessCount(error.code || error.constructor.name);
      
      return result;
    } catch (recoveryError) {
      // 回復失敗をイベントで通知
      if (this.eventEmitter) {
        const eventData = {
          error,
          recoveryError,
          component,
          operation,
          errorCode: error.code,
          traceId,
          requestId,
          timestamp: new Date().toISOString()
        };
        
        if (typeof this.eventEmitter.emitStandardized === 'function') {
          this.eventEmitter.emitStandardized('error', 'recovery_failed', eventData);
        } else {
          this.eventEmitter.emit('error:recovery_failed', eventData);
        }
      }
      
      // 回復失敗カウントを更新
      this._updateRecoveryFailureCount(error.code || error.constructor.name);
      
      throw recoveryError;
    }
  }

  /**
   * トレースIDを生成
   * @private
   */
  _generateTraceId() {
    return `trace-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * リクエストIDを生成
   * @private
   */
  _generateRequestId() {
    return `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * エラーカウントを更新
   * @private
   */
  _updateErrorCounts(error, component, operation) {
    // エラータイプ別カウント
    const errorType = error.constructor.name;
    const errorTypeKey = `type:${errorType}`;
    this.errorCounts.set(errorTypeKey, (this.errorCounts.get(errorTypeKey) || 0) + 1);
    
    // コンポーネント別カウント
    const componentKey = `component:${component}`;
    this.errorCounts.set(componentKey, (this.errorCounts.get(componentKey) || 0) + 1);
    
    // エラーコード別カウント
    if (error.code) {
      const codeKey = `code:${error.code}`;
      this.errorCounts.set(codeKey, (this.errorCounts.get(codeKey) || 0) + 1);
    }
    
    // 総カウント
    this.errorCounts.set('total', (this.errorCounts.get('total') || 0) + 1);
  }

  /**
   * 回復成功カウントを更新
   * @private
   */
  _updateRecoverySuccessCount(errorKey) {
    const key = `recovery_success:${errorKey}`;
    this.errorCounts.set(key, (this.errorCounts.get(key) || 0) + 1);
    this.errorCounts.set('recovery_success:total', (this.errorCounts.get('recovery_success:total') || 0) + 1);
  }

  /**
   * 回復失敗カウントを更新
   * @private
   */
  _updateRecoveryFailureCount(errorKey) {
    const key = `recovery_failure:${errorKey}`;
    this.errorCounts.set(key, (this.errorCounts.get(key) || 0) + 1);
    this.errorCounts.set('recovery_failure:total', (this.errorCounts.get('recovery_failure:total') || 0) + 1);
  }

  /**
   * エラーパターンを検出
   * @private
   */
  _detectErrorPatterns(error, component, operation) {
    for (const [patternName, pattern] of this.errorPatterns.entries()) {
      if (pattern.detector(error, component, operation)) {
        this.logger.warn(`Error pattern detected: ${patternName}`, {
          error_code: error.code,
          error_type: error.constructor.name,
          component,
          operation,
          pattern: patternName
        });
        
        if (this.eventEmitter) {
          const eventData = {
            error,
            component,
            operation,
            pattern: patternName,
            timestamp: new Date().toISOString()
          };
          
          if (typeof this.eventEmitter.emitStandardized === 'function') {
            this.eventEmitter.emitStandardized('error', 'pattern_detected', eventData);
          } else {
            this.eventEmitter.emit('error:pattern_detected', eventData);
          }
        }
        
        // パターンカウントを更新
        const patternKey = `pattern:${patternName}`;
        this.errorCounts.set(patternKey, (this.errorCounts.get(patternKey) || 0) + 1);
        
        // パターンに対応するアクションがあれば実行
        if (pattern.action) {
          try {
            pattern.action(error, component, operation);
          } catch (actionError) {
            this.logger.error(`Error executing pattern action for ${patternName}:`, actionError);
          }
        }
      }
    }
  }

  /**
   * アラート閾値をチェック
   * @private
   */
  _checkAlertThresholds(error, component, operation) {
    for (const [thresholdName, threshold] of this.alertThresholds.entries()) {
      if (threshold.condition(error, component, operation)) {
        this.logger.warn(`Alert threshold triggered: ${thresholdName}`, {
          error_code: error.code,
          error_type: error.constructor.name,
          component,
          operation,
          threshold: thresholdName,
          severity: threshold.severity
        });
        
        if (this.eventEmitter) {
          const eventData = {
            error,
            component,
            operation,
            threshold: thresholdName,
            severity: threshold.severity,
            timestamp: new Date().toISOString()
          };
          
          if (typeof this.eventEmitter.emitStandardized === 'function') {
            this.eventEmitter.emitStandardized('error', 'alert_triggered', eventData);
          } else {
            this.eventEmitter.emit('error:alert_triggered', eventData);
          }
        }
        
        // アラートカウントを更新
        const alertKey = `alert:${thresholdName}`;
        this.errorCounts.set(alertKey, (this.errorCounts.get(alertKey) || 0) + 1);
      }
    }
  }

  /**
   * 回復戦略を登録
   * @param {string} key - エラーコードまたはエラータイプ
   * @param {Function} strategy - 回復戦略関数
   * @param {Object} options - オプション
   * @param {string} options.description - 戦略の説明
   * @param {number} options.priority - 優先度（低いほど先に実行）
   */
  registerRecoveryStrategy(key, strategy, options = {}) {
    this.recoveryStrategies.set(key, strategy);
    
    // 登録イベントを発行
    if (this.eventEmitter) {
      const eventData = {
        key,
        description: options.description,
        priority: options.priority,
        timestamp: new Date().toISOString()
      };
      
      if (typeof this.eventEmitter.emitStandardized === 'function') {
        this.eventEmitter.emitStandardized('error', 'recovery_strategy_registered', eventData);
      } else {
        this.eventEmitter.emit('error:recovery_strategy_registered', eventData);
      }
    }
    
    return this;
  }

  /**
   * 回復戦略を削除
   * @param {string} key - エラーコードまたはエラータイプ
   */
  removeRecoveryStrategy(key) {
    const result = this.recoveryStrategies.delete(key);
    
    // 削除イベントを発行
    if (result && this.eventEmitter) {
      const eventData = {
        key,
        timestamp: new Date().toISOString()
      };
      
      if (typeof this.eventEmitter.emitStandardized === 'function') {
        this.eventEmitter.emitStandardized('error', 'recovery_strategy_removed', eventData);
      } else {
        this.eventEmitter.emit('error:recovery_strategy_removed', eventData);
      }
    }
    
    return result;
  }

  /**
   * エラーパターンを登録
   * @param {string} name - パターン名
   * @param {Function} detector - パターン検出関数
   * @param {Function} action - パターン検出時のアクション（オプション）
   */
  registerErrorPattern(name, detector, action) {
    this.errorPatterns.set(name, { detector, action });
    return this;
  }

  /**
   * エラーパターンを削除
   * @param {string} name - パターン名
   */
  removeErrorPattern(name) {
    return this.errorPatterns.delete(name);
  }

  /**
   * アラート閾値を登録
   * @param {string} name - 閾値名
   * @param {Function} condition - アラート条件関数
   * @param {Object} options - オプション
   * @param {string} options.severity - 重大度（'critical', 'major', 'minor'）
   * @param {string} options.description - 説明
   */
  registerAlertThreshold(name, condition, options = {}) {
    this.alertThresholds.set(name, {
      condition,
      severity: options.severity || 'minor',
      description: options.description
    });
    return this;
  }

  /**
   * アラート閾値を削除
   * @param {string} name - 閾値名
   */
  removeAlertThreshold(name) {
    return this.alertThresholds.delete(name);
  }

  /**
   * デフォルトの回復戦略を登録
   * @private
   */
  _registerDefaultRecoveryStrategies() {
    // リトライ戦略
    this.registerRecoveryStrategy('ERR_TIMEOUT', async (error, component, operation, options) => {
      this.logger.info(`Retrying operation after timeout: ${component}.${operation}`, {
        trace_id: options.traceId,
        request_id: options.requestId
      });
      
      // 実際のリトライロジックはここに実装
      // 例: 元の操作を再実行する
      
      return { retried: true, result: null };
    }, {
      description: 'タイムアウトエラーに対するリトライ戦略',
      priority: 1
    });
    
    // ストレージエラーの回復戦略
    this.registerRecoveryStrategy('ERR_STORAGE', async (error, component, operation, options) => {
      this.logger.info(`Attempting storage recovery: ${component}.${operation}`, {
        trace_id: options.traceId,
        request_id: options.requestId
      });
      
      // 実際の回復ロジックはここに実装
      // 例: 代替ストレージを使用する
      
      return { recovered: true, result: null };
    }, {
      description: 'ストレージエラーに対する回復戦略',
      priority: 2
    });
  }

  /**
   * デフォルトのエラーパターンを登録
   * @private
   */
  _registerDefaultErrorPatterns() {
    // 連続タイムアウトパターン
    this.registerErrorPattern(
      'consecutive_timeouts',
      (error) => error instanceof TimeoutError,
      () => {
        // パターン検出時のアクション
        // 例: サーキットブレーカーを開く
      }
    );
    
    // データ整合性エラーパターン
    this.registerErrorPattern(
      'data_consistency_errors',
      (error) => error instanceof DataConsistencyError,
      () => {
        // パターン検出時のアクション
        // 例: データ修復プロセスを開始する
      }
    );
  }

  /**
   * デフォルトのアラート閾値を登録
   * @private
   */
  _registerDefaultAlertThresholds() {
    // 重大なエラーのアラート
    this.registerAlertThreshold(
      'critical_error',
      (error) => error instanceof StateError || error instanceof DataConsistencyError,
      {
        severity: 'critical',
        description: '重大なシステムエラーが発生した場合のアラート'
      }
    );
    
    // 設定エラーのアラート
    this.registerAlertThreshold(
      'configuration_error',
      (error) => error instanceof ConfigurationError,
      {
        severity: 'major',
        description: '設定エラーが発生した場合のアラート'
      }
    );
  }

  /**
   * エラー統計情報を取得
   * @returns {Object} エラー統計情報
   */
  getErrorStatistics() {
    const errorsByType = {};
    const errorsByComponent = {};
    const patternCounts = {};
    const alertCounts = {};
    
    // 統計情報を集計
    for (const [key, count] of this.errorCounts.entries()) {
      if (key.startsWith('type:')) {
        errorsByType[key.substring(5)] = count;
      } else if (key.startsWith('component:')) {
        errorsByComponent[key.substring(10)] = count;
      } else if (key.startsWith('pattern:')) {
        patternCounts[key.substring(8)] = count;
      } else if (key.startsWith('alert:')) {
        alertCounts[key.substring(6)] = count;
      }
    }
    
    // 回復成功率の計算
    const recoverySuccess = this.errorCounts.get('recovery_success:total') || 0;
    const recoveryFailure = this.errorCounts.get('recovery_failure:total') || 0;
    const totalRecoveryAttempts = recoverySuccess + recoveryFailure;
    const recoverySuccessRate = totalRecoveryAttempts > 0 ? recoverySuccess / totalRecoveryAttempts : 0;
    
    return {
      total_errors: this.errorCounts.get('total') || 0,
      errors_by_type: errorsByType,
      errors_by_component: errorsByComponent,
      pattern_counts: patternCounts,
      alert_counts: alertCounts,
      recovery_attempts: totalRecoveryAttempts,
      recovery_success: recoverySuccess,
      recovery_failure: recoveryFailure,
      recovery_success_rate: recoverySuccessRate
    };
  }

  /**
   * エラーダッシュボード用のデータを取得
   * @returns {Object} ダッシュボードデータ
   */
  getDashboardData() {
    const statistics = this.getErrorStatistics();
    const patterns = Array.from(this.errorPatterns.keys());
    const strategies = Array.from(this.recoveryStrategies.keys());
    const thresholds = Array.from(this.alertThresholds.entries()).map(([name, config]) => ({
      name,
      severity: config.severity,
      description: config.description
    }));
    
    return {
      statistics,
      patterns,
      strategies,
      thresholds,
      timestamp: new Date().toISOString()
    };
  }
}

// 既存のエラークラスをインポートして再エクスポート
module.exports = {
  ErrorHandler,
  // 既存のエラークラスを再エクスポート
  ApplicationError,
  ValidationError,
  StateError,
  DataConsistencyError,
  StorageError,
  GitError,
  LockError,
  TimeoutError,
  ConfigurationError,
  DependencyError
};