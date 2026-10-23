// Azure Speech: Sprachausgabe über den Worker (MP3), Erkennung und Ausspracheprüfung mit dem Speech SDK.
// Das SDK ist groß und wird erst beim ersten Zuhören geladen.
import type { Assessment } from '../lib/assessment';
import { apiUrl } from '../lib/server';
import type { ListenHandlers } from './stt';

// ---------- Sprachausgabe ----------

let ctx: AudioContext | null = null;
let current: AudioBufferSourceNode | null = null;
const audioCache = new Map<string, AudioBuffer>();

/** Muss bei der ersten Berührung aufgerufen werden, sonst blockieren iPhone/Android den Ton. */
export function unlockAudio(): void {
  ctx ??= new AudioContext();
  if (ctx.state === 'suspended') void ctx.resume();
}

export function stopAudio(): void {
  try {
    current?.stop();
  } catch {
    // schon zu Ende
  }
  current = null;
}

export async function speakAzure(text: string, voice: string, rate: number): Promise<void> {
  unlockAudio();
  const key = `${voice}|${rate}|${text}`;
  let buffer = audioCache.get(key);
  if (!buffer) {
    const res = await fetch(apiUrl('speech/tts'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text, voice, rate }),
    });
    if (!res.ok) throw new Error(`Sprachausgabe fehlgeschlagen (${res.status})`);
    buffer = await ctx!.decodeAudioData(await res.arrayBuffer());
    // Wiederholungen kosten so nichts extra.
    if (audioCache.size > 200) audioCache.delete(audioCache.keys().next().value!);
    audioCache.set(key, buffer);
  }
  stopAudio();
  const src = ctx!.createBufferSource();
  src.buffer = buffer;
  src.connect(ctx!.destination);
  current = src;
  await new Promise<void>((resolve) => {
    src.onended = () => resolve();
    src.start();
  });
}

// ---------- Erkennung ----------

let token: { token: string; region: string; at: number } | null = null;

async function speechToken(): Promise<{ token: string; region: string }> {
  // Azure-Tokens gelten 10 Minuten.
  if (token && Date.now() - token.at < 8 * 60_000) return token;
  const res = await fetch(apiUrl('speech/token'));
  if (!res.ok) throw new Error(`Spracherkennung nicht verfügbar (${res.status})`);
  const t = (await res.json()) as { token: string; region: string };
  token = { ...t, at: Date.now() };
  return token;
}

type Sdk = typeof import('microsoft-cognitiveservices-speech-sdk');
let sdkPromise: Promise<Sdk> | null = null;
const loadSdk = () => (sdkPromise ??= import('microsoft-cognitiveservices-speech-sdk'));

async function recognizer(sdk: Sdk) {
  const t = await speechToken();
  const cfg = sdk.SpeechConfig.fromAuthorizationToken(t.token, t.region);
  cfg.speechRecognitionLanguage = 'zh-CN';
  // Lernende machen Pausen mitten im Satz: erst nach 1,5 s Stille ist ein Abschnitt zu Ende.
  cfg.setProperty(sdk.PropertyId.Speech_SegmentationSilenceTimeoutMs, '1500');
  cfg.setProperty(sdk.PropertyId.SpeechServiceConnection_InitialSilenceTimeoutMs, '8000');
  return new sdk.SpeechRecognizer(cfg, sdk.AudioConfig.fromDefaultMicrophoneInput());
}

function errorText(details: string): string {
  if (/permission|notallowed/i.test(details)) return 'Mikrofon nicht erlaubt. Bitte im Browser freigeben.';
  return `Spracherkennung: ${details}`;
}

/** Freies Sprechen: hört zu, bis du 2,5 s schweigst oder Stopp drückst. */
export function listenAzure(h: ListenHandlers): () => void {
  let stopRequested = false;
  let stopFn: () => void = () => {
    stopRequested = true;
  };
  void (async () => {
    let finalText = '';
    let done = false;
    try {
      const sdk = await loadSdk();
      const rec = await recognizer(sdk);
      let silence = 0;
      const finish = () => {
        if (done) return;
        done = true;
        clearTimeout(silence);
        rec.stopContinuousRecognitionAsync(
          () => {
            rec.close();
            h.onDone(finalText.trim());
          },
          () => {
            rec.close();
            h.onDone(finalText.trim());
          },
        );
      };
      const armSilence = () => {
        clearTimeout(silence);
        silence = window.setTimeout(finish, 2500);
      };
      rec.recognizing = (_, e) => {
        clearTimeout(silence);
        h.onText(finalText + e.result.text);
      };
      rec.recognized = (_, e) => {
        if (e.result.reason === sdk.ResultReason.RecognizedSpeech && e.result.text) {
          finalText += e.result.text;
          h.onText(finalText);
          armSilence();
        }
      };
      rec.canceled = (_, e) => {
        if (e.reason === sdk.CancellationReason.Error) h.onError(errorText(e.errorDetails));
        finish();
      };
      stopFn = finish;
      rec.startContinuousRecognitionAsync(
        () => {
          // Wer nichts sagt, wird nach 8 s beendet.
          silence = window.setTimeout(finish, 8000);
          if (stopRequested) finish();
        },
        (err) => {
          h.onError(errorText(String(err)));
          done = true;
          rec.close();
          h.onDone('');
        },
      );
    } catch (e) {
      h.onError(e instanceof Error ? e.message : String(e));
      if (!done) h.onDone('');
    }
  })();
  return () => stopFn();
}

/** Nachsprechen: ein Satz, mit Ausspracheprüfung gegen den Zielsatz. */
export function assessAzure(reference: string, onDone: (a: Assessment | null) => void, onError: (m: string) => void): () => void {
  let close: () => void = () => {};
  void (async () => {
    try {
      const sdk = await loadSdk();
      const rec = await recognizer(sdk);
      close = () => rec.stopContinuousRecognitionAsync();
      const pa = new sdk.PronunciationAssessmentConfig(
        reference,
        sdk.PronunciationAssessmentGradingSystem.HundredMark,
        sdk.PronunciationAssessmentGranularity.Phoneme,
        true,
      );
      pa.applyTo(rec);
      rec.recognizeOnceAsync(
        (result) => {
          rec.close();
          if (result.reason !== sdk.ResultReason.RecognizedSpeech) {
            onDone(null);
            return;
          }
          const r = sdk.PronunciationAssessmentResult.fromResult(result);
          onDone({
            pronunciation: r.pronunciationScore,
            accuracy: r.accuracyScore,
            fluency: r.fluencyScore,
            completeness: r.completenessScore,
            recognized: result.text,
            words: (r.detailResult?.Words ?? []).map((w) => ({
              word: w.Word,
              accuracy: w.PronunciationAssessment?.AccuracyScore ?? 0,
              errorType: w.PronunciationAssessment?.ErrorType ?? 'None',
            })),
          });
        },
        (err) => {
          rec.close();
          onError(errorText(String(err)));
          onDone(null);
        },
      );
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
      onDone(null);
    }
  })();
  return () => close();
}
