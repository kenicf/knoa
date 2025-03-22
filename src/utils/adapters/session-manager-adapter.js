/**
 * セッション管理アダプター
 * 
 * 既存のセッション管理コンポーネントをラップし、統合マネージャーとのインターフェースを提供します。
 */

const { ValidationError } = require('../errors');
const Validator = require('../validator');

/**
 * セッション管理インターフェース
 * @interface
 */
class SessionManagerInterface {
  /**
   * セッションを検証
   * @param {Session} session - 検証するセッション
   * @returns {boolean} 検証結果
   */
  validateSession(session) {}
  
  /**
   * 最新のセッションを取得
   * @returns {Promise<Session|null>} 最新のセッション
   */
  async getLatestSession() {}
  
  /**
   * セッションIDでセッションを取得
   * @param {string} sessionId - セッションID
   * @returns {Promise<Session|null>} セッション
   */
  async getSessionById(sessionId) {}
  
  /**
   * 新しいセッションを作成
   * @param {string} previousSessionId - 前回のセッションID
   * @returns {Promise<Session>} 新しいセッション
   */
  async createNewSession(previousSessionId) {}
  
  /**
   * セッションを更新
   * @param {string} sessionId - セッションID
   * @param {Object} updateData - 更新データ
   * @returns {Promise<Session>} 更新されたセッション
   */
  async updateSession(sessionId, updateData) {}
  
  /**
   * セッションをGit変更で更新
   * @param {string} sessionId - セッションID
   * @param {Array} commits - コミット情報の配列
   * @returns {Promise<Session>} 更新されたセッション
   */
  async updateSessionWithGitChanges(sessionId, commits) {}
  
  /**
   * key_artifactを追加
   * @param {string} sessionId - セッションID
   * @param {Object} artifact - key_artifact
   * @returns {Promise<Session>} 更新されたセッション
   */
  async addKeyArtifact(sessionId, artifact) {}
  
  /**
   * 課題を追加
   * @param {string} sessionId - セッションID
   * @param {Object} challenge - 課題
   * @returns {Promise<Session>} 更新されたセッション
   */
  async addChallenge(sessionId, challenge) {}
  
  /**
   * アクションアイテムを追加
   * @param {string} sessionId - セッションID
   * @param {Object} actionItem - アクションアイテム
   * @returns {Promise<Session>} 更新されたセッション
   */
  async addActionItem(sessionId, actionItem) {}
  
  /**
   * セッション引継ぎドキュメントを生成
   * @param {string} sessionId - セッションID
   * @returns {Promise<string>} マークダウン形式のドキュメント
   */
  async generateSessionHandoverMarkdown(sessionId) {}
}

/**
 * セッション管理アダプター
 */
class SessionManagerAdapter extends SessionManagerInterface {
  /**
   * コンストラクタ
   * @param {Object} originalSessionManager - 元のセッション管理インスタンス
   */
  constructor(originalSessionManager) {
    super();
    this.originalSessionManager = originalSessionManager;
  }
  
  /**
   * セッションを検証
   * @param {Session} session - 検証するセッション
   * @returns {boolean} 検証結果
   */
  validateSession(session) {
    return this.originalSessionManager.validateSession(session);
  }
  
  /**
   * 最新のセッションを取得
   * @returns {Promise<Session|null>} 最新のセッション
   */
  async getLatestSession() {
    try {
      return this.originalSessionManager.getLatestSession();
    } catch (error) {
      console.error('最新のセッションの取得に失敗しました:', error);
      throw error;
    }
  }
  
  /**
   * セッションIDでセッションを取得
   * @param {string} sessionId - セッションID
   * @returns {Promise<Session|null>} セッション
   */
  async getSessionById(sessionId) {
    try {
      if (!sessionId || typeof sessionId !== 'string') {
        throw new ValidationError('セッションIDは必須の文字列です');
      }
      
      return this.originalSessionManager.getSessionById(sessionId);
    } catch (error) {
      console.error(`セッション ${sessionId} の取得に失敗しました:`, error);
      throw error;
    }
  }
  
  /**
   * 新しいセッションを作成
   * @param {string} previousSessionId - 前回のセッションID
   * @returns {Promise<Session>} 新しいセッション
   */
  async createNewSession(previousSessionId) {
    try {
      const session = this.originalSessionManager.createNewSession(previousSessionId);
      
      if (!session) {
        throw new Error('セッションの作成に失敗しました');
      }
      
      // セッションを保存
      this.originalSessionManager.saveSession(session, true);
      
      return session;
    } catch (error) {
      console.error('新しいセッションの作成に失敗しました:', error);
      throw error;
    }
  }
  
  /**
   * セッションを更新
   * @param {string} sessionId - セッションID
   * @param {Object} updateData - 更新データ
   * @returns {Promise<Session>} 更新されたセッション
   */
  async updateSession(sessionId, updateData) {
    try {
      if (!sessionId || typeof sessionId !== 'string') {
        throw new ValidationError('セッションIDは必須の文字列です');
      }
      
      if (!updateData || typeof updateData !== 'object') {
        throw new ValidationError('更新データは必須のオブジェクトです');
      }
      
      // セッションを取得
      const session = await this.getSessionById(sessionId);
      
      if (!session) {
        throw new Error(`セッション ${sessionId} が見つかりません`);
      }
      
      // 更新データを適用
      for (const [key, value] of Object.entries(updateData)) {
        if (key === 'project_state_summary') {
          session.session_handover.project_state_summary = {
            ...session.session_handover.project_state_summary,
            ...value
          };
        } else {
          session.session_handover[key] = value;
        }
      }
      
      // セッションを保存
      this.originalSessionManager.saveSession(session, true);
      
      return session;
    } catch (error) {
      console.error(`セッション ${sessionId} の更新に失敗しました:`, error);
      throw error;
    }
  }
  
