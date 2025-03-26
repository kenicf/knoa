# テストスイート「storage.test.js」のテストカバレッジ改善計画

## 1. 現状分析

現在の「storage.test.js」のテストカバレッジは以下の通りです：

- **Statements**: 93.04% (214/230)
- **Branches**: 77.35% (82/106)
- **Functions**: 92.3% (24/26)
- **Lines**: 93.83% (213/227)

未カバーの行は以下の通りです：

- 行111: `readJSON`メソッド内で、ファイルが存在しない場合の`file:not_found`イベント発行
- 行163-172: `writeJSON`メソッド内で、エラー発生時の`file:write:after`イベント発行とエラーハンドリング
- 行231: `updateJSON`メソッド内で、ファイルが存在しない場合の条件分岐
- 行274-283: `lockFile`メソッド内で、ロック取得時の再試行ロジックおよびエラー処理
- 行400: `_emitEvent`メソッド内で、イベントエミッターが存在しない場合の早期リターン
- 行405: `_handleError`メソッド内で、エラーハンドラーが存在しない場合のログ出力
- 行437-438: `deleteDirectory`メソッド内で、再帰的削除が呼び出される条件分岐
- 行445-449: `_removeDirectoryRecursive`メソッド内で、エラー発生時のログ出力

## 2. 改善戦略

各未カバー行に対して、既存のテストパターンとの一貫性を保ちながら、テストケースを追加します。

### 2.1 `readJSON`メソッド（行111）

現在のテストでは、ファイルが存在しない場合のテストはありますが、`file:not_found`イベントの発行を検証していません。

```javascript
test('ファイルが存在しない場合、file:not_foundイベントを発行する', () => {
  // Arrange
  fs.existsSync.mockReturnValue(false);
  
  // Act
  const result = storageService.readJSON('test-dir', 'test-file.json');
  
  // Assert
  expect(result).toBeNull();
  expectStandardizedEventEmitted(mockEventEmitter, 'storage', 'file:not_found', {
    directory: 'test-dir',
    filename: 'test-file.json'
  });
});
```

### 2.2 `writeJSON`メソッド（行163-172）

現在のテストでは、書き込みエラー時の`file:write:after`イベント発行を検証していません。

```javascript
test('書き込みエラー時にfile:write:afterイベントを発行する', () => {
  // Arrange
  const data = { key: 'value' };
  const error = new Error('テストエラー');
  fs.writeFileSync.mockImplementation(() => { throw error; });
  
  // Act
  const result = storageService.writeJSON('test-dir', 'test-file.json', data);
  
  // Assert
  expect(result).toBe(true);
  expectStandardizedEventEmitted(mockEventEmitter, 'storage', 'file:write:after', {
    directory: 'test-dir',
    filename: 'test-file.json',
    type: 'json',
    success: false,
    error
  });
});
```

### 2.3 `updateJSON`メソッド（行231）

現在のテストでは、ファイルが存在しない場合のテストはありますが、行231の条件分岐が完全にカバーされていません。

```javascript
test('ファイルが存在しない場合、空のオブジェクトで更新関数を呼び出し新規作成する', () => {
  // Arrange
  fs.existsSync.mockReturnValue(false);
  const updatedData = { key: 'new' };
  const updateFn = jest.fn().mockReturnValue(updatedData);
  
  // Act
  const result = storageService.updateJSON('test-dir', 'test-file.json', updateFn);
  
  // Assert
  expect(result).toBeNull();
  expect(updateFn).toHaveBeenCalledWith({});
  expect(fs.writeFileSync).toHaveBeenCalledWith(
    expect.any(String),
    JSON.stringify(updatedData, null, 2),
    'utf8'
  );
});
```

### 2.4 `lockFile`メソッド（行274-283）

現在のテストでは、ロック取得時の再試行ロジックとタイムアウトエラーのテストが不足しています。

```javascript
test('ロックファイルが既に存在する場合、再試行後にタイムアウトエラーをスローする', async () => {
  // Arrange
  fs.existsSync.mockImplementation((path) => {
    if (path.includes('.lock')) {
      return true; // ロックファイルは常に存在する
    }
    return true; // 通常のファイルも存在する
  });
  
  // Act & Assert
  await expect(storageService.lockFile('test-dir', 'test-file.json', 50))
    .rejects.toThrow('ファイルロックの最大試行回数を超えました');
});
```

### 2.5 `_emitEvent`メソッド（行400）

現在のテストでは、イベントエミッターが存在しない場合のテストはありますが、行400の早期リターンが完全にカバーされていません。

