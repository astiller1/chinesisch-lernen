// Was der eigene Server (Cloudflare Worker) bereitstellt. Lokal ohne Worker: nichts.

export interface ServerStatus {
  /** Claude-Schlüssel liegt auf dem Server */
  claude: boolean;
  /** Azure Speech ist eingerichtet */
  speech: boolean;
}

export const server: ServerStatus = { claude: false, speech: false };

/** Relativ zur App, damit sie auch unter einem Unterpfad läuft. */
export function apiUrl(path: string): string {
  return new URL(`api/${path}`, document.baseURI).toString();
}

export async function loadServerStatus(): Promise<void> {
  try {
    const res = await fetch(apiUrl('config'), { credentials: 'same-origin' });
    if (!res.ok || !res.headers.get('content-type')?.includes('json')) return;
    Object.assign(server, (await res.json()) as ServerStatus);
  } catch {
    // kein Worker (z. B. npm run dev): lokaler Modus
  }
}
