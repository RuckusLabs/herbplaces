import { createCipheriv, createDecipheriv, publicEncrypt, privateDecrypt, randomBytes, constants } from 'node:crypto';
import { createReadStream } from 'node:fs';
import fs from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';

const aad = Buffer.from('Little Herb Places backup v1');
const rsa = { padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' };

export async function seal(input, output, publicKey) {
  const key = randomBytes(32), iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(aad);
  let created = false;
  try {
    const handle = await fs.open(output, 'wx', 0o600); created = true;
    await pipeline(createReadStream(input), cipher, handle.createWriteStream());
    return { version: 1, algorithm: 'RSA-OAEP-SHA256/AES-256-GCM', key: publicEncrypt({ key: publicKey, ...rsa }, key).toString('base64'), iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64') };
  } catch (error) { if (created) await fs.rm(output, { force: true }); throw error; }
  finally { key.fill(0); }
}

export async function unseal(input, output, envelope, privateKey) {
  if (envelope.version !== 1 || envelope.algorithm !== 'RSA-OAEP-SHA256/AES-256-GCM') throw new Error('Unsupported backup envelope.');
  const key = privateDecrypt({ key: privateKey, ...rsa }, Buffer.from(envelope.key, 'base64'));
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(envelope.iv, 'base64'));
  decipher.setAAD(aad); decipher.setAuthTag(Buffer.from(envelope.tag, 'base64'));
  let created = false;
  try {
    const handle = await fs.open(output, 'wx', 0o600); created = true;
    await pipeline(createReadStream(input), decipher, handle.createWriteStream());
  } catch (error) { if (created) await fs.rm(output, { force: true }); throw error; }
  finally { key.fill(0); }
}
