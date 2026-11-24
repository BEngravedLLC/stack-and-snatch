// Stack & Snatch — online multiplayer set-collecting / stealing card game
// Node + Express + Socket.io. Deploy on Render: build "npm install", start "npm start".
const express = require('express');
const http = require('http');
const path = require('path');
const crypto = require('crypto');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { maxHttpBufferSize: 1e6, pingTimeout: 30000 });

app.use(express.static(path.join(__dirname, 'public')));
app.get('/health', (_q, r) => r.send('ok'));

// ---------------------------------------------------------------- cards
const TYPES = {
  piggy:    { name: 'Piggy Bank',              value: 5000,  count: 10 },
  cash:     { name: 'Cash Under the Mattress', value: 5000,  count: 10 },
  stamps:   { name: 'Stamp Collection',        value: 5000,  count: 10 },
  baseball: { name: 'Baseball Cards',          value: 5000,  count: 10 },
  stocks:   { name: 'Stocks',                  value: 10000, count: 10 },
  plane:    { name: 'Private Plane',           value: 10000, count: 10 },
  bank:     { name: 'Bank Account',            value: 10000, count: 10 },
  auto:     { name: 'Classic Auto',            value: 15000, count: 10 },
  jewels:   { name: 'Jewels',                  value: 15000, count: 10 },
  home:     { name: 'Home',                    value: 20000, count: 8 },
  silver:   { name: 'Silver',                  value: 25000, count: 8, wild: true },
  gold:     { name: 'Gold',                    value: 50000, count: 4, wild: true },
};
const isWild = (c) => !!TYPES[c.t].wild;
const val = (c) => TYPES[c.t].value;
const setValue = (s) => s.cards.reduce((a, c) => a + val(c), 0);
const stackValue = (p) => p.stack.reduce((a, s) => a + setValue(s), 0);
const money = (n) => '$' + n.toLocaleString('en-US');

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function buildDeck() {
  const deck = [];
  let id = 0;
  for (const [t, d] of Object.entries(TYPES)) for (let i = 0; i < d.count; i++) deck.push({ id: id++, t });
  return shuffle(deck);
}

// ---------------------------------------------------------------- rooms
const rooms = new Map();
const tokenIndex = new Map(); // token -> {code, pid}
const BOT_NAMES = ['Penny Pincher', 'Buck Rogers', 'Goldie', 'Cash Money', 'Sir Saves-a-Lot', 'Nickel Nancy', 'Dime Piece', 'Rich Uncle'];
const BOT_AVATARS = ['🐷', '🦊', '🐻', '🐸', '🦉', '🐵', '🐼', '🐯'];

const SPEED = +process.env.BOT_SPEED || 1; // test hook: scales bot thinking time
const uid = () => crypto.randomBytes(9).toString('hex');
function newCode() {
  const L = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  let c;
  do { c = Array.from({ length: 4 }, () => L[crypto.randomInt(L.length)]).join(''); } while (rooms.has(c));
  return c;
}
const cleanName = (n) => String(n || '').replace(/[<>]/g, '').trim().slice(0, 16) || 'Player';
const cleanAvatar = (a) => (typeof a === 'string' && a.startsWith('data:image/') && a.length < 300000 ? a : null);

function makePlayer(name, avatar, bot = false) {
  return {
    id: uid(), token: uid(), socketId: null, name: cleanName(name), avatar: cleanAvatar(avatar),
    emoji: null, bot, connected: bot, hand: [], stack: [], total: 0, roundScores: [], setsMade: 0, steals: 0,
  };
}
function createRoom(host) {
  const room = {
    code: newCode(), hostId: host.id, players: [host], state: 'lobby',
    settings: { handSize: 0, target: 1000000, turnTimer: 0 },
    deck: [], discard: [], turn: 0, round: 0, challenge: null, deadline: null,
    log: [], chat: [], results: null, winnerId: null, timer: null, lastActive: Date.now(), fxSeq: 0,
  };
  rooms.set(room.code, room);
  tokenIndex.set(host.token, { code: room.code, pid: host.id });
  return room;
}
const P = (room, pid) => room.players.find((p) => p.id === pid);
const handSize = (room) => room.settings.handSize || (room.players.length <= 3 ? 5 : 4);
const cur = (room) => room.players[room.turn];

