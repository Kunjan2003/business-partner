/** Deduplicate the native Linking event and browser result for the same PKCE code. */
export function createCallbackHandler(
  exchange: (code: string) => Promise<void>,
) {
  const inflight = new Map<string, Promise<boolean>>();
  return (value: string): Promise<boolean> => {
    const url = new URL(value);
    if (
      url.protocol !== "businesspartner:" ||
      url.hostname !== "auth" ||
      url.pathname !== "/callback"
    )
      return Promise.resolve(false);
    const error = url.searchParams.get("error_description");
    if (error) return Promise.reject(new Error(error));
    const code = url.searchParams.get("code");
    if (!code) return Promise.resolve(false);
    const existing = inflight.get(code);
    if (existing) return existing;
    const promise = exchange(code).then(() => true);
    inflight.set(code, promise);
    if (inflight.size > 10) inflight.delete(inflight.keys().next().value!);
    return promise;
  };
}
