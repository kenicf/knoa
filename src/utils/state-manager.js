/**
 * 状態マネージャー
 * 
 * ワークフローの状態を管理するための状態マシンを実装します。
 */

/**
 * 状態マネージャークラス
 */
class StateManager {
  /**
   * コンストラクタ
   * @param {Object} options - オプション
   */
  constructor(options = {}) {
    // 状態定義
    this.states = {
      UNINITIALIZED: 'uninitialized',
      INITIALIZED: 'initialized',
      SESSION_STARTED: 'session_started',
      TASK_IN_PROGRESS: 'task_in_progress',
      FEEDBACK_COLLECTED: 'feedback_collected',
      SESSION_ENDED: 'session_ended'
    };
    
    // 状態遷移の定義
    this.stateTransitions = {
      [this.states.UNINITIALIZED]: [this.states.INITIALIZED],
      [this.states.INITIALIZED]: [this.states.SESSION_STARTED, this.states.INITIALIZED],
      [this.states.SESSION_STARTED]: [this.states.TASK_IN_PROGRESS, this.states.SESSION_ENDED],
      [this.states.TASK_IN_PROGRESS]: [this.states.FEEDBACK_COLLECTED, this.states.SESSION_ENDED],
      [this.states.FEEDBACK_COLLECTED]: [this.states.TASK_IN_PROGRESS, this.states.SESSION_ENDED],
      [this.states.SESSION_ENDED]: [this.states.INITIALIZED]
    };
    
    // 初期状態の設定
    this.currentState = this.states.UNINITIALIZED;
    
    // 状態変更リスナー
    this.stateChangeListeners = [];
    
    // 状態履歴
    this.stateHistory = [{
      state: this.currentState,
      timestamp: new Date().toISOString()
    }];
  }
  
  /**
   * 現在の状態を取得
   * @returns {string} 現在の状態
   */
  getCurrentState() {
    return this.currentState;
  }
  
  /**
   * 指定された状態への遷移が可能か確認
   * @param {string} nextState - 次の状態
   * @returns {boolean} 遷移可能かどうか
   */
  canTransitionTo(nextState) {
    return this.stateTransitions[this.currentState]?.includes(nextState) || false;
  }
  
  /**
   * 指定された状態に遷移
   * @param {string} nextState - 次の状態
   * @param {Object} [metadata] - 状態に関連するメタデータ
   * @returns {boolean} 遷移が成功したかどうか
   */
  transitionTo(nextState, metadata = {}) {
    if (!this.canTransitionTo(nextState)) {
      throw new Error(`状態 ${this.currentState} から ${nextState} への遷移は許可されていません`);
    }
    
    const prevState = this.currentState;
    this.currentState = nextState;
    
    // 状態履歴の記録
    const historyEntry = {
      state: nextState,
      prevState,
      timestamp: new Date().toISOString(),
      metadata
    };
    
    this.stateHistory.push(historyEntry);
    
    // リスナーに通知
    this._notifyStateChangeListeners(prevState, nextState, metadata);
    
    return true;
  }
  
  /**
   * 状態変更リスナーを登録
   * @param {Function} listener - リスナー関数
   * @returns {Function} リスナー解除関数
   */
  registerStateChangeListener(listener) {
    this.stateChangeListeners.push(listener);
    return () => {
      this.stateChangeListeners = this.stateChangeListeners.filter(l => l !== listener);
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
        console.error('状態変更リスナーでエラーが発生しました:', err);
      }
    }
  }
  
  /**
   * 状態履歴を取得
   * @param {number} [limit] - 取得する履歴の最大数
   * @returns {Array<Object>} 状態履歴
   */
  getStateHistory(limit) {
    if (limit) {
      return this.stateHistory.slice(-limit);
    }
    return [...this.stateHistory];
  }
}

module.exports = StateManager;