function log(room, text, kind = 'info') {
  room.log.push({ text, kind, ts: Date.now() });
  if (room.log.length > 80) room.log.shift();
}
function fx(room, e) {
  e.seq = ++room.fxSeq;
  io.to(room.code).emit('fx', e);
}

function view(room, me) {
  const ch = room.challenge;
  return {
    code: room.code, me: me.id, hostId: room.hostId, state: room.state, settings: room.settings,
    handSizeNow: handSize(room), round: room.round,
    players: room.players.map((p) => ({
      id: p.id, name: p.name, emoji: p.emoji, hasAvatar: !!p.avatar, bot: p.bot, connected: p.connected,
      handCount: p.hand.length, stack: p.stack.map((s) => ({ type: s.type, cards: s.cards, value: setValue(s) })),
      stackValue: stackValue(p), total: p.total, roundScores: p.roundScores,
    })),
    hand: me.hand,
    deckCount: room.deck.length, discardTop: room.discard[room.discard.length - 1] || null, discardCount: room.discard.length,
    turnId: room.state === 'playing' ? cur(room)?.id : null,
    challenge: ch ? {
      attacker: ch.attacker, defender: ch.defender, type: ch.type, setCards: ch.setCards,
      played: ch.played, toRespond: ch.toRespond,
    } : null,
    deadline: room.deadline, now: Date.now(),
    log: room.log.slice(-40), results: room.results, winnerId: room.winnerId,
  };
}
function broadcast(room) {
  for (const p of room.players) if (p.socketId && p.connected && !p.bot) io.to(p.socketId).emit('state', view(room, p));
}
function sendAvatars(room, target) {
  const map = {};
  for (const p of room.players) map[p.id] = p.avatar || null;
  if (target) io.to(target).emit('avatars', map); else io.to(room.code).emit('avatars', map);
}

// ---------------------------------------------------------------- game flow
function startGame(room) {
  for (const p of room.players) { p.total = 0; p.roundScores = []; p.setsMade = 0; p.steals = 0; }
  room.round = 0; room.winnerId = null;
  startRound(room);
}
function startRound(room) {
  room.round++;
  room.deck = buildDeck();
  room.discard = [];
  room.challenge = null;
  room.results = null;
  const hs = handSize(room);
  for (const p of room.players) { p.hand = []; p.stack = []; }
  for (let i = 0; i < hs; i++) for (const p of room.players) p.hand.push(room.deck.pop());
  room.discard.push(room.deck.pop());
  room.turn = (room.round - 1) % room.players.length;
  room.state = 'playing';
  log(room, `Round ${room.round} begins! ${hs} cards each.`, 'round');
  fx(room, { k: 'deal' });
  beginTurn(room);
}
function beginTurn(room) {
  const p = cur(room);
  fx(room, { k: 'turn', pid: p.id });
  schedule(room);
  broadcast(room);
}
function drawUp(room) {
  const hs = handSize(room);
  const n = room.players.length;
  const draws = {};
  for (let k = 0; k < n; k++) {
    const p = room.players[(room.turn + k) % n];
    while (p.hand.length < hs && room.deck.length) { p.hand.push(room.deck.pop()); draws[p.id] = (draws[p.id] || 0) + 1; }
  }
  if (Object.keys(draws).length) fx(room, { k: 'draw', draws });
}
function endTurn(room) {
  room.challenge = null;
  drawUp(room);
  const n = room.players.length;
  for (let k = 1; k <= n; k++) {
    const idx = (room.turn + k) % n;
    if (room.players[idx].hand.length > 0) { room.turn = idx; return beginTurn(room); }
  }
  endRound(room);
}
function endRound(room) {
  clearTimeout(room.timer); room.deadline = null;
  const res = room.players.map((p) => {
    const score = stackValue(p);
    p.total += score; p.roundScores.push(score);
    return { id: p.id, score, total: p.total, sets: p.stack.length };
  }).sort((a, b) => b.score - a.score);
  room.results = res;
  const target = room.settings.target;
  const reached = room.players.filter((p) => target === 0 || p.total >= target);
  if (reached.length) {
    reached.sort((a, b) => b.total - a.total || b.stack.length - a.stack.length);
    room.winnerId = reached[0].id;
    room.state = 'gameover';
    log(room, `🏆 ${reached[0].name} wins the game with ${money(reached[0].total)}!`, 'win');
    fx(room, { k: 'win', pid: reached[0].id });
  } else {
    room.state = 'roundend';
    log(room, `Round ${room.round} over. ${P(room, res[0].id).name} banked the most (${money(res[0].score)}).`, 'round');
    fx(room, { k: 'roundend' });
  }
  broadcast(room);
}

