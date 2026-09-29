import type { APIRoute } from 'astro';
import { buildSearchIndex } from '../lib/search-index';
export const GET: APIRoute = async () => new Response(JSON.stringify(await buildSearchIndex()), { headers: { 'Content-Type': 'application/json' } });
