/**
 * 状態管理アダプター
 * 
 * 状態管理コンポーネントをラップし、統一されたインターフェースを提供します。
 */

const { ValidationError } = require('../../lib/utils/errors');
const BaseAdapter = require('./base-adapter');
const { EVENT_NAMES } = require('../../lib/core/event-constants');

/**
 * 状態管理アダプター
 */
class StateManagerAdapter extends BaseAdapter {
  /**
   * コンストラクタ
   * @param {Object} stateManager - 状態管理インスタンス
   * @param {Object} options - 追加オプション
   * @param {Object} options.logger - ロガー
   * @param {Object} options.errorHandler - エラーハンドラー
   * @param {Object} options.eventEmitter - イベントエミッター
   */
  constructor(stateManager, options = {}) {
    super(stateManager, options);
  }
  
  /**
   * 現在の状態を取得
   * @param {OperationContext} context - 操作コンテキスト（オプション）
   * @returns {string} 現在の状態
   */
  getCurrentState(context = null) {
    try {
      const operationContext = context || this._createContext('getCurrentState');
      
      const state = this.manager.getCurrentState();
      
      return state;
    } catch (error) {
      return this._handleError(error, 'getCurrentState', context);
    }
  }
  
  /**
   * 状態を設定
   * @param {string} state - 設定する状態
   * @param {Object} data - 状態に関連するデータ
   * @param {OperationContext} context - 操作コンテキスト（オプション）
   * @returns {boolean} 設定成功の場合はtrue
   */
  setState(state, data = {}, context = null) {
    try {
      const operationContext = context || this._createContext('setState', { state });
      
      this._validateParams({ state }, ['state']);
      
      // 現在の状態を取得（previousStateとして使用）
      const previousState = this.manager.getCurrentState();
      
      const result = this.manager.setState(state, data);
      
      // イベント発行
      this._emitEvent('state', 'state_changed', {
        state,
        previousState,
        timestamp: new Date().toISOString(),
        sessionId: data.sessionId || null,
        ...data // データオブジェクトの内容をイベントデータに含める
      }, operationContext);
      
      return result;
    } catch (error) {
      return this._handleError(error, 'setState', context, { state, data });
    }
  }
  
  /**
   * 状態を遷移
   * @param {string} targetState - 遷移先の状態
   * @param {Object} data - 遷移に関連するデータ
   * @param {OperationContext} context - 操作コンテキスト（オプション）
   * @returns {boolean} 遷移成功の場合はtrue
   */
  transitionTo(targetState, data = {}, context = null) {
    try {
      const operationContext = context || this._createContext('transitionTo', { targetState });
      
      this._validateParams({ targetState }, ['targetState']);
      
      // 遷移可能かどうかを検証
      if (!this.manager.canTransitionTo(targetState)) {
        throw new ValidationError(`Cannot transition from ${this.manager.getCurrentState()} to ${targetState}`);
      }
      
      // 現在の状態を取得（previousStateとして使用）
      const previousState = this.manager.getCurrentState();
      
      const result = this.manager.transitionTo(targetState, data);
      
      // イベント発行
      this._emitEvent('state', 'state_transition', {
        fromState: previousState,
        toState: targetState,
        previousState: previousState, // 後方互換性のため
        state: targetState, // 後方互換性のため
        timestamp: new Date().toISOString(),
        sessionId: data.sessionId || null,
        ...data // データオブジェクトの内容をイベントデータに含める
      }, operationContext);
      
      return result;
    } catch (error) {
      return this._handleError(error, 'transitionTo', context, { targetState, data });
    }
  }
  
  /**
   * 遷移可能かどうかを検証
   * @param {string} targetState - 遷移先の状態
   * @param {OperationContext} context - 操作コンテキスト（オプション）
   * @returns {boolean} 遷移可能な場合はtrue
   */
  canTransitionTo(targetState, context = null) {
    try {
      const operationContext = context || this._createContext('canTransitionTo', { targetState });
      
      this._validateParams({ targetState }, ['targetState']);
      
      return this.manager.canTransitionTo(targetState);
    } catch (error) {
      return this._handleError(error, 'canTransitionTo', context, { targetState });
    }
  }
  
  /**
   * 状態履歴を取得
   * @param {OperationContext} context - 操作コンテキスト（オプション）
   * @returns {Array} 状態履歴
   */
  getStateHistory(context = null) {
    try {
      const operationContext = context || this._createContext('getStateHistory');
      
      return this.manager.getStateHistory();
    } catch (error) {
      return this._handleError(error, 'getStateHistory', context);
    }
  }
  
  /**
   * 前の状態を取得
   * @param {OperationContext} context - 操作コンテキスト（オプション）
   * @returns {string} 前の状態
   */
  getPreviousState(context = null) {
    try {
      const operationContext = context || this._createContext('getPreviousState');
      
      return this.manager.getPreviousState();
    } catch (error) {
      return this._handleError(error, 'getPreviousState', context);
    }
  }
}

module.exports = StateManagerAdapter;