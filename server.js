import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, 'public');
const port = Number(process.env.PORT || 3000);
const adminUsername = process.env.ADMIN_USERNAME;
const adminPassword = process.env.ADMIN_PASSWORD;
const tursoUrl = process.env.TURSO_DATABASE_URL;
const tursoAuthToken = process.env.TURSO_AUTH_TOKEN;
const recaptchaSecretKey = process.env.RECAPTCHA_SECRET_KEY || '6LeAbe0sAAAAAMGHEOVzN_vZOhkN5AgkcZhd77HU';
const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
};

function normalizeSqlValue(value) {
  if (value === null || value === undefined) return { type: 'null' };
  if (Number.isInteger(value)) return { type: 'integer', value: String(value) };
  if (typeof value === 'number') return { type: 'float', value };
  if (Buffer.isBuffer(value)) return { type: 'blob', base64: value.toString('base64') };
  return { type: 'text', value: String(value) };
}

function denormalizeSqlValue(value) {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'object') return value;
  if (value.type === 'null') return null;
  if (value.type === 'integer') return Number(value.value);
  if (value.type === 'float') return Number(value.value);
  if (value.type === 'blob') return value.base64 || value.value || '';
  return value.value ?? null;
}

function createRows(result) {
  const columns = result.cols || [];
  return (result.rows || []).map((rowValues) =>
    Object.fromEntries(
      rowValues.map((cell, index) => [columns[index]?.name || String(index), denormalizeSqlValue(cell)])
    )
  );
}

function splitSqlStatements(sql) {
  return sql.split(';').map((s) => s.trim()).filter(Boolean);
}

function getLocalDbPath() {
  if (process.env.SQLITE_PATH) return process.env.SQLITE_PATH;
  const writableRuntime = process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.LAMBDA_TASK_ROOT || __dirname.startsWith('/var/task') || process.cwd().startsWith('/var/task');
  return writableRuntime ? path.join(os.tmpdir(), 'reviactyl.db') : path.join(__dirname, 'reviactyl.db');
}

async function createLocalDatabase() {
  const { DatabaseSync } = await import('node:sqlite');
  let localPath = getLocalDbPath();
  let database;
  try {
    fs.mkdirSync(path.dirname(localPath), { recursive: true });
    database = new DatabaseSync(localPath);
  } catch (error) {
    if (process.env.SQLITE_PATH) throw error;
    localPath = path.join(os.tmpdir(), 'reviactyl.db');
    fs.mkdirSync(path.dirname(localPath), { recursive: true });
    database = new DatabaseSync(localPath);
  }
  return {
    mode: 'local-sqlite', label: localPath,
    async execute(sql, args = []) {
      const statement = database.prepare(sql);
      const isRead = /^\s*(SELECT|WITH|PRAGMA)\b/i.test(sql);
      if (isRead) return { rows: statement.all(...args), lastInsertRowid: null, rowsAffected: 0 };
      const result = statement.run(...args);
      return { rows: [], lastInsertRowid: result.lastInsertRowid, rowsAffected: result.changes };
    },
    async exec(sql) { database.exec(sql); },
  };
}

