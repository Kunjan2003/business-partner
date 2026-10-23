/** A PKCE code is single-use. React may run the callback effect more than once. */
export function createBrowserCallback(
  exchange: (code: string) => Promise<void>,
) {
  const exchanges = new Map<string, Promise<void>>();
  return async (search: string) => {
    const params = new URLSearchParams(search);
    const error = params.get("error_description");
    if (error) throw new Error(error);
    const code = params.get("code");
    if (!code) throw new Error("No sign-in code. Please try signing in again.");
    let pending = exchanges.get(code);
    if (!pending) {
      pending = exchange(code);
      exchanges.set(code, pending);
      if (exchanges.size > 10) exchanges.delete(exchanges.keys().next().value!);
    }
    await pending;
    return params.get("recovery") === "1" ? "/?recovery=1" : "/";
  };
}