// ---------------------------------------------------------------- actions
function takeFromHand(p, id) {
  const i = p.hand.findIndex((c) => c.id === id);
  return i < 0 ? null : p.hand.splice(i, 1)[0];
}
function validPair(a, b) {
  if (!a || !b || a.id === b.id) return null;
  if (isWild(a) && isWild(b)) return null;
  if (!isWild(a) && !isWild(b) && a.t !== b.t) return null;
  return isWild(a) ? b.t : a.t;
}
function canChallengeTarget(room, p, q) {
  return q.id !== p.id && p.stack.length >= 1 && q.stack.length >= 2;
}
function cardBeats(card, type) { return isWild(card) || card.t === type; }

function doAction(room, p, a) {
  if (room.state !== 'playing' || room.challenge || cur(room).id !== p.id) return 'Not your turn';
  const kind = a && a.kind;
  if (kind === 'pair') {
    const [x, y] = (a.cards || []).map((id) => p.hand.find((c) => c.id === id));
    const type = validPair(x, y);
    if (!type) return 'Those two cards do not make a set (two of a kind, or one asset + one wild).';
    takeFromHand(p, x.id); takeFromHand(p, y.id);
    const cards = isWild(x) ? [x, y] : [y, x]; // wild sits underneath
    p.stack.push({ type, cards }); p.setsMade++;
    log(room, `${p.name} stacked a set of ${TYPES[type].name} (${money(val(x) + val(y))}).`, 'set');
    fx(room, { k: 'set', pid: p.id, type, value: val(x) + val(y) });
    return endTurn(room);
  }
  if (kind === 'discardPair') {
    const top = room.discard[room.discard.length - 1];
    const c = p.hand.find((h) => h.id === a.card);
    if (!top || !c || isWild(top) || isWild(c) || c.t !== top.t) return 'That card does not match the top of the discard pile.';
    takeFromHand(p, c.id); room.discard.pop();
    p.stack.push({ type: c.t, cards: [top, c] }); p.setsMade++;
    log(room, `${p.name} grabbed ${TYPES[c.t].name} from the discard pile to make a set.`, 'set');
    fx(room, { k: 'set', pid: p.id, type: c.t, value: val(c) * 2, fromDiscard: true });
    return endTurn(room);
  }
  if (kind === 'discard') {
    const c = takeFromHand(p, a.card);
    if (!c) return 'Card not in hand';
    room.discard.push(c);
    log(room, `${p.name} discarded ${TYPES[c.t].name}.`, 'discard');
    fx(room, { k: 'discard', pid: p.id, t: c.t });
    return endTurn(room);
  }
  if (kind === 'challenge') {
    const q = P(room, a.target);
    const c = p.hand.find((h) => h.id === a.card);
    if (!q || !c) return 'Invalid steal';
    if (p.stack.length < 1) return 'You need at least one set of your own before you can steal.';
    if (q.stack.length < 2) return `${q.name}'s first set is safe — they need at least two sets.`;
    const top = q.stack[q.stack.length - 1];
    if (!cardBeats(c, top.type)) return `You need a ${TYPES[top.type].name} or a wild to steal that.`;
    takeFromHand(p, c.id);
    room.challenge = {
      attacker: p.id, defender: q.id, type: top.type, setCards: top.cards,
      played: [{ pid: p.id, card: c }], toRespond: q.id,
    };
    log(room, `⚔️ ${p.name} is trying to steal ${q.name}'s ${TYPES[top.type].name}!`, 'challenge');
    fx(room, { k: 'challenge', att: p.id, def: q.id, type: top.type });
    schedule(room); broadcast(room);
    return null;
  }
  return 'Unknown action';
}

