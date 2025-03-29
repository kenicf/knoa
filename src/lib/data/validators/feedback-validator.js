/**
 * フィードバックバリデータクラス
 *
 * フィードバックデータの検証を行うクラス。
 * フィードバックの基本構造、タスクID形式、状態などの検証を行います。
 */

/**
 * フィードバックバリデータクラス
 */
class FeedbackValidator {
  /**
   * コンストラクタ
   * @param {Object} options - オプション
   */
  constructor(options = {}) {
    // フィードバックの状態遷移の定義
    this.feedbackStateTransitions = options.feedbackStateTransitions || {
      open: ['in_progress', 'resolved', 'wontfix'],
      in_progress: ['resolved', 'wontfix', 'open'],
      resolved: ['open'],
      wontfix: ['open'],
    };

    // フィードバックの種類と優先度の重み付け
    this.feedbackTypeWeights = options.feedbackTypeWeights || {
      security: 5,
      functional: 5,
      performance: 4,
      ux: 3,
      code_quality: 2,
    };
  }

  /**
   * フィードバックを検証する
   * @param {Object} feedback - 検証するフィードバック
   * @returns {Object} 検証結果（isValid: boolean, errors: string[]）
   */
  validate(feedback) {
    const errors = [];

    // 基本的な構造チェック
    if (!feedback || !feedback.feedback_loop) {
      errors.push('フィードバックオブジェクトが不正です');
      return { isValid: false, errors };
    }

    const loop = feedback.feedback_loop;

    // 必須フィールドのチェック
    const requiredFields = [
      'task_id',
      'test_execution',
      'verification_results',
      'feedback_items',
      'status',
    ];
    for (const field of requiredFields) {
      if (!loop[field]) {
        errors.push(`必須フィールド ${field} がありません`);
      }
    }

    // タスクIDの形式チェック
    if (loop.task_id) {
      const taskPattern = /^T[0-9]{3}$/;
      if (!taskPattern.test(loop.task_id)) {
        errors.push(`不正なタスクID形式です: ${loop.task_id}`);
      }
    }

    // 状態のチェック
    if (loop.status) {
      const validStatuses = Object.keys(this.feedbackStateTransitions);
      if (!validStatuses.includes(loop.status)) {
        errors.push(`不正な状態です: ${loop.status}`);
      }
    }

    // フィードバックタイプのチェック
    if (loop.feedback_type) {
      const validTypes = Object.keys(this.feedbackTypeWeights);
      if (!validTypes.includes(loop.feedback_type)) {
        errors.push(`不正なフィードバックタイプです: ${loop.feedback_type}`);
      }
    }

    // テスト実行のチェック
    if (loop.test_execution) {
      if (typeof loop.test_execution !== 'object') {
        errors.push('test_execution はオブジェクトである必要があります');
      } else {
        // 必須フィールドのチェック
        const testExecRequiredFields = ['command', 'timestamp', 'environment'];
        for (const field of testExecRequiredFields) {
          if (!loop.test_execution[field]) {
            errors.push(`test_execution.${field} は必須です`);
          }
        }
      }
    }

    // テスト結果のチェック
    if (loop.test_results) {
      if (typeof loop.test_results !== 'object') {
        errors.push('test_results はオブジェクトである必要があります');
      } else {
        // summaryのチェック
        if (loop.test_results.summary) {
          const summary = loop.test_results.summary;

          // 数値フィールドのチェック
          const numericFields = [
            'total_tests',
            'passed_tests',
            'failed_tests',
            'skipped_tests',
            'success_rate',
          ];
          for (const field of numericFields) {
            if (summary[field] !== undefined) {
              if (typeof summary[field] !== 'number') {
                errors.push(
                  `test_results.summary.${field} は数値である必要があります`
                );
              }

              if (field !== 'success_rate' && summary[field] < 0) {
                errors.push(
                  `test_results.summary.${field} は 0 以上である必要があります`
                );
              }

              if (
                field === 'success_rate' &&
                (summary[field] < 0 || summary[field] > 100)
              ) {
                errors.push(
                  'test_results.summary.success_rate は 0 から 100 の間である必要があります'
                );
              }
            }
          }
        }

        // test_suitesのチェック
        if (loop.test_results.test_suites !== undefined) {
          if (!Array.isArray(loop.test_results.test_suites)) {
            errors.push('test_results.test_suites は配列である必要があります');
          } else {
            for (let i = 0; i < loop.test_results.test_suites.length; i++) {
              const suite = loop.test_results.test_suites[i];

              // 必須フィールドのチェック
              if (!suite.name) {
                errors.push(`test_results.test_suites[${i}].name は必須です`);
              }

              if (!suite.status) {
                errors.push(`test_results.test_suites[${i}].status は必須です`);
              } else if (
                !['passed', 'failed', 'skipped'].includes(suite.status)
              ) {
                errors.push(
                  `test_results.test_suites[${i}].status は passed, failed, skipped のいずれかである必要があります`
                );
              }
            }
          }
        }

        // failed_testsのチェック
        if (loop.test_results.failed_tests !== undefined) {
          if (!Array.isArray(loop.test_results.failed_tests)) {
            errors.push('test_results.failed_tests は配列である必要があります');
          } else {
            for (let i = 0; i < loop.test_results.failed_tests.length; i++) {
              const test = loop.test_results.failed_tests[i];

              // 必須フィールドのチェック
              if (!test.name) {
                errors.push(`test_results.failed_tests[${i}].name は必須です`);
              }

              if (!test.message) {
                errors.push(
                  `test_results.failed_tests[${i}].message は必須です`
                );
              }
            }
          }
        }
      }
    }

    // 検証結果のチェック
    if (loop.verification_results) {
      if (typeof loop.verification_results !== 'object') {
        errors.push('verification_results はオブジェクトである必要があります');
      } else {
        // 必須フィールドのチェック
        const verificationRequiredFields = ['status', 'timestamp'];
        for (const field of verificationRequiredFields) {
          if (!loop.verification_results[field]) {
            errors.push(`verification_results.${field} は必須です`);
          }
        }

        // statusのチェック
        if (
          loop.verification_results.status &&
          !['passed', 'failed', 'partial'].includes(
            loop.verification_results.status
          )
        ) {
          errors.push(
            'verification_results.status は passed, failed, partial のいずれかである必要があります'
          );
        }
      }
    }

    // フィードバック項目のチェック
    if (loop.feedback_items) {
      if (!Array.isArray(loop.feedback_items)) {
        errors.push('feedback_items は配列である必要があります');
      } else {
        for (let i = 0; i < loop.feedback_items.length; i++) {
          const item = loop.feedback_items[i];

          // 必須フィールドのチェック
          if (!item.description) {
            errors.push(`feedback_items[${i}].description は必須です`);
          }

          // typeのチェック
          if (
            item.type &&
            !['bug', 'improvement', 'suggestion', 'question'].includes(
              item.type
            )
          ) {
            errors.push(
              `feedback_items[${i}].type は bug, improvement, suggestion, question のいずれかである必要があります`
            );
          }

          // priorityのチェック
          if (
            item.priority &&
            !['high', 'medium', 'low'].includes(item.priority)
          ) {
            errors.push(
              `feedback_items[${i}].priority は high, medium, low のいずれかである必要があります`
            );
          }

          // locationのチェック
          if (item.location) {
            if (typeof item.location !== 'object') {
              errors.push(
                `feedback_items[${i}].location はオブジェクトである必要があります`
              );
            } else {
              if (!item.location.file) {
                errors.push(`feedback_items[${i}].location.file は必須です`);
              }
            }
          }
        }
      }
    }

    // 解決ステップのチェック
    if (loop.resolution_steps !== undefined) {
      if (!Array.isArray(loop.resolution_steps)) {
        errors.push('resolution_steps は配列である必要があります');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * フィードバックの状態遷移を検証する
   * @param {string} currentStatus - 現在の状態
   * @param {string} newStatus - 新しい状態
   * @returns {Object} 検証結果（isValid: boolean, error: string）
   */
  validateStatusTransition(currentStatus, newStatus) {
    // 状態のチェック
    const validStatuses = Object.keys(this.feedbackStateTransitions);

    if (!validStatuses.includes(currentStatus)) {
      return {
        isValid: false,
        error: `不正な現在の状態です: ${currentStatus}`,
      };
    }

    if (!validStatuses.includes(newStatus)) {
      return {
        isValid: false,
        error: `不正な新しい状態です: ${newStatus}`,
      };
    }

    // 状態遷移のチェック
    if (
      currentStatus !== newStatus &&
      !this.feedbackStateTransitions[currentStatus].includes(newStatus)
    ) {
      return {
        isValid: false,
        error: `${currentStatus} から ${newStatus} への遷移は許可されていません`,
      };
    }

    return {
      isValid: true,
    };
  }

  /**
   * フィードバックの優先度を計算する
   * @param {Object} feedback - フィードバックオブジェクト
   * @returns {number} 優先度スコア（1-10）
   */
  calculatePriority(feedback) {
    if (!feedback || !feedback.feedback_loop) {
      return 1;
    }

    let score = 0;
    const loop = feedback.feedback_loop;

    // フィードバックタイプによる重み付け
    const feedbackType = loop.feedback_type;
    if (feedbackType && this.feedbackTypeWeights[feedbackType]) {
      score += this.feedbackTypeWeights[feedbackType];
    }

    // テスト結果による重み付け
    const testResults = loop.test_results;
    if (testResults) {
      // 失敗したテストの数
      const failedTests = testResults.failed_tests || [];
      score += failedTests.length * 2;

      // 成功率
      const successRate = testResults.success_rate || 0;
      score += (100 - successRate) / 10;
    }

    // フィードバック項目による重み付け
    const feedbackItems = loop.feedback_items || [];
    score += feedbackItems.length;

    // 重要度の高いフィードバック項目
    const highPriorityItems = feedbackItems.filter(
      (item) => item.priority === 'high'
    );
    score += highPriorityItems.length * 2;

    return Math.min(10, Math.max(1, Math.round(score)));
  }
}

module.exports = { FeedbackValidator };
