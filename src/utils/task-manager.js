/**
 * タスク管理ユーティリティ
 * 
 * タスクの検証、依存関係管理、進捗管理、Git連携などの機能を提供します。
 */

// 進捗状態の定義
const PROGRESS_STATES = {
  not_started: {
    description: "タスクがまだ開始されていない状態",
    default_percentage: 0
  },
  planning: {
    description: "タスクの計画段階",
    default_percentage: 10
  },
  in_development: {
    description: "開発中の状態",
    default_percentage: 30
  },
  implementation_complete: {
    description: "実装が完了した状態",
    default_percentage: 60
  },
  in_review: {
    description: "レビュー中の状態",
    default_percentage: 70
  },
  review_complete: {
    description: "レビューが完了した状態",
    default_percentage: 80
  },
  in_testing: {
    description: "テスト中の状態",
    default_percentage: 90
  },
  completed: {
    description: "タスクが完了した状態",
    default_percentage: 100
  }
};

// 状態遷移の定義
const STATE_TRANSITIONS = {
  not_started: ["planning", "in_development"],
  planning: ["in_development"],
  in_development: ["implementation_complete", "in_review"],
  implementation_complete: ["in_review"],
  in_review: ["review_complete", "in_development"],
  review_complete: ["in_testing"],
  in_testing: ["completed", "in_development"],
  completed: []
};

/**
 * タスクを検証する
 * @param {Object} task - 検証するタスク
 * @returns {Object} 検証結果（isValid: boolean, errors: string[]）
 */
