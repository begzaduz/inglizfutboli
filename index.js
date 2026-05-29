const http = require('http');
const https = require('https');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// ═══════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════
const TOKEN    = '8701604879:AAEeEUPd6bclS1zvIKKNAGu1qojRe5r4m1k';
const CHANNEL  = '@Inglizfutbol';
const GROQ_KEY = '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';
const NEWS_KEY = 'd5344d1dcf8a4af7bc15bbf122cc0366';
const DB_PATH  = path.join(__dirname, 'news_cache.db');
const pending  = {};

// ═══════════════════════════════════════
// SQLITE — PERSISTENT CACHE
// ═══════════════════════════════════════
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) { console.error('SQLite xato:', err.message); process.exit(1); }
  console.log('SQLite ulandi:', DB_PATH);
});

db.run(`CREATE TABLE IF NOT EXISTS processed_articles (
  url TEXT PRIMARY KEY,
  title TEXT,
  processed_at DATETIME DEFAULT CURRENT_TIMESTAMP
)`, (err) => {
  if (err) console.error('Jadval xato:', err.message);
  else console.log('Jadval tayyor.');
});

function isProcessed(url) {
  return new Promise((resolve, reject) => {
    db.get('SELECT url FROM processed_articles WHERE url = ?', [url], (err, row) => {
      if (err) reject(err);
      else resolve(!!row);
    });
  });
}

function markProcessed(url, title) {
  return new Promise((resolve, reject) => {
    db.run(
      'INSERT OR IGNORE INTO processed_articles (url, title) VALUES (?, ?)',
      [url, title || ''],
      (err) => { if (err) reject(err); else resolve(); }
    );
  });
}

