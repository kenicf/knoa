#!/usr/bin/env node
/**
 * セッション管理CLI
 * 
 * セッション管理ユーティリティを使用するためのコマンドラインインターフェース
 */

const path = require('path');
const fs = require('fs');
const colors = require('colors/safe');

// 依存性注入
const ServiceContainer = require('../lib/core/service-container');
const { registerServices } = require('../lib/core/service-definitions');
const config = require('../config');

// サービスコンテナの作成と初期化
const container = new ServiceContainer();
registerServices(container, config);

// セッションマネージャーのインスタンスを取得（アダプター経由）
const sessionManager = container.get('sessionManagerAdapter');

// コマンドライン引数の解析
const args = process.argv.slice(2);
const command = args[0];

// ヘルプメッセージ
const helpMessage = `
セッション管理CLI

使用方法:
  node session.js <コマンド> [オプション]

コマンド:
  start [previous-session-id]  - 新しいセッションを開始
  end [session-id]             - セッションを終了
  list                         - セッション一覧を表示
  current                      - 現在のセッションを表示
  info <session-id>            - セッション情報を表示
  export <session-id> [path]   - セッション情報をエクスポート
  import <path>                - セッション情報をインポート
  help                         - このヘルプメッセージを表示

例:
  node session.js start
  node session.js end
  node session.js list
  node session.js info session-123
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
    case 'start': {
      const previousSessionId = args[1];
      
      console.log(colors.cyan('新しいセッションを開始します...'));
      if (previousSessionId) {
        console.log(colors.cyan(`前回のセッションID: ${previousSessionId}`));
      }
      
      try {
        const session = await sessionManager.createNewSession(previousSessionId);
        console.log(colors.green('セッションを開始しました:'));
        console.log(colors.yellow('セッションID:'), session.session_id);
        console.log(colors.yellow('作成日時:'), session.created_at);
        
        if (session.previous_session_id) {
          console.log(colors.yellow('前回のセッションID:'), session.previous_session_id);
        }
      } catch (error) {
        console.error(colors.red('セッション開始エラー:'), error.message);
        process.exit(1);
      }
      break;
    }
    
    case 'end': {
      const sessionId = args[1];
      
      console.log(colors.cyan('セッションを終了します...'));
      
      try {
        // セッションIDが指定されていない場合は最新のセッションを取得
        let targetSessionId = sessionId;
        if (!targetSessionId) {
          const latestSession = await sessionManager.getLatestSession();
          if (latestSession) {
            targetSessionId = latestSession.session_id;
          } else {
            console.error(colors.red('アクティブなセッションが見つかりません'));
            return;
          }
        }
        
        const session = await sessionManager.endSession(targetSessionId);
        console.log(colors.green('セッションを終了しました:'));
        console.log(colors.yellow('セッションID:'), session.session_id);
        console.log(colors.yellow('終了日時:'), session.ended_at);
        
        // 引継ぎドキュメントを保存
        if (session.handover_document) {
          const handoverPath = path.join(process.cwd(), 'ai-context', 'sessions', 'session-handover.md');
          fs.writeFileSync(handoverPath, session.handover_document, 'utf8');
          console.log(colors.green('引継ぎドキュメントを保存しました:'), handoverPath);
        }
      } catch (error) {
        console.error(colors.red('セッション終了エラー:'), error.message);
        process.exit(1);
      }
      break;
    }
    
    case 'list': {
      console.log(colors.cyan('セッション一覧を表示します...'));
      
      try {
        const sessions = await sessionManager.getAllSessions();
        
        if (!sessions || sessions.length === 0) {
          console.log(colors.yellow('セッションが見つかりません'));
          return;
        }
        
        console.log(colors.green(`${sessions.length}件のセッションが見つかりました:`));
        
        // セッションを日付順にソート
        sessions.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        
        sessions.forEach((session, index) => {
          const status = session.ended_at ? colors.red('終了') : colors.green('アクティブ');
          console.log(`${index + 1}. ${colors.yellow(session.session_id)} [${status}]`);
          console.log(`   作成: ${session.created_at}`);
          if (session.ended_at) {
            console.log(`   終了: ${session.ended_at}`);
          }
          if (session.description) {
            console.log(`   説明: ${session.description}`);
          }
          console.log('');
        });
      } catch (error) {
        console.error(colors.red('セッション一覧取得エラー:'), error.message);
        process.exit(1);
      }
      break;
    }
    
    case 'current': {
      console.log(colors.cyan('現在のセッションを表示します...'));
      
      try {
        const session = await sessionManager.getLatestSession();
        
        if (!session) {
          console.log(colors.yellow('アクティブなセッションが見つかりません'));
          return;
        }
        
        console.log(colors.green('現在のセッション:'));
        console.log(colors.yellow('セッションID:'), session.session_id);
        console.log(colors.yellow('作成日時:'), session.created_at);
        
        if (session.previous_session_id) {
          console.log(colors.yellow('前回のセッションID:'), session.previous_session_id);
        }
        
        if (session.tasks && session.tasks.length > 0) {
          console.log(colors.yellow('\n関連タスク:'));
          session.tasks.forEach((task, index) => {
            console.log(`${index + 1}. ${task.id}: ${task.title}`);
          });
        }
      } catch (error) {
        console.error(colors.red('セッション取得エラー:'), error.message);
        process.exit(1);
      }
      break;
    }
    
    case 'info': {
      const sessionId = args[1];
      
      if (!sessionId) {
        console.error(colors.red('セッションIDを指定してください'));
        console.log('使用方法: node session.js info <session-id>');
        return;
      }
      
      console.log(colors.cyan(`セッション情報を表示します: ${sessionId}`));
      
      try {
        const session = await sessionManager.getSession(sessionId);
        
        if (!session) {
          console.error(colors.red(`セッション ${sessionId} が見つかりません`));
          return;
        }
        
        console.log(colors.green('セッション情報:'));
        console.log(colors.yellow('セッションID:'), session.session_id);
        console.log(colors.yellow('作成日時:'), session.created_at);
        
        if (session.ended_at) {
          console.log(colors.yellow('終了日時:'), session.ended_at);
        }
        
        if (session.previous_session_id) {
          console.log(colors.yellow('前回のセッションID:'), session.previous_session_id);
        }
        
        if (session.description) {
          console.log(colors.yellow('説明:'), session.description);
        }
        
        if (session.tasks && session.tasks.length > 0) {
          console.log(colors.yellow('\n関連タスク:'));
          session.tasks.forEach((task, index) => {
            console.log(`${index + 1}. ${task.id}: ${task.title}`);
          });
        }
        
        if (session.feedback && session.feedback.length > 0) {
          console.log(colors.yellow('\n関連フィードバック:'));
          session.feedback.forEach((feedback, index) => {
            console.log(`${index + 1}. ${feedback.id}: ${feedback.title || 'フィードバック'}`);
          });
        }
      } catch (error) {
        console.error(colors.red('セッション情報取得エラー:'), error.message);
        process.exit(1);
      }
      break;
    }
    
    case 'export': {
      const sessionId = args[1];
      const outputPath = args[2] || `session-${sessionId}-export.json`;
      
      if (!sessionId) {
        console.error(colors.red('セッションIDを指定してください'));
        console.log('使用方法: node session.js export <session-id> [output-path]');
        return;
      }
      
      console.log(colors.cyan(`セッション情報をエクスポートします: ${sessionId}`));
      
      try {
        const session = await sessionManager.getSession(sessionId);
        
        if (!session) {
          console.error(colors.red(`セッション ${sessionId} が見つかりません`));
          return;
        }
        
        fs.writeFileSync(outputPath, JSON.stringify(session, null, 2), 'utf8');
        console.log(colors.green(`セッション情報を ${outputPath} にエクスポートしました`));
      } catch (error) {
        console.error(colors.red('セッションエクスポートエラー:'), error.message);
        process.exit(1);
      }
      break;
    }
    
    case 'import': {
      const inputPath = args[1];
      
      if (!inputPath) {
        console.error(colors.red('入力ファイルパスを指定してください'));
        console.log('使用方法: node session.js import <input-path>');
        return;
      }
      
      console.log(colors.cyan(`セッション情報をインポートします: ${inputPath}`));
      
      try {
        if (!fs.existsSync(inputPath)) {
          console.error(colors.red(`ファイル ${inputPath} が見つかりません`));
          return;
        }
        
        const sessionData = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
        const session = await sessionManager.importSession(sessionData);
        
        console.log(colors.green('セッション情報をインポートしました:'));
        console.log(colors.yellow('セッションID:'), session.session_id);
        console.log(colors.yellow('作成日時:'), session.created_at);
      } catch (error) {
        console.error(colors.red('セッションインポートエラー:'), error.message);
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