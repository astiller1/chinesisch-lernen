// Spracherkennung (Web Speech API, Chrome/Edge/Safari). Erkennt Hochchinesisch als Schriftzeichen.

interface RecognitionResult {
  isFinal: boolean;
  0: { transcript: string };
}
interface RecognitionEvent {
  resultIndex: number;
  results: ArrayLike<RecognitionResult>;
}
interface Recognition {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: RecognitionEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}
type RecognitionCtor = new () => Recognition;

function ctor(): RecognitionCtor | undefined {
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

export function canRecognize(): boolean {
  return !!ctor();
}

export interface ListenHandlers {
  /** laufender Zwischenstand (gesamter bisher erkannter Text) */
  onText(text: string): void;
  /** Ende des Zuhörens mit Endergebnis */
  onDone(text: string): void;
  onError(message: string): void;
}

const ERRORS: Record<string, string> = {
  'not-allowed': 'Mikrofon nicht erlaubt. Bitte im Browser freigeben.',
  'service-not-allowed': 'Spracherkennung ist in diesem Browser gesperrt.',
  'no-speech': 'Nichts gehört. Noch einmal versuchen?',
  network: 'Spracherkennung braucht Internet.',
  'audio-capture': 'Kein Mikrofon gefunden.',
};

/** Startet das Zuhören; gibt eine Funktion zum Beenden zurück. */
export function listen(h: ListenHandlers): () => void {
  const Ctor = ctor();
  if (!Ctor) {
    h.onError('Dieser Browser kann keine Sprache erkennen. Bitte Chrome oder Edge verwenden.');
    return () => {};
  }
  const rec = new Ctor();
  rec.lang = 'zh-CN';
  rec.interimResults = true;
  rec.continuous = false;
  let finalText = '';
  let interim = '';
  rec.onresult = (e) => {
    interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      if (r.isFinal) finalText += r[0].transcript;
      else interim += r[0].transcript;
    }
    h.onText(finalText + interim);
  };
  rec.onerror = (e) => {
    if (e.error !== 'aborted') h.onError(ERRORS[e.error] ?? `Spracherkennung: ${e.error}`);
  };
  rec.onend = () => h.onDone((finalText + interim).trim());
  rec.start();
  return () => rec.stop();
}
