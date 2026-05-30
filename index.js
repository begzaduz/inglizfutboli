const http    = require('http');
const https   = require('https');
const sqlite3 = require('sqlite3').verbose();
const path    = require('path');

// ═══════════════════════════════════════
// SOZLAMALAR
// ═══════════════════════════════════════
const CONFIG = {
  TOKEN      : '8701604879:AAEeEUPd6bclS1zvIKKNAGu1qojRe5r4m1k',
  CHANNEL    : '@Inglizfutbol',
  GEMINI_KEY : 'AQ.Ab8RN6IG2cdSBLBQyhFTahecIcwkaScxCe8OdqiCd9mCGtTjsQ',
  NEWS_KEY   : 'd5344d1dcf8a4af7bc15bbf122cc0366',
  DB_PATH    : path.join(__dirname, 'news_cache.db'),
  PORT       : process.env.PORT || 8080,
  INTERVAL   : 30 * 60 * 1000,
};

// ═══════════════════════════════════════
// SQLITE — PERSISTENT CACHE
// ═══════════════════════════════════════
const db = new sqlite3.Database(CONFIG.DB_PATH, (err) => {
  if (err) { console.error('[DB] Ulanish xatosi:', err.message); process.exit(1); }
  console.log('[DB] SQLite ulandi:', CONFIG.DB_PATH);
});

db.run(`CREATE TABLE IF NOT EXISTS processed_articles (
  url          TEXT PRIMARY KEY,
  title        TEXT,
  processed_at DATETIME DEFAULT CURRENT_TIMESTAMP
)`, (err) => {
  if (err) console.error('[DB] Jadval xatosi:', err.message);
  else     console.log('[DB] Jadval tayyor.');
});