function validateTask(task) {
  const errors = [];
  
  // 必須フィールドの検証
  const requiredFields = ["id", "title", "description", "status", "dependencies"];
  for (const field of requiredFields) {
    if (!task[field]) {
      errors.push(`${field}は必須フィールドです`);
    }
  }
  
  // IDの形式検証
  if (task.id && !task.id.match(/^T[0-9]{3}$/)) {
    errors.push("IDはT001形式である必要があります");
  }
  
  // ステータスの検証
  const validStatuses = ["pending", "in_progress", "completed", "blocked"];
  if (task.status && !validStatuses.includes(task.status)) {
    errors.push(`ステータスは${validStatuses.join(", ")}のいずれかである必要があります`);
  }
  
  // 優先度の検証
  if (task.priority !== undefined) {
    if (!Number.isInteger(task.priority) || task.priority < 1 || task.priority > 5) {
      errors.push("優先度は1から5の整数である必要があります");
    }
  }
  
  // 見積もり時間の検証
  if (task.estimated_hours !== undefined) {
    if (typeof task.estimated_hours !== "number" || task.estimated_hours < 0) {
      errors.push("見積もり時間は0以上の数値である必要があります");
    }
  }
  
  // 進捗率の検証
  if (task.progress_percentage !== undefined) {
    if (!Number.isInteger(task.progress_percentage) || 
        task.progress_percentage < 0 || 
        task.progress_percentage > 100) {
      errors.push("進捗率は0から100の整数である必要があります");
    }
  }
  
  // 進捗状態の検証
  if (task.progress_state !== undefined) {
    if (!Object.keys(PROGRESS_STATES).includes(task.progress_state)) {
      errors.push(`進捗状態は${Object.keys(PROGRESS_STATES).join(", ")}のいずれかである必要があります`);
    }
  }
  
  // 依存関係の検証
  if (Array.isArray(task.dependencies)) {
    for (const dep of task.dependencies) {
      if (typeof dep === "object") {
        if (!dep.task_id) {
          errors.push("依存関係オブジェクトにはtask_idが必要です");
        } else if (!dep.task_id.match(/^T[0-9]{3}$/)) {
          errors.push("依存関係のtask_idはT001形式である必要があります");
        }
        
        if (dep.type && !["strong", "weak"].includes(dep.type)) {
          errors.push("依存関係のtypeはstrongまたはweakである必要があります");
        }
      } else if (typeof dep === "string") {
        if (!dep.match(/^T[0-9]{3}$/)) {
          errors.push("依存関係のIDはT001形式である必要があります");
        }
      } else {
        errors.push("依存関係は文字列またはオブジェクトである必要があります");
      }
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * 依存関係を検証する
 * @param {string} taskId - 検証するタスクのID
 * @param {Array} tasks - すべてのタスクの配列
 * @returns {Object} 検証結果（isValid: boolean, errors: string[], warnings: string[]）
 */
function checkDependencies(taskId, tasks) {
  const errors = [];
  const warnings = [];
  const visited = new Set();
  const path = [];
  
  // タスクを検索
  const task = tasks.find(t => t.id === taskId);
  if (!task) {
    errors.push(`タスク${taskId}が見つかりません`);
    return { isValid: false, errors, warnings };
  }
  
  // 循環依存のチェック
  function checkCyclicDependency(currentTaskId) {
    if (path.includes(currentTaskId)) {
      const cycle = [...path.slice(path.indexOf(currentTaskId)), currentTaskId];
      return `循環依存が検出されました: ${cycle.join(" -> ")}`;
    }
    
    if (visited.has(currentTaskId)) {
      return null;
    }
    
    visited.add(currentTaskId);
    path.push(currentTaskId);
    
    const currentTask = tasks.find(t => t.id === currentTaskId);
    if (!currentTask) {
      return `タスク${currentTaskId}が見つかりません`;
    }
    
    const dependencies = currentTask.dependencies || [];
    for (const dep of dependencies) {
      const depTaskId = typeof dep === "object" ? dep.task_id : dep;
      const error = checkCyclicDependency(depTaskId);
      if (error) {
        return error;
      }
    }
    
    path.pop();
    return null;
  }
  
  const cyclicError = checkCyclicDependency(taskId);
  if (cyclicError) {
    errors.push(cyclicError);
  }
  
  // 依存タスクの存在チェック
  const dependencies = task.dependencies || [];
  for (const dep of dependencies) {
    const depTaskId = typeof dep === "object" ? dep.task_id : dep;
    const depTask = tasks.find(t => t.id === depTaskId);
    
    if (!depTask) {
      errors.push(`依存タスク${depTaskId}が見つかりません`);
      continue;
    }
    
    // 強い依存関係の場合、依存タスクが完了しているかチェック
    const depType = typeof dep === "object" ? (dep.type || "strong") : "strong";
    if (depType === "strong" && depTask.status !== "completed") {
      warnings.push(`強い依存関係のタスク${depTaskId}がまだ完了していません`);
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * タスクの進捗率を計算する
 * @param {string} taskId - 計算するタスクのID
 * @param {Array} tasks - すべてのタスクの配列
 * @returns {number} 計算された進捗率（0-100）
 */
function calculateProgress(taskId, tasks) {
  const task = tasks.find(t => t.id === taskId);
  if (!task) {
    return 0;
  }
  
  // 進捗率が明示的に設定されている場合はそれを返す
  if (task.progress_percentage !== undefined) {
    return task.progress_percentage;
  }
  
  // 進捗状態から進捗率を推定
  if (task.progress_state && PROGRESS_STATES[task.progress_state]) {
    return PROGRESS_STATES[task.progress_state].default_percentage;
  }
  
  // ステータスから進捗率を推定
  switch (task.status) {
    case "completed":
      return 100;
    case "in_progress":
      return 50;
    case "blocked":
      return 25;
    case "pending":
    default:
      return 0;
  }
}

/**
 * ステータスでタスクをフィルタリングする
 * @param {Array} tasks - すべてのタスクの配列
 * @param {string} status - フィルタリングするステータス
 * @returns {Array} フィルタリングされたタスクの配列
 */
function getTasksByStatus(tasks, status) {
  return tasks.filter(task => task.status === status);
}

/**
 * 進捗状態でタスクをフィルタリングする
 * @param {Array} tasks - すべてのタスクの配列
 * @param {string} progressState - フィルタリングする進捗状態
 * @returns {Array} フィルタリングされたタスクの配列
 */
function getTasksByProgressState(tasks, progressState) {
  return tasks.filter(task => task.progress_state === progressState);
}

/**
 * Gitコミットハッシュでタスクをフィルタリングする
 * @param {Array} tasks - すべてのタスクの配列
 * @param {string} commitHash - フィルタリングするコミットハッシュ
 * @returns {Array} フィルタリングされたタスクの配列
 */
function getTasksWithGitCommit(tasks, commitHash) {
  return tasks.filter(task => 
    Array.isArray(task.git_commits) && 
    task.git_commits.includes(commitHash)
  );
}

/**
 * タスクの進捗を更新する
 * @param {string} taskId - 更新するタスクのID
 * @param {number} percentage - 新しい進捗率
 * @param {string} state - 新しい進捗状態
 * @param {Array} tasks - すべてのタスクの配列
 * @returns {Object} 更新結果（success: boolean, message: string, updatedTasks: Array）
 */
function updateTaskProgress(taskId, percentage, state, tasks) {
  const taskIndex = tasks.findIndex(t => t.id === taskId);
  if (taskIndex === -1) {
    return {
      success: false,
      message: `タスク${taskId}が見つかりません`,
      updatedTasks: tasks
    };
  }
  
  const task = { ...tasks[taskIndex] };
  const updatedTasks = [...tasks];
  let message = "";
  
  // 進捗率の更新
  if (percentage !== undefined) {
    if (percentage < 0 || percentage > 100 || !Number.isInteger(percentage)) {
      return {
        success: false,
        message: "進捗率は0から100の整数である必要があります",
        updatedTasks
      };
    }
    
    task.progress_percentage = percentage;
    message += `進捗率を${percentage}%に更新しました。`;
    
    // 進捗率に基づいてステータスを推定
    if (percentage === 100 && task.status !== "completed") {
      task.status = "completed";
      message += "ステータスを完了に更新しました。";
    } else if (percentage > 0 && task.status === "pending") {
      task.status = "in_progress";
      message += "ステータスを進行中に更新しました。";
    }
  }
  
  // 進捗状態の更新
  if (state !== undefined) {
    if (!Object.keys(PROGRESS_STATES).includes(state)) {
      return {
        success: false,
        message: `進捗状態は${Object.keys(PROGRESS_STATES).join(", ")}のいずれかである必要があります`,
        updatedTasks
      };
    }
    
    // 状態遷移の検証
    const currentState = task.progress_state || "not_started";
    if (state !== currentState && !STATE_TRANSITIONS[currentState].includes(state)) {
      return {
        success: false,
        message: `${currentState}から${state}への状態遷移は許可されていません`,
        updatedTasks
      };
    }
    
    task.progress_state = state;
    message += `進捗状態を${state}に更新しました。`;
    
    // 進捗状態に基づいて進捗率を推定（明示的に設定されていない場合）
    if (percentage === undefined) {
      task.progress_percentage = PROGRESS_STATES[state].default_percentage;
      message += `進捗率を${task.progress_percentage}%に更新しました。`;
    }
    
    // 進捗状態に基づいてステータスを推定
    if (state === "completed" && task.status !== "completed") {
      task.status = "completed";
      message += "ステータスを完了に更新しました。";
    } else if (state !== "not_started" && task.status === "pending") {
      task.status = "in_progress";
      message += "ステータスを進行中に更新しました。";
    }
  }
  
  updatedTasks[taskIndex] = task;
  
  return {
    success: true,
    message: message || "タスクの進捗を更新しました",
    updatedTasks
  };
}

/**
 * タスクにGitコミットを関連付ける
 * @param {string} taskId - 関連付けるタスクのID
 * @param {string} commitHash - 関連付けるコミットハッシュ
 * @param {Array} tasks - すべてのタスクの配列
 * @returns {Object} 更新結果（success: boolean, message: string, updatedTasks: Array）
 */
function addGitCommitToTask(taskId, commitHash, tasks) {
  const taskIndex = tasks.findIndex(t => t.id === taskId);
  if (taskIndex === -1) {
    return {
      success: false,
      message: `タスク${taskId}が見つかりません`,
      updatedTasks: tasks
    };
  }
  
  const task = { ...tasks[taskIndex] };
  const updatedTasks = [...tasks];
  
  // git_commitsフィールドがない場合は作成
  if (!Array.isArray(task.git_commits)) {
    task.git_commits = [];
  }
  
  // 既に関連付けられている場合は何もしない
  if (task.git_commits.includes(commitHash)) {
    return {
      success: true,
      message: `コミット${commitHash}は既にタスク${taskId}に関連付けられています`,
      updatedTasks
    };
  }
  
  // コミットを追加
  task.git_commits.push(commitHash);
  updatedTasks[taskIndex] = task;
  
  return {
    success: true,
    message: `コミット${commitHash}をタスク${taskId}に関連付けました`,
    updatedTasks
  };
}

/**
 * コミットメッセージからタスクIDを抽出する
 * @param {string} commitMessage - コミットメッセージ
 * @returns {Array} 抽出されたタスクIDの配列
 */
function extractTaskIdsFromCommitMessage(commitMessage) {
  const regex = /#(T[0-9]{3})/g;
  const matches = commitMessage.match(regex) || [];
  return matches.map(match => match.substring(1)); // #を除去
}

/**
 * 次の進捗状態を取得する
 * @param {string} currentState - 現在の進捗状態
 * @returns {string|null} 次の進捗状態、または選択肢がない場合はnull
 */
function getNextProgressState(currentState) {
  if (!currentState || !STATE_TRANSITIONS[currentState]) {
    return "not_started";
  }
  
  const nextStates = STATE_TRANSITIONS[currentState];
  return nextStates.length > 0 ? nextStates[0] : null;
}

/**
 * 古い形式のタスクを新しい形式に変換する
 * @param {Object} oldTask - 古い形式のタスク
 * @returns {Object} 新しい形式のタスク
 */
function migrateTaskToNewFormat(oldTask) {
  const newTask = { ...oldTask };
  
  // 依存関係の変換
  if (Array.isArray(oldTask.dependencies)) {
    newTask.dependencies = oldTask.dependencies.map(dep => {
      if (typeof dep === "string") {
        return {
          task_id: dep,
          type: "strong"
        };
      }
      return dep;
    });
  }
  
  // デフォルト値の設定
  if (newTask.priority === undefined) {
    newTask.priority = 3;
  }
  
  if (newTask.progress_percentage === undefined) {
    newTask.progress_percentage = newTask.status === "completed" ? 100 : 
                                 newTask.status === "in_progress" ? 50 : 0;
  }
  
  if (newTask.progress_state === undefined) {
    newTask.progress_state = newTask.status === "completed" ? "completed" : 
                            newTask.status === "in_progress" ? "in_development" : "not_started";
  }
  
  if (!Array.isArray(newTask.git_commits)) {
    newTask.git_commits = [];
  }
  
  return newTask;
}

module.exports = {
  validateTask,
  checkDependencies,
  calculateProgress,
  getTasksByStatus,
  getTasksByProgressState,
  getTasksWithGitCommit,
  updateTaskProgress,
  addGitCommitToTask,
  extractTaskIdsFromCommitMessage,
  getNextProgressState,
  migrateTaskToNewFormat,
  PROGRESS_STATES,
  STATE_TRANSITIONS
};