  /**
   * セッションをGit変更で更新
   * @param {string} sessionId - セッションID
   * @param {Array} commits - コミット情報の配列
   * @returns {Promise<Session>} 更新されたセッション
   */
  async updateSessionWithGitChanges(sessionId, commits) {
    try {
      if (!sessionId || typeof sessionId !== 'string') {
        throw new ValidationError('セッションIDは必須の文字列です');
      }
      
      if (!Array.isArray(commits)) {
        throw new ValidationError('コミット情報は配列である必要があります');
      }
      
      const updatedSession = this.originalSessionManager.updateSessionWithGitChanges(sessionId, commits);
      
      if (!updatedSession) {
        throw new Error(`セッション ${sessionId} のGit変更更新に失敗しました`);
      }
      
      // セッションを保存
      this.originalSessionManager.saveSession(updatedSession, true);
      
      return updatedSession;
    } catch (error) {
      console.error(`セッション ${sessionId} のGit変更更新に失敗しました:`, error);
      throw error;
    }
  }
  
  /**
   * key_artifactを追加
   * @param {string} sessionId - セッションID
   * @param {Object} artifact - key_artifact
   * @returns {Promise<Session>} 更新されたセッション
   */
  async addKeyArtifact(sessionId, artifact) {
    try {
      if (!sessionId || typeof sessionId !== 'string') {
        throw new ValidationError('セッションIDは必須の文字列です');
      }
      
      if (!artifact || typeof artifact !== 'object') {
        throw new ValidationError('key_artifactは必須のオブジェクトです');
      }
      
      if (!artifact.path || !artifact.description) {
        throw new ValidationError('key_artifactには path と description が必要です');
      }
      
      const updatedSession = this.originalSessionManager.addKeyArtifact(sessionId, artifact);
      
      if (!updatedSession) {
        throw new Error(`セッション ${sessionId} へのkey_artifact追加に失敗しました`);
      }
      
      // セッションを保存
      this.originalSessionManager.saveSession(updatedSession, true);
      
      return updatedSession;
    } catch (error) {
      console.error(`セッション ${sessionId} へのkey_artifact追加に失敗しました:`, error);
      throw error;
    }
  }
  
  /**
   * 課題を追加
   * @param {string} sessionId - セッションID
   * @param {Object} challenge - 課題
   * @returns {Promise<Session>} 更新されたセッション
   */
  async addChallenge(sessionId, challenge) {
    try {
      if (!sessionId || typeof sessionId !== 'string') {
        throw new ValidationError('セッションIDは必須の文字列です');
      }
      
      if (!challenge || typeof challenge !== 'object') {
        throw new ValidationError('challengeは必須のオブジェクトです');
      }
      
      if (!challenge.description) {
        throw new ValidationError('challengeには description が必要です');
      }
      
      const updatedSession = this.originalSessionManager.addChallenge(sessionId, challenge);
      
      if (!updatedSession) {
        throw new Error(`セッション ${sessionId} への課題追加に失敗しました`);
      }
      
      // セッションを保存
      this.originalSessionManager.saveSession(updatedSession, true);
      
      return updatedSession;
    } catch (error) {
      console.error(`セッション ${sessionId} への課題追加に失敗しました:`, error);
      throw error;
    }
  }
  
  /**
   * アクションアイテムを追加
   * @param {string} sessionId - セッションID
   * @param {Object} actionItem - アクションアイテム
   * @returns {Promise<Session>} 更新されたセッション
   */
  async addActionItem(sessionId, actionItem) {
    try {
      if (!sessionId || typeof sessionId !== 'string') {
        throw new ValidationError('セッションIDは必須の文字列です');
      }
      
      if (!actionItem || typeof actionItem !== 'object') {
        throw new ValidationError('actionItemは必須のオブジェクトです');
      }
      
      if (!actionItem.description) {
        throw new ValidationError('actionItemには description が必要です');
      }
      
      const updatedSession = this.originalSessionManager.addActionItem(sessionId, actionItem);
      
      if (!updatedSession) {
        throw new Error(`セッション ${sessionId} へのアクションアイテム追加に失敗しました`);
      }
      
      // セッションを保存
      this.originalSessionManager.saveSession(updatedSession, true);
      
      return updatedSession;
    } catch (error) {
      console.error(`セッション ${sessionId} へのアクションアイテム追加に失敗しました:`, error);
      throw error;
    }
  }
  
  /**
   * セッション引継ぎドキュメントを生成
   * @param {string} sessionId - セッションID
   * @returns {Promise<string>} マークダウン形式のドキュメント
   */
  async generateSessionHandoverMarkdown(sessionId) {
    try {
      if (!sessionId || typeof sessionId !== 'string') {
        throw new ValidationError('セッションIDは必須の文字列です');
      }
      
      return this.originalSessionManager.generateSessionHandoverMarkdown(sessionId);
    } catch (error) {
      console.error(`セッション ${sessionId} の引継ぎドキュメント生成に失敗しました:`, error);
      throw error;
    }
  }
}

module.exports = SessionManagerAdapter;