function isProcessed(url) {
  return new Promise((resolve, reject) => {
    db.get('SELECT url FROM processed_articles WHERE url = ?', [url], (err, row) => {
      if (err) reject(err); else resolve(!!row);
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
  'Premier League'           : 'Premier-liga',
  'Champions League'         : 'Chempionlar ligasi',
  'FA Cup'                   : 'FA Kubogi',
  'Carabao Cup'              : 'Karabao Kubogi',
  'Europa League'            : 'Evropa ligasi',
  'Conference League'        : 'Konferensiyalar ligasi',
  'World Cup'                : 'Jahon chempionati',
  'Manchester City'          : 'Manchester Siti',
  'Man City'                 : 'Manchester Siti',
  'Manchester United'        : 'Manchester Yunayted',
  'Man United'               : 'Manchester Yunayted',
  'Man Utd'                  : 'Manchester Yunayted',
  'Arsenal'                  : 'Arsenal',
  'Chelsea'                  : 'Chelsi',
  'Liverpool'                : 'Liverpul',
  'Tottenham Hotspur'        : 'Tottenhem Xotspur',
  'Tottenham'                : 'Tottenhem',
  'Spurs'                    : 'Tottenhem',
  'Aston Villa'              : 'Aston Villa',
  'Newcastle United'         : 'Nyukasl Yunayted',
  'Newcastle'                : 'Nyukasl',
  'West Ham United'          : 'Vest Hem Yunayted',
  'West Ham'                 : 'Vest Hem',
  'Brighton'                 : 'Brayton',
  'Crystal Palace'           : 'Kristal Pelas',
  'Fulham'                   : 'Fulhem',
  'Brentford'                : 'Brentford',
  'Bournemouth'              : 'Bornmut',
  'Nottingham Forest'        : 'Nottingem Forest',
  'Leicester City'           : 'Lester Siti',
  'Leicester'                : 'Lester',
  'Everton'                  : 'Everton',
  'Wolverhampton Wanderers'  : 'Vulverhempton',
  'Wolverhampton'            : 'Vulverhempton',
  'Wolves'                   : 'Vulverhempton',
  'Ipswich Town'             : 'Ipsvich Taun',
  'Ipswich'                  : 'Ipsvich',
  'Southampton'              : 'Sautgempton',
  'Leeds United'             : 'Lids Yunayted',
  'Leeds'                    : 'Lids',
  'Sheffield United'         : 'Sheffild Yunayted',
  'Burnley'                  : 'Bernli',
  'Norwich City'             : 'Norvich Siti',
  'Watford'                  : 'Uotford',
  'Sunderland'               : 'Sanderlend',
  'Blackburn Rovers'         : 'Blekbern Rovers',
  'Middlesbrough'            : 'Midlsbro',
  'Stoke City'               : 'Stok Siti',
  'Real Madrid'              : 'Real Madrid',
  'Barcelona'                : 'Barselona',
  'Bayern Munich'            : 'Bayern Myunxen',
  'PSG'                      : 'PSJ',
  'Paris Saint-Germain'      : 'Parij Sen-Jermen',
  'Juventus'                 : 'Yuventus',
  'AC Milan'                 : 'Milan',
  'Inter Milan'              : 'Inter',
  'Atletico Madrid'          : 'Atletiko Madrid',
  'Erling Haaland'           : 'Erling Holland',
  'Haaland'                  : 'Holland',
  'Abdukodir Khusanov'       : 'Abduqodir Husanov',
  'Khusanov'                 : 'Husanov',
  'Cole Palmer'              : 'Koul Palmer',
  'Phil Foden'               : 'Fil Foden',
  'Foden'                    : 'Foden',
  'Martin Odegaard'          : 'Martin Edegor',
  'Ødegaard'                 : 'Edegor',
  'Odegaard'                 : 'Edegor',
  'Bruno Fernandes'          : 'Bruno Fernandesh',
  'Declan Rice'              : 'Deklan Rays',
  'Kevin De Bruyne'          : 'Kevin De Bryuyne',
  'De Bruyne'                : 'De Bryuyne',
  'Marcus Rashford'          : 'Markus Reshford',
  'Rashford'                 : 'Reshford',
  'Ollie Watkins'            : 'Olli Uotkins',
  'Alexander Isak'           : 'Aleksandr Isak',
  'Luis Diaz'                : 'Luis Dias',
  'Jack Grealish'            : 'Jek Grilish',
  'Kai Havertz'              : 'Kay Haverts',
  'Alejandro Garnacho'       : 'Alexandro Garnacho',
  'Virgil van Dijk'          : 'Virjil van Deyk',
  'van Dijk'                 : 'van Deyk',
  'Nicolas Jackson'          : 'Nikolas Jekson',
  'Mohamed Salah'            : 'Muhammad Saloh',
  'Salah'                    : 'Saloh',
  'Enzo Maresca'             : 'Enso Mareska',
  'Pep Guardiola'            : 'Pep Gvardiola',
  'Guardiola'                : 'Gvardiola',
  'Jurgen Klopp'             : 'Yurgen Klopp',
  'Erik ten Hag'             : 'Erik ten Xag',
  'Mikel Arteta'             : 'Mikel Arteta',
  'Arne Slot'                : 'Arne Slot',
  'Unai Emery'               : 'Unai Emeri',
  'Eddie Howe'               : 'Eddi Hau',
  'Thomas Frank'             : 'Tomas Frank',
  'Marco Silva'              : 'Marku Silva',
};

function applyNames(text) {
  if (!text) return '';
  let result = text;
  const sorted = Object.entries(NAMES).sort((a, b) => b[0].length - a[0].length);
  for (const [eng, uzb] of sorted) {
    try {
      const escaped = eng.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      result = result.replace(new RegExp(`\\b${escaped}\\b`, 'gi'), uzb);
    } catch (_) {}
  }
  return result;
}

// ═══════════════════════════════════════
// SYSTEM PROMPT — KUCHAYTIRILGAN
// ═══════════════════════════════════════
const SYSTEM_PROMPT = `Sen O'zbekistonning eng yaxshi sport jurnalisti — Telegram kanal @Inglizfutbol uchun yozasan.

MAQSAD: Inglizcha yangilikni o'qib, uni o'zbek kitobxoni uchun JONLI, QIZIQARLI, PROFESSIONAL post qilish. Bu oddiy tarjima EMAS — bu jurnalistik qayta ishlash.

JURNALISTIK QOIDALAR:
1. Inverted pyramid: eng zo'r fakt birinchi gapda bo'lsin
2. Faol fe'l ishlat: "Saloh gol urdi" — "Saloh tomonidan gol urildi" EGA
3. Raqamlar aniq: "31-daqiqada", "3:1 hisobida", "15 million funt"
4. Kontekst qo'sh: o'yinchi necha yoshda, bu necha-nchi goli, jadval o'rni
5. Hissiyot ber: "ajoyib zarbadan", "keskin qarshi turish", "muzlatuvchi gol"

KLUB LAQAMLARI (albatta ishlat):
Arsenal="to'pchilar" | Liverpool="qizillar" | Chelsea="aristokratlar"
Man City="fuqarolar" | Man Utd="qizil iblislar" | Tottenham="xo'rozlar"
Newcastle="qarg'alar" | Bournemouth="olchalar" | West Ham="bolg'achilar"
Crystal Palace="burgutlar" | Wolves="bo'rilar" | Brighton="qaldirg'ochlar"
Brentford="arilar" | Everton="karamellar" | Aston Villa="villalar"

BREAKING NEWS qoidasi:
- Transfer, ishdan bo'shatish, og'ir shikastlanish, to'satdan natija → "#BREAKING" bilan boshlash
- Oddiy sharh, intervyu, tahlil → "#BREAKING" ISHLATMA

POST TUZILISHI (aniq shu tartibda):
[Emoji] [Qisqa, zarba bilan sarlavha — maksimal 10 so'z]

[Kirish — 1-2 gap. ENG MUHIM fakt. Kitobxonni ilintir.]

[Tafsilot — 2-3 gap. Statistika, kontekst, vaziyat tahlili.]

[🎙 Iqtibos — agar borsa. "Matn" — Ism Familiya]

[Yakunlovchi fakt — jadval o'rni, keyingi o'yin yoki rekord.]

@Inglizfutbol

MUTLAQ TAQIQLAR:
- *, _, \`, [ ], ** — hech qanday Markdown belgisi ISHLATMA
- O'ylab topilgan fakt QO'SHma — faqat berilgan ma'lumot
- "Bu yangilikda..." yoki "Quyida post:" kabi kirish jumlalari YOZMA
- Faqat tayyor postni yoz — boshqa hech narsa yo'q
- 400–700 belgi oralig'ida yoz`;

// ═══════════════════════════════════════
// YORDAMCHI: HTTP/HTTPS so'rov
// ═══════════════════════════════════════
function httpRequest(options, body, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    if (redirectCount > 5) return reject(new Error('Juda ko\'p redirect'));

    const lib = options.protocol === 'http:' ? http : https;

    try {
      const req = lib.request(options, (r) => {
        if ([301, 302, 303, 307, 308].includes(r.statusCode) && r.headers.location) {
          try {
            const loc = new URL(r.headers.location, `https://${options.hostname}`);
            const newOpts = {
              protocol : loc.protocol,
              hostname : loc.hostname,
              path     : loc.pathname + loc.search,
              method   : options.method || 'GET',
              headers  : options.headers || {},
            };
            return httpRequest(newOpts, body, redirectCount + 1).then(resolve).catch(reject);
          } catch (e) { return reject(new Error('Redirect URL xatosi: ' + e.message)); }
        }

        let d = '';
        r.on('data', (c) => { if (d.length < 20000) d += c; });
        r.on('end', () => resolve({ statusCode: r.statusCode, body: d }));
        r.on('error', reject);
      });

      req.on('error', (e) => reject(new Error('Request xatosi: ' + e.message)));
      req.setTimeout(options.timeout || 15000, () => {
        req.destroy();
        reject(new Error('Timeout: ' + options.hostname));
      });

      if (body) req.write(body);
      req.end();
    } catch (e) {
      reject(new Error('httpRequest xatosi: ' + e.message));
    }
  });
}

// ═══════════════════════════════════════
// TELEGRAM API
// ═══════════════════════════════════════
async function tg(method, data) {
  const body = JSON.stringify(data);
  const res  = await httpRequest({
    hostname : 'api.telegram.org',
    path     : `/bot${CONFIG.TOKEN}/${method}`,
    method   : 'POST',
    headers  : {
      'Content-Type'   : 'application/json',
      'Content-Length' : Buffer.byteLength(body),
    },
    timeout : 15000,
  }, body);

  try {
    const json = JSON.parse(res.body);
    if (!json.ok) console.error(`[Telegram] ${method} xatosi:`, json.description);
    return json;
  } catch (e) {
    throw new Error('Telegram JSON parse: ' + e.message);
  }
}

async function tgSend(chatId, text) {
  return tg('sendMessage', { chat_id: chatId, text });
}

// ═══════════════════════════════════════
// GEMINI 2.0 FLASH API
// ═══════════════════════════════════════
async function gemini(userContent) {
  const body = JSON.stringify({
    system_instruction: {
      parts: [{ text: SYSTEM_PROMPT }]
    },
    contents: [{
      role: 'user',
      parts: [{ text: userContent }]
    }],
    generationConfig: {
      maxOutputTokens : 700,
      temperature     : 0.5,
      topP            : 0.9,
    }
  });

  const res = await httpRequest({
    hostname : 'generativelanguage.googleapis.com',
    path     : `/v1beta/models/gemini-2.0-flash:generateContent?key=${CONFIG.GEMINI_KEY}`,
    method   : 'POST',
    headers  : {
      'Content-Type'   : 'application/json',
      'Content-Length' : Buffer.byteLength(body),
    },
    timeout : 30000,
  }, body);

  let json;
  try { json = JSON.parse(res.body); }
  catch (e) { throw new Error('Gemini JSON parse: ' + e.message); }

  if (json.error) throw new Error('Gemini API: ' + json.error.message);

  const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Gemini bo\'sh javob qaytardi');
  return text.trim();
}

// ═══════════════════════════════════════
// NEWSAPI
// ═══════════════════════════════════════
async function fetchNews() {
  const p = [
    '/v2/top-headlines',
    '?sources=bbc-sport,goal,four-four-two,talksport',
    '&language=en',
    `&pageSize=15`,
    `&apiKey=${CONFIG.NEWS_KEY}`,
  ].join('');

  const res = await httpRequest({
    hostname : 'newsapi.org',
    path     : p,
    method   : 'GET',
    headers  : { 'User-Agent': 'InglizFutbolBot/1.0' },
    timeout  : 15000,
  });

  let json;
  try { json = JSON.parse(res.body); }
  catch (e) { throw new Error('NewsAPI JSON parse: ' + e.message); }

  if (json.status === 'error') throw new Error(`NewsAPI xato [${json.code}]: ${json.message}`);

  return json;
}

// ═══════════════════════════════════════
// MAQOLA TO'LIQ MATNINI OLISH
// ═══════════════════════════════════════
async function fetchArticleText(url) {
  try {
    const u = new URL(url);
    const res = await httpRequest({
      protocol : u.protocol,
      hostname : u.hostname,
      path     : u.pathname + u.search,
      method   : 'GET',
      headers  : {
        'User-Agent' : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept'     : 'text/html',
      },
      timeout : 8000,
    });

    const clean = res.body
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 2000);

    return clean || null;
  } catch (_) {
    return null;
  }
}

