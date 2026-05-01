export async function apiFetch(
  path: string,
  init: RequestInit = {}
): Promise<Response> {
  const response = await fetch(path, {
    ...init,
    credentials: "include",
  });

  if (response.status === 401 && typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("auth:unauthorized"));
  }

  return response;
}