function createTursoDatabase() {
  const pipelineUrl = `${tursoUrl.replace(/^libsql:\/\//, 'https://').replace(/\/$/, '')}/v2/pipeline`;
  async function execute(sql, args = []) {
    const response = await fetch(pipelineUrl, { method: 'POST', headers: { Authorization: `Bearer ${tursoAuthToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ requests: [{ type: 'execute', stmt: { sql, args: args.map(normalizeSqlValue) } }, { type: 'close' }] }) });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.message || payload.error || `Turso request failed ${response.status}`);
    const firstResult = payload.results?.[0];
    if (!firstResult || firstResult.type !== 'ok') throw new Error(firstResult?.error?.message || firstResult?.error || 'Turso query failed.');
    const result = firstResult.response?.result || {};
    return { rows: createRows(result), lastInsertRowid: result.last_insert_rowid ?? null, rowsAffected: result.affected_row_count ?? 0 };
  }
  return { mode: 'turso-http', label: tursoUrl, execute, async exec(sql) { for (const statement of splitSqlStatements(sql)) await execute(statement); } };
}

async function createDatabase() { return tursoAuthToken ? createTursoDatabase() : createLocalDatabase(); }
const db = await createDatabase();

async function initDb() {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, avatar_url TEXT DEFAULT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS snippets (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, title TEXT NOT NULL, description TEXT NOT NULL, language TEXT NOT NULL, code TEXT NOT NULL, views INTEGER DEFAULT 0, copies INTEGER DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (user_id) REFERENCES users(id));
    CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, role TEXT NOT NULL, user_id INTEGER, username TEXT NOT NULL, created_at INTEGER DEFAULT (strftime('%s', 'now')));
    CREATE TABLE IF NOT EXISTS comments (id INTEGER PRIMARY KEY AUTOINCREMENT, snippet_id INTEGER NOT NULL, user_id INTEGER, username TEXT NOT NULL, avatar_url TEXT DEFAULT NULL, content TEXT NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (snippet_id) REFERENCES snippets(id) ON DELETE CASCADE);
    CREATE TABLE IF NOT EXISTS announcements (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, content TEXT NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
  `);
  try { await db.exec(`ALTER TABLE users ADD COLUMN avatar_url TEXT DEFAULT NULL;`); } catch (e) {}
}

function sendJson(res, statusCode, payload) { res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(payload)); }
function parseCookies(req) { return Object.fromEntries((req.headers.cookie || '').split(';').filter(Boolean).map((cookie) => { const [key, ...value] = cookie.trim().split('='); return [key, decodeURIComponent(value.join('='))]; })); }
function setSessionCookie(res, token) { res.setHeader('Set-Cookie', `reviactyl_session=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=31536000`); }
function clearSessionCookie(res) { res.setHeader('Set-Cookie', 'reviactyl_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0'); }

async function createSession(payload) { const token = crypto.randomBytes(32).toString('hex'); await run('INSERT INTO sessions (token, role, user_id, username) VALUES (?, ?, ?, ?)', [token, payload.role, payload.userId || null, payload.username]); return token; }
async function getSession(req) { const token = parseCookies(req).reviactyl_session; if (!token) return null; const session = await row('SELECT * FROM sessions WHERE token = ?', [token]); if (!session) return null; return { token: session.token, role: session.role, userId: session.user_id, username: session.username }; }

function hashPassword(password) { const salt = crypto.randomBytes(16).toString('hex'); const hash = crypto.scryptSync(password, salt, 64).toString('hex'); return `${salt}:${hash}`; }
function verifyPassword(password, storedHash) { const [salt, hash] = String(storedHash || '').split(':'); if (!salt || !hash) return false; return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), crypto.scryptSync(password, salt, 64)); }
function validateText(value, field, max = 120) { const text = String(value || '').trim(); if (!text) return `${field} wajib diisi.`; if (text.length > max) return `${field} maksimal ${max} karakter.`; return null; }

async function readJson(req) { const chunks = []; for await (const chunk of req) chunks.push(chunk); if (!chunks.length) return {}; return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
async function rows(sql, args = []) { return (await db.execute(sql, args)).rows; }
async function row(sql, args = []) { return (await db.execute(sql, args)).rows[0]; }
async function run(sql, args = []) { return db.execute(sql, args); }

const cleanUrlMap = { '/login': '/login.html', '/upload': '/upload.html', '/profile': '/profile.html', '/dashboard': '/dashboard.html' };
function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  let requestedPath = url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname);
  if (cleanUrlMap[requestedPath]) requestedPath = cleanUrlMap[requestedPath];
  const filePath = path.normalize(path.join(publicDir, requestedPath));
  if (!filePath.startsWith(publicDir)) { res.writeHead(403); res.end('Forbidden'); return; }
  fs.readFile(filePath, (error, content) => {
    if (error) { res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' }); res.end('<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>404</title></head><body style="background:#050507;color:#ededf0;font-family:sans-serif;display:grid;place-items:center;min-height:100vh"><div style="text-align:center"><h1 style="font-size:4rem;margin:0">404</h1><p>Halaman tidak ditemukan.</p><a href="/" style="color:#06b6d4">← Kembali ke Home</a></div></body></html>'); return; }
    res.writeHead(200, { 'Content-Type': mimeTypes[path.extname(filePath)] || 'application/octet-stream' });
    res.end(content);
  });
}

