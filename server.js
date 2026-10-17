const http = require('http'), fs = require('fs'), path = require('path');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 3000;
const REVIVE_MS = 5000;   // arkadaş mavi noktada bu kadar beklerse ölen oyuncu canlanır
const TICK_MS = 100;      // sunucu herkese 10 kez/sn durum yollar
const STALE_MS = 1000;    // 1 sn'dir haber vermeyen oyuncu kurtarmış sayılmaz
const rooms = new Map();

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json'
};

const server = http.createServer((req, res) => {
  let u = req.url.split('?')[0];
  if (u === '/') u = '/index.html';
  const file = path.join(__dirname, u);
  if (!file.startsWith(__dirname) || !fs.existsSync(file)) {
    res.writeHead(404);
    return res.end('Not found');
  }
  res.writeHead(200, {
    'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream',
    'Cache-Control': 'no-cache'
  });
  fs.createReadStream(file).pipe(res);
});

const wss = new WebSocketServer({ server });

function send(ws, m) { if (ws.readyState === 1) ws.send(JSON.stringify(m)); }

function broadcast(room, m) {
  const s = rooms.get(room);
  if (!s) return;
  const raw = JSON.stringify(m);
  for (const p of s.players.values()) if (p.ws.readyState === 1) p.ws.send(raw);
}

// x, y, spotX, spotY: 0-1 arası oran (her ekran boyutunda aynı yere denk gelsin diye)
function snapshot(s) {
  return [...s.players.values()].map(p => ({
    id: p.id, x: p.x, y: p.y, health: p.health, alive: p.alive,
    playing: p.playing, name:p.name, bombs:p.bombs, wave:p.wave, shots:p.shots, score:p.score, spotX: p.alive ? null : p.spotX, spotY: p.alive ? null : p.spotY,
    prog: p.alive ? 0 : p.prog
  }));
}

// Düşman dünyasını hesaplayan oyuncu: maçta olan takım kurucusu, yoksa maçtaki ilk oyuncu
function hostOf(s) {
  const c = s.players.get(s.creatorId);
  if (c && c.playing) return c.id;
  for (const p of s.players.values()) if (p.playing) return p.id;
  return s.creatorId;
}

function roomInfo(s) {
  return { type: 'room', hostId: hostOf(s), creatorId: s.creatorId, difficulty: s.difficulty, controlMode: s.controlMode, players: snapshot(s) };
}

process.on('uncaughtException', e => console.error('uncaught', e));
process.on('unhandledRejection', e => console.error('unhandled', e));

