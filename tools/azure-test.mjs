// Echter Test von Azure Speech für Chinesisch (ohne Mikrofon):
// Die Azure-Stimme spricht Sätze, die dann gegen einen Zielsatz geprüft werden – einmal richtig,
// einmal mit falschem Ton/Wort. So sieht man, ob die Ausspracheprüfung Töne bemerkt.
// Aufruf: AZURE_SPEECH_KEY=… AZURE_SPEECH_REGION=westeurope node tools/azure-test.mjs
const key = process.env.AZURE_SPEECH_KEY;
const region = process.env.AZURE_SPEECH_REGION;
if (!key || !region) throw new Error('AZURE_SPEECH_KEY und AZURE_SPEECH_REGION setzen');

async function synthesize(text, voice = 'zh-CN-XiaoxiaoNeural') {
  const ssml = `<speak version="1.0" xml:lang="zh-CN"><voice name="${voice}">${text}</voice></speak>`;
  const res = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': key,
      'Content-Type': 'application/ssml+xml',
      'X-Microsoft-OutputFormat': 'riff-16khz-16bit-mono-pcm',
      'User-Agent': 'chinesisch-lernen-test',
    },
    body: ssml,
  });
  if (!res.ok) throw new Error(`TTS ${res.status}: ${await res.text()}`);
  return Buffer.from(await res.arrayBuffer());
}

async function assess(wav, reference) {
  const pa = Buffer.from(
    JSON.stringify({ ReferenceText: reference, GradingSystem: 'HundredMark', Granularity: 'Phoneme', Dimension: 'Comprehensive', EnableMiscue: true }),
  ).toString('base64');
  const res = await fetch(
    `https://${region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=zh-CN&format=detailed`,
    {
      method: 'POST',
      headers: { 'Ocp-Apim-Subscription-Key': key, 'Content-Type': 'audio/wav; codecs=audio/pcm; samplerate=16000', 'Pronunciation-Assessment': pa },
      body: wav,
    },
  );
  if (!res.ok) throw new Error(`STT ${res.status}: ${await res.text()}`);
  return res.json();
}

const cases = [
  { spoken: '我想买一本书。', reference: '我想买一本书。', note: 'richtig' },
  { spoken: '我想卖一本书。', reference: '我想买一本书。', note: 'mài statt mǎi (nur Ton anders)' },
  { spoken: '我想喝茶。', reference: '我想喝咖啡。', note: 'anderes Wort' },
];

for (const c of cases) {
  const wav = await synthesize(c.spoken);
  const r = await assess(wav, c.reference);
  const best = r.NBest?.[0];
  console.log(`\n== ${c.note}: gesprochen ${c.spoken} / Ziel ${c.reference}`);
  console.log(`erkannt: ${best?.Display ?? r.DisplayText ?? '(nichts)'}`);
  const pa = best?.PronunciationAssessment ?? best;
  console.log(`Gesamt ${pa?.PronScore} · Genauigkeit ${pa?.AccuracyScore} · Flüssigkeit ${pa?.FluencyScore} · Vollständigkeit ${pa?.CompletenessScore}`);
  for (const w of best?.Words ?? []) {
    const p = w.PronunciationAssessment ?? w;
    const syl = (w.Syllables ?? []).map((s) => `${s.Syllable}:${s.PronunciationAssessment?.AccuracyScore ?? s.AccuracyScore}`).join(' ');
    const ph = (w.Phonemes ?? []).map((x) => `${x.Phoneme}:${x.PronunciationAssessment?.AccuracyScore ?? x.AccuracyScore}`).join(' ');
    console.log(`  ${w.Word}  ${p.AccuracyScore} ${p.ErrorType}  | Silben ${syl || '-'} | Laute ${ph || '-'}`);
  }
}
