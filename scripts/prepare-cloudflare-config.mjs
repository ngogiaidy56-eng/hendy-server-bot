import fs from 'node:fs/promises';

const databaseId = process.env.CLOUDFLARE_D1_DATABASE_ID;
if (!databaseId || !/^[a-f0-9-]{20,}$/i.test(databaseId)) {
  throw new Error('CLOUDFLARE_D1_DATABASE_ID GitHub secret is missing or invalid.');
}
const configPath = new URL('../wrangler.toml', import.meta.url);
const current = await fs.readFile(configPath, 'utf8');
const updated = current.replace(
  /database_id\s*=\s*"[^"]+"/,
  'database_id = "' + databaseId + '"'
);
if (updated === current && !current.includes(databaseId)) {
  throw new Error('Could not update database_id in wrangler.toml.');
}
await fs.writeFile(configPath, updated);
console.log('Cloudflare D1 binding configured for this deployment.');
