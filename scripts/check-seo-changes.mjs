import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { loadEnv } from 'vite';
import { fetchPublicPlaces, needsBuild } from './seo/directory.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const env = { ...loadEnv('production', root, 'VITE_'), ...process.env };
const argument = name => { const index = process.argv.indexOf(name); return index < 0 ? null : process.argv[index + 1]; };
const snapshot = argument('--snapshot');
const previous = argument('--previous');
if (!snapshot || !previous) throw new Error('--snapshot and --previous paths are required.');
const places = await fetchPublicPlaces(env);
let previousHash;
try { previousHash = await fs.readFile(previous, 'utf8'); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
const changed = needsBuild(places, previousHash, env.SEO_FORCE_BUILD === 'true');
await fs.writeFile(snapshot, JSON.stringify(places));
if (env.GITHUB_OUTPUT) await fs.appendFile(env.GITHUB_OUTPUT, `changed=${changed}\n`);
console.log(changed ? `Building pages and cards for ${places.length} public places.` : 'Public listings are unchanged; skipping the build and deployment.');
