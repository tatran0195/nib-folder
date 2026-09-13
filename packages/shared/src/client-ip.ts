/**
 * Pure helpers for resolving the real client IP from proxy headers.
 */

const IPV4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

/** Loose IPv6 shape check — hex groups and colons (after brackets/zone are stripped). */
const IPV6 = /^[0-9a-f:]+$/i;

/** Strip an optional `[...]` wrapper, a `:port` suffix and a `%zone` id from a forwarded hop. */
export const normalizeIp = (raw: string): string => {
  let value = raw.trim().toLowerCase();
  const bracketed = /^\[([^\]]+)\](?::\d+)?$/.exec(value);
  if (bracketed?.[1]) {
    value = bracketed[1];
  } else if (/^\d{1,3}(\.\d{1,3}){3}:\d+$/.test(value)) {
    value = value.slice(0, value.lastIndexOf(':'));
  }
  const zone = value.indexOf('%');
  return zone === -1 ? value : value.slice(0, zone);
};

export const isValidIp = (value: string): boolean => {
  const v4 = IPV4.exec(value);
  if (v4) {
    return v4.slice(1).every((octet) => Number(octet) <= 255);
  }
  return value.includes(':') && IPV6.test(value);
};

/** Private / reserved ranges: loopback, RFC1918, link-local, CGNAT, IPv6 equivalents */
export const isPrivateIp = (ip: string): boolean => {
  const value = ip.startsWith('::ffff:') ? ip.slice(7) : ip;
  const v4 = IPV4.exec(value);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    return (
      a === 10 ||
      a === 127 ||
      a === 0 ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 169 && b === 254) ||
      (a === 100 && b >= 64 && b <= 127)
    );
  }
  return value === '::1' || value === '::' || value.startsWith('fc') || value.startsWith('fd') || value.startsWith('fe80');
};

/**
 * Resolve the client IP from an `x-forwarded-for` chain using RIGHTMOST-UNTRUSTED parsing.
 */
export const clientIpFromForwardedFor = (header: string | null | undefined, trustedHops = 0): string | null => {
  if (!header) {
    return null;
  }
  const hops = header
    .split(',')
    .map((hop) => normalizeIp(hop))
    .filter((hop) => hop.length > 0 && hop !== 'unknown' && isValidIp(hop));
  if (hops.length === 0) {
    return null;
  }
  const candidates = trustedHops > 0 ? hops.slice(0, Math.max(1, hops.length - trustedHops)) : hops;
  for (let i = candidates.length - 1; i >= 0; i--) {
    const hop = candidates[i] as string;
    if (!isPrivateIp(hop)) {
      return hop;
    }
  }
  return (candidates[candidates.length - 1] as string) ?? null;
};
