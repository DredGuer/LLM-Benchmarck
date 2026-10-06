// Dependency-free validator for the exact JSON Schema keyword subset used here.
// A production importer should additionally use a full Draft 2020-12 validator.
const fs = require('fs');
const path = require('path');
const schema = JSON.parse(fs.readFileSync(path.join(__dirname, 'community-v2.schema.json'), 'utf8'));
function validateShape(value, rule, location = '$') {
  if (rule.$ref) return validateShape(value, schema.$defs[rule.$ref.split('/').pop()], location);
  const fail = message => { throw new Error(location + ': ' + message); };
  if (rule.type) {
    const types = [].concat(rule.type);
    const ok = types.some(t => t === 'null' ? value === null : t === 'array' ? Array.isArray(value) :
      t === 'object' ? value !== null && typeof value === 'object' && !Array.isArray(value) :
      t === 'integer' ? Number.isInteger(value) : t === 'number' ? typeof value === 'number' && Number.isFinite(value) : typeof value === t);
    if (!ok) fail('wrong type');
  }
  if ('const' in rule && value !== rule.const) fail('wrong constant');
  if (rule.enum && !rule.enum.includes(value)) fail('invalid enum');
  if (typeof value === 'number') {
    if (rule.minimum !== undefined && value < rule.minimum) fail('below minimum');
    if (rule.maximum !== undefined && value > rule.maximum) fail('above maximum');
  }
  if (typeof value === 'string') {
    if (rule.minLength && value.length < rule.minLength) fail('too short');
    if (rule.pattern && !new RegExp(rule.pattern).test(value)) fail('pattern mismatch');
    if (rule.format === 'date-time' && (!/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value) || !Number.isFinite(Date.parse(value)))) fail('invalid timestamp');
  }
  if (Array.isArray(value)) {
    if (rule.minItems && value.length < rule.minItems) fail('too few items');
    if (rule.uniqueItems && new Set(value.map(v => JSON.stringify(v))).size !== value.length) fail('duplicate items');
    if (rule.items) value.forEach((v, i) => validateShape(v, rule.items, location + '[' + i + ']'));
  }
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    for (const k of rule.required || []) if (!(k in value)) fail('missing ' + k);
    for (const [k, v] of Object.entries(value)) {
      if (rule.properties && rule.properties[k]) validateShape(v, rule.properties[k], location + '.' + k);
      else if (rule.additionalProperties === false) fail('unexpected field ' + k);
    }
  }
  const accepts = r => { try { validateShape(value, r, location); return true; } catch { return false; } };
  if (rule.oneOf && rule.oneOf.filter(accepts).length !== 1) fail('oneOf mismatch');
  if (rule.not && accepts(rule.not)) fail('forbidden combination');
}
function validateReport(report) {
  validateShape(report, schema);
  function checkReadings(value) {
    if (!value || typeof value !== 'object') return;
    if ('scope' in value && 'observedAt' in value && 'unit' in value && 'status' in value) {
      if (value.value !== null && value.unit !== 'celsius' && value.value < 0) throw new Error('Negative measurement');
      if (value.unit === 'percent' && value.value > 100) throw new Error('Invalid percent');
      if (value.nodeId && !report.machines.some(n => n.id === value.nodeId)) throw new Error('Unknown measurement node');
    }
    for (const v of Object.values(value)) checkReadings(v);
  }
  checkReadings(report);
  const unique = (items, label) => {
    const ids = new Set();
    for (const item of items) { if (ids.has(item.id)) throw new Error('Duplicate ' + label); ids.add(item.id); }
    return ids;
  };
  unique(report.machines, 'machine'); unique(report.tests, 'test');
  const nodes = new Map(report.machines.map(n => [n.id, n]));
  for (const n of nodes.values()) { unique(n.cpus, 'CPU'); unique(n.gpus, 'GPU'); unique(n.storage, 'storage'); }
  const node = id => { if (!nodes.has(id)) throw new Error('Unknown node ' + id); return nodes.get(id); };
  for (const p of [...report.execution.requestedPlacements, ...report.execution.observedPlacements]) {
    const n = node(p.nodeId);
    for (const [field, devices] of [['gpuIds', n.gpus], ['cpuIds', n.cpus], ['storageIds', n.storage]]) {
      const ids = new Set(devices.map(d => d.id));
      for (const id of p[field] || []) if (!ids.has(id)) throw new Error('Unknown device ' + id);
    }
    if (p.layerStart != null && p.layerEnd != null && p.layerEnd < p.layerStart) throw new Error('Invalid layer range');
  }
  unique(report.execution.links, 'link');
  for (const l of report.execution.links) { node(l.fromNodeId); node(l.toNodeId); }
  for (const t of report.tests) {
    for (const id of t.participatingNodeIds) node(id);
    if (report.execution.mode === 'single-machine' && t.participatingNodeIds.length !== 1) throw new Error('Single-machine test has multiple nodes');
    if (t.finishedAt && Date.parse(t.finishedAt) < Date.parse(t.startedAt)) throw new Error('Reversed test dates');
    for (const r of [...t.resourceSamples, ...t.resourceSummaries]) {
      const n = node(r.nodeId);
      if (!t.participatingNodeIds.includes(n.id)) throw new Error('Resource outside test topology');
      if (r.deviceId && ![...n.cpus, ...n.gpus, ...n.storage].some(d => d.id === r.deviceId)) throw new Error('Unknown resource device');
    }
    if ((t.provenance || t.verdict || t.quality || t.protocol.campaignId) && report.schemaVersion !== '2.2.0') throw new Error('Provenance requires 2.2.0');
    if (t.quality) {
      unique(t.quality.criteria, 'quality criterion');
      if (['pass','fail'].includes(t.quality.status)) {
        if (!t.quality.criteria.length || !t.quality.evaluatorId || !t.quality.evaluatorVersion || !t.quality.taskId) throw new Error('Missing quality evaluator');
        if ((t.quality.status === 'pass') !== t.quality.criteria.every(c => c.passed)) throw new Error('Quality disagrees with criteria');
      }
      if (t.quality.status === 'not-assessed' && (t.quality.criteria.length || t.quality.evaluatorId || t.quality.evaluatorVersion || t.quality.taskId)) throw new Error('Invalid unassessed quality');
      if (t.quality.status === 'incomplete' && (!t.quality.evaluatorId || !t.quality.evaluatorVersion || !t.quality.taskId || t.quality.criteria.length)) throw new Error('Invalid incomplete quality');
      if (t.verdict && t.verdict.quality !== t.quality.status) throw new Error('Quality verdict mismatch');
    }
    if (t.agentic && t.verdict && (t.verdict.conformity !== t.agentic.evaluation.taskSuccess || t.verdict.goalCompleted !== (t.agentic.evaluation.goalCompleted ?? null))) throw new Error('Agentic verdict mismatch');
    if (t.protocol.campaignId) {
      if (!t.protocol.contextValidation || !t.protocol.requestedContextTokens || !t.protocol.contextOrder) throw new Error('Incomplete controlled protocol');
      if (t.protocol.contextValidation === 'verified' && t.parameters.contextTokens !== t.protocol.requestedContextTokens) throw new Error('Verified context mismatch');
      if (t.protocol.contextValidation === 'mismatch' && (t.parameters.contextTokens === null || t.parameters.contextTokens === t.protocol.requestedContextTokens)) throw new Error('Invalid context mismatch');
      if (t.protocol.contextValidation === 'unverified' && t.parameters.contextTokens !== null) throw new Error('Invalid unverified context');
    }
    if (!t.agentic) continue;
    const a = t.agentic;
    if (a.scenario) {
      if (!['2.1.0','2.2.0'].includes(report.schemaVersion)) throw new Error('Agentic scenario metadata requires 2.1.0 or 2.2.0');
      if (!Array.isArray(a.evaluation.criteria) || !a.evaluation.criteria.length || typeof a.evaluation.goalCompleted !== 'boolean') throw new Error('Scenario requires criteria and functional outcome');
      unique(a.evaluation.criteria, 'criterion');
      if (a.evaluation.taskSuccess !== a.evaluation.criteria.every(c => c.passed !== false)) throw new Error('Task conformity disagrees with criteria');
    }
    const tools = unique(a.tools, 'tool'), artifacts = unique(a.artifacts, 'artifact');
    unique(a.steps, 'step');
    const seen = new Set(); let order = 0;
    for (const step of a.steps) {
      if (step.order <= order) throw new Error('Unordered steps'); order = step.order;
      for (const id of step.dependsOn) if (!seen.has(id)) throw new Error('Forward/cyclic step dependency');
      if (step.toolId && !tools.has(step.toolId)) throw new Error('Unknown tool');
      for (const id of step.artifactIds) if (!artifacts.has(id)) throw new Error('Unknown artifact');
      seen.add(step.id);
    }
    if (a.steps.length > a.budget.maxSteps) throw new Error('Step budget exceeded');
    if (a.steps.reduce((sum, s) => sum + s.toolCallCount, 0) !== a.evaluation.toolCallCount) throw new Error('Tool count mismatch');
    if (a.evaluation.toolCallCount > a.budget.maxToolCalls) throw new Error('Tool budget exceeded');
  }
  return true;
}
module.exports = { validateReport };
if (require.main === module) {
  for (const file of process.argv.slice(2)) { validateReport(JSON.parse(fs.readFileSync(file, 'utf8'))); console.log('VALID ' + file); }
}
