// Run only in the dedicated private backup repository. No plaintext artifacts or credentials are logged.
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { seal } from './seal.mjs';

const project = 'qtpepsebztlremlhpxdt';
const required = name => { if (!process.env[name]) throw new Error(`Missing ${name}.`); return process.env[name]; };
const parseUrl = name => { try { return new URL(required(name)); } catch { throw new Error(`Invalid ${name}; check it privately.`); } };
const url = parseUrl('SUPABASE_URL');
if (url.protocol !== 'https:' || url.hostname !== `${project}.supabase.co`) throw new Error('Unexpected backup source.');
const connection = parseUrl('BACKUP_DATABASE_URL');
if (!['postgres:', 'postgresql:'].includes(connection.protocol) || !(connection.hostname === `db.${project}.supabase.co` || (connection.hostname.endsWith('.pooler.supabase.com') && decodeURIComponent(connection.username).endsWith(`.${project}`)))) throw new Error('Unexpected database source.');
if (process.env.GITHUB_ACTIONS === 'true' && process.env.BACKUP_REPOSITORY_PRIVATE !== 'true') throw new Error('Backup workflow requires a private repository.');
const publicKey = required('BACKUP_PUBLIC_KEY');
const stage = await fs.mkdtemp(path.join(os.tmpdir(), 'lhp-backup-'));
await fs.chmod(stage, 0o700);
const output = path.resolve(required('BACKUP_OUTPUT_DIR'));
await fs.mkdir(output, { recursive: true, mode: 0o700 });
if ((await fs.readdir(output)).length) throw new Error('Backup output must be an empty directory.');
if (output === stage || output.startsWith(`${stage}${path.sep}`)) throw new Error('Encrypted output must be separate from plaintext staging.');
const command = (program, args) => execFileSync(program, args, { stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1024 * 1024, timeout: 15 * 60 * 1000 });
async function list() {
  // The source is Postgres 15. Only the bucket's index is read; object bytes are public.
  const sql = "select coalesce(json_agg(t order by name), '[]'::json) from (select name,id,updated_at,metadata from storage.objects where bucket_id='place-photos') t";
  const raw = execFileSync('docker', ['run', '--rm', '--env', 'PGDATABASE', '--env', 'PGSSLMODE', 'postgres:15', 'psql', '--no-psqlrc', '--tuples-only', '--no-align', '--set', 'ON_ERROR_STOP=1', '--command', sql], {
    env: { ...process.env, PGDATABASE: connection.href, PGSSLMODE: 'require' }, stdio: ['ignore', 'pipe', 'pipe'], timeout: 120000, maxBuffer: 16 * 1024 * 1024,
  });
  const files = JSON.parse(raw.toString('utf8'));
  if (!Array.isArray(files) || files.some(file => typeof file.name !== 'string' || file.name.split('/').some(part => !part || ['.', '..'].includes(part)))) throw new Error('Invalid Storage index.');
  return files;
}

try {
  const files = await list();
  // Supabase's supported CLI filters managed schemas; data-only includes Auth/Storage data.
  // Credentials are arguments inside the isolated runner, captured errors are never printed.
  for (const [name, flags] of [['roles.sql', ['--role-only']], ['schema.sql', []], ['data.sql', ['--data-only', '--use-copy', '-x', 'storage.buckets_vectors', '-x', 'storage.vector_indexes']], ['history_schema.sql', ['--schema', 'supabase_migrations']], ['history_data.sql', ['--data-only', '--use-copy', '--schema', 'supabase_migrations']]]) {
    command('supabase', ['db', 'dump', '--db-url', connection.href, '--file', path.join(stage, name), ...flags]);
    if ((await fs.stat(path.join(stage, name))).size === 0) throw new Error('Empty database export.');
    await fs.chmod(path.join(stage, name), 0o600);
  }
  const manifest = { version: 1, created_at: new Date().toISOString(), project, source_commit: process.env.GITHUB_SHA || null, bucket: 'place-photos', files: [] };
  await fs.mkdir(path.join(stage, 'photos'), { mode: 0o700 });
  for (const file of files) {
    const objectPath = file.name.split('/').map(encodeURIComponent).join('/');
    const response = await fetch(new URL(`/storage/v1/object/public/place-photos/${objectPath}`, url), { redirect: 'error', signal: AbortSignal.timeout(60000) });
    if (!response.ok) throw new Error('Photo download failed; backup is incomplete.');
    const bytes = Buffer.from(await response.arrayBuffer());
    if (Number.isFinite(Number(file.metadata?.size)) && Number(file.metadata.size) !== bytes.length) throw new Error('Storage object size changed.');
    const local = `photos/${createHash('sha256').update(file.name).digest('hex')}`;
    await fs.writeFile(path.join(stage, local), bytes, { mode: 0o600 });
    manifest.files.push({ ...file, local, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
  }
  if (JSON.stringify(files) !== JSON.stringify(await list())) throw new Error('Storage changed during backup; retry for a complete snapshot.');
  await fs.writeFile(path.join(stage, 'manifest.json'), JSON.stringify(manifest), { mode: 0o600 });
  const archive = path.join(stage, 'snapshot.tar.gz');
  command('tar', ['-czf', archive, '-C', stage, 'roles.sql', 'schema.sql', 'data.sql', 'history_schema.sql', 'history_data.sql', 'manifest.json', 'photos']);
  const envelope = await seal(archive, path.join(output, 'snapshot.enc'), publicKey);
  await fs.writeFile(path.join(output, 'envelope.json'), JSON.stringify(envelope), { mode: 0o600 });
  console.log(`Encrypted database export and ${files.length} photo objects. No plaintext uploaded.`);
} catch {
  await fs.rm(path.join(output, 'snapshot.enc'), { force: true });
  await fs.rm(path.join(output, 'envelope.json'), { force: true });
  console.error('Backup failed; no valid encrypted snapshot produced. Check configuration and source access privately.');
  process.exitCode = 1;
} finally { await fs.rm(stage, { recursive: true, force: true }); }
