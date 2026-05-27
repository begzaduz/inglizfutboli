const http = require('http');
const https = require('https');

const TOKEN = '8701604879:AAEeEUPd6bclS1zvIKKNAGu1qojRe5r4m1k';
const CHANNEL = '@Inglizfutbol';
const GROQ_KEY = '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';
const NEWS_KEY = 'd5344d1dcf8a4af7bc15bbf122cc0366';
const pending = {};
const postedIds = new Set();

// ── O'ZBEK NOMLARI ──
const NAMES = {
  // Klublar — Premier-liga
  'Liverpool': 'Liverpul',
  'Manchester City': 'Manchester Siti',
  'Man City': 'Manchester Siti',
  'Manchester United': 'Manchester Yunayted',
  'Man United': 'Manchester Yunayted',
  'Man Utd': 'Manchester Yunayted',
  'Arsenal': 'Arsenal',
  'Chelsea': 'Chelsi',
  'Tottenham Hotspur': 'Tottenhem Xotspur',
  'Tottenham': 'Tottenhem',
  'Spurs': 'Tottenhem',
  'Aston Villa': 'Aston Villa',
  'Newcastle United': 'Nyukasl Yunayted',
  'Newcastle': 'Nyukasl',
  'West Ham United': 'Vest Hem Yunayted',
  'West Ham': 'Vest Hem',
  'Brighton': 'Brayton',
  'Crystal Palace': 'Kristal Pelas',
  'Fulham': 'Fulhem',
  'Brentford': 'Brentford',
  'Bournemouth': 'Bornmut',
  'Nottingham Forest': 'Nottingem Forest',
  'Leicester City': 'Lester Siti',
  'Leicester': 'Lester',
  'Everton': 'Everton',
  'Wolverhampton Wanderers': 'Vulverhempton',
  'Wolverhampton': 'Vulverhempton',
  'Wolves': 'Vulverhempton',
  'Ipswich Town': 'Ipsvich Taun',
  'Ipswich': 'Ipsvich',
  'Southampton': 'Sautgempton',
  // Boshqa ingliz klublari
  'Leeds United': 'Lids Yunayted',
  'Leeds': 'Lids',
  'Sheffield United': 'Sheffild Yunayted',
  'Burnley': 'Bernli',
  'Norwich City': 'Norvich Siti',
  'Norwich': 'Norvich',
  'Watford': 'Uotford',
  'West Bromwich Albion': 'Vest Bromvich Albion',
  'Sunderland': 'Sanderlend',
  'Blackburn Rovers': 'Blekbern Rovers',
  'Middlesbrough': 'Midlsbro',
  'Stoke City': 'Stok Siti',
  // Xorijiy klublar
  'Real Madrid': 'Real Madrid',
  'Barcelona': 'Barselona',
  'Bayern Munich': 'Bayern Myunxen',
  'PSG': 'PSJ',
  'Paris Saint-Germain': 'Parij Sen-Jermen',
  'Juventus': 'Yuventus',
  'AC Milan': 'Milan',
  'Inter Milan': 'Inter',
  'Atletico Madrid': 'Atletiko Madrid',
  // Musobaqalar
  'Premier League': 'Premier-liga',
  'Champions League': 'Chempionlar ligasi',
  'FA Cup': 'FA Kubogi',
  'Carabao Cup': 'Karabao Kubogi',
  'Europa League': 'Evropa ligasi',
  'World Cup': 'Jahon chempionati',
  'Euro': 'Evropa chempionati',
  // O'yinchilar
  'Erling Haaland': 'Erling Holland',
  'Haaland': 'Holland',
  'Abdukodir Khusanov': 'Abduqodir Husanov',
  'Khusanov': 'Husanov',
  'Cole Palmer': 'Koul Palmer',
  'Palmer': 'Koul Palmer',
  'Bukayo Saka': 'Bukayo Saka',
  'Saka': 'Saka',
  'Phil Foden': 'Fil Foden',
  'Foden': 'Foden',
  'Martin Odegaard': 'Martin Edegor',
  'Ødegaard': 'Edegor',
  'Odegaard': 'Edegor',
  'Bruno Fernandes': 'Bruno Fernandesh',
  'Declan Rice': 'Deklan Rays',
  'Kevin De Bruyne': 'Kevin De Bryuyne',
  'De Bruyne': 'De Bryuyne',
  'Marcus Rashford': 'Markus Reshford',
  'Rashford': 'Reshford',
  'Ollie Watkins': 'Olli Uotkins',
  'Alexander Isak': 'Aleksandr Isak',
  'Isak': 'Isak',
  'Luis Diaz': 'Luis Dias',
  'Jack Grealish': 'Jek Grilish',
  'Grealish': 'Grilish',
  'Kai Havertz': 'Kay Haverts',
  'Havertz': 'Haverts',
  'Alejandro Garnacho': 'Alexandro Garnacho',
  'Garnacho': 'Garnacho',
  'Josko Gvardiol': 'Yoshko Gvardiol',
  'Gvardiol': 'Gvardiol',
  'Virgil van Dijk': 'Virjil van Deyk',
  'van Dijk': 'van Deyk',
  'Nicolas Jackson': 'Nikolas Jekson',
  'Salah': 'Saloh',
  'Mohamed Salah': 'Muhammad Saloh',
  // Murabbiylar
  'Enzo Maresca': 'Enso Mareska',
  'Maresca': 'Mareska',
  'Xabi Alonso': 'Xabi Alonso',
  'Roberto De Zerbi': 'Roberto De Zerbi',
  'Michael Carrick': 'Maykl Kerrik',
  'Carrick': 'Kerrik',
  'Mikel Arteta': 'Mikel Arteta',
  'Arteta': 'Arteta',
  'Arne Slot': 'Arne Slot',
  'Unai Emery': 'Unai Emeri',
  'Eddie Howe': 'Eddi Hau',
  'Howe': 'Hau',
  'Andoni Iraola': 'Andoni Iraola',
  'Fabian Hurzeler': 'Fabian Hyurseler',
  'Thomas Frank': 'Tomas Frank',
  'Sean Dyche': 'Shon Daych',
  'Nuno Espirito Santo': 'Nunu Eshpiritu Santu',
  'Gary O\'Neil': 'Gari O\'Nil',
  'Marco Silva': 'Marku Silva',
  'Oliver Glasner': 'Oliver Glazner',
  'Steve Cooper': 'Stiv Kuper',
  'Kieran McKenna': 'Kiran Makkenna',
  'Russell Martin': 'Rassel Martin',
  'Pep Guardiola': 'Pep Gvardiola',
  'Guardiola': 'Gvardiola',
  'Jurgen Klopp': 'Yurgen Klopp',
  'Klopp': 'Klopp',
  'Erik ten Hag': 'Erik ten Xag',
};

