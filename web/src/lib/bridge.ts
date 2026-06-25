// This file is auto-generated. Do not edit.

export interface BridgeConfig {
  baseUrl?: string;
  headers?: Record<string, string> | (() => Record<string, string> | Promise<Record<string, string>>);
}

export interface HelloInput {
  name: string;
}

export interface HelloOutput {
  message: string;
  timestamp: string;
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

export interface User {
  id: number;
  email: string;
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

}

export const API = new BridgeClient();
