// Gera as imagens da Connect IQ Store em store/images: node store/render.mjs
// Usa um navegador Chromium em modo headless (BROWSER=/caminho/do/binario para trocar) e a
// Roboto do SDK da Garmin, a mesma fonte que o simulador usa nos relógios AMOLED.
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const out = join(here, 'images');
const browser = process.env.BROWSER ?? '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser';
const roboto = pathToFileURL(join(homedir(), 'Library/Application Support/Garmin/ConnectIQ/Fonts/Roboto-Regular.ttf'));
const fox = pathToFileURL(join(root, '../athly-ios/AthlyRunner/Resources/Assets.xcassets/AppIcon.appiconset/AppIcon.png'));

// Fundo sólido do ícone e da capa: a Garmin não aceita preto nem transparente.
const ICON_BG = '#16224F';
const BRAND = '#0EA5E9';

const strings = (dir) => {
    const xml = readFileSync(join(root, dir, 'strings/strings.xml'), 'utf8');
    return Object.fromEntries([...xml.matchAll(/<string id="(\w+)"[^>]*>([^<]*)<\/string>/g)].map((m) => [m[1], m[2]]));
};

// Textos de vitrine (hero) e nomes de treino de exemplo; o resto vem do strings.xml do app.
const LOCALES = {
    en: {
        strings: strings('resources'),
        headline: 'Your training plan,<br>on your wrist.',
        tagline: "Structured running workouts from Athly, in your watch's native workout player.",
        pills: ['Pace targets', 'Intervals & repeats', 'Next 7 days'],
        workouts: ['Intervals 6x400m', 'Easy run 8 km', 'Long run 18 km'],
    },
    pt: {
        strings: strings('resources-por'),
        headline: 'Seu plano de treino,<br>no seu pulso.',
        tagline: 'Treinos de corrida estruturados da Athly, no player de treino nativo do seu relógio.',
        pills: ['Alvos de pace', 'Tiros e repetições', 'Próximos 7 dias'],
        workouts: ['Intervalado 6x400m', 'Rodagem 8 km', 'Longo 18 km'],
    },
    de: {
        strings: strings('resources-deu'),
        headline: 'Dein Trainingsplan<br>am Handgelenk.',
        tagline: 'Strukturierte Lauftrainings aus Athly – im nativen Trainingsplayer deiner Uhr.',
        pills: ['Pace-Ziele', 'Intervalle & Wiederholungen', 'Nächste 7 Tage'],
        workouts: ['Intervalle 6x400m', 'Lockerer Lauf 8 km', 'Langer Lauf 18 km'],
    },
};

// Tamanhos das fontes do fr970 (454 x 454, 326 ppi): pontos do simulator.json * 326 / 72.
const FONT = { xtiny: 31.5, tiny: 39.7, small: 45.2, large: 60.2 };
const SCREEN = 454;

