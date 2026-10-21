/* Araba Bul v3 — oyun motoru. Veri: data.js (window.AB_CARS, window.AB_CREDITS). */
(() => {
  'use strict';
  const CARS = window.AB_CARS || [];
  const CRED = window.AB_CREDITS || {};
  const BY = Object.fromEntries(CARS.map(c => [c.id, c]));
  const CATS = {
    a: { key: 'a', name: 'Arka Stop', blurb: 'Stop lambasından modeli bil' },
    f: { key: 'f', name: 'Ön Far', blurb: 'Farın çizgisinden modeli bil' },
    k: { key: 'k', name: 'Kokpit', blurb: 'Torpido ve direksiyondan bil' },
  };
  const LV = {
    e: { key: 'e', name: 'Ekspert', time: 20, base: 100, perSec: 5, xp: 10, desc: 'Marka ve model. 20 sn, bir 50:50 hakkı.' },
    p: { key: 'p', name: 'ProEkspert', time: 12, base: 150, perSec: 10, xp: 15, desc: 'Nesil ve kasa kodu. Yakın kadraj, 12 sn.' },
  };
  const QN = 10;
  const $ = s => document.querySelector(s);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const imgUrl = n => 'img/' + n + '.webp';

  /* ---------- kayıt ---------- */
  const KEY = 'arababul.v3';
  const S = (() => {
    let s = null;
    try { s = JSON.parse(localStorage.getItem(KEY)); } catch (e) { /* yok */ }
    return Object.assign({ xp: 0, lv: 'e', best: {}, seen: { a: [], f: [], k: [] }, garage: {}, streak: { n: 0, last: '' }, day: null, week: null, claimed: {}, daily: {}, rounds: 0 }, s || {});
  })();
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* depolama kapalı */ } };

  /* ---------- tarih ---------- */
  const pad = n => String(n).padStart(2, '0');
  const dstr = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const today = () => dstr();
  const yesterday = () => { const d = new Date(); d.setDate(d.getDate() - 1); return dstr(d); };
  function isoWeek(d = new Date()) {
    const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const wd = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - wd);
    const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
    return t.getUTCFullYear() + '-H' + pad(Math.ceil(((t - y0) / 864e5 + 1) / 7));
  }
  const AYLAR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
  const trDate = (d = new Date()) => d.getDate() + ' ' + AYLAR[d.getMonth()];
  function untilMidnight() { const n = new Date(), m = new Date(n); m.setHours(24, 0, 0, 0); const h = Math.floor((m - n) / 36e5), mi = Math.floor((m - n) % 36e5 / 6e4); return `${h} sa ${mi} dk`; }
  function untilMonday() { const n = new Date(), m = new Date(n); m.setHours(24, 0, 0, 0); while (m.getDay() !== 1) m.setDate(m.getDate() + 1); const d = Math.floor((m - n) / 864e5), h = Math.floor((m - n) % 864e5 / 36e5); return d ? `${d} gün ${h} sa` : `${h} sa`; }

  /* ---------- rastgelelik (tohumlu) ---------- */
  function hash(s) { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  const pickN = (arr, n, R) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a.slice(0, n); };

  /* ---------- seviye ---------- */
  function levelOf(xp) { let l = 1, need = 150, acc = 0; while (xp >= acc + need) { acc += need; l++; need = 150 + (l - 1) * 75; } return { l, into: xp - acc, need }; }
  const TITLES = [[1, 'Çırak'], [3, 'Meraklı'], [6, 'Usta'], [10, 'Ekspert'], [15, 'ProEkspert'], [22, 'Efsane']];
  const titleOf = l => TITLES.filter(t => l >= t[0]).pop()[1];

  /* ---------- görev sayaçları ---------- */
  function periods() {
    const d = today(), w = isoWeek();
    if (!S.day || S.day.date !== d) S.day = { date: d, ca: 0, cf: 0, ck: 0, streak: 0, pro: 0, daily: 0, eight: 0, fast: 0 };
    if (!S.week || S.week.id !== w) S.week = { id: w, correct: 0, days: [], cats8: [], pro: 0, cars: 0 };
  }
  const DAILY = [
    { id: 'ca', t: 'Arka Stop’ta 8 doğru yap', n: 8, v: d => d.ca, xp: 60 },
    { id: 'cf', t: 'Ön Far’da 8 doğru yap', n: 8, v: d => d.cf, xp: 60 },
    { id: 'ck', t: 'Kokpit’te 6 doğru yap', n: 6, v: d => d.ck, xp: 60 },
    { id: 'st', t: 'Bir turda 5 seri yakala', n: 5, v: d => d.streak, xp: 70 },
    { id: 'pr', t: 'ProEkspert’te bir tur bitir', n: 1, v: d => d.pro, xp: 80 },
    { id: 'e8', t: 'Bir turda en az 8 doğru yap', n: 1, v: d => d.eight, xp: 70 },
    { id: 'fs', t: '5 soruyu 5 saniyenin altında bil', n: 5, v: d => d.fast, xp: 60 },
  ];
  const DY = { id: 'dy', t: 'Günün Turu’nu oyna', n: 1, v: d => d.daily, xp: 50 };
  const WEEKLY = [
    { id: 'wc', t: 'Bu hafta 120 doğru yap', n: 120, v: w => w.correct, xp: 300 },
    { id: 'wd', t: '5 farklı günde oyna', n: 5, v: w => w.days.length, xp: 300 },
    { id: 'w8', t: 'Üç kategoride de 8+ doğrulu tur yap', n: 3, v: w => w.cats8.length, xp: 350 },
    { id: 'wp', t: 'ProEkspert’te toplam 4.000 puan topla', n: 4000, v: w => w.pro, xp: 350 },
    { id: 'wg', t: 'Garajına 15 yeni araç ekle', n: 15, v: w => w.cars, xp: 300 },
  ];
  const dailyMissions = () => [DY].concat(pickN(DAILY, 2, rng(hash('gorev' + today()))));
  const weeklyMissions = () => pickN(WEEKLY, 3, rng(hash('hafta' + isoWeek())));
  function missionState(m, src, pid) { const v = Math.min(m.v(src), m.n); return { m, v, done: v >= m.n, claimed: !!S.claimed[pid + ':' + m.id] }; }
  function allMissions() {
    periods();
    return {
      daily: dailyMissions().map(m => missionState(m, S.day, S.day.date)),
      weekly: weeklyMissions().map(m => missionState(m, S.week, S.week.id)),
    };
  }
  function claimMissions() {
    const got = []; const ms = allMissions();
    const go = (list, pid) => list.forEach(x => { if (x.done && !x.claimed) { S.claimed[pid + ':' + x.m.id] = 1; S.xp += x.m.xp; got.push(`Görev tamam: ${x.m.t} · +${x.m.xp} XP`); } });
    go(ms.daily, S.day.date); go(ms.weekly, S.week.id);
    // eski kayıtları temizle
    const keep = new Set([S.day.date, S.week.id]);
    Object.keys(S.claimed).forEach(k => { if (!keep.has(k.split(':')[0])) delete S.claimed[k]; });
    return got;
  }
  const openMissions = () => { const ms = allMissions(); return ms.daily.concat(ms.weekly).filter(x => !x.done).length; };

  /* ---------- soru üretimi ---------- */
  const label = c => c.b + ' ' + c.m;
  const decade = y => { const d = Math.floor(y / 10) * 10; return d + '’' + ([10, 30, 40, 60, 90].includes(d % 100) ? 'lar' : 'ler'); };
  const yrs = c => c.y0 + '–' + (c.y1 || 'günümüz');
  function options(car, lv, R) {
    const pro = lv === 'p';
    const cand = CARS.filter(c => c.id !== car.id).map(c => {
      let s = R() * (pro ? 3 : 5);
      if (pro) { if (label(c) === label(car)) s += 6; if (c.b === car.b) s += 3; }
      else if (c.b === car.b) s += 1;
      if (c.seg === car.seg) s += 1.5;
      if (c.body === car.body) s += 1;
      return [s, c];
    }).sort((x, y) => y[0] - x[0]);
    const out = [car.id]; const seen = new Set([pro ? car.id : label(car)]);
    for (const [, c] of cand) {
      const k = pro ? c.id : label(c);
      if (seen.has(k)) continue;
      seen.add(k); out.push(c.id);
      if (out.length === 4) break;
    }
    return pickN(out, out.length, R);
  }
  // Araç seçimi ve şıklar ayrı rastgele akışlardan gelir; böylece tohum taraması yalnız araç seçimini hesaplar.
  function pickCars(cats, seed) {
    const R = rng(seed); const used = new Set(); const out = [];
    for (let i = 0; i < QN; i++) {
      const cat = cats[i % cats.length];
      const pool = CARS.filter(c => c[cat].length && !used.has(c.id));
      const car = pool[Math.floor(R() * pool.length)];
      used.add(car.id);
      out.push({ cat, id: car.id, img: car[cat][Math.floor(R() * car[cat].length)] });
    }
    return out;
  }
  function buildRound(cats, lv, seed) {
    const R = rng((seed ^ 0x9E3779B9) >>> 0);
    return pickCars(cats, seed).map(p => ({ ...p, opts: options(BY[p.id], lv, R), zoom: lv === 'p' ? { x: Math.round(30 + R() * 40), y: Math.round(30 + R() * 40) } : null }));
  }
  // Yeni tur: yakın zamanda gördüğün araçları getirmeyen bir tohum arar. Havuz bitene kadar aynı araç tekrar gelmez.
  function freshSeed(cat) {
    const hist = (S.hist && S.hist[cat]) || {}; const now = S.rounds || 0;
    const pool = CARS.filter(c => c[cat].length).length;
    const win = Math.max(1, Math.floor(pool / QN) - 1);
    let best = 0, bestP = Infinity;
    for (let t = 0; t < 400; t++) {
      const seed = (Math.random() * 2 ** 32) >>> 0; let p = 0;
      for (const q of pickCars([cat], seed)) { const at = hist[q.id]; if (at != null && now - at < win) p += win - (now - at); }
      if (p < bestP) { best = seed; bestP = p; if (!p) break; }
    }
    return best;
  }

  /* ---------- meydan okuma kodu ---------- */
  // biçim: m-<kat>-<seviye>-<tohum36>-<puan>   (ör. m-a-e-1x9k3f-1840)
  const encChal = (cat, lv, seed, score) => `m-${cat}-${lv}-${seed.toString(36)}-${score}`;
  function decChal(s) {
    const m = /^m-([afk])-([ep])-([0-9a-z]{1,8})-(\d{1,6})$/.exec(String(s || '').trim().toLowerCase().replace(/^#/, ''));
    return m ? { cat: m[1], lv: m[2], seed: parseInt(m[3], 36) >>> 0, score: +m[4] } : null;
  }
  const shareBase = () => location.origin && location.origin !== 'null' ? location.origin + location.pathname : '';

  /* ---------- ikonlar ---------- */
  const IC = {
    fire: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2c1 3.5-1.5 5-1.5 7.5 0 1.4 1 2.5 2.3 2.5 1.7 0 2.4-1.6 2-3.6C17.6 10.3 19 12.8 19 15.5 19 19.6 15.9 22 12 22s-7-2.4-7-6.3C5 10.4 10.2 8.2 12 2z"/></svg>',
    play: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M10 8.5v7l6-3.5z" fill="currentColor" stroke="none"/></svg>',
    flag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M5 21V4h11l-1.5 4L16 12H5"/></svg>',
    car: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M3 16v-4l2-5h14l2 5v4z"/><circle cx="7.5" cy="16.5" r="1.8"/><circle cx="16.5" cy="16.5" r="1.8"/><path d="M3 12h18"/></svg>',
    arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  };

  /* ---------- çerçeve ---------- */
  let route = 'home';
  let G = null;           // aktif tur
  let LAST = null;        // son tur sonucu
  let CHAL = decChal(location.hash);
  let gFilter = 'hepsi';

  function header() {
    const lv = levelOf(S.xp);
    const nav = [['home', 'Oyna'], ['missions', 'Görevler'], ['garage', 'Garaj']];
    $('#nav').innerHTML = nav.map(([r, t]) => `<button data-act="go" data-r="${r}" ${route === r ? 'aria-current="page"' : ''}>${t}</button>`).join('');
    const open = openMissions();
    $('#tabs').innerHTML = [['home', 'Oyna', IC.play], ['missions', 'Görevler', IC.flag], ['garage', 'Garaj', IC.car]].map(([r, t, ic]) =>
      `<button data-act="go" data-r="${r}" ${route === r ? 'aria-current="page"' : ''}>${ic}${t}${r === 'missions' && open ? '<span class="dot" aria-label="açık görev var"></span>' : ''}</button>`).join('');
    const st = S.streak.last === today() || S.streak.last === yesterday() ? S.streak.n : 0;
    $('#chips').innerHTML = `<span class="chip fire" title="Üst üste oynanan gün">${IC.fire}<span class="num">${st}</span> gün</span>` +
      `<button class="chip lvl" data-act="go" data-r="missions" title="Seviye">Sv <b class="num">${lv.l}</b><span class="tt"> · ${titleOf(lv.l)}</span></button>`;
  }
  function go(r) {
    if (G && G.timer) cancelAnimationFrame(G.timer);
    if (r !== 'play') G = null;
    route = r; document.body.classList.toggle('playing', r === 'play');
    header(); render(); window.scrollTo(0, 0);
  }
  function render() {
    const v = $('#view');
    if (route === 'home') v.innerHTML = vHome();
    else if (route === 'play') { v.innerHTML = vPlay(); startTimer(); }
    else if (route === 'result') v.innerHTML = vResult();
    else if (route === 'missions') v.innerHTML = vMissions();
    else if (route === 'garage') v.innerHTML = vGarage();
    fillAds();
  }

  /* ---------- reklam ---------- */
  // config.js: mode 'off' (alanlar gizli), 'preview' (yer tutucu), 'adsense' (gerçek reklam)
  const ADS = (window.AB_CONFIG && window.AB_CONFIG.ads) || { mode: 'preview' };
  let adsLoaded = false;
  function consent() { try { return localStorage.getItem('arababul.consent'); } catch (e) { return null; } }
  function fillAds() {
    const live = ADS.mode === 'adsense' && ADS.client;
    document.body.classList.toggle('no-ads', !(live || ADS.mode === 'preview'));
    if (live && consent() === null) askConsent();
    document.querySelectorAll('.ad[data-ad-slot]').forEach(el => {
      if (el.dataset.filled) return;
      const slot = ADS.slots && ADS.slots[el.dataset.adSlot];
      if (live && slot) {
        if (!adsLoaded) {
          (window.adsbygoogle = window.adsbygoogle || []).requestNonPersonalizedAds = consent() === 'yes' ? 0 : 1;
          const s = document.createElement('script'); s.async = true; s.crossOrigin = 'anonymous';
          s.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' + encodeURIComponent(ADS.client);
          document.head.appendChild(s); adsLoaded = true;
        }
        el.innerHTML = `<ins class="adsbygoogle" style="display:block;width:100%;height:100%" data-ad-client="${esc(ADS.client)}" data-ad-slot="${esc(slot)}"></ins>`;
        el.classList.add('live'); el.dataset.filled = '1';
        try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch (e) { /* engelleyici */ }
      } else if (ADS.mode !== 'preview') el.hidden = true;
    });
  }
  function askConsent() {
    if ($('#consent')) return;
    document.body.insertAdjacentHTML('beforeend', `<div class="consent" id="consent" role="dialog" aria-label="Çerez tercihi">
      <p>Reklamları kişiselleştirmek için çerez kullanılabilir. Kabul etmezsen reklamlar kişiselleştirilmeden gösterilir. <a href="gizlilik.html">Gizlilik</a></p>
      <div><button class="btn ghost sm" data-act="consent" data-v="no">Reddet</button><button class="btn sm" data-act="consent" data-v="yes">Kabul et</button></div></div>`);
  }

  /* ---------- ana sayfa ---------- */
  // Kategori kartlarında vitrin: ikonik ve pahalı araçlardan seçilmiş kareler, her gün biri.
  const SHOWCASE = {
    a: ['ford-mustang-s550-tail', 'nissan-gtr-r35-tail', 'mini-hatch-f56-tail', 'mazda-mx5-nd-tail'],
    f: ['ford-mustang-s550-head', 'porsche-911-992-head', 'nissan-gtr-r35-head', 'bmw-x5-g05-head', 'mini-hatch-f56-head'],
    k: ['lambo-huracan-interior', 'porsche-911-992-interior', 'ford-mustang-s550-interior', 'mercedes-e-w213-interior', 'bmw-x5-g05-interior', 'rr-evoque-l551-interior'],
  };
  function catThumb(cat) {
    const list = SHOWCASE[cat].filter(n => CRED[n]);
    return list.length ? imgUrl(list[hash(cat + today()) % list.length]) : '';
  }
  function vHome() {
    const lv = S.lv; const d = S.daily[today()];
    const ms = allMissions();
    const chal = CHAL ? `<div class="chal"><p><span class="eyebrow">Meydan okuma</span><br><b>${CATS[CHAL.cat].name} · ${LV[CHAL.lv].name}</b> turunda hedef <b class="num">${CHAL.score.toLocaleString('tr-TR')}</b> puan. Aynı 10 soru seni bekliyor.</p><button class="btn" data-act="chal">Kabul et</button></div>` : '';
    return `<div class="stack">
      ${chal}
      <div class="hello"><h1>Hangi araba?</h1><p>Yakın çekim bir fotoğraf, dört şık. Kategoriyi seç, hemen başla.</p></div>
      <div class="seg" role="group" aria-label="Zorluk">
        ${Object.values(LV).map(l => `<button data-act="lv" data-lv="${l.key}" aria-pressed="${lv === l.key}"><b>${l.name}</b><span>${l.desc}</span></button>`).join('')}
      </div>
      <div class="cats">
        ${Object.values(CATS).map(c => { const b = S.best[c.key + lv]; return `<button class="cat ${c.key}" data-act="start" data-cat="${c.key}" aria-label="${c.name} oyna">
          <span class="ph"><img src="${catThumb(c.key)}" alt="" loading="lazy"></span>
          <span class="tx"><h3>${c.name}</h3><span>${c.blurb}</span>
          <span class="meta"><span>Rekor <b class="num">${b ? b.toLocaleString('tr-TR') : '—'}</b></span></span></span>
          <span class="go">${IC.arrow}</span></button>`; }).join('')}
      </div>
      <div class="daily">
        <div><div class="tri" aria-hidden="true"><i></i><i></i><i></i></div>
          <span class="when">${trDate()} · herkes için aynı 10 soru</span>
          <h2>Günün Turu</h2>
          ${d ? `<p>Bugünkü sonucun: <b class="num">${d.correct}/10</b> · <b class="num">${d.score.toLocaleString('tr-TR')}</b> puan. Yenisi ${untilMidnight()} sonra.</p><div class="marks">${d.marks.map(m => `<i class="${m ? '' : 'x'}"></i>`).join('')}</div>`
            : `<p>Üç kategoriden karışık, Ekspert seviyesinde. Günde bir kez.</p>`}
        </div>
        ${d ? `<button class="btn ghost sm" data-act="sharedaily">Paylaş</button>` : `<button class="btn" data-act="daily">Başla</button>`}
      </div>
      <section class="card mini" aria-label="Bugünün görevleri">
        <div class="sec-h" style="padding-top:12px"><span class="eyebrow">Bugünün görevleri</span><button class="link small" data-act="go" data-r="missions">Tümü</button></div>
        ${ms.daily.map(mRow).join('')}
      </section>
      <form class="code" data-form="code" autocomplete="off">
        <label for="chalcode">Arkadaşından meydan okuma kodu mu geldi?</label>
        <input id="chalcode" name="code" placeholder="m-a-e-1x9k3f-1840" aria-label="Meydan okuma kodu">
        <button class="btn ghost sm" type="submit">Oyna</button>
      </form>
      <div class="ad ad-mob" data-ad-slot="home-bottom" aria-label="Reklam alanı"><span>Reklam alanı</span><b>320 × 100</b></div>
      <footer class="foot"><a href="gizlilik.html">Gizlilik</a><button class="link" data-act="go" data-r="garage">Fotoğraf hakları</button><span>Fotoğraflar: Wikimedia Commons</span></footer>
    </div>`;
  }
  function mRow(x) {
    const pct = Math.round(x.v / x.m.n * 100);
    const fmt = n => n.toLocaleString('tr-TR');
    return `<div class="mrow ${x.done ? 'done' : ''}"><span class="t">${x.m.t}</span><span class="r num">${x.done ? '✓ +' + x.m.xp + ' XP' : fmt(x.v) + '/' + fmt(x.m.n)}</span><div class="bar"><i style="width:${pct}%"></i></div></div>`;
  }

  /* ---------- oyun ---------- */
  function startRound(opts) {
    const { cats, lv, seed, mode, target } = opts;
    G = { cats, lv, seed, mode, target, qs: buildRound(cats, lv, seed), i: 0, score: 0, correct: 0, streak: 0, bestStreak: 0, fast: 0, fifty: lv === 'e' ? 1 : 0, answers: [], locked: false };
    go('play');
  }
  function vPlay() {
    const q = G.qs[G.i]; const lv = LV[G.lv];
    const z = q.zoom ? `style="transform:scale(1.45);transform-origin:${q.zoom.x}% ${q.zoom.y}%"` : '';
    const opt = (id, n) => { const c = BY[id]; return `<button class="opt" data-act="ans" data-id="${id}"><span class="k">${n + 1}</span><span class="n"><b>${esc(label(c))}</b>${G.lv === 'p' ? `<span>${esc(c.g)} · <span class="mono">${esc(c.c)}</span> · ${yrs(c)}</span>` : ''}</span></button>`; };
    const next = G.qs[G.i + 1]; if (next) { const im = new Image(); im.src = imgUrl(next.img); }
    return `<div class="play">
      <div class="phud">
        <button class="x" data-act="quit" aria-label="Turu bırak">${IC.x}</button>
        <span class="pill ${G.mode === 'daily' ? '' : q.cat}">${G.mode === 'daily' ? 'Günün Turu · ' + CATS[q.cat].name : CATS[q.cat].name} · ${lv.name}</span>
        <span class="qn num">${G.i + 1}/${QN}</span>
        <span class="sc"><b class="num" id="score">${G.score.toLocaleString('tr-TR')}</b><span>puan</span></span>
      </div>
      <div class="dots" aria-hidden="true">${G.qs.map((_, i) => `<i class="${i < G.answers.length ? (G.answers[i].ok ? 'ok' : 'no') : i === G.i ? 'cur' : ''}"></i>`).join('')}</div>
      <div class="pgrid">
        <div class="photo" id="photo">
          <img src="${imgUrl(q.img)}" alt="Tahmin edilecek aracın yakın çekim fotoğrafı" ${z}>
          ${G.streak >= 2 ? `<span class="streak">${G.streak} seri</span>` : ''}
          <span class="sec num" id="sec">${lv.time}</span>
          <span class="tm"><i id="tbar"></i></span>
        </div>
        <div class="stack" style="gap:10px">
          <div class="opts" id="opts">${q.opts.map(opt).join('')}</div>
          <div class="ptools" id="ptools">
            ${G.lv === 'e' ? `<button class="btn ghost sm" data-act="fifty" ${G.fifty ? '' : 'disabled'}>50:50${G.fifty ? '' : ' kullanıldı'}</button>` : '<span class="small muted">ProEkspert’te joker yok.</span>'}
            <span class="small muted">Tuş: 1–4</span>
          </div>
          <div id="reveal"></div>
        </div>
      </div>
    </div>`;
  }
  function startTimer() {
    const lv = LV[G.lv]; G.t0 = performance.now(); G.locked = false;
    const bar = $('#tbar'), sec = $('#sec');
    const tick = () => {
      if (!G || G.locked) return;
      const left = Math.max(0, lv.time - (performance.now() - G.t0) / 1000);
      bar.style.transform = `scaleX(${left / lv.time})`;
      bar.classList.toggle('low', left < 4);
      sec.textContent = Math.ceil(left);
      if (left <= 0) { answer(null); return; }
      G.timer = requestAnimationFrame(tick);
    };
    G.timer = requestAnimationFrame(tick);
  }
  function answer(pick) {
    if (!G || G.locked) return;
    G.locked = true; cancelAnimationFrame(G.timer);
    const q = G.qs[G.i], lv = LV[G.lv], car = BY[q.id];
    const used = (performance.now() - G.t0) / 1000, left = Math.max(0, lv.time - used);
    const ok = pick === q.id; let pts = 0;
    periods();
    if (ok) {
      G.streak++; G.bestStreak = Math.max(G.bestStreak, G.streak); G.correct++;
      pts = Math.round((lv.base + Math.ceil(left) * lv.perSec) * (1 + Math.min(G.streak - 1, 5) * 0.1));
      G.score += pts;
      if (used < 5) { G.fast++; S.day.fast++; }
      S.day['c' + q.cat]++; S.week.correct++;
      S.day.streak = Math.max(S.day.streak, G.streak);
      if (!S.garage[q.id]) { S.garage[q.id] = today(); S.week.cars++; }
    } else G.streak = 0;
    S.hist = S.hist || {}; (S.hist[q.cat] = S.hist[q.cat] || {})[q.id] = S.rounds || 0;
    save();
    G.answers.push({ id: q.id, img: q.img, cat: q.cat, ok, pick, pts });
    // görsel geri bildirim
    document.querySelectorAll('.opt').forEach(b => {
      b.disabled = true;
      if (b.dataset.id === q.id) b.classList.add('ok');
      else if (b.dataset.id === pick) b.classList.add('no');
      else b.classList.add('gone');
    });
    const ph = $('#photo img'); if (ph) ph.style.transform = 'none';
    $('#score').textContent = G.score.toLocaleString('tr-TR');
    const cr = CRED[q.img];
    if (cr) $('#photo').insertAdjacentHTML('beforeend', `<span class="cr">Foto: ${esc(cr[0])} · ${esc(cr[1])} · <a href="https://commons.wikimedia.org/wiki/${encodeURI(cr[2])}" target="_blank" rel="noopener">kaynak</a></span>`);
    $('#ptools').hidden = true;
    const last = G.i === QN - 1;
    $('#reveal').innerHTML = `<div class="reveal ${ok ? 'ok' : 'no'}" role="status">
      <span class="v">${ok ? 'Doğru · +' + pts : pick ? 'Yanlış' : 'Süre doldu'}</span>
      <span class="car">${esc(label(car))}</span>
      <span class="gen">${esc(car.g)} · <span class="mono">${esc(car.c)}</span> · ${yrs(car)}</span>
      <button class="btn" data-act="next" id="nextbtn">${last ? 'Sonucu gör' : 'Sonraki soru'}<i class="${ok ? 'run' : ''}"></i></button>
    </div>`;
    $('#nextbtn').focus({ preventScroll: true });
    const rv = $('#reveal'); if (rv && rv.getBoundingClientRect().bottom > innerHeight) rv.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'end' });
    if (ok) G.auto = setTimeout(next, 1800);
  }
  function next() {
    if (!G) return; clearTimeout(G.auto);
    if (G.i < QN - 1) { G.i++; render(); const p = $('.play'); if (p && p.getBoundingClientRect().top < 0) window.scrollTo(0, 0); }
    else finish();
  }
  function fifty() {
    if (!G || !G.fifty || G.locked) return;
    G.fifty = 0; const q = G.qs[G.i];
    const wrong = [...document.querySelectorAll('.opt')].filter(b => b.dataset.id !== q.id);
    pickN(wrong, 2, Math.random).forEach(b => { b.disabled = true; b.classList.add('gone'); });
    const f = document.querySelector('[data-act="fifty"]'); if (f) { f.disabled = true; f.textContent = '50:50 kullanıldı'; }
  }
  function finish() {
    periods();
    const lv = LV[G.lv]; const t = today();
    const key = G.cats.length === 1 ? G.cats[0] + G.lv : null;
    const prevBest = key ? S.best[key] || 0 : 0;
    if (key && G.score > prevBest) S.best[key] = G.score;
    if (G.lv === 'p') { S.day.pro++; S.week.pro += G.score; }
    if (G.correct >= 8) { S.day.eight = 1; if (G.cats.length === 1 && !S.week.cats8.includes(G.cats[0])) S.week.cats8.push(G.cats[0]); }
    if (G.mode === 'daily') { S.day.daily = 1; S.daily = { [t]: { score: G.score, correct: G.correct, marks: G.answers.map(a => a.ok ? 1 : 0) } }; }
    if (!S.week.days.includes(t)) S.week.days.push(t);
    if (S.streak.last !== t) { S.streak.n = S.streak.last === yesterday() ? S.streak.n + 1 : 1; S.streak.last = t; }
    const xp = G.correct * lv.xp + (G.correct === QN ? 50 : 0);
    const lvBefore = levelOf(S.xp).l; S.xp += xp; S.rounds++;
    const toasts = claimMissions();
    const lvAfter = levelOf(S.xp).l;
    if (lvAfter > lvBefore) toasts.unshift(`Seviye atladın: Sv ${lvAfter} · ${titleOf(lvAfter)}`);
    save();
    LAST = { ...G, xp, toasts, newBest: key && G.score > prevBest && prevBest > 0, prevBest };
    if (G.mode === 'chal') CHAL = null;
    go('result');
  }

  /* ---------- sonuç ---------- */
  function shareText(r) {
    const head = r.mode === 'daily' ? `Araba Bul · Günün Turu · ${trDate()}` : `Araba Bul · ${CATS[r.cats[0]].name} · ${LV[r.lv].name}`;
    const marks = r.answers.map(a => a.ok ? '🟩' : '🟥').join('');
    const code = r.mode === 'daily' ? '' : encChal(r.cats[0], r.lv, r.seed, r.score);
    const base = shareBase();
    return `${head}\n${r.correct}/10 · ${r.score.toLocaleString('tr-TR')} puan\n${marks}` + (code ? `\nBeni geç: ${base ? base + '#' + code : 'kod ' + code}` : base ? `\n${base}` : '');
  }
  function vResult() {
    const r = LAST; if (!r) return vHome();
    const code = r.mode === 'daily' ? '' : encChal(r.cats[0], r.lv, r.seed, r.score);
    const vs = r.target != null ? (r.score > r.target ? `<div class="vs win">Hedef ${r.target.toLocaleString('tr-TR')} puandı. ${(r.score - r.target).toLocaleString('tr-TR')} puan farkla geçtin.</div>`
      : `<div class="vs lose">Hedef ${r.target.toLocaleString('tr-TR')} puandı. ${(r.target - r.score + 1).toLocaleString('tr-TR')} puan eksik kaldın.</div>`) : '';
    const title = r.mode === 'daily' ? 'Günün Turu' : CATS[r.cats[0]].name + ' · ' + LV[r.lv].name;
    return `<div class="stack">
      <div class="res-hero">
        <span class="eyebrow">${esc(title)}</span>
        <div class="big"><b class="num">${r.score.toLocaleString('tr-TR')}</b><span>puan · ${r.correct}/10 doğru${r.newBest ? ' · yeni rekor' : ''}</span></div>
        <div class="stats">
          <div class="stat"><b class="num">${r.bestStreak}</b><span>En uzun seri</span></div>
          <div class="stat"><b class="num">+${r.xp}</b><span>XP</span></div>
          <div class="stat"><b class="num">${r.mode === 'daily' ? '—' : (S.best[r.cats[0] + r.lv] || 0).toLocaleString('tr-TR')}</b><span>Rekor</span></div>
        </div>
        ${vs}
        ${r.toasts.length ? `<div class="toast-list">${r.toasts.map(t => `<div class="toast">${esc(t)}</div>`).join('')}</div>` : ''}
        <div class="acts">
          <button class="btn" data-act="again">${r.mode === 'daily' ? 'Kategori seç' : 'Tekrar oyna'}</button>
          <button class="btn ghost" data-act="share">${code ? 'Meydan oku' : 'Paylaş'}</button>
          <button class="btn ghost" data-act="go" data-r="home">Ana sayfa</button>
        </div>
        <div id="sharebox" hidden></div>
      </div>
      <div class="ad ad-mpu" data-ad-slot="result" aria-label="Reklam alanı"><span>Reklam alanı</span><b>300 × 250</b></div>
      <div class="sec-h"><h2>Bu turdaki araçlar</h2></div>
      <div class="review">${r.answers.map(a => { const c = BY[a.id]; return `<div class="rv ${a.ok ? 'ok' : 'no'}"><img src="${imgUrl(a.img)}" alt="${esc(label(c))}" loading="lazy"><div><b>${esc(label(c))}</b>${esc(c.g)} · ${yrs(c)}</div></div>`; }).join('')}</div>
    </div>`;
  }
  function share(text) {
    const box = $('#sharebox');
    const done = ok => { if (box) { box.hidden = false; box.innerHTML = ok ? '<div class="toast">Kopyalandı. Arkadaşına gönder.</div>' : `<div class="copybox"><input id="sharetext" readonly value="${esc(text.replace(/\n/g, ' '))}" aria-label="Paylaşım metni"></div>`; if (!ok) { const i = $('#sharetext'); i.focus(); i.select(); } } };
    try { navigator.clipboard.writeText(text).then(() => done(true), () => done(false)); } catch (e) { done(false); }
  }

  /* ---------- görevler ---------- */
  function vMissions() {
    const lv = levelOf(S.xp); const ms = allMissions();
    const st = S.streak.last === today() || S.streak.last === yesterday() ? S.streak.n : 0;
    const days = []; for (let i = 6; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); days.push(d); }
    const played = new Set((S.week.days || []));
    const gun = ['Pz', 'Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct'];
    return `<div class="stack">
      <div class="card lvcard">
        <div class="lvbadge num">${lv.l}</div>
        <div><span class="eyebrow">Seviye</span><h2 style="font-size:28px;text-transform:uppercase">${titleOf(lv.l)}</h2></div>
        <div class="bar"><i style="width:${Math.round(lv.into / lv.need * 100)}%"></i></div>
        <span class="small muted num">${lv.into} / ${lv.need} XP · toplam ${S.xp.toLocaleString('tr-TR')} XP</span>
      </div>
      <section class="card" style="padding:14px 16px" aria-label="Seri">
        <div class="sec-h"><span class="eyebrow">Gün serisi</span><b class="num">${st} gün</b></div>
        <div class="streak-row" style="margin-top:10px">${days.map(d => `<i class="${played.has(dstr(d)) || (S.streak.last === dstr(d)) ? 'on' : ''}">${gun[d.getDay()]}</i>`).join('')}</div>
        <p class="small muted" style="margin:10px 0 0">Her gün en az bir tur bitir, seri büyüsün. Bir gün atlarsan sıfırlanır.</p>
      </section>
      <section class="card mini" aria-label="Günlük görevler">
        <div class="sec-h" style="padding-top:12px"><span class="eyebrow">Günlük</span><span class="reset">yenilenmeye ${untilMidnight()}</span></div>
        ${ms.daily.map(mRow).join('')}
      </section>
      <section class="card mini" aria-label="Haftalık görevler">
        <div class="sec-h" style="padding-top:12px"><span class="eyebrow">Haftalık</span><span class="reset">yenilenmeye ${untilMonday()}</span></div>
        ${ms.weekly.map(mRow).join('')}
      </section>
      <p class="small muted">Görevi bitirdiğin an XP hesabına eklenir. Puanın: doğru cevap + kalan saniye bonusu, seri arttıkça %10’ar artar (en fazla %50).</p>
    </div>`;
  }

  /* ---------- garaj ---------- */
  function vGarage() {
    const got = CARS.filter(c => S.garage[c.id]).length;
    const brands = [...new Set(CARS.map(c => c.b))].sort((a, b) => a.localeCompare(b, 'tr'));
    const list = CARS.filter(c => gFilter === 'hepsi' || (gFilter === 'bulunan' ? S.garage[c.id] : c.b === gFilter))
      .sort((a, b) => (S.garage[b.id] ? 1 : 0) - (S.garage[a.id] ? 1 : 0) || a.b.localeCompare(b.b, 'tr') || a.y0 - b.y0);
    const credits = Object.entries(CRED);
    return `<div class="stack">
      <div class="sec-h"><h2>Garaj</h2><span class="num"><b>${got}</b> / ${CARS.length} araç</span></div>
      <div class="bar"><i style="width:${Math.round(got / CARS.length * 100)}%"></i></div>
      <p class="small muted" style="margin:0">Bir aracı ilk kez doğru bildiğinde garajına girer. Kilitli kartlar seni bekleyen araçlar.</p>
      <div class="gfilter" role="group" aria-label="Filtre">
        ${['hepsi', 'bulunan'].concat(brands).map(b => `<button data-act="gf" data-b="${esc(b)}" aria-pressed="${gFilter === b}">${b === 'hepsi' ? 'Hepsi' : b === 'bulunan' ? 'Bulduklarım' : esc(b)}</button>`).join('')}
      </div>
      <div class="garage">${list.map(c => {
        const on = !!S.garage[c.id]; const im = c.a[0] || c.f[0] || c.k[0];
        return on ? `<div class="gc"><div class="im"><img src="${imgUrl(im)}" alt="${esc(label(c))}" loading="lazy"></div><div class="t"><b>${esc(label(c))}</b><span>${esc(c.g)} · <span class="mono">${esc(c.c)}</span> · ${yrs(c)}</span></div></div>`
          : `<div class="gc lock"><div class="im">${IC.car}</div><div class="t"><b>? ? ?</b><span>${esc(c.b)} · ${decade(c.y0)}</span></div></div>`;
      }).join('')}</div>
      <details class="card credits"><summary>Fotoğraf hakları (${credits.length})</summary>
        <p class="small muted">Tüm fotoğraflar Wikimedia Commons’tan, özgür lisanslı. Amblem, model yazısı ve plakalar kapatıldı, kareler kırpıldı.</p>
        <ol>${credits.map(([k, v]) => `<li>${esc(BY[k.replace(/-(tail|head|interior)(-\d+)?$/, '')] ? label(BY[k.replace(/-(tail|head|interior)(-\d+)?$/, '')]) : k)}: ${esc(v[0])}, ${esc(v[1])}, <a href="https://commons.wikimedia.org/wiki/${encodeURI(v[2])}" target="_blank" rel="noopener">Commons</a></li>`).join('')}</ol>
      </details>
      <div class="danger" id="danger"><button class="btn ghost sm" data-act="reset1">İlerlemeyi sıfırla</button></div>
    </div>`;
  }

  /* ---------- olaylar ---------- */
  document.addEventListener('click', e => {
    const t = e.target.closest('[data-act]'); if (!t) return;
    const a = t.dataset.act;
    if (a === 'go') go(t.dataset.r);
    else if (a === 'lv') { S.lv = t.dataset.lv; save(); render(); }
    else if (a === 'start') { const cat = t.dataset.cat; startRound({ cats: [cat], lv: S.lv, seed: freshSeed(cat), mode: 'cat' }); }
    else if (a === 'daily') startRound({ cats: ['a', 'f', 'k'], lv: 'e', seed: hash('gunun-turu-' + today()), mode: 'daily' });
    else if (a === 'chal' && CHAL) startRound({ cats: [CHAL.cat], lv: CHAL.lv, seed: CHAL.seed, mode: 'chal', target: CHAL.score });
    else if (a === 'ans') answer(t.dataset.id);
    else if (a === 'next') next();
    else if (a === 'fifty') fifty();
    else if (a === 'quit') { if (G) { cancelAnimationFrame(G.timer); clearTimeout(G.auto); } G = null; go('home'); }
    else if (a === 'again') { const r = LAST; if (r && r.mode !== 'daily') { const cat = r.cats[0]; startRound({ cats: [cat], lv: r.lv, seed: freshSeed(cat), mode: 'cat' }); } else go('home'); }
    else if (a === 'share') share(shareText(LAST));
    else if (a === 'sharedaily') { const d = S.daily[today()]; if (d) { const txt = `Araba Bul · Günün Turu · ${trDate()}\n${d.correct}/10 · ${d.score.toLocaleString('tr-TR')} puan\n${d.marks.map(m => m ? '🟩' : '🟥').join('')}`; try { navigator.clipboard.writeText(txt).then(() => { t.textContent = 'Kopyalandı'; }, () => { t.textContent = 'Kopyalanamadı'; }); } catch (err) { t.textContent = 'Kopyalanamadı'; } } }
    else if (a === 'gf') { gFilter = t.dataset.b; render(); }
    else if (a === 'reset1') $('#danger').innerHTML = '<span class="small">Tüm puan, garaj ve görevler silinsin mi?</span><button class="btn sm" data-act="reset2" style="background:var(--bad)">Evet, sıfırla</button><button class="btn ghost sm" data-act="go" data-r="garage">Vazgeç</button>';
    else if (a === 'consent') { try { localStorage.setItem('arababul.consent', t.dataset.v); } catch (err) { /* */ } $('#consent').remove(); if (adsLoaded) location.reload(); }
    else if (a === 'reset2') { try { localStorage.removeItem(KEY); } catch (err) { /* */ } location.reload(); }
  });
  document.addEventListener('submit', e => {
    const f = e.target.closest('[data-form="code"]'); if (!f) return;
    e.preventDefault();
    const c = decChal(f.elements.code.value);
    if (!c) { f.elements.code.setCustomValidity('Kod biçimi m-a-e-1x9k3f-1840 gibi olmalı.'); f.elements.code.reportValidity(); f.elements.code.setCustomValidity(''); return; }
    CHAL = c; startRound({ cats: [c.cat], lv: c.lv, seed: c.seed, mode: 'chal', target: c.score });
  });
  document.addEventListener('keydown', e => {
    if (route !== 'play' || !G) return;
    if (!G.locked && /^[1-4]$/.test(e.key)) { const b = document.querySelectorAll('.opt')[+e.key - 1]; if (b && !b.disabled) answer(b.dataset.id); }
    else if (G.locked && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); next(); }
  });
  window.addEventListener('hashchange', () => { const c = decChal(location.hash); if (c) { CHAL = c; if (route !== 'play') go('home'); } });

  /* ---------- başlat ---------- */
  function start() {
    periods(); claimMissions(); save();
    go('home');
    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
      try { navigator.serviceWorker.register('sw.js').catch(() => {}); } catch (e) { /* desteklenmiyor */ }
    }
  }
  window.claude?.hot?.ready ? window.claude.hot.ready(start) : start();
})();
