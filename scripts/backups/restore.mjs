// Offline verification/decryption only. Never imports data into a database or uploads objects.
import fs from 'node:fs/promises';
import path from 'node:path';
import { unseal } from './seal.mjs';
const [source, privateKeyFile, destination] = process.argv.slice(2);
if (!source || !privateKeyFile || !destination) throw new Error('Usage: node restore.mjs BACKUP_FOLDER PRIVATE_KEY_FILE NEW_ARCHIVE_PATH');
try {
  const envelope = JSON.parse(await fs.readFile(path.join(source, 'envelope.json'), 'utf8'));
  await unseal(path.join(source, 'snapshot.enc'), destination, envelope, await fs.readFile(privateKeyFile, 'utf8'));
  console.log('Archive authenticated and decrypted. No production data was changed.');
} catch { console.error('Decryption failed. Check the recovery key and snapshot integrity.'); process.exitCode = 1; }
