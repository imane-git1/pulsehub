import { loadHubConfig } from './config';
import { UdpReceiver } from './udp-receiver';

const config = loadHubConfig();
let received = 0;
const invalidByCause = new Map<string, number>();

const receiver = new UdpReceiver({
  onFrame: () => { received++; },
  onInvalid: (e) => invalidByCause.set(e, (invalidByCause.get(e) ?? 0) + 1),
});

await receiver.start(config.udpPort, config.udpHost);
console.log(`Hub à l'écoute sur udp://${config.udpHost}:${config.udpPort}`);

setInterval(() => {
  console.log(`valides=${received} invalides=${JSON.stringify(Object.fromEntries(invalidByCause))}`);
}, 1000);

process.on('SIGINT', () => { receiver.stop(); process.exit(0); });