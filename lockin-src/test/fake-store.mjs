// Test-only stand-in for Firestore: per-user docs, set-with-merge writes, live pushes over SSE.
import http from 'node:http';
import { applyPatch } from '../src/core.js';
const users = {}; const subs = {};
const get = uid => users[uid] || (users[uid] = { meta: null, months: {} });
const send = uid => (subs[uid] || []).forEach(r => r.write('data: ' + JSON.stringify(get(uid)) + '\n\n'));
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type' };
http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x'); const uid = u.searchParams.get('uid');
  if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }
  if (u.pathname === '/w' && req.method === 'POST') {
    let b = ''; req.on('data', c => b += c); req.on('end', () => {
      const ops = JSON.parse(b); const d = get(uid);
      ops.forEach(o => { if (o.doc === 'meta') { d.meta = d.meta || {}; applyPatch(d.meta, o.data); } else { d.months[o.ym] = d.months[o.ym] || {}; applyPatch(d.months[o.ym], o.data); } });
      res.writeHead(200, cors); res.end('{}'); send(uid);
    }); return;
  }
  if (u.pathname === '/dump') { res.writeHead(200, { ...cors, 'content-type': 'application/json' }); return res.end(JSON.stringify(get(uid))); }
  if (u.pathname === '/s') {
    res.writeHead(200, { ...cors, 'content-type': 'text/event-stream', 'cache-control': 'no-cache' });
    (subs[uid] = subs[uid] || []).push(res); res.write('data: ' + JSON.stringify(get(uid)) + '\n\n');
    req.on('close', () => { subs[uid] = subs[uid].filter(x => x !== res); }); return;
  }
  res.writeHead(404, cors); res.end();
}).listen(8790, '127.0.0.1', () => console.log('fake store on 8790'));
