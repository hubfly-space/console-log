export interface ConsoleLogConfig {
  streamKey: string;
  endpoint?: string;
  batchSize?: number;
  flushIntervalMs?: number;
  maxQueueSize?: number;
  maxRetries?: number;
  retryDelayMs?: number;
}

export interface IngestEvent {
  type: 'log' | 'metric' | 'error';
  timestamp?: string;
  level?: 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  message: string;
  payload?: Record<string, any>;
}

export class ConsoleLogClient {
  private streamKey: string;
  private endpoint: string;
  private batchSize: number;
  private flushIntervalMs: number;
  private maxQueueSize: number;
  private maxRetries: number;
  private retryDelayMs: number;

  private queue: IngestEvent[] = [];
  private isSending = false;
  private timer: any = null;

  constructor(config: ConsoleLogConfig) {
    if (!config.streamKey) {
      throw new Error('ConsoleLogClient: streamKey is required');
    }
    this.streamKey = config.streamKey;
    this.endpoint = (config.endpoint || 'http://localhost:8080').replace(/\/$/, '');
    this.batchSize = config.batchSize ?? 20;
    this.flushIntervalMs = config.flushIntervalMs ?? 2000;
    this.maxQueueSize = config.maxQueueSize ?? 1000;
    this.maxRetries = config.maxRetries ?? 5;
    this.retryDelayMs = config.retryDelayMs ?? 1000;

    this.startTimer();
  }

  private startTimer() {
    if (this.timer) return;
    this.timer = setInterval(() => {
      this.flush();
    }, this.flushIntervalMs);

    // Prevent blocking process exit in Node
    if (typeof this.timer.unref === 'function') {
      this.timer.unref();
    }
  }

  public enqueue(event: IngestEvent) {
    if (this.queue.length >= this.maxQueueSize) {
      // Drop the oldest event if queue is full
      this.queue.shift();
    }
    event.timestamp = event.timestamp || new Date().toISOString();
    this.queue.push(event);

    if (this.queue.length >= this.batchSize) {
      this.flush();
    }
  }

