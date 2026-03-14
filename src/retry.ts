export interface RetryOptions {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  factor?: number;
  jitter?: boolean;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    factor = 2,
    jitter = true,
  } = options;

  let retries = 0;

  while (true) {
    try {
      return await fn();
    } catch (error: any) {
      const isRetryable =
        error.status === 429 ||
        error.status >= 500 ||
        error.name === "AbortError" ||
        error.message?.includes("fetch failed") ||
        error.message?.includes("network");

      if (!isRetryable || retries >= maxRetries) {
        throw error;
      }

      retries++;
      let delay = initialDelay * Math.pow(factor, retries - 1);
      delay = Math.min(delay, maxDelay);

      if (jitter) {
        delay = delay * (0.5 + Math.random());
      }

      console.warn(`Retryable error occurred: ${error.message}. Retrying in ${delay.toFixed(0)}ms... (Attempt ${retries}/${maxRetries})`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}
