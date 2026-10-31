/* ============================================================
   Aliado: o ludo tradicional da Marinha, jogado em duplas.
   Tudo roda no aparelho (sem internet). A partida em andamento fica salva no próprio aparelho.
   Tabuleiro 19x19 desenhado a partir da lona que o Fernando mandou. Nos cantos, as cores dos clubes (sem escudos).
   ============================================================ */
(function(){
"use strict";

/* ---------- Tabuleiro ----------
   B azul, G verde, R vermelho, Y amarelo, W branco, K preto, S caveira, M morto (casa protegida). */
const GRID = [
  "...BGRYWKBGRYWKB...",
  "...K...........G...",
  "...W...........R...",
  "BGRY.SBGRYWKBGMYWKB",
  "K..M.W.......R....G",
  "W..GRY...KBGRYWS..R",
  "Y..B.R...W.....B..Y",
  "R..K.G...Y.....G..W",
  "G..W.B.........R..K",
  "B..Y.KWY...YWK.Y..B",
  "K..R.........B.W..G",
  "W..G.....Y...G.K..R",
  "Y..B.....W...R.B..Y",
  "R..SWYRGBK...YRG..W",
  "G....R.......W.M..K",
  "BKWYMGBKWYRGBS.YRGB",
  "...R...........W...",
  "...G...........K...",
  "...BKWYRGBKWYRGB..."
];
const COR = {B:"#1E6FD9", G:"#16A34A", R:"#E53935", Y:"#F5B700", W:"#FFFFFF", K:"#1B1B1B", S:"#1B1B1B", M:"#E53935"};

/* Jogadores na ordem da vez (anti-horário): Fluminense (sup. esq.), Vasco (inf. esq.), Flamengo (inf. dir.), Botafogo (sup. dir.).
   Duplas: quem está em canto oposto. Flu + Fla contra Vasco + Botafogo. */
const CLUBES = [
  {id:"flu", nome:"Fluminense", curto:"Flu", cor:"#8A1538", cor2:"#00613C", txt:"#fff"},
  {id:"vas", nome:"Vasco", curto:"Vasco", cor:"#FFFFFF", cor2:"#111111", txt:"#111"},
  {id:"fla", nome:"Flamengo", curto:"Fla", cor:"#D7262E", cor2:"#111111", txt:"#fff"},
  {id:"bot", nome:"Botafogo", curto:"Bota", cor:"#111111", cor2:"#FFFFFF", txt:"#fff"}
];
const DUPLA = ["Flu + Fla", "Vasco + Bota"];

/* Gira 90° no sentido anti-horário da tela: o canto sup. esq. vai para o inf. esq. */
const rot = ([r, c]) => [18 - c, r];
const rotN = (rc, n) => { for (let i = 0; i < n; i++) rc = rot(rc); return rc; };

/* Anel de fora, anti-horário, começando na casa de entrada do Fluminense (3,3). 72 casas. */
const RING = (() => {
  const seg = [[0,-1,3],[1,0,12],[0,1,3],[1,0,3],[0,1,12],[-1,0,3],[0,1,3],[-1,0,12],[0,-1,3],[-1,0,3],[0,-1,12],[1,0,3]];
  const out = []; let r = 3, c = 3;
  for (const [dr, dc, n] of seg) for (let i = 0; i < n; i++) { out.push([r, c]); r += dr; c += dc; }
  return out;
})();
/* Caminho do Fluminense: sai na porta (casa logo depois da entrada), dá a volta toda, entra no M, desce e entra no braço até o centro. */
const PATH0 = (() => {
  const p = [];
  for (let i = 1; i <= 72; i++) p.push(RING[i % 72]);
  p.push([4, 3]);                                   // M: o "morto", ninguém mata ali
  for (let r = 5; r <= 13; r++) p.push([r, 3]);     // termina na caveira (13,3)
  p.push([13, 4], [13, 5]);                         // (13,5): última casa antes da bandeira de chegada
  p.push([13, 6], [13, 7], [13, 8], [13, 9], [12, 9], [11, 9]); // bandeira de chegada: as últimas 6
  return p;
})();
const PATHS = [0, 1, 2, 3].map(n => PATH0.map(rc => rotN(rc, n)));
const LAST = PATH0.length - 1;  // 89
const ARM = LAST - 5;           // 84: começo das últimas seis casas
const MESTRE = ARM - 1;         // 83: casa da Jogada de Mestre
const MORTO = 72;               // casa M
const SKULL = 81;               // caveira de cada jogador
const key = (p, i) => PATHS[p][i][0] * 19 + PATHS[p][i][1];
const RINGIDX = PATHS.map(P => { const m = {}; for (let i = 0; i < MORTO; i++) m[P[i][0] * 19 + P[i][1]] = i; return m; });
const SAFE = new Set(PATHS.map((P, p) => key(p, MORTO)));

/* ---------- Motor ---------- */
const clone = o => JSON.parse(JSON.stringify(o));
const dado = () => 1 + Math.floor(Math.random() * 6);

function novo(seats){
  return {v:1, seats, pos:[0, 1, 2, 3].map(() => [-1, -1, -1, -1]), turn:0, phase:"roll", dice:[], rem:[], single:false, dbl:false, canSplit:false,
    locked:null, prize:{stage:0, first:null}, sangra:[0, 0, 0, 0], extra:false, suicide:false, log:[], winner:null, como:null, aviso:"", inicio:Date.now()};
}
const nome = p => CLUBES[p].nome;
function log(G, t){ G.log.unshift(t); if (G.log.length > 30) G.log.length = 30; }

function rolar(G, forc){
  const p = G.turn, P = G.pos[p];
  G.single = P.every(i => i >= ARM); G.locked = null; G.extra = false; G.suicide = false; G.aviso = "";
  if (G.single){
    G.dice = forc ? forc.slice(0, 1) : [dado()]; G.dbl = false; G.canSplit = false;
    if (P.every(i => i === LAST)){
      if (G.dice[0] === 1){ ganhar(G, p, "as"); return; }
      log(G, `${nome(p)} precisava do ás e tirou ${G.dice[0]}.`); G.rem = []; G.phase = "pass"; return;
    }
  } else {
    G.dice = forc ? forc.slice(0, 2) : [dado(), dado()];
    const [a, b] = G.dice;
    G.dbl = a === b && (a === 1 || a === 6);
    G.canSplit = a === 6 || b === 6 || G.dbl;
    if (P.every(i => i === MESTRE) && a + b === 7 && (a === 6 || b === 6)){ ganhar(G, p, "mestre"); return; }
  }
  G.rem = G.dice.map((_, i) => i);
  G.phase = "move";
  if (!legal(G).length){ G.phase = "pass"; log(G, `${nome(p)} tirou ${G.dice.join(" e ")} e não tem jogada.`); }
}

function legal(G){
  const p = G.turn, P = G.pos[p], out = [], seen = new Set();
  if (G.phase !== "move") return out;
  const units = {}; P.forEach(i => { if (i >= 0 && i < LAST) units[i] = (units[i] || 0) + 1; });
  const paiol = P.filter(i => i < 0).length;
  const add = o => { const k = [o.t, o.from, o.to, o.k, o.dice.length].join("|"); if (!seen.has(k)){ seen.add(k); out.push(o); } };
  const mover = (dice, steps) => {
    for (const u in units){ const i = +u; if (i + steps > LAST) continue;
      const n = units[i]; for (const k of (n > 1 ? [1, n] : [1])) add({t:"move", from:i, to:i + steps, k, steps, dice}); }
  };
  if (G.single) mover([0], G.dice[0]);
  else {
    if (G.rem.length === 2) mover([0, 1], G.dice[0] + G.dice[1]);
    if (G.canSplit) for (const di of G.rem){
      const d = G.dice[di];
      if (paiol && (d === 6 || (G.dbl && d === 1))) add({t:"exit", from:-1, to:0, k:1, steps:d, dice:[di]});
      mover([di], d);
    }
  }
  if (G.locked != null){ const livres = out.filter(o => !(o.t === "move" && o.from === G.locked)); if (livres.length) return livres; }
  return out;
}

function aplicar(G, o){
  const p = G.turn, P = G.pos[p], ops = legal(G);
  const voluntario = o.to === SKULL && ops.some(x => x.to !== SKULL);
  let n = o.k, txt = "";
  if (o.t === "exit"){
    const naBandeira = P.filter(i => i < 0).length;
    n = 1;
    if (G.prize.stage === 0){
      if (G.dbl){ n = 4; G.rem = []; G.prize = {stage:1, first:p}; txt = `${nome(p)} saiu de pitoco! Quem sair em segundo paga o prêmio.`; }
      else { n = 2; G.prize = {stage:2, first:p}; txt = `${nome(p)} foi o primeiro a sair e pagou o prêmio: saiu trepado com duas pedras.`; }
    } else if (G.prize.stage === 1 && p !== G.prize.first){ n = 2; G.prize = {stage:2, first:G.prize.first}; txt = `${nome(p)} foi o segundo a sair e pagou o prêmio: saiu com duas pedras.`; }
    n = Math.min(n, naBandeira);
    let m = 0; for (let j = 0; j < 4 && m < n; j++) if (P[j] < 0){ P[j] = 0; m++; }
    if (!txt) txt = `${nome(p)} tirou uma pedra do paiol.`;
  } else {
    let m = 0; for (let j = 0; j < 4 && m < n; j++) if (P[j] === o.from){ P[j] = o.to; m++; }
    txt = `${nome(p)} andou ${o.steps} ${o.steps === 1 ? "casa" : "casas"}${n > 1 ? ` com ${n} pedras juntas` : ""}.`;
  }
  G.rem = G.rem.filter(d => !o.dice.includes(d));
  const ev = {mortos:[], caveira:false, voluntario:false, n};
  if (o.to === SKULL){
    const quantas = P.filter(i => i === SKULL).length;
    for (let j = 0; j < 4; j++) if (P[j] === SKULL) P[j] = -1;
    ev.caveira = true;
    if (voluntario){ ev.voluntario = true; G.rem = []; G.suicide = true; txt = `${nome(p)} foi pra caveira de propósito: volta pro paiol e passa a vez.`; }
    else if (quantas === 4){ G.extra = true; txt = `${nome(p)} caiu de pitoco na caveira: tudo pro paiol, mas joga de novo.`; }
    else txt = `${nome(p)} caiu na caveira: ${quantas > 1 ? "as pedras voltam" : "a pedra volta"} pro paiol.`;
  } else if (o.to < MORTO && !SAFE.has(key(p, o.to))){
    const alvo = key(p, o.to);
    for (let q = 0; q < 4; q++){ if (q === p) continue;
      let morreu = 0;
      G.pos[q].forEach((i, j) => { if (i >= 0 && i < MORTO && key(q, i) === alvo){ G.pos[q][j] = -1; morreu++; } });
      if (morreu){ ev.mortos.push([q, morreu]); if (!G.dbl) G.sangra[q] = 1; }
    }
    if (ev.mortos.length){
      const m = ev.mortos.map(([q, k]) => `${k > 1 ? `${k} pedras` : "uma pedra"} do ${nome(q)}${q % 2 === p % 2 ? " (o próprio aliado!)" : ""}`).join(" e ");
      txt += ` Matou ${m}.` + (G.dbl ? "" : ` ${ev.mortos.map(([q]) => nome(q)).join(" e ")} tá sangrando: perde a próxima vez.`);
      if (o.dice.length === 1 && G.rem.length) G.locked = o.to;
    }
  }
  log(G, txt); G.aviso = txt;
  if (!G.rem.length || !legal(G).length) G.phase = "end";
  return ev;
}

function ganhar(G, p, como){
  G.winner = p % 2; G.como = como; G.phase = "over"; G.rem = [];
  const t = como === "mestre" ? `Jogada de Mestre! ${nome(p)} estava de pitoco na casa antes da chegada e tirou sena e ás.` : `${nome(p)} tirou o ás com as quatro pedras na chegada.`;
  log(G, t + ` Vitória da dupla ${DUPLA[p % 2]}!`); G.aviso = t;
}

function fimVez(G){
  if (G.phase === "over") return;
  G.locked = null;
  const denovo = !G.suicide && (G.dbl || G.extra);
  G.suicide = false; G.extra = false; G.aviso = "";
  if (denovo) log(G, `${nome(G.turn)} joga de novo.`);
  else {
    const pulados = [];
    for (let guard = 0; guard < 8; guard++){
      G.turn = (G.turn + 1) % 4;
      if (G.sangra[G.turn]){ G.sangra[G.turn] = 0; pulados.push(nome(G.turn)); continue; }
      break;
    }
    if (pulados.length){ G.aviso = `${pulados.join(" e ")} tá sangrando e perdeu a vez.`; log(G, G.aviso); }
  }
  G.phase = "roll"; G.dice = []; G.rem = []; G.dbl = false; G.single = false;
}

/* ---------- Computador ---------- */
/* Chance aproximada de um adversário a d casas acertar a casa na próxima jogada (soma dos dados ou um dado com sena). */
const CHANCE = [0, .17, .2, .22, .25, .28, .45, .17, .14, .11, .08, .06, .03];
function avaliar(G, p){
  let s = 0;
  const time = p % 2;
  for (let q = 0; q < 4; q++){
    const sinal = q % 2 === time ? 1 : -1, peso = q === p ? 1 : .85;
    G.pos[q].forEach(i => { s += sinal * peso * (i < 0 ? 0 : 12 + i + (i >= MORTO ? 18 : 0) + (i === LAST ? 6 : 0)); });
  }
  /* Risco: pedras no anel que um adversário alcança na próxima jogada. */
  for (let q = 0; q < 4; q++){
    const sinal = q % 2 === time ? 1 : -1;
    const units = {}; G.pos[q].forEach(i => { if (i >= 0 && i < MORTO) units[i] = (units[i] || 0) + 1; });
    for (const u in units){
      const i = +u, cel = key(q, i); if (SAFE.has(cel)) continue;
      let risco = 0;
      for (let r = 0; r < 4; r++){ if (r % 2 === q % 2) continue;
        const alvo = RINGIDX[r][cel]; if (alvo == null) continue;
        G.pos[r].forEach(j => { if (j >= 0 && j < MORTO){ const d = alvo - j; if (d >= 1 && d <= 12) risco += CHANCE[d]; } });
        if (alvo === 0 && G.pos[r].some(j => j < 0)) risco += .3;
      }
      s -= sinal * Math.min(.9, risco) * (12 + i) * units[u] * .9;
    }
  }
  return s;
}
function planos(G){
  const res = [];
  const rec = (g, seq, depth) => {
    const ops = g.phase === "move" ? legal(g) : [];
    if (!ops.length || depth > 3){ res.push({seq, g}); return; }
    for (const o of ops){ const h = clone(g); aplicar(h, o); rec(h, seq.concat([o]), depth + 1); }
  };
  rec(G, [], 0);
  return res;
}
function melhorPlano(G){
  const p = G.turn; let best = null, bs = -Infinity;
  for (const pl of planos(G)){
    let s = avaliar(pl.g, p) + (pl.g.extra ? 8 : 0) + Math.random() * .5;
    if (pl.g.suicide) s -= 20;
    if (s > bs){ bs = s; best = pl; }
  }
  return best ? best.seq : [];
}

const ENGINE = {GRID, PATHS, RING, LAST, ARM, MESTRE, MORTO, SKULL, CLUBES, novo, rolar, legal, aplicar, fimVez, melhorPlano, key};
if (typeof module !== "undefined") module.exports = ENGINE;
if (typeof window === "undefined") return;
window.ALIADO = ENGINE;

/* ======================= Interface ======================= */
const SAVE = "alm-aliado", STATS = "alm-aliado-placar";
const AL = {G:null, aba:"jogar", sel:null, timer:null, setup:null, anim:null};
const g$ = s => document.querySelector(s);
const humano = (G, p) => G.seats[p] === "h";
function salvar(){ try { localStorage.setItem(SAVE, JSON.stringify(AL.G)); } catch (e) {} }
function carregar(){ if (AL.G) return; try { const g = JSON.parse(localStorage.getItem(SAVE) || "null"); if (g && g.v === 1) AL.G = g; } catch (e) {} }

const PRESETS = [
  ["solo", "Eu e o computador", "Você joga com o Flu; seu aliado e a outra dupla são do computador.", ["h", "c", "c", "c"]],
  ["dupla", "Uma dupla contra o computador", "Duas pessoas (Flu e Fla) contra Vasco e Botafogo do computador.", ["h", "c", "h", "c"]],
  ["x1", "Um contra um", "Cada pessoa joga com um time; os aliados ficam com o computador.", ["h", "h", "c", "c"]],
  ["quatro", "Quatro pessoas", "Todo mundo no mesmo celular, passando de mão em mão.", ["h", "h", "h", "h"]]
];

/* Pedra desenhada com as cores do clube (sem escudo). */
function pedraSVG(p, x, y, r, extra){
  const c = CLUBES[p];
  let deco = "";
  if (c.id === "flu") deco = `<path d="M${x - r * .35} ${y - r * .8} v${r * 1.6} M${x + r * .35} ${y - r * .8} v${r * 1.6}" stroke="#fff" stroke-width="${r * .22}"/><circle cx="${x}" cy="${y}" r="${r * .82}" fill="none" stroke="${c.cor2}" stroke-width="${r * .3}"/>`;
  if (c.id === "fla") deco = `<path d="M${x - r * .8} ${y - r * .35} h${r * 1.6} M${x - r * .8} ${y + r * .35} h${r * 1.6}" stroke="#111" stroke-width="${r * .28}"/>`;
  if (c.id === "vas") deco = `<path d="M${x - r * .7} ${y - r * .7} L${x + r * .7} ${y + r * .7}" stroke="#111" stroke-width="${r * .42}"/><path d="M${x + r * .25} ${y - r * .55} h${r * .3} v${r * .3} h-${r * .3} z" fill="#D7262E"/>`;
  if (c.id === "bot") deco = estrela(x, y, r * .6, "#fff");
  return `<g ${extra || ""}><circle cx="${x}" cy="${y + r * .12}" r="${r}" fill="rgba(0,0,0,.35)"/><circle cx="${x}" cy="${y}" r="${r}" fill="${c.cor}" stroke="${c.id === "vas" ? "#111" : "#fff"}" stroke-width="${r * .14}"/>${deco}</g>`;
}
function estrela(x, y, r, cor){
  let d = ""; for (let i = 0; i < 10; i++){ const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * .42 : r; d += (i ? "L" : "M") + (x + rr * Math.cos(a)).toFixed(1) + " " + (y + rr * Math.sin(a)).toFixed(1); }
  return `<path d="${d}Z" fill="${cor}"/>`;
}
function caveira(x, y, s){
  return `<g><circle cx="${x}" cy="${y}" r="${s * .42}" fill="#fff"/><circle cx="${x}" cy="${y - s * .04}" r="${s * .27}" fill="#1B1B1B"/><circle cx="${x - s * .1}" cy="${y - s * .06}" r="${s * .07}" fill="#fff"/><circle cx="${x + s * .1}" cy="${y - s * .06}" r="${s * .07}" fill="#fff"/><rect x="${x - s * .1}" y="${y + s * .1}" width="${s * .2}" height="${s * .08}" rx="${s * .02}" fill="#fff"/></g>`;
}
/* Canto (paiol) de cada clube: as cores do clube em listras, sem o escudo. */
function cantoSVG(p, x, y, w){
  const c = CLUBES[p], id = "al-c" + p;
  let fundo = "";
  if (c.id === "flu") fundo = `<rect x="${x}" y="${y}" width="${w / 3}" height="${w}" fill="#00613C"/><rect x="${x + w / 3}" y="${y}" width="${w / 3}" height="${w}" fill="#fff"/><rect x="${x + 2 * w / 3}" y="${y}" width="${w / 3}" height="${w}" fill="#8A1538"/>`;
  if (c.id === "fla") { fundo = `<rect x="${x}" y="${y}" width="${w}" height="${w}" fill="#D7262E"/>`; for (let i = 1; i < 6; i += 2) fundo += `<rect x="${x}" y="${y + i * w / 6}" width="${w}" height="${w / 6}" fill="#111"/>`; }
  if (c.id === "vas") fundo = `<rect x="${x}" y="${y}" width="${w}" height="${w}" fill="#111"/><path d="M${x} ${y + w * .25} L${x + w * .75} ${y + w} L${x + w} ${y + w} L${x + w} ${y + w * .75} L${x + w * .25} ${y} L${x} ${y} Z" fill="#fff"/>`;
  if (c.id === "bot") { fundo = `<rect x="${x}" y="${y}" width="${w}" height="${w}" fill="#fff"/>`; for (let i = 0; i < 7; i += 2) fundo += `<rect x="${x + i * w / 7}" y="${y}" width="${w / 7}" height="${w}" fill="#111"/>`; }
  return `<clipPath id="${id}"><rect x="${x}" y="${y}" width="${w}" height="${w}" rx="${w * .16}"/></clipPath><g clip-path="url(#${id})">${fundo}</g><rect x="${x}" y="${y}" width="${w}" height="${w}" rx="${w * .16}" fill="none" stroke="rgba(0,0,0,.25)" stroke-width="1"/>`;
}
const CANTO = [[0, 0], [16, 0], [16, 16], [0, 16]]; // [linha, coluna] do canto de cada jogador
const CS = 20; // tamanho da casa no SVG

function tabuleiroSVG(G, opts){
  const H = CS * 19;
  let s = `<svg class="al-board" viewBox="-6 -6 ${H + 12} ${H + 12}" role="img" aria-label="Tabuleiro do Aliado">`;
  s += `<rect x="-6" y="-6" width="${H + 12}" height="${H + 12}" rx="14" fill="#F3EEDF"/>`;
  for (let r = 0; r < 19; r++) for (let c = 0; c < 19; c++){
    const ch = GRID[r][c]; if (ch === ".") continue;
    const x = c * CS, y = r * CS;
    s += `<rect x="${x + 1}" y="${y + 1}" width="${CS - 2}" height="${CS - 2}" rx="2.5" fill="${COR[ch]}" stroke="${ch === "W" ? "#C9C2B0" : "rgba(0,0,0,.15)"}" stroke-width=".8"/>`;
    if (ch === "M") s += `<text x="${x + CS / 2}" y="${y + CS / 2 + 4.6}" text-anchor="middle" font-size="13" font-weight="800" font-family="Montserrat,system-ui,sans-serif" fill="#111">M</text>`;
    if (ch === "S") s += caveira(x + CS / 2, y + CS / 2, CS);
  }
  /* Centro: âncora desenhada (sem brasão oficial). */
  const cx = 9.5 * CS, cy = 9.5 * CS;
  s += `<rect x="${8 * CS + 1}" y="${8 * CS + 1}" width="${3 * CS - 2}" height="${3 * CS - 2}" rx="4" fill="#fff" stroke="#C9C2B0"/>
    <circle cx="${cx}" cy="${cy}" r="26" fill="#0E2747" stroke="#C98F2A" stroke-width="3"/><circle cx="${cx}" cy="${cy}" r="21.5" fill="none" stroke="#C98F2A" stroke-width=".8" stroke-dasharray="2 1.6"/>
    <g fill="none" stroke="#F0CB73" stroke-width="2.4" stroke-linecap="round"><circle cx="${cx}" cy="${cy - 12}" r="3"/><path d="M${cx} ${cy - 9} V${cy + 14} M${cx - 8} ${cy - 4} H${cx + 8} M${cx - 13} ${cy + 3} Q${cx - 11} ${cy + 15} ${cx} ${cy + 14} Q${cx + 11} ${cy + 15} ${cx + 13} ${cy + 3}"/></g>`;
  CANTO.forEach(([r, c], p) => { s += cantoSVG(p, c * CS + 3, r * CS + 3, 3 * CS - 6); });
  if (!G) return s + "</svg>";

  /* Pedras no tabuleiro, agrupadas por casa. */
  const vez = G.turn, H2 = humano(G, vez) && G.phase === "move";
  const ops = H2 ? legal(G) : [];
  const movem = new Set(ops.filter(o => o.t === "move").map(o => o.from));
  const sai = ops.some(o => o.t === "exit");
  const sel = AL.sel;
  /* Destinos da pedra escolhida. */
  if (sel != null){
    const alvos = {};
    ops.filter(o => (sel === -1 ? o.t === "exit" : o.t === "move" && o.from === sel)).forEach(o => { const k = key(vez, o.to); (alvos[k] = alvos[k] || []).push(o); });
    for (const k in alvos){
      const r = Math.floor(k / 19), c = k % 19, o = alvos[k][0], ix = ops.indexOf(o);
      s += `<g data-act="alJoga" data-arg="${ix}" style="cursor:pointer"><rect x="${c * CS - 1}" y="${r * CS - 1}" width="${CS + 2}" height="${CS + 2}" rx="4" fill="rgba(255,255,255,.35)" stroke="#E3B54A" stroke-width="2.4" stroke-dasharray="3 2"/><text x="${c * CS + CS / 2}" y="${r * CS - 3}" text-anchor="middle" font-size="8" font-weight="800" fill="#7A4B00" font-family="system-ui">${o.t === "exit" ? "sai" : o.steps}</text></g>`;
    }
  }
  for (let p = 0; p < 4; p++){
    const cont = {}; G.pos[p].forEach(i => { cont[i] = (cont[i] || 0) + 1; });
    for (const u in cont){
      const i = +u, n = cont[u];
      if (i < 0){
        const [r0, c0] = CANTO[p], slots = [[.85, .85], [2.15, .85], [.85, 2.15], [2.15, 2.15]];
        for (let k = 0; k < n; k++){ const [dx, dy] = slots[k]; s += pedraSVG(p, (c0 + dx) * CS, (r0 + dy) * CS, 6.6); }
        if (p === vez && sai) s += `<rect data-act="alSel" data-arg="-1" x="${c0 * CS + 2}" y="${r0 * CS + 2}" width="${3 * CS - 4}" height="${3 * CS - 4}" rx="9" fill="transparent" stroke="${sel === -1 ? "#E3B54A" : "#fff"}" stroke-width="${sel === -1 ? 3.4 : 2.2}" class="al-pulse" style="cursor:pointer"/>`;
        continue;
      }
      const [r, c] = PATHS[p][i], x = c * CS + CS / 2, y = r * CS + CS / 2;
      const pode = p === vez && movem.has(i);
      s += pedraSVG(p, x, y, 7.2, pode ? `data-act="alSel" data-arg="${i}" style="cursor:pointer"` : "");
      if (pode) s += `<circle cx="${x}" cy="${y}" r="9.6" fill="none" stroke="${sel === i ? "#E3B54A" : "#fff"}" stroke-width="${sel === i ? 2.6 : 1.6}" class="al-pulse" pointer-events="none"/>`;
      if (n > 1) s += `<g pointer-events="none"><circle cx="${x + 6.5}" cy="${y - 6.5}" r="4.6" fill="#E3B54A" stroke="#1E1503" stroke-width=".8"/><text x="${x + 6.5}" y="${y - 4.6}" text-anchor="middle" font-size="6.2" font-weight="800" fill="#1E1503" font-family="system-ui">${n}</text></g>`;
    }
  }
  return s + "</svg>";
}

const PIPS = {1:[[.5, .5]], 2:[[.27, .27], [.73, .73]], 3:[[.27, .27], [.5, .5], [.73, .73]], 4:[[.27, .27], [.73, .27], [.27, .73], [.73, .73]], 5:[[.27, .27], [.73, .27], [.5, .5], [.27, .73], [.73, .73]], 6:[[.27, .25], [.73, .25], [.27, .5], [.73, .5], [.27, .75], [.73, .75]]};
const dadoSVG = (v, usado) => `<svg class="al-dado${usado ? " usado" : ""}" viewBox="0 0 40 40" aria-label="Dado ${v}"><rect x="1.5" y="1.5" width="37" height="37" rx="8" fill="#FFFDF7" stroke="#C9C2B0" stroke-width="1.5"/>${(PIPS[v] || []).map(([x, y]) => `<circle cx="${x * 40}" cy="${y * 40}" r="3.9" fill="${v === 1 ? "#D7262E" : "#1B1B1B"}"/>`).join("")}</svg>`;

function rotuloOp(G, o){
  const p = G.turn;
  if (o.t === "exit") return `Tirar pedra do paiol (${o.steps === 6 ? "sena" : "ás"})`;
  const n = G.pos[p].filter(i => i === o.from).length;
  let t = `Andar ${o.steps}${o.dice.length === 2 ? " (soma)" : ""}`;
  if (n > 1) t += o.k > 1 ? ` · as ${o.k} juntas` : " · só 1 pedra";
  const alvo = o.to < MORTO ? key(p, o.to) : -1;
  if (o.to === SKULL) t += " · caveira!";
  else if (alvo >= 0 && !SAFE.has(alvo)) for (let q = 0; q < 4; q++) if (q !== p && G.pos[q].some(i => i >= 0 && i < MORTO && key(q, i) === alvo)) t += q % 2 === p % 2 ? " · mata o aliado!" : " · mata!";
  if (o.to === LAST) t += " · chegada";
  return t;
}

function viewAliado(){
  carregar();
  return `<button class="back" data-act="marBack">${ic("left")}Marinharia</button>
    <div class="page-h"><span class="eyebrow">Lazer a bordo</span><h1>Aliado</h1><p class="sub" style="font-size:15px">O ludo da Marinha, jogado em duplas com dois dados. Funciona sem internet: dá pra jogar no navio, num celular só.</p></div>
    <div class="seg al-abas" role="group" aria-label="Seções do jogo">${[["jogar", "Jogar"], ["regras", "Regras"], ["girias", "Gírias"]].map(([k, n]) => `<button type="button" data-act="alAba" data-arg="${k}" aria-pressed="${AL.aba === k}">${n}</button>`).join("")}</div>
    <div id="al-root"></div>`;
}

function draw(){
  const root = g$("#al-root"); if (!root) { pararTimer(); return; }
  if (AL.aba === "regras") { root.innerHTML = regrasHTML(); return; }
  if (AL.aba === "girias") { root.innerHTML = giriasHTML(); return; }
  const G = AL.G;
  if (!G || AL.setup) { root.innerHTML = setupHTML(); return; }
  root.innerHTML = jogoHTML(G);
  agendar();
}

function setupHTML(){
  const cur = AL.setup || {preset:"solo", seats:PRESETS[0][3].slice()};
  AL.setup = cur;
  const tem = AL.G && AL.G.phase !== "over";
  const placar = (() => { try { return JSON.parse(localStorage.getItem(STATS) || "null") || [0, 0]; } catch (e) { return [0, 0]; } })();
  return `<div class="col" style="gap:16px">
    ${tem ? `<div class="note">${ic("info")}<span>Tem uma partida em andamento neste aparelho. <button class="btn sm" data-act="alVolta" style="margin-left:6px">Continuar a partida</button></span></div>` : ""}
    <div class="card col" style="gap:14px">
      <h2 class="al-h2">Quem vai jogar?</h2>
      <div class="al-presets">${PRESETS.map(([id, n, d]) => `<button type="button" class="al-preset" data-act="alPreset" data-arg="${id}" aria-pressed="${cur.preset === id}"><b>${n}</b><span class="sub">${d}</span></button>`).join("")}</div>
      <div class="al-seats">${CLUBES.map((c, p) => `<button type="button" class="al-seat" data-act="alSeat" data-arg="${p}"><svg viewBox="0 0 30 30" width="30" height="30">${pedraSVG(p, 15, 14, 11)}</svg><span><b>${c.nome}</b><span class="sub">Dupla ${DUPLA[p % 2]}</span></span><span class="pill ${cur.seats[p] === "h" ? "accent" : ""}">${cur.seats[p] === "h" ? "Pessoa" : "Computador"}</span></button>`).join("")}</div>
      <p class="sub">Toque num time para trocar entre pessoa e computador. Os aliados ficam em cantos opostos e a vez segue no sentido anti-horário.</p>
      <button class="btn primary" data-act="alNovo">${ic("game")}Começar a partida</button>
    </div>
    ${placar[0] + placar[1] ? `<div class="card row al-placar"><span class="sub">Placar neste aparelho</span><b>Flu + Fla ${placar[0]}</b><b>Vasco + Bota ${placar[1]}</b></div>` : ""}
    <div class="al-preview">${tabuleiroSVG(null)}</div>
  </div>`;
}

function jogoHTML(G){
  const p = G.turn, c = CLUBES[p], hum = humano(G, p);
  const ops = hum && G.phase === "move" ? legal(G) : [];
  let acao = "";
  if (G.phase === "over"){
    acao = `<div class="al-win"><b>Vitória da dupla ${DUPLA[G.winner]}!</b><span class="sub">${esc(G.aviso || "")}</span><div class="row" style="gap:8px;flex-wrap:wrap;justify-content:center"><button class="btn primary" data-act="alRevanche">${ic("reset")}Revanche</button><button class="btn" data-act="alSetup">Mudar jogadores</button></div></div>`;
  } else if (!hum){
    acao = `<span class="sub">O computador está jogando com o ${c.nome}…</span>`;
  } else if (G.phase === "roll"){
    const outroHumano = G.seats.filter(x => x === "h").length > 1;
    acao = `${outroHumano ? `<span class="sub">Passe o celular para quem joga com o <b>${c.nome}</b>.</span>` : ""}<button class="btn primary al-rolar" data-act="alRolar">${ic("game")}Jogar ${G.pos[p].every(i => i >= ARM) ? "o dado" : "os dados"}</button>`;
  } else if (G.phase === "move"){
    const lista = AL.sel == null ? [] : ops.map((o, ix) => [o, ix]).filter(([o]) => AL.sel === -1 ? o.t === "exit" : o.t === "move" && o.from === AL.sel);
    acao = AL.sel == null ? `<span class="sub">Toque numa pedra que brilha${ops.some(o => o.t === "exit") ? " ou no seu paiol" : ""} para ver as jogadas.</span>`
      : `<div class="al-ops">${lista.map(([o, ix]) => `<button class="btn sm" data-act="alJoga" data-arg="${ix}">${esc(rotuloOp(G, o))}</button>`).join("")}<button class="btn ghost sm" data-act="alSel" data-arg="">Outra pedra</button></div>`;
  } else acao = `<span class="sub">${G.phase === "pass" ? "Sem jogada possível." : ""}</span>`;
  const dados = G.dice.length ? `<div class="al-dados${AL.anim ? " rolando" : ""}">${G.dice.map((v, i) => dadoSVG(v, G.phase === "move" && !G.rem.includes(i) || G.phase === "end")).join("")}</div>` : "";
  return `<div class="al-wrap">
    <div class="al-status" style="--cc:${c.cor};--cc2:${c.cor2}">
      <div class="al-vez"><svg viewBox="0 0 30 30" width="34" height="34">${pedraSVG(p, 15, 14, 11)}</svg><div><span class="eyebrow">${G.phase === "over" ? "Fim de jogo" : "Vez do"}</span><b>${G.phase === "over" ? DUPLA[G.winner] : c.nome}</b><span class="sub">${G.phase === "over" ? "" : `Dupla ${DUPLA[p % 2]}${hum ? "" : " · computador"}`}</span></div>${dados}</div>
      ${G.aviso && G.phase !== "over" ? `<div class="al-aviso">${esc(G.aviso)}</div>` : ""}
    </div>
    <div class="al-boardwrap">${tabuleiroSVG(G)}</div>
    <div class="al-acao">${acao}</div>
    <div class="al-side">
      <div class="al-times">${CLUBES.map((cc, q) => { const P = G.pos[q]; const fora = P.filter(i => i >= 0).length, cheg = P.filter(i => i >= ARM).length; return `<div class="al-time${q === p && G.phase !== "over" ? " on" : ""}"><svg viewBox="0 0 30 30" width="22" height="22">${pedraSVG(q, 15, 14, 11)}</svg><b>${cc.curto}</b><span class="sub">${4 - fora} no paiol · ${cheg} na chegada${G.sangra[q] ? " · sangrando" : ""}</span></div>`; }).join("")}</div>
      <details class="al-log"><summary>O que aconteceu</summary><ol>${G.log.slice(0, 14).map(t => `<li>${esc(t)}</li>`).join("")}</ol></details>
      <div class="row" style="gap:8px;flex-wrap:wrap"><button class="btn ghost sm" data-act="alSetup">${ic("reset")}Nova partida</button></div>
    </div>
  </div>`;
}

function regrasHTML(){
  const R = [
    ["O jogo", ["Quatro jogadores em duas duplas, cada um com quatro pedras. Os aliados ficam em cantos opostos: Flu com Fla e Vasco com Botafogo.", "Ganha a dupla em que um dos parceiros chega primeiro ao final com as suas quatro pedras.", "As pedras andam no sentido anti-horário: dão a volta inteira por fora, entram pela casa M perto do próprio paiol e seguem até o centro."]],
    ["Saída do paiol", ["Todas as pedras começam no paiol. Para sair, precisa tirar sena (6) em qualquer dado. Dois ases (1 e 1) ou doze (6 e 6) tiram duas pedras.", "O primeiro jogador a sair paga o prêmio: sai com uma pedra a mais (sai trepado).", "Se o primeiro a sair tirar dois ases ou doze, sai de pitoco (as quatro montadas) e quem paga o prêmio é o segundo jogador a sair."]],
    ["Jogando os dados", ["Anda-se a soma dos dois dados com uma pedra.", "Saindo sena em um dos dados, dá pra dividir: um dado para uma pedra e o outro para outra. Dois ases e doze também podem ser divididos.", "Quem tira dois ases ou doze joga os dados de novo."]],
    ["Matar", ["Cair na casa de uma pedra mata ela, que volta pro paiol. Pedras trepadas morrem todas juntas, e o aliado também pode matar o parceiro.", "Quem teve a pedra morta tá sangrando: fica uma rodada sem jogar. Se a morte foi com dois ases ou doze, ele não perde a vez, porque o matador já jogou de novo.", "Matando com um dado só (jogada dividida), a pedra que matou fica na casa e o outro dado vai para outra pedra. O mesmo vale para quem mata na porta do próprio paiol: só anda com a mesma pedra se não tiver outra jogada.", "A casa M é o morto: ninguém mata ali."]],
    ["Caveira", ["Caiu na caveira, volta pro paiol.", "Se estava de pitoco e caiu na caveira sem ter outra jogada, joga os dados de novo.", "Se foi para a caveira de propósito, tendo outra jogada, passa a vez, mesmo tendo tirado dois ases ou doze."]],
    ["Chegada", ["Nas últimas seis casas (a bandeira de chegada) joga-se com um dado só, quando as quatro pedras estão lá.", "Com as quatro pedras na última casa, precisa tirar o ás (1) para ganhar.", "Jogada de Mestre: de pitoco na última casa antes da bandeira de chegada, quem tira sena e ás ganha na hora."]],
    ["No app", ["O app faz o papel do juiz: confere os dados, as casas e as regras. As regras de pôr a mão na pedra e dos perus ficam para a lona de verdade.", "O tabuleiro tem as cores dos clubes nos cantos em vez dos escudos."]]
  ];
  return `<div class="col" style="gap:14px">${R.map(([t, l]) => `<div class="card col" style="gap:8px"><h2 class="al-h2">${t}</h2><ul class="ul">${l.map(x => `<li>${esc(x)}</li>`).join("")}</ul></div>`).join("")}</div>`;
}
function giriasHTML(){
  const G = [["Paiol", "O quadrado no início do jogo onde ficam todas as pedras."], ["Ás e Sena", "Os números 1 e 6 dos dados. Para sair do paiol é preciso tirar sena ou dois ases."], ["Peru", "Quem assiste e fica dando palpite. Dizem que o peru não tem pátria: não torce para ninguém."], ["Paioleiro", "O jogador que sempre morre e volta pro paiol."], ["Polícia", "Quando o parceiro está bom de jogo e fica jogando só para matar os adversários."], ["Matador", "Excelente polícia."], ["Sair trepado", "Sair com duas ou três pedras na mesma casa."], ["Pitoco", "Sair com as quatro pedras na mesma casa, ou juntar as quatro durante o jogo."], ["Tá sangrando", "Quem acabou de morrer e fica uma rodada sem jogar."], ["Intoxicar", "Adiantar algumas pedras agrupadas e deixar uma no início."], ["Médico", "Quem esquece de matar a pedra do adversário. Quem dispensa é o médico!"], ["Morto", "A casa M: ali ninguém mata."], ["Jogada de Mestre", "De pitoco na casa antes da chegada, tirar sena e ás e ganhar direto."]];
  return `<div class="col" style="gap:14px"><div class="card col" style="gap:10px"><p class="sub" style="font-size:15px">Uma partida de Aliado pode durar de 10 minutos a uma hora, com muita gritaria e gíria, igual ao truco gaúcho. As principais:</p>
    <div class="mcards">${G.map(([t, d]) => `<div class="mcard"><b>${t}</b><p>${esc(d)}</p></div>`).join("")}</div></div></div>`;
}

/* ---------- Ritmo da partida ---------- */
function pararTimer(){ if (AL.timer){ clearTimeout(AL.timer); AL.timer = null; } }
function agendar(){
  const G = AL.G; if (!G || AL.timer || G.phase === "over" || AL.aba !== "jogar" || AL.setup) return;
  const p = G.turn, hum = humano(G, p);
  let f = null, ms = 0;
  if (G.phase === "pass" || G.phase === "end") { f = () => { fimVez(G); AL.sel = null; }; ms = G.phase === "pass" ? 1500 : (hum ? 700 : 900); }
  else if (!hum && G.phase === "roll") { f = () => rolarAnim(); ms = 700; }
  else if (!hum && G.phase === "move") { f = () => { const seq = melhorPlano(G); if (seq.length) aplicar(G, seq[0]); else G.phase = "end"; }; ms = 850; }
  else if (hum && G.phase === "move") { const ops = legal(G); const fontes = new Set(ops.map(o => o.t === "exit" ? -1 : o.from)); if (fontes.size === 1 && AL.sel == null){ AL.sel = [...fontes][0]; return draw(); } }
  if (!f) return;
  AL.timer = setTimeout(() => { AL.timer = null; if (!g$("#al-root")) return; f(); fim(); }, ms);
}
function fim(){
  const G = AL.G;
  if (G.phase === "over" && !G.contado){ G.contado = true; try { const s = JSON.parse(localStorage.getItem(STATS) || "null") || [0, 0]; s[G.winner]++; localStorage.setItem(STATS, JSON.stringify(s)); } catch (e) {} }
  salvar(); draw();
}
function rolarAnim(){
  const G = AL.G; AL.anim = true; rolar(G); AL.sel = null;
  setTimeout(() => { AL.anim = false; const el = g$(".al-dados"); if (el) el.classList.remove("rolando"); }, 450);
}

/* ---------- Ações ---------- */
Object.assign(ACT, {
  alAba(a){ AL.aba = a; pararTimer(); render(); },
  alPreset(a){ const pr = PRESETS.find(x => x[0] === a); AL.setup = {preset:a, seats:pr[3].slice()}; draw(); },
  alSeat(a){ const s = AL.setup; s.seats[+a] = s.seats[+a] === "h" ? "c" : "h"; s.preset = (PRESETS.find(x => x[3].join() === s.seats.join()) || [""])[0]; draw(); },
  alNovo(){ pararTimer(); AL.G = novo(AL.setup.seats.slice()); AL.setup = null; AL.sel = null; log(AL.G, "Partida começou. O Fluminense joga primeiro."); salvar(); draw(); },
  alVolta(){ AL.setup = null; draw(); },
  alSetup(){ pararTimer(); AL.setup = {preset:"", seats:AL.G ? AL.G.seats.slice() : PRESETS[0][3].slice()}; AL.setup.preset = (PRESETS.find(x => x[3].join() === AL.setup.seats.join()) || [""])[0]; draw(); scrollTo(0, 0); },
  alRevanche(){ pararTimer(); AL.G = novo(AL.G.seats.slice()); AL.sel = null; log(AL.G, "Revanche! O Fluminense joga primeiro."); salvar(); draw(); },
  alRolar(){ const G = AL.G; if (!G || G.phase !== "roll" || !humano(G, G.turn)) return; pararTimer(); rolarAnim(); fim(); },
  alSel(a){ AL.sel = a === "" || a == null ? null : +a; draw(); },
  alJoga(a){ const G = AL.G; if (!G || G.phase !== "move" || !humano(G, G.turn)) return; const o = legal(G)[+a]; if (!o) return; aplicar(G, o); AL.sel = null; fim(); }
});

window.viewAliado = viewAliado;
window.aliadoDraw = draw;
})();
