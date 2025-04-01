const colors = require('colors/safe');

/**
 * ワークフロー状態を表示する
 * @param {object} statusInfo - CliStatusViewer.getWorkflowStatus の戻り値
 */
function displayStatus(statusInfo) {
  console.log(colors.yellow('現在の状態:'), statusInfo.currentState);
  // タスク状態
  console.log(colors.yellow('\nタスク状態:'));
  console.log(`  タスク数: ${statusInfo.tasks.count}`);
  console.log(colors.yellow('  状態別カウント:'));
  console.log(`    完了: ${statusInfo.tasks.statusCounts.completed || 0}`);
  console.log(`    進行中: ${statusInfo.tasks.statusCounts.in_progress || 0}`);
  console.log(`    保留中: ${statusInfo.tasks.statusCounts.pending || 0}`);
  console.log(`    ブロック中: ${statusInfo.tasks.statusCounts.blocked || 0}`);
  if (statusInfo.tasks.currentFocus) {
    const focus = statusInfo.tasks.currentFocus;
    console.log(colors.yellow('\n  現在のフォーカス:'));
    console.log(`    - ${focus.id}: ${focus.title}`);
    console.log(`      状態: ${focus.status}, 進捗率: ${focus.progress}%`);
  }
  // セッション状態
  if (statusInfo.session) {
    console.log(colors.yellow('\nセッション状態:'));
    console.log(`  セッションID: ${statusInfo.session.id}`);
    console.log(`  タイムスタンプ: ${statusInfo.session.timestamp}`);
    if (statusInfo.session.previousSessionId) {
      console.log(
        `  前回のセッションID: ${statusInfo.session.previousSessionId}`
      );
    }
  } else {
    console.log(colors.yellow('\nアクティブなセッションはありません'));
  }
}

/**
 * セッション一覧を表示する
 * @param {Array<object>} sessions - CliSessionManager.listSessions の戻り値
 */
function displaySessionList(sessions) {
  if (!sessions || sessions.length === 0) {
    console.log(colors.yellow('セッションが見つかりません'));
    return;
  }
  console.log(colors.green(`\n${sessions.length}件のセッション:`));
  sessions.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)); // 日付順ソート
  sessions.forEach((session, index) => {
    const status = session.ended_at
      ? colors.red('終了')
      : colors.green('アクティブ');
    console.log(
      `${index + 1}. ${colors.yellow(session.session_id)} [${status}]`
    );
    console.log(`   作成: ${session.created_at}`);
    if (session.ended_at) console.log(`   終了: ${session.ended_at}`);
  });
}

/**
 * タスク一覧を表示する
 * @param {object} tasksResult - CliTaskManager.listTasks の戻り値
 */
function displayTaskList(tasksResult) {
  const tasks = tasksResult?.decomposed_tasks || [];
  if (tasks.length === 0) {
    console.log(colors.yellow('タスクが見つかりません'));
    return;
  }
  console.log(colors.green(`\n${tasks.length}件のタスク:`));
  // 状態別に表示
  const groupedTasks = tasks.reduce((groups, task) => {
    (groups[task.status] = groups[task.status] || []).push(task);
    return groups;
  }, {});

  const displayGroup = (title, group, colorFunc = colors.white) => {
    if (group && group.length > 0) {
      console.log(colorFunc(`\n${title}:`));
      group.forEach((task, index) => {
        let line = `${index + 1}. ${colors.yellow(task.id)}: ${task.title}`;
        if (task.status === 'in_progress') {
          line += ` (${task.progress_percentage || 0}%)`;
        }
        console.log(line);
      });
    }
  };

  displayGroup('進行中のタスク', groupedTasks.in_progress, colors.green);
  displayGroup('保留中のタスク', groupedTasks.pending, colors.yellow);
  displayGroup('完了したタスク', groupedTasks.completed, colors.blue);
  displayGroup('ブロックされたタスク', groupedTasks.blocked, colors.red);
}

/**
 * コマンド実行結果を表示する
 * @param {string} command - 実行されたコマンド名
 * @param {*} result - CliFacade.execute の戻り値
 */
function displayResult(command, result) {
  if (command === 'interactive' || result === undefined || result === null) {
    // interactive モード自体や、結果がない場合は何も表示しない
    return;
  }

  if (typeof result === 'object') {
    switch (command) {
      case 'status':
        displayStatus(result);
        break;
      case 'list-sessions':
        displaySessionList(result);
        break;
      case 'list-tasks':
        displayTaskList(result);
        break;
      // TODO: session-info, task-info, feedback-status など、
      //       整形表示が必要なコマンドをここに追加
      default:
        // その他のオブジェクト結果は JSON で表示 (暫定)
        console.log(JSON.stringify(result, null, 2));
        break;
    }
  } else if (typeof result === 'string') {
    // レポート内容やエクスポートパスなど
    console.log(result);
  }
  // boolean 結果などは特に表示しない
}

module.exports = {
  displayStatus,
  displaySessionList,
  displayTaskList,
  displayResult,
};
