const colors = require('colors/safe');

/**
 * ワークフロー状態情報を整形して文字列として返す
 * @param {object} statusInfo - CliStatusViewer.getWorkflowStatus の戻り値
 * @param {string} statusInfo.currentState - 現在の状態
 * @param {object} statusInfo.tasks - タスク情報
 * @param {number} statusInfo.tasks.count - タスク総数
 * @param {object} statusInfo.tasks.statusCounts - 状態別タスク数
 * @param {object|null} statusInfo.tasks.currentFocus - フォーカス中のタスク情報
 * @param {object|null} statusInfo.session - 現在のセッション情報
 * @returns {string} 整形された状態文字列
 */
function formatStatus(statusInfo) {
  let output = colors.yellow('現在の状態:') + ` ${statusInfo.currentState}\n`;
  output += colors.yellow('\nタスク状態:') + '\n';
  output += `  タスク数: ${statusInfo.tasks.count}\n`;
  output += colors.yellow('  状態別カウント:') + '\n';
  output += `    完了: ${statusInfo.tasks.statusCounts.completed || 0}\n`;
  output += `    進行中: ${statusInfo.tasks.statusCounts.in_progress || 0}\n`;
  output += `    保留中: ${statusInfo.tasks.statusCounts.pending || 0}\n`;
  output += `    ブロック中: ${statusInfo.tasks.statusCounts.blocked || 0}\n`;
  if (statusInfo.tasks.currentFocus) {
    const focus = statusInfo.tasks.currentFocus;
    output += colors.yellow('\n  現在のフォーカス:') + '\n';
    output += `    - ${focus.id}: ${focus.title}\n`;
    output += `      状態: ${focus.status}, 進捗率: ${focus.progress}%\n`;
  }
  if (statusInfo.session) {
    output += colors.yellow('\nセッション状態:') + '\n';
    output += `  セッションID: ${statusInfo.session.id}\n`;
    output += `  タイムスタンプ: ${statusInfo.session.timestamp}\n`;
    if (statusInfo.session.previousSessionId) {
      output += `  前回のセッションID: ${statusInfo.session.previousSessionId}\n`;
    }
  } else {
    output += colors.yellow('\nアクティブなセッションはありません') + '\n';
  }
  return output.trim(); // 末尾の改行を削除
}

/**
 * セッション一覧を整形して文字列として返す
 * @param {Array<object>} sessions - CliSessionManager.listSessions の戻り値
 * @returns {string} 整形されたセッション一覧文字列
 */
function formatSessionList(sessions) {
  if (!sessions || sessions.length === 0) {
    return colors.yellow('セッションが見つかりません');
  }
  let output = colors.green(`\n${sessions.length}件のセッション:\n`);
  sessions.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  sessions.forEach((session, index) => {
    const status = session.ended_at
      ? colors.red('終了')
      : colors.green('アクティブ');
    output += `${index + 1}. ${colors.yellow(session.session_id)} [${status}]\n`;
    output += `   作成: ${session.created_at}\n`;
    if (session.ended_at) output += `   終了: ${session.ended_at}\n`;
  });
  return output.trim();
}

/**
 * タスク一覧を整形して文字列として返す
 * @param {object} tasksResult - CliTaskManager.listTasks の戻り値
 * @param {Array<object>} [tasksResult.decomposed_tasks=[]] - タスクの配列
 * @returns {string} 整形されたタスク一覧文字列
 */
function formatTaskList(tasksResult) {
  const tasks = tasksResult?.decomposed_tasks || [];
  if (tasks.length === 0) {
    return colors.yellow('タスクが見つかりません');
  }
  let output = colors.green(`\n${tasks.length}件のタスク:\n`);
  const groupedTasks = tasks.reduce((groups, task) => {
    (groups[task.status] = groups[task.status] || []).push(task);
    return groups;
  }, {});

  const formatGroup = (title, group, colorFunc = colors.white) => {
    let groupOutput = '';
    if (group && group.length > 0) {
      groupOutput += colorFunc(`\n${title}:\n`);
      group.forEach((task, index) => {
        let line = `${index + 1}. ${colors.yellow(task.id)}: ${task.title}`;
        if (task.status === 'in_progress') {
          line += ` (${task.progress_percentage || 0}%)`;
        }
        groupOutput += line + '\n';
      });
    }
    return groupOutput;
  };

  output += formatGroup(
    '進行中のタスク',
    groupedTasks.in_progress,
    colors.green
  );
  output += formatGroup('保留中のタスク', groupedTasks.pending, colors.yellow);
  output += formatGroup('完了したタスク', groupedTasks.completed, colors.blue);
  output += formatGroup(
    'ブロックされたタスク',
    groupedTasks.blocked,
    colors.red
  );

  return output.trim();
}

/**
 * セッション詳細情報を整形して文字列として返す
 * @param {object|null} session - セッション情報オブジェクト、または null
 * @returns {string} 整形されたセッション情報文字列
 */
