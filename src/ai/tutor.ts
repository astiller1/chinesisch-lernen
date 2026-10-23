// Aufruf der Claude-API direkt aus dem Browser (persönliche App, Schlüssel bleibt im Browser).
import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { TutorReply } from './schema';
import { systemPrompt } from './prompt';
import type { LevelId, ModelId, ScenarioId } from '../data/scenarios';

export interface Turn {
  role: 'user' | 'assistant';
  /** Text, wie er an die API ging bzw. von ihr kam (bei der KI: das JSON) */
  content: string;
}

export interface TutorOptions {
  apiKey: string;
  model: ModelId;
  scenario: ScenarioId;
  level: LevelId;
}

export class TutorError extends Error {}

export async function askTutor(opts: TutorOptions, history: Turn[]): Promise<{ reply: TutorReply; raw: string }> {
  const client = new Anthropic({ apiKey: opts.apiKey, dangerouslyAllowBrowser: true });
  try {
    const response = await client.beta.messages.parse({
      model: opts.model,
      max_tokens: 8000,
      // Kurze Gesprächszüge: wenig Nachdenken, schnelle Antwort.
      output_config: { effort: 'low', format: betaZodOutputFormat(TutorReply) },
      system: systemPrompt(opts.scenario, opts.level),
      // Verlauf wird nur angehängt, so greift der Cache bei jedem weiteren Zug.
      cache_control: { type: 'ephemeral' },
      messages: history.map((t) => ({ role: t.role, content: t.content })),
      // Lehnt ein Sicherheitsfilter fälschlich ab, übernimmt automatisch ein anderes Modell.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
    });
    if (response.stop_reason === 'refusal') throw new TutorError('Die KI hat diese Anfrage abgelehnt. Formuliere bitte anders.');
    if (response.stop_reason === 'max_tokens') throw new TutorError('Die Antwort wurde abgeschnitten. Bitte noch einmal versuchen.');
    const reply = response.parsed_output;
    const raw = response.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('');
    if (!reply || !raw) throw new TutorError('Die Antwort der KI war unvollständig. Bitte noch einmal versuchen.');
    return { reply, raw };
  } catch (e) {
    if (e instanceof TutorError) throw e;
    if (e instanceof Anthropic.AuthenticationError) throw new TutorError('API-Schlüssel ungültig. Bitte in den Einstellungen prüfen.');
    if (e instanceof Anthropic.PermissionDeniedError) throw new TutorError('Kein Zugriff mit diesem API-Schlüssel (Guthaben oder Rechte prüfen).');
    if (e instanceof Anthropic.RateLimitError) throw new TutorError('Zu viele Anfragen. Kurz warten und noch einmal versuchen.');
    if (e instanceof Anthropic.BadRequestError) throw new TutorError(`Anfrage abgelehnt: ${e.message}`);
    if (e instanceof Anthropic.APIConnectionError) throw new TutorError('Keine Verbindung zur KI. Internet prüfen.');
    if (e instanceof Anthropic.APIError) throw new TutorError(`Fehler der KI (${e.status ?? '?'}). Bitte noch einmal versuchen.`);
    throw e;
  }
}
