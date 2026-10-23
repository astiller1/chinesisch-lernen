// Cloudflare Worker: liefert die App aus und hält die Schlüssel für Claude und Azure Speech auf dem Server.
// Alle /api-Adressen nur mit gültiger Cloudflare-Access-Anmeldung.
import { accessToken, verifyAccess } from './access';
import { buildSsml, MAX_TTS_CHARS } from '../src/lib/ssml';

export interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
  ANTHROPIC_API_KEY?: string;
  AZURE_SPEECH_KEY?: string;
  AZURE_SPEECH_REGION?: string;
  /** z. B. "jan-lab.cloudflareaccess.com" */
  ACCESS_TEAM_DOMAIN?: string;
  /** Application Audience (AUD) Tag */
  ACCESS_AUD?: string;
  /** nur für `wrangler dev` auf dem eigenen Rechner: "1" schaltet die Access-Prüfung ab */
  ALLOW_WITHOUT_ACCESS?: string;
}

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });

async function allowed(request: Request, env: Env): Promise<boolean> {
  if (env.ALLOW_WITHOUT_ACCESS === '1') return true;
  // Ohne Access-Konfiguration bleiben die Schlüssel gesperrt (lieber zu als offen).
  if (!env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD) return false;
  const token = accessToken(request);
  return !!token && (await verifyAccess(token, { teamDomain: env.ACCESS_TEAM_DOMAIN, aud: env.ACCESS_AUD }));
}

const speechReady = (env: Env) => !!(env.AZURE_SPEECH_KEY && env.AZURE_SPEECH_REGION);

async function anthropic(request: Request, env: Env): Promise<Response> {
  if (!env.ANTHROPIC_API_KEY) return json({ type: 'error', error: { type: 'authentication_error', message: 'Kein Claude-Schlüssel auf dem Server' } }, 401);
  const headers = new Headers({ 'content-type': 'application/json', 'x-api-key': env.ANTHROPIC_API_KEY });
  for (const h of ['anthropic-version', 'anthropic-beta']) {
    const v = request.headers.get(h);
    if (v) headers.set(h, v);
  }
  const res = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers, body: request.body });
  return new Response(res.body, { status: res.status, headers: { 'content-type': res.headers.get('content-type') ?? 'application/json' } });
}

async function speechToken(env: Env): Promise<Response> {
  const res = await fetch(`https://${env.AZURE_SPEECH_REGION}.api.cognitive.microsoft.com/sts/v1.0/issueToken`, {
    method: 'POST',
    headers: { 'Ocp-Apim-Subscription-Key': env.AZURE_SPEECH_KEY! },
  });
  if (!res.ok) return json({ error: `Azure-Token: ${res.status}` }, 502);
  return json({ token: await res.text(), region: env.AZURE_SPEECH_REGION });
}

async function tts(request: Request, env: Env): Promise<Response> {
  const { text, voice, rate } = (await request.json()) as { text?: string; voice?: string; rate?: number };
  if (!text || text.length > MAX_TTS_CHARS) return json({ error: 'Text fehlt oder ist zu lang' }, 400);
  const res = await fetch(`https://${env.AZURE_SPEECH_REGION}.tts.speech.microsoft.com/cognitiveservices/v1`, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': env.AZURE_SPEECH_KEY!,
      'Content-Type': 'application/ssml+xml',
      'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
      'User-Agent': 'chinesisch-lernen',
    },
    body: buildSsml(text, voice ?? '', rate ?? 1),
  });
  if (!res.ok) return json({ error: `Azure-Sprachausgabe: ${res.status}` }, 502);
  return new Response(res.body, { headers: { 'content-type': 'audio/mpeg', 'cache-control': 'private, max-age=86400' } });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    if (!(await allowed(request, env))) return json({ error: 'Nicht angemeldet' }, 403);

    const route = `${request.method} ${url.pathname}`;
    if (route === 'GET /api/config') return json({ claude: !!env.ANTHROPIC_API_KEY, speech: speechReady(env) });
    if (route === 'POST /api/anthropic/v1/messages') return anthropic(request, env);
    if (!speechReady(env) && url.pathname.startsWith('/api/speech')) return json({ error: 'Azure Speech nicht eingerichtet' }, 503);
    if (route === 'GET /api/speech/token') return speechToken(env);
    if (route === 'POST /api/speech/tts') return tts(request, env);
    return json({ error: 'Unbekannte Adresse' }, 404);
  },
};
