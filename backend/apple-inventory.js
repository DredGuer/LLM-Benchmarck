const { execFile } = require('child_process');
const os = require('os');

function run(file, args, input) {
  return new Promise((resolve, reject) => {
    const child = execFile(file, args, { encoding: 'utf8', timeout: 5000, maxBuffer: 4 * 1024 * 1024 },
      (error, stdout) => error ? reject(error) : resolve(stdout.trim()));
    if (input !== undefined) { child.stdin.on('error', () => {}); child.stdin.end(input); }
  });
}
async function plist(args, execute) {
  const xml = await execute('/usr/sbin/diskutil', args);
  return JSON.parse(await execute('/usr/bin/plutil', ['-convert', 'json', '-o', '-', '-'], xml));
}
function finite(value) { const n = Number(value); return value !== null && value !== '' && Number.isFinite(n) && n >= 0 ? n : null; }
function count(value) { const n = finite(value); return Number.isInteger(n) ? n : null; }

async function collectAppleInventory(execute = run, system = os) {
  const observedAt = new Date().toISOString();
  const provenance = {}, issues = [];
  async function query(key) {
    try { return await execute('/usr/sbin/sysctl', ['-n', key]); }
    catch { return null; }
  }
  async function profile(type) {
    try { return JSON.parse(await execute('/usr/sbin/system_profiler', ['-json', '-detailLevel', 'mini', type])); }
    catch { issues.push({ component: type, status: 'unavailable' }); return {}; }
  }
  function reading(value, unit, scope, source, deviceId = null) {
    return { value, unit, status: value === null ? 'unavailable' : 'available', source,
      kind: 'declared', observedAt, scope, nodeId: 'local', deviceId };
  }
  const keys = ['machdep.cpu.brand_string', 'hw.physicalcpu', 'hw.logicalcpu', 'hw.memsize',
    'hw.cpufrequency', 'hw.cpufrequency_max', 'hw.perflevel0.physicalcpu', 'hw.perflevel1.physicalcpu',
    'hw.perflevel0.name', 'hw.perflevel1.name'];
  const [hardware, displays, values, productVersion] = await Promise.all([
    profile('SPHardwareDataType'), profile('SPDisplaysDataType'),
    Promise.all(keys.map(query)), execute('/usr/bin/sw_vers', ['-productVersion']).catch(() => null)
  ]);
  const sys = Object.fromEntries(keys.map((k, i) => [k, values[i]]));
  const hw = (hardware.SPHardwareDataType || [])[0] || {};
  const cpuModel = hw.chip_type || sys['machdep.cpu.brand_string'] || hw.cpu_type || system.cpus()[0]?.model || null;
  const appleSilicon = /^Apple M/i.test(cpuModel || '');
  provenance.cpuModel = hw.chip_type ? 'system_profiler:SPHardwareDataType.chip_type' :
    sys['machdep.cpu.brand_string'] ? 'sysctl:machdep.cpu.brand_string' : 'system_profiler/Node.js fallback';
  provenance.physicalCores = 'sysctl:hw.physicalcpu';
  provenance.logicalCores = 'sysctl:hw.logicalcpu';
  let performanceCores = null, efficiencyCores = null;
  for (let i = 0; i < 2; i++) {
    const name = sys['hw.perflevel' + i + '.name'] || '';
    if (/performance/i.test(name)) performanceCores = count(sys['hw.perflevel' + i + '.physicalcpu']);
    if (/efficiency/i.test(name)) efficiencyCores = count(sys['hw.perflevel' + i + '.physicalcpu']);
  }
  provenance.coreClasses = 'sysctl:hw.perflevel*.name + physicalcpu (only named classes)';
  const frequency = finite(sys['hw.cpufrequency_max']) || finite(sys['hw.cpufrequency']) || null;
  const frequencySource = finite(sys['hw.cpufrequency_max']) ? 'sysctl:hw.cpufrequency_max' : 'sysctl:hw.cpufrequency';
  const capacity = finite(sys['hw.memsize']) ?? system.totalmem();
  provenance.memory = finite(sys['hw.memsize']) !== null ? 'sysctl:hw.memsize' : 'Node.js:os.totalmem';
  const gpus = (displays.SPDisplaysDataType || []).map((gpu, i) => ({
    id: 'gpu-' + i, vendor: appleSilicon ? 'Apple' : null,
    model: gpu.sppci_model || gpu._name || null,
    kind: appleSilicon ? 'unified' : 'unknown',
    memoryArchitecture: appleSilicon ? 'unified' : 'unknown',
    capacity: reading(null, 'bytes', 'gpu', 'system_profiler:SPDisplaysDataType', 'gpu-' + i),
    sharedMemoryPoolId: appleSilicon ? 'system-memory' : null,
    computeBackend: appleSilicon ? 'metal' : null,
    computeUnits: count(gpu.spdisplays_cores)
  }));
  provenance.gpus = 'system_profiler:SPDisplaysDataType';
  const storage = [];
  try {
    const list = await plist(['list', '-plist', 'physical'], execute);
    const devices = (list.AllDisksAndPartitions || []).map(d => d.DeviceIdentifier).filter(d => /^disk[0-9]+$/.test(d));
    const infos = await Promise.all(devices.map(async id => {
      try { return await plist(['info', '-plist', id], execute); }
      catch { issues.push({ component: 'storage', status: 'unavailable' }); return null; }
    }));
    infos.filter(Boolean).forEach((disk, i) => {
      const protocol = String(disk.BusProtocol || '').toLowerCase();
      const transport = protocol.includes('pci') || protocol.includes('nvme') ? 'nvme' :
        protocol.includes('sata') ? 'sata' : protocol.includes('usb') ? 'usb' :
        protocol.includes('thunderbolt') ? 'thunderbolt' : 'unknown';
      storage.push({
        id: 'disk-' + i, model: disk.MediaName || null,
        kind: disk.SolidState === true ? 'ssd' : disk.SolidState === false ? 'hdd' : 'unknown',
        transport, capacity: reading(finite(disk.TotalSize), 'bytes', 'storage', 'diskutil:info', 'disk-' + i),
        roles: []
      });
    });
  } catch { issues.push({ component: 'storage', status: 'unavailable' }); }
  provenance.storage = 'diskutil:list physical + info; physical capacity, not APFS volume capacity';
  return {
    version: '1.0.0', observedAt, issues, provenance,
    cpuFrequencyNote: 'Reported maximum/nominal frequency when available; not a live frequency measurement.',
    storageSpeed: reading(null, 'bytes/s', 'storage', 'not-benchmarked'),
    machine: {
      id: 'local', platform: appleSilicon ? 'apple-silicon' : /Intel/i.test(cpuModel || '') ? 'apple-intel' : 'other',
      os: { name: 'macOS', version: productVersion, kernel: system.release(), architecture: system.arch() },
      inventorySource: 'apple-inventory-v1',
      cpus: [{ id: 'cpu-0', vendor: appleSilicon ? 'Apple' : null, model: cpuModel,
        physicalCores: count(sys['hw.physicalcpu']), logicalCores: count(sys['hw.logicalcpu']),
        performanceCores, efficiencyCores, frequency: reading(frequency, 'hertz', 'cpu', frequencySource, 'cpu-0') }],
      memory: { architecture: appleSilicon ? 'unified' : 'separate',
        physicalCapacity: reading(capacity, 'bytes', 'machine', provenance.memory) },
      gpus, storage
    }
  };
}

let cached = null, pending = null;
async function getAppleInventory() {
  if (cached && Date.now() - cached.time < 60000) return cached.value;
  if (!pending) pending = collectAppleInventory().then(value => {
    cached = { time: Date.now(), value }; return value;
  }).finally(() => { pending = null; });
  return pending;
}
module.exports = { collectAppleInventory, getAppleInventory };