wss.on('connection', ws => {
  let room = '';
  ws.on('error', e => console.error('ws error', e.message));
  const id = Math.random().toString(36).slice(2, 10);

  ws.on('message', raw => {
    let m;
    try { m = JSON.parse(raw); } catch { return; }

    if (m.type === 'join') {
      room = String(m.room || '').replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 8);
      if (!room) return;
      let s = rooms.get(room);
      if (!s) {
        s = { creatorId: id, difficulty: m.difficulty || 'medium', controlMode: m.controlMode || 'keyboard', players: new Map(), gameOverSent:false };
        rooms.set(room, s);
      }
      s.players.set(id, {
        id, ws, x: 0, y: 0, health: 100, alive: true, name:String(m.name||"Oyuncu").slice(0,18), bombs:10, wave:1, shots:1, score:0,
        playing: false, spotX: 0, spotY: 0, prog: 0, rescue: null, last: Date.now(), guardUntil: 0
      });
      send(ws, { type: 'welcome', id, creatorId: s.creatorId });
      broadcast(room, roomInfo(s));
    }

    else if (m.type === 'start' && room) {
      const s = rooms.get(room);
      if (!s || s.creatorId !== id) return;
      s.gameOverSent = false;
      for (const p of s.players.values()) { p.alive = true; p.health = 100; p.playing = true; p.prog = 0; p.guardUntil = Date.now()+1500; }
      broadcast(room, {type:'start'});
      broadcast(room, roomInfo(s));
    }

    else if (m.type === 'leaveMatch' && room) {
      const s = rooms.get(room), p = s && s.players.get(id);
      if (!p) return;
      p.playing = false; p.alive = false; p.health = 0; p.rescue = null;
      broadcast(room, roomInfo(s));
    }

    else if (m.type === 'relay' && room) {
      const s = rooms.get(room);
      if (!s || !m.data || typeof m.data !== 'object') return;
      if (m.data.k === 'world' && id !== hostOf(s)) return; // dünyayı yalnızca host yollayabilir
      const out = JSON.stringify({ type: 'relay', from: id, data: m.data });
      if (m.to === 'all') {
        for (const p of s.players.values()) if (p.id !== id && p.ws.readyState === 1) p.ws.send(out);
      } else {
        const t = s.players.get(m.to === 'host' ? hostOf(s) : String(m.to));
        if (t && t.id !== id && t.ws.readyState === 1) t.ws.send(out);
      }
    }

    else if (m.type === 'settings' && room) {
      const s = rooms.get(room);
      if (!s || s.creatorId !== id) return;
      if (['easy', 'medium', 'hard', 'impossible'].includes(m.difficulty)) s.difficulty = m.difficulty;
      if (['keyboard', 'mobile'].includes(m.controlMode)) s.controlMode = m.controlMode;
      broadcast(room, roomInfo(s));
    }

    else if (m.type === 'state' && room) {
      const s = rooms.get(room), p = s && s.players.get(id);
      if (!p) return;
      const wasAlive = p.alive;
      p.x = Number(m.x) || 0;
      p.y = Number(m.y) || 0;
      p.health = Math.max(0, Number(m.health) || 0);
      p.name = String(m.name || p.name || "Oyuncu").slice(0,18);p.bombs=Math.max(0,Number(m.bombs)||0);p.wave=Math.max(1,Number(m.wave)||1);p.shots=Math.max(1,Number(m.shots)||1);p.score=Math.max(0,Number(m.score)||0);
      if (typeof m.playing === "boolean") p.playing = m.playing;
      else p.playing = true;
      p.rescue = typeof m.rescue === 'string' ? m.rescue : null;
      p.last = Date.now();

      let alive = !!m.alive;
      // Yeni canlandırılmış oyuncudan gelen eski "ölü" mesajını yok say
      if (!alive && Date.now() < p.guardUntil) alive = true;

      if (wasAlive && !alive) { p.spotX = p.x; p.spotY = p.y; p.prog = 0; } // öldüğü yer = mavi nokta
      if (alive) p.prog = 0;
      p.alive = alive;
    }
  });

  ws.on('close', () => {
    const s = rooms.get(room);
    if (!s) return;
    s.players.delete(id);
    if (!s.players.size) { rooms.delete(room); return; }
    if (s.creatorId === id) s.creatorId = [...s.players.keys()][0];
    broadcast(room, roomInfo(s));
  });
});

// Mavi nokta sayacı: yaşayan bir arkadaş noktanın üstündeyse sayar, ayrılırsa sıfırlar
let lastTick = Date.now();
setInterval(() => {
  const now = Date.now(), dt = Math.min(250, now - lastTick);
  lastTick = now;
  for (const [room, s] of rooms) {
    for (const d of s.players.values()) {
      if (d.alive || !d.playing) { d.prog = 0; continue; }
      let rescuing = false;
      for (const o of s.players.values()) {
        if (o !== d && o.alive && o.rescue === d.id && now - o.last < STALE_MS) { rescuing = true; break; }
      }
      d.prog = rescuing ? d.prog + dt : 0;
      if (d.prog >= REVIVE_MS) {
        d.alive = true;
        d.prog = 0;
        d.health = 100;
        d.guardUntil = now + 2500;
        s.gameOverSent = false;
        send(d.ws, { type: 'revive' });
      }
    }
    const active = [...s.players.values()].filter(p => p.playing);
    if (active.length && active.every(p => !p.alive) && !s.gameOverSent) {
      s.gameOverSent = true;
      broadcast(room, {type:'gameOver'});
    }
    if (active.some(p => p.alive)) s.gameOverSent = false;
    broadcast(room, { type: 'state', hostId: hostOf(s), players: snapshot(s) });
  }
}, TICK_MS);

server.listen(PORT, '0.0.0.0', () => console.log(`SKY WARRIOR ONLINE listening on ${PORT}`));
