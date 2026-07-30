export function normalizeBaseUrl(url: string) {
  return url.trim().replace(/\/$/, "");
}

export function isLocalhostBaseUrl(url: string) {
  try {
    const { hostname } = new URL(url);
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  } catch {
    return /(^https?:\/\/)?(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(url);
  }
}

export function shouldFallbackFromLocalhost(options: {
  platform: string;
  isDevice: boolean;
  baseUrl: string;
}) {
  return (options.platform === "android" || options.platform === "ios") &&
    options.isDevice &&
    isLocalhostBaseUrl(options.baseUrl);
}