function respond(room, p, cardId) {
  const ch = room.challenge;
  if (!ch || ch.toRespond !== p.id) return 'Not your response';
  if (cardId == null) return resolveChallenge(room, p.id);
  const c = p.hand.find((h) => h.id === cardId);
  if (!c || !cardBeats(c, ch.type)) return `You need a ${TYPES[ch.type].name} or a wild.`;
  takeFromHand(p, c.id);
  ch.played.push({ pid: p.id, card: c });
  ch.toRespond = ch.toRespond === ch.attacker ? ch.defender : ch.attacker;
  log(room, `${p.name} fights back with ${TYPES[c.t].name}!`, 'challenge');
  fx(room, { k: 'counter', pid: p.id, t: c.t });
  schedule(room); broadcast(room);
  return null;
}
function resolveChallenge(room, loserId) {
  const ch = room.challenge;
  const winnerId = loserId === ch.attacker ? ch.defender : ch.attacker;
  const def = P(room, ch.defender), win = P(room, winnerId), lose = P(room, loserId);
  const set = def.stack.pop();
  const newSet = { type: set.type, cards: [...set.cards, ...ch.played.map((x) => x.card)] };
  win.stack.push(newSet);
  const v = setValue(newSet);
  if (winnerId === ch.attacker) {
    win.steals++;
    log(room, `💰 ${win.name} STOLE ${def.name}'s ${TYPES[set.type].name} — now worth ${money(v)}!`, 'steal');
    fx(room, { k: 'steal', winner: win.id, loser: def.id, type: set.type, value: v });
  } else {
    log(room, `🛡️ ${def.name} defended their ${TYPES[set.type].name} (${money(v)}). ${lose.name} gives up.`, 'defend');
    fx(room, { k: 'defended', winner: def.id, loser: lose.id, type: set.type, value: v });
  }
  endTurn(room);
  return null;
}

