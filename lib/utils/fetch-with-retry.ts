// ============================================
// MRKT - Fetch with Retry Utility
// Handles network errors and timeouts gracefully
// ============================================

interface FetchWithRetryConfig {
  retries?: number;
  timeout?: number;
  backoff?: boolean;
}

export async function fetchWithRetry<T>(
  url: string,
  options: RequestInit = {},
  config: FetchWithRetryConfig = {}
): Promise<T> {
  const {
    retries = 3,
    timeout = 10000,
    backoff = true,
  } = config;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json() as T;
    } catch (error) {
      // Don't retry on abort (timeout)
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Request timeout after ${timeout}ms`);
      }

      // Last retry - throw error
      if (i === retries - 1) {
        throw error;
      }

      // Wait before retry (exponential backoff)
      const delay = backoff ? 1000 * Math.pow(2, i) : 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw new Error('Max retries exceeded');
}
