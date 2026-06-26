/**
 * Console Log JS/TS SDK Example App
 * 
 * To run:
 *   1. CONSOLE_LOG_STREAM_KEY=your-stream-key node example.js
 */

const { init, captureConsole, captureExceptions, getClient } = require('./dist/cjs/index.js');

// 1. Initialize client
const streamKey = process.env.CONSOLE_LOG_STREAM_KEY || 'example-key';
const endpoint = process.env.CONSOLE_LOG_ENDPOINT || 'http://localhost:8080';

console.log('Initializing Console Log SDK with endpoint:', endpoint);

const client = init({
  streamKey,
  endpoint,
  batchSize: 2, // Flush quickly for demonstration
  flushIntervalMs: 500,
});

// 2. Enable console capture and uncaught error capture
captureConsole();
captureExceptions();

// 3. Test console logging
console.log('Hello, Console Log! This is an info log.');
console.info('This is an info console message.');
console.warn('Warning: Server response time is higher than normal.');
console.error('Error: Database connection lost. Reconnecting...');

// 4. Test explicit metric logging
client.metric('api.request.latency_ms', 142.5, { path: '/users', method: 'GET' });
client.metric('system.cpu_percent', 42.1);

// 5. Test clean shutdowns
console.log('Logs queued. Waiting for SDK to flush events...');

setTimeout(() => {
  console.log('Finished logging. Shutting down SDK...');
  client.shutdown();
  console.log('SDK shut down. Exiting script.');
  process.exit(0);
}, 2500);