// ═══════════════════════════════════════
// O'ZBEK NOMLARI LUGHATI
// ═══════════════════════════════════════
const NAMES = {
  // Musobaqalar
  'Premier League':          'Premier-liga',
  'Champions League':        'Chempionlar ligasi',
  'FA Cup':                  'FA Kubogi',
  'Carabao Cup':             'Karabao Kubogi',
  'Europa League':           'Evropa ligasi',
  'Conference League':       'Konferensiyalar ligasi',
  'World Cup':               'Jahon chempionati',
  // Klublar
  'Manchester City':         'Manchester Siti',
  'Man City':                'Manchester Siti',
  'Manchester United':       'Manchester Yunayted',
  'Man United':              'Manchester Yunayted',
  'Man Utd':                 'Manchester Yunayted',
  'Arsenal':                 'Arsenal',
  'Chelsea':                 'Chelsi',
  'Liverpool':               'Liverpul',
  'Tottenham Hotspur':       'Tottenhem Xotspur',
  'Tottenham':               'Tottenhem',
  'Spurs':                   'Tottenhem',
  'Aston Villa':             'Aston Villa',
  'Newcastle United':        'Nyukasl Yunayted',
  'Newcastle':               'Nyukasl',
  'West Ham United':         'Vest Hem Yunayted',
  'West Ham':                'Vest Hem',
  'Brighton':                'Brayton',
  'Crystal Palace':          'Kristal Pelas',
  'Fulham':                  'Fulhem',
  'Brentford':               'Brentford',
  'Bournemouth':             'Bornmut',
  'Nottingham Forest':       'Nottingem Forest',
  'Leicester City':          'Lester Siti',
  'Leicester':               'Lester',
  'Everton':                 'Everton',
  'Wolverhampton Wanderers': 'Vulverhempton',
  'Wolverhampton':           'Vulverhempton',
  'Wolves':                  'Vulverhempton',
  'Ipswich Town':            'Ipsvich Taun',
  'Ipswich':                 'Ipsvich',
  'Southampton':             'Sautgempton',
  'Leeds United':            'Lids Yunayted',
  'Leeds':                   'Lids',
  'Sheffield United':        'Sheffild Yunayted',
  'Burnley':                 'Bernli',
  'Norwich City':            'Norvich Siti',
  'Watford':                 'Uotford',
  'Sunderland':              'Sanderlend',
  'Blackburn Rovers':        'Blekbern Rovers',
  'Middlesbrough':           'Midlsbro',
  'Stoke City':              'Stok Siti',
  // Xorijiy klublar
  'Real Madrid':             'Real Madrid',
  'Barcelona':               'Barselona',
  'Bayern Munich':           'Bayern Myunxen',
  'PSG':                     'PSJ',
  'Paris Saint-Germain':     'Parij Sen-Jermen',
  'Juventus':                'Yuventus',
  'AC Milan':                'Milan',
  'Inter Milan':             'Inter',
  'Atletico Madrid':         'Atletiko Madrid',
  // O'yinchilar
  'Erling Haaland':          'Erling Holland',
  'Haaland':                 'Holland',
  'Abdukodir Khusanov':      'Abduqodir Husanov',
  'Khusanov':                'Husanov',
  'Cole Palmer':             'Koul Palmer',
  'Phil Foden':              'Fil Foden',
  'Foden':                   'Foden',
  'Martin Odegaard':         'Martin Edegor',
  'Ødegaard':                'Edegor',
  'Odegaard':                'Edegor',
  'Bruno Fernandes':         'Bruno Fernandesh',
  'Declan Rice':             'Deklan Rays',
  'Kevin De Bruyne':         'Kevin De Bryuyne',
  'De Bruyne':               'De Bryuyne',
  'Marcus Rashford':         'Markus Reshford',
  'Rashford':                'Reshford',
  'Ollie Watkins':           'Olli Uotkins',
  'Alexander Isak':          'Aleksandr Isak',
  'Luis Diaz':               'Luis Dias',
  'Jack Grealish':           'Jek Grilish',
  'Kai Havertz':             'Kay Haverts',
  'Alejandro Garnacho':      'Alexandro Garnacho',
  'Virgil van Dijk':         'Virjil van Deyk',
  'van Dijk':                'van Deyk',
  'Nicolas Jackson':         'Nikolas Jekson',
  'Mohamed Salah':           'Muhammad Saloh',
  'Salah':                   'Saloh',
  // Murabbiylar
  'Enzo Maresca':            'Enso Mareska',
  'Pep Guardiola':           'Pep Gvardiola',
  'Guardiola':               'Gvardiola',
  'Jurgen Klopp':            'Yurgen Klopp',
  'Erik ten Hag':            'Erik ten Xag',
  'Mikel Arteta':            'Mikel Arteta',
  'Arne Slot':               'Arne Slot',
  'Unai Emery':              'Unai Emeri',
  'Eddie Howe':              'Eddi Hau',
  'Thomas Frank':            'Tomas Frank',
  'Marco Silva':             'Marku Silva',
};

