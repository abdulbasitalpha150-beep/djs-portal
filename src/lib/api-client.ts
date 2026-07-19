export type ApiResponse<T> = { success: boolean; data: T; error: string | null };

export async function apiFetch<T>(input: RequestInfo, init: RequestInit = {}) {
  const headers = new Headers(init.headers ?? {});

  if (init.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  const response = await fetch(input, {
    ...init,
    credentials: "include",
    headers,
  });

  const payload = (await response.json()) as ApiResponse<T>;
  if (!response.ok) {
    throw new Error((payload.error ?? response.statusText) || "API request failed");
  }

  return payload;
}
