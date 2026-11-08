import { createServer } from 'node:net';
import { Aedes } from 'aedes';
const broker = await Aedes.createBroker();
const port = Number(process.env.MQTT_PORT ?? 1883);
const server = createServer(broker.handle);
server.on('error', (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
server.listen(port, '127.0.0.1', () =>
  console.log(`Local MQTT broker listening on 127.0.0.1:${port}`),
);
let closing = false;
async function close() {
  if (closing) return;
  closing = true;
  await broker.close();
  server.close();
  process.disconnect?.();
}
process.once('SIGINT', close);
process.once('SIGTERM', close);
process.on('message', (message) => {
  if (message === 'shutdown') void close();
});