// ── reCAPTCHA Verification Helper ──
async function verifyRecaptcha(token) {
  if (!recaptchaSecretKey) return true; // Lewati jika RECAPTCHA_SECRET_KEY tidak diset di env (untuk testing)
  if (!token) return false;
  try {
    const verifyUrl = `https://www.google.com/recaptcha/api/siteverify?secret=${recaptchaSecretKey}&response=${token}`;
    const response = await fetch(verifyUrl, { method: 'POST' });
    const data = await response.json();
    return data.success && data.score >= 0.5; // Skor 0.5 adalah batas aman manusia vs bot
  } catch (error) {
    console.error('reCAPTCHA verification error:', error);
    return false;
  }
}

async function handleApi(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;
  const session = await getSession(req);

  if (req.method === 'GET' && pathname === '/api/session') return sendJson(res, 200, session ? { loggedIn: true, role: session.role, username: session.username } : { loggedIn: false });
  
  // ── Register with reCAPTCHA ──
  if (req.method === 'POST' && pathname === '/api/register') { 
    const body = await readJson(req); 
    
    // Cek Bot
    if (!(await verifyRecaptcha(body.recaptchaToken))) {
      return sendJson(res, 403, { message: 'Verifikasi keamanan gagal. Anda terdeteksi sebagai bot.' });
    }

    const username = String(body.username || '').trim(); const usernameError = validateText(username, 'Username', 32); const passwordError = validateText(body.password, 'Password', 100); if (usernameError || passwordError) return sendJson(res, 400, { message: usernameError || passwordError }); if (!/^[a-zA-Z0-9_]{3,32}$/.test(username)) return sendJson(res, 400, { message: 'Username hanya boleh huruf, angka, underscore (3-32 karakter).' }); try { const result = await run('INSERT INTO users (username, password_hash) VALUES (?, ?)', [username, hashPassword(body.password)]); const token = await createSession({ role: 'user', userId: Number(result.lastInsertRowid), username }); setSessionCookie(res, token); return sendJson(res, 201, { message: 'Registrasi berhasil.', username }); } catch (error) { return sendJson(res, 409, { message: 'Username sudah digunakan.' }); } }

  // ── Login with reCAPTCHA ──
  if (req.method === 'POST' && pathname === '/api/login') { 
    const body = await readJson(req); 
    
    // Cek Bot
    if (!(await verifyRecaptcha(body.recaptchaToken))) {
      return sendJson(res, 403, { message: 'Verifikasi keamanan gagal. Anda terdeteksi sebagai bot.' });
    }

    const user = await row('SELECT * FROM users WHERE username = ?', [String(body.username || '').trim()]); if (!user || !verifyPassword(String(body.password || ''), user.password_hash)) return sendJson(res, 401, { message: 'Username atau password salah.' }); const token = await createSession({ role: 'user', userId: Number(user.id), username: user.username }); setSessionCookie(res, token); return sendJson(res, 200, { message: 'Login berhasil.', username: user.username }); }

  if (req.method === 'POST' && pathname === '/api/admin/login') { const body = await readJson(req); if (body.username !== adminUsername || body.password !== adminPassword) return sendJson(res, 401, { message: 'Username atau password admin salah.' }); const token = await createSession({ role: 'admin', username: adminUsername }); setSessionCookie(res, token); return sendJson(res, 200, { message: 'Login admin berhasil.', username: adminUsername }); }
  if (req.method === 'POST' && pathname === '/api/logout') { if (session) await run('DELETE FROM sessions WHERE token = ?', [session.token]); clearSessionCookie(res); return sendJson(res, 200, { message: 'Logout berhasil.' }); }

  if (req.method === 'GET' && pathname === '/api/snippets') {
    const snippets = await rows(`SELECT snippets.id, snippets.title, snippets.description, snippets.language, snippets.views, snippets.copies, snippets.created_at, users.username, users.avatar_url FROM snippets JOIN users ON users.id = snippets.user_id ORDER BY snippets.created_at DESC`);
    return sendJson(res, 200, snippets);
  }

  const detailMatch = pathname.match(/^\/api\/snippets\/(\d+)$/);
  if (req.method === 'GET' && detailMatch) { const id = Number(detailMatch[1]); await run('UPDATE snippets SET views = views + 1 WHERE id = ?', [id]); const snippet = await row(`SELECT snippets.*, users.username, users.avatar_url FROM snippets JOIN users ON users.id = snippets.user_id WHERE snippets.id = ?`, [id]); if (!snippet) return sendJson(res, 404, { message: 'Snippet tidak ditemukan.' }); return sendJson(res, 200, snippet); }

  const rawMatch = pathname.match(/^\/api\/raw\/(\d+)$/);
  if (req.method === 'GET' && rawMatch) { const id = Number(rawMatch[1]); const snippet = await row('SELECT code, title FROM snippets WHERE id = ?', [id]); if (!snippet) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('Snippet tidak ditemukan.'); return; } res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end(snippet.code); return; }

  if (req.method === 'POST' && pathname === '/api/snippets') { if (!session || session.role !== 'user') return sendJson(res, 401, { message: 'Silakan login user terlebih dahulu.' }); const body = await readJson(req); const titleError = validateText(body.title, 'Judul', 120); const descError = validateText(body.description, 'Deskripsi', 500); const langError = validateText(body.language, 'Bahasa pemrograman', 40); const code = String(body.code || '').trim(); if (titleError || descError || langError) return sendJson(res, 400, { message: titleError || descError || langError }); if (!code) return sendJson(res, 400, { message: 'Kode wajib diisi.' }); if (code.length > 50000) return sendJson(res, 400, { message: 'Kode maksimal 50.000 karakter.' }); const result = await run('INSERT INTO snippets (user_id, title, description, language, code) VALUES (?, ?, ?, ?, ?)', [session.userId, body.title.trim(), body.description.trim(), body.language.trim(), code]); return sendJson(res, 201, { message: 'Snippet berhasil diupload.', id: Number(result.lastInsertRowid) }); }

  const copyMatch = pathname.match(/^\/api\/snippets\/(\d+)\/copy$/);
  if (req.method === 'POST' && copyMatch) { const id = Number(copyMatch[1]); await run('UPDATE snippets SET copies = copies + 1 WHERE id = ?', [id]); const snippet = await row('SELECT copies FROM snippets WHERE id = ?', [id]); if (!snippet) return sendJson(res, 404, { message: 'Snippet tidak ditemukan.' }); return sendJson(res, 200, { copies: Number(snippet.copies) }); }

  // ── User Profile Endpoints ──
  if (req.method === 'GET' && pathname === '/api/user/profile') { if (!session || session.role !== 'user') return sendJson(res, 401, { message: 'Silakan login terlebih dahulu.' }); const user = await row('SELECT id, username, avatar_url, created_at FROM users WHERE id = ?', [session.userId]); if (!user) return sendJson(res, 404, { message: 'User tidak ditemukan.' }); const stats = await row('SELECT COUNT(*) as total_snippets, COALESCE(SUM(views),0) as total_views, COALESCE(SUM(copies),0) as total_copies FROM snippets WHERE user_id = ?', [session.userId]); return sendJson(res, 200, { ...user, stats }); }
  if (req.method === 'GET' && pathname === '/api/user/snippets') { if (!session || session.role !== 'user') return sendJson(res, 401, { message: 'Silakan login terlebih dahulu.' }); const snippets = await rows('SELECT id, title, description, language, views, copies, created_at FROM snippets WHERE user_id = ? ORDER BY created_at DESC', [session.userId]); return sendJson(res, 200, snippets); }
  const userSnippetDeleteMatch = pathname.match(/^\/api\/user\/snippets\/(\d+)$/);
  if (req.method === 'DELETE' && userSnippetDeleteMatch) { if (!session || session.role !== 'user') return sendJson(res, 401, { message: 'Silakan login terlebih dahulu.' }); const snippetId = Number(userSnippetDeleteMatch[1]); const snippet = await row('SELECT id FROM snippets WHERE id = ? AND user_id = ?', [snippetId, session.userId]); if (!snippet) return sendJson(res, 404, { message: 'Snippet tidak ditemukan atau bukan milik Anda.' }); await run('DELETE FROM snippets WHERE id = ?', [snippetId]); return sendJson(res, 200, { message: 'Snippet berhasil dihapus.' }); }
  if (req.method === 'POST' && pathname === '/api/user/update-username') { if (!session || session.role !== 'user') return sendJson(res, 401, { message: 'Silakan login.' }); const body = await readJson(req); const newUsername = String(body.username || '').trim(); if (!newUsername || newUsername.length < 3 || newUsername.length > 32) return sendJson(res, 400, { message: 'Username harus 3-32 karakter.' }); if (!/^[a-zA-Z0-9_]+$/.test(newUsername)) return sendJson(res, 400, { message: 'Username hanya boleh huruf, angka, underscore.' }); try { const existing = await row('SELECT id FROM users WHERE username = ? AND id != ?', [newUsername, session.userId]); if (existing) return sendJson(res, 409, { message: 'Username sudah dipakai.' }); await run('UPDATE users SET username = ? WHERE id = ?', [newUsername, session.userId]); await run('UPDATE sessions SET username = ? WHERE token = ?', [newUsername, session.token]); return sendJson(res, 200, { message: 'Username berhasil diubah!', username: newUsername }); } catch (error) { return sendJson(res, 500, { message: 'Gagal mengubah username.' }); } }
  if (req.method === 'POST' && pathname === '/api/user/avatar') { if (!session || session.role !== 'user') return sendJson(res, 401, { message: 'Silakan login.' }); const body = await readJson(req); if (!body.avatar || !body.avatar.startsWith('data:image')) return sendJson(res, 400, { message: 'Format gambar tidak valid.' }); try { await run('UPDATE users SET avatar_url = ? WHERE id = ?', [body.avatar, session.userId]); return sendJson(res, 200, { message: 'Avatar berhasil diubah!' }); } catch (error) { return sendJson(res, 500, { message: 'Gagal upload avatar.' }); } }

  // ── Comments Endpoints ──
  const commentsMatch = pathname.match(/^\/api\/snippets\/(\d+)\/comments$/);
  if (req.method === 'GET' && commentsMatch) { const id = Number(commentsMatch[1]); const comments = await rows('SELECT id, username, avatar_url, content, created_at FROM comments WHERE snippet_id = ? ORDER BY created_at ASC', [id]); return sendJson(res, 200, comments); }
  if (req.method === 'POST' && commentsMatch) { if (!session) return sendJson(res, 401, { message: 'Login untuk berkomentar.' }); const id = Number(commentsMatch[1]); const body = await readJson(req); const content = String(body.content || '').trim(); if (!content) return sendJson(res, 400, { message: 'Komentar tidak boleh kosong.' }); if (content.length > 500) return sendJson(res, 400, { message: 'Komentar maks 500 karakter.' }); const user = await row('SELECT avatar_url FROM users WHERE id = ?', [session.userId]); await run('INSERT INTO comments (snippet_id, user_id, username, avatar_url, content) VALUES (?, ?, ?, ?, ?)', [id, session.userId, session.username, user?.avatar_url || null, content]); return sendJson(res, 201, { message: 'Komentar ditambahkan.' }); }

  // ── Announcements Endpoints ──
  if (req.method === 'GET' && pathname === '/api/announcements') { const announcements = await rows('SELECT * FROM announcements ORDER BY created_at DESC LIMIT 5'); return sendJson(res, 200, announcements); }
  if (req.method === 'POST' && pathname === '/api/admin/announcements') { if (!session || session.role !== 'admin') return sendJson(res, 401, { message: 'Akses ditolak.' }); const body = await readJson(req); const title = String(body.title || '').trim(); const content = String(body.content || '').trim(); if (!title || !content) return sendJson(res, 400, { message: 'Judul dan isi wajib diisi.' }); await run('INSERT INTO announcements (title, content) VALUES (?, ?)', [title, content]); return sendJson(res, 201, { message: 'Pengumuman berhasil dikirim!' }); }
  const adminAnnDeleteMatch = pathname.match(/^\/api\/admin\/announcements\/(\d+)$/);
  if (req.method === 'DELETE' && adminAnnDeleteMatch) { if (!session || session.role !== 'admin') return sendJson(res, 401, { message: 'Akses ditolak.' }); await run('DELETE FROM announcements WHERE id = ?', [Number(adminAnnDeleteMatch[1])]); return sendJson(res, 200, { message: 'Pengumuman dihapus.' }); }

  // ── Admin Endpoints ──
  if (req.method === 'GET' && pathname === '/api/admin/users') { if (!session || session.role !== 'admin') return sendJson(res, 401, { message: 'Akses ditolak.' }); const users = await rows('SELECT id, username, created_at FROM users'); return sendJson(res, 200, users); }
  const adminUserDeleteMatch = pathname.match(/^\/api\/admin\/users\/(\d+)$/);
  if (req.method === 'DELETE' && adminUserDeleteMatch) { if (!session || session.role !== 'admin') return sendJson(res, 401, { message: 'Akses ditolak.' }); const userId = Number(adminUserDeleteMatch[1]); try { await run('DELETE FROM snippets WHERE user_id = ?', [userId]); await run('DELETE FROM sessions WHERE user_id = ?', [userId]); await run('DELETE FROM users WHERE id = ?', [userId]); return sendJson(res, 200, { message: 'User dan snippet terkait berhasil dihapus.' }); } catch (error) { return sendJson(res, 500, { message: 'Gagal menghapus user.' }); } }
  const adminEditMatch = pathname.match(/^\/api\/admin\/snippets\/(\d+)$/);
  if (req.method === 'PUT' && adminEditMatch) { if (!session || session.role !== 'admin') return sendJson(res, 401, { message: 'Akses ditolak.' }); const id = Number(adminEditMatch[1]); const body = await readJson(req); const title = String(body.title || '').trim(); const description = String(body.description || '').trim(); const language = String(body.language || '').trim(); const code = String(body.code || '').trim(); if (!title || !description || !language || !code) return sendJson(res, 400, { message: 'Semua kolom wajib diisi.' }); try { await run('UPDATE snippets SET title=?, description=?, language=?, code=? WHERE id=?', [title, description, language, code, id]); return sendJson(res, 200, { message: 'Snippet berhasil diperbarui.' }); } catch (error) { return sendJson(res, 500, { message: 'Gagal memperbarui snippet.' }); } }
  if (req.method === 'GET' && pathname === '/api/admin/stats') { if (!session || session.role !== 'admin') return sendJson(res, 401, { message: 'Akses admin ditolak.' }); const totals = await row(`SELECT (SELECT COUNT(*) FROM users) AS users, (SELECT COUNT(*) FROM snippets) AS snippets, (SELECT COALESCE(SUM(views), 0) FROM snippets) AS views, (SELECT COALESCE(SUM(copies), 0) FROM snippets) AS copies`); const snippets = await rows(`SELECT snippets.id, snippets.title, snippets.language, snippets.views, snippets.copies, snippets.created_at, users.username, users.avatar_url FROM snippets JOIN users ON users.id = snippets.user_id ORDER BY snippets.created_at DESC`); return sendJson(res, 200, { totals, snippets }); }
  const adminDeleteMatch = pathname.match(/^\/api\/admin\/snippets\/(\d+)$/);
  if (req.method === 'DELETE' && adminDeleteMatch) { if (!session || session.role !== 'admin') return sendJson(res, 401, { message: 'Akses admin ditolak.' }); await run('DELETE FROM snippets WHERE id = ?', [Number(adminDeleteMatch[1])]); return sendJson(res, 200, { message: 'Snippet dihapus.' }); }

  return sendJson(res, 404, { message: 'Endpoint tidak ditemukan.' });
}

await initDb();

async function requestHandler(req, res) {
  if (req.url.startsWith('/api/')) { try { await handleApi(req, res); } catch (error) { console.error('API Error:', error); sendJson(res, 500, { message: 'Server error.', detail: error.message }); } return; }
  serveStatic(req, res);
}

export default requestHandler;

if (!process.env.VERCEL) {
  const server = http.createServer(requestHandler);
  server.listen(port, () => { console.log(`AndriCode berjalan di http://localhost:${port}`); console.log(`Database mode: ${db.mode} (${db.label})`); });
}
