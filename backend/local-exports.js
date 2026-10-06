// Local files only. No caller-supplied paths or shell commands.
const fs = require('node:fs/promises');
const path = require('node:path');
const { constants } = require('node:fs');
const { createHash, randomBytes } = require('node:crypto');
const { execFile } = require('node:child_process');
const { validateReport } = require('../schemas/validate.cjs');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function modelFolder(model) {
  const slug = model.normalize('NFKD').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^[.-]+|[.-]+$/g, '').slice(0, 90) || 'modele';
  return slug + '-' + createHash('sha256').update(model).digest('hex').slice(0, 12);
}
function localOrigin(req) {
  if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket?.remoteAddress)) return false;
  try {
    const host = new URL('http://' + req.headers.host).hostname;
    const origin = new URL(req.headers.origin);
    return ['localhost', '127.0.0.1', '[::1]'].includes(host) && ['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname) && ['http:', 'https:'].includes(origin.protocol);
  } catch { return false; }
}
function createExportStore({ parent = path.resolve(__dirname, '..'), launch = execFile, platform = process.platform } = {}) {
  const root = path.join(parent, 'export');
  async function directory(dir) {
    try { await fs.mkdir(dir, { mode: 0o700 }); } catch (e) { if (e.code !== 'EEXIST') throw e; }
    const stat = await fs.lstat(dir);
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('unsafe-export-directory');
    return dir;
  }
  async function ready() { await directory(root); return root; }
  async function save({ model, batchId, position, report, markdown }) {
    if (typeof model !== 'string' || !model.trim() || model.length > 256 || !UUID.test(batchId) || !Number.isInteger(position) || position < 1 || position > 100) throw new Error('invalid-export-identity');
    if (typeof markdown !== 'string' || Buffer.byteLength(markdown) > 24 * 1024 * 1024) throw new Error('invalid-markdown');
    const reports = report?.schema === 'llm-benchmarker.community.bundle' && report.schemaVersion === '1.0.0' ? report.reports : [report];
    if (!Array.isArray(reports) || !reports.length || reports.length > 100) throw new Error('invalid-reports');
    for (const r of reports) { validateReport(r); if (!r.tests.length || r.tests.some(t => t.model.id !== model)) throw new Error('export-model-mismatch'); }
    const json = JSON.stringify(report, null, 2);
    if (Buffer.byteLength(json) > 24 * 1024 * 1024) throw new Error('export-too-large');
    await ready();
    const folder = modelFolder(model), dir = await directory(path.join(root, folder));
    const at = reports[0].generatedAt.replace(/[^0-9TZ-]/g, '-');
    const name = 'LLMB-' + folder + '-' + at + '-' + batchId + '-' + position;
    // Idempotent retries; never overwrite existing or symlink files.
    async function write(ext, text) {
      const file = path.join(dir, name + ext);
      let handle;
      try { handle = await fs.open(file, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | (constants.O_NOFOLLOW || 0), 0o600); }
      catch (e) {
        if (e.code !== 'EEXIST') throw e;
        const stat = await fs.lstat(file);
        if (!stat.isFile() || stat.isSymbolicLink() || stat.size !== Buffer.byteLength(text)) throw new Error('export-conflict');
        const existing = await fs.open(file, constants.O_RDONLY | (constants.O_NOFOLLOW || 0));
        try { if (await existing.readFile('utf8') !== text) throw new Error('export-conflict'); } finally { await existing.close(); }
        return;
      }
      try { await handle.writeFile(text, 'utf8'); await handle.sync(); } catch (e) { await handle.close(); handle = null; await fs.unlink(file); throw e; }
      finally { if (handle) await handle.close(); }
    }
    await write('.json', json); await write('.md', markdown);
    return { folder: 'export/' + folder, files: [name + '.json', name + '.md'] };
  }
  async function open() {
    await ready();
    const command = platform === 'darwin' ? 'open' : platform === 'win32' ? 'explorer.exe' : 'xdg-open';
    await new Promise((resolve, reject) => launch(command, [root], { timeout: 10000, windowsHide: true }, err => err ? reject(new Error('folder-open-unavailable')) : resolve()));
    return { opened: true };
  }
  return { ready, save, open };
}
function mountExportRoutes(app, options) {
  const store = createExportStore(options), token = randomBytes(32).toString('hex');
  const guard = (req, res, next) => {
    if (!localOrigin(req)) return res.status(403).json({ error: 'local-origin-required' });
    if (req.method !== 'GET' && req.headers['x-llmb-export-token'] !== token) return res.status(403).json({ error: 'invalid-export-token' });
    next();
  };
  app.get('/api/exports/session', guard, async (_req, res) => {
    try { await store.ready(); res.set('Cache-Control', 'no-store').json({ token, folder: 'export/', version: '1.0.0' }); }
    catch { res.status(500).json({ error: 'export-directory-unavailable' }); }
  });
  // A separate parser keeps existing telemetry/tool request limits unchanged.
  const parser = require('express').json({ limit: '50mb' });
  app.post('/api/exports/save', guard, parser, async (req, res) => {
    try { res.json(await store.save(req.body)); } catch { res.status(400).json({ error: 'export-save-failed' }); }
  });
  app.post('/api/exports/open', guard, async (_req, res) => {
    try { res.json(await store.open()); } catch { res.status(503).json({ error: 'folder-open-unavailable', folder: 'export/' }); }
  });
}
module.exports = { createExportStore, mountExportRoutes, localOrigin, modelFolder };
