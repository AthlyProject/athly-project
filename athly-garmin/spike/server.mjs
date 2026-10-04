// Servidor do spike (Phase 0): serve os FIT de fixtures/ com o Content-Type escolhido e simula as
// respostas de erro, para medir o comportamento real do relógio. Rode atrás de um túnel HTTPS:
//   node athly-garmin/spike/server.mjs
//   cloudflared tunnel --url http://localhost:8787
import { readdirSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';

const PORT = Number(process.env.PORT ?? 8787);
const fixtures = new URL('fixtures/', import.meta.url);
const CONTENT_TYPES = {
  vnd: 'application/vnd.ant.fit',
  fit: 'application/fit',
  octet: 'application/octet-stream',
};

const json = (res, status, body) => {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
};

createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://spike');
  // Registra o que o relógio realmente manda (headers adicionados pelo Garmin Connect etc.).
  console.log(
    new Date().toISOString(),
    req.method,
    url.pathname + url.search,
    JSON.stringify({ ua: req.headers['user-agent'], auth: Boolean(req.headers.authorization), ct: req.headers['content-type'] }),
  );

  if (url.pathname === '/list') {
    const names = readdirSync(fixtures)
      .filter((f) => f.endsWith('.fit') && !f.startsWith('cap-'))
      .map((f) => f.replace(/\.fit$/, ''))
      .sort();
    return json(res, 200, { fixtures: names, contentTypes: Object.keys(CONTENT_TYPES) });
  }
  if (url.pathname === '/json/401') return json(res, 401, { statusCode: 401, code: 'CIQ_DEVICE_UNAUTHORIZED' });
  if (url.pathname === '/json/401w') return json(res, 200, { statusCode: 401, code: 'CIQ_DEVICE_UNAUTHORIZED' });

  const match = /^\/fit\/([a-z0-9-]+)$/.exec(url.pathname);
  if (match) {
    let bytes;
    try {
      bytes = readFileSync(new URL(`${match[1]}.fit`, fixtures));
    } catch {
      return json(res, 404, { statusCode: 404 });
    }
    const contentType = CONTENT_TYPES[url.searchParams.get('ct') ?? 'vnd'] ?? CONTENT_TYPES.vnd;
    res.writeHead(200, { 'Content-Type': contentType, 'Content-Length': bytes.length, 'Cache-Control': 'no-store' });
    return res.end(bytes);
  }
  json(res, 404, { statusCode: 404 });
}).listen(PORT, () => console.log(`spike em http://localhost:${PORT}`));