function applyNames(text) {
  if (!text) return '';
  let result = text;
  const sorted = Object.entries(NAMES).sort((a, b) => b[0].length - a[0].length);
  for (const [eng, uzb] of sorted) {
    try {
      const escaped = eng.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\b${escaped}\\b`, 'gi');
      result = result.replace(regex, uzb);
    } catch (_) {}
  }
  return result;
}

// ═══════════════════════════════════════
// SYSTEM PROMPT
// ═══════════════════════════════════════
const SYSTEM_PROMPT = `Sen @Inglizfutbol Telegram kanalining professional sport jurnalistisan.
Sening vazifang: inglizcha futbol yangiligini o'qib, uni to'liq, professional o'zbek jurnalistikasi uslubida Telegram post qilib yozish.

USLUB QOIDALARI:
- Inverted pyramid: eng muhim fakt birinchi, keyin tafsilot
- Jonli, faol til — passiv konstruksiyalardan qoching
- Raqamlar, sanalar, natijalar aniq keltirilsin
- Klub laqablarini ishlat: Arsenal="to'pchilar", Liverpool="qizillar", Chelsea="aristokratlar", Man City="fuqarolar", Man Utd="qizil iblislar", Tottenham="xo'rozlar", Newcastle="qarg'alar", Bournemouth="olchalar", West Ham="bolg'achilar", Crystal Palace="burgutlar", Wolves="bo'rilar", Brighton="qaldirg'ochlar", Brentford="arilar", Everton="karamellar", Aston Villa="villalar"

POST FORMATI:
[emoji] [Sarlavha — qisqa, zarba bilan]

[Kirish — 1-2 gap, eng muhim ma'lumot]

[Tafsilot — 2-3 gap, kontekst, statistika, natijalar]

[Iqtibos bo'lsa: 🎙 "iqtibos matni" — Ism]

[Fakt/kontekst — jadval o'rni, rekord yoki keyingi o'yin ma'lumoti]

@Inglizfutbol

MUHIM:
- Transfer, ishdan bo'shatish, og'ir shikastda "#BREAKING" qo'sh
- Oddiy yangilikda "#BREAKING" ishlatma
- 400-700 belgi oralig'ida yoz
- Faqat postni yoz — boshqa hech narsa yozma
- Hech narsa o'ylab topma — faqat berilgan ma'lumotni yoz`;

// ═══════════════════════════════════════
// TELEGRAM API
// ═══════════════════════════════════════
function tg(method, data) {
  return new Promise((resolve, reject) => {
    try {
      const body = JSON.stringify(data);
      const req = https.request({
        hostname: 'api.telegram.org',
        path: `/bot${TOKEN}/${method}`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body)
        }
      }, (r) => {
        let d = '';
        r.on('data', (c) => { d += c; });
        r.on('end', () => {
          try { resolve(JSON.parse(d)); }
          catch (e) { reject(new Error('Telegram JSON parse: ' + e.message)); }
        });
      });
      req.on('error', (e) => reject(new Error('Telegram request: ' + e.message)));
      req.setTimeout(15000, () => { req.destroy(); reject(new Error('Telegram timeout')); });
      req.write(body);
      req.end();
    } catch (e) {
      reject(new Error('tg() xato: ' + e.message));
    }
  });
}

// ═══════════════════════════════════════
// GROQ AI
// ═══════════════════════════════════════
function groq(userContent) {
  return new Promise((resolve, reject) => {
    try {
      const body = JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userContent }
        ],
        max_tokens: 700,
        temperature: 0.4
      });
      const req = https.request({
        hostname: 'api.groq.com',
        path: '/openai/v1/chat/completions',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${GROQ_KEY}`,
          'Content-Length': Buffer.byteLength(body)
        }
      }, (r) => {
        let d = '';
        r.on('data', (c) => { d += c; });
        r.on('end', () => {
          try {
            const j = JSON.parse(d);
            if (j.error) return reject(new Error('Groq API: ' + j.error.message));
            const t = j.choices?.[0]?.message?.content;
            if (t) resolve(t.trim());
            else reject(new Error('Groq bo\'sh javob'));
          } catch (e) { reject(new Error('Groq parse: ' + e.message)); }
        });
      });
      req.on('error', (e) => reject(new Error('Groq request: ' + e.message)));
      req.setTimeout(30000, () => { req.destroy(); reject(new Error('Groq timeout')); });
      req.write(body);
      req.end();
    } catch (e) {
      reject(new Error('groq() xato: ' + e.message));
    }
  });
}

