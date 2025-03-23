/**
 * セッション管理アダプター
 * 
 * セッション管理コンポーネントをラップし、統合マネージャーとのインターフェースを提供します。
 */

const { ValidationError } = require('../../lib/utils/errors');
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
   * @param {OperationContext} context - 操作コンテキスト（オプション）
   * @param {string} previousSessionId - 前回のセッションID
   * @returns {Promise<Object>} 新しいセッション
   */
  async createNewSession(context = null, previousSessionId) {
    try {
      // コンテキストがない場合は作成
      const operationContext = context || this._createContext('createNewSession', { previousSessionId });
      
      const session = await this.manager.createNewSession(previousSessionId);
      
      // イベント発行
      this._emitEvent('session', 'session_created', {
        id: session.session_handover.session_id,
        previousSessionId,
        timestamp: new Date().toISOString()
      }, operationContext);
      
      return session;
    } catch (error) {
      return this._handleError(error, 'createNewSession', context, { previousSessionId });
    }
  }
  
  /**
   * セッションを更新
   * @param {string} sessionId - セッションID
   * @param {Object} updateData - 更新データ
   * @param {OperationContext} context - 操作コンテキスト（オプション）
   * @returns {Promise<Object>} 更新されたセッション
   */
  async updateSession(sessionId, updateData, context = null) {
    try {
      // コンテキストがない場合は作成
      const operationContext = context || this._createContext('updateSession', {
        sessionId,
        updateData
      });
      
      this._validateParams({ sessionId, updateData }, ['sessionId', 'updateData']);
      
      const session = await this.manager.updateSession(sessionId, updateData);
      
      // イベント発行
      this._emitEvent('session', 'session_updated', {
        id: sessionId,
        updates: updateData,
        timestamp: new Date().toISOString()
      }, operationContext);
      
      return session;
    } catch (error) {
      return this._handleError(error, 'updateSession', context, { sessionId, updateData });
    }
  }
  
  /**
   * セッションを終了
   * @param {string} sessionId - セッションID
   * @param {OperationContext} context - 操作コンテキスト（オプション）
   * @returns {Promise<Object>} 終了したセッション
   */
  async endSession(sessionId, context = null) {
    try {
      // コンテキストがない場合は作成
      const operationContext = context || this._createContext('endSession', { sessionId });
      
      this._validateParams({ sessionId }, ['sessionId']);
      
      const session = await this.manager.endSession(sessionId);
      
      // イベント発行
      this._emitEvent('session', 'session_ended', {
        id: sessionId,
        endTime: new Date().toISOString(),
        duration: session.duration || 0
      }, operationContext);
      
      return session;
    } catch (error) {
      return this._handleError(error, 'endSession', context, { sessionId });
    }
  }
  
  /**
   * セッションにタスクを関連付け
   * @param {string} sessionId - セッションID
   * @param {string} taskId - タスクID
   * @param {OperationContext} context - 操作コンテキスト（オプション）
   * @returns {Promise<Object>} 更新されたセッション
   */
  async addTaskToSession(sessionId, taskId, context = null) {
    try {
      // コンテキストがない場合は作成
      const operationContext = context || this._createContext('addTaskToSession', { sessionId, taskId });
      
      this._validateParams({ sessionId, taskId }, ['sessionId', 'taskId']);
      
      if (!taskId.match(/^T[0-9]{3}$/)) {
        throw new ValidationError('タスクIDはT000形式である必要があります');
      }
      
      const session = await this.manager.addTaskToSession(sessionId, taskId);
      
      // イベント発行
      this._emitEvent('session', 'task_added', {
        sessionId,
        taskId,
        timestamp: new Date().toISOString()
      }, operationContext);
      
      return session;
    } catch (error) {
      return this._handleError(error, 'addTaskToSession', context, { sessionId, taskId });
    }
  }
  
  /**
   * セッションからタスクを削除
   * @param {string} sessionId - セッションID
   * @param {string} taskId - タスクID
   * @param {OperationContext} context - 操作コンテキスト（オプション）
   * @returns {Promise<Object>} 更新されたセッション
   */
  async removeTaskFromSession(sessionId, taskId, context = null) {
    try {
      // コンテキストがない場合は作成
      const operationContext = context || this._createContext('removeTaskFromSession', {
        sessionId,
        taskId
      });
      
      this._validateParams({ sessionId, taskId }, ['sessionId', 'taskId']);
      
      if (!taskId.match(/^T[0-9]{3}$/)) {
        throw new ValidationError('タスクIDはT000形式である必要があります');
      }
      
      const session = await this.manager.removeTaskFromSession(sessionId, taskId);
      
      // イベント発行
      this._emitEvent('session', 'task_removed', {
        sessionId,
        taskId,
        timestamp: new Date().toISOString()
      }, operationContext);
      
      return session;
    } catch (error) {
      return this._handleError(error, 'removeTaskFromSession', context, { sessionId, taskId });
    }
  }
  
  /**
   * セッションにGitコミットを関連付け
   * @param {string} sessionId - セッションID
   * @param {string} commitHash - コミットハッシュ
   * @param {OperationContext} context - 操作コンテキスト（オプション）
   * @returns {Promise<Object>} 更新されたセッション
   */
  async addGitCommitToSession(sessionId, commitHash, context = null) {
    try {
      // コンテキストがない場合は作成
      const operationContext = context || this._createContext('addGitCommitToSession', {
        sessionId,
        commitHash
      });
      
      this._validateParams({ sessionId, commitHash }, ['sessionId', 'commitHash']);
      
      const session = await this.manager.addGitCommitToSession(sessionId, commitHash);
      
      // イベント発行
      this._emitEvent('session', 'git_commit_added', {
        sessionId,
        commitHash,
        timestamp: new Date().toISOString()
      }, operationContext);
      
      return session;
    } catch (error) {
      return this._handleError(error, 'addGitCommitToSession', context, { sessionId, commitHash });
    }
  }
  
  /**
   * セッションマークダウンを生成
   * @param {string} sessionId - セッションID
   * @param {OperationContext} context - 操作コンテキスト（オプション）
   * @returns {Promise<string>} マークダウン形式のセッション
   */
  async generateSessionMarkdown(sessionId, context = null) {
    try {
      // コンテキストがない場合は作成
      const operationContext = context || this._createContext('generateSessionMarkdown', { sessionId });
      
      this._validateParams({ sessionId }, ['sessionId']);
      
      const markdown = await this.manager.generateSessionMarkdown(sessionId);
      
      // イベント発行（オプション）
      if (markdown) {
        this._emitEvent('session', 'markdown_generated', {
          sessionId,
          contentLength: markdown.length,
          timestamp: new Date().toISOString()
        }, operationContext);
      }
      
      return markdown;
    } catch (error) {
      return this._handleError(error, 'generateSessionMarkdown', context, { sessionId });
    }
  }
}

module.exports = SessionManagerAdapter;