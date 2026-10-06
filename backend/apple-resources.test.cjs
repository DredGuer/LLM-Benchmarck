const assert = require('node:assert/strict');
const { parseSwapUsage, parseVM, parseDisks, parseMLXEvents, collectAppleResources, createTelemetry } = require('./apple-resources');
const GiB = 1024 ** 3;
assert.equal(parseSwapUsage('total = 8192.00M used = 1536.50M free = 6655.50M'), 1536.5 * 1024 ** 2);
assert.equal(parseSwapUsage('unavailable'), null);
assert.equal(parseSwapUsage('total = 8G used = 1,5 GiB free = 6,5G'), 1.5 * GiB);
assert.equal(parseSwapUsage('used = 0.00M'), 0);
assert.equal(parseSwapUsage('used = 1024 B'), 1024);
assert.equal(parseSwapUsage('used = nonsense'), null);
const vm = parseVM('Mach Virtual Memory Statistics: (page size of 16384 bytes)\nPages occupied by compressor: 12.\nSwapins: 3.\nSwapouts: 5.');
assert.deepEqual(vm, { compressedBytes: 196608, swapReadBytes: 49152, swapWriteBytes: 81920 });
assert.equal(parseVM('unavailable').swapReadBytes, null);
assert.equal(parseVM('page size of 4096 bytes\nSwapouts: 0.').swapWriteBytes, 0);
const disks = parseDisks([{ IORegistryEntryID: 1, Statistics: { 'Bytes (Read)': 100, 'Bytes (Write)': 200 } },
  { IORegistryEntryID: 1, Statistics: { 'Bytes (Read)': 100, 'Bytes (Write)': 200 } },
  { IORegistryEntryID: 2, Statistics: { 'Bytes (Read)': 300, 'Bytes (Write)': 400 } }]);
assert.equal(disks.diskReadBytes, 400); assert.equal(disks.diskWriteBytes, 600); assert.equal(disks.diskCount, 2);
assert.equal(typeof disks.deviceSet, 'string');
assert.equal(parseDisks([]).diskReadBytes, null);
const started = Date.parse('2026-10-05T17:00:00Z');
const line = 'time=2026-10-05T19:00:01+02:00 level=INFO source=pipeline.go:101 msg=memory peak="21.21 GiB" held="20.83 GiB"\n';
assert.equal(parseMLXEvents(line, started)[0].value, 21.21 * GiB);
assert.equal(parseMLXEvents(line, started + 2000).length, 0);
assert.equal(parseMLXEvents(line, started, started).length, 0); // Future events cannot be used.
assert.equal(parseMLXEvents('msg=memory peak="10 GiB"', started).length, 0);
assert.equal(parseMLXEvents(line.replace('GiB', 'garbage'), started).length, 0);
(async () => {
  const missing = await collectAppleResources(async () => { throw Error('unavailable'); });
  assert.equal(missing.swapUsedBytes, null); assert.equal(missing.diskReadBytes, null);
  let logs = 'old private prompt\n' + line, inode = '1', reads = 100, time = started;
  const telemetry = createTelemetry({
    now: () => time,
    state: async () => ({ size: Buffer.byteLength(logs), identity: inode }),
    chunk: async (offset, length) => Buffer.from(logs).subarray(offset, offset + length).toString(),
    collect: async () => ({ observedAt: new Date(time).toISOString(), swapUsedBytes: reads,
      compressedBytes: reads, swapReadBytes: reads, swapWriteBytes: reads,
      diskReadBytes: reads, diskWriteBytes: reads, diskCount: 1, deviceSet: 'same-devices' })
  });
  const session = await telemetry.start();
  let summary = await telemetry.sample(session.id);
  assert.equal(summary.mlxPeak.value, null); // Do not import the pre-existing peak.
  reads = 300; time += 2000; logs += line.slice(0, 80);
  summary = await telemetry.sample(session.id); assert.equal(summary.mlxPeak.value, null);
  logs += line.slice(80); summary = await telemetry.sample(session.id);
  assert.equal(summary.mlxPeak.value, 21.21 * GiB);
  assert.equal(summary.mlxPeak.attribution, 'ollama-server-unverified-model');
  assert.equal(summary.mlxPeak.observedAt, '2026-10-05T17:00:01.000Z');
  assert.equal(summary.mlxPeak.freshness, 'recent-in-session');
  time += 7000; const second = line.replace('19:00:01','19:00:08').replace('21.21','19.01'); logs += second;
  summary = await telemetry.sample(session.id);
  assert.equal(summary.mlxPeak.observedAt, '2026-10-05T17:00:01.000Z'); // Timestamp of the maximum, not the last event.
  assert.equal(summary.mlxHeldEnd.observedAt, '2026-10-05T17:00:08.000Z');
  assert.equal(summary.mlxPeak.freshness, 'historical-in-session');
  const concurrent = await telemetry.start(); summary = await telemetry.sample(session.id);
  assert.equal(summary.mlxPeak.overlappingTelemetry, true); telemetry.cancel(concurrent.id);
  assert.equal(summary.diskReadDelta.value, 200);
  assert(!JSON.stringify(summary).includes('private prompt'));
  reads = 50; summary = await telemetry.sample(session.id); assert.equal(summary.diskReadDelta.value, null);
  inode = '2'; summary = await telemetry.sample(session.id);
  assert.equal(summary.mlxPeak.value, null); assert.equal(summary.mlxPeak.logStatus, 'rotated');
  await telemetry.sample(session.id, true); assert.equal(await telemetry.sample(session.id), null);
  const expired = await telemetry.start(); time += 31 * 60 * 1000;
  assert.equal(await telemetry.sample(expired.id), null);
  const noLog = createTelemetry({ collect: async () => missing, state: async () => { throw Error('denied'); } });
  const absent = await noLog.start();
  assert.equal((await noLog.sample(absent.id, true)).mlxPeak.value, null);
  console.log('PASS: Apple swap/pages, disk counters, MLX units/time/cursor, partial lines, missing sources, resets, rotation, expiry and privacy');
})().catch(error => { console.error(error); process.exitCode = 1; });