// ═══════════════════════════════════════
// NEWSAPI
// ═══════════════════════════════════════
function fetchNews() {
  return new Promise((resolve, reject) => {
    try {
      const p = `/v2/everything?q=premier+league&language=en&sortBy=publishedAt&pageSize=15&apiKey=${NEWS_KEY}`;
      const req = https.request({
        hostname: 'newsapi.org', path: p, method: 'GET',
        headers: { 'User-Agent': 'InglizFutbolBot/1.0' }
      }, (r) => {
        let d = '';
        r.on('data', (c) => { d += c; });
        r.on('end', () => {
          try { resolve(JSON.parse(d)); }
          catch (e) { reject(new Error('NewsAPI parse: ' + e.message)); }
        });
      });
      req.on('error', (e) => reject(new Error('NewsAPI request: ' + e.message)));
      req.setTimeout(15000, () => { req.destroy(); reject(new Error('NewsAPI timeout')); });
      req.end();
    } catch (e) {
      reject(new Error('fetchNews() xato: ' + e.message));
    }
  });
}

// ═══════════════════════════════════════
// URL DAN TO'LIQ MATN OLISH
// ═══════════════════════════════════════
function fetchArticleText(url) {
  return new Promise((resolve) => {
    try {
      const u = new URL(url);
      const req = https.request({
        hostname: u.hostname,
        path: u.pathname + u.search,
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html',
        }
      }, (r) => {
        let d = '';
        r.on('data', (c) => { if (d.length < 8000) d += c; });
        r.on('end', () => {
          const clean = d
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 2000);
          resolve(clean || null);
        });
      });
      req.on('error', () => resolve(null));
      req.setTimeout(8000, () => { req.destroy(); resolve(null); });
      req.end();
    } catch (_) { resolve(null); }
  });
}

// ═══════════════════════════════════════
// TRANSLATE — AI PIPELINE
// ═══════════════════════════════════════
async function translate(title, desc, content, url) {
  try {
    // 1. NewsAPI content
    let baseText = (content || '').replace(/\[\+\d+ chars\]/g, '').trim();

    // 2. Qisqa bo'lsa URL dan to'liq matn
    if (baseText.length < 300 && url) {
      const fetched = await fetchArticleText(url);
      if (fetched && fetched.length > baseText.length) {
        baseText = fetched;
      }
    }

    // 3. Hali ham qisqa bo'lsa — title + desc
    if (baseText.length < 100) {
      baseText = [title, desc].filter(Boolean).join('\n\n');
    }

    const input = baseText.slice(0, 2000);

    const userPrompt = `Quyidagi inglizcha futbol yangiligini professional o'zbek Telegram posti qilib yoz:

SARLAVHA: ${title || ''}

MATN:
${input}

Faqat tayyor postni yoz.`;

    const raw = await groq(userPrompt);
    return applyNames(raw);
  } catch (e) {
    console.error('[translate] xato:', e.message);
    throw e;
  }
}

// ═══════════════════════════════════════
// AVTOMATIK YANGILIK POST
// ═══════════════════════════════════════
async function autoNewsPost() {
  console.log('[autoNewsPost] Boshlandi:', new Date().toLocaleString());
  try {
    const data = await fetchNews();
    if (!data.articles || data.articles.length === 0) {
      console.log('[autoNewsPost] Yangilik topilmadi.');
      return false;
    }

    for (const article of data.articles) {
      const url = article.url;
      if (!url) continue;

      // SQLite kesh tekshirish
      try {
        const already = await isProcessed(url);
        if (already) {
          console.log('[autoNewsPost] O\'tkazildi (keshda bor):', article.title);
          continue;
        }
      } catch (dbErr) {
        console.error('[autoNewsPost] SQLite tekshirish:', dbErr.message);
        continue;
      }

      // AI pipeline
      let post;
      try {
        post = await translate(article.title, article.description, article.content, url);
      } catch (aiErr) {
        console.error('[autoNewsPost] AI xato:', aiErr.message);
        try { await markProcessed(url, article.title); } catch (_) {}
        continue;
      }

      if (!post || !post.trim()) {
        try { await markProcessed(url, article.title); } catch (_) {}
        continue;
      }

      // Telegram ga yuborish
      try {
        let result = await tg('sendMessage', {
          chat_id: CHANNEL,
          text: post,
          parse_mode: 'Markdown'
        });

        // Markdown parse xatosi bo'lsa — oddiy matn bilan qayta
        if (!result.ok && result.description && result.description.includes("can't parse")) {
          result = await tg('sendMessage', { chat_id: CHANNEL, text: post });
        }

        if (!result.ok) {
          console.error('[autoNewsPost] Telegram:', result.description);
          continue;
        }

        try { await markProcessed(url, article.title); } catch (dbErr) {
          console.error('[autoNewsPost] SQLite saqlash:', dbErr.message);
        }

        console.log('[autoNewsPost] Yuborildi:', article.title);
        return true;

      } catch (tgErr) {
        console.error('[autoNewsPost] Telegram yuborish:', tgErr.message);
        continue;
      }
    }

    console.log('[autoNewsPost] Barcha yangiliklar keshda bor.');
    return false;

  } catch (e) {
    console.error('[autoNewsPost] Umumiy xato:', e.message);
    return false;
  }
}

