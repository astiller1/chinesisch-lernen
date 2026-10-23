// Aufruf der KI: über den eigenen Worker (lokales Qwen, sonst Cloudflare) oder lokal direkt bei Ollama.
import { z } from 'zod';
import { apiUrl } from '../lib/server';
import { extractJson, ollamaChat, toMessages, type ChatRequest, type ChatResponse, type Engine, type Turn } from './llm';

export type { Turn } from './llm';

export interface Connection {
  /** true: Anfragen gehen an /api/chat des Workers */
  viaServer: boolean;
  /** ohne Worker: Ollama auf diesem Rechner */
  ollamaUrl: string;
  ollamaModel: string;
}

export class TutorError extends Error {}

/** Wer zuletzt geantwortet hat (für die Anzeige in den Einstellungen). */
export let lastEngine: Engine | null = null;

async function viaServer(request: ChatRequest): Promise<ChatResponse> {
  let res: Response;
  try {
    res = await fetch(apiUrl('chat'), { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(request) });
  } catch {
    throw new TutorError('Keine Verbindung zum Server. Internet prüfen.');
  }
  if (res.status === 403) throw new TutorError('Nicht angemeldet. Bitte die Seite neu laden.');
  if (res.status === 429) throw new TutorError('Das kostenlose Tageskontingent bei Cloudflare ist aufgebraucht. Morgen geht es weiter – oder den PC einschalten.');
  if (!res.ok) throw new TutorError(`Die KI ist gerade nicht erreichbar (${res.status}). Bitte noch einmal versuchen.`);
  return (await res.json()) as ChatResponse;
}

async function direct(c: Connection, request: ChatRequest): Promise<ChatResponse> {
  try {
    const text = await ollamaChat(c.ollamaUrl, c.ollamaModel, toMessages(request.system, request.turns, request.schema), request.schema);
    return { text, engine: 'lokal' };
  } catch {
    throw new TutorError(`Ollama unter ${c.ollamaUrl} antwortet nicht (Modell „${c.ollamaModel}“). Läuft Ollama?`);
  }
}

/** Schickt den Verlauf und liefert die Antwort im gegebenen Format sowie den Rohtext für den Verlauf. */
export async function ask<S extends z.ZodType>(
  c: Connection,
  system: string,
  turns: Turn[],
  schema: S,
): Promise<{ value: z.infer<S>; raw: string }> {
  const request: ChatRequest = { system, turns, schema: z.toJSONSchema(schema) };
  // Kleine Modelle halten das Format nicht immer ein: einmal neu versuchen.
  for (let attempt = 0; attempt < 2; attempt++) {
    const { text, engine } = c.viaServer ? await viaServer(request) : await direct(c, request);
    lastEngine = engine;
    try {
      const value = schema.parse(JSON.parse(extractJson(text)));
      return { value, raw: JSON.stringify(value) };
    } catch {
      // nächster Versuch
    }
  }
  throw new TutorError('Die Antwort der KI war unvollständig. Bitte noch einmal versuchen.');
}
