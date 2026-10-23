// Kostenlose Sprachmodelle (rein, ohne DOM): lokales Qwen über Ollama und Qwen auf Cloudflare Workers AI.
// Wird von der App (lokaler Betrieb) und vom Worker benutzt.

export interface Turn {
  role: 'user' | 'assistant' | 'system';
  /** Text, wie er an die KI ging bzw. von ihr kam (bei der KI: das JSON) */
  content: string;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/** Anfrage der App an den Worker (POST /api/chat). */
export interface ChatRequest {
  system: string;
  turns: Turn[];
  /** JSON-Schema der erwarteten Antwort */
  schema: object;
}

/** Antwort des Workers: Rohtext der KI und wer geantwortet hat. */
export interface ChatResponse {
  text: string;
  engine: Engine;
}

export type Engine = 'lokal' | 'cloudflare';

export const ENGINE_NAMES: Record<Engine, string> = {
  lokal: 'Qwen auf deinem PC',
  cloudflare: 'Qwen bei Cloudflare',
};

/** Modell auf Cloudflare Workers AI: Qwen, sehr günstig im kostenlosen Tageskontingent. */
export const WORKERS_AI_MODEL = '@cf/qwen/qwen3-30b-a3b-fp8';

/**
 * Baut die Nachrichtenliste: Systemanweisung mit Antwortformat vorn.
 * Hinweise mitten im Gespräch (role "system") hängen wir an die Nutzernachricht an,
 * weil nicht jede Chat-Vorlage Systemnachrichten zwischendrin erlaubt.
 */
export function toMessages(system: string, turns: Turn[], schema: object): ChatMessage[] {
  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: `${system}\n\n# Antwortformat\nAntworte ausschließlich mit einem einzigen JSON-Objekt nach diesem JSON-Schema, ohne Text davor oder danach:\n${JSON.stringify(schema)}`,
    },
  ];
  for (const t of turns) {
    const role = t.role === 'system' ? 'user' : t.role;
    const content = t.role === 'system' ? `[Hinweis] ${t.content}` : t.content;
    const last = messages[messages.length - 1];
    if (messages.length > 1 && last.role === role) last.content += `\n\n${content}`;
    else messages.push({ role, content });
  }
  return messages;
}

/** Holt das JSON-Objekt aus der Antwort (ohne Nachdenk-Block und Codeblock-Zäune). */
export function extractJson(text: string): string {
  const withoutThinking = text.replace(/<think>[\s\S]*?<\/think>/g, '');
  const start = withoutThinking.indexOf('{');
  const end = withoutThinking.lastIndexOf('}');
  return start >= 0 && end > start ? withoutThinking.slice(start, end + 1) : withoutThinking.trim();
}

/** Ollama (/api/chat) mit erzwungenem JSON-Schema, ohne Nachdenken. */
export async function ollamaChat(
  baseUrl: string,
  model: string,
  messages: ChatMessage[],
  schema: object,
  headers: Record<string, string> = {},
  fetchFn: typeof fetch = fetch,
): Promise<string> {
  const res = await fetchFn(`${baseUrl.replace(/\/$/, '')}/api/chat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify({ model, messages, format: schema, stream: false, think: false, options: { temperature: 0.7 } }),
  });
  if (!res.ok) throw new Error(`Ollama: ${res.status}`);
  const data = (await res.json()) as { message?: { content?: string } };
  const text = data.message?.content;
  if (!text) throw new Error('Ollama: leere Antwort');
  return text;
}

interface WorkersAi {
  run(model: string, input: object): Promise<unknown>;
}

/** Qwen auf Workers AI. JSON-Modus gibt es für dieses Modell nicht, das Format steht in der Systemanweisung. */
export async function workersAiChat(ai: WorkersAi, messages: ChatMessage[]): Promise<string> {
  const out = (await ai.run(WORKERS_AI_MODEL, { messages, max_tokens: 4000, temperature: 0.7 })) as {
    response?: unknown;
    choices?: { message?: { content?: string } }[];
  };
  const text = typeof out.response === 'string' ? out.response : out.response ? JSON.stringify(out.response) : out.choices?.[0]?.message?.content;
  if (!text) throw new Error('Workers AI: leere Antwort');
  return text;
}
