/* Stack & Snatch — client */
(function () {
  const { TYPES, fmt, short, face, back, isWild, value } = window.CARDS;
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
  };
  const EMOJIS = ['😎', '🤠', '🦊', '🐷', '🐸', '🦁', '🐼', '👑', '💎', '🚗'];
  const REACTS = ['😂', '😱', '🔥', '😭', '💰', '👀', '😤', '🙏'];

  document.getElementById('defs').innerHTML = CARDS.defs();

  // ---------------- state
  const socket = io({ transports: ['websocket', 'polling'] });
  let S = null;            // latest server state
  let avatars = {};        // pid -> dataURL
  let selected = [];       // selected card ids
  let seenHand = new Set();
  let prevTopKeys = {};    // pid -> top set signature (for pop animation)
  let unread = 0;
  let profile = Object.assign({ name: '', avatar: null, emoji: '😎' }, store.get('ss_profile', {}));
  let titleFlash = null;
  let lastTickSec = null;
  let dlKey = null, dlTotal = 25000, recvAt = Date.now();

  // ---------------- audio unlock on first touch
  const unlock = () => { Sound.init(); updateMusicBtn(); };
  window.addEventListener('pointerdown', unlock, { once: false, passive: true });
  window.addEventListener('keydown', unlock, { once: true });

  // ---------------- helpers
  const me = () => S && S.players.find((p) => p.id === S.me);
  const player = (id) => S && S.players.find((p) => p.id === id);
  const myTurn = () => S && S.state === 'playing' && S.turnId === S.me && !S.challenge;
  const iRespond = () => S && S.challenge && S.challenge.toRespond === S.me;
  function avatarHTML(p, cls = '') {
    if (!p) return `<div class="avatar ${cls}">?</div>`;
    const url = avatars[p.id];
    if (url) return `<div class="avatar ${cls}"><img src="${url}" alt=""></div>`;
    if (p.emoji) return `<div class="avatar ${cls}" style="background:${hue(p.name)}">${p.emoji}</div>`;
    return `<div class="avatar ${cls}" style="background:${hue(p.name)}">${esc((p.name || '?')[0].toUpperCase())}</div>`;
  }
  function hue(str) { let h = 0; for (const c of String(str)) h = (h * 31 + c.charCodeAt(0)) % 360; return `hsl(${h} 55% 40%)`; }
  const cardHTML = (c, cls = '', extra = '') => `<div class="card ${cls}" ${c ? `data-id="${c.id}"` : ''} ${extra}>${c ? face(c.t) : back()}</div>`;
  const miniHTML = (c) => `<div class="card mini">${face(c.t)}</div>`;

  function toast(msg, kind = '') {
    const el = document.createElement('div');
    el.className = 'toast ' + kind; el.innerHTML = msg;
    $('#toasts').appendChild(el);
    setTimeout(() => el.remove(), 3200);
    while ($('#toasts').children.length > 3) $('#toasts').firstChild.remove();
  }
  function banner(text) {
    const b = $('#turnBanner');
    b.textContent = text; b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
  }
  function bigFx(html, cls) {
    $('#bigFx').innerHTML = `<div class="b ${cls}">${html}</div>`;
  }
  function flashTitle(on) {
    clearInterval(titleFlash);
    document.title = 'Stack & Snatch';
    if (!on) return;
    let t = 0;
    titleFlash = setInterval(() => { document.title = (t++ % 2) ? '🔔 YOUR TURN!' : 'Stack & Snatch'; }, 900);
  }
  window.addEventListener('focus', () => { if (!myTurn() && !iRespond()) flashTitle(false); });
  const vibrate = (p) => { try { navigator.vibrate && navigator.vibrate(p); } catch (e) {} };

  // ---------------- profile / avatar upload (center-cropped square so photos never look stretched)
  function readAvatar(file) {
    return new Promise((res, rej) => {
      if (!file || !file.type.startsWith('image/')) return rej(new Error('Please pick an image file.'));
      const fr = new FileReader();
      fr.onload = () => {
        const img = new Image();
        img.onload = () => {
          const N = 192, cv = document.createElement('canvas'); cv.width = cv.height = N;
          const s = Math.min(img.width, img.height);
          cv.getContext('2d').drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, N, N);
          res(cv.toDataURL('image/jpeg', 0.82));
        };
        img.onerror = () => rej(new Error('Could not read that image.'));
        img.src = fr.result;
      };
      fr.readAsDataURL(file);
    });
  }
  function paintProfile() {
    const fake = { name: profile.name || '?', emoji: profile.avatar ? null : profile.emoji };
    for (const sel of ['#avatarPreview', '#avatarPreview2']) {
      const el = $(sel); if (!el) continue;
      el.style.background = hue(fake.name);
      el.innerHTML = profile.avatar ? `<img src="${profile.avatar}" alt="">` : esc(fake.emoji || fake.name[0]);
    }
    $('#clearPhoto').hidden = !profile.avatar;
    $('#emojiRow').innerHTML = EMOJIS.map((e) => `<button type="button" class="${!profile.avatar && profile.emoji === e ? 'on' : ''}" data-e="${e}">${e}</button>`).join('');
  }
  function saveProfile() { store.set('ss_profile', profile); paintProfile(); }
  async function onAvatarFile(e) {
    try { profile.avatar = await readAvatar(e.target.files[0]); saveProfile(); Sound.play('select'); if (S) socket.emit('profile', { avatar: profile.avatar }); }
    catch (err) { toast(err.message, 'bad'); }
    e.target.value = '';
  }
  $('#avatarInput').addEventListener('change', onAvatarFile);
  $('#avatarInput2').addEventListener('change', onAvatarFile);
  $('#emojiRow').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    profile.emoji = b.dataset.e; profile.avatar = null; saveProfile(); Sound.play('click');
  });
  $('#clearPhoto').addEventListener('click', () => { profile.avatar = null; saveProfile(); });
  $('#nameInput').value = profile.name;
  $('#nameInput').addEventListener('input', (e) => { profile.name = e.target.value; saveProfile(); });
  $('#saveProfile').addEventListener('click', () => {
    profile.name = $('#nameInput2').value.trim() || profile.name; saveProfile();
    socket.emit('profile', { name: profile.name, avatar: profile.avatar });
    toast('Profile updated ✅', 'good');
  });
  // the emoji choice is used as the avatar when no photo is uploaded: we send it as a tiny generated image
  function emojiAvatar(emoji, name) {
    const cv = document.createElement('canvas'); cv.width = cv.height = 128;
    const g = cv.getContext('2d');
    g.fillStyle = hue(name || '?'); g.fillRect(0, 0, 128, 128);
    g.font = '78px serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(emoji, 64, 70);
    return cv.toDataURL('image/png');
  }
  const outgoingAvatar = () => profile.avatar || emojiAvatar(profile.emoji || '😎', profile.name);

  // logo fan on home
  $('#logoFan').innerHTML = ['piggy', 'jewels', 'gold', 'home', 'auto'].map((t, i) =>
    `<div class="card" style="transform:translateX(-50%) rotate(${(i - 2) * 14}deg);animation-delay:${i * 0.07}s">${face(t)}</div>`).join('');

  // ---------------- home actions
  function needName() {
    const n = $('#nameInput').value.trim();
    if (!n) { toast('Type your name first 🙂', 'bad'); $('#nameInput').focus(); Sound.play('error'); return null; }
    profile.name = n; saveProfile(); return n;
  }
  function afterJoin(res) {
    if (res.error) { toast(res.error, 'bad'); Sound.play('error'); return false; }
    store.set('ss_session', { token: res.token, code: res.code });
    history.replaceState(null, '', '?room=' + res.code);
    return true;
  }
  $('#createBtn').onclick = () => { const n = needName(); if (!n) return; socket.emit('create', { name: n, avatar: outgoingAvatar() }, afterJoin); };
  $('#joinBtn').onclick = () => {
    const n = needName(); if (!n) return;
    const code = $('#codeInput').value.trim().toUpperCase();
    if (code.length !== 4) { toast('Room codes are 4 letters', 'bad'); return; }
    socket.emit('join', { name: n, avatar: outgoingAvatar(), code }, afterJoin);
  };
  $('#codeInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#joinBtn').click(); });
  $('#practiceBtn').onclick = () => {
    const n = needName(); if (!n) return;
    socket.emit('create', { name: n, avatar: outgoingAvatar() }, (res) => {
      if (!afterJoin(res)) return;
      socket.emit('addBot'); socket.emit('addBot'); socket.emit('addBot');
      setTimeout(() => socket.emit('start'), 400);
    });
  };
  const urlRoom = new URLSearchParams(location.search).get('room');
  if (urlRoom) $('#codeInput').value = urlRoom.toUpperCase();

  // ---------------- lobby actions
  $('#copyLink').onclick = async () => {
    const link = location.origin + location.pathname + '?room=' + S.code;
    try { await navigator.clipboard.writeText(link); toast('Invite link copied! 📋', 'good'); }
    catch (e) { prompt('Copy this link:', link); }
  };
  const leave = () => { socket.emit('leave'); store.set('ss_session', null); S = null; history.replaceState(null, '', location.pathname); closeModals(); showScreen('home'); setChat(false); };
  $('#leaveLobby').onclick = leave;
  $('#leaveGame').onclick = () => { if (confirm('Leave this game? A bot autopilot will play your seat.')) leave(); };
  $('#addBot').onclick = () => socket.emit('addBot');
  $('#startBtn').onclick = () => socket.emit('start');
  for (const id of ['#setHand', '#setTarget', '#setTimer']) {
    $(id).addEventListener('change', () => socket.emit('settings', { handSize: $('#setHand').value, target: $('#setTarget').value, turnTimer: $('#setTimer').value }));
  }
  $('#lobbyPlayers').addEventListener('click', (e) => { const k = e.target.closest('[data-kick]'); if (k) socket.emit('kick', k.dataset.kick); });

  // ---------------- modals
  function closeModals() { $$('.modal').forEach((m) => m.classList.add('hidden')); }
  document.addEventListener('click', (e) => {
    const o = e.target.closest('[data-open]'); if (o) { $('#' + o.dataset.open).classList.remove('hidden'); prepModal(o.dataset.open); Sound.play('click'); }
    if (e.target.closest('[data-close]') || e.target.classList.contains('modal')) { if (e.target.closest('#resultsModal')) return; closeModals(); }
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModals(); });
  function prepModal(id) {
    if (id === 'rulesModal') {
      $('#valueTable').innerHTML = Object.entries(TYPES).map(([t, d]) => `<div class="vt">${cardHTML({ t, id: 'v' + t })}${d.wild ? 'WILD' : ''}</div>`).join('');
    }
    if (id === 'settingsModal') {
      $('#musicOn').checked = Sound.cfg.musicOn; $('#sfxOn').checked = Sound.cfg.sfxOn;
      $('#musicVol').value = Sound.cfg.music; $('#sfxVol').value = Sound.cfg.sfx;
      $('#nameInput2').value = profile.name; paintProfile();
    }
  }
  $('#musicOn').onchange = (e) => { Sound.init(); Sound.set('musicOn', e.target.checked); updateMusicBtn(); };
  $('#sfxOn').onchange = (e) => Sound.set('sfxOn', e.target.checked);
  $('#musicVol').oninput = (e) => Sound.set('music', +e.target.value);
  $('#sfxVol').oninput = (e) => { Sound.set('sfx', +e.target.value); Sound.play('click'); };
  $('#musicBtn').onclick = () => { Sound.init(); Sound.set('musicOn', !Sound.cfg.musicOn); updateMusicBtn(); };
  function updateMusicBtn() { $('#musicBtn').classList.toggle('off', !Sound.cfg.musicOn); $('#musicBtn').title = Sound.cfg.musicOn ? 'Music on' : 'Music off'; }
  updateMusicBtn();

  // ---------------- chat
  function setChat(open) {
    document.body.classList.toggle('chat-open', open);
    $('#chat').classList.toggle('hidden', !open);
    if (open) { unread = 0; paintUnread(); $('#chatMsgs').scrollTop = 1e9; }
  }
  const chatOpen = () => document.body.classList.contains('chat-open');
  function paintUnread() { $('#unread').textContent = unread; $('#unread').classList.toggle('hidden', !unread); }
  $('#chatToggle').onclick = () => setChat(!chatOpen());
  $('#chatClose').onclick = () => setChat(false);
  $('#chatForm').onsubmit = (e) => {
    e.preventDefault();
    const t = $('#chatInput').value.trim(); if (!t) return;
    socket.emit('chat', t); $('#chatInput').value = '';
  };
  $('#reactRow').innerHTML = REACTS.map((r) => `<button type="button" data-r="${r}">${r}</button>`).join('');
  $('#reactRow').onclick = (e) => { const b = e.target.closest('button'); if (b) socket.emit('react', b.dataset.r); };
  function addMsg(m) {
    const p = player(m.pid) || { id: m.pid, name: m.name };
    const mine = S && m.pid === S.me;
    const el = document.createElement('div');
    el.className = 'msg' + (mine ? ' mine' : '');
    el.innerHTML = `${avatarHTML(p, 'sm')}<div class="bubble"><div class="who">${esc(m.name)}</div>${esc(m.text)}</div>`;
    const box = $('#chatMsgs'); const atBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 60;
    box.appendChild(el);
    while (box.children.length > 120) box.firstChild.remove();
    if (atBottom || mine) box.scrollTop = 1e9;
  }
  socket.on('chatHistory', (list) => { $('#chatMsgs').innerHTML = ''; list.forEach(addMsg); });
  socket.on('chat', (m) => {
    addMsg(m);
    if (S && m.pid !== S.me) {
      Sound.play('chat');
      if (!chatOpen()) { unread++; paintUnread(); toast(`💬 <b>${esc(m.name)}:</b> ${esc(m.text.slice(0, 60))}`); }
    }
  });
  socket.on('react', ({ pid, emoji }) => {
    Sound.play('react');
    const anchor = document.querySelector(`[data-seat="${pid}"]`) || $('#meInfo');
    const r = anchor ? anchor.getBoundingClientRect() : { left: innerWidth / 2, top: innerHeight / 2, width: 0 };
    const el = document.createElement('div');
    el.className = 'float-emoji'; el.textContent = emoji;
    el.style.left = (r.left + r.width / 2 - 17 + (Math.random() * 30 - 15)) + 'px'; el.style.top = (r.top + 10) + 'px';
    document.body.appendChild(el); setTimeout(() => el.remove(), 1900);
  });

  // ---------------- socket lifecycle
  socket.on('connect', () => {
    const sess = store.get('ss_session', null);
    if (sess && sess.token) socket.emit('rejoin', sess, (res) => { if (!res.ok) { store.set('ss_session', null); showScreen('home'); } });
  });
  socket.on('disconnect', () => toast('Connection lost — reconnecting…', 'bad'));
  socket.on('toast', (m) => toast(esc(m), 'bad'));
  socket.on('kicked', () => { store.set('ss_session', null); S = null; showScreen('home'); toast('You were removed from the room.', 'bad'); });
  socket.on('avatars', (map) => { avatars = map; if (S) render(); });
  socket.on('state', (st) => {
    const prev = S; S = st; recvAt = Date.now();
    onTransition(prev, st);
    render();
  });
  socket.on('fx', onFx);

  function onTransition(prev, st) {
    // drop selections that left the hand
    const ids = new Set(st.hand.map((c) => c.id));
    selected = selected.filter((id) => ids.has(id));
    if (!prev || prev.state !== st.state) {
      if (st.state === 'playing' && (!prev || prev.state !== 'playing')) { seenHand = new Set(); prevTopKeys = {}; closeModals(); }
      if (st.state === 'roundend' || st.state === 'gameover') showResults();
      if (st.state === 'lobby') closeModals();
    }
    const wasMine = prev && prev.state === 'playing' && prev.turnId === prev.me && !prev.challenge;
    if (myTurn() && !wasMine) {
      banner('YOUR TURN!'); Sound.play('yourTurn'); vibrate([60, 40, 60]);
      if (document.hidden || !document.hasFocus()) flashTitle(true);
    }
    if (!myTurn() && !iRespond()) flashTitle(false);
    const wasResp = prev && prev.challenge && prev.challenge.toRespond === prev.me;
    if (iRespond() && !wasResp) {
      const ch = st.challenge;
      const other = player(ch.attacker === st.me ? ch.defender : ch.attacker);
      banner(ch.defender === st.me ? 'DEFEND!' : 'FIGHT BACK!');
      vibrate([100, 50, 100]);
      if (document.hidden) flashTitle(true);
      // auto-select if exactly one valid card
      const valid = st.hand.filter((c) => isWild(c) || c.t === ch.type);
      selected = valid.length === 1 ? [valid[0].id] : [];
      if (!valid.length) toast(`No ${TYPES[ch.type].name} or wilds — ${esc(other.name)} takes it…`);
    }
  }

  function onFx(e) {
    if (!S) return;
    const name = (id) => esc((player(id) || {}).name || '?');
    switch (e.k) {
      case 'deal': Sound.play('deal'); break;
      case 'set': Sound.play('set'); break;
      case 'discard': Sound.play('discard'); break;
      case 'join': Sound.play('join'); break;
      case 'challenge':
        Sound.play('challenge');
        if (e.def === S.me) toast(`⚔️ <b>${name(e.att)}</b> is coming for your ${TYPES[e.type].name}!`, 'bad');
        break;
      case 'counter': Sound.play('counter'); break;
      case 'steal':
        if (e.winner === S.me) { Sound.play('steal'); bigFx(`SNATCHED!<small>+${fmt(e.value)} ${TYPES[e.type].name}</small>`, 'steal'); confetti(60); }
        else if (e.loser === S.me) { Sound.play('robbed'); bigFx(`ROBBED!<small>${name(e.winner)} took your ${TYPES[e.type].name}</small>`, 'steal'); vibrate(250); }
        else { Sound.play('steal'); bigFx(`STOLEN!<small>${name(e.winner)} took ${name(e.loser)}'s ${TYPES[e.type].name}</small>`, 'steal'); }
        break;
      case 'defended':
        Sound.play('defended');
        bigFx(`DEFENDED!<small>${name(e.winner)} kept the ${TYPES[e.type].name} · ${fmt(e.value)}</small>`, 'def');
        break;
      case 'roundend': Sound.play('roundEnd'); break;
      case 'win': Sound.play('win'); confetti(e.pid === S.me ? 260 : 120); break;
    }
  }

  // ---------------- rendering
  function showScreen(id) {
    for (const s of ['home', 'lobby', 'game']) $('#' + s).classList.toggle('hidden', s !== id);
    document.body.classList.toggle('in-game', id === 'game');
    if (id !== 'game') document.body.classList.remove('my-turn');
  }
  function render() {
    if (!S) { showScreen('home'); paintProfile(); return; }
    if (S.state === 'lobby') { showScreen('lobby'); renderLobby(); }
    else { showScreen('game'); renderGame(); }
  }

  function renderLobby() {
    $('#lobbyCode').textContent = S.code;
    const isHost = S.hostId === S.me;
    $('#playerCount').textContent = `(${S.players.length}/6)`;
    let html = S.players.map((p) => `<div class="lp">${avatarHTML(p)}<div style="min-width:0;flex:1"><div class="nm">${esc(p.name)}${p.id === S.me ? ' (you)' : ''}</div>
      <div class="tagx">${p.id === S.hostId ? '👑 Host' : p.bot ? '🤖 Bot' : p.connected ? 'Ready' : '⚠️ Reconnecting…'}</div></div>
      ${isHost && p.id !== S.me ? `<button class="kick" title="Remove" data-kick="${p.id}">✕</button>` : ''}</div>`).join('');
    for (let i = S.players.length; i < Math.max(4, S.players.length); i++) html += `<div class="lp empty">Open seat</div>`;
    $('#lobbyPlayers').innerHTML = html;
    $('#hostControls').classList.toggle('hidden', !isHost);
    $('#waitHost').classList.toggle('hidden', isHost);
    $('#setHand').value = S.settings.handSize; $('#setTarget').value = S.settings.target; $('#setTimer').value = S.settings.turnTimer;
    $('#addBot').disabled = S.players.length >= 6;
    $('#startBtn').disabled = S.players.length < 2;
    $('#startBtn').textContent = S.players.length < 2 ? 'Need 2+ players (add a bot!)' : `▶ Start Game (${S.players.length} players)`;
    if (!chatOpen() && innerWidth >= 1100 && !store.get('ss_chatClosed', false)) setChat(true);
  }

  function stackHTML(p, opts = {}) {
    if (!p.stack.length) return `<div class="stack empty">No sets yet</div>`;
    const top = p.stack[p.stack.length - 1];
    const key = p.stack.length + ':' + top.cards.map((c) => c.id).join(',');
    const fresh = prevTopKeys[p.id] !== undefined && prevTopKeys[p.id] !== key;
    prevTopKeys[p.id] = key;
    const under = p.stack.length - 1;
    const underHTML = under ? `<div class="under">${Array.from({ length: Math.min(under, 4) }, (_, i) => `<i style="transform:translate(${i * 3}px,${-i * 2}px) rotate(${i % 2 ? 90 : 84}deg)"></i>`).join('')}<b>+${under}</b></div>` : '';
    const safe = p.stack.length < 2 ? `<span class="lock" title="A player's first set can't be stolen">🔒 safe</span>` : '';
    return `<div class="stack" data-stack="${p.id}">${underHTML}<div class="top ${fresh ? 'fresh' : ''}">${top.cards.map(miniHTML).join('')}</div>
      <span class="val">${short(top.value)}</span>${safe}</div>`;
  }

  function stealTargetsFor(card) {
    const m = me(); if (!m || !card || m.stack.length < 1) return [];
    return S.players.filter((q) => q.id !== m.id && q.stack.length >= 2 && (isWild(card) || q.stack[q.stack.length - 1].type === card.t));
  }

  function renderGame() {
    const m = me();
    const ch = S.challenge;
    document.body.classList.toggle('my-turn', myTurn() || iRespond());
    $('#tbRoom').textContent = 'Room ' + S.code;
    $('#tbRound').textContent = 'Round ' + S.round + (S.settings.target ? ` · to ${short(S.settings.target)}` : ' · single round');
    const cp = player(S.turnId);
    $('#turnStrip').innerHTML = S.state !== 'playing' ? 'Round over'
      : ch ? `⚔️ ${esc(player(ch.attacker).name)} vs ${esc(player(ch.defender).name)}`
      : S.turnId === S.me ? `<span class="me">⭐ Your turn — make a move!</span>` : `${esc(cp ? cp.name : '')}'s turn…`;

    // opponents in turn order starting after me
    const idx = S.players.findIndex((p) => p.id === S.me);
    const others = S.players.slice(idx + 1).concat(S.players.slice(0, idx));
    const selCard = selected.length === 1 ? S.hand.find((c) => c.id === selected[0]) : null;
    const targets = myTurn() && selCard ? new Set(stealTargetsFor(selCard).map((q) => q.id)) : new Set();
    $('#opponents').innerHTML = others.map((p) => {
      const turn = S.turnId === p.id && S.state === 'playing';
      return `<div class="seat ${turn ? 'turn' : ''} ${targets.has(p.id) ? 'stealable' : ''} ${p.connected ? '' : 'offline'}" data-seat="${p.id}">
        <div class="seat-head">${avatarHTML(p)}<div class="nm">${esc(p.name)}</div>${p.bot ? '🤖' : ''}${!p.connected && !p.bot ? '<span title="Offline — autopilot">📴</span>' : ''}${p.id === S.hostId ? '👑' : ''}</div>
        ${turn ? `<div class="thinking">${ch ? 'in a showdown…' : 'thinking…'} <span data-cd></span></div>` : ''}
        <div class="seat-hand">${'<i></i>'.repeat(p.handCount)}</div>
        ${stackHTML(p)}
        <div class="score-line"><span>Stack <b>${short(p.stackValue)}</b></span><span>Bank <b>${short(p.total)}</b></span></div>
        ${targets.has(p.id) ? `<button class="btn sm steal" style="width:100%;margin-top:6px" data-steal="${p.id}">🦹 Steal this!</button>` : ''}
      </div>`;
    }).join('');

    // piles
    $('#deckCard').innerHTML = back();
    $('#deckCount').textContent = S.deckCount;
    $('#deckCard').style.opacity = S.deckCount ? 1 : 0.25;
    const top = S.discardTop;
    $('#discardCard').innerHTML = top ? face(top.t) : '';
    $('#discardCard').classList.toggle('slot', !top);
    const discardMatch = myTurn() && top && !isWild(top) && S.hand.some((c) => c.t === top.t);
    $('#discardCard').classList.toggle('glow', !!discardMatch);
    $('#discardCard').title = discardMatch ? 'Tap to pair this with your matching card' : '';

    // log
    $('#logList').innerHTML = S.log.slice(-6).map((l) => `<li class="${l.kind}">${esc(l.text)}</li>`).join('');

    // arena
    renderArena();

    // me
    $('#meInfo').innerHTML = `${avatarHTML(m, 'lg')}<div><div class="nm">${esc(m.name)} ${S.hostId === m.id ? '👑' : ''}</div>
      <div class="money">${fmt(m.stackValue)} <span class="muted" style="font-size:13px">this round · ${fmt(m.total)} banked</span></div></div>${stackHTML(m)}`;

    renderHand();
    renderActions();
  }

  function renderArena() {
    const ch = S.challenge, el = $('#arena');
    if (!ch) { el.classList.add('hidden'); el.innerHTML = ''; return; }
    el.classList.remove('hidden');
    const att = player(ch.attacker), def = player(ch.defender);
    const pot = ch.setCards.concat(ch.played.map((x) => x.card)).reduce((a, c) => a + value(c), 0);
    const resp = player(ch.toRespond);
    const mine = ch.toRespond === S.me;
    el.innerHTML = `
      <div class="vs"><div class="side ${ch.toRespond === att.id ? 'active' : ''}">${avatarHTML(att)}<span>${esc(att.name)}</span></div>
        <span class="swords">⚔️</span>
        <div class="side ${ch.toRespond === def.id ? 'active' : ''}"><span>${esc(def.name)}</span>${avatarHTML(def)}</div></div>
      <div class="battle"><div class="prize">${ch.setCards.map(miniHTML).join('')}</div>
        <div class="played">${ch.played.map((x) => `<div class="pc">${miniHTML(x.card)}<span>${esc(player(x.pid).name.split(' ')[0])}</span></div>`).join('')}</div></div>
      <div class="status ${mine ? 'me' : ''}">${mine
        ? `Play a ${TYPES[ch.type].name} or a wild to ${ch.defender === S.me ? 'keep' : 'take'} it — or give up.`
        : `Waiting for ${esc(resp.name)} to answer…`} &nbsp;Pot: <b>${fmt(pot)}</b></div>
      <div class="timerbar"><i data-bar></i></div>`;
  }

  function cardHints() {
    // which hand cards can pair / steal right now
    const hints = {};
    if (!myTurn()) return hints;
    const m = me(), top = S.discardTop;
    const count = {}; let wilds = 0;
    for (const c of S.hand) { if (isWild(c)) wilds++; else count[c.t] = (count[c.t] || 0) + 1; }
    const nonWild = S.hand.some((c) => !isWild(c));
    for (const c of S.hand) {
      const h = {};
      if (isWild(c)) h.pair = nonWild;
      else h.pair = count[c.t] >= 2 || wilds > 0 || (top && !isWild(top) && top.t === c.t);
      h.steal = stealTargetsFor(c).length > 0 && m.stack.length >= 1;
      hints[c.id] = h;
    }
    return hints;
  }

  function renderHand() {
    const ch = S.challenge;
    const hints = cardHints();
    const sorted = S.hand.slice().sort((a, b) => (isWild(a) - isWild(b)) || value(a) - value(b) || a.t.localeCompare(b.t));
    $('#hand').innerHTML = sorted.map((c) => {
      const cls = [];
      if (selected.includes(c.id)) cls.push('sel');
      if (!seenHand.has(c.id)) cls.push('new');
      if (ch && iRespond()) cls.push(isWild(c) || c.t === ch.type ? 'valid' : 'dim');
      const h = hints[c.id] || {};
      const chips = (h.pair ? '<span class="chip pair">PAIR</span>' : '') + (h.steal ? '<span class="chip steal">STEAL</span>' : '');
      return `<div class="card ${cls.join(' ')}" data-id="${c.id}" title="${TYPES[c.t].name} · ${fmt(value(c))}">${chips}${face(c.t)}</div>`;
    }).join('');
    S.hand.forEach((c) => seenHand.add(c.id));
  }

  function renderActions() {
    const bar = $('#actionBar');
    const ch = S.challenge;
    const sel = selected.map((id) => S.hand.find((c) => c.id === id)).filter(Boolean);
    if (S.state !== 'playing') { bar.innerHTML = `<div class="hint">Round over — totals coming up…</div>`; return; }
    if (ch) {
      if (iRespond()) {
        const c = sel[0];
        const ok = c && (isWild(c) || c.t === ch.type);
        bar.innerHTML = `${ok ? `<button class="btn primary big" data-act="counter">🛡️ Play ${TYPES[c.t].name}</button>` : `<div class="hint">Tap a glowing card to fight back</div>`}
          <button class="btn ghost" data-act="giveup">🏳️ Give up</button> <span class="hint" data-cd></span>`;
      } else bar.innerHTML = `<div class="hint">Showdown in progress… <span data-cd></span></div>`;
      return;
    }
    if (!myTurn()) {
      const cp = player(S.turnId);
      bar.innerHTML = `<div class="hint">Waiting for <b>${esc(cp ? cp.name : '')}</b>… <span data-cd></span> &nbsp;You can plan by tapping your cards.</div>`;
      return;
    }
    const m = me(), top = S.discardTop;
    const btns = [];
    if (sel.length === 2) {
      const [a, b] = sel;
      const okPair = !(isWild(a) && isWild(b)) && (isWild(a) || isWild(b) || a.t === b.t);
      if (okPair) btns.push(`<button class="btn primary big" data-act="pair">📥 Stack this set · ${fmt(value(a) + value(b))}</button>`);
      else btns.push(`<div class="hint">${isWild(a) && isWild(b) ? "Two wilds can't make a set — pair a wild with an asset." : "Those don't match. Pick two of the same, or an asset + a wild."}</div>`);
    } else if (sel.length === 1) {
      const c = sel[0];
      if (top && !isWild(top) && !isWild(c) && top.t === c.t) btns.push(`<button class="btn primary" data-act="discardPair">♻️ Pair with discard · ${fmt(value(c) * 2)}</button>`);
      const tg = stealTargetsFor(c);
      for (const q of tg.slice(0, 5)) { const s = q.stack[q.stack.length - 1]; btns.push(`<button class="btn steal" data-steal="${q.id}">🦹 Steal ${esc(q.name.split(' ')[0])}'s ${TYPES[s.type].short} · ${short(s.value)}</button>`); }
      if (!tg.length && m.stack.length >= 1 && !isWild(c)) { /* no hint spam */ }
      btns.push(`<button class="btn" data-act="discard">🗑️ Discard</button>`);
      if (m.stack.length < 1 && S.players.some((q) => q.id !== m.id && q.stack.length >= 2)) btns.push(`<span class="hint">Make your first set before you can steal.</span>`);
    } else {
      btns.push(`<div class="hint"><b>Your move:</b> tap 2 cards to make a set, or 1 card to steal / discard. <span data-cd></span></div>`);
    }
    if (sel.length) btns.push(`<button class="btn ghost sm" data-act="clear">✕</button>`);
    bar.innerHTML = btns.join('');
  }

  // ---------------- interaction
  function act(payload) {
    socket.emit('action', payload, (res) => { if (res && res.error) { toast(esc(res.error), 'bad'); Sound.play('error'); } else { selected = []; flashTitle(false); } });
  }
  $('#hand').addEventListener('click', (e) => {
    const el = e.target.closest('.card'); if (!el || !S) return;
    const id = +el.dataset.id;
    if (iRespond()) {
      const c = S.hand.find((h) => h.id === id), ch = S.challenge;
      if (!(isWild(c) || c.t === ch.type)) { toast(`You need a ${TYPES[ch.type].name} or a wild`, 'bad'); Sound.play('error'); return; }
      selected = selected[0] === id ? [] : [id];
    } else if (selected.includes(id)) selected = selected.filter((x) => x !== id);
    else { selected.push(id); if (selected.length > 2) selected.shift(); }
    Sound.play('select');
    renderGame();
  });
  $('#hand').addEventListener('dblclick', (e) => {
    // double-tap a card that has a twin -> instantly select both
    const el = e.target.closest('.card'); if (!el || !myTurn()) return;
    const c = S.hand.find((h) => h.id === +el.dataset.id); if (!c || isWild(c)) return;
    const twin = S.hand.find((h) => h.id !== c.id && h.t === c.t);
    if (twin) { selected = [c.id, twin.id]; renderGame(); }
  });
  $('#actionBar').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b || !S) return;
    if (b.dataset.steal) return act({ kind: 'challenge', target: b.dataset.steal, card: selected[0] });
    switch (b.dataset.act) {
      case 'pair': return act({ kind: 'pair', cards: selected.slice(0, 2) });
      case 'discardPair': return act({ kind: 'discardPair', card: selected[0] });
      case 'discard': return act({ kind: 'discard', card: selected[0] });
      case 'clear': selected = []; return renderGame();
      case 'counter': return socket.emit('respond', selected[0], (r) => { if (r.error) toast(esc(r.error), 'bad'); selected = []; flashTitle(false); });
      case 'giveup': return socket.emit('respond', null, () => { selected = []; flashTitle(false); });
    }
  });
  $('#opponents').addEventListener('click', (e) => {
    const s = e.target.closest('[data-steal]');
    if (s) return act({ kind: 'challenge', target: s.dataset.steal, card: selected[0] });
    const seat = e.target.closest('.seat.stealable');
    if (seat) return act({ kind: 'challenge', target: seat.dataset.seat, card: selected[0] });
    const st = e.target.closest('[data-stack]'); if (st) openStack(st.dataset.stack);
  });
  $('#meInfo').addEventListener('click', (e) => { const st = e.target.closest('[data-stack]'); if (st) openStack(st.dataset.stack); });
  $('#discardCard').addEventListener('click', () => {
    if (!myTurn() || !S.discardTop) return;
    const top = S.discardTop;
    const match = S.hand.find((c) => !isWild(c) && !isWild(top) && c.t === top.t);
    if (match) act({ kind: 'discardPair', card: match.id });
  });
  document.addEventListener('keydown', (e) => {
    if (!S || S.state !== 'playing' || e.target.matches('input,textarea,select')) return;
    const n = parseInt(e.key, 10);
    if (n >= 1 && n <= 9) { const el = $$('#hand .card')[n - 1]; if (el) el.click(); }
    if (e.key === 'Enter') { const b = $('#actionBar .btn.primary, #actionBar .btn.steal'); if (b) b.click(); }
  });

  function openStack(pid) {
    const p = player(pid); if (!p) return;
    const sets = p.stack.slice().reverse();
    $('#stackModalBody').innerHTML = `<h2>${esc(p.name)}'s stack · ${fmt(p.stackValue)}</h2>
      ${sets.length ? `<div class="set-list">${sets.map((s, i) => `<div class="set-row ${i === 0 && p.stack.length >= 2 ? 'top' : ''}">
        <div class="cards">${s.cards.map(miniHTML).join('')}</div>
        <div class="info">${TYPES[s.type].name}<small>${s.cards.length} cards · ${i === 0 ? (p.stack.length >= 2 ? '⚠️ on top — can be stolen' : '🔒 first set — safe') : i === sets.length - 1 ? '🔒 first set — safe' : 'covered — safe for now'}</small></div>
        <div class="money" style="font-family:Fredoka;color:var(--gold);font-size:18px">${fmt(s.value)}</div></div>`).join('')}</div>` : '<p class="muted">No sets yet.</p>'}`;
    $('#stackModal').classList.remove('hidden');
  }

  function showResults() {
    const res = S.results; if (!res) return;
    const over = S.state === 'gameover';
    const target = S.settings.target;
    const isHost = S.hostId === S.me;
    const winner = player(S.winnerId);
    $('#resultsBody').innerHTML = `
      <h2 style="text-align:center">${over ? `🏆 ${esc(winner.name)} wins!` : `Round ${S.round} results`}</h2>
      ${over ? `<p class="center">${winner.id === S.me ? 'You are the first millionaire! 💰' : 'Better luck next time — rematch?'}</p>` : ''}
      <div class="results-list">${S.players.slice().sort((a, b) => b.total - a.total).map((p, i) => {
        const r = res.find((x) => x.id === p.id) || { score: 0 };
        const pct = target ? Math.min(100, (p.total / target) * 100) : 100 * (p.total / Math.max(1, res[0].total));
        return `<div class="res ${over && p.id === S.winnerId ? 'winner' : ''}"><div class="rank">${['🥇', '🥈', '🥉'][i] || i + 1}</div>${avatarHTML(p)}
          <div><div class="nm">${esc(p.name)}${p.id === S.me ? ' (you)' : ''}</div><div class="bar"><i style="width:${pct.toFixed(1)}%"></i></div></div>
          <div class="amt">${fmt(p.total)}<small>+${fmt(r.score)} this round</small></div></div>`;
      }).join('')}</div>
      <div class="center">${isHost
        ? (over ? `<button class="btn big primary" id="rematch">🔁 Back to lobby for a rematch</button>` : `<button class="btn big primary" id="nextRound">▶ Deal round ${S.round + 1}</button>`)
        : `<p class="muted">Waiting for the host to ${over ? 'start a rematch' : 'deal the next round'}…</p>`}
        ${target && !over ? `<p class="muted">First to ${fmt(target)} wins.</p>` : ''}</div>`;
    $('#resultsModal').classList.remove('hidden');
    const nr = $('#nextRound'); if (nr) nr.onclick = () => socket.emit('nextRound');
    const rm = $('#rematch'); if (rm) rm.onclick = () => socket.emit('backToLobby');
  }

  // ---------------- countdowns
  setInterval(() => {
    const bar = $('[data-bar]');
    if (!S || !S.deadline || S.state !== 'playing') {
      $$('[data-cd]').forEach((e) => (e.textContent = ''));
      if (bar) bar.parentElement.style.visibility = 'hidden';
      return;
    }
    if (S.deadline !== dlKey) { dlKey = S.deadline; dlTotal = Math.max(1000, S.deadline - S.now); }
    const left = Math.max(0, S.deadline - S.now - (Date.now() - recvAt));
    const sec = Math.ceil(left / 1000);
    $$('[data-cd]').forEach((e) => (e.textContent = `⏱ ${sec}s`));
    if (bar) { bar.parentElement.style.visibility = 'visible'; bar.style.width = Math.min(100, (left / dlTotal) * 100) + '%'; }
    if ((myTurn() || iRespond()) && sec <= 5 && sec > 0 && sec !== lastTickSec) { Sound.play('tick'); lastTickSec = sec; }
  }, 250);

  // ---------------- confetti
  function confetti(n) {
    const cv = $('#confetti'), g = cv.getContext('2d');
    cv.width = innerWidth; cv.height = innerHeight;
    const cols = ['#f6c945', '#ff5a5f', '#5fe0cf', '#ffffff', '#7fd39a', '#b79cf0'];
    const parts = Array.from({ length: n }, () => ({ x: innerWidth / 2 + (Math.random() - 0.5) * 200, y: innerHeight * 0.45, vx: (Math.random() - 0.5) * 14, vy: -Math.random() * 14 - 4, s: 5 + Math.random() * 7, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4, c: cols[(Math.random() * cols.length) | 0], dollar: Math.random() < 0.25 }));
    let frames = 0;
    (function loop() {
      g.clearRect(0, 0, cv.width, cv.height);
      for (const p of parts) {
        p.vy += 0.35; p.x += p.vx; p.y += p.vy; p.r += p.vr; p.vx *= 0.99;
        g.save(); g.translate(p.x, p.y); g.rotate(p.r); g.fillStyle = p.c;
        if (p.dollar) { g.font = 'bold 20px Fredoka'; g.fillText('$', 0, 0); } else g.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2);
        g.restore();
      }
      if (++frames < 150) requestAnimationFrame(loop); else g.clearRect(0, 0, cv.width, cv.height);
    })();
  }

  window.addEventListener('resize', () => { if (S && S.state !== 'lobby') renderGame(); });
  $('#chatClose').addEventListener('click', () => store.set('ss_chatClosed', true));
  $('#chatToggle').addEventListener('click', () => store.set('ss_chatClosed', !chatOpen()));
  paintProfile();
  render();
})();
