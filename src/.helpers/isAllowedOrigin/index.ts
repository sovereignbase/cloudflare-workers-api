export function isAllowedOrigin(
  origin: string | undefined,
  allowedOrigins: readonly string[],
): boolean {
  if (!origin) return false;

  let url: URL;

  try {
    url = new URL(origin);
  } catch {
    return false;
  }

  return allowedOrigins.some((allowed) => {
    if (allowed.startsWith("https://*.")) {
      const hostname = allowed.slice("https://*.".length);

      return (
        url.protocol === "https:" &&
        (url.hostname === hostname || url.hostname.endsWith(`.${hostname}`))
      );
    }

    if (allowed.startsWith("http://*.")) {
      const hostname = allowed.slice("http://*.".length);

      return (
        url.protocol === "http:" &&
        (url.hostname === hostname || url.hostname.endsWith(`.${hostname}`))
      );
    }

    return url.origin === new URL(allowed).origin;
  });
}
