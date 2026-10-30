import { DashboardServer } from '../web/dashboard-server';
import { loadHubConfig } from './config';
import { FleetSummary } from './fleet-summary';
import { Sequencer } from './sequencer';
import { UdpReceiver } from './udp-receiver';

const config = loadHubConfig();
const sequencer = new Sequencer(config.restartToleranceMs);
const summary = new FleetSummary(config.summary);

const receiver = new UdpReceiver({
  onFrame: (frame) =>
    summary.recordFrame(frame, sequencer.check(frame.deviceId, frame.seq, frame.uptimeMs), Date.now()),
  onInvalid: (cause) => summary.recordInvalid(cause),
});
const dashboard = new DashboardServer(() => summary.snapshot(Date.now()));

await receiver.start(config.udpPort, config.udpHost);
await dashboard.start(config.httpPort, config.httpHost);
console.log(`Hub à l'écoute sur udp://${config.udpHost}:${config.udpPort}`);
console.log(`Tableau de bord : http://${config.httpHost}:${config.httpPort}`);

setInterval(() => dashboard.publish(), config.snapshotIntervalMs);

process.on('SIGINT', () => {
  receiver.stop();
  dashboard.stop();
  process.exit(0);
});