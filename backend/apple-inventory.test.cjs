const assert = require('assert');
const { collectAppleInventory } = require('./apple-inventory');
const { validateReport } = require('../schemas/validate.cjs');
const fs = require('fs');
const values = { 'hw.physicalcpu': '12', 'hw.logicalcpu': '12', 'hw.memsize': String(36 * 1024 ** 3),
  'machdep.cpu.brand_string': 'Apple M3 Pro', 'hw.perflevel0.name': 'Performance', 'hw.perflevel1.name': 'Efficiency',
  'hw.perflevel0.physicalcpu': '6', 'hw.perflevel1.physicalcpu': '6' };
const system = { cpus: () => [{ model: 'fallback' }], totalmem: () => 36 * 1024 ** 3, release: () => 'example', arch: () => 'arm64' };
async function execute(file, args, input) {
  if (file.endsWith('sysctl')) { if (values[args[1]]) return values[args[1]]; throw Error('unavailable'); }
  if (file.endsWith('sw_vers')) return '26.0';
  if (file.endsWith('system_profiler')) {
    if (args.includes('SPHardwareDataType')) return JSON.stringify({ SPHardwareDataType: [{ chip_type: 'Apple M3 Pro', serial_number: 'PRIVATE', platform_UUID: 'PRIVATE' }] });
    return JSON.stringify({ SPDisplaysDataType: [{ sppci_model: 'Apple M3 Pro', sppci_cores: '18', spdisplays_ndrvs: [{ '_spdisplays_display-serial-number': 'PRIVATE' }] }] });
  }
  if (file.endsWith('diskutil')) {
    if (args[0] === 'list') return JSON.stringify({ AllDisksAndPartitions: [{ DeviceIdentifier: 'disk0' }, { DeviceIdentifier: 'disk2' }] });
    return JSON.stringify({ MediaName: args[2] === 'disk0' ? 'APPLE SSD' : 'External SSD', SolidState: true,
      BusProtocol: args[2] === 'disk0' ? 'Apple Fabric' : 'USB', TotalSize: 1000000000000, SerialNumber: 'PRIVATE', VolumeName: 'PRIVATE' });
  }
  if (file.endsWith('plutil')) return input;
  throw Error('unexpected command');
}
(async () => {
  const result = await collectAppleInventory(execute, system), n = result.machine;
  assert.equal(n.cpus[0].model, 'Apple M3 Pro'); assert.equal(n.cpus[0].physicalCores, 12);
  assert.equal(n.cpus[0].performanceCores, 6); assert.equal(n.cpus[0].efficiencyCores, 6);
  assert.equal(n.cpus[0].frequency.value, null); assert.equal(n.memory.architecture, 'unified');
  assert.equal(n.memory.physicalCapacity.value, 36 * 1024 ** 3);
  assert.equal(n.gpus[0].computeUnits, 18); assert.equal(n.gpus[0].capacity.value, null);
  assert.equal(n.storage.length, 2); assert.equal(n.storage[0].transport, 'apple-fabric'); assert.equal(n.storage[1].transport, 'usb');
  assert.equal(result.storageSpeed.value, null); assert(!JSON.stringify(result).includes('PRIVATE'));
  const fixture = JSON.parse(fs.readFileSync(require('path').join(__dirname, '../schemas/examples/apple-generation.json')));
  fixture.machines = [n]; fixture.tests[0].participatingNodeIds = ['local'];
  fixture.execution.observedPlacements = []; validateReport(fixture);
  const legacy = await collectAppleInventory(async (file, args, input) => {
    const output = await execute(file, args, input);
    return file.endsWith('system_profiler') ? output.replace('sppci_cores', 'spdisplays_cores') :
      file.endsWith('diskutil') ? output.replace('Apple Fabric', 'PCI-Express') : output;
  }, system);
  assert.equal(legacy.machine.gpus[0].computeUnits, 18);
  assert.equal(legacy.machine.storage[0].transport, 'nvme');
  const missing = await collectAppleInventory(async (file, args, input) => {
    const output = await execute(file, args, input);
    return file.endsWith('system_profiler') ? output.replace('"sppci_cores":"18",', '') : output;
  }, system);
  assert.equal(missing.machine.gpus[0].computeUnits, null);
  const unavailable = await collectAppleInventory(async () => { throw Error('permission denied'); }, system);
  assert.equal(unavailable.machine.cpus[0].physicalCores, null); assert.equal(unavailable.machine.storage.length, 0);
  assert.equal(unavailable.machine.memory.physicalCapacity.source, 'Node.js:os.totalmem');
  console.log('PASS: Apple CPU/classes/unified RAM/GPU/two SSDs, schema compatibility, unknown frequency, private fields excluded, command failures');
})().catch(error => { console.error(error); process.exitCode = 1; });