// ═══════════════════════════════════════
// AI PIPELINE — GEMINI + KUCHAYTIRILGAN PROMPT
// ═══════════════════════════════════════
async function translate(title, desc, content, url) {
  let baseText = (content || '').replace(/\[\+\d+ chars\]/g, '').trim();

  if (baseText.length < 300 && url) {
    const fetched = await fetchArticleText(url);
    if (fetched && fetched.length > baseText.length) baseText = fetched;
  }

  if (baseText.length < 100) {
    baseText = [title, desc].filter(Boolean).join('\n\n');
  }

  // Kuchaytirilgan user prompt — kontekst va vazifa aniq
  const userPrompt = `Quyidagi inglizcha futbol yangiligini professional o'zbek sport jurnalisti sifatida Telegram post qilib yoz.

MUHIM: Bu oddiy tarjima emas. O'zbek kitobxoni uchun jonli, his-tuyg'uli, jurnalistik matn yoz. Laqablarni ishlat, faol fe'l qo'llan, raqamlar aniq bo'lsin.

SARLAVHA: ${title || '(yo\'q)'}
TAVSIF: ${desc || '(yo\'q)'}

MAQOLA MATNI:
${baseText.slice(0, 2000)}

Faqat tayyor Telegram postini yoz. Boshqa hech narsa yozma. Markdown belgisi ishlatma.`;

  const raw = await gemini(userPrompt);
  return applyNames(raw);
}