function formatSessionInfo(session) {
  if (!session) {
    return colors.yellow('セッション情報が見つかりません。');
  }
  let output = colors.yellow(`\nセッション情報 (${session.session_id}):\n`);
  output += `  作成日時: ${session.created_at}\n`;
  output += `  終了日時: ${session.ended_at || '未終了'}\n`;
  if (session.previous_session_id) {
    output += `  前回のセッションID: ${session.previous_session_id}\n`;
  }
  if (session.session_handover) {
    output += colors.yellow('  引継ぎ情報:') + '\n';
    output += `    プロジェクトID: ${session.session_handover.project_id}\n`;
    output += `    タイムスタンプ: ${session.session_handover.session_timestamp}\n`;
    // 必要に応じてサマリーなども追加
  }
  return output.trim();
}

/**
 * タスク詳細情報を整形して文字列として返す
 * @param {object|null} task - タスク情報オブジェクト、または null
 * @returns {string} 整形されたタスク情報文字列
 */
function formatTaskInfo(task) {
  if (!task) {
    return colors.yellow('タスク情報が見つかりません。');
  }
  let output = colors.yellow(`\nタスク情報 (${task.id}):\n`);
  output += `  タイトル: ${task.title}\n`;
  output += `  説明: ${task.description}\n`;
  output += `  状態: ${task.status}\n`;
  output += `  優先度: ${task.priority}\n`;
  output += `  進捗率: ${task.progress_percentage || 0}%\n`;
  if (task.estimated_hours) {
    output += `  見積もり時間: ${task.estimated_hours} 時間\n`;
  }
  if (task.dependencies && task.dependencies.length > 0) {
    output += `  依存関係: ${task.dependencies.map((d) => d.task_id).join(', ')}\n`;
  }
  if (task.git_commits && task.git_commits.length > 0) {
    output += `  関連コミット: ${task.git_commits.join(', ')}\n`;
  }
  output += `  作成日時: ${task.created_at}\n`;
  output += `  更新日時: ${task.updated_at}\n`;
  return output.trim();
}

/**
 * フィードバック状態情報を整形して文字列として返す
 * @param {object|null} feedback - フィードバック情報オブジェクト、または null
 * @returns {string} 整形されたフィードバック状態文字列
 */
function formatFeedbackStatus(feedback) {
  if (!feedback || !feedback.feedback_loop) {
    return colors.yellow('フィードバック情報が見つかりません。');
  }
  const loop = feedback.feedback_loop;
  let output = colors.yellow(
    `\nフィードバック状態 (タスク: ${loop.task_id}):\n`
  );
  output += `  状態: ${loop.feedback_status || 'N/A'}\n`;
  output += `  テスト結果: ${loop.verification_results?.passes_tests ? colors.green('成功') : colors.red('失敗')}\n`;
  if (loop.verification_results?.details) {
    output += `  詳細: ${loop.verification_results.details}\n`;
  }
  if (loop.analysis_results?.summary) {
    output += `  分析サマリー: ${loop.analysis_results.summary}\n`;
  }
  if (loop.related_commits && loop.related_commits.length > 0) {
    output += `  関連コミット: ${loop.related_commits.join(', ')}\n`;
  }
  if (loop.related_sessions && loop.related_sessions.length > 0) {
    output += `  関連セッション: ${loop.related_sessions.join(', ')}\n`;
  }
  output += `  最終更新: ${loop.updated_at}\n`;
  return output.trim();
}

/**
 * コマンド実行結果を整形して文字列として返す
 * @param {string} command - 実行されたコマンド名
 * @param {*} result - CliFacade.execute の戻り値
 * @returns {string|null} 整形された結果文字列、または表示不要な場合は null
 */
function formatResult(command, result) {
  if (command === 'interactive' || result === undefined || result === null) {
    // interactive モード自体や、結果がない場合は何も表示しない
    return null;
  }

  if (typeof result === 'object') {
    switch (command) {
      case 'status':
        return formatStatus(result);
      case 'list-sessions':
        return formatSessionList(result);
      case 'list-tasks':
        return formatTaskList(result);
      case 'session-info':
      case 'current-session': // current-session も session-info と同じフォーマットを使う
        return formatSessionInfo(result);
      case 'task-info':
        return formatTaskInfo(result);
      case 'feedback-status':
        return formatFeedbackStatus(result);
      default:
        // その他のオブジェクト結果は JSON で表示
        return JSON.stringify(result, null, 2);
    }
  } else if (typeof result === 'string') {
    // レポート内容やエクスポートパスなど
    return result;
  } else if (typeof result === 'boolean') {
    // boolean 結果は完了メッセージを表示
    return colors.green(`${command} コマンドが正常に完了しました。`);
  } else if (typeof result === 'number') {
    // 数値も JSON 文字列として表示
    return JSON.stringify(result, null, 2);
  }
  // その他の型は表示しない
  return null;
}

/**
 * 整形された結果をコンソールに出力する (下位互換性のため残す)
 * @deprecated formatResult を使用し、出力は呼び出し元で行うことを推奨
 * @param {string} command - 実行されたコマンド名
 * @param {*} result - CliFacade.execute の戻り値
 */
function displayResult(command, result) {
  const formattedOutput = formatResult(command, result);
  if (formattedOutput !== null) {
    console.log(formattedOutput);
  }
}

module.exports = {
  formatStatus,
  formatSessionList,
  formatTaskList,
  formatSessionInfo,
  formatTaskInfo,
  formatFeedbackStatus,
  formatResult,
  displayResult, // 下位互換性のために残す
};