// ---------------------------------------------------------------- timers / bots
function schedule(room) {
  clearTimeout(room.timer);
  room.deadline = null;
  if (room.state !== 'playing') return;
  const ch = room.challenge;
  if (ch) {
    const r = P(room, ch.toRespond);
    // Same timer whether or not they can answer, so nobody can tell what's in their hand.
    if (r.bot || !r.connected) {
      room.timer = setTimeout(() => safe(room, () => botRespond(room, r)), (1300 + Math.random() * 900) * SPEED);
    } else {
      room.deadline = Date.now() + 25000;
      room.timer = setTimeout(() => safe(room, () => { log(room, `${r.name} let the clock run out.`, 'info'); resolveChallenge(room, r.id); }), 25000);
    }
    return;
  }
  const p = cur(room);
  if (p.bot || !p.connected) {
    room.timer = setTimeout(() => safe(room, () => botTurn(room, p)), (1400 + Math.random() * 1000) * SPEED);
  } else if (room.settings.turnTimer > 0) {
    const ms = room.settings.turnTimer * 1000;
    room.deadline = Date.now() + ms;
    room.timer = setTimeout(() => safe(room, () => {
      log(room, `⏰ ${p.name} ran out of time — auto-discard.`, 'info');
      const c = lowestCard(p.hand);
      doAction(room, p, { kind: 'discard', card: c.id });
    }), ms);
  }
}
function safe(room, fn) {
  try { if (rooms.has(room.code)) fn(); } catch (e) { console.error('game error', e); }
}
function lowestCard(hand) {
  const nonWild = hand.filter((c) => !isWild(c));
  const pool = nonWild.length ? nonWild : hand;
  return pool.slice().sort((a, b) => val(a) - val(b))[0];
}
function botTurn(room, p) {
  if (room.state !== 'playing' || room.challenge || cur(room).id !== p.id) return;
  const hand = p.hand;
  const byType = {};
  for (const c of hand) if (!isWild(c)) (byType[c.t] = byType[c.t] || []).push(c);
  const wilds = hand.filter(isWild).sort((a, b) => val(a) - val(b));
  const top = room.discard[room.discard.length - 1];
  const options = [];
  for (const [t, cs] of Object.entries(byType)) {
    if (cs.length >= 2) options.push({ score: TYPES[t].value * 2 + 3000, act: { kind: 'pair', cards: [cs[0].id, cs[1].id] } });
  }
  if (top && !isWild(top) && byType[top.t]) {
    options.push({ score: TYPES[top.t].value * 2 + 6000, act: { kind: 'discardPair', card: byType[top.t][0].id } });
  }
  if (p.stack.length >= 1) {
    for (const q of room.players) {
      if (!canChallengeTarget(room, p, q)) continue;
      const s = q.stack[q.stack.length - 1];
      const matches = byType[s.type] || [];
      const ammo = matches.length + wilds.length;
      if (!ammo) continue;
      const conf = ammo >= 3 ? 1.1 : ammo === 2 ? 0.9 : 0.45;
      const leaderBonus = q.total + stackValue(q) > p.total + stackValue(p) ? 1.15 : 1;
      const card = matches[0] || wilds[0];
      options.push({ score: setValue(s) * conf * leaderBonus + Math.random() * 4000, act: { kind: 'challenge', target: q.id, card: card.id } });
    }
  }
  if (!options.length && wilds.length && Object.keys(byType).length && (room.deck.length < 10 || Math.random() < 0.3)) {
    const best = Object.values(byType).flat().sort((a, b) => val(b) - val(a))[0];
    options.push({ score: 1, act: { kind: 'pair', cards: [wilds[0].id, best.id] } });
  }
  options.sort((a, b) => b.score - a.score);
  if (options.length) {
    const err = doAction(room, p, options[0].act);
    if (!err) return;
  }
  doAction(room, p, { kind: 'discard', card: lowestCard(hand).id });
}
function botRespond(room, p) {
  const ch = room.challenge;
  if (!ch || ch.toRespond !== p.id) return;
  const valid = p.hand.filter((c) => cardBeats(c, ch.type));
  if (!valid.length) return resolveChallenge(room, p.id);
  const pot = ch.setCards.reduce((a, c) => a + val(c), 0) + ch.played.reduce((a, x) => a + val(x.card), 0);
  const plain = valid.filter((c) => !isWild(c));
  const wild = valid.filter(isWild).sort((a, b) => val(a) - val(b));
  let pick = null;
  if (plain.length && (pot >= 10000 || Math.random() < 0.75)) pick = plain[0];
  else if (wild.length && (pot >= 30000 || Math.random() < 0.35)) pick = wild[0];
  if (!pick) return resolveChallenge(room, p.id);
  respond(room, p, pick.id);
}

// ---------------------------------------------------------------- sockets
function attach(socket, room, p) {
  p.socketId = socket.id; p.connected = true;
  socket.data.code = room.code; socket.data.pid = p.id;
  socket.join(room.code);
  sendAvatars(room);
  socket.emit('chatHistory', room.chat);
  if (room.state === 'playing') schedule(room);
  broadcast(room);
}
function ctx(socket) {
  const room = rooms.get(socket.data.code);
  const p = room && P(room, socket.data.pid);
  return room && p ? { room, p } : null;
}

