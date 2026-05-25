const http = require('http');
const https = require('https');

const TOKEN = process.env.BOT_TOKEN;
const GEMINI_KEY = process.env.GEMINI_KEY;

const CHANNEL = '@Inglizfutbol';
const pending = {};

// ================= TELEGRAM API =================
function tg(method, data) {
  const body = JSON.stringify(data);

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.telegram.org',
      path: `/bot${TOKEN}/${method}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    }, res => {
      let d = '';

      res.on('data', c => d += c);

      res.on('end', () => {
        try {
          resolve(JSON.parse(d));
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ================= GEMINI AI =================
function gemini(prompt) {
  const body = JSON.stringify({
    contents: [
      {
        role: 'user',
        parts: [{ text: prompt }]
      }
    ]
  });

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'generativelanguage.googleapis.com',
      path: `/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    }, res => {
      let d = '';

      res.on('data', c => d += c);

      res.on('end', () => {
        try {
          const json = JSON.parse(d);

          if (json.error) {
            return reject(new Error(json.error.message));
          }

          const text =
            json.candidates?.[0]?.content?.parts?.[0]?.text;

          if (!text) {
            return reject(new Error('AI javob qaytarmadi'));
          }

          resolve(text);

        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ================= AI POST =================
async function autoPost() {
  try {

    const topics = [
      'Premier League yangiliklari',
      'Arsenal transferlari',
      'Manchester City tarkibi',
      'Liverpool formasi',
      'Chelsea yangiliklari',
      'Manchester United muammolari'
    ];

    const topic =
      topics[Math.floor(Math.random() * topics.length)];

    const post = await gemini(`
"${topic}" haqida o'zbek tilida Telegram post yoz.

Talablar:
- 3-4 gap
- Qiziqarli uslub
- Emoji ishlat
- Oxirida hashtag qo'sh

Hashtag:
#InglizFutboli #PremierLeague
`);

    const result = await tg('sendMessage', {
      chat_id: CHANNEL,
      text: post
    });

    if (!result.ok) {
      console.log(result);
      return false;
    }

    console.log('AI post yuborildi');
    return true;

  } catch (e) {
    console.error('AI xato:', e.message);
    return false;
  }
}

// ================= HANDLE MESSAGE =================
async function handle(update) {

  try {

    if (!update.message) return;

    const msg = update.message;
    const id = msg.chat.id;
    const text = msg.text?.trim();

    if (!text) return;

    // START
    if (text === '/start') {

      return tg('sendMessage', {
        chat_id: id,
        text:
`⚽ Ingliz Futboli Bot

/ai — AI post yozadi

Oddiy matn yuborsangiz preview chiqadi.`,
      });
    }

    // AI POST
    if (text === '/ai') {

      await tg('sendMessage', {
        chat_id: id,
        text: '⏳ AI post yozmoqda...'
      });

      const ok = await autoPost();

      return tg('sendMessage', {
        chat_id: id,
        text: ok
          ? '✅ Kanalga yuborildi'
          : '❌ Xatolik yuz berdi'
      });
    }

    // SEND
    if (text === '✅ Yuborish' && pending[id]) {

      await tg('sendMessage', {
        chat_id: CHANNEL,
        text: pending[id]
      });

      delete pending[id];

      return tg('sendMessage', {
        chat_id: id,
        text: '✅ Yuborildi',
        reply_markup: {
          remove_keyboard: true
        }
      });
    }

    // CANCEL
    if (text === '❌ Bekor' && pending[id]) {

      delete pending[id];

      return tg('sendMessage', {
        chat_id: id,
        text: '❌ Bekor qilindi',
        reply_markup: {
          remove_keyboard: true
        }
      });
    }

    // PREVIEW
    if (!text.startsWith('/')) {

      pending[id] = text;

      return tg('sendMessage', {
        chat_id: id,
        text: `👀 Preview:\n\n${text}`,
        reply_markup: {
          keyboard: [
            ['✅ Yuborish'],
            ['❌ Bekor']
          ],
          resize_keyboard: true
        }
      });
    }

  } catch (e) {
    console.error('Handle xato:', e.message);
  }
}

// ================= AUTO POST =================
setInterval(() => {
  autoPost();
}, 3 * 60 * 60 * 1000);

// ================= SERVER =================
const PORT = process.env.PORT || 8080;

http.createServer((req, res) => {

  if (req.method === 'POST') {

    let body = '';

    req.on('data', c => body += c);

    req.on('end', () => {

      res.writeHead(200);
      res.end('OK');

      try {

        const json = JSON.parse(body);

        handle(json);

      } catch (e) {
        console.error('Webhook xato:', e.message);
      }

    });

  } else {

    res.writeHead(200);
    res.end('Bot ishlayapti ⚽');

  }

}).listen(PORT, () => {
  console.log(`Server ${PORT} portda ishlayapti`);
});
