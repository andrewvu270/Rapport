/**
 * One-time script: delete all test-* namespaces from Pinecone.
 * Run with: node scripts/cleanup-pinecone.mjs
 */
import { Pinecone } from '@pinecone-database/pinecone';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Load .env.local manually
const envPath = resolve(process.cwd(), '.env.local');
const env = readFileSync(envPath, 'utf8');
for (const line of env.split('\n')) {
  const [key, ...rest] = line.split('=');
  if (key && rest.length) process.env[key.trim()] = rest.join('=').trim();
}

const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
const indexName = process.env.PINECONE_INDEX_NAME;
const index = pc.index(indexName);

const stats = await index.describeIndexStats();
const namespaces = Object.keys(stats.namespaces || {});

const testNamespaces = namespaces.filter(ns => ns.startsWith('test-'));
console.log(`Found ${testNamespaces.length} test namespace(s) to delete out of ${namespaces.length} total.`);

for (const ns of testNamespaces) {
  console.log(`Deleting namespace: ${ns}`);
  await index.namespace(ns).deleteAll();
}

console.log('Done.');
