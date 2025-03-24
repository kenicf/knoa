# GitService の getCommitDetails メソッド修正計画

## 問題点の詳細分析

テストでは `beforeEventFound` が `false` になっていますが、期待値は `true` です。これは、イベント発行の処理に問題がある可能性があります。

### テストコード

```javascript
// イベント発行の検証
const emitCalls = mockEventEmitter.emit.mock.calls;
let beforeEventFound = false;
let afterEventFound = false;

for (const call of emitCalls) {
  if (call[0] === 'git:commit:get_details:before' && call[1].commitHash === 'commit-hash') {
    beforeEventFound = true;
  }
  if (call[0] === 'git:commit:get_details:after' &&
      call[1].commitHash === 'commit-hash' &&
      call[1].success === true &&
      call[1].details) {
    afterEventFound = true;
  }
}

expect(beforeEventFound).toBe(true);
expect(afterEventFound).toBe(true);
```

### 現在の実装

```javascript
getCommitDetails(commitHash) {
  try {
    // 従来のイベント発行を先に行う（テスト互換性のため）
    if (this.eventEmitter) {
      this.eventEmitter.emit('git:commit:get_details:before', {
        commitHash,
        timestamp: new Date().toISOString()
      });
    }
    
    // 標準化されたイベント発行
    this._emitEvent('commit:get_details:before', { commitHash });
    
    // ... 中略 ...
    
    // 従来のイベント発行を先に行う（テスト互換性のため）
    if (this.eventEmitter) {
      this.eventEmitter.emit('git:commit:get_details:after', {
        commitHash,
        details,
        success: true,
        timestamp: new Date().toISOString()
      });
    }
    
    // 標準化されたイベント発行
    this._emitEvent('commit:get_details:after', { commitHash, details, success: true });
    
    return details;
  } catch (error) {
    // ... 中略 ...
  }
}
```

### 問題の原因

1. `this.eventEmitter` の条件チェックが不十分である可能性があります。
2. `_emitEvent` メソッドの実装に問題がある可能性があります。
3. テスト環境でのモックの設定に問題がある可能性があります。

## 修正案

### 修正1: イベント発行の条件チェックを強化

```javascript
getCommitDetails(commitHash) {
  try {
    // 従来のイベント発行を確実に行う
    if (this.eventEmitter && typeof this.eventEmitter.emit === 'function') {
      console.log('従来のイベント発行（before）');
      this.eventEmitter.emit('git:commit:get_details:before', {
        commitHash,
        timestamp: new Date().toISOString()
      });
    } else {
      console.log('従来のイベント発行なし（eventEmitter未設定または.emit()未実装）');
    }
    
    // 標準化されたイベント発行
    this._emitEvent('commit:get_details:before', { commitHash });
    
    // ... 中略 ...
    
    // 従来のイベント発行を確実に行う
    if (this.eventEmitter && typeof this.eventEmitter.emit === 'function') {
      console.log('従来のイベント発行（after）');
      this.eventEmitter.emit('git:commit:get_details:after', {
        commitHash,
        details,
        success: true,
        timestamp: new Date().toISOString()
      });
    }
    
    // 標準化されたイベント発行
    this._emitEvent('commit:get_details:after', { commitHash, details, success: true });
    
    return details;
  } catch (error) {
    // ... 中略 ...
  }
}
```

### 修正2: _emitEvent メソッドの修正

```javascript
_emitEvent(eventName, data) {
  if (this.eventEmitter) {
    // 標準化されたイベント発行メソッドがあれば使用
    if (typeof this.eventEmitter.emitStandardized === 'function') {
      const [category, action] = eventName.split(':');
      this.eventEmitter.emitStandardized('git', eventName, {
        ...data,
        timestamp: new Date().toISOString()
      });
    }
    
    // 従来のイベント発行も必ず行う（テスト互換性のため）
    if (typeof this.eventEmitter.emit === 'function') {
      // イベント名がすでにgit:で始まっている場合は、そのまま使用
      const fullEventName = eventName.startsWith('git:') ? eventName : `git:${eventName}`;
      this.eventEmitter.emit(fullEventName, {
        ...data,
        timestamp: new Date().toISOString()
      });
    }
  }
}
```

### 修正3: テストコードの修正

```javascript
// イベント発行の検証
const emitCalls = mockEventEmitter.emit.mock.calls;
let beforeEventFound = false;
let afterEventFound = false;

console.log('イベント発行呼び出し:', emitCalls);

for (const call of emitCalls) {
  console.log('検証中の呼び出し:', call[0], call[1]);
  if (call[0] === 'git:commit:get_details:before' && call[1].commitHash === 'commit-hash') {
    beforeEventFound = true;
    console.log('beforeEventFound = true');
  }
  if (call[0] === 'git:commit:get_details:after' &&
      call[1].commitHash === 'commit-hash' &&
      call[1].success === true &&
      call[1].details) {
    afterEventFound = true;
    console.log('afterEventFound = true');
  }
}

expect(beforeEventFound).toBe(true);
expect(afterEventFound).toBe(true);
```

## 実装手順

1. まず、`git.js` の `getCommitDetails` メソッドを修正します:
   - イベント発行の条件チェックを強化します。
   - デバッグログを追加して実行パスを確認します。

2. 次に、`_emitEvent` メソッドを修正します:
   - 従来のイベント発行と標準化されたイベント発行の両方を確実に行うようにします。

3. テストを実行して結果を確認します。

4. 必要に応じてテストコードも修正します:
   - デバッグログを追加してイベント発行の検証を詳細に確認します。

5. デバッグが完了したら、デバッグログを削除してコードをクリーンアップします。

この修正により、テストの失敗を解消し、コードの動作をより明確にすることができるでしょう。