function applyNames(text) {
  let result = text;
  // Uzunroqdan qisqaga tartiblash — to'g'ri almashtirish uchun
  const sorted = Object.entries(NAMES).sort((a, b) => b[0].length - a[0].length);
  for (const [eng, uzb] of sorted) {
    const regex = new RegExp(`\\b${eng.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
    result = result.replace(regex, uzb);
  }
  return result;
}

// ── TELEGRAM ──
function tg(method, data) {
  const body = JSON.stringify(data);
  return new Promise((res, rej) => {
    const req = https.request({
      hostname: 'api.telegram.org',
      path: `/bot${TOKEN}/${method}`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    }, r => { let d = ''; r.on('data', c => d += c); r.on('end', () => { try { res(JSON.parse(d)); } catch(e) { rej(e); } }); });
    req.on('error', rej);
    req.write(body);
    req.end();
  });
}

// ── GROQ AI ──
function groq(prompt) {
  const body = JSON.stringify({
    model: 'llama-3.3-70b-versatile',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 600
  });
  return new Promise((res, rej) => {
    const req = https.request({
      hostname: 'api.groq.com',
      path: '/openai/v1/chat/completions',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GROQ_KEY}`, 'Content-Length': Buffer.byteLength(body) }
    }, r => { let d = ''; r.on('data', c => d += c); r.on('end', () => { try { const j = JSON.parse(d); if (j.error) return rej(new Error(j.error.message)); const t = j.choices?.[0]?.message?.content; if (t) res(t); else rej(new Error("Javob kelmadi")); } catch(e) { rej(e); } }); });
    req.on('error', rej);
    req.write(body);
    req.end();
  });
}

// ── NEWSAPI ──
function getNews() {
  return new Promise((res, rej) => {
    const path = `/v2/everything?q=premier+league&language=en&sortBy=publishedAt&pageSize=10&apiKey=${NEWS_KEY}`;
    const req = https.request({
      hostname: 'newsapi.org',
      path,
      method: 'GET',
      headers: { 'User-Agent': 'Mozilla/5.0' }
    }, r => { let d = ''; r.on('data', c => d += c); r.on('end', () => { try { res(JSON.parse(d)); } catch(e) { rej(e); } }); });
    req.on('error', rej);
    req.end();
  });
}

// ── TARJIMA ──
async function translate(title, desc) {
  const input = `${title}. ${desc || ''}`.slice(0, 1000);
  const raw = await groq(
    `Sen ingliz futboli mutaxassisisan va professional tarjimonsan.

Quyidagi inglizcha yangilikni O'ZBEK TILIGA tarjima qilib, Telegram post formatida yoz:

"${input}"

QOIDALAR:
1. Faqat o'zbek tilida yoz, grammatika to'g'ri bo'lsin
2. Klub, o'yinchi, murabbiy nomlarini ham o'zbek tiliga o'tkazib yoz
3. Quyidagi formatda yoz:

🚨 #BREAKING: [sarlavha]

🟢 [2-3 gap ma'lumot]

@Inglizfutbol

4. Boshqa hech narsa yozma`
  );
  return applyNames(raw);
}

