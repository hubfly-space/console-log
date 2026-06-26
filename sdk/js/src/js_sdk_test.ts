import { test } from 'node:test';
import assert from 'node:assert';
import { ConsoleLogClient, init, captureConsole, restoreConsole } from './index.ts';

// Simple mock for fetch
function setupFetchMock() {
  const calls: { url: string; options: any }[] = [];
  const originalFetch = (globalThis as any).fetch;

  (globalThis as any).fetch = async (url: any, options?: any) => {
    calls.push({ url: String(url), options });
    return {
      ok: true,
      status: 200,
      json: async () => ({ success: true }),
    } as any;
  };

  return {
    calls,
    restore: () => {
      (globalThis as any).fetch = originalFetch;
    },
  };
}

test('ConsoleLogClient queueing and batching', async (t) => {
  const fetchMock = setupFetchMock();

  try {
    const client = new ConsoleLogClient({
      streamKey: 'test-js-key',
      endpoint: 'http://mock-api:8080',
      batchSize: 3,
      flushIntervalMs: 50,
    });

    client.log('Log message 1');
    client.log('Log message 2');

    // Should not have sent yet (batchSize is 3, we have 2)
    assert.strictEqual(fetchMock.calls.length, 0);

    client.log('Log message 3');

    // Wait slightly for batch completion
    await new Promise((resolve) => setTimeout(resolve, 20));

    // Batch size reached, should have sent 1 flush request
    assert.strictEqual(fetchMock.calls.length, 1);
    
    const call = fetchMock.calls[0];
    assert.strictEqual(call.url, 'http://mock-api:8080/api/v1/ingest');
    assert.strictEqual(call.options.headers['X-Stream-Key'], 'test-js-key');

    const body = JSON.parse(call.options.body);
    assert.strictEqual(body.length, 3);
    assert.strictEqual(body[0].message, 'Log message 1');
    assert.strictEqual(body[2].message, 'Log message 3');

    client.shutdown();
  } finally {
    fetchMock.restore();
  }
});

test('Console log interception', async (t) => {
  const fetchMock = setupFetchMock();

  try {
    const client = init({
      streamKey: 'test-hijack-key',
      endpoint: 'http://mock-api:8080',
      batchSize: 1,
      flushIntervalMs: 5000,
    });

    captureConsole(client);

    // Call console.log
    console.log('Test console log redirect message');

    // Wait a brief moment
    await new Promise((resolve) => setTimeout(resolve, 20));

    // Since batchSize is 1, it should have flushed immediately
    assert.strictEqual(fetchMock.calls.length, 1);
    const body = JSON.parse(fetchMock.calls[0].options.body);
    assert.strictEqual(body[0].message, 'Test console log redirect message');
    assert.strictEqual(body[0].level, 'info');

    restoreConsole();
    client.shutdown();
  } finally {
    fetchMock.restore();
  }
});
