// Original card artwork for Stack & Snatch — all hand-built SVG so it scales crisply at any size.
(function () {
  const TYPES = {
    piggy:    { name: 'Piggy Bank',              short: 'Piggy Bank',   value: 5000,  c1: '#ff8fb8', c2: '#d94f86', bg: '#ffe3ee' },
    cash:     { name: 'Cash Under the Mattress', short: 'Mattress Cash', value: 5000, c1: '#7fd39a', c2: '#2d8a52', bg: '#e4f7ea' },
    stamps:   { name: 'Stamp Collection',        short: 'Stamps',       value: 5000,  c1: '#b79cf0', c2: '#6c4bb8', bg: '#efe8ff' },
    baseball: { name: 'Baseball Cards',          short: 'Baseball Cards', value: 5000, c1: '#ff8a7a', c2: '#c0392b', bg: '#ffe7e3' },
    stocks:   { name: 'Stocks',                  short: 'Stocks',       value: 10000, c1: '#6fb3f2', c2: '#1f62a8', bg: '#e3f0ff' },
    coins:    { name: 'Coin Collection',         short: 'Coins',        value: 10000, c1: '#f2c96b', c2: '#a8741a', bg: '#fff3d6' },
    bank:     { name: 'Bank Account',            short: 'Bank Account', value: 10000, c1: '#8fa6bf', c2: '#3b5068', bg: '#e8eef5' },
    auto:     { name: 'Classic Auto',            short: 'Classic Auto', value: 15000, c1: '#ffab6b', c2: '#c4581b', bg: '#ffeedd' },
    jewels:   { name: 'Jewels',                  short: 'Jewels',       value: 15000, c1: '#5fe0cf', c2: '#13887a', bg: '#dffaf6' },
    home:     { name: 'Home',                    short: 'Home',         value: 20000, c1: '#c49a7a', c2: '#7a4e32', bg: '#f7ece3' },
    silver:   { name: 'Silver',                  short: 'Silver',       value: 25000, c1: '#e3e8ee', c2: '#7d8794', bg: '#f3f5f8', wild: true },
    gold:     { name: 'Gold',                    short: 'Gold',         value: 50000, c1: '#ffe27a', c2: '#c48a00', bg: '#fff6d1', wild: true },
  };
  const fmt = (n) => '$' + n.toLocaleString('en-US');
  const short = (n) => (n >= 1000000 ? (n / 1000000).toFixed(n % 1000000 ? 2 : 0) + 'M' : n >= 1000 ? Math.round(n / 1000) + 'K' : n);

  // ---- shared <defs>, injected once
  function defs() {
    let g = '';
    for (const [k, t] of Object.entries(TYPES)) {
      g += `<linearGradient id="fr-${k}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${t.c1}"/><stop offset="1" stop-color="${t.c2}"/></linearGradient>`;
    }
    return `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>${g}
      <linearGradient id="goldbar" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff1a8"/><stop offset=".5" stop-color="#f5c518"/><stop offset="1" stop-color="#b8860b"/></linearGradient>
      <linearGradient id="goldtop" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ffe680"/><stop offset="1" stop-color="#fff8d0"/></linearGradient>
      <linearGradient id="silverbar" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".5" stop-color="#c9d0d8"/><stop offset="1" stop-color="#7d8794"/></linearGradient>
      <linearGradient id="silvertop" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#e6ebf0"/><stop offset="1" stop-color="#ffffff"/></linearGradient>
      <linearGradient id="gem" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#d6fffb"/><stop offset=".5" stop-color="#5fe0cf"/><stop offset="1" stop-color="#13887a"/></linearGradient>
      <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8fd3ff"/><stop offset="1" stop-color="#e6f7ff"/></linearGradient>
      <linearGradient id="back" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#155c43"/><stop offset="1" stop-color="#0a2e22"/></linearGradient>
      <pattern id="backpat" width="22" height="22" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width="22" height="22" fill="none"/><path d="M0 11h22M11 0v22" stroke="#d4af37" stroke-opacity=".18" stroke-width="2"/></pattern>
      <radialGradient id="coin" cx=".35" cy=".35" r=".8"><stop offset="0" stop-color="#fff3b0"/><stop offset=".6" stop-color="#f2c230"/><stop offset="1" stop-color="#b8860b"/></radialGradient>
    </defs></svg>`;
  }

  // ---- illustrations, drawn in a 200x170 box
  const art = {
    piggy: () => `
      <circle cx="100" cy="34" r="17" fill="url(#coin)" stroke="#a8741a" stroke-width="3"/>
      <text x="100" y="41" text-anchor="middle" font-size="20" font-weight="800" fill="#8a5a00" font-family="Fredoka,Arial">$</text>
      <path d="M36 100 q-16 -4 -12 -18 q8 -8 12 4" fill="none" stroke="#c2577f" stroke-width="4" stroke-linecap="round"/>
      <rect x="58" y="128" width="18" height="26" rx="6" fill="#f48fb6" stroke="#c2577f" stroke-width="4"/>
      <rect x="120" y="128" width="18" height="26" rx="6" fill="#f48fb6" stroke="#c2577f" stroke-width="4"/>
      <ellipse cx="98" cy="104" rx="64" ry="46" fill="#f9a8c8" stroke="#c2577f" stroke-width="4"/>
      <path d="M66 70 L72 44 L92 64 Z" fill="#f48fb6" stroke="#c2577f" stroke-width="4" stroke-linejoin="round"/>
      <rect x="84" y="60" width="30" height="7" rx="3.5" fill="#c2577f"/>
      <ellipse cx="160" cy="108" rx="17" ry="14" fill="#f48fb6" stroke="#c2577f" stroke-width="4"/>
      <circle cx="154" cy="108" r="3.2" fill="#8a2f55"/><circle cx="166" cy="108" r="3.2" fill="#8a2f55"/>
      <circle cx="136" cy="88" r="5.5" fill="#3a2230"/><circle cx="138" cy="86" r="1.8" fill="#fff"/>
      <ellipse cx="70" cy="96" rx="14" ry="8" fill="#fff" opacity=".35"/>`,
    cash: () => {
      const bill = (x, y, r) => `<g transform="translate(${x} ${y}) rotate(${r})">
        <rect x="-30" y="-17" width="60" height="34" rx="4" fill="#9be3a6" stroke="#2d8a52" stroke-width="3"/>
        <rect x="-24" y="-11" width="48" height="22" rx="3" fill="none" stroke="#2d8a52" stroke-width="1.5" opacity=".6"/>
        <circle r="9" fill="#d8f5dc" stroke="#2d8a52" stroke-width="2"/>
        <text y="5" text-anchor="middle" font-size="13" font-weight="800" fill="#1d6b3c" font-family="Fredoka,Arial">$</text></g>`;
      let stripes = '';
      for (let x = 44; x <= 164; x += 20) stripes += `<line x1="${x}" y1="98" x2="${x}" y2="146" stroke="#c9d6ea" stroke-width="3"/>`;
      return `${bill(58, 82, -18)}${bill(104, 74, 6)}${bill(146, 84, 20)}
        <rect x="18" y="94" width="166" height="58" rx="16" fill="#f1f5fb" stroke="#7e95b5" stroke-width="4"/>
        ${stripes}
        <rect x="26" y="98" width="46" height="20" rx="9" fill="#fff" stroke="#9fb2cc" stroke-width="2"/>
        <path d="M24 152 h154" stroke="#7e95b5" stroke-width="4" stroke-linecap="round"/>
        <rect x="30" y="152" width="10" height="12" fill="#7e95b5"/><rect x="162" y="152" width="10" height="12" fill="#7e95b5"/>`;
    },
    stamps: () => {
      const stamp = (x, y, w, h, r, inner) => {
        let holes = '';
        for (let i = 0; i <= w; i += 11) holes += `<circle cx="${i}" cy="0" r="4" fill="#efe8ff"/><circle cx="${i}" cy="${h}" r="4" fill="#efe8ff"/>`;
        for (let i = 0; i <= h; i += 11) holes += `<circle cx="0" cy="${i}" r="4" fill="#efe8ff"/><circle cx="${w}" cy="${i}" r="4" fill="#efe8ff"/>`;
        return `<g transform="translate(${x} ${y}) rotate(${r})"><rect width="${w}" height="${h}" fill="#fffdf6" stroke="#cfc4e8" stroke-width="1"/>${holes}${inner}</g>`;
      };
      const scene = `<rect x="9" y="9" width="70" height="78" fill="url(#sky)"/>
        <circle cx="60" cy="30" r="10" fill="#ffd34d"/>
        <path d="M9 87 L32 50 L48 70 L60 56 L79 87 Z" fill="#6c4bb8"/>
        <path d="M32 50 L38 60 L26 60 Z" fill="#fff"/>
        <text x="16" y="24" font-size="13" font-weight="800" fill="#4a2f8a" font-family="Fredoka,Arial">5¢</text>`;
      const scene2 = `<rect x="9" y="9" width="62" height="70" fill="#ffe3ee"/>
        <path d="M40 30 c-8 -14 -28 -4 -16 12 l16 16 l16 -16 c12 -16 -8 -26 -16 -12z" fill="#d94f86"/>
        <text x="40" y="74" text-anchor="middle" font-size="9" font-weight="800" fill="#8a2f55" font-family="Fredoka,Arial">AIR MAIL</text>`;
      return stamp(22, 40, 80, 88, -10, scene2) + stamp(92, 34, 88, 96, 8, scene) +
        `<circle cx="150" cy="138" r="20" fill="none" stroke="#6c4bb8" stroke-width="3" opacity=".55"/>
         <path d="M118 132 q10 -8 20 0 t20 0 t20 0" fill="none" stroke="#6c4bb8" stroke-width="3" opacity=".55"/>`;
    },
    baseball: () => `
      <g transform="translate(44 14) rotate(-8)">
        <rect width="88" height="122" rx="8" fill="#fff" stroke="#c0392b" stroke-width="4"/>
        <rect x="8" y="8" width="72" height="80" rx="4" fill="#3a6fb5"/>
        <circle cx="44" cy="36" r="13" fill="#f5d0b0"/>
        <path d="M30 34 q14 -18 28 0 z" fill="#c0392b"/><rect x="26" y="32" width="36" height="5" rx="2" fill="#c0392b"/>
        <path d="M22 88 q4 -34 22 -36 q18 2 22 36 z" fill="#fff"/>
        <rect x="8" y="94" width="72" height="20" rx="3" fill="#c0392b"/>
        <text x="44" y="109" text-anchor="middle" font-size="12" font-weight="800" fill="#fff" font-family="Fredoka,Arial">ROOKIE</text>
      </g>
      <rect x="120" y="40" width="14" height="110" rx="7" fill="#c98b52" stroke="#7a4e32" stroke-width="3" transform="rotate(28 127 95)"/>
      <circle cx="138" cy="122" r="32" fill="#fffdf6" stroke="#9aa3ad" stroke-width="3"/>
      <path d="M116 100 q14 22 0 44" fill="none" stroke="#d8402f" stroke-width="3"/>
      <path d="M160 100 q-14 22 0 44" fill="none" stroke="#d8402f" stroke-width="3"/>
      ${[106, 114, 122, 130, 138].map((y) => `<path d="M${y < 122 ? 118 : 117} ${y} l6 -2 M${y < 122 ? 158 : 159} ${y} l-6 -2" stroke="#d8402f" stroke-width="2"/>`).join('')}`,
    stocks: () => `
      <rect x="20" y="24" width="164" height="128" rx="10" fill="#fff" stroke="#1f62a8" stroke-width="4"/>
      ${[52, 80, 108, 136].map((y) => `<line x1="32" y1="${y}" x2="172" y2="${y}" stroke="#d6e6f8" stroke-width="2"/>`).join('')}
      <rect x="40" y="112" width="18" height="30" rx="3" fill="#9cc8f2"/>
      <rect x="68" y="96" width="18" height="46" rx="3" fill="#7bb4ec"/>
      <rect x="96" y="104" width="18" height="38" rx="3" fill="#9cc8f2"/>
      <rect x="124" y="78" width="18" height="64" rx="3" fill="#5b9fe3"/>
      <rect x="152" y="58" width="18" height="84" rx="3" fill="#3d86d4"/>
      <polyline points="38,118 70,92 98,104 130,70 158,48" fill="none" stroke="#1db954" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M150 38 L172 40 L164 60 Z" fill="#1db954"/>
      <rect x="28" y="30" width="58" height="20" rx="10" fill="#1db954"/>
      <path d="M38 45 l6 -9 l6 9 z" fill="#fff"/>
      <text x="68" y="45" text-anchor="middle" font-size="13" font-weight="800" fill="#fff" font-family="Fredoka,Arial">12%</text>`,
    coins: () => {
      let stack = '';
      for (let i = 0; i < 6; i++) {
        const y = 150 - i * 13;
        stack += `<ellipse cx="62" cy="${y + 6}" rx="42" ry="13" fill="#b8860b"/><rect x="20" y="${y - 6}" width="84" height="12" fill="#e0a92a"/><ellipse cx="62" cy="${y - 6}" rx="42" ry="13" fill="#f6cf4f" stroke="#a8741a" stroke-width="2"/>`;
      }
      const star = (cx, cy, r) => {
        let pts = '';
        for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5; const rr = i % 2 ? r * 0.45 : r; pts += `${(cx + rr * Math.cos(a)).toFixed(1)},${(cy + rr * Math.sin(a)).toFixed(1)} `; }
        return `<polygon points="${pts}" fill="#fff4c2" stroke="#a8741a" stroke-width="2"/>`;
      };
      return `${stack}
        <circle cx="140" cy="86" r="44" fill="url(#coin)" stroke="#a8741a" stroke-width="4"/>
        <circle cx="140" cy="86" r="34" fill="none" stroke="#a8741a" stroke-width="2" stroke-dasharray="3 4"/>
        ${star(140, 86, 22)}
        <circle cx="168" cy="140" r="20" fill="#d9dde3" stroke="#7d8794" stroke-width="3"/>
        <text x="168" y="146" text-anchor="middle" font-size="15" font-weight="800" fill="#5b6470" font-family="Fredoka,Arial">25</text>`;
    },
    bank: () => `
      <rect x="22" y="146" width="156" height="14" rx="3" fill="#8fa6bf"/>
      <rect x="32" y="134" width="136" height="14" rx="3" fill="#b4c4d6"/>
      ${[44, 76, 108, 140].map((x) => `<rect x="${x}" y="72" width="16" height="62" fill="#eef3f8" stroke="#3b5068" stroke-width="3"/><rect x="${x - 3}" y="66" width="22" height="8" fill="#b4c4d6" stroke="#3b5068" stroke-width="2"/>`).join('')}
      <rect x="30" y="58" width="140" height="10" fill="#b4c4d6" stroke="#3b5068" stroke-width="3"/>
      <path d="M22 58 L100 14 L178 58 Z" fill="#dfe7f0" stroke="#3b5068" stroke-width="4" stroke-linejoin="round"/>
      <circle cx="100" cy="42" r="12" fill="url(#coin)" stroke="#a8741a" stroke-width="2"/>
      <text x="100" y="48" text-anchor="middle" font-size="16" font-weight="800" fill="#8a5a00" font-family="Fredoka,Arial">$</text>`,
    auto: () => `
      <ellipse cx="102" cy="150" rx="88" ry="8" fill="#000" opacity=".12"/>
      <path d="M16 126 Q16 104 38 100 L64 96 Q80 60 108 58 L138 58 Q156 60 166 94 L180 98 Q194 102 192 126 Z" fill="#ff8a3d" stroke="#a8430f" stroke-width="4" stroke-linejoin="round"/>
      <path d="M74 94 Q86 68 106 66 L118 66 L118 94 Z" fill="#cfefff" stroke="#a8430f" stroke-width="3"/>
      <path d="M126 66 L136 66 Q150 68 158 94 L126 94 Z" fill="#cfefff" stroke="#a8430f" stroke-width="3"/>
      <path d="M22 112 H186" stroke="#ffd2b0" stroke-width="4"/>
      <rect x="10" y="122" width="186" height="8" rx="4" fill="#d9dde3" stroke="#7d8794" stroke-width="2"/>
      <circle cx="184" cy="108" r="6" fill="#fff6b0" stroke="#a8430f" stroke-width="2"/>
      <circle cx="58" cy="130" r="20" fill="#2b2b2b"/><circle cx="58" cy="130" r="10" fill="#d9dde3" stroke="#7d8794" stroke-width="2"/>
      <circle cx="150" cy="130" r="20" fill="#2b2b2b"/><circle cx="150" cy="130" r="10" fill="#d9dde3" stroke="#7d8794" stroke-width="2"/>`,
    jewels: () => {
      const spark = (x, y, s) => `<path d="M${x} ${y - s} L${x + s * 0.25} ${y - s * 0.25} L${x + s} ${y} L${x + s * 0.25} ${y + s * 0.25} L${x} ${y + s} L${x - s * 0.25} ${y + s * 0.25} L${x - s} ${y} L${x - s * 0.25} ${y - s * 0.25} Z" fill="#fff" stroke="#13887a" stroke-width="1.5"/>`;
      return `
      <path d="M30 40 Q100 110 170 40" fill="none" stroke="#f2c230" stroke-width="4" stroke-dasharray="2 6" stroke-linecap="round"/>
      <polygon points="58,58 142,58 170,88 100,162 30,88" fill="url(#gem)" stroke="#0e6b60" stroke-width="4" stroke-linejoin="round"/>
      <polyline points="30,88 170,88" fill="none" stroke="#0e6b60" stroke-width="3"/>
      <polyline points="58,58 76,88 100,58 124,88 142,58" fill="none" stroke="#0e6b60" stroke-width="3" stroke-linejoin="round"/>
      <polyline points="76,88 100,162 124,88" fill="none" stroke="#0e6b60" stroke-width="3" stroke-linejoin="round"/>
      <polygon points="62,62 96,62 78,84" fill="#fff" opacity=".45"/>
      ${spark(168, 50, 12)}${spark(36, 130, 9)}${spark(160, 136, 7)}`;
    },
    home: () => `
      <rect x="0" y="148" width="200" height="22" rx="6" fill="#8ccf6e"/>
      <circle cx="24" cy="110" r="22" fill="#5fae4b"/><rect x="21" y="126" width="6" height="24" fill="#7a4e32"/>
      <rect x="132" y="30" width="18" height="34" fill="#b0503a" stroke="#6e2a1d" stroke-width="3"/>
      <rect x="50" y="86" width="112" height="64" fill="#f7e2c4" stroke="#7a4e32" stroke-width="4"/>
      <path d="M38 90 L106 34 L174 90 Z" fill="#c8483a" stroke="#6e2a1d" stroke-width="4" stroke-linejoin="round"/>
      <rect x="94" y="108" width="24" height="42" rx="3" fill="#7a4e32"/><circle cx="112" cy="130" r="2.5" fill="#f2c230"/>
      <rect x="62" y="100" width="22" height="22" fill="#cfefff" stroke="#7a4e32" stroke-width="3"/><path d="M73 100 v22 M62 111 h22" stroke="#7a4e32" stroke-width="2"/>
      <rect x="128" y="100" width="22" height="22" fill="#cfefff" stroke="#7a4e32" stroke-width="3"/><path d="M139 100 v22 M128 111 h22" stroke="#7a4e32" stroke-width="2"/>
      <circle cx="106" cy="66" r="9" fill="#fff6d6" stroke="#6e2a1d" stroke-width="3"/>`,
    silver: () => bars('silver'),
    gold: () => bars('gold'),
  };
  function bars(m) {
    const bar = (x, y) => `<g transform="translate(${x} ${y})">
      <polygon points="8,0 64,0 72,24 0,24" fill="url(#${m}top)" stroke="${m === 'gold' ? '#8a5a00' : '#5b6470'}" stroke-width="2.5" stroke-linejoin="round"/>
      <rect x="0" y="24" width="72" height="20" fill="url(#${m}bar)" stroke="${m === 'gold' ? '#8a5a00' : '#5b6470'}" stroke-width="2.5"/>
      <path d="M10 6 L30 6" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".8"/></g>`;
    const shine = (x, y) => `<path d="M${x} ${y - 10} L${x + 3} ${y - 3} L${x + 10} ${y} L${x + 3} ${y + 3} L${x} ${y + 10} L${x - 3} ${y + 3} L${x - 10} ${y} L${x - 3} ${y - 3} Z" fill="#fff"/>`;
    return `${bar(28, 112)}${bar(100, 112)}${bar(64, 72)}${shine(160, 64)}${shine(40, 82)}${shine(150, 160)}`;
  }

  // ---- full card face
  function face(t) {
    const d = TYPES[t];
    const nameSize = d.name.length > 18 ? 15 : d.name.length > 12 ? 19 : 22;
    const wildBadge = d.wild
      ? `<g transform="translate(125 268)"><rect x="-44" y="-15" width="88" height="26" rx="13" fill="#1b1b2f"/><text y="5" text-anchor="middle" font-size="15" font-weight="700" letter-spacing="3" fill="${d.c1}" font-family="Fredoka,Arial">WILD</text></g>`
      : '';
    return `<svg viewBox="0 0 250 350" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="2" width="246" height="346" rx="20" fill="#fffdf7" stroke="#00000022" stroke-width="2"/>
      <rect x="10" y="10" width="230" height="330" rx="14" fill="url(#fr-${t})"/>
      <rect x="20" y="52" width="210" height="196" rx="12" fill="${d.bg}" stroke="#ffffff" stroke-width="4"/>
      <text x="125" y="40" text-anchor="middle" font-size="${nameSize}" font-weight="700" fill="#fff" font-family="Fredoka,Arial" stroke="#00000030" stroke-width="3" paint-order="stroke">${d.name}</text>
      <g transform="translate(25 66)">${art[t]()}</g>
      ${wildBadge}
      <g transform="translate(125 ${d.wild ? 312 : 296})">
        <rect x="-82" y="-26" width="164" height="44" rx="22" fill="#fff" stroke="${d.c2}" stroke-width="4"/>
        <text y="8" text-anchor="middle" font-size="27" font-weight="700" fill="${d.c2}" font-family="Fredoka,Arial">${fmt(d.value)}</text>
      </g>
      <text x="24" y="${d.wild ? 270 : 330}" font-size="13" font-weight="800" fill="#ffffffcc" font-family="Fredoka,Arial">${short(d.value)}</text>
    </svg>`;
  }
  function back() {
    return `<svg viewBox="0 0 250 350" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="2" width="246" height="346" rx="20" fill="#fffdf7"/>
      <rect x="10" y="10" width="230" height="330" rx="14" fill="url(#back)"/>
      <rect x="10" y="10" width="230" height="330" rx="14" fill="url(#backpat)"/>
      <rect x="22" y="22" width="206" height="306" rx="10" fill="none" stroke="#d4af37" stroke-width="3" stroke-dasharray="1 7" stroke-linecap="round"/>
      <circle cx="125" cy="160" r="58" fill="url(#coin)" stroke="#8a5a00" stroke-width="5"/>
      <circle cx="125" cy="160" r="46" fill="none" stroke="#8a5a00" stroke-width="2" stroke-dasharray="4 4"/>
      <text x="125" y="186" text-anchor="middle" font-size="74" font-weight="700" fill="#7a4e00" font-family="Fredoka,Arial">$</text>
      <text x="125" y="262" text-anchor="middle" font-size="28" font-weight="700" fill="#f6d36b" font-family="Fredoka,Arial">STACK</text>
      <text x="125" y="290" text-anchor="middle" font-size="18" font-weight="700" fill="#f6d36b" font-family="Fredoka,Arial">&amp; SNATCH</text>
    </svg>`;
  }

  // cache strings
  const cache = {};
  window.CARDS = {
    TYPES, fmt, short,
    face: (t) => cache[t] || (cache[t] = face(t)),
    back: () => cache.__back || (cache.__back = back()),
    defs,
    isWild: (c) => !!TYPES[c.t].wild,
    value: (c) => TYPES[c.t].value,
  };
})();