// ═══════════════════════════════════════
// AVTOMATIK YANGILIK POST
// ═══════════════════════════════════════
async function autoNewsPost() {
  console.log('[autoNewsPost] Boshlandi:', new Date().toLocaleString());

  let data;
  try {
    data = await fetchNews();
  } catch (e) {
    console.error('[autoNewsPost] NewsAPI xatosi:', e.message);
    return false;
  }

  if (!data.articles || data.articles.length === 0) {
    console.log('[autoNewsPost] Yangilik topilmadi.');
    return false;
  }

  for (const article of data.articles) {
    const url = article.url;
    if (!url) continue;

    try {
      if (await isProcessed(url)) {
        console.log('[autoNewsPost] Keshda bor, o\'tkazildi:', article.title);
        continue;
      }
    } catch (e) {
      console.error('[autoNewsPost] SQLite tekshirish:', e.message);
      continue;
    }

    let post;
    try {
      post = await translate(article.title, article.description, article.content, url);
    } catch (e) {
      console.error('[autoNewsPost] AI xatosi:', e.message);
      await markProcessed(url, article.title).catch(() => {});
      continue;
    }

    if (!post || !post.trim()) {
      await markProcessed(url, article.title).catch(() => {});
      continue;
    }

    try {
      const result = await tg('sendMessage', {
        chat_id : CONFIG.CHANNEL,
        text    : post,
      });

      if (!result.ok) {
        console.error('[autoNewsPost] Telegram yuborishda rad:', result.description);
        continue;
      }

      await markProcessed(url, article.title).catch((e) => {
        console.error('[autoNewsPost] SQLite saqlash:', e.message);
      });

      console.log('[autoNewsPost] ✅ Yuborildi:', article.title);
      return true;

    } catch (e) {
      console.error('[autoNewsPost] Telegram yuborish xatosi:', e.message);
      continue;
    }
  }

  console.log('[autoNewsPost] Barcha yangiliklar keshda bor yoki xato bor.');
  return false;
}

