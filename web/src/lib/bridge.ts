// This file is auto-generated. Do not edit.

export interface BridgeConfig {
  baseUrl?: string;
  headers?: Record<string, string> | (() => Record<string, string> | Promise<Record<string, string>>);
}

export interface CreateProjectInput {
  name: string;
}

export interface CreateProjectOutput {
  success: boolean;
  project: Project;
}

export interface CreateStreamInput {
  projectId: number;
  name: string;
}

export interface CreateStreamOutput {
  success: boolean;
  stream: Stream;
}

export interface CurrentUserOutput {
  success: boolean;
  user: User;
}

export interface EmptyInput {
}

export interface ErrorGroup {
  message: string;
  errorGroup: string;
  count: number;
  firstSeen: string;
  lastSeen: string;
  level: string;
}

export interface GetErrorDetailsInput {
  errorGroup: string;
}

export interface GetErrorDetailsOutput {
  errors: LogEvent[];
}

export interface GetLogHistogramInput {
  projectId: number;
  streamId: number;
  query: string;
  levels: string[];
  startTime: string;
  endTime: string;
}

export interface GetLogHistogramOutput {
  buckets: HistogramBucket[];
}

export interface HelloInput {
  name: string;
}

export interface HelloOutput {
  message: string;
  timestamp: string;
}

export interface HistogramBucket {
  time: string;
  count: number;
}

export interface ListProjectsOutput {
  projects: Project[];
}

export interface ListStreamsInput {
  projectId: number;
}

export interface ListStreamsOutput {
  streams: Stream[];
}

export interface LogEvent {
  id: number;
  projectId: number;
  streamId: number;
  type: string;
  timestamp: string;
  level: string;
  message: string;
  payload: Record<string, any>;
}

export interface LoginInput {
  username: string;
  password: string;
}

export interface LoginOutput {
  success: boolean;
  token: string;
  user: User;
}

export interface LogoutInput {
}

export interface LogoutOutput {
  success: boolean;
}

export interface MetricDataPoint {
  timestamp: string;
  value: number;
}

export interface Project {
  id: number;
  name: string;
  apiKey: string;
  createdAt: string;
}

export interface QueryErrorsInput {
  projectId: number;
  startTime: string;
  endTime: string;
}

export interface QueryErrorsOutput {
  errors: ErrorGroup[];
}

export interface QueryLogsInput {
  projectId: number;
  streamId: number;
  query: string;
  levels: string[];
  startTime: string;
  endTime: string;
  limit: number;
  offset: number;
}

export interface QueryLogsOutput {
  logs: LogEvent[];
}

export interface QueryMetricsInput {
  projectId: number;
  metricName: string;
  startTime: string;
  endTime: string;
}

export interface QueryMetricsOutput {
  points: MetricDataPoint[];
}

export interface SignUpInput {
  email: string;
  name: string;
  password: string;
}

export interface SignUpOutput {
  success: boolean;
  token: string;
  user: User;
}

export interface Stream {
  id: number;
  projectId: number;
  name: string;
  streamKey: string;
  createdAt: string;
}

export interface User {
  id: number;
  email: string;
  name: string;
}

export class BridgeClient {
  private config: BridgeConfig;

  constructor(config: BridgeConfig = {}) {
    this.config = config;
  }

