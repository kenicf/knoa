/**
 * タスクバリデータクラス
 *
 * タスクデータの検証を行うクラス。
 * IDの形式、ステータス、優先度、見積もり時間、進捗率、進捗状態などの検証を行います。
 */

/**
 * タスクバリデータクラス
 */
class TaskValidator {
  /**
   * コンストラクタ
   * @param {Object} options - オプション
   */
  constructor(options = {}) {
    // 進捗状態の定義
    this.progressStates = options.progressStates || {
      not_started: {
        description: 'タスクがまだ開始されていない状態',
        default_percentage: 0,
      },
      planning: {
        description: 'タスクの計画段階',
        default_percentage: 10,
      },
      in_development: {
        description: '開発中の状態',
        default_percentage: 30,
      },
      implementation_complete: {
        description: '実装が完了した状態',
        default_percentage: 60,
      },
      in_review: {
        description: 'レビュー中の状態',
        default_percentage: 70,
      },
      review_complete: {
        description: 'レビューが完了した状態',
        default_percentage: 80,
      },
      in_testing: {
        description: 'テスト中の状態',
        default_percentage: 90,
      },
      completed: {
        description: 'タスクが完了した状態',
        default_percentage: 100,
      },
    };
  }

  /**
   * タスクを検証する
   * @param {Object} task - 検証するタスク
   * @returns {Object} 検証結果（isValid: boolean, errors: string[]）
   */
  validate(task) {
    const errors = [];

    // 必須フィールドの検証
    const requiredFields = [
      'id',
      'title',
      'description',
      'status',
      'dependencies',
    ];
    for (const field of requiredFields) {
      // eslint-disable-next-line security/detect-object-injection
      if (!task[field]) {
        errors.push(`${field}は必須フィールドです`);
      }
    }

    // IDの形式検証
    if (task.id && !task.id.match(/^T[0-9]{3}$/)) {
      errors.push('IDはT001形式である必要があります');
    }

    // ステータスの検証
    const validStatuses = ['pending', 'in_progress', 'completed', 'blocked'];
    if (task.status && !validStatuses.includes(task.status)) {
      errors.push(
        `ステータスは${validStatuses.join(', ')}のいずれかである必要があります`
      );
    }

    // 優先度の検証
    if (task.priority !== undefined) {
      if (
        !Number.isInteger(task.priority) ||
        task.priority < 1 ||
        task.priority > 5
      ) {
        errors.push('優先度は1から5の整数である必要があります');
      }
    }

    // 見積もり時間の検証
    if (task.estimated_hours !== undefined) {
      if (
        typeof task.estimated_hours !== 'number' ||
        task.estimated_hours < 0
      ) {
        errors.push('見積もり時間は0以上の数値である必要があります');
      }
    }

    // 進捗率の検証
    if (task.progress_percentage !== undefined) {
      if (
        !Number.isInteger(task.progress_percentage) ||
        task.progress_percentage < 0 ||
        task.progress_percentage > 100
      ) {
        errors.push('進捗率は0から100の整数である必要があります');
      }
    }

    // 進捗状態の検証
    if (task.progress_state !== undefined) {
      if (!this.progressStates[task.progress_state]) {
        errors.push(
          `進捗状態は${Object.keys(this.progressStates).join(', ')}のいずれかである必要があります`
        );
      }
    }

    // 依存関係の検証

    if (task.dependencies && Array.isArray(task.dependencies)) {
      for (let i = 0; i < task.dependencies.length; i++) {
        // eslint-disable-next-line security/detect-object-injection
        const dep = task.dependencies[i];

        // task_idの検証

        if (!dep.task_id) {
          errors.push(`依存関係[${i}]のtask_idは必須です`);
        } else if (!dep.task_id.match(/^T[0-9]{3}$/)) {
          errors.push(`依存関係[${i}]のtask_idはT001形式である必要があります`);
        }

        // typeの検証
        if (!dep.type) {
          errors.push(`依存関係[${i}]のtypeは必須です`);
        } else if (!['strong', 'weak'].includes(dep.type)) {
          errors.push(
            `依存関係[${i}]のtypeはstrong, weakのいずれかである必要があります`
          );
        }
      }
    }

    // git_commitsの検証
    if (task.git_commits !== undefined && !Array.isArray(task.git_commits)) {
      errors.push('git_commitsは配列である必要があります');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * タスク階層を検証する
   * @param {Object} hierarchy - 検証するタスク階層
   * @returns {Object} 検証結果（isValid: boolean, errors: string[]）
   */
  validateHierarchy(hierarchy) {
    const errors = [];

    // 基本的な構造チェック
    if (!hierarchy) {
      errors.push('タスク階層が指定されていません');
      return { isValid: false, errors };
    }

    // epicsの検証

    if (!hierarchy.epics || !Array.isArray(hierarchy.epics)) {
      errors.push('epicsは配列である必要があります');
    } else {
      for (let i = 0; i < hierarchy.epics.length; i++) {
        const epic = hierarchy.epics[i];

        // epic_idの検証

        if (!epic.epic_id) {
          errors.push(`epic[${i}]のepic_idは必須です`);
        } else if (!epic.epic_id.match(/^E[0-9]{3}$/)) {
          errors.push(`epic[${i}]のepic_idはE001形式である必要があります`);
        }

        // titleの検証
        if (!epic.title) {
          errors.push(`epic[${i}]のtitleは必須です`);
        }

        // storiesの検証

        if (!epic.stories || !Array.isArray(epic.stories)) {
          errors.push(`epic[${i}]のstoriesは配列である必要があります`);
        } else {
          for (let j = 0; j < epic.stories.length; j++) {
            const storyId = epic.stories[j];

            // story_idの検証
            if (!storyId.match(/^S[0-9]{3}$/)) {
              errors.push(
                `epic[${i}].stories[${j}]はS001形式である必要があります`
              );
            }
          }
        }
      }
    }

    // storiesの検証

    if (!hierarchy.stories || !Array.isArray(hierarchy.stories)) {
      errors.push('storiesは配列である必要があります');
    } else {
      for (let i = 0; i < hierarchy.stories.length; i++) {
        const story = hierarchy.stories[i];

        // story_idの検証
        if (!story.story_id) {
          errors.push(`story[${i}]のstory_idは必須です`);
        } else if (!story.story_id.match(/^S[0-9]{3}$/)) {
          errors.push(`story[${i}]のstory_idはS001形式である必要があります`);
        }

        // titleの検証

        if (!story.title) {
          errors.push(`story[${i}]のtitleは必須です`);
        }

        // tasksの検証

        if (!story.tasks || !Array.isArray(story.tasks)) {
          errors.push(`story[${i}]のtasksは配列である必要があります`);
        } else {
          for (let j = 0; j < story.tasks.length; j++) {
            // eslint-disable-next-line security/detect-object-injection
            const taskId = story.tasks[j];

            // task_idの検証
            if (!taskId.match(/^T[0-9]{3}$/)) {
              errors.push(
                `story[${i}].tasks[${j}]はT001形式である必要があります`
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
   * タスク依存関係を検証する
   * @param {Array} tasks - タスクの配列
   * @returns {Object} 検証結果（isValid: boolean, errors: string[], circularDependencies: Array}）
   */
  validateDependencies(tasks) {
    const errors = [];
    const circularDependencies = [];

    // 基本的な構造チェック
    if (!tasks || !Array.isArray(tasks)) {
      errors.push('tasksは配列である必要があります');
      return { isValid: false, errors, circularDependencies };
    }

    // 各タスクの依存関係をチェック
    for (const task of tasks) {
      if (!task.id) {
        continue;
      }

      const visited = new Set();
      const recursionStack = new Set();

      // 循環依存をチェックする深さ優先探索
      const checkCircularDependency = (currentId, path = []) => {
        if (recursionStack.has(currentId)) {
          const cycle = [...path, currentId];
          circularDependencies.push(cycle);
          return true;
        }

        if (visited.has(currentId)) {
          return false;
        }

        visited.add(currentId);
        recursionStack.add(currentId);

        const currentTask = tasks.find((t) => t.id === currentId);
        if (!currentTask || !currentTask.dependencies) {
          recursionStack.delete(currentId);
          return false;
        }

        for (const dep of currentTask.dependencies) {
          if (checkCircularDependency(dep.task_id, [...path, currentId])) {
            return true;
          }
        }

        recursionStack.delete(currentId);
        return false;
      };

      checkCircularDependency(task.id);
    }

    // 存在しない依存関係をチェック
    const taskIds = tasks.map((task) => task.id);

    for (const task of tasks) {
      if (!task.dependencies) {
        continue;
      }

      for (const dep of task.dependencies) {
        if (!taskIds.includes(dep.task_id)) {
          errors.push(
            `タスク ${task.id} の依存タスク ${dep.task_id} が存在しません`
          );
        }
      }
    }

    if (circularDependencies.length > 0) {
      for (const cycle of circularDependencies) {
        errors.push(`循環依存が検出されました: ${cycle.join(' -> ')}`);
      }
    }

    return {
      isValid: errors.length === 0 && circularDependencies.length === 0,
      errors,
      circularDependencies,
    };
  }
}

module.exports = { TaskValidator };