const fmt = (text, ...args) => args.reduce((acc, arg, i) => acc.replace(`$${i + 1}$`, arg), text);
const esc = (text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const page = (width, height, css, body) => `<!doctype html><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&display=swap" rel="stylesheet">
<style>
@font-face { font-family: Roboto; src: url("${roboto}"); }
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { width: ${width}px; height: ${height}px; overflow: hidden; }
${css}
</style>${body}`;

// Mesma conta do Ui.text: centrado em y, com 80% da largura.
const line = (yPercent, font, color, text) =>
    `<div class="t" style="top:${yPercent}%;font-size:${FONT[font]}px;color:${color}">${esc(text)}</div>`;

const SCREEN_CSS = `
.screen { position: relative; width: ${SCREEN}px; height: ${SCREEN}px; background: #000; overflow: hidden;
  font-family: Roboto, sans-serif; color: #fff; }
.t { position: absolute; left: 10%; width: 80%; transform: translateY(-50%); text-align: center; line-height: 1.17; }
.menu-title { position: absolute; top: 44px; width: 100%; text-align: center; font-size: ${FONT.xtiny}px; color: #AAAAAA; }
.item { position: absolute; left: 74px; right: 40px; padding: 14px 0; border-top: 2px solid #2A2A2A; }
.item .label { font-size: ${FONT.small}px; line-height: 1.15; }
.item .sub { font-size: ${FONT.xtiny}px; line-height: 1.2; color: #AAAAAA; white-space: nowrap; }
.item.dim { opacity: 0.55; }
.fade { position: absolute; left: 0; right: 0; bottom: 0; height: 120px; background: linear-gradient(transparent, #000 85%); }
`;

// PairingView.drawCode
const pairingScreen = ({ strings: s }) => `<div class="screen">
${line(17, 'xtiny', BRAND, s.PairTitle)}
${line(36, 'xtiny', '#fff', s.PairInstructions)}
${line(60, 'large', '#fff', '4821 3907')}
${line(81, 'xtiny', '#AAAAAA', fmt(s.PairExpires, 10))}
</div>`;

// SyncView em SYNC_DOWNLOAD (Ui.message)
const syncScreen = ({ strings: s }) => `<div class="screen">
${line(42, 'small', '#fff', fmt(s.Downloading, 2, 5))}
</div>`;

// WorkoutMenu: é um Menu2 nativo, então isto é uma aproximação do visual do relógio.
const menuItems = ({ strings: s, workouts }) => [
    [s.Today, workouts[0]],
    [s.Tomorrow, workouts[1]],
    [`${s.Sat} 17/10`, workouts[2]],
];
const menuScreen = (locale) => {
    const items = menuItems(locale);
    const tops = [104, 222, 340];
    return `<div class="screen">
<div class="menu-title">${esc(locale.strings.AppName)}</div>
${items.map(([label, sub], i) => `<div class="item${i === 0 ? '' : ' dim'}" style="top:${tops[i]}px">
<div class="label">${esc(label)}</div><div class="sub">${esc(sub)}</div></div>`).join('\n')}
<div class="fade"></div>
</div>`;
};

const HERO_CSS = `
body { background: #060810; font-family: 'Space Grotesk', system-ui, sans-serif; color: #EEF2FF; position: relative; }
.glow { position: absolute; inset: 0;
  background: radial-gradient(620px 420px at 14% 8%, rgba(14,165,233,.20), transparent 70%),
              radial-gradient(760px 560px at 82% 62%, rgba(124,58,237,.26), transparent 70%); }
.copy { position: absolute; left: 104px; top: 0; height: 100%; width: 720px; display: flex; flex-direction: column; justify-content: center; }
.brand { display: flex; align-items: center; gap: 14px; margin-bottom: 34px; }
.brand .mark { width: 76px; height: 76px; border-radius: 20px; background: url("${fox}") center / 100% no-repeat; }
.brand .name { font-size: 46px; font-weight: 700; letter-spacing: -0.5px; }
h1 { font-size: 70px; line-height: 1.06; font-weight: 700; letter-spacing: -1.6px; }
.tag { margin-top: 24px; font-size: 27px; line-height: 1.38; font-weight: 500; color: #94A3B8; max-width: 640px; }
.pills { margin-top: 36px; display: flex; gap: 12px; }
.pill { font-size: 20px; font-weight: 600; color: #7DD3FC; padding: 10px 18px; border-radius: 999px; white-space: nowrap;
  background: rgba(14,165,233,.10); border: 1.5px solid rgba(14,165,233,.30); }
.watch { position: absolute; left: 872px; top: 110px; width: 500px; height: 500px; }
.strap { position: absolute; left: 118px; width: 264px; height: 250px; background: linear-gradient(90deg, #0E1424, #1A2540 50%, #0E1424); }
.strap.top { top: -150px; border-radius: 0 0 40px 40px; }
.strap.bottom { bottom: -150px; border-radius: 40px 40px 0 0; }
.case { position: absolute; inset: 0; border-radius: 50%; background: linear-gradient(145deg, #2B3550, #0C1120 60%);
  box-shadow: 0 30px 80px rgba(0,0,0,.6), inset 0 0 0 2px rgba(255,255,255,.07); }
.bezel { position: absolute; inset: 16px; border-radius: 50%; background: #05070D; box-shadow: inset 0 0 0 2px rgba(255,255,255,.05); }
.face { position: absolute; left: 23px; top: 23px; width: ${SCREEN}px; height: ${SCREEN}px; border-radius: 50%; overflow: hidden; }
.button { position: absolute; width: 16px; height: 62px; border-radius: 6px; background: linear-gradient(90deg, #2B3550, #141C30); }
${SCREEN_CSS}
`;

const hero = (locale) => page(1440, 720, HERO_CSS, `<body>
<div class="glow"></div>
<div class="copy">
  <div class="brand"><div class="mark"></div><div class="name">Athly</div></div>
  <h1>${locale.headline}</h1>
  <div class="tag">${esc(locale.tagline)}</div>
  <div class="pills">${locale.pills.map((pill) => `<div class="pill">${esc(pill)}</div>`).join('')}</div>
</div>
<div class="watch">
  <div class="strap top"></div><div class="strap bottom"></div>
  <div class="button" style="right:-9px;top:128px;transform:rotate(-24deg)"></div>
  <div class="button" style="right:-9px;bottom:128px;transform:rotate(24deg)"></div>
  <div class="case"></div><div class="bezel"></div>
  <div class="face">${menuScreen(locale)}</div>
</div>
</body>`);

// Raposa do ícone do iOS sobre fundo sólido: "lighten" some com o fundo quase preto do PNG.
const icon = (size) => {
    const art = Math.round(size * 1.18);
    return page(size, size, `body { background: ${ICON_BG}; }
.fox { position: absolute; left: ${(size - art) / 2}px; top: ${(size - art) / 2 - size * 0.012}px; width: ${art}px; height: ${art}px;
  mix-blend-mode: lighten; filter: contrast(1.35) brightness(0.93); -webkit-mask-image: radial-gradient(closest-side, #000 72%, transparent 86%); }`,
        `<body><img class="fox" src="${fox}"></body>`);
};

const jobs = [
    ['cover.png', 500, 500, icon(500)],
    ['icon.png', 128, 128, icon(128)],
];
for (const [code, locale] of Object.entries(LOCALES)) {
    jobs.push([`hero-${code}.png`, 1440, 720, hero(locale)]);
    const screens = { '1-pairing': pairingScreen, '2-sync': syncScreen, '3-workouts': menuScreen };
    for (const [name, render] of Object.entries(screens)) {
        jobs.push([`screens/${code}/${name}.png`, SCREEN, SCREEN, page(SCREEN, SCREEN, SCREEN_CSS, `<body>${render(locale)}</body>`)]);
    }
}

// O navegador fica aberto e é comandado pelo protocolo DevTools: o `--screenshot` da linha de
// comando trava em alguns Chromium.
const PORT = 9333;
const work = mkdtempSync(join(tmpdir(), 'athly-store-'));
const chrome = spawn(browser, [
    '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run',
    `--user-data-dir=${join(work, 'profile')}`, `--remote-debugging-port=${PORT}`, 'about:blank',
], { stdio: 'ignore' });

const target = async () => {
    for (let attempt = 0; attempt < 50; attempt++) {
        try {
            const pages = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
            const first = pages.find((entry) => entry.type === 'page');
            if (first) {
                return first.webSocketDebuggerUrl;
            }
        } catch {
            // ainda subindo
        }
        await new Promise((resolve) => setTimeout(resolve, 200));
    }
    throw new Error(`Navegador não respondeu na porta ${PORT}: ${browser}`);
};

try {
    const socket = new WebSocket(await target());
    await new Promise((resolve, reject) => {
        socket.onopen = resolve;
        socket.onerror = reject;
    });
    const pending = new Map();
    const listeners = new Map();
    socket.onmessage = ({ data }) => {
        const message = JSON.parse(data);
        if (message.id) {
            const { resolve, reject } = pending.get(message.id);
            pending.delete(message.id);
            message.error ? reject(new Error(message.error.message)) : resolve(message.result);
        } else {
            listeners.get(message.method)?.();
        }
    };
    let nextId = 0;
    const send = (method, params = {}) => new Promise((resolve, reject) => {
        pending.set(++nextId, { resolve, reject });
        socket.send(JSON.stringify({ id: nextId, method, params }));
    });
    const once = (event) => new Promise((resolve) => listeners.set(event, resolve));

    await send('Page.enable');
    for (const [file, width, height, html] of jobs) {
        const source = join(work, 'page.html');
        const output = join(out, file);
        mkdirSync(dirname(output), { recursive: true });
        writeFileSync(source, html);
        await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
        const loaded = once('Page.loadEventFired');
        await send('Page.navigate', { url: pathToFileURL(source).href });
        await loaded;
        await send('Runtime.evaluate', { expression: 'document.fonts.ready.then(() => true)', awaitPromise: true });
        const { data } = await send('Page.captureScreenshot', { format: 'png' });
        writeFileSync(output, Buffer.from(data, 'base64'));
        console.log(file);
    }
    socket.close();
} finally {
    chrome.kill();
    rmSync(work, { recursive: true, force: true });
}