io.on('connection', (socket) => {
  socket.on('create', (d, cb = () => {}) => {
    const p = makePlayer(d && d.name, d && d.avatar);
    const room = createRoom(p);
    log(room, `${p.name} opened the vault (room ${room.code}).`, 'info');
    cb({ ok: true, code: room.code, token: p.token });
    attach(socket, room, p);
  });

  socket.on('join', (d, cb = () => {}) => {
    const code = String((d && d.code) || '').toUpperCase().trim();
    const room = rooms.get(code);
    if (!room) return cb({ error: 'Room not found. Check the code?' });
    if (room.state !== 'lobby') return cb({ error: 'That game already started. Ask the host to wait for the next one.' });
    if (room.players.length >= 6) return cb({ error: 'Room is full (6 players max).' });
    const p = makePlayer(d.name, d.avatar);
    room.players.push(p);
    tokenIndex.set(p.token, { code: room.code, pid: p.id });
    log(room, `${p.name} joined.`, 'join');
    fx(room, { k: 'join', pid: p.id });
    cb({ ok: true, code: room.code, token: p.token });
    attach(socket, room, p);
  });

  socket.on('rejoin', (d, cb = () => {}) => {
    const ref = d && tokenIndex.get(d.token);
    const room = ref && rooms.get(ref.code);
    const p = room && P(room, ref.pid);
    if (!p) return cb({ ok: false });
    cb({ ok: true, code: room.code });
    log(room, `${p.name} is back.`, 'join');
    attach(socket, room, p);
  });

  socket.on('profile', (d) => {
    const c = ctx(socket); if (!c) return;
    if (d.name) c.p.name = cleanName(d.name);
    if (d.avatar !== undefined) c.p.avatar = cleanAvatar(d.avatar);
    sendAvatars(c.room); broadcast(c.room);
  });

  socket.on('addBot', () => {
    const c = ctx(socket); if (!c || c.room.hostId !== c.p.id || c.room.state !== 'lobby') return;
    if (c.room.players.length >= 6) return;
    const used = new Set(c.room.players.map((p) => p.name));
    const name = BOT_NAMES.find((n) => !used.has(n)) || 'Bot ' + c.room.players.length;
    const b = makePlayer(name, null, true);
    b.emoji = BOT_AVATARS[c.room.players.length % BOT_AVATARS.length];
    c.room.players.push(b);
    log(c.room, `🤖 ${b.name} (bot) took a seat.`, 'join');
    fx(c.room, { k: 'join', pid: b.id });
    sendAvatars(c.room); broadcast(c.room);
  });

  socket.on('kick', (pid) => {
    const c = ctx(socket); if (!c || c.room.hostId !== c.p.id || c.room.state !== 'lobby' || pid === c.p.id) return;
    const i = c.room.players.findIndex((p) => p.id === pid);
    if (i < 0) return;
    const [gone] = c.room.players.splice(i, 1);
    tokenIndex.delete(gone.token);
    if (gone.socketId) io.to(gone.socketId).emit('kicked');
    log(c.room, `${gone.name} left the table.`, 'info');
    broadcast(c.room);
  });

  socket.on('settings', (s) => {
    const c = ctx(socket); if (!c || c.room.hostId !== c.p.id || c.room.state !== 'lobby') return;
    const st = c.room.settings;
    if ([0, 4, 5, 6].includes(+s.handSize)) st.handSize = +s.handSize;
    if ([0, 250000, 500000, 1000000].includes(+s.target)) st.target = +s.target;
    if ([0, 30, 45, 60, 90].includes(+s.turnTimer)) st.turnTimer = +s.turnTimer;
    broadcast(c.room);
  });

  socket.on('start', () => {
    const c = ctx(socket); if (!c || c.room.hostId !== c.p.id) return;
    if (c.room.players.length < 2) return socket.emit('toast', 'Need at least 2 players — add a bot!');
    if (c.room.state === 'lobby') startGame(c.room);
  });
  socket.on('nextRound', () => {
    const c = ctx(socket); if (!c || c.room.hostId !== c.p.id || c.room.state !== 'roundend') return;
    startRound(c.room);
  });
  socket.on('backToLobby', () => {
    const c = ctx(socket); if (!c || c.room.hostId !== c.p.id || c.room.state !== 'gameover') return;
    const r = c.room;
    r.state = 'lobby'; r.results = null; r.winnerId = null; r.round = 0;
    for (const p of r.players) { p.hand = []; p.stack = []; p.total = 0; p.roundScores = []; }
    log(r, 'Back to the lobby for a rematch!', 'round');
    broadcast(r);
  });

  socket.on('action', (a, cb = () => {}) => {
    const c = ctx(socket); if (!c) return cb({ error: 'Not in a game' });
    let err;
    try { err = doAction(c.room, c.p, a); } catch (e) { console.error(e); err = 'Something went wrong'; }
    cb(err ? { error: err } : { ok: true });
  });
  socket.on('respond', (cardId, cb = () => {}) => {
    const c = ctx(socket); if (!c) return cb({ error: 'Not in a game' });
    let err;
    try { err = respond(c.room, c.p, cardId); } catch (e) { console.error(e); err = 'Something went wrong'; }
    cb(err ? { error: err } : { ok: true });
  });

  socket.on('chat', (text) => {
    const c = ctx(socket); if (!c) return;
    const t = String(text || '').trim().slice(0, 240);
    if (!t) return;
    const m = { pid: c.p.id, name: c.p.name, text: t, ts: Date.now() };
    c.room.chat.push(m); if (c.room.chat.length > 100) c.room.chat.shift();
    io.to(c.room.code).emit('chat', m);
  });
  socket.on('react', (emoji) => {
    const c = ctx(socket); if (!c) return;
    const ok = ['😂', '😱', '🔥', '😭', '💰', '👀', '😤', '🙏'];
    if (ok.includes(emoji)) io.to(c.room.code).emit('react', { pid: c.p.id, emoji });
  });

  socket.on('leave', () => {
    const c = ctx(socket); if (!c) return;
    const { room, p } = c;
    socket.leave(room.code);
    socket.data = {};
    if (room.state === 'lobby') {
      room.players = room.players.filter((x) => x.id !== p.id);
      tokenIndex.delete(p.token);
    } else {
      p.connected = false; p.socketId = null;
      log(room, `${p.name} left — autopilot takes over.`, 'info');
      schedule(room);
    }
    fixHost(room);
    broadcast(room);
  });

  socket.on('disconnect', () => {
    const c = ctx(socket); if (!c) return;
    const { room, p } = c;
    if (p.socketId !== socket.id) return;
    p.connected = false;
    log(room, `${p.name} disconnected${room.state === 'playing' ? ' — autopilot on until they return' : ''}.`, 'info');
    if (room.state === 'playing') schedule(room);
    broadcast(room);
    setTimeout(() => {
      if (!rooms.has(room.code) || p.connected) return;
      if (room.state === 'lobby') {
        room.players = room.players.filter((x) => x.id !== p.id);
        tokenIndex.delete(p.token);
        fixHost(room); broadcast(room);
      }
    }, 45000);
  });
});

function fixHost(room) {
  const humans = room.players.filter((p) => !p.bot);
  if (!humans.length) { closeRoom(room); return; }
  const host = P(room, room.hostId);
  if (!host || host.bot || !host.connected) {
    const next = humans.find((p) => p.connected) || humans[0];
    if (next.id !== room.hostId) { room.hostId = next.id; log(room, `👑 ${next.name} is now the host.`, 'info'); }
  }
}
function closeRoom(room) {
  clearTimeout(room.timer);
  for (const p of room.players) tokenIndex.delete(p.token);
  rooms.delete(room.code);
}
// sweep empty rooms
setInterval(() => {
  for (const room of rooms.values()) {
    const live = room.players.some((p) => !p.bot && p.connected);
    if (live) room.lastActive = Date.now();
    else if (Date.now() - room.lastActive > 20 * 60 * 1000) closeRoom(room);
  }
}, 60000);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Stack & Snatch running on http://localhost:${PORT}`));

module.exports = { TYPES, validPair };
