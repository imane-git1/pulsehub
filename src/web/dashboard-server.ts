import { readFile } from 'node:fs/promises';
import { createServer, Server, ServerResponse } from 'node:http';
import { fileURLToPath } from 'node:url';
import type { FleetSnapshot } from '../hub/fleet-summary';

const INDEX_PATH = fileURLToPath(new URL('./public/index.html', import.meta.url));

export class DashboardServer {
  private readonly clients = new Set<ServerResponse>();
  private readonly server: Server;
  private page = '';

  /** getSnapshot est injecté : le serveur ignore tout de la synthèse et de l'UDP. */
  constructor(private readonly getSnapshot: () => FleetSnapshot) {
    this.server = createServer((req, res) => {
      const path = (req.url ?? '/').split('?')[0];
      if (req.method !== 'GET') {
        res.writeHead(405).end();
      } else if (path === '/') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(this.page);
      } else if (path === '/events') {
        this.openStream(res);
      } else if (path === '/api/snapshot') {
        res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(this.getSnapshot()));
      } else {
        res.writeHead(404).end('Not found');
      }
    });
  }

  async start(port: number, host: string): Promise<void> {
    this.page = await readFile(INDEX_PATH, 'utf8');
    await new Promise<void>((resolve, reject) => {
      this.server.once('error', reject);
      this.server.listen(port, host, () => {
        this.server.off('error', reject);
        resolve();
      });
    });
  }

  /** Envoie l'état courant à tous les navigateurs connectés. */
  publish(): void {
    if (this.clients.size === 0) return; // personne ne regarde : on ne calcule rien
    const message = this.format(this.getSnapshot());
    for (const client of this.clients) client.write(message);
  }

  stop(): void {
    for (const client of this.clients) client.end();
    this.server.close();
  }

  private openStream(res: ServerResponse): void {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    res.write(this.format(this.getSnapshot())); // affichage immédiat, sans attendre le prochain tick
    this.clients.add(res);
    res.on('close', () => this.clients.delete(res));
  }

  private format(snapshot: FleetSnapshot): string {
    return `data: ${JSON.stringify(snapshot)}\n\n`; // format SSE : "data: ...", puis ligne vide
  }
}