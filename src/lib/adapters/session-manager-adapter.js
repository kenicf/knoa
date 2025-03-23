/**
 * セッション管理アダプター
 * 
 * セッション管理コンポーネントをラップし、統合マネージャーとのインターフェースを提供します。
 */

const { ValidationError } = require('../../utils/errors');
const BaseAdapter = require('./base-adapter');

/**
 * セッション管理アダプター
 */
class SessionManagerAdapter extends BaseAdapter {
  /**
   * コンストラクタ
   * @param {Object} sessionManager - セッション管理インスタンス
   * @param {Object} options - 追加オプション
   * @param {Object} options.logger - ロガー
   * @param {Object} options.errorHandler - エラーハンドラー
   */
  constructor(sessionManager, options = {}) {
    super(sessionManager, options);
  }
  
  /**
   * セッションを検証
   * @param {Object} session - 検証するセッション
   * @returns {Object} 検証結果
   */
  validateSession(session) {
    try {
      this._validateParams({ session }, ['session']);
      
      const isValid = this.manager.validateSession(session);
      return { isValid, errors: [], warnings: [] };
    } catch (error) {
      return this._handleError(error, 'validateSession', { session });
    }
  }
  
  /**
   * 最新のセッションを取得
   * @returns {Promise<Object|null>} 最新のセッション
   */
  async getLatestSession() {
    try {
      return await this.manager.getLatestSession();
    } catch (error) {
      return this._handleError(error, 'getLatestSession');
    }
  }
  
  /**
   * セッションIDでセッションを取得
   * @param {string} sessionId - セッションID
   * @returns {Promise<Object|null>} セッション
   */
  async getSessionById(sessionId) {
    try {
      this._validateParams({ sessionId }, ['sessionId']);
      
      return await this.manager.getSessionById(sessionId);
    } catch (error) {
      return this._handleError(error, 'getSessionById', { sessionId });
    }
  }
  
  /**
   * 新しいセッションを作成
   * @param {string} previousSessionId - 前回のセッションID
   * @returns {Promise<Object>} 新しいセッション
   */
  async createNewSession(previousSessionId) {
    try {
      return await this.manager.createNewSession(previousSessionId);
    } catch (error) {
      return this._handleError(error, 'createNewSession', { previousSessionId });
    }
  }
  
  /**
   * セッションを更新
   * @param {string} sessionId - セッションID
   * @param {Object} updateData - 更新データ
   * @returns {Promise<Object>} 更新されたセッション
   */
  async updateSession(sessionId, updateData) {
    try {
      this._validateParams({ sessionId, updateData }, ['sessionId', 'updateData']);
      
      return await this.manager.updateSession(sessionId, updateData);
    } catch (error) {
      return this._handleError(error, 'updateSession', { sessionId, updateData });
    }
  }
  
  /**
   * セッションを終了
   * @param {string} sessionId - セッションID
   * @returns {Promise<Object>} 終了したセッション
   */
  async endSession(sessionId) {
    try {
      this._validateParams({ sessionId }, ['sessionId']);
      
      return await this.manager.endSession(sessionId);
    } catch (error) {
      return this._handleError(error, 'endSession', { sessionId });
    }
  }
  
  /**
   * セッションにタスクを関連付け
   * @param {string} sessionId - セッションID
   * @param {string} taskId - タスクID
   * @returns {Promise<Object>} 更新されたセッション
   */
  async addTaskToSession(sessionId, taskId) {
    try {
      this._validateParams({ sessionId, taskId }, ['sessionId', 'taskId']);
      
      if (!taskId.match(/^T[0-9]{3}$/)) {
        throw new ValidationError('タスクIDはT000形式である必要があります');
      }
      
      return await this.manager.addTaskToSession(sessionId, taskId);
    } catch (error) {
      return this._handleError(error, 'addTaskToSession', { sessionId, taskId });
    }
  }
  
  /**
   * セッションからタスクを削除
   * @param {string} sessionId - セッションID
   * @param {string} taskId - タスクID
   * @returns {Promise<Object>} 更新されたセッション
   */
  async removeTaskFromSession(sessionId, taskId) {
    try {
      this._validateParams({ sessionId, taskId }, ['sessionId', 'taskId']);
      
      if (!taskId.match(/^T[0-9]{3}$/)) {
        throw new ValidationError('タスクIDはT000形式である必要があります');
      }
      
      return await this.manager.removeTaskFromSession(sessionId, taskId);
    } catch (error) {
      return this._handleError(error, 'removeTaskFromSession', { sessionId, taskId });
    }
  }
  
  /**
   * セッションにGitコミットを関連付け
   * @param {string} sessionId - セッションID
   * @param {string} commitHash - コミットハッシュ
   * @returns {Promise<Object>} 更新されたセッション
   */
  async addGitCommitToSession(sessionId, commitHash) {
    try {
      this._validateParams({ sessionId, commitHash }, ['sessionId', 'commitHash']);
      
      return await this.manager.addGitCommitToSession(sessionId, commitHash);
    } catch (error) {
      return this._handleError(error, 'addGitCommitToSession', { sessionId, commitHash });
    }
  }
  
  /**
   * セッションマークダウンを生成
   * @param {string} sessionId - セッションID
   * @returns {Promise<string>} マークダウン形式のセッション
   */
  async generateSessionMarkdown(sessionId) {
    try {
      this._validateParams({ sessionId }, ['sessionId']);
      
      return await this.manager.generateSessionMarkdown(sessionId);
    } catch (error) {
      return this._handleError(error, 'generateSessionMarkdown', { sessionId });
    }
  }
}

module.exports = SessionManagerAdapter;