// ── NEWSAPI AVTOMATIK POST ──
async function autoNewsPost() {
  try {
    const data = await getNews();
    if (!data.articles || data.articles.length === 0) {
      console.log('Yangilik topilmadi');
      return false;
    }
    for (const article of data.articles) {
      const id = article.url;
      if (postedIds.has(id)) continue;
      postedIds.add(id);
      if (postedIds.size > 200) postedIds.delete(postedIds.values().next().value);
      const post = await translate(article.title, article.description);
      const r = await tg('sendMessage', { chat_id: CHANNEL, text: post });
      if (!r.ok) { console.error("Telegram xatosi:", r.description); return false; }
      console.log('Yuborildi:', article.title);
      return true;
    }
    console.log('Barcha yangiliklar yuborilgan');
    return false;
  } catch(e) {
    console.error('autoNewsPost xato:', e.message);
    return false;
  }
}

// ── XABAR QAYTA ISHLASH ──
async function handle(update) {
  try {
    if (!update || !update.message) return;
    const msg = update.message;
    const id = msg.chat.id;
    const text = (msg.text || '').trim();
    const photo = msg.photo;

    if (photo) {
      const fileId = photo[photo.length - 1].file_id;
      const caption = (msg.caption || '').trim();
      if (caption) {
        await tg('sendMessage', { chat_id: id, text: '⏳ Tayyorlanayapti...' });
        const post = await translate(caption, '');
        pending[id] = { type: 'photo', fileId, text: post };
        return tg('sendMessage', {
          chat_id: id,
          text: `👀 *Ko'rib chiqing:*\n\n${post}`,
          parse_mode: 'Markdown',
          reply_markup: { keyboard: [['✅ Yuborish'], ['❌ Bekor']], resize_keyboard: true }
        });
      } else {
        pending[id] = { type: 'waitText', fileId };
        return tg('sendMessage', { chat_id: id, text: '📝 Yangilik matnini yozing:' });
      }
    }

    if (!text) return;

    if (text === '/start') {
      return tg('sendMessage', {
        chat_id: id,
        text: '⚽ *Ingliz Futboli Bot*\n\n📰 Matn yuboring → tarjima qiladi\n🖼 Rasm + matn → kanalga chiqadi\n/yangilik — Haqiqiy yangilik oladi',
        parse_mode: 'Markdown'
      });
    }

    if (text === '/yangilik' || text === '/ai') {
      await tg('sendMessage', { chat_id: id, text: '⏳ Yangilik olinayapti...' });
      const ok = await autoNewsPost();
      return tg('sendMessage', { chat_id: id, text: ok ? '✅ Post kanalga yuborildi!' : '❌ Yangi yangilik topilmadi.' });
    }

    if (text === '✅ Yuborish' && pending[id]) {
      const p = pending[id];
      if (p.type === 'photo') {
        await tg('sendPhoto', { chat_id: CHANNEL, photo: p.fileId, caption: p.text });
      } else {
        await tg('sendMessage', { chat_id: CHANNEL, text: p.text });
      }
      delete pending[id];
      return tg('sendMessage', { chat_id: id, text: '✅ Yuborildi!', reply_markup: { remove_keyboard: true } });
    }

    if (text === '❌ Bekor') {
      delete pending[id];
      return tg('sendMessage', { chat_id: id, text: '❌ Bekor.', reply_markup: { remove_keyboard: true } });
    }

    if (pending[id]?.type === 'waitText') {
      const fileId = pending[id].fileId;
      await tg('sendMessage', { chat_id: id, text: '⏳ Tayyorlanayapti...' });
      const post = await translate(text, '');
      pending[id] = { type: 'photo', fileId, text: post };
      return tg('sendMessage', {
        chat_id: id,
        text: `👀 *Ko'rib chiqing:*\n\n${post}`,
        parse_mode: 'Markdown',
        reply_markup: { keyboard: [['✅ Yuborish'], ['❌ Bekor']], resize_keyboard: true }
      });
    }

    if (!text.startsWith('/')) {
      await tg('sendMessage', { chat_id: id, text: '⏳ Tayyorlanayapti...' });
      const post = await translate(text, '');
      pending[id] = { type: 'text', text: post };
      return tg('sendMessage', {
        chat_id: id,
        text: `👀 *Ko'rib chiqing:*\n\n${post}`,
        parse_mode: 'Markdown',
        reply_markup: { keyboard: [['✅ Yuborish'], ['❌ Bekor']], resize_keyboard: true }
      });
    }

  } catch(err) {
    console.error("Handle xato:", err.message);
  }
}

// Har 30 daqiqada avtomatik yangilik
setInterval(autoNewsPost, 30 * 60 * 1000);

const PORT = process.env.PORT || 8080;
http.createServer((req, res) => {
  if (req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      res.writeHead(200); res.end('OK');
      try { if (body) handle(JSON.parse(body)); } catch(e) { console.error("Parse xato:", e.message); }
    });
  } else {
    res.writeHead(200); res.end('Bot ishlayapti ⚽');
  }
}).listen(PORT, '0.0.0.0', () => console.log('Server ' + PORT + ' portda faol.'));
