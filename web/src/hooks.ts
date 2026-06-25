import { useState, useEffect, useCallback } from 'react';

/**
 * Custom hook for data fetching with loading/error states and auto-refresh.
 * @param fetchFn - Async function that returns data
 * @param interval - Auto-refresh interval in ms (0 to disable)
 */
export function useFetch<T>(fetchFn: () => Promise<T>, interval = 0) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    try {
      setError(null);
      const result = await fetchFn();
      setData(result);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [fetchFn]);

  useEffect(() => {
    refetch();

    if (interval > 0) {
      const id = setInterval(refetch, interval);
      return () => clearInterval(id);
    }
  }, [refetch, interval]);

  return { data, loading, error, refetch };
}
