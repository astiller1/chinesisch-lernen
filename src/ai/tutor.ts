// Aufruf der Claude-API: über den eigenen Worker (Schlüssel auf dem Server) oder lokal mit eigenem Schlüssel.
import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import type { z } from 'zod';
import type { ModelId } from '../data/scenarios';

export interface Turn {
  role: 'user' | 'assistant' | 'system';
  /** Text, wie er an die API ging bzw. von ihr kam (bei der KI: das JSON) */
  content: string;
}

export interface Connection {
  /** true: Anfragen gehen an /api/anthropic des Workers, der den Schlüssel ergänzt */
  viaServer: boolean;
  apiKey: string;
  model: ModelId;
}

export class TutorError extends Error {}

function client(c: Connection): Anthropic {
  if (c.viaServer) {
    // Der Worker ersetzt den Platzhalter-Schlüssel durch den echten.
    return new Anthropic({ apiKey: 'server', baseURL: `${location.origin}${location.pathname.replace(/[^/]*$/, '')}api/anthropic`, dangerouslyAllowBrowser: true });
  }
  return new Anthropic({ apiKey: c.apiKey, dangerouslyAllowBrowser: true });
}

/** Schickt den Verlauf und liefert die Antwort im gegebenen Format sowie den Rohtext für den Verlauf. */
export async function ask<S extends z.ZodType>(
  c: Connection,
  system: string,
  turns: Turn[],
  schema: S,
): Promise<{ value: z.infer<S>; raw: string }> {
  try {
    const response = await client(c).beta.messages.parse({
      model: c.model,
      max_tokens: 8000,
      // Kurze Gesprächszüge: wenig Nachdenken, schnelle Antwort.
      output_config: { effort: 'low', format: betaZodOutputFormat(schema) },
      system,
      // Verlauf wird nur angehängt, so greift der Cache bei jedem weiteren Zug.
      cache_control: { type: 'ephemeral' },
      messages: turns.map((t) => ({ role: t.role, content: t.content })),
      // Lehnt ein Sicherheitsfilter fälschlich ab, übernimmt automatisch ein anderes Modell.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
    });
    if (response.stop_reason === 'refusal') throw new TutorError('Die KI hat diese Anfrage abgelehnt. Formuliere bitte anders.');
    if (response.stop_reason === 'max_tokens') throw new TutorError('Die Antwort wurde abgeschnitten. Bitte noch einmal versuchen.');
    const value = response.parsed_output;
    const raw = response.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('');
    if (value == null || !raw) throw new TutorError('Die Antwort der KI war unvollständig. Bitte noch einmal versuchen.');
    return { value, raw };
  } catch (e) {
    if (e instanceof TutorError) throw e;
    if (e instanceof Anthropic.AuthenticationError) {
      throw new TutorError(c.viaServer ? 'Der Claude-Schlüssel auf dem Server fehlt oder ist ungültig.' : 'API-Schlüssel ungültig. Bitte in den Einstellungen prüfen.');
    }
    if (e instanceof Anthropic.PermissionDeniedError) throw new TutorError('Kein Zugriff (Anmeldung, Guthaben oder Rechte prüfen).');
    if (e instanceof Anthropic.RateLimitError) throw new TutorError('Zu viele Anfragen. Kurz warten und noch einmal versuchen.');
    if (e instanceof Anthropic.BadRequestError) throw new TutorError(`Anfrage abgelehnt: ${e.message}`);
    if (e instanceof Anthropic.APIConnectionError) throw new TutorError('Keine Verbindung zur KI. Internet prüfen.');
    if (e instanceof Anthropic.APIError) throw new TutorError(`Fehler der KI (${e.status ?? '?'}). Bitte noch einmal versuchen.`);
    throw e;
  }
}
