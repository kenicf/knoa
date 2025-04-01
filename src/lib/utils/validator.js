/**
 * バリデーターユーティリティ
 *
 * 入力検証、アクセス制御、データ保護などのセキュリティ機能を提供します。
 */

// const { ValidationError } = require('./errors'); // 未使用のためコメントアウト

/**
 * バリデーターユーティリティクラス
 */
class Validator {
  /**
   * コンストラクタ
   * @param {Object} options - オプション (現在は未使用)
   */
  constructor(options = {}) {
    // コンストラクタは現在空です
  }

  // データ型固有の検証メソッド (validateTaskInput, validateSessionInput, validateFeedbackInput) は削除されました。
  // これらの検証は src/lib/data/validators/ 配下の各バリデータクラスに移行されます。

  /**
   * 文字列をサニタイズ
   * @param {string} str - サニタイズする文字列
   * @returns {string} サニタイズされた文字列
   */
  sanitizeString(str) {
    if (typeof str !== 'string') {
      return '';
    }

    // 基本的なサニタイズ処理
    return str
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

module.exports = Validator;
