// Notbehelf ohne Server: Vorlesen mit der Stimme des Browsers (Qualität schwankt stark).

function pickVoice(): SpeechSynthesisVoice | undefined {
  const voices = speechSynthesis.getVoices().filter((v) => /^zh[-_](CN|Hans)/i.test(v.lang) || v.lang === 'cmn-Hans-CN');
  return voices.find((v) => /natural|online|xiaoxiao|google/i.test(v.name)) ?? voices[0];
}

export function speak(text: string, rate: number, _voice: string, onEnd?: () => void): void {
  if (!('speechSynthesis' in window)) {
    onEnd?.();
    return;
  }
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'zh-CN';
  u.rate = rate;
  const voice = pickVoice();
  if (voice) u.voice = voice;
  if (onEnd) {
    u.onend = onEnd;
    u.onerror = onEnd;
  }
  speechSynthesis.speak(u);
}

export function stopSpeaking(): void {
  if ('speechSynthesis' in window) speechSynthesis.cancel();
}