```javascript
test('イベントエミッターがnullの場合、エラーが発生しない', () => {
  // Arrange
  const serviceWithoutEmitter = new StorageService({ 
    basePath: '/test', 
    eventEmitter: null 
  });
  
  // Act & Assert
  expect(() => serviceWithoutEmitter._emitEvent('test:event', {})).not.toThrow();
});
```

### 2.6 `_handleError`メソッド（行405）

現在のテストでは、エラーハンドラーが存在しない場合のログ出力が完全にカバーされていません。

```javascript
test('エラーハンドラーがない場合、ロガーにエラーを記録する', () => {
  // Arrange
  const localMockLogger = createMockLogger();
  const serviceWithoutHandler = new StorageService({ 
    basePath: '/test', 
    errorHandler: null, 
    logger: localMockLogger 
  });
  const error = new Error('テストエラー');
  
  // Act
  serviceWithoutHandler._handleError('エラーメッセージ', error, { operation: 'readJSON' });
  
  // Assert
  expect(localMockLogger.error).toHaveBeenCalledWith(
    '[StorageService] エラーメッセージ:',
    expect.objectContaining({
      error_name: 'Error',
      error_message: 'テストエラー',
      context: expect.any(Object),
      stack: expect.any(String)
    })
  );
});
```

### 2.7 `deleteDirectory`メソッド（行437-438）

現在のテストでは、再帰的削除の条件分岐が完全にカバーされていません。

```javascript
test('再帰的削除が正しく呼び出される', () => {
  // Arrange
  fs.existsSync.mockReturnValue(true);
  jest.spyOn(storageService, '_removeDirectoryRecursive').mockImplementation(() => {});
  
  // Act
  const result = storageService.deleteDirectory('test-dir', true);
  
  // Assert
  expect(result).toBe(true);
  expect(storageService._removeDirectoryRecursive).toHaveBeenCalledWith(expect.any(String));
});
```

### 2.8 `_removeDirectoryRecursive`メソッド（行445-449）

現在のテストでは、エラー発生時のログ出力が完全にカバーされていません。

```javascript
test('再帰的削除中にエラーが発生した場合、ロガーにエラーを記録する', () => {
  // Arrange
  fs.existsSync.mockReturnValue(true);
  const error = new Error('テストエラー');
  fs.readdirSync.mockImplementation(() => { throw error; });
  
  // Act
  storageService._removeDirectoryRecursive('/test/dir');
  
  // Assert
  expect(mockLogger.error).toHaveBeenCalledWith(
    expect.stringContaining('ディレクトリの再帰的削除中にエラーが発生しました'),
    expect.objectContaining({
      directory: '/test/dir',
      error_name: error.name,
      error_message: error.message,
      stack: expect.any(String)
    })
  );
});
```

## 3. 実装戦略

上記のテストケースを追加するにあたり、以下の実装戦略を採用します：

1. **既存テストとの一貫性**: 既存のテストパターン（モックの使用方法、アサーションの書き方など）に準拠します。
2. **モックの適切な設定**: 各テストケースで必要なモックを適切に設定し、テスト対象の条件を正確に再現します。
3. **イベント発行の検証**: `expectStandardizedEventEmitted`ヘルパー関数を使用して、イベント発行を検証します。
4. **エラー処理の検証**: エラー発生時の挙動を正確に検証します。
5. **非同期処理の適切な扱い**: `lockFile`などの非同期メソッドのテストでは、`async/await`を適切に使用します。

## 4. テスト実行とデバッグ戦略

テストケースを追加した後、以下の手順でテストを実行し、デバッグします：

1. **テストの実行**: `jest`コマンドを使用してテストを実行します。
2. **カバレッジレポートの確認**: カバレッジレポートを確認し、未カバー行が解消されたかを確認します。
3. **失敗したテストのデバッグ**: テストが失敗した場合、エラーメッセージを確認し、モックの設定やアサーションを調整します。
4. **タイミング問題の解決**: 非同期テストで問題が発生した場合、タイムアウト設定やモックの挙動を調整します。

## 5. まとめ

この計画に従って、`storage.test.js`に8つの新しいテストケースを追加することで、未カバーの行をカバーし、テストカバレッジを100%に引き上げることができます。各テストケースは既存のテストパターンに準拠し、一貫性と整合性を保ちながら、破綻のない実装を実現します。

この計画を実行することで、`storage.js`のすべての行がテストされ、信頼性の高いテストスイートが構築されます。