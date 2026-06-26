import { init, captureConsole, captureExceptions } from './index';

// Auto configuration lookups
let streamKey: string | undefined;
let endpoint: string | undefined;

// Browser detection
if (typeof window !== 'undefined') {
  streamKey = (window as any).CONSOLE_LOG_STREAM_KEY || (globalThis as any).CONSOLE_LOG_STREAM_KEY;
  endpoint = (window as any).CONSOLE_LOG_ENDPOINT || (globalThis as any).CONSOLE_LOG_ENDPOINT;
}

// Node detection
if (typeof process !== 'undefined' && process.env) {
  streamKey = streamKey || process.env.CONSOLE_LOG_STREAM_KEY;
  endpoint = endpoint || process.env.CONSOLE_LOG_ENDPOINT;
}

// Initialize if we found the key
if (streamKey) {
  const client = init({
    streamKey,
    endpoint,
  });
  captureConsole(client);
  captureExceptions(client);
  
  // Also log setup confirmation
  console.log('[Console Log] SDK initialized and capturing telemetry automatically.');
} else {
  // If imported but no key found, wait for configuration (optional, developer can call manually)
  // We write to stderr/original console error so they know it is missing
  if (typeof process !== 'undefined') {
    process.stderr.write('[Console Log] Warning: SDK auto-import loaded but CONSOLE_LOG_STREAM_KEY environment variable is not defined.\n');
  } else {
    console.warn('[Console Log] Warning: SDK auto-import loaded but window.CONSOLE_LOG_STREAM_KEY is not defined.');
  }
}
