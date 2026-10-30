import dgram from 'node:dgram';
import { decodeFrame, DecodeError } from '../protocol/decode';
import { Frame } from '../protocol/types';

export interface ReceiverEvents {
  onFrame(frame: Frame): void;
  onInvalid(error: DecodeError): void;
}

export class UdpReceiver {
  private readonly socket = dgram.createSocket('udp4');

  constructor(private readonly events: ReceiverEvents) {}

  start(port: number, host: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket.once('error', reject);
      this.socket.on('message', (msg) => this.handle(msg));
      this.socket.bind(port, host, () => {
        this.socket.off('error', reject);
        this.socket.on('error', (err) => console.error('[udp] erreur socket :', err.message));
        resolve();
      });
    });
  }

  stop(): void {
    this.socket.close();
  }

  private handle(msg: Buffer): void {
    try {
      const result = decodeFrame(msg);
      if (result.ok) this.events.onFrame(result.frame);
      else this.events.onInvalid(result.error);
    } catch (err) {
      // Garde-fou : une erreur imprévue ne doit jamais tuer le hub
      console.error('[udp] erreur de traitement :', err);
    }
  }
}