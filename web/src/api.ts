const API_BASE = '';

export interface HealthResponse {
  status: string;
  uptime: string;
  timestamp: string;
  system: {
    goroutines: number;
    cpus: number;
    mem_alloc_mb: number;
    mem_sys_mb: number;
    go_version: string;
    os: string;
    arch: string;
    gc_cycles: number;
  };
  stats: {
    total_requests: number;
  };
}

export interface VersionResponse {
  version: string;
  git_commit: string;
  git_branch: string;
  build_time: string;
  go_version: string;
  os: string;
  arch: string;
}

/**
 * Fetch health status from /healthz
 */
export async function fetchHealth(): Promise<HealthResponse> {
  const res = await fetch(`${API_BASE}/healthz`);
  if (!res.ok) throw new Error(`Health check failed: ${res.status}`);
  return res.json();
}

/**
 * Fetch version info from /version
 */
export async function fetchVersion(): Promise<VersionResponse> {
  const res = await fetch(`${API_BASE}/version`);
  if (!res.ok) throw new Error(`Version check failed: ${res.status}`);
  return res.json();
}

/**
 * Fetch readiness status from /readyz
 */
export async function fetchReadiness(): Promise<any> {
  const res = await fetch(`${API_BASE}/readyz`);
  if (!res.ok) throw new Error(`Readiness check failed: ${res.status}`);
  return res.json();
}

/**
 * Sample API call to /api/hello
 */
export async function fetchHello(name = ''): Promise<any> {
  const params = name ? `?name=${encodeURIComponent(name)}` : '';
  const res = await fetch(`${API_BASE}/api/hello${params}`);
  if (!res.ok) throw new Error(`API call failed: ${res.status}`);
  return res.json();
}
