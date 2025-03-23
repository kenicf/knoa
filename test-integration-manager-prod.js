/**
 * IntegrationManagerの本番モードテスト用スクリプト
 * 
 * このスクリプトは、IntegrationManagerの初期化と設定を本番モードでテストし、
 * 処理が完了したら自動的にプロセスを終了します。
 */

// 本番モードを設定（NODE_ENVを明示的にクリア）
process.env.NODE_ENV = 'production';

const ServiceContainer = require('./src/lib/core/service-container');
const { registerServices } = require('./src/lib/core/service-definitions');

// サービスコンテナの初期化
const container = new ServiceContainer();
registerServices(container);

// IntegrationManagerの取得
const integrationManager = container.get('integrationManager');

// 結果の表示
console.log('IntegrationManager initialized:', integrationManager.constructor.name);
console.log('Periodic sync enabled:', integrationManager.enablePeriodicSync);
console.log('NODE_ENV:', process.env.NODE_ENV);

// 定期同期を停止（テスト終了のため）
if (integrationManager.stopPeriodicSync) {
  console.log('定期同期を停止しました:', integrationManager.stopPeriodicSync());
}

// 1秒後にプロセスを終了
setTimeout(() => {
  console.log('テスト完了、プロセスを終了します');
  process.exit(0);
}, 1000);