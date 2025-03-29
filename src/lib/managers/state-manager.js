/**
 * 状態マネージャー
 *
 * ワークフローの状態を管理するための状態マシンを実装します。
 */

const { StateError } = require('../utils/errors');

/**
 * 状態マネージャークラス
 */
class StateManager {
  /**
   * コンストラクタ
   * @param {Object} options - オプションオブジェクト
   * @param {Object} options.logger - ロガー
   * @param {Object} options.eventEmitter - イベントエミッター
   * @param {Object} options.errorHandler - エラーハンドラー
   * @param {Object} options.config - 設定オプション
   */
  constructor(options = {}) {
    // 依存関係の設定
    this.logger = options.logger || console;
    this.eventEmitter = options.eventEmitter;
    this.errorHandler = options.errorHandler;

    // 設定オプションの設定
    this.config = options.config || {};

    // 状態定義
    this.states = {
      UNINITIALIZED: 'uninitialized',
      INITIALIZED: 'initialized',
      SESSION_STARTED: 'session_started',
      TASK_IN_PROGRESS: 'task_in_progress',
      FEEDBACK_COLLECTED: 'feedback_collected',
      SESSION_ENDED: 'session_ended',
      ERROR: 'error',
    };

    // 状態遷移の定義
    this.stateTransitions = {
      [this.states.UNINITIALIZED]: [this.states.INITIALIZED, this.states.ERROR],
      [this.states.INITIALIZED]: [
        this.states.SESSION_STARTED,
        this.states.INITIALIZED,
        this.states.ERROR,
      ],
      [this.states.SESSION_STARTED]: [
        this.states.TASK_IN_PROGRESS,
        this.states.SESSION_ENDED,
        this.states.ERROR,
      ],
      [this.states.TASK_IN_PROGRESS]: [
        this.states.FEEDBACK_COLLECTED,
        this.states.SESSION_ENDED,
        this.states.ERROR,
      ],
      [this.states.FEEDBACK_COLLECTED]: [
        this.states.TASK_IN_PROGRESS,
        this.states.SESSION_ENDED,
        this.states.ERROR,
      ],
      [this.states.SESSION_ENDED]: [this.states.INITIALIZED, this.states.ERROR],
      [this.states.ERROR]: [this.states.INITIALIZED, this.states.UNINITIALIZED],
    };

    // 初期状態の設定
    this.currentState = this.states.UNINITIALIZED;

    // 状態変更リスナー
    this.stateChangeListeners = [];

    // 状態履歴
    this.stateHistory = [
      {
        state: this.currentState,
        timestamp: new Date().toISOString(),
      },
    ];

    this.logger.info('StateManager initialized', {
      initialState: this.currentState,
    });

    // イベントエミッターが存在する場合はイベントを発行
    if (this.eventEmitter) {
      this.eventEmitter.emit('state:manager:initialized', {
        initialState: this.currentState,
      });
    }
  }

  /**
   * 現在の状態を取得
   * @returns {string} 現在の状態
   */
  getCurrentState() {
    return this.currentState;
  }

  /**
   * 状態を直接設定
   * @param {string} state - 設定する状態
   * @param {Object} metadata - 状態に関連するメタデータ
   * @returns {boolean} 設定成功の場合はtrue
   */
  setState(state, metadata = {}) {
    if (!Object.values(this.states).includes(state)) {
      throw new StateError(`不正な状態です: ${state}`, {
        context: {
          currentState: this.currentState,
          requestedState: state,
          metadata,
        },
      });
    }

    const prevState = this.currentState;
    this.currentState = state;

    // 状態履歴の記録
    const historyEntry = {
      state,
      prevState,
      timestamp: new Date().toISOString(),
      metadata,
    };

    this.stateHistory.push(historyEntry);

    // リスナーに通知
    this._notifyStateChangeListeners(prevState, state, metadata);

    // イベント発行
    if (this.eventEmitter) {
      this.eventEmitter.emit('state:changed', {
        prevState,
        newState: state,
        metadata,
        timestamp: historyEntry.timestamp,
      });
    }

    return true;
  }

  /**
   * 指定された状態への遷移が可能か確認
   * @param {string} nextState - 次の状態
   * @returns {boolean} 遷移可能かどうか
   */
  canTransitionTo(nextState) {
    return (
      this.stateTransitions[this.currentState]?.includes(nextState) || false
    );
  }

  /**
   * 指定された状態に遷移
   * @param {string} nextState - 次の状態
   * @param {Object} metadata - 状態に関連するメタデータ
   * @returns {boolean} 遷移が成功したかどうか
   */
  transitionTo(nextState, metadata = {}) {
    if (!this.canTransitionTo(nextState)) {
      throw new StateError(
        `状態 ${this.currentState} から ${nextState} への遷移は許可されていません`,
        {
          context: {
            currentState: this.currentState,
            nextState,
            metadata,
          },
        }
      );
    }

    return this.setState(nextState, metadata);
  }

  /**
   * 状態変更リスナーを登録
   * @param {Function} listener - リスナー関数
   * @returns {Function} リスナー解除関数
   */
  registerStateChangeListener(listener) {
    this.stateChangeListeners.push(listener);
    return () => {
      this.stateChangeListeners = this.stateChangeListeners.filter(
        (l) => l !== listener
      );
    };
  }

  /**
   * 状態変更リスナーに通知
   * @param {string} prevState - 前の状態
   * @param {string} newState - 新しい状態
   * @param {Object} metadata - メタデータ
   * @private
   */
  _notifyStateChangeListeners(prevState, newState, metadata) {
    for (const listener of this.stateChangeListeners) {
      try {
        listener(prevState, newState, metadata);
      } catch (err) {
        this.logger.error('状態変更リスナーでエラーが発生しました:', err);
      }
    }
  }

  /**
   * 状態履歴を取得
   * @param {number} limit - 取得する履歴の最大数
   * @returns {Array<Object>} 状態履歴
   */
  getStateHistory(limit) {
    if (limit) {
      return this.stateHistory.slice(-limit);
    }
    return [...this.stateHistory];
  }

  /**
   * 前の状態を取得
   * @returns {string} 前の状態
   */
  getPreviousState() {
    if (this.stateHistory.length < 2) {
      return null;
    }
    return this.stateHistory[this.stateHistory.length - 2].state;
  }

  /**
   * エラー状態をリセット
   * @param {Object} metadata - リセットに関連するメタデータ
   * @returns {boolean} リセット成功の場合はtrue
   */
  resetErrorState(metadata = {}) {
    if (this.currentState !== this.states.ERROR) {
      return false;
    }

    // エラー前の状態を取得
    let targetState = this.states.INITIALIZED;
    for (let i = this.stateHistory.length - 2; i >= 0; i--) {
      // eslint-disable-next-line security/detect-object-injection
      const historyEntry = this.stateHistory[i];
      if (historyEntry.state !== this.states.ERROR) {
        targetState = historyEntry.state;
        break;
      }
    }

    return this.setState(targetState, {
      ...metadata,
      resetReason: 'error_recovery',
    });
  }
}

module.exports = StateManager;