// ═══════════════════════════════════════
// XABAR QAYTA ISHLASH — ADMIN
// ═══════════════════════════════════════
async function handle(update) {
  try {
    if (!update || !update.message) return;
    const msg   = update.message;
    const id    = msg.chat.id;
    const text  = (msg.text || '').trim();
    const photo = msg.photo;

    // RASM + CAPTION
    if (photo) {
      const fileId  = photo[photo.length - 1].file_id;
      const caption = (msg.caption || '').trim();

      if (caption) {
        await tg('sendMessage', { chat_id: id, text: '⏳ Tayyorlanayapti...' });
        try {
          const post = await translate(caption, '', '', null);
          pending[id] = { type: 'photo', fileId, text: post };
          return tg('sendMessage', {
            chat_id: id,
            text: `👀 *Ko'rib chiqing:*\n\n${post}`,
            parse_mode: 'Markdown',
            reply_markup: { keyboard: [['✅ Yuborish'], ['❌ Bekor']], resize_keyboard: true }
          });
        } catch (e) {
          return tg('sendMessage', { chat_id: id, text: '❌ Xatolik: ' + e.message });
        }
      } else {
        pending[id] = { type: 'waitText', fileId };
        return tg('sendMessage', { chat_id: id, text: '📝 Yangilik matnini yozing:' });
      }
    }

    if (!text) return;

    // BUYRUQLAR
    if (text === '/start') {
      return tg('sendMessage', {
        chat_id: id,
        text: '⚽ *Ingliz Futboli Bot*\n\n' +
              '📰 Matn yuboring → professional post\n' +
              '🖼 Rasm + matn → kanalga chiqadi\n' +
              '/yangilik — Yangi xabar oladi\n' +
              '/stat — Baza statistikasi',
        parse_mode: 'Markdown'
      });
    }

    if (text === '/yangilik') {
      await tg('sendMessage', { chat_id: id, text: '⏳ Yangilik olinayapti...' });
      const ok = await autoNewsPost();
      return tg('sendMessage', {
        chat_id: id,
        text: ok ? '✅ Post kanalga yuborildi!' : '❌ Yangi yangilik topilmadi.'
      });
    }

    if (text === '/stat') {
      return new Promise((resolve) => {
        db.get('SELECT COUNT(*) as cnt FROM processed_articles', [], (err, row) => {
          const count = err ? '?' : row.cnt;
          tg('sendMessage', { chat_id: id, text: `📊 Bazada ${count} ta yangilik saqlangan.` }).then(resolve);
        });
      });
    }

    // TASDIQLASH / BEKOR
    if (text === '✅ Yuborish' && pending[id]) {
      const p = pending[id];
      try {
        if (p.type === 'photo') {
          const cap = p.text.length > 1024 ? p.text.slice(0, 1020) + '...' : p.text;
          await tg('sendPhoto', { chat_id: CHANNEL, photo: p.fileId, caption: cap });
        } else {
          await tg('sendMessage', { chat_id: CHANNEL, text: p.text, parse_mode: 'Markdown' });
        }
        delete pending[id];
        return tg('sendMessage', { chat_id: id, text: '✅ Yuborildi!', reply_markup: { remove_keyboard: true } });
      } catch (e) {
        return tg('sendMessage', { chat_id: id, text: '❌ Yuborishda xato: ' + e.message });
      }
    }

    if (text === '❌ Bekor') {
      delete pending[id];
      return tg('sendMessage', { chat_id: id, text: '❌ Bekor qilindi.', reply_markup: { remove_keyboard: true } });
    }

    // RASM KUTILAYOTGAN — MATN KELDI
    if (pending[id]?.type === 'waitText') {
      const fileId = pending[id].fileId;
      await tg('sendMessage', { chat_id: id, text: '⏳ Tayyorlanayapti...' });
      try {
        const post = await translate(text, '', '', null);
        pending[id] = { type: 'photo', fileId, text: post };
        return tg('sendMessage', {
          chat_id: id,
          text: `👀 *Ko'rib chiqing:*\n\n${post}`,
          parse_mode: 'Markdown',
          reply_markup: { keyboard: [['✅ Yuborish'], ['❌ Bekor']], resize_keyboard: true }
        });
      } catch (e) {
        delete pending[id];
        return tg('sendMessage', { chat_id: id, text: '❌ Xatolik: ' + e.message, reply_markup: { remove_keyboard: true } });
      }
    }

    // ODDIY MATN — AI PIPELINE
    if (!text.startsWith('/')) {
      await tg('sendMessage', { chat_id: id, text: '⏳ Tayyorlanayapti...' });
      try {
        const post = await translate(text, '', '', null);
        pending[id] = { type: 'text', text: post };
        return tg('sendMessage', {
          chat_id: id,
          text: `👀 *Ko'rib chiqing:*\n\n${post}`,
          parse_mode: 'Markdown',
          reply_markup: { keyboard: [['✅ Yuborish'], ['❌ Bekor']], resize_keyboard: true }
        });
      } catch (e) {
        return tg('sendMessage', { chat_id: id, text: '❌ Xatolik: ' + e.message });
      }
    }

  } catch (err) {
    console.error('[handle] Umumiy xato:', err.message);
    try {
      await tg('sendMessage', { chat_id: update?.message?.chat?.id, text: '❌ Ichki xatolik.' });
    } catch (_) {}
  }
}

