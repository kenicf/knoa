#!/usr/bin/env node
/**
 * タスク管理CLI
 *
 * タスク管理ユーティリティを使用するためのコマンドラインインターフェース
 */

const fs = require('fs');
const colors = require('colors/safe');

// 依存性注入
const ServiceContainer = require('../lib/core/service-container');
const { registerServices } = require('../lib/core/service-definitions');
const config = require('../config');

// サービスコンテナの作成と初期化
const container = new ServiceContainer();
registerServices(container, config);

// タスクマネージャーのインスタンスを取得（アダプター経由）
const taskManager = container.get('taskManagerAdapter');

// コマンドライン引数の解析
const args = process.argv.slice(2);
const command = args[0];

// ヘルプメッセージ
const helpMessage = `
タスク管理CLI

使用方法:
  node task.js <コマンド> [オプション]

コマンド:
  create <title> <description>  - 新しいタスクを作成
  list                          - タスク一覧を表示
  info <task-id>                - タスク情報を表示
  update <task-id> <status>     - タスク状態を更新
  progress <task-id> <progress> - タスク進捗を更新
  delete <task-id>              - タスクを削除
  link <task-id> <commit-hash>  - タスクにGitコミットを関連付け
  export <task-id> [path]       - タスク情報をエクスポート
  import <path>                 - タスク情報をインポート
  help                          - このヘルプメッセージを表示

例:
  node task.js create "タスクタイトル" "タスク説明"
  node task.js list
  node task.js update T001 in_progress
  node task.js progress T001 50
`;

/**
 * メイン関数
 */
async function main() {
  if (!command || command === 'help') {
    console.log(helpMessage);
    return;
  }

  switch (command) {
    case 'create': {
      const title = args[1];
      const description = args[2];

      if (!title) {
        console.error(colors.red('タイトルを指定してください'));
        console.log('使用方法: node task.js create <title> <description>');
        return;
      }

      console.log(colors.cyan('新しいタスクを作成します...'));

      try {
        const taskData = {
          title,
          description,
          status: 'pending',
          priority: 3,
          estimated_hours: 1,
        };

        const task = await taskManager.createTask(taskData);
        console.log(colors.green('タスクを作成しました:'));
        console.log(colors.yellow('タスクID:'), task.id);
        console.log(colors.yellow('タイトル:'), task.title);
        console.log(colors.yellow('説明:'), task.description);
        console.log(colors.yellow('状態:'), task.status);
        console.log(colors.yellow('優先度:'), task.priority);
      } catch (error) {
        console.error(colors.red('タスク作成エラー:'), error.message);
        process.exit(1);
      }
      break;
    }

    case 'list': {
      console.log(colors.cyan('タスク一覧を表示します...'));

      try {
        const tasks = await taskManager.getAllTasks();

        if (
          !tasks ||
          !tasks.decomposed_tasks ||
          tasks.decomposed_tasks.length === 0
        ) {
          console.log(colors.yellow('タスクが見つかりません'));
          return;
        }

        console.log(
          colors.green(
            `${tasks.decomposed_tasks.length}件のタスクが見つかりました:`
          )
        );

        // タスクを状態でグループ化
        const groupedTasks = {
          in_progress: tasks.decomposed_tasks.filter(
            (t) => t.status === 'in_progress'
          ),
          pending: tasks.decomposed_tasks.filter((t) => t.status === 'pending'),
          completed: tasks.decomposed_tasks.filter(
            (t) => t.status === 'completed'
          ),
          blocked: tasks.decomposed_tasks.filter((t) => t.status === 'blocked'),
        };

        // 進行中のタスク
        if (groupedTasks.in_progress.length > 0) {
          console.log(colors.green('\n進行中のタスク:'));
          groupedTasks.in_progress.forEach((task, index) => {
            console.log(
              `${index + 1}. ${colors.yellow(task.id)}: ${task.title}`
            );
            console.log(`   進捗: ${task.progress_percentage || 0}%`);
          });
        }

        // 保留中のタスク
        if (groupedTasks.pending.length > 0) {
          console.log(colors.yellow('\n保留中のタスク:'));
          groupedTasks.pending.forEach((task, index) => {
            console.log(
              `${index + 1}. ${colors.yellow(task.id)}: ${task.title}`
            );
          });
        }

        // 完了したタスク
        if (groupedTasks.completed.length > 0) {
          console.log(colors.blue('\n完了したタスク:'));
          groupedTasks.completed.forEach((task, index) => {
            console.log(
              `${index + 1}. ${colors.yellow(task.id)}: ${task.title}`
            );
          });
        }

        // ブロックされたタスク
        if (groupedTasks.blocked.length > 0) {
          console.log(colors.red('\nブロックされたタスク:'));
          groupedTasks.blocked.forEach((task, index) => {
            console.log(
              `${index + 1}. ${colors.yellow(task.id)}: ${task.title}`
            );
          });
        }
      } catch (error) {
        console.error(colors.red('タスク一覧取得エラー:'), error.message);
        process.exit(1);
      }
      break;
    }

    case 'info': {
      const taskId = args[1];

      if (!taskId) {
        console.error(colors.red('タスクIDを指定してください'));
        console.log('使用方法: node task.js info <task-id>');
        return;
      }

      console.log(colors.cyan(`タスク情報を表示します: ${taskId}`));

      try {
        const task = await taskManager.getTaskById(taskId);

        if (!task) {
          console.error(colors.red(`タスク ${taskId} が見つかりません`));
          return;
        }

        console.log(colors.green('タスク情報:'));
        console.log(colors.yellow('タスクID:'), task.id);
        console.log(colors.yellow('タイトル:'), task.title);
        console.log(colors.yellow('説明:'), task.description);
        console.log(colors.yellow('状態:'), task.status);
        console.log(colors.yellow('優先度:'), task.priority);
        console.log(
          colors.yellow('進捗:'),
          `${task.progress_percentage || 0}%`
        );

        if (task.estimated_hours) {
          console.log(
            colors.yellow('見積もり時間:'),
            `${task.estimated_hours}時間`
          );
        }

        if (task.dependencies && task.dependencies.length > 0) {
          console.log(colors.yellow('\n依存関係:'));
          task.dependencies.forEach((dep, index) => {
            console.log(`${index + 1}. ${dep.task_id} (${dep.type})`);
          });
        }

        if (task.git_commits && task.git_commits.length > 0) {
          console.log(colors.yellow('\n関連コミット:'));
          task.git_commits.forEach((commit, index) => {
            console.log(
              `${index + 1}. ${commit.hash.substring(0, 8)}: ${commit.message || '(メッセージなし)'}`
            );
          });
        }
      } catch (error) {
        console.error(colors.red('タスク情報取得エラー:'), error.message);
        process.exit(1);
      }
      break;
    }

    case 'update': {
      const taskId = args[1];
      const status = args[2];

      if (!taskId || !status) {
        console.error(colors.red('タスクIDと状態を指定してください'));
        console.log('使用方法: node task.js update <task-id> <status>');
        console.log('状態: pending, in_progress, completed, blocked');
        return;
      }

      // 状態の検証
      const validStatuses = ['pending', 'in_progress', 'completed', 'blocked'];
      if (!validStatuses.includes(status)) {
        console.error(colors.red(`無効な状態: ${status}`));
        console.log('有効な状態: pending, in_progress, completed, blocked');
        return;
      }

      console.log(
        colors.cyan(`タスク ${taskId} の状態を ${status} に更新します...`)
      );

      try {
        const task = await taskManager.getTaskById(taskId);

        if (!task) {
          console.error(colors.red(`タスク ${taskId} が見つかりません`));
          return;
        }

        // タスクを更新
        task.status = status;
        const updatedTask = await taskManager.updateTask(task);

        console.log(colors.green('タスクを更新しました:'));
        console.log(colors.yellow('タスクID:'), updatedTask.id);
        console.log(colors.yellow('タイトル:'), updatedTask.title);
        console.log(colors.yellow('状態:'), updatedTask.status);
      } catch (error) {
        console.error(colors.red('タスク更新エラー:'), error.message);
        process.exit(1);
      }
      break;
    }

    case 'progress': {
      const taskId = args[1];
      const progress = parseInt(args[2], 10);

      if (!taskId || isNaN(progress)) {
        console.error(colors.red('タスクIDと進捗率を指定してください'));
        console.log('使用方法: node task.js progress <task-id> <progress>');
        console.log('進捗率: 0-100の整数');
        return;
      }

      // 進捗率の検証
      if (progress < 0 || progress > 100) {
        console.error(colors.red('進捗率は0から100の間で指定してください'));
        return;
      }

      console.log(
        colors.cyan(`タスク ${taskId} の進捗率を ${progress}% に更新します...`)
      );

      try {
        // 進捗状態を決定
        let progressState = 'not_started';
        if (progress === 100) {
          progressState = 'completed';
        } else if (progress > 0) {
          progressState = 'in_progress';
        }

        const result = await taskManager.updateTaskProgress(
          taskId,
          progress,
          progressState
        );

        console.log(colors.green('タスク進捗を更新しました:'));
        console.log(colors.yellow('タスクID:'), result.id);
        console.log(colors.yellow('進捗率:'), `${result.progress_percentage}%`);
        console.log(colors.yellow('進捗状態:'), result.progress_state);
      } catch (error) {
        console.error(colors.red('タスク進捗更新エラー:'), error.message);
        process.exit(1);
      }
      break;
    }

    case 'delete': {
      const taskId = args[1];

      if (!taskId) {
        console.error(colors.red('タスクIDを指定してください'));
        console.log('使用方法: node task.js delete <task-id>');
        return;
      }

      console.log(colors.cyan(`タスク ${taskId} を削除します...`));

      try {
        const result = await taskManager.deleteTask(taskId);

        if (result) {
          console.log(colors.green(`タスク ${taskId} を削除しました`));
        } else {
          console.error(colors.red(`タスク ${taskId} の削除に失敗しました`));
        }
      } catch (error) {
        console.error(colors.red('タスク削除エラー:'), error.message);
        process.exit(1);
      }
      break;
    }

    case 'link': {
      const taskId = args[1];
      const commitHash = args[2];

      if (!taskId || !commitHash) {
        console.error(
          colors.red('タスクIDとコミットハッシュを指定してください')
        );
        console.log('使用方法: node task.js link <task-id> <commit-hash>');
        return;
      }

      console.log(
        colors.cyan(
          `タスク ${taskId} にコミット ${commitHash} を関連付けます...`
        )
      );

      try {
        const task = await taskManager.addGitCommitToTask(taskId, commitHash);

        console.log(colors.green('コミットを関連付けました:'));
        console.log(colors.yellow('タスクID:'), task.id);
        console.log(colors.yellow('コミットハッシュ:'), commitHash);
      } catch (error) {
        console.error(colors.red('コミット関連付けエラー:'), error.message);
        process.exit(1);
      }
      break;
    }

    case 'export': {
      const taskId = args[1];
      const outputPath = args[2] || `task-${taskId}-export.json`;

      if (!taskId) {
        console.error(colors.red('タスクIDを指定してください'));
        console.log('使用方法: node task.js export <task-id> [output-path]');
        return;
      }

      console.log(colors.cyan(`タスク情報をエクスポートします: ${taskId}`));

      try {
        const task = await taskManager.getTaskById(taskId);

        if (!task) {
          console.error(colors.red(`タスク ${taskId} が見つかりません`));
          return;
        }

        // eslint-disable-next-line security/detect-non-literal-fs-filename
        fs.writeFileSync(outputPath, JSON.stringify(task, null, 2), 'utf8');
        console.log(
          colors.green(`タスク情報を ${outputPath} にエクスポートしました`)
        );
      } catch (error) {
        console.error(colors.red('タスクエクスポートエラー:'), error.message);
        process.exit(1);
      }
      break;
    }

    case 'import': {
      const inputPath = args[1];

      if (!inputPath) {
        console.error(colors.red('入力ファイルパスを指定してください'));
        console.log('使用方法: node task.js import <input-path>');
        return;
      }

      console.log(colors.cyan(`タスク情報をインポートします: ${inputPath}`));

      try {
        // eslint-disable-next-line security/detect-non-literal-fs-filename
        if (!fs.existsSync(inputPath)) {
          console.error(colors.red(`ファイル ${inputPath} が見つかりません`));
          return;
        }

        // eslint-disable-next-line security/detect-non-literal-fs-filename
        const taskData = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
        const task = await taskManager.importTask(taskData);

        console.log(colors.green('タスク情報をインポートしました:'));
        console.log(colors.yellow('タスクID:'), task.id);
        console.log(colors.yellow('タイトル:'), task.title);
      } catch (error) {
        console.error(colors.red('タスクインポートエラー:'), error.message);
        process.exit(1);
      }
      break;
    }

    default:
      console.error(colors.red(`不明なコマンド: ${command}`));
      console.log(helpMessage);
      break;
  }
}

// メイン関数を実行
main().catch(console.error);