  private async getHeaders(): Promise<Record<string, string>> {
    let headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.config.headers) {
      const extraHeaders = typeof this.config.headers === 'function' ? await this.config.headers() : this.config.headers;
      headers = { ...headers, ...extraHeaders };
    }
    return headers;
  }

  /** Creates a new project. */
  async createProject(input: CreateProjectInput): Promise<CreateProjectOutput> {
    const res = await fetch(`${this.config.baseUrl || ''}/api/v1/bridge/createProject`, {
      method: 'POST',
      headers: await this.getHeaders(),
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || `Bridge error: ${res.status}`);
    }
    return res.json();
  }

  /** Creates a new ingestion stream. */
  async createStream(input: CreateStreamInput): Promise<CreateStreamOutput> {
    const res = await fetch(`${this.config.baseUrl || ''}/api/v1/bridge/createStream`, {
      method: 'POST',
      headers: await this.getHeaders(),
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || `Bridge error: ${res.status}`);
    }
    return res.json();
  }

  /** Generates demo logs, metrics, and errors. */
  async generateDemoData(input: EmptyInput): Promise<EmptyInput> {
    const res = await fetch(`${this.config.baseUrl || ''}/api/v1/bridge/generateDemoData`, {
      method: 'POST',
      headers: await this.getHeaders(),
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || `Bridge error: ${res.status}`);
    }
    return res.json();
  }

  /** Returns the current authenticated user. */
  async getCurrentUser(input: EmptyInput): Promise<CurrentUserOutput> {
    const res = await fetch(`${this.config.baseUrl || ''}/api/v1/bridge/getCurrentUser`, {
      method: 'POST',
      headers: await this.getHeaders(),
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || `Bridge error: ${res.status}`);
    }
    return res.json();
  }

  /** Gets error detail events. */
  async getErrorDetails(input: GetErrorDetailsInput): Promise<GetErrorDetailsOutput> {
    const res = await fetch(`${this.config.baseUrl || ''}/api/v1/bridge/getErrorDetails`, {
      method: 'POST',
      headers: await this.getHeaders(),
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || `Bridge error: ${res.status}`);
    }
    return res.json();
  }

  /** Gets log count distribution over time. */
  async getLogHistogram(input: GetLogHistogramInput): Promise<GetLogHistogramOutput> {
    const res = await fetch(`${this.config.baseUrl || ''}/api/v1/bridge/getLogHistogram`, {
      method: 'POST',
      headers: await this.getHeaders(),
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || `Bridge error: ${res.status}`);
    }
    return res.json();
  }

  /** Returns a greeting message. */
  async hello(input: HelloInput): Promise<HelloOutput> {
    const res = await fetch(`${this.config.baseUrl || ''}/api/v1/bridge/hello`, {
      method: 'POST',
      headers: await this.getHeaders(),
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || `Bridge error: ${res.status}`);
    }
    return res.json();
  }

  /** Lists all projects. */
  async listProjects(input: EmptyInput): Promise<ListProjectsOutput> {
    const res = await fetch(`${this.config.baseUrl || ''}/api/v1/bridge/listProjects`, {
      method: 'POST',
      headers: await this.getHeaders(),
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || `Bridge error: ${res.status}`);
    }
    return res.json();
  }

  /** Lists all streams for a project. */
  async listStreams(input: ListStreamsInput): Promise<ListStreamsOutput> {
    const res = await fetch(`${this.config.baseUrl || ''}/api/v1/bridge/listStreams`, {
      method: 'POST',
      headers: await this.getHeaders(),
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || `Bridge error: ${res.status}`);
    }
    return res.json();
  }

  /** Authenticates a user and returns a token. */
  async login(input: LoginInput): Promise<LoginOutput> {
    const res = await fetch(`${this.config.baseUrl || ''}/api/v1/bridge/login`, {
      method: 'POST',
      headers: await this.getHeaders(),
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || `Bridge error: ${res.status}`);
    }
    return res.json();
  }

  /** Logs out a user and invalidates their session. */
  async logout(input: LogoutInput): Promise<LogoutOutput> {
    const res = await fetch(`${this.config.baseUrl || ''}/api/v1/bridge/logout`, {
      method: 'POST',
      headers: await this.getHeaders(),
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || `Bridge error: ${res.status}`);
    }
    return res.json();
  }

  /** Queries grouped error events. */
  async queryErrors(input: QueryErrorsInput): Promise<QueryErrorsOutput> {
    const res = await fetch(`${this.config.baseUrl || ''}/api/v1/bridge/queryErrors`, {
      method: 'POST',
      headers: await this.getHeaders(),
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || `Bridge error: ${res.status}`);
    }
    return res.json();
  }

  /** Queries log events with filters. */
  async queryLogs(input: QueryLogsInput): Promise<QueryLogsOutput> {
    const res = await fetch(`${this.config.baseUrl || ''}/api/v1/bridge/queryLogs`, {
      method: 'POST',
      headers: await this.getHeaders(),
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || `Bridge error: ${res.status}`);
    }
    return res.json();
  }

  /** Queries metrics data over time. */
  async queryMetrics(input: QueryMetricsInput): Promise<QueryMetricsOutput> {
    const res = await fetch(`${this.config.baseUrl || ''}/api/v1/bridge/queryMetrics`, {
      method: 'POST',
      headers: await this.getHeaders(),
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || `Bridge error: ${res.status}`);
    }
    return res.json();
  }

  /** Registers a new user. */
  async signup(input: SignUpInput): Promise<SignUpOutput> {
    const res = await fetch(`${this.config.baseUrl || ''}/api/v1/bridge/signup`, {
      method: 'POST',
      headers: await this.getHeaders(),
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || `Bridge error: ${res.status}`);
    }
    return res.json();
  }

}

export const API = new BridgeClient();
