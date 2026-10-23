import { describe, expect, it } from 'vitest';
import { verifyAccess } from '../worker/access';
import worker, { type Env } from '../worker/index';

const TEAM = 'jan.cloudflareaccess.com';
const AUD = 'aud123';

function b64url(data: Uint8Array | string): string {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function setup() {
  const pair = (await crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['sign', 'verify'],
  )) as CryptoKeyPair;
  const jwk = { ...(await crypto.subtle.exportKey('jwk', pair.publicKey)), kid: 'k1' };
  const sign = async (payload: object, kid = 'k1') => {
    const h = b64url(JSON.stringify({ alg: 'RS256', kid }));
    const p = b64url(JSON.stringify(payload));
    const sig = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', pair.privateKey, new TextEncoder().encode(`${h}.${p}`)));
    return `${h}.${p}.${b64url(sig)}`;
  };
  return { jwks: async () => [jwk as JsonWebKey & { kid: string }], sign };
}

describe('Cloudflare-Access-Prüfung', () => {
  const now = 1_700_000_000_000;
  const good = { aud: [AUD], iss: `https://${TEAM}`, exp: now / 1000 + 600 };

  it('akzeptiert ein gültiges Token', async () => {
    const { jwks, sign } = await setup();
    expect(await verifyAccess(await sign(good), { teamDomain: TEAM, aud: AUD }, jwks, now)).toBe(true);
  });

  it('lehnt falsche Audience, Aussteller, Ablauf und Schlüssel ab', async () => {
    const { jwks, sign } = await setup();
    const cfg = { teamDomain: TEAM, aud: AUD };
    expect(await verifyAccess(await sign({ ...good, aud: ['x'] }), cfg, jwks, now)).toBe(false);
    expect(await verifyAccess(await sign({ ...good, iss: 'https://evil' }), cfg, jwks, now)).toBe(false);
    expect(await verifyAccess(await sign({ ...good, exp: now / 1000 - 1 }), cfg, jwks, now)).toBe(false);
    expect(await verifyAccess(await sign(good, 'unbekannt'), cfg, jwks, now)).toBe(false);
    expect(await verifyAccess('kaputt', cfg, jwks, now)).toBe(false);
  });

  it('lehnt eine gefälschte Signatur ab', async () => {
    const a = await setup();
    const b = await setup();
    expect(await verifyAccess(await b.sign(good), { teamDomain: TEAM, aud: AUD }, a.jwks, now)).toBe(false);
  });
});

describe('Worker', () => {
  const assets = { fetch: async () => new Response('app') };

  it('liefert die App ohne Anmeldung aus', async () => {
    const res = await worker.fetch(new Request('https://x/'), { ASSETS: assets } as Env);
    expect(await res.text()).toBe('app');
  });

  it('sperrt /api ohne Access-Konfiguration', async () => {
    const res = await worker.fetch(new Request('https://x/api/config'), { ASSETS: assets, ANTHROPIC_API_KEY: 'k' } as Env);
    expect(res.status).toBe(403);
  });

  it('meldet, was eingerichtet ist', async () => {
    const env = { ASSETS: assets, ANTHROPIC_API_KEY: 'k', ALLOW_WITHOUT_ACCESS: '1' } as Env;
    const res = await worker.fetch(new Request('https://x/api/config'), env);
    expect(await res.json()).toEqual({ claude: true, speech: false });
    const tts = await worker.fetch(new Request('https://x/api/speech/tts', { method: 'POST', body: '{}' }), env);
    expect(tts.status).toBe(503);
  });
});
