// Cloudflare Worker: liefert die App aus, fragt die KI (kostenlos) und hält den Azure-Schlüssel auf dem Server.
// Alle /api-Adressen nur mit gültiger Cloudflare-Access-Anmeldung.
import { accessToken, verifyAccess } from './access';
import { buildSsml, MAX_TTS_CHARS } from '../src/lib/ssml';
import { ollamaChat, toMessages, workersAiChat, type ChatRequest, type ChatResponse } from '../src/ai/llm';

export interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
  /** Cloudflare Workers AI (kostenloses Tageskontingent), Ersatz, wenn der PC aus ist */
  AI?: { run(model: string, input: object): Promise<unknown> };
  /** Ollama auf Jans PC über den Cloudflare-Tunnel, z. B. "https://ollama.jan-lab.de" */
  OLLAMA_URL?: string;
  OLLAMA_MODEL?: string;
  /** Access-Service-Token, mit dem der Worker durch die Sperre vor Ollama kommt */
  OLLAMA_ACCESS_ID?: string;
  OLLAMA_ACCESS_SECRET?: string;
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
  // trim: per Pipe gesetzte Secrets können einen Zeilenumbruch enthalten.
  const teamDomain = env.ACCESS_TEAM_DOMAIN?.trim();
  const aud = env.ACCESS_AUD?.trim();
  if (!teamDomain || !aud) return false;
  const token = accessToken(request);
  return !!token && (await verifyAccess(token, { teamDomain, aud }));
}

const speechReady = (env: Env) => !!(env.AZURE_SPEECH_KEY && env.AZURE_SPEECH_REGION);

const aiReady = (env: Env) => !!(env.AI || env.OLLAMA_URL);

/** Erst das lokale Qwen (PC an?), sonst Qwen auf Workers AI. */
async function chat(request: Request, env: Env): Promise<Response> {
  const { system, turns, schema } = (await request.json()) as ChatRequest;
  if (typeof system !== 'string' || !Array.isArray(turns) || typeof schema !== 'object') return json({ error: 'Ungültige Anfrage' }, 400);
  const messages = toMessages(system, turns, schema);
  if (env.OLLAMA_URL) {
    try {
      const headers: Record<string, string> = env.OLLAMA_ACCESS_ID
        ? { 'CF-Access-Client-Id': env.OLLAMA_ACCESS_ID, 'CF-Access-Client-Secret': env.OLLAMA_ACCESS_SECRET ?? '' }
        : {};
      const text = await ollamaChat(env.OLLAMA_URL, env.OLLAMA_MODEL ?? 'qwen-local', messages, schema, headers);
      return json({ text, engine: 'lokal' } satisfies ChatResponse);
    } catch {
      // PC aus oder Tunnel weg: weiter mit Cloudflare
    }
  }
  if (!env.AI) return json({ error: 'Keine KI erreichbar' }, 503);
  try {
    return json({ text: await workersAiChat(env.AI, messages), engine: 'cloudflare' } satisfies ChatResponse);
  } catch (e) {
    // Tageskontingent aufgebraucht: Cloudflare meldet das als Fehler 4006.
    const limit = /4006|daily free allocation|neurons/i.test(String(e));
    return json({ error: limit ? 'Tageskontingent aufgebraucht' : `Workers AI: ${String(e)}` }, limit ? 429 : 502);
  }
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
    if (route === 'GET /api/config') return json({ ai: aiReady(env), speech: speechReady(env) });
    if (route === 'POST /api/chat') return chat(request, env);
    if (!speechReady(env) && url.pathname.startsWith('/api/speech')) return json({ error: 'Azure Speech nicht eingerichtet' }, 503);
    if (route === 'GET /api/speech/token') return speechToken(env);
    if (route === 'POST /api/speech/tts') return tts(request, env);
    return json({ error: 'Unbekannte Adresse' }, 404);
  },
};
