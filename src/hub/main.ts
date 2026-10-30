import { loadHubConfig } from './config';
import { FleetSummary } from './fleet-summary';
import { Sequencer } from './sequencer';
import { UdpReceiver } from './udp-receiver';

const config = loadHubConfig();
const sequencer = new Sequencer();
const summary = new FleetSummary(config.summary);

const receiver = new UdpReceiver({
  onFrame: (frame) =>
    summary.recordFrame(frame, sequencer.check(frame.deviceId, frame.seq), Date.now()),
  onInvalid: (cause) => summary.recordInvalid(cause),
});

await receiver.start(config.udpPort, config.udpHost);
console.log(`Hub à l'écoute sur udp://${config.udpHost}:${config.udpPort}`);

setInterval(() => {
  const { reception: r, devices: d } = summary.snapshot(Date.now());
  console.log(
    `appareils=${d.total} (ok=${d.ok} chaud=${d.hot} silencieux=${d.silent} hors-ligne=${d.offline}) | ` +
      `${r.framesPerSecond.toFixed(0)} tr/s acceptées=${r.accepted} écartées=${r.discarded} ` +
      `perdues=${r.lost} (${(r.lossRate * 100).toFixed(1)} %) invalides=${r.invalid}`,
  );
}, config.snapshotIntervalMs);

process.on('SIGINT', () => { receiver.stop(); process.exit(0); });