#!/usr/bin/env node
/**
 * フィードバック管理CLI
 *
 * フィードバック管理ユーティリティを使用するためのコマンドラインインターフェース
 */

const path = require('path');
const fs = require('fs');

// 依存性注入
const ServiceContainer = require('../lib/core/service-container');
const { registerServices } = require('../lib/core/service-definitions');
const config = require('../config');

// サービスコンテナの作成と初期化
const container = new ServiceContainer();
registerServices(container, config);

// フィードバックマネージャーのインスタンスを取得
const feedbackManager = container.get('feedbackManagerAdapter');

// コマンドライン引数の解析
const args = process.argv.slice(2);
const command = args[0];

// ヘルプメッセージ
const helpMessage = `
フィードバック管理CLI

使用方法:
  node feedback.js <コマンド> [オプション]

コマンド:
  collect <taskId> [testCommand]  - テスト結果を収集してフィードバックを生成
  status <taskId>                 - フィードバックの状態を表示
  resolve <taskId>                - フィードバックを解決済みとしてマーク
  reopen <taskId>                 - フィードバックを再オープン
  report <taskId> [outputPath]    - フィードバックレポートを生成
  prioritize <taskId>             - フィードバックの優先順位付け
  link-git <taskId> <commitHash>  - フィードバックにGitコミットを関連付け
  link-session <taskId> <sessionId> - フィードバックにセッションを関連付け
  integrate-task <taskId>         - フィードバックをタスクに統合
  integrate-session <taskId> <sessionId> - フィードバックをセッションに統合
  help                            - このヘルプメッセージを表示

例:
  node feedback.js collect T001 "npm test"
  node feedback.js report T001 ./feedback-report.md
  node feedback.js resolve T001
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
    case 'collect': {
      const taskId = args[1];
      const testCommand = args[2] || 'npm test';

      if (!taskId) {
        console.error('タスクIDを指定してください');
        console.log(
          '使用方法: node feedback.js collect <taskId> [testCommand]'
        );
        return;
      }

      console.log(`タスク ${taskId} のフィードバックを収集します...`);
      console.log(`テストコマンド: ${testCommand}`);

      try {
        const feedback = await feedbackManager.collectTestResults(
          taskId,
          testCommand
        );
        if (feedback) {
          console.log('テスト結果を収集しました');

          const summary =
            feedback.feedback_loop.verification_results.test_summary;
          console.log(
            `テスト結果: ${feedback.feedback_loop.verification_results.passes_tests ? '成功' : '失敗'}`
          );
          console.log(
            `合計: ${summary.total}, 成功: ${summary.passed}, 失敗: ${summary.failed}, スキップ: ${summary.skipped}`
          );

          // 失敗したテストがある場合は表示
          const failedTests =
            feedback.feedback_loop.verification_results.failed_tests;
          if (failedTests && failedTests.length > 0) {
            console.log('\n失敗したテスト:');
            for (const test of failedTests) {
              console.log(`- ${test.test_name}: ${test.error}`);
            }
          }

          console.log('\nフィードバックを保存しました');
        } else {
          console.error('テスト結果の収集に失敗しました');
        }
      } catch (error) {
        console.error('エラーが発生しました:', error);
      }
      break;
    }

    case 'status': {
      const taskId = args[1];

      if (!taskId) {
        console.error('タスクIDを指定してください');
        console.log('使用方法: node feedback.js status <taskId>');
        return;
      }

      console.log(`タスク ${taskId} のフィードバック状態を表示します...`);

      try {
        const feedback = feedbackManager.getFeedbackByTaskId(taskId);
        if (feedback) {
          console.log(
            `ステータス: ${feedback.feedback_loop.feedback_status || 'open'}`
          );
          console.log(
            `実装試行回数: ${feedback.feedback_loop.implementation_attempt}`
          );
          console.log(
            `テスト結果: ${feedback.feedback_loop.verification_results.passes_tests ? '成功' : '失敗'}`
          );

          const summary =
            feedback.feedback_loop.verification_results.test_summary;
          if (summary) {
            console.log(
              `テスト合計: ${summary.total}, 成功: ${summary.passed}, 失敗: ${summary.failed}, スキップ: ${summary.skipped}`
            );
          }

          console.log(
            `関連コミット: ${feedback.feedback_loop.git_commit || 'なし'}`
          );
          console.log(`作成日時: ${feedback.feedback_loop.created_at}`);
          console.log(`更新日時: ${feedback.feedback_loop.updated_at}`);
        } else {
          console.error(`タスク ${taskId} のフィードバックが見つかりません`);
        }
      } catch (error) {
        console.error('エラーが発生しました:', error);
      }
      break;
    }

    case 'resolve': {
      const taskId = args[1];

      if (!taskId) {
        console.error('タスクIDを指定してください');
        console.log('使用方法: node feedback.js resolve <taskId>');
        return;
      }

      console.log(
        `タスク ${taskId} のフィードバックを解決済みとしてマークします...`
      );

      try {
        const feedback = feedbackManager.getFeedbackByTaskId(taskId);
        if (feedback) {
          const updatedFeedback = feedbackManager.updateFeedbackStatus(
            feedback,
            'resolved'
          );
          console.log('フィードバックを解決済みとしてマークしました');
          console.log(
            `新しいステータス: ${updatedFeedback.feedback_loop.feedback_status}`
          );
        } else {
          console.error(`タスク ${taskId} のフィードバックが見つかりません`);
        }
      } catch (error) {
        console.error('エラーが発生しました:', error);
      }
      break;
    }

    case 'reopen': {
      const taskId = args[1];

      if (!taskId) {
        console.error('タスクIDを指定してください');
        console.log('使用方法: node feedback.js reopen <taskId>');
        return;
      }

      console.log(`タスク ${taskId} のフィードバックを再オープンします...`);

      try {
        const feedback = feedbackManager.getFeedbackByTaskId(taskId);
        if (feedback) {
          const updatedFeedback = feedbackManager.updateFeedbackStatus(
            feedback,
            'open'
          );
          console.log('フィードバックを再オープンしました');
          console.log(
            `新しいステータス: ${updatedFeedback.feedback_loop.feedback_status}`
          );
        } else {
          console.error(`タスク ${taskId} のフィードバックが見つかりません`);
        }
      } catch (error) {
        console.error('エラーが発生しました:', error);
      }
      break;
    }

    case 'report': {
      const taskId = args[1];
      const outputPath = args[2];

      if (!taskId) {
        console.error('タスクIDを指定してください');
        console.log('使用方法: node feedback.js report <taskId> [outputPath]');
        return;
      }

      console.log(`タスク ${taskId} のフィードバックレポートを生成します...`);

      try {
        const report = feedbackManager.generateFeedbackMarkdown(taskId);
        if (report) {
          if (outputPath) {
            // eslint-disable-next-line security/detect-non-literal-fs-filename
            fs.writeFileSync(outputPath, report, 'utf8');
            console.log(`レポートを ${outputPath} に保存しました`);
          } else {
            console.log(report);
          }
        } else {
          console.error('フィードバックレポートの生成に失敗しました');
        }
      } catch (error) {
        console.error('エラーが発生しました:', error);
      }
      break;
    }

    case 'prioritize': {
      const taskId = args[1];

      if (!taskId) {
        console.error('タスクIDを指定してください');
        console.log('使用方法: node feedback.js prioritize <taskId>');
        return;
      }

      console.log(
        `タスク ${taskId} のフィードバックの優先順位付けを行います...`
      );

      try {
        const feedback = feedbackManager.getFeedbackByTaskId(taskId);
        if (feedback) {
          const updatedFeedback = feedbackManager.prioritizeFeedback(feedback);
          console.log('フィードバックの優先順位付けを行いました');

          // 提案の表示
          const suggestions =
            updatedFeedback.feedback_loop.verification_results.suggestions;
          if (suggestions && suggestions.length > 0) {
            console.log('\n優先順位付けされた提案:');
            for (const suggestion of suggestions) {
              if (typeof suggestion === 'string') {
                console.log(`- [P3] ${suggestion}`);
              } else {
                console.log(
                  `- [P${suggestion.priority || 3}] [${suggestion.type || 'その他'}] ${suggestion.content}`
                );
              }
            }
          }
        } else {
          console.error(`タスク ${taskId} のフィードバックが見つかりません`);
        }
      } catch (error) {
        console.error('エラーが発生しました:', error);
      }
      break;
    }

    case 'link-git': {
      const taskId = args[1];
      const commitHash = args[2];

      if (!taskId || !commitHash) {
        console.error('タスクIDとコミットハッシュを指定してください');
        console.log(
          '使用方法: node feedback.js link-git <taskId> <commitHash>'
        );
        return;
      }

      console.log(
        `タスク ${taskId} のフィードバックにコミット ${commitHash} を関連付けます...`
      );

      try {
        const feedback = feedbackManager.getFeedbackByTaskId(taskId);
        if (feedback) {
          const updatedFeedback = feedbackManager.linkFeedbackToGitCommit(
            feedback,
            commitHash
          );
          console.log(
            `フィードバックにコミット ${commitHash} を関連付けました`
          );
        } else {
          console.error(`タスク ${taskId} のフィードバックが見つかりません`);
        }
      } catch (error) {
        console.error('エラーが発生しました:', error);
      }
      break;
    }

    case 'link-session': {
      const taskId = args[1];
      const sessionId = args[2];

      if (!taskId || !sessionId) {
        console.error('タスクIDとセッションIDを指定してください');
        console.log(
          '使用方法: node feedback.js link-session <taskId> <sessionId>'
        );
        return;
      }

      console.log(
        `タスク ${taskId} のフィードバックにセッション ${sessionId} を関連付けます...`
      );

      try {
        const feedback = feedbackManager.getFeedbackByTaskId(taskId);
        if (feedback) {
          const updatedFeedback = feedbackManager.linkFeedbackToSession(
            feedback,
            sessionId
          );
          console.log(
            `フィードバックにセッション ${sessionId} を関連付けました`
          );
        } else {
          console.error(`タスク ${taskId} のフィードバックが見つかりません`);
        }
      } catch (error) {
        console.error('エラーが発生しました:', error);
      }
      break;
    }

    case 'integrate-task': {
      const taskId = args[1];

      if (!taskId) {
        console.error('タスクIDを指定してください');
        console.log('使用方法: node feedback.js integrate-task <taskId>');
        return;
      }

      console.log(`タスク ${taskId} のフィードバックをタスクに統合します...`);

      try {
        const result = await feedbackManager.integrateFeedbackWithTask(
          taskId,
          taskId
        );
        if (result) {
          console.log('フィードバックをタスクに統合しました');
        } else {
          console.error('フィードバックのタスクへの統合に失敗しました');
        }
      } catch (error) {
        console.error('エラーが発生しました:', error);
      }
      break;
    }

    case 'integrate-session': {
      const taskId = args[1];
      const sessionId = args[2];

      if (!taskId || !sessionId) {
        console.error('タスクIDとセッションIDを指定してください');
        console.log(
          '使用方法: node feedback.js integrate-session <taskId> <sessionId>'
        );
        return;
      }

      console.log(
        `タスク ${taskId} のフィードバックをセッション ${sessionId} に統合します...`
      );

      try {
        const result = await feedbackManager.integrateFeedbackWithSession(
          taskId,
          sessionId
        );
        if (result) {
          console.log('フィードバックをセッションに統合しました');
        } else {
          console.error('フィードバックのセッションへの統合に失敗しました');
        }
      } catch (error) {
        console.error('エラーが発生しました:', error);
      }
      break;
    }

    default:
      console.error(`不明なコマンド: ${command}`);
      console.log(helpMessage);
      break;
  }
}

// メイン関数を実行
main().catch(console.error);
