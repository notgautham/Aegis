const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/**
 * Aegis API client for communicating with the FastAPI backend.
 */
export async function apiFetch<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(
      error.detail || `API request failed: ${response.status} ${response.statusText}`
    );
  }

  return response.json();
}

/**
 * Health check — verify backend is reachable.
 */
export async function checkHealth(): Promise<{ status: string }> {
  return apiFetch("/health");
}
