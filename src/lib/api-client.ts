export type ApiResponse<T> = { success: boolean; data: T; error: string | null };

let isRefreshingSession = false;
let refreshSessionPromise: Promise<void> | null = null;

function isAuthEndpoint(input: RequestInfo) {
  if (typeof input === "string") {
    return input.includes("/api/auth/login") || input.includes("/api/auth/refresh") || input.includes("/api/auth/logout");
  }
  return false;
}

async function refreshAccessToken() {
  if (isRefreshingSession) {
    return refreshSessionPromise;
  }

  isRefreshingSession = true;
  refreshSessionPromise = (async () => {
    const response = await fetch("/api/auth/refresh", {
      method: "POST",
      credentials: "include",
    });

    if (!response.ok) {
      throw new Error("Unable to refresh authentication session");
    }
  })().finally(() => {
    isRefreshingSession = false;
    refreshSessionPromise = null;
  });

  return refreshSessionPromise;
}

export async function apiFetch<T>(input: RequestInfo, init: RequestInit = {}) {
  const headers = new Headers(init.headers ?? {});

  if (init.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  const requestOptions: RequestInit = {
    ...init,
    credentials: "include",
    headers,
  };

  let response = await fetch(input, requestOptions);

  if (response.status === 401 && !isAuthEndpoint(input)) {
    try {
      await refreshAccessToken();
      response = await fetch(input, requestOptions);
    } catch {
      // Fall through to the original error handling below.
    }
  }

  let payload: ApiResponse<T> | null = null;
  try {
    payload = (await response.json()) as ApiResponse<T>;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    throw new Error((payload?.error ?? response.statusText) || "API request failed");
  }

  return payload ?? { success: true, data: {} as T, error: null };
}
