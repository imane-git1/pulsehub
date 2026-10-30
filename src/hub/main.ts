import { loadHubConfig } from './config';
import { Sequencer } from './sequencer';
import { UdpReceiver } from './udp-receiver';

const config = loadHubConfig();
const sequencer = new Sequencer();

let accepted = 0;
let discarded = 0;
let lost = 0;
const invalidByCause = new Map<string, number>();

const receiver = new UdpReceiver({
  onFrame: (frame) => {
    const verdict = sequencer.check(frame.deviceId, frame.seq);
    if (verdict.accepted) accepted++;
    else discarded++;
    lost += verdict.lost;
  },
  onInvalid: (e) => invalidByCause.set(e, (invalidByCause.get(e) ?? 0) + 1),
});

await receiver.start(config.udpPort, config.udpHost);
console.log(`Hub à l'écoute sur udp://${config.udpHost}:${config.udpPort}`);

setInterval(() => {
  console.log(
    `acceptées=${accepted} écartées=${discarded} perdues=${lost} ` +
      `invalides=${JSON.stringify(Object.fromEntries(invalidByCause))}`,
  );
}, 1000);

process.on('SIGINT', () => { receiver.stop(); process.exit(0); });