/**
 * セッションバリデータクラス
 *
 * セッションデータの検証を行うクラス。
 * セッションの基本構造、プロジェクト状態サマリー、タスクID形式などの検証を行います。
 */

/**
 * セッションバリデータクラス
 */
class SessionValidator {
  /**
   * コンストラクタ
   * @param {Object} options - オプション
   */
  constructor(options = {}) {
    // オプション
  }

  /**
   * セッションを検証する
   * @param {Object} session - 検証するセッション
   * @returns {Object} 検証結果（isValid: boolean, errors: string[]）
   */
  validate(session) {
    const errors = [];

    // 基本的な構造チェック
    if (!session || !session.session_handover) {
      errors.push('セッションオブジェクトが不正です');
      return { isValid: false, errors };
    }

    const handover = session.session_handover;

    // 必須フィールドのチェック
    const requiredFields = [
      'project_id',
      'session_id',
      'session_timestamp',
      'project_state_summary',
      'next_session_focus',
    ];
    for (const field of requiredFields) {
      // eslint-disable-next-line security/detect-object-injection
      if (!handover[field]) {
        errors.push(`必須フィールド ${field} がありません`);
      }
    }

    // project_state_summaryのチェック
    if (handover.project_state_summary) {
      const stateSummary = handover.project_state_summary;
      if (
        !stateSummary.completed_tasks ||
        !Array.isArray(stateSummary.completed_tasks)
      ) {
        errors.push(
          'project_state_summary.completed_tasks は配列である必要があります'
        );
      }

      if (
        !stateSummary.current_tasks ||
        !Array.isArray(stateSummary.current_tasks)
      ) {
        errors.push(
          'project_state_summary.current_tasks は配列である必要があります'
        );
      }

      if (
        !stateSummary.pending_tasks ||
        !Array.isArray(stateSummary.pending_tasks)
      ) {
        errors.push(
          'project_state_summary.pending_tasks は配列である必要があります'
        );
      }

      // blocked_tasksは必須ではないが、存在する場合は配列であること
      if (
        stateSummary.blocked_tasks !== undefined &&
        !Array.isArray(stateSummary.blocked_tasks)
      ) {
        errors.push(
          'project_state_summary.blocked_tasks は配列である必要があります'
        );
      }

      // タスクIDの形式チェック
      const taskPattern = /^T[0-9]{3}$/;
      const allTasks = [
        ...stateSummary.completed_tasks,
        ...stateSummary.current_tasks,
        ...stateSummary.pending_tasks,
        ...(stateSummary.blocked_tasks || []),
      ];

      for (const taskId of allTasks) {
        if (!taskPattern.test(taskId)) {
          errors.push(`不正なタスクID形式です: ${taskId}`);
        }
      }
    } else {
      errors.push('project_state_summary がありません');
    }

    // key_artifactsのチェック
    if (handover.key_artifacts !== undefined) {
      if (!Array.isArray(handover.key_artifacts)) {
        errors.push('key_artifacts は配列である必要があります');
      } else {
        for (let i = 0; i < handover.key_artifacts.length; i++) {
          // eslint-disable-next-line security/detect-object-injection
          const artifact = handover.key_artifacts[i];

          // 必須フィールドのチェック

          if (!artifact.path) {
            errors.push(`key_artifacts[${i}].path は必須です`);
          }

          if (!artifact.description) {
            errors.push(`key_artifacts[${i}].description は必須です`);
          }

          // git_statusのチェック
          if (
            artifact.git_status &&
            !['added', 'modified', 'deleted', 'unchanged'].includes(
              artifact.git_status
            )
          ) {
            errors.push(
              `key_artifacts[${i}].git_status は added, modified, deleted, unchanged のいずれかである必要があります`
            );
          }

          // importanceのチェック
          if (
            artifact.importance &&
            !['high', 'medium', 'low'].includes(artifact.importance)
          ) {
            errors.push(
              `key_artifacts[${i}].importance は high, medium, low のいずれかである必要があります`
            );
          }

          // related_tasksのチェック
          if (artifact.related_tasks !== undefined) {
            if (!Array.isArray(artifact.related_tasks)) {
              errors.push(
                `key_artifacts[${i}].related_tasks は配列である必要があります`
              );
            } else {
              const taskPattern = /^T[0-9]{3}$/;

              for (let j = 0; j < artifact.related_tasks.length; j++) {
                // eslint-disable-next-line security/detect-object-injection
                const taskId = artifact.related_tasks[j];
                if (!taskPattern.test(taskId)) {
                  errors.push(
                    `key_artifacts[${i}].related_tasks[${j}] は T001 形式である必要があります`
                  );
                }
              }
            }
          }
        }
      }
    }

    // git_changesのチェック
    if (handover.git_changes !== undefined) {
      if (typeof handover.git_changes !== 'object') {
        errors.push('git_changes はオブジェクトである必要があります');
      } else {
        // commitsのチェック

        if (handover.git_changes.commits !== undefined) {
          if (!Array.isArray(handover.git_changes.commits)) {
            errors.push('git_changes.commits は配列である必要があります');
          } else {
            for (let i = 0; i < handover.git_changes.commits.length; i++) {
              // eslint-disable-next-line security/detect-object-injection
              const commit = handover.git_changes.commits[i];

              // 必須フィールドのチェック

              if (!commit.hash) {
                errors.push(`git_changes.commits[${i}].hash は必須です`);
              }

              if (!commit.message) {
                errors.push(`git_changes.commits[${i}].message は必須です`);
              }

              if (!commit.timestamp) {
                errors.push(`git_changes.commits[${i}].timestamp は必須です`);
              }

              // related_tasksのチェック

              if (commit.related_tasks !== undefined) {
                if (!Array.isArray(commit.related_tasks)) {
                  errors.push(
                    `git_changes.commits[${i}].related_tasks は配列である必要があります`
                  );
                } else {
                  const taskPattern = /^T[0-9]{3}$/;
                  for (let j = 0; j < commit.related_tasks.length; j++) {
                    const taskId = commit.related_tasks[j];
                    if (!taskPattern.test(taskId)) {
                      errors.push(
                        `git_changes.commits[${i}].related_tasks[${j}] は T001 形式である必要があります`
                      );
                    }
                  }
                }
              }
            }
          }
        }

        // summaryのチェック
        if (handover.git_changes.summary !== undefined) {
          if (typeof handover.git_changes.summary !== 'object') {
            errors.push(
              'git_changes.summary はオブジェクトである必要があります'
            );
          } else {
            // 数値フィールドのチェック
            const numericFields = [
              'files_added',
              'files_modified',
              'files_deleted',
              'lines_added',
              'lines_deleted',
            ];
            for (const field of numericFields) {
              if (
                handover.git_changes.summary[field] !== undefined &&
                // eslint-disable-next-line security/detect-object-injection
                (typeof handover.git_changes.summary[field] !== 'number' ||
                  // eslint-disable-next-line security/detect-object-injection
                  handover.git_changes.summary[field] < 0)
              ) {
                errors.push(
                  `git_changes.summary.${field} は 0 以上の数値である必要があります`
                );
              }
            }
          }
        }
      }
    }

    // current_challengesのチェック
    if (handover.current_challenges !== undefined) {
      if (!Array.isArray(handover.current_challenges)) {
        errors.push('current_challenges は配列である必要があります');
      } else {
        for (let i = 0; i < handover.current_challenges.length; i++) {
          const challenge = handover.current_challenges[i];

          // 必須フィールドのチェック
          if (!challenge.description) {
            errors.push(`current_challenges[${i}].description は必須です`);
          }

          // statusのチェック
          if (
            challenge.status &&
            !['pending', 'in_progress', 'resolved', 'wontfix'].includes(
              challenge.status
            )
          ) {
            errors.push(
              `current_challenges[${i}].status は pending, in_progress, resolved, wontfix のいずれかである必要があります`
            );
          }

          // priorityのチェック
          if (challenge.priority !== undefined) {
            if (
              !Number.isInteger(challenge.priority) ||
              challenge.priority < 1 ||
              challenge.priority > 5
            ) {
              errors.push(
                `current_challenges[${i}].priority は 1 から 5 の整数である必要があります`
              );
            }
          }

          // severityのチェック
          if (challenge.severity !== undefined) {
            if (
              !Number.isInteger(challenge.severity) ||
              challenge.severity < 1 ||
              challenge.severity > 5
            ) {
              errors.push(
                `current_challenges[${i}].severity は 1 から 5 の整数である必要があります`
              );
            }
          }

          // related_tasksのチェック

          if (challenge.related_tasks !== undefined) {
            if (!Array.isArray(challenge.related_tasks)) {
              errors.push(
                `current_challenges[${i}].related_tasks は配列である必要があります`
              );
            } else {
              const taskPattern = /^T[0-9]{3}$/;

              for (let j = 0; j < challenge.related_tasks.length; j++) {
                // eslint-disable-next-line security/detect-object-injection
                const taskId = challenge.related_tasks[j];

                if (!taskPattern.test(taskId)) {
                  errors.push(
                    `current_challenges[${i}].related_tasks[${j}] は T001 形式である必要があります`
                  );
                }
              }
            }
          }
        }
      }
    }

    // action_itemsのチェック
    if (handover.action_items !== undefined) {
      if (!Array.isArray(handover.action_items)) {
        errors.push('action_items は配列である必要があります');
      } else {
        for (let i = 0; i < handover.action_items.length; i++) {
          const item = handover.action_items[i];

          // 必須フィールドのチェック
          if (!item.description) {
            errors.push(`action_items[${i}].description は必須です`);
          }

          // statusのチェック
          if (
            item.status &&
            !['pending', 'in_progress', 'completed', 'cancelled'].includes(
              item.status
            )
          ) {
            errors.push(
              `action_items[${i}].status は pending, in_progress, completed, cancelled のいずれかである必要があります`
            );
          }

          // priorityのチェック
          if (item.priority !== undefined) {
            if (
              !Number.isInteger(item.priority) ||
              item.priority < 1 ||
              item.priority > 5
            ) {
              errors.push(
                `action_items[${i}].priority は 1 から 5 の整数である必要があります`
              );
            }
          }

          // related_taskのチェック
          if (item.related_task !== undefined) {
            const taskPattern = /^T[0-9]{3}$/;
            if (!taskPattern.test(item.related_task)) {
              errors.push(
                `action_items[${i}].related_task は T001 形式である必要があります`
              );
            }
          }
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * セッション間の状態変化を検証する
   * @param {Object} previousSession - 前回のセッション
   * @param {Object} currentSession - 現在のセッション
   * @returns {Object} 検証結果（isValid: boolean, errors: string[], warnings: string[]）
   */
  validateStateChanges(previousSession, currentSession) {
    const errors = [];
    const warnings = [];

    // 基本的な構造チェック
    if (!previousSession || !previousSession.session_handover) {
      errors.push('前回のセッションオブジェクトが不正です');
      return { isValid: false, errors, warnings };
    }

    if (!currentSession || !currentSession.session_handover) {
      errors.push('現在のセッションオブジェクトが不正です');
      return { isValid: false, errors, warnings };
    }

    const prevHandover = previousSession.session_handover;
    const currHandover = currentSession.session_handover;

    // セッションIDの連続性チェック
    if (currHandover.previous_session_id !== prevHandover.session_id) {
      errors.push(
        `セッションIDの連続性が不正です: ${prevHandover.session_id} -> ${currHandover.previous_session_id}`
      );
    }

    // タイムスタンプの連続性チェック
    const prevTimestamp = new Date(prevHandover.session_timestamp);
    const currTimestamp = new Date(currHandover.session_timestamp);

    if (currTimestamp < prevTimestamp) {
      errors.push(
        `セッションタイムスタンプの連続性が不正です: ${prevHandover.session_timestamp} -> ${currHandover.session_timestamp}`
      );
    }

    // プロジェクト状態サマリーの整合性チェック
    if (
      prevHandover.project_state_summary &&
      currHandover.project_state_summary
    ) {
      const prevState = prevHandover.project_state_summary;
      const currState = currHandover.project_state_summary;

      // 完了したタスクが減っていないかチェック
      for (const taskId of prevState.completed_tasks) {
        if (!currState.completed_tasks.includes(taskId)) {
          warnings.push(
            `完了したタスク ${taskId} が現在のセッションで完了状態ではなくなっています`
          );
        }
      }

      // すべてのタスクが存在するかチェック
      const prevAllTasks = [
        ...prevState.completed_tasks,
        ...prevState.current_tasks,
        ...prevState.pending_tasks,
        ...(prevState.blocked_tasks || []),
      ];

      const currAllTasks = [
        ...currState.completed_tasks,
        ...currState.current_tasks,
        ...currState.pending_tasks,
        ...(currState.blocked_tasks || []),
      ];

      for (const taskId of prevAllTasks) {
        if (!currAllTasks.includes(taskId)) {
          warnings.push(
            `タスク ${taskId} が現在のセッションで存在しなくなっています`
          );
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }
}

module.exports = { SessionValidator };
