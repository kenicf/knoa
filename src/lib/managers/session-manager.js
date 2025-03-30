/**
 * セッション管理ユーティリティ
 *
 * セッション間の状態引継ぎを管理するためのユーティリティ関数群
 */

// スキーマの読み込み (現在は未使用)
// const sessionSchema = require('../../schemas/session.schema.json');

/**
 * セッション管理クラス
 */
class SessionManager {
  /**
   * コンストラクタ
   * @param {Object} options - オプションオブジェクト
   * @param {Object} options.storageService - ストレージサービス（必須）
   * @param {Object} options.gitService - Gitサービス（必須）
   * @param {Object} options.logger - ロガー
   * @param {Object} options.eventEmitter - イベントエミッター
   * @param {Object} options.errorHandler - エラーハンドラー
   * @param {Object} options.config - 設定オプション
   * @param {string} options.config.sessionsDir - セッションディレクトリのパス
   * @param {string} options.config.templateDir - テンプレートディレクトリのパス
   */
  constructor(options = {}) {
    // 必須依存関係の検証
    if (!options.storageService)
      throw new Error('SessionManager requires a storageService instance');
    if (!options.gitService)
      throw new Error('SessionManager requires a gitService instance');

    // 依存関係の設定
    this.storageService = options.storageService;
    this.gitService = options.gitService;
    this.logger = options.logger || console;
    this.eventEmitter = options.eventEmitter;
    this.errorHandler = options.errorHandler;

    // 設定オプションの設定
    this.config = options.config || {};
    this.sessionsDir = this.config.sessionsDir || 'ai-context/sessions';
    this.templateDir = this.config.templateDir || 'src/templates/docs';

    // ディレクトリの存在確認はstorageServiceに委譲
    this.storageService.ensureDirectoryExists(
      `${this.sessionsDir}/session-history`
    );

    this.logger.info('SessionManager initialized', {
      sessionsDir: this.sessionsDir,
      templateDir: this.templateDir,
    });

    // イベントエミッターが存在する場合はイベントを発行
    if (this.eventEmitter) {
      this.eventEmitter.emit('session:manager:initialized', {
        sessionsDir: this.sessionsDir,
        templateDir: this.templateDir,
      });
    }
  }

  /**
   * セッションを検証する
   * @param {Object} session - 検証するセッション
   * @returns {boolean} 検証結果
   */
  validateSession(session) {
    // 基本的な構造チェック
    if (!session || !session.session_handover) {
      this.logger.error('セッションオブジェクトが不正です');
      return false;
    }

    const handover = session.session_handover;

    // 必須フィールドのチェック
    const requiredFields = ['session_id', 'timestamp', 'project_state_summary'];
    for (const field of requiredFields) {
      // eslint-disable-next-line security/detect-object-injection
      if (!handover[field]) {
        this.logger.error(`必須フィールド ${field} がありません`);
        return false;
      }
    }

    // タイムスタンプの形式チェック
    if (handover.timestamp && !this._isValidISODate(handover.timestamp)) {
      this.logger.error(`不正なタイムスタンプ形式です: ${handover.timestamp}`);
      return false;
    }

    // プロジェクト状態サマリーの検証
    const summary = handover.project_state_summary;
    if (typeof summary !== 'object') {
      this.logger.error('プロジェクト状態サマリーがオブジェクトではありません');
      return false;
    }

    return true;
  }

  /**
   * 最新のセッションを取得する
   * @returns {Promise<Object|null>} 最新のセッション
   */
  async getLatestSession() {
    try {
      const latestSessionPath = `${this.sessionsDir}/latest-session.json`;

      if (!this.storageService.fileExists(latestSessionPath)) {
        return null;
      }

      const session = await this.storageService.readJSON(latestSessionPath);

      if (!session || !this.validateSession(session)) {
        return null;
      }

      return session;
    } catch (error) {
      if (this.errorHandler) {
        this.errorHandler.handle(error, 'SessionManager', 'getLatestSession');
      } else {
        this.logger.error('最新のセッションの取得に失敗しました:', error);
      }
      return null;
    }
  }

  /**
   * セッションIDでセッションを取得する
   * @param {string} sessionId - セッションID
   * @returns {Promise<Object|null>} セッション
   */
  async getSessionById(sessionId) {
    try {
      // セッションIDの検証
      if (!sessionId) {
        throw new Error('セッションIDが指定されていません');
      }

      // 履歴ディレクトリからセッションを検索
      const historyDir = `${this.sessionsDir}/session-history`;
      const files = await this.storageService.listFiles(historyDir);

      // セッションIDを含むファイル名を検索
      const sessionFile = files.find((file) => file.includes(sessionId));

      if (!sessionFile) {
        return null;
      }

      // ファイルからセッションを読み込み
      const session = await this.storageService.readJSON(
        `${historyDir}`,
        sessionFile
      );

      if (!session || !this.validateSession(session)) {
        return null;
      }

      return session;
    } catch (error) {
      if (this.errorHandler) {
        this.errorHandler.handle(error, 'SessionManager', 'getSessionById', {
          sessionId,
        });
      } else {
        this.logger.error(
          `セッションID ${sessionId} の取得に失敗しました:`,
          error
        );
      }
      return null;
    }
  }

  /**
   * ISO形式の日付文字列かどうかを検証する
   * @param {string} dateString - 検証する日付文字列
   * @returns {boolean} 検証結果
   * @private
   */
  _isValidISODate(dateString) {
    if (!/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z/.test(dateString)) {
      return false;
    }

    const date = new Date(dateString);
    return date instanceof Date && !isNaN(date);
  }
}

module.exports = {
  SessionManager,
};
