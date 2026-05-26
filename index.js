const http = require('http');
const https = require('https');

const TOKEN = '8701604879:AAEeEUPd6bclS1zvIKKNAGu1qojRe5r4m1k';
const CHANNEL = '@Inglizfutbol';
const GROQ_KEY = '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';
const pending = {};
const lastRssLinks = new Set();

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
    max_tokens: 500
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

// ── URL DAN MATN O'QISH ──
function fetchUrl(url) {
  return new Promise((res, rej) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, r => {
      if (r.statusCode === 301 || r.statusCode === 302) return fetchUrl(r.headers.location).then(res).catch(rej);
      let d = ''; r.on('data', c => d += c); r.on('end', () => res(d));
    });
    req.on('error', rej);
    req.setTimeout(10000, () => { req.destroy(); rej(new Error('Timeout')); });
  });
}

// ── RSS DAN YANGILIK ──
async function getRssNews() {
  try {
    const rssUrl = 'https://feeds.bbci.co.uk/sport/football/rss.xml';
    const xml = await fetchUrl(rssUrl);
    const items = xml.match(/<item>([\s\S]*?)<\/item>/g) || [];
    for (const item of items) {
      const title = (item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) || item.match(/<title>(.*?)<\/title>/))?.[1] || '';
      const desc = (item.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/) || item.match(/<description>(.*?)<\/description>/))?.[1] || '';
      const link = item.match(/<link>(.*?)<\/link>/)?.[1] || '';
      if (link && !lastRssLinks.has(link) && title) {
        lastRssLinks.add(link);
        if (lastRssLinks.size > 50) lastRssLinks.delete(lastRssLinks.values().next().value);
        return { title, desc: desc.replace(/<[^>]+>/g, ''), link };
      }
    }
    return null;
  } catch(e) {
    console.error('RSS xato:', e.message);
    return null;
  }
}

// ── MATNNI TARJIMA QILISH ──
async function translate(text) {
  return groq(
    `Sen ingliz futboli mutaxassisisan. Quyidagi inglizcha yangilikni o'zbek tiliga tarjima qilib, Telegram post formatida yoz:

"${text}"

Format:
🚨 #BREAKING: [qisqa sarlavha]

🟢 [2-3 gap asosiy ma'lumot]

@Inglizfutbol

Faqat postni yoz, boshqa hech narsa yozma.`
  );
}

// ── RSS AVTOMATIK POST ──
async function autoRssPost() {
  try {
    const news = await getRssNews();
    if (!news) {
      console.log('Yangi yangilik topilmadi');
      return false;
    }
    const post = await translate(news.title + '. ' + news.desc);
    const r = await tg('sendMessage', { chat_id: CHANNEL, text: post });
    if (!r.ok) { console.error("Telegram xatosi:", r.description); return false; }
    console.log('RSS post yuborildi:', news.title);
    return true;
  } catch(e) {
    console.error('autoRssPost xato:', e.message);
    return false;
  }
}