// ═══════════════════════════════════════
// HAR 30 DAQIQADA AVTOMATIK POST
// ═══════════════════════════════════════
setInterval(() => {
  autoNewsPost().catch((e) => console.error('[interval] Xato:', e.message));
}, 30 * 60 * 1000);

// ═══════════════════════════════════════
// PACKAGE.JSON UCHUN ESLATMA
// ═══════════════════════════════════════
// npm install sqlite3

// ═══════════════════════════════════════
// HTTP SERVER
// ═══════════════════════════════════════
const PORT = process.env.PORT || 8080;

const server = http.createServer((req, res) => {
  if (req.method === 'POST') {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      res.writeHead(200); res.end('OK');
      try {
        if (body) handle(JSON.parse(body)).catch((e) => console.error('[webhook]', e.message));
      } catch (e) {
        console.error('[webhook] parse:', e.message);
      }
    });
    req.on('error', (e) => { console.error('[req] xato:', e.message); res.writeHead(500); res.end(); });
  } else {
    res.writeHead(200); res.end('Ingliz Futboli Bot ⚽');
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[server] ${PORT} portda ishga tushdi.`);
});

server.on('error', (e) => console.error('[server] xato:', e.message));

// ═══════════════════════════════════════
// GLOBAL XATOLIKLARNI USHLASH
// ═══════════════════════════════════════
process.on('uncaughtException', (e) => console.error('[uncaughtException]', e.message));
process.on('unhandledRejection', (r) => console.error('[unhandledRejection]', r));