// ═══════════════════════════════════════
// ADMIN XABARLARINI QAYTA ISHLASH
// ═══════════════════════════════════════
const pending = {};

async function handle(update) {
  try {
    if (!update?.message) return;

    const msg   = update.message;
    const id    = msg.chat.id;
    const text  = (msg.text || '').trim();
    const photo = msg.photo;

    if (photo) {
      const fileId  = photo[photo.length - 1].file_id;
      const caption = (msg.caption || '').trim();

      if (caption) {
        await tgSend(id, '⏳ Tayyorlanayapti...');
        try {
          const post  = await translate(caption, '', '', null);
          pending[id] = { type: 'photo', fileId, text: post };
          await tgSend(id, `👀 Ko'rib chiqing:\n\n${post}`);
          return tg('sendMessage', {
            chat_id      : id,
            text         : 'Yuborishni tasdiqlaysizmi?',
            reply_markup : { keyboard: [['✅ Yuborish'], ['❌ Bekor']], resize_keyboard: true },
          });
        } catch (e) {
          return tgSend(id, '❌ Xatolik: ' + e.message);
        }
      } else {
        pending[id] = { type: 'waitText', fileId };
        return tgSend(id, '📝 Yangilik matnini yozing:');
      }
    }

    if (!text) return;

    if (text === '/start') {
      return tgSend(id,
        '⚽ Ingliz Futboli Bot\n\n' +
        '📰 Matn yuboring → professional post\n' +
        '🖼 Rasm + matn → kanalga chiqadi\n' +
        '/yangilik — Yangi xabar oladi\n' +
        '/stat — Baza statistikasi'
      );
    }

    if (text === '/yangilik') {
      await tgSend(id, '⏳ Yangilik olinayapti...');
      const ok = await autoNewsPost();
      return tgSend(id, ok ? '✅ Post kanalga yuborildi!' : '❌ Yangi yangilik topilmadi.');
    }

    if (text === '/stat') {
      return new Promise((resolve) => {
        db.get('SELECT COUNT(*) as cnt FROM processed_articles', [], (err, row) => {
          const count = err ? '?' : row.cnt;
          tgSend(id, `📊 Bazada ${count} ta yangilik saqlangan.`).then(resolve).catch(resolve);
        });
      });
    }

    if (text === '✅ Yuborish' && pending[id]) {
      const p = pending[id];
      try {
        if (p.type === 'photo') {
          const cap = p.text.length > 1024 ? p.text.slice(0, 1020) + '...' : p.text;
          await tg('sendPhoto', { chat_id: CONFIG.CHANNEL, photo: p.fileId, caption: cap });
        } else {
          await tg('sendMessage', { chat_id: CONFIG.CHANNEL, text: p.text });
        }
        delete pending[id];
        return tg('sendMessage', {
          chat_id      : id,
          text         : '✅ Kanalga yuborildi!',
          reply_markup : { remove_keyboard: true },
        });
      } catch (e) {
        return tgSend(id, '❌ Yuborishda xato: ' + e.message);
      }
    }

    if (text === '❌ Bekor') {
      delete pending[id];
      return tg('sendMessage', {
        chat_id      : id,
        text         : '❌ Bekor qilindi.',
        reply_markup : { remove_keyboard: true },
      });
    }

    if (pending[id]?.type === 'waitText') {
      const { fileId } = pending[id];
      await tgSend(id, '⏳ Tayyorlanayapti...');
      try {
        const post  = await translate(text, '', '', null);
        pending[id] = { type: 'photo', fileId, text: post };
        await tgSend(id, `👀 Ko'rib chiqing:\n\n${post}`);
        return tg('sendMessage', {
          chat_id      : id,
          text         : 'Yuborishni tasdiqlaysizmi?',
          reply_markup : { keyboard: [['✅ Yuborish'], ['❌ Bekor']], resize_keyboard: true },
        });
      } catch (e) {
        delete pending[id];
        return tg('sendMessage', {
          chat_id      : id,
          text         : '❌ Xatolik: ' + e.message,
          reply_markup : { remove_keyboard: true },
        });
      }
    }

    if (!text.startsWith('/')) {
      await tgSend(id, '⏳ Tayyorlanayapti...');
      try {
        const post  = await translate(text, '', '', null);
        pending[id] = { type: 'text', text: post };
        await tgSend(id, `👀 Ko'rib chiqing:\n\n${post}`);
        return tg('sendMessage', {
          chat_id      : id,
          text         : 'Yuborishni tasdiqlaysizmi?',
          reply_markup : { keyboard: [['✅ Yuborish'], ['❌ Bekor']], resize_keyboard: true },
        });
      } catch (e) {
        return tgSend(id, '❌ Xatolik: ' + e.message);
      }
    }

  } catch (err) {
    console.error('[handle] Kutilmagan xato:', err.message);
    try {
      await tgSend(update?.message?.chat?.id, '❌ Ichki xatolik yuz berdi.');
    } catch (_) {}
  }
}

