/**
 * イベントカタログのテスト
 */

const { EventCatalog } = require('../../../src/lib/core/event-system');
const eventCatalog = require('../../../src/lib/core/event-catalog');

describe('EventCatalog', () => {
  describe('基本機能', () => {
    let catalog;
    
    beforeEach(() => {
      catalog = new EventCatalog();
    });
    
    test('インスタンスが正しく作成される', () => {
      expect(catalog).toBeInstanceOf(EventCatalog);
      expect(catalog.events).toBeInstanceOf(Map);
      expect(catalog.categories).toBeInstanceOf(Set);
    });
    
    test('イベント定義を登録して取得できる', () => {
      catalog.registerEvent('test:event', {
        description: 'テストイベント',
        category: 'test',
        schema: { data: 'データ' },
        examples: ['example']
      });
      
      const definition = catalog.getEventDefinition('test:event');
      expect(definition).toBeDefined();
      expect(definition.name).toBe('test:event');
      expect(definition.description).toBe('テストイベント');
      expect(definition.category).toBe('test');
      expect(definition.schema).toEqual({ data: 'データ' });
      expect(definition.examples).toEqual(['example']);
    });
    
    test('存在しないイベント定義を取得するとnullが返る', () => {
      expect(catalog.getEventDefinition('unknown:event')).toBeNull();
    });
    
    test('デフォルト値が適用される', () => {
      catalog.registerEvent('test:event', {});
      
      const definition = catalog.getEventDefinition('test:event');
      expect(definition.description).toBe('');
      expect(definition.schema).toEqual({});
      expect(definition.category).toBe('uncategorized');
      expect(definition.examples).toEqual([]);
    });
    
    test('カテゴリ別のイベント一覧を取得できる', () => {
      catalog.registerEvent('test:event1', { category: 'test' });
      catalog.registerEvent('test:event2', { category: 'test' });
      catalog.registerEvent('other:event', { category: 'other' });
      
      const testEvents = catalog.getEventsByCategory('test');
      expect(testEvents).toHaveLength(2);
      expect(testEvents[0].name).toBe('test:event1');
      expect(testEvents[1].name).toBe('test:event2');
      
      const otherEvents = catalog.getEventsByCategory('other');
      expect(otherEvents).toHaveLength(1);
      expect(otherEvents[0].name).toBe('other:event');
      
      const unknownEvents = catalog.getEventsByCategory('unknown');
      expect(unknownEvents).toHaveLength(0);
    });
    
    test('すべてのイベント定義を取得できる', () => {
      catalog.registerEvent('test:event1', {});
      catalog.registerEvent('test:event2', {});
      catalog.registerEvent('other:event', {});
      
      const allEvents = catalog.getAllEvents();
      expect(allEvents).toHaveLength(3);
      expect(allEvents.map(e => e.name)).toContain('test:event1');
      expect(allEvents.map(e => e.name)).toContain('test:event2');
      expect(allEvents.map(e => e.name)).toContain('other:event');
    });
    
    test('すべてのカテゴリを取得できる', () => {
      catalog.registerEvent('test:event1', { category: 'test' });
      catalog.registerEvent('test:event2', { category: 'test' });
      catalog.registerEvent('other:event', { category: 'other' });
      catalog.registerEvent('uncategorized:event', {});
      
      const categories = catalog.getAllCategories();
      expect(categories).toHaveLength(3);
      expect(categories).toContain('test');
      expect(categories).toContain('other');
      expect(categories).toContain('uncategorized');
    });
  });
  
  describe('実際のイベントカタログ', () => {
    test('イベントカタログがインスタンス化されている', () => {
      expect(eventCatalog).toBeInstanceOf(EventCatalog);
    });
    
    test('標準イベントが登録されている', () => {
      // タスク関連イベント
      expect(eventCatalog.getEventDefinition('task:created')).toBeDefined();
      expect(eventCatalog.getEventDefinition('task:updated')).toBeDefined();
      expect(eventCatalog.getEventDefinition('task:deleted')).toBeDefined();
      expect(eventCatalog.getEventDefinition('task:statusChanged')).toBeDefined();
      
      // セッション関連イベント
      expect(eventCatalog.getEventDefinition('session:started')).toBeDefined();
      expect(eventCatalog.getEventDefinition('session:ended')).toBeDefined();
      expect(eventCatalog.getEventDefinition('session:handover')).toBeDefined();
      
      // フィードバック関連イベント
      expect(eventCatalog.getEventDefinition('feedback:collected')).toBeDefined();
      expect(eventCatalog.getEventDefinition('feedback:resolved')).toBeDefined();
      
      // Git関連イベント
      expect(eventCatalog.getEventDefinition('git:committed')).toBeDefined();
      
      // ストレージ関連イベント
      expect(eventCatalog.getEventDefinition('storage:fileCreated')).toBeDefined();
      expect(eventCatalog.getEventDefinition('storage:fileUpdated')).toBeDefined();
      
      // システム関連イベント
      expect(eventCatalog.getEventDefinition('system:initialized')).toBeDefined();
      expect(eventCatalog.getEventDefinition('system:error')).toBeDefined();
      
      // イベント駆動アーキテクチャ関連イベント
      expect(eventCatalog.getEventDefinition('event:registered')).toBeDefined();
    });
    
    test('カテゴリが正しく設定されている', () => {
      const taskEvents = eventCatalog.getEventsByCategory('task');
      expect(taskEvents.length).toBeGreaterThanOrEqual(4);
      
      const sessionEvents = eventCatalog.getEventsByCategory('session');
      expect(sessionEvents.length).toBeGreaterThanOrEqual(3);
      
      const feedbackEvents = eventCatalog.getEventsByCategory('feedback');
      expect(feedbackEvents.length).toBeGreaterThanOrEqual(2);
      
      const systemEvents = eventCatalog.getEventsByCategory('system');
      expect(systemEvents.length).toBeGreaterThanOrEqual(2);
    });
    
    test('イベント定義が必要な情報を含んでいる', () => {
      const taskCreatedEvent = eventCatalog.getEventDefinition('task:created');
      expect(taskCreatedEvent.description).toBeDefined();
      expect(taskCreatedEvent.category).toBe('task');
      expect(taskCreatedEvent.schema).toBeDefined();
      expect(taskCreatedEvent.examples).toBeDefined();
      expect(taskCreatedEvent.examples.length).toBeGreaterThan(0);
      
      const sessionStartedEvent = eventCatalog.getEventDefinition('session:started');
      expect(sessionStartedEvent.description).toBeDefined();
      expect(sessionStartedEvent.category).toBe('session');
      expect(sessionStartedEvent.schema).toBeDefined();
      expect(sessionStartedEvent.examples).toBeDefined();
      expect(sessionStartedEvent.examples.length).toBeGreaterThan(0);
    });
    
    test('すべてのカテゴリを取得できる', () => {
      const categories = eventCatalog.getAllCategories();
      expect(categories.length).toBeGreaterThanOrEqual(6);
      expect(categories).toContain('task');
      expect(categories).toContain('session');
      expect(categories).toContain('feedback');
      expect(categories).toContain('git');
      expect(categories).toContain('storage');
      expect(categories).toContain('system');
    });
  });
  
  describe('イベントカタログの拡張', () => {
    let catalog;
    
    beforeEach(() => {
      // 既存のカタログをコピー
      catalog = new EventCatalog();
      
      // 既存のイベントをコピー
      for (const event of eventCatalog.getAllEvents()) {
        catalog.registerEvent(event.name, {
          description: event.description,
          category: event.category,
          schema: event.schema,
          examples: event.examples
        });
      }
    });
    
    test('新しいイベントを追加できる', () => {
      catalog.registerEvent('custom:event', {
        description: 'カスタムイベント',
        category: 'custom',
        schema: {
          id: 'イベントID',
          data: 'イベントデータ'
        },
        examples: [
          `emitter.emitStandardized('custom', 'event', { id: 'custom-1', data: 'test' });`
        ]
      });
      
      const customEvent = catalog.getEventDefinition('custom:event');
      expect(customEvent).toBeDefined();
      expect(customEvent.description).toBe('カスタムイベント');
      expect(customEvent.category).toBe('custom');
      
      const customEvents = catalog.getEventsByCategory('custom');
      expect(customEvents).toHaveLength(1);
      expect(customEvents[0].name).toBe('custom:event');
      
      const categories = catalog.getAllCategories();
      expect(categories).toContain('custom');
    });
    
    test('既存のイベントを上書きできる', () => {
      // 既存のイベントを上書き
      catalog.registerEvent('task:created', {
        description: '新しい説明',
        category: 'task',
        schema: {
          id: 'タスクID',
          title: 'タスクのタイトル',
          custom: 'カスタムフィールド'
        },
        examples: ['新しい例']
      });
      
      const taskCreatedEvent = catalog.getEventDefinition('task:created');
      expect(taskCreatedEvent.description).toBe('新しい説明');
      expect(taskCreatedEvent.schema).toHaveProperty('custom');
      expect(taskCreatedEvent.examples).toEqual(['新しい例']);
    });
  });
});