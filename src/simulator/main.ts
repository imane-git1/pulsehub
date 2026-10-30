import dgram from 'node:dgram';
import { parseArgs } from 'node:util';
import { SimulatedDevice } from './device';
import { FaultInjector } from './faults';

const { values } = parseArgs({
  options: {
    devices: { type: 'string', short: 'n', default: '50' },
    rate: { type: 'string', short: 'f', default: '20' },
    host: { type: 'string', default: '127.0.0.1' },
    port: { type: 'string', short: 'p', default: '9000' },
    'bad-checksum': { type: 'string', default: '0' },
    duplicate: { type: 'string', default: '0' },
    reorder: { type: 'string', default: '0' },
    anomaly: { type: 'string', default: '0' },
    stop: { type: 'string', default: '0' },
    'stop-after': { type: 'string', default: '10' },
    faults: { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h', default: false },
  },
});

if (values.help) {
  console.log(`Usage : npm run sim -- [options]
  -n, --devices <N>       nombre d'appareils (défaut 50)
  -f, --rate <Hz>         trames/s par appareil (défaut 20)
      --host <h>          adresse du hub (défaut 127.0.0.1)
  -p, --port <p>          port du hub (défaut 9000)
      --bad-checksum <r>  probabilité de checksum faux, 0 à 1
      --duplicate <r>     probabilité de doublon
      --reorder <r>       probabilité de trame désordonnée
      --anomaly <r>       probabilité de température anormale
      --stop <k>          k appareils s'arrêtent (ids 1 à k)
      --stop-after <s>    délai avant l'arrêt, en secondes (défaut 10)
      --faults            preset de démonstration (tous les défauts)`);
  process.exit(0);
}

function num(name: string, raw: string, min: number, max = Infinity): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < min || n > max) {
    console.error(`Option --${name} invalide : "${raw}" (attendu entre ${min} et ${max})`);
    process.exit(1);
  }
  return n;
}

const devicesCount = num('devices', values.devices!, 1, 65535);
const rate = num('rate', values.rate!, 0.1, 1000);
const port = num('port', values.port!, 1, 65535);
const demo = values.faults;
const stop = Math.min(devicesCount, num('stop', values.stop!, 0) || (demo ? 2 : 0));
const stopAfterMs = num('stop-after', values['stop-after']!, 0) * 1000;

const injector = new FaultInjector({
  badChecksumRate: demo ? 0.03 : num('bad-checksum', values['bad-checksum']!, 0, 1),
  duplicateRate: demo ? 0.03 : num('duplicate', values.duplicate!, 0, 1),
  reorderRate: demo ? 0.03 : num('reorder', values.reorder!, 0, 1),
  anomalyRate: demo ? 0.001 : num('anomaly', values.anomaly!, 0, 1),
});

const startedAt = Date.now();
const devices = Array.from({ length: devicesCount }, (_, i) => new SimulatedDevice(i + 1, startedAt));
const socket = dgram.createSocket('udp4');
socket.on('error', (err) => console.error('[sim] erreur socket :', err.message));

let sent = 0;
const timer = setInterval(() => {
  const now = Date.now();
  for (const device of devices) {
    if (device.deviceId <= stop && now - startedAt >= stopAfterMs) continue; // appareil arrêté
    for (const datagram of injector.process(device.nextFrame(now))) {
      socket.send(datagram, port, values.host);
      sent++;
    }
  }
}, 1000 / rate);

setInterval(() => console.log(`[sim] ${sent} datagrammes envoyés`), 5000);
console.log(`Simulateur : ${devicesCount} appareils à ${rate} Hz vers ${values.host}:${port}`);

process.on('SIGINT', () => { clearInterval(timer); socket.close(); process.exit(0); });