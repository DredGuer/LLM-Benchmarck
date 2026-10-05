const { execFile } = require('node:child_process');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { randomUUID, createHash } = require('node:crypto');

function run(file, args, input) {
  return new Promise((resolve, reject) => {
    const child = execFile(file, args, { encoding: 'utf8', env: { ...process.env, LC_ALL: 'C', LANG: 'C' }, timeout: 2500, maxBuffer: 4 * 1024 * 1024 },
      (error, stdout) => error ? reject(error) : resolve(stdout));
    if (input !== undefined) { child.stdin.on('error', () => {}); child.stdin.end(input); }
  });
}
function nonnegative(value) { return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null; }
function parseSwapUsage(text) {
  const match = text.match(/\bused\s*=\s*(\d+(?:[.,]\d+)?)\s*([KMGT](?:i?B)?|B)(?=\s|$|[,;)])/i);
  if (!match) return null;
  const exponent = match[2].toUpperCase() === 'B' ? 0 : 'KMGT'.indexOf(match[2][0].toUpperCase()) + 1;
  return nonnegative(Number(match[1].replace(',', '.')) * 1024 ** exponent);
}

function parseVM(text) {
  const size = text.match(/page size of (\d+) bytes/);
  const pageSize = size ? Number(size[1]) : null;
  function pages(label) {
    const match = text.match(new RegExp('^' + label + ':\\s*(\\d+)\\.', 'm'));
    return match && pageSize ? nonnegative(Number(match[1]) * pageSize) : null;
  }
  return { compressedBytes: pages('Pages occupied by compressor'), swapReadBytes: pages('Swapins'), swapWriteBytes: pages('Swapouts') };
}
function parseDisks(entries) {
  const result = [], seen = new Set(), identities = [];
  function visit(entry) {
    if (!entry || typeof entry !== 'object') return;
    const stats = entry.Statistics;
    const identity = entry.IORegistryEntryID;
    if (stats && !seen.has(identity ?? entry)) {
      seen.add(identity ?? entry);
      const read = nonnegative(stats['Bytes (Read)']), write = nonnegative(stats['Bytes (Write)']);
      if (read !== null && write !== null) { identities.push(identity === undefined ? null : String(identity)); result.push({ id: 'io-disk-' + result.length, readBytes: read, writeBytes: write }); }
    }
    (entry.IORegistryEntryChildren || []).forEach(visit);
  }
  (Array.isArray(entries) ? entries : []).forEach(visit);
  return {
    diskReadBytes: result.length ? result.reduce((sum, d) => sum + d.readBytes, 0) : null,
    diskWriteBytes: result.length ? result.reduce((sum, d) => sum + d.writeBytes, 0) : null,
    diskCount: result.length,
    deviceSet: identities.length && identities.every(x => x !== null) ? createHash('sha256').update(identities.sort().join(',')).digest('hex') : null
  };
}
async function collectAppleResources(execute = run) {
  const [swap, vm, disk] = await Promise.all([
    execute('/usr/sbin/sysctl', ['-n', 'vm.swapusage']).catch(() => ''),
    execute('/usr/bin/vm_stat', []).catch(() => ''),
    execute('/usr/sbin/ioreg', ['-r', '-c', 'IOBlockStorageDriver', '-a'])
      .then(xml => execute('/usr/bin/plutil', ['-convert', 'json', '-o', '-', '-'], xml))
      .then(JSON.parse).catch(() => [])
  ]);
  return { observedAt: new Date().toISOString(), swapUsedBytes: parseSwapUsage(swap),
    swapStatus: parseSwapUsage(swap) !== null ? 'available' : swap ? 'unrecognized-format' : 'command-unavailable', ...parseVM(vm), ...parseDisks(disk) };
}
function parseMLXEvents(text, since) {
  const units = { B: 1, KiB: 1024, MiB: 1024 ** 2, GiB: 1024 ** 3, TiB: 1024 ** 4, KB: 1000, MB: 1e6, GB: 1e9 };
  return text.split('\n').flatMap(line => {
    const time = line.match(/^time=([^\s]+)/), peak = line.match(/\bmsg=(?:"memory"|memory)\s+peak="([\d.]+)\s+([A-Za-z]+)"/);
    const timestamp = time ? Date.parse(time[1]) : NaN;
    if (!/\blevel=INFO\b/.test(line) || !/\bsource=(?:\S*\/)?pipeline\.go:\d+\s/.test(line) || !peak || !Number.isFinite(timestamp) || timestamp < since || !units[peak[2]]) return [];
    const value = nonnegative(Number(peak[1]) * units[peak[2]]);
    return value === null ? [] : [{ value, observedAt: new Date(timestamp).toISOString() }];
  });
}
const logPath = path.join(os.homedir(), '.ollama', 'logs', 'server.log');
async function logState() {
  const stat = await fs.stat(logPath);
  return { size: stat.size, identity: String(stat.ino) };
}
async function logChunk(offset, length) {
  const file = await fs.open(logPath, 'r');
  try { const buffer = Buffer.alloc(length); const { bytesRead } = await file.read(buffer, 0, length, offset); return buffer.subarray(0, bytesRead).toString('utf8'); }
  finally { await file.close(); }
}
function createTelemetry({ collect = collectAppleResources, state = logState, chunk = logChunk, now = Date.now } = {}) {
  const sessions = new Map();
  function purge() { for (const [id, s] of sessions) if (now() - s.startedAt > 30 * 60 * 1000) sessions.delete(id); }
  async function start() {
    purge();
    if (sessions.size >= 16) throw new Error('Too many telemetry sessions');
    const id = randomUUID(), startedAt = now();
    const cursor = await state().catch(() => null);
    const baseline = await collect();
    if (sessions.size >= 16) throw new Error('Too many telemetry sessions');
    sessions.set(id, { startedAt, cursor, partial: '', baseline, samples: [baseline], events: [], pending: null, logIssue: cursor ? null : 'unavailable' });
    return { id, baseline, mlxLogStatus: cursor ? 'available' : 'unavailable' };
  }
  async function sample(id, finish = false) {
    purge(); const s = sessions.get(id);
    if (!s) return null;
    if (s.pending) await s.pending;
    if (sessions.get(id) !== s) return null;
    s.pending = (async () => {
      const current = await collect();
      if (s.samples.length < 1800) s.samples.push(current);
      if (s.cursor && !s.logIssue) {
        try {
          const stat = await state();
          if (stat.identity !== s.cursor.identity || stat.size < s.cursor.size) { s.logIssue = 'rotated'; }
          else if (stat.size - s.cursor.size > 1024 * 1024) { s.logIssue = 'overflow'; }
          else if (stat.size > s.cursor.size) {
            const data = s.partial + await chunk(s.cursor.size, stat.size - s.cursor.size);
            const end = data.lastIndexOf('\n');
            s.partial = end < 0 ? data : data.slice(end + 1);
            if (s.partial.length > 65536) { s.logIssue = 'overflow'; s.partial = ''; }
            if (end >= 0) s.events.push(...parseMLXEvents(data.slice(0, end), s.startedAt));
            s.cursor.size = stat.size;
          }
        } catch { s.logIssue = 'unavailable'; }
      }
      function reading(value, source, scope = 'machine') {
        return { value, unit: 'bytes', status: value === null ? 'unavailable' : 'available', source, kind: 'measured',
          observedAt: current.observedAt, scope, nodeId: 'local' };
      }
      function peak(key) { const values = s.samples.map(x => x[key]).filter(x => x !== null); return values.length ? Math.max(...values) : null; }
      function delta(key) {
        const a = s.baseline[key], b = current[key];
        if (key.startsWith('disk') && (!current.deviceSet || current.deviceSet !== s.baseline.deviceSet)) return null;
        // Resets/hot-plug are unknown, never negative or substituted by zero.
        return a !== null && b !== null && b >= a ? b - a : null;
      }
      const mlx = s.events.length && !s.logIssue ? Math.max(...s.events.map(e => e.value)) : null;
      return {
        sample: Object.fromEntries(Object.entries(current).filter(([key]) => key !== 'deviceSet')), sampleCount: s.samples.length, startedAt: new Date(s.startedAt).toISOString(),
        swapStatus: current.swapStatus || 'unknown',
        scopeNote: 'Swap and disk I/O are system-wide, not attributed to the model. Disk I/O is observed activity, not SSD maximum speed.',
        swapPeak: reading(peak('swapUsedBytes'), 'sysctl:vm.swapusage'),
        compressedPeak: reading(peak('compressedBytes'), 'vm_stat:compressor-pages'),
        swapReadDelta: { ...reading(delta('swapReadBytes'), 'vm_stat:Swapins*page-size'), kind: 'estimated', method: 'page-equivalent bytes, not compressed disk transfer size' },
        swapWriteDelta: { ...reading(delta('swapWriteBytes'), 'vm_stat:Swapouts*page-size'), kind: 'estimated', method: 'page-equivalent bytes, not compressed disk transfer size' },
        diskReadDelta: reading(delta('diskReadBytes'), 'ioreg:IOBlockStorageDriver.Statistics'),
        diskWriteDelta: reading(delta('diskWriteBytes'), 'ioreg:IOBlockStorageDriver.Statistics'),
        mlxPeak: { ...reading(mlx, 'ollama-server-log:memory-peak', 'process-tree'),
          attribution: 'ollama-server-unverified-model', eventCount: s.events.length,
          logStatus: s.logIssue || (s.events.length ? 'observed' : 'no-event'),
          observedAt: s.events.length ? s.events[s.events.length - 1].observedAt : current.observedAt },
        samples: finish ? s.samples.map(item => ({
          observedAt: item.observedAt, swapUsedBytes: item.swapUsedBytes, compressedBytes: item.compressedBytes,
          swapReadBytes: item.swapReadBytes !== null && s.baseline.swapReadBytes !== null && item.swapReadBytes >= s.baseline.swapReadBytes ? item.swapReadBytes - s.baseline.swapReadBytes : null,
          swapWriteBytes: item.swapWriteBytes !== null && s.baseline.swapWriteBytes !== null && item.swapWriteBytes >= s.baseline.swapWriteBytes ? item.swapWriteBytes - s.baseline.swapWriteBytes : null,
          diskReadBytes: item.deviceSet && item.deviceSet === s.baseline.deviceSet && item.diskReadBytes >= s.baseline.diskReadBytes ? item.diskReadBytes - s.baseline.diskReadBytes : null,
          diskWriteBytes: item.deviceSet && item.deviceSet === s.baseline.deviceSet && item.diskWriteBytes >= s.baseline.diskWriteBytes ? item.diskWriteBytes - s.baseline.diskWriteBytes : null
        })) : [],
        sampleLimitReached: s.samples.length >= 1800
      };
    })();
    try { const result = await s.pending; if (finish) sessions.delete(id); return result; }
    finally { s.pending = null; }
  }
  function cancel(id) { return sessions.delete(id); }
  return { start, sample, cancel };
}
module.exports = { createTelemetry, collectAppleResources, parseSwapUsage, parseVM, parseDisks, parseMLXEvents };
