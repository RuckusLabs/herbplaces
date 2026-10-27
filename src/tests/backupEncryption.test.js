import test from 'node:test';
import { Buffer } from 'node:buffer';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { seal, unseal } from '../../scripts/backups/seal.mjs';
const keys = generateKeyPairSync('rsa', { modulusLength: 2048 });
test('backup ciphertext requires the recovery key and detects tampering without leaving plaintext', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'lhp-seal-test-'));
  try {
    const input = path.join(dir, 'source'), encrypted = path.join(dir, 'encrypted'), output = path.join(dir, 'restored');
    const content = Buffer.from('private listing and account records\n'.repeat(10000));
    await fs.writeFile(input, content);
    const envelope = await seal(input, encrypted, keys.publicKey);
    assert.equal((await fs.readFile(encrypted)).includes(Buffer.from('private listing')), false);
    await unseal(encrypted, output, envelope, keys.privateKey);
    assert.deepEqual(await fs.readFile(output), content);
    await assert.rejects(unseal(encrypted, output, envelope, keys.privateKey), { code: 'EEXIST' });
    assert.deepEqual(await fs.readFile(output), content);
    const originalCiphertext = await fs.readFile(encrypted);
    await assert.rejects(seal(input, encrypted, keys.publicKey), { code: 'EEXIST' });
    assert.deepEqual(await fs.readFile(encrypted), originalCiphertext);
    const damaged = await fs.readFile(encrypted); damaged[12] ^= 1; await fs.writeFile(encrypted, damaged);
    const failed = path.join(dir, 'failed');
    await assert.rejects(unseal(encrypted, failed, envelope, keys.privateKey));
    await assert.rejects(fs.stat(failed), { code: 'ENOENT' });
    await assert.rejects(unseal(encrypted, failed, { ...envelope, version: 2 }, keys.privateKey), /Unsupported/);
    const wrongKey = generateKeyPairSync('rsa', { modulusLength: 2048 });
    await assert.rejects(unseal(encrypted, failed, envelope, wrongKey.privateKey));
    await assert.rejects(fs.stat(failed), { code: 'ENOENT' });
  } finally { await fs.rm(dir, { recursive: true, force: true }); }
});
