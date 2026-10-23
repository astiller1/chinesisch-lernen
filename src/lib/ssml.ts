// SSML für die Azure-Sprachausgabe (rein; wird vom Worker benutzt).

export const VOICES = [
  { id: 'zh-CN-XiaoxiaoNeural', name: 'Xiǎoxiǎo – warm, freundlich (weiblich)' },
  { id: 'zh-CN-XiaochenNeural', name: 'Xiǎochén – locker, Plauderton (weiblich)' },
  { id: 'zh-CN-XiaoyiNeural', name: 'Xiǎoyì – lebhaft (weiblich)' },
  { id: 'zh-CN-YunxiNeural', name: 'Yúnxī – jung, natürlich (männlich)' },
  { id: 'zh-CN-YunyangNeural', name: 'Yúnyáng – Nachrichtensprecher (männlich)' },
] as const;

export const MAX_TTS_CHARS = 600;

function escapeXml(text: string): string {
  return text.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]!);
}

/** rate 1 = normal, 0.8 = 20 % langsamer; nur bekannte Stimmen. */
export function buildSsml(text: string, voice: string, rate: number): string {
  const v = VOICES.some((x) => x.id === voice) ? voice : VOICES[0].id;
  const r = Math.round((Math.min(1.5, Math.max(0.4, rate)) - 1) * 100);
  const t = escapeXml(text.slice(0, MAX_TTS_CHARS));
  return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="zh-CN"><voice name="${v}"><prosody rate="${r >= 0 ? '+' : ''}${r}%">${t}</prosody></voice></speak>`;
}