// ═══════════════════════════════════════
// HTTP SERVER (Webhook)
// ═══════════════════════════════════════
const server = http.createServer((req, res) => {
  if (req.method === 'POST') {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      res.writeHead(200);
      res.end('OK');
      if (!body) return;
      try {
        const update = JSON.parse(body);
        handle(update).catch((e) => console.error('[webhook] handle xatosi:', e.message));
      } catch (e) {
        console.error('[webhook] JSON parse xatosi:', e.message);
      }
    });
    req.on('error', (e) => {
      console.error('[req] xato:', e.message);
      res.writeHead(500);
      res.end();
    });
  } else {
    res.writeHead(200);
    res.end('Ingliz Futboli Bot ⚽ — ishlayapti');
  }
});

server.listen(CONFIG.PORT, '0.0.0.0', () => {
  console.log(`[server] Port ${CONFIG.PORT} da ishga tushdi.`);
  console.log('[autoNewsPost] Birinchi tekshiruv boshlanmoqda...');
  autoNewsPost().catch((e) => console.error('[startup] Xato:', e.message));
});

server.on('error', (e) => console.error('[server] xato:', e.message));

setInterval(() => {
  autoNewsPost().catch((e) => console.error('[interval] Xato:', e.message));
}, CONFIG.INTERVAL);

process.on('uncaughtException',  (e) => console.error('[uncaughtException]',  e.message));
process.on('unhandledRejection', (r) => console.error('[unhandledRejection]', r));
