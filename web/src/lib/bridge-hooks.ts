import { useState, useEffect, useCallback, useRef } from 'react';
import { API, BridgeClient } from './bridge';

/**
 * Filtered keys of BridgeClient that are actual procedures.
 */
export type BridgeProcedures = {
  [K in keyof BridgeClient]: BridgeClient[K] extends (input: any) => Promise<any> ? K : never
}[keyof BridgeClient];

export interface UseBridgeOptions<P extends BridgeProcedures> {
  enabled?: boolean;
  revalidateOnMount?: boolean;
  cacheKey?: string | null;
  onSuccess?: (data: Awaited<ReturnType<BridgeClient[P]>>) => void;
  onError?: (error: Error) => void;
}

/**
 * A type-safe hook for calling Bridge API procedures with caching and revalidation.
 */
export function useBridge<P extends BridgeProcedures>(
  procedure: P,
  input: Parameters<BridgeClient[P]>[0],
  options: UseBridgeOptions<P> = {}
) {
  type Output = Awaited<ReturnType<BridgeClient[P]>>;
  
  const {
    enabled = true,
    revalidateOnMount = true,
    cacheKey = null,
    onSuccess,
    onError,
  } = options;

  const [data, setData] = useState<Output | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(enabled);
  
  // Simple global cache
  const cache = useRef<Map<string, any>>((useBridge as any).cache || ((useBridge as any).cache = new Map()));
  const key = cacheKey || `${String(procedure)}-${JSON.stringify(input)}`;

  const execute = useCallback(async (overrides: Partial<Parameters<BridgeClient[P]>[0]> = {}) => {
    setLoading(true);
    setError(null);
    try {
      // @ts-ignore - dynamic access
      const result = await API[procedure]({ ...input, ...overrides });
      setData(result);
      cache.current.set(key, result);
      if (onSuccess) onSuccess(result);
      return result;
    } catch (err: any) {
      const errorInstance = err instanceof Error ? err : new Error(String(err));
      setError(errorInstance);
      if (onError) onError(errorInstance);
      throw errorInstance;
    } finally {
      setLoading(false);
    }
  }, [procedure, input, key, onSuccess, onError]);

  useEffect(() => {
    if (!enabled) return;

    const cachedData = cache.current.get(key);
    if (cachedData) {
      setData(cachedData);
      if (revalidateOnMount) {
        execute();
      } else {
        setLoading(false);
      }
    } else {
      execute();
    }
  }, [enabled, key]);

  return { data, error, loading, refetch: execute };
}
