// Vorlesen mit der chinesischen Stimme des Browsers bzw. Handys.

export function chineseVoices(): SpeechSynthesisVoice[] {
  if (!('speechSynthesis' in window)) return [];
  return speechSynthesis
    .getVoices()
    .filter((v) => /^zh[-_](CN|Hans)/i.test(v.lang) || v.lang === 'zh' || v.lang === 'cmn-Hans-CN');
}

function pickVoice(name: string): SpeechSynthesisVoice | undefined {
  const voices = chineseVoices();
  return (
    voices.find((v) => v.name === name) ??
    // Natürlich klingende Stimmen bevorzugen
    voices.find((v) => /natural|online|xiaoxiao|google/i.test(v.name)) ??
    voices[0]
  );
}

export function canSpeak(): boolean {
  return 'speechSynthesis' in window;
}

export function speak(text: string, rate: number, voiceName: string, onEnd?: () => void): void {
  if (!canSpeak()) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'zh-CN';
  u.rate = rate;
  const voice = pickVoice(voiceName);
  if (voice) u.voice = voice;
  if (onEnd) {
    u.onend = onEnd;
    u.onerror = onEnd;
  }
  speechSynthesis.speak(u);
}

export function stopSpeaking(): void {
  if (canSpeak()) speechSynthesis.cancel();
}