// ── LINK DAN POST ──
async function postFromLink(link) {
  try {
    const html = await fetchUrl(link);
    const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 2000);
    return translate(text);
  } catch(e) {
    throw new Error('Link o\'qib bo\'lmadi: ' + e.message);
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

    // Rasm + matn (caption bilan)
    if (photo && msg.caption) {
      const caption = msg.caption.trim();
      const fileId = photo[photo.length - 1].file_id;

      // Agar caption link bo'lsa
      if (caption.startsWith('http')) {
        await tg('sendMessage', { chat_id: id, text: '⏳ Link o\'qilayapti...' });
        try {
          const post = await postFromLink(caption);
          pending[id] = { type: 'photo', fileId, text: post };
          return tg('sendMessage', {
            chat_id: id,
            text: `👀 *Ko'rib chiqing:*\n\n${post}`,
            parse_mode: 'Markdown',
            reply_markup: { keyboard: [['✅ Yuborish'], ['❌ Bekor']], resize_keyboard: true }
          });
        } catch(e) {
          return tg('sendMessage', { chat_id: id, text: '❌ Link o\'qib bo\'lmadi.' });
        }
      }

      // Agar caption oddiy matn bo'lsa
      const post = await translate(caption);
      pending[id] = { type: 'photo', fileId, text: post };
      return tg('sendMessage', {
        chat_id: id,
        text: `👀 *Ko'rib chiqing:*\n\n${post}`,
        parse_mode: 'Markdown',
        reply_markup: { keyboard: [['✅ Yuborish'], ['❌ Bekor']], resize_keyboard: true }
      });
    }

    // Faqat rasm (caption yo'q)
    if (photo) {
      pending[id] = { type: 'waitText', fileId: photo[photo.length - 1].file_id };
      return tg('sendMessage', { chat_id: id, text: '📝 Yangilik matnini yoki linkni yozing:' });
    }

    if (!text) return;

    // /start
    if (text === '/start') {
      return tg('sendMessage', {
        chat_id: id,
        text: '⚽ *Ingliz Futboli Bot*\n\n*Qanday ishlaydi:*\n\n📰 Link yuboring → tarjima qiladi\n🖼 Rasm + link/matn → kanalga chiqadi\n✍️ Matn yozing → kanalga yuboradi\n/ai — AI yangilik yozadi\n/rss — BBC Sport dan yangilik oladi',
        parse_mode: 'Markdown'
      });
    }

    // /ai
    if (text === '/ai') {
      await tg('sendMessage', { chat_id: id, text: '⏳ AI yangilik yozayapti...' });
      const ok = await autoRssPost();
      return tg('sendMessage', { chat_id: id, text: ok ? '✅ Post kanalga yuborildi!' : '❌ Xatolik yuz berdi.' });
    }

    // /rss
    if (text === '/rss') {
      await tg('sendMessage', { chat_id: id, text: '⏳ BBC Sport dan yangilik olinayapti...' });
      const ok = await autoRssPost();
      return tg('sendMessage', { chat_id: id, text: ok ? '✅ Post kanalga yuborildi!' : '❌ Yangi yangilik topilmadi.' });
    }

    // Tasdiqlash
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

    // Bekor
    if (text === '❌ Bekor') {
      delete pending[id];
      return tg('sendMessage', { chat_id: id, text: '❌ Bekor.', reply_markup: { remove_keyboard: true } });
    }

    // Rasm kutilayotgan bo'lsa, matn keldi
    if (pending[id]?.type === 'waitText') {
      const fileId = pending[id].fileId;
      await tg('sendMessage', { chat_id: id, text: '⏳ Tayyorlanayapti...' });
      let post;
      if (text.startsWith('http')) {
        try { post = await postFromLink(text); } catch(e) { return tg('sendMessage', { chat_id: id, text: '❌ Link o\'qib bo\'lmadi.' }); }
      } else {
        post = await translate(text);
      }
      pending[id] = { type: 'photo', fileId, text: post };
      return tg('sendMessage', {
        chat_id: id,
        text: `👀 *Ko'rib chiqing:*\n\n${post}`,
        parse_mode: 'Markdown',
        reply_markup: { keyboard: [['✅ Yuborish'], ['❌ Bekor']], resize_keyboard: true }
      });
    }

    // Link yuborildi
    if (text.startsWith('http')) {
      await tg('sendMessage', { chat_id: id, text: '⏳ Link o\'qilayapti...' });
      try {
        const post = await postFromLink(text);
        pending[id] = { type: 'text', text: post };
        return tg('sendMessage', {
          chat_id: id,
          text: `👀 *Ko'rib chiqing:*\n\n${post}`,
          parse_mode: 'Markdown',
          reply_markup: { keyboard: [['✅ Yuborish'], ['❌ Bekor']], resize_keyboard: true }
        });
      } catch(e) {
        return tg('sendMessage', { chat_id: id, text: '❌ Link o\'qib bo\'lmadi.' });
      }
    }

    // Oddiy matn
    if (!text.startsWith('/')) {
      pending[id] = { type: 'text', text };
      return tg('sendMessage', {
        chat_id: id,
        text: `👀 *Ko'rib chiqing:*\n\n${text}`,
        parse_mode: 'Markdown',
        reply_markup: { keyboard: [['✅ Yuborish'], ['❌ Bekor']], resize_keyboard: true }
      });
    }

  } catch(err) {
    console.error("Handle xato:", err.message);
  }
}

// Har 3 soatda avtomatik RSS post
setInterval(autoRssPost, 3 * 60 * 60 * 1000);

// ── SERVER ──
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