  public async flush(): Promise<void> {
    if (this.isSending || this.queue.length === 0) return;
    this.isSending = true;

    const batch = this.queue.slice(0, this.batchSize);

    let success = false;
    let attempts = 0;

    while (!success && attempts < this.maxRetries) {
      try {
        attempts++;
        const response = await fetch(`${this.endpoint}/api/v1/ingest`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Stream-Key': this.streamKey,
          },
          body: JSON.stringify(batch),
        });

        if (response.ok) {
          success = true;
        } else {
          // If server returns bad request (400), don't retry (malformed body)
          if (response.status === 400) {
            console.error('ConsoleLogClient: bad request (400) from server. Dropping batch.');
            break;
          }
          throw new Error(`HTTP status ${response.status}`);
        }
      } catch (err) {
        if (attempts >= this.maxRetries) {
          console.error(`ConsoleLogClient: failed to flush after ${attempts} attempts:`, err);
        } else {
          const delay = this.retryDelayMs * Math.pow(2, attempts - 1);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    if (success) {
      // Remove successfully sent items from queue
      this.queue.splice(0, batch.length);
    }

    this.isSending = false;

    // If queue still has items, check if we should trigger another flush
    if (this.queue.length >= this.batchSize) {
      this.flush();
    }
  }

  // Explicit telemetries
  public log(message: string, payload?: Record<string, any>) {
    this.enqueue({ type: 'log', level: 'info', message, payload });
  }

  public info(message: string, payload?: Record<string, any>) {
    this.enqueue({ type: 'log', level: 'info', message, payload });
  }

  public debug(message: string, payload?: Record<string, any>) {
    this.enqueue({ type: 'log', level: 'debug', message, payload });
  }

  public warn(message: string, payload?: Record<string, any>) {
    this.enqueue({ type: 'log', level: 'warn', message, payload });
  }

  public error(message: string, payload?: Record<string, any>) {
    this.enqueue({ type: 'error', level: 'error', message, payload });
  }

  public metric(name: string, value: number, payload?: Record<string, any>) {
    this.enqueue({
      type: 'metric',
      message: name,
      payload: { ...payload, value },
    });
  }

  public shutdown() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}

// Global client instance container
let globalClient: ConsoleLogClient | null = null;
let originalConsole: Record<string, (...args: any[]) => void> = {};

export function init(config: ConsoleLogConfig): ConsoleLogClient {
  globalClient = new ConsoleLogClient(config);
  return globalClient;
}

export function getClient(): ConsoleLogClient | null {
  return globalClient;
}

// Intercept window/process uncaught exceptions
export function captureExceptions(client?: ConsoleLogClient) {
  const activeClient = client || globalClient;
  if (!activeClient) {
    console.error('ConsoleLog: cannot capture exceptions before initialization');
    return;
  }

  // Browser uncaught errors
  if (typeof window !== 'undefined') {
    const prevOnError = window.onerror;
    window.onerror = (message, source, lineno, colno, error) => {
      activeClient.enqueue({
        type: 'error',
        level: 'fatal',
        message: error?.message || String(message),
        payload: {
          source,
          lineno,
          colno,
          stack: error?.stack,
        },
      });
      if (prevOnError) {
        return prevOnError(message, source, lineno, colno, error);
      }
      return false;
    };

    const prevOnRejection = window.onunhandledrejection;
    window.onunhandledrejection = (event) => {
      const reason = event.reason;
      activeClient.enqueue({
        type: 'error',
        level: 'fatal',
        message: reason?.message || String(reason),
        payload: {
          stack: reason?.stack,
          promiseRejection: true,
        },
      });
      if (prevOnRejection) {
        prevOnRejection.call(window, event);
      }
    };
  }

  // Node uncaught errors
  if (typeof process !== 'undefined') {
    process.on('uncaughtException', (error) => {
      activeClient.enqueue({
        type: 'error',
        level: 'fatal',
        message: error?.message || String(error),
        payload: {
          stack: error?.stack,
          uncaught: true,
        },
      });
      // Make sure it flushes before exit
      activeClient.flush().finally(() => {
        if (originalConsole.error) {
          originalConsole.error('Uncaught Exception:', error);
        } else {
          console.error('Uncaught Exception:', error);
        }
        process.exit(1);
      });
    });

    process.on('unhandledRejection', (reason: any) => {
      activeClient.enqueue({
        type: 'error',
        level: 'fatal',
        message: reason?.message || String(reason),
        payload: {
          stack: reason?.stack,
          unhandledRejection: true,
        },
      });
    });
  }
}

// Monkeypatch console statements
export function captureConsole(client?: ConsoleLogClient) {
  const activeClient = client || globalClient;
  if (!activeClient) {
    console.error('ConsoleLog: cannot intercept console logs before initialization');
    return;
  }

  const methods: Array<'log' | 'info' | 'warn' | 'error' | 'debug'> = ['log', 'info', 'warn', 'error', 'debug'];

  methods.forEach((method) => {
    if (originalConsole[method]) return; // Avoid double monkeypatching

    const original = (console as any)[method];
    originalConsole[method] = original;

    (console as any)[method] = (...args: any[]) => {
      // Always call the original console first so developer sees it locally
      original.apply(console, args);

      // Safe JSON serialization to handle circular references or complex types
      const cleanArgs = args.map((arg) => {
        if (arg instanceof Error) {
          return { message: arg.message, stack: arg.stack };
        }
        if (typeof arg === 'object' && arg !== null) {
          try {
            // Check for circular reference
            const cache: any[] = [];
            const serialized = JSON.stringify(arg, (key, value) => {
              if (typeof value === 'object' && value !== null) {
                if (cache.indexOf(value) !== -1) {
                  return '[Circular]';
                }
                cache.push(value);
              }
              return value;
            });
            return JSON.parse(serialized);
          } catch (e) {
            return '[Unserializable Object]';
          }
        }
        return arg;
      });

      const message = cleanArgs
        .map((arg) => (typeof arg === 'object' ? JSON.stringify(arg) : String(arg)))
        .join(' ');

      let level: 'debug' | 'info' | 'warn' | 'error' = 'info';
      if (method === 'warn') level = 'warn';
      if (method === 'error') level = 'error';
      if (method === 'debug') level = 'debug';

      const type = method === 'error' ? 'error' : 'log';

      activeClient.enqueue({
        type,
        level,
        message,
        payload: {
          args: cleanArgs,
          logger: 'console',
        },
      });
    };
  });
}

// Restore original console
export function restoreConsole() {
  Object.keys(originalConsole).forEach((method) => {
    (console as any)[method] = originalConsole[method];
  });
  originalConsole = {};
}
