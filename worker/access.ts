// Prüft das Cloudflare-Access-Token (JWT, RS256), damit nur angemeldete Personen die Schlüssel nutzen können.

export interface AccessConfig {
  /** z. B. "jan-lab.cloudflareaccess.com" */
  teamDomain: string;
  /** Application Audience (AUD) Tag der Access-Anwendung */
  aud: string;
}

interface Jwk extends JsonWebKey {
  kid: string;
}

export type JwksFetcher = (teamDomain: string) => Promise<Jwk[]>;

let cache: { domain: string; keys: Jwk[]; at: number } | null = null;

export const fetchJwks: JwksFetcher = async (teamDomain) => {
  if (cache && cache.domain === teamDomain && Date.now() - cache.at < 3_600_000) return cache.keys;
  const res = await fetch(`https://${teamDomain}/cdn-cgi/access/certs`);
  if (!res.ok) throw new Error(`certs ${res.status}`);
  const { keys } = (await res.json()) as { keys: Jwk[] };
  cache = { domain: teamDomain, keys, at: Date.now() };
  return keys;
};

function b64urlBytes(s: string): Uint8Array<ArrayBuffer> {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function b64urlJson<T>(s: string): T {
  return JSON.parse(new TextDecoder().decode(b64urlBytes(s))) as T;
}

/** Token aus Header oder Cookie lesen. */
export function accessToken(request: Request): string | null {
  const header = request.headers.get('Cf-Access-Jwt-Assertion');
  if (header) return header;
  const cookie = request.headers.get('Cookie') ?? '';
  const m = /(?:^|;\s*)CF_Authorization=([^;]+)/.exec(cookie);
  return m ? m[1] : null;
}

/** true, wenn das Token gültig ist (Signatur, Aussteller, Audience, Ablauf). */
export async function verifyAccess(token: string, cfg: AccessConfig, jwks: JwksFetcher = fetchJwks, now = Date.now()): Promise<boolean> {
  try {
    const [h, p, sig] = token.split('.');
    if (!h || !p || !sig) return false;
    const header = b64urlJson<{ alg: string; kid: string }>(h);
    if (header.alg !== 'RS256') return false;
    const payload = b64urlJson<{ aud: string | string[]; iss: string; exp: number; nbf?: number }>(p);
    const auds = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    if (!auds.includes(cfg.aud)) return false;
    if (payload.iss !== `https://${cfg.teamDomain}`) return false;
    const secs = now / 1000;
    if (payload.exp < secs || (payload.nbf !== undefined && payload.nbf > secs + 60)) return false;
    const jwk = (await jwks(cfg.teamDomain)).find((k) => k.kid === header.kid);
    if (!jwk) return false;
    const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    return await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64urlBytes(sig), new TextEncoder().encode(`${h}.${p}`));
  } catch {
    return false;
  }
}
