/**
 * SES1 — a readable name for a session's device from its user agent: the
 * browser and system, or "the app" for the mobile apps (Dart's HTTP client).
 * Best effort and display only.
 */
export interface DeviceInfo {
  kind: 'desktop' | 'mobile' | 'app' | 'unknown';
  browser: string | null;
  os: string | null;
}

export function describeDevice(ua: string | null | undefined): DeviceInfo {
  if (!ua) return { kind: 'unknown', browser: null, os: null };
  if (/^Dart\//.test(ua) || /dart:io/.test(ua)) return { kind: 'app', browser: null, os: null };
  const os = /iPhone|iPad|iPod/.test(ua)
    ? 'iOS'
    : /Android/.test(ua)
      ? 'Android'
      : /Windows/.test(ua)
        ? 'Windows'
        : /Mac OS X|Macintosh/.test(ua)
          ? 'macOS'
          : /CrOS/.test(ua)
            ? 'ChromeOS'
            : /Linux/.test(ua)
              ? 'Linux'
              : null;
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /OPR\/|Opera/.test(ua)
      ? 'Opera'
      : /Firefox\//.test(ua)
        ? 'Firefox'
        : /SamsungBrowser\//.test(ua)
          ? 'Samsung Internet'
          : /Chrome\//.test(ua)
            ? 'Chrome'
            : /Safari\//.test(ua)
              ? 'Safari'
              : null;
  const mobile = /Mobile|iPhone|iPod|Android/.test(ua);
  return { kind: mobile ? 'mobile' : os || browser ? 'desktop' : 'unknown', browser, os };
}
