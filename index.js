const http = require('http');
const https = require('https');

const TOKEN = '8701604879:AAEeEUPd6bclS1zvIKKNAGu1qojRe5r4m1k';
const CHANNEL = '@Inglizfutbol';
const GROQ_KEY = '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';
const pending = {};

function tg(method, data) {
  const body = JSON.stringify(data);
  return new Promise((res, rej) => {
    const req = https.request({
      hostname: 'api.telegram.org',
      path: `/bot${TOKEN}/${method}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    }, r => {
      let d = '';
      r.on('data', c => d += c);
      r.on('end', () => {
        try { res(JSON.parse(d)); } catch(e) { rej(e); }
      });
    });
    req.on('error', rej);
    req.write(body);
    req.end();
  });
}

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
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_KEY}`,
        'Content-Length': Buffer.byteLength(body)
      }
    }, r => {
      let d = '';
      r.on('data', c => d += c);
      r.on('end', () => {
        try {
          const j = JSON.parse(d);
          if (j.error) return rej(new Error(j.error.message));
          const text = j.choices?.[0]?.message?.content;
          if (text) res(text);
          else rej(new Error("Javob kelmadi"));
        } catch(e) { rej(e); }
      });
    });
    req.on('error', rej);
    req.write(body);
    req.end();
  });
}

async function autoPost() {
  try {
    const mavzular = [
      "Premier League so'nggi yangiliklari",
      "Premier League transferlar",
      "Arsenal FC yangiliklari",
      "Manchester City yangiliklari",
      "Liverpool FC yangiliklari",
      "Chelsea FC yangiliklari",
    ];
    const mavzu = mavzular[Math.floor(Math.random() * mavzular.length)];
    const post = await groq(
      `Sen ingliz futboli mutaxassisisan. "${mavzu}" haqida qisqa, qiziqarli Telegram post yoz. O'zbek tilida, 3-4 gap, emoji bilan. Faqat postni yoz, boshqa hech narsa yozma. Oxirida: #InglizFutboli #PremierLeague`
    );
    const r = await tg('sendMessage', { chat_id: CHANNEL, text: post });
    if (!r.ok) { console.error("Telegram xatosi:", r.description); return false; }
    console.log('AI post yuborildi:', new Date().toLocaleString());
    return true;
  } catch(e) {
    console.error('autoPost xato:', e.message);
    return false;
  }
}

async function handle(update) {
  try {
    if (!update || !update.message) return;
    const msg = update.message;
    const id = msg.chat.id;
    const text = (msg.text || '').trim();
    if (!text) return;

    if (text === '/start') {
      return tg('sendMessage', {
        chat_id: id,
        text: '⚽ *Ingliz Futboli Bot*\n\nYangilik yozing yoki /ai buyrug\'ini bering!\n\n/ai — AI yangilik yozadi',
        parse_mode: 'Markdown'
      });
    }

    if (text === '/ai') {
      await tg('sendMessage', { chat_id: id, text: '⏳ AI yangilik yozayapti...' });
      const ok = await autoPost();
      return tg('sendMessage', {
        chat_id: id,
        text: ok ? '✅ AI post kanalga yuborildi!' : '❌ Xatolik. Keyinroq urinib ko\'ring.'
      });
    }

    if (text === '✅ Yuborish' && pending[id]) {
      await tg('sendMessage', { chat_id: CHANNEL, text: pending[id] });
      delete pending[id];
      return tg('sendMessage', {
        chat_id: id,
        text: '✅ Yuborildi!',
        reply_markup: { remove_keyboard: true }
      });
    }

    if (text === '❌ Bekor' && pending[id]) {
      delete pending[id];
      return tg('sendMessage', {
        chat_id: id,
        text: '❌ Bekor.',
        reply_markup: { remove_keyboard: true }
      });
    }

    if (!text.startsWith('/')) {
      pending[id] = text;
      return tg('sendMessage', {
        chat_id: id,
        text: `👀 *Ko'rib chiqing:*\n\n${text}`,
        parse_mode: 'Markdown',
        reply_markup: {
          keyboard: [['✅ Yuborish'], ['❌ Bekor']],
          resize_keyboard: true
        }
      });
    }
  } catch(err) {
    console.error("Handle xato:", err.message);
  }
}

setInterval(autoPost, 3 * 60 * 60 * 1000);

const PORT = process.env.PORT || 8080;
http.createServer((req, res) => {
  if (req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      res.writeHead(200);
      res.end('OK');
      try {
        if (body) handle(JSON.parse(body));
      } catch(e) {
        console.error("Webhook parse xato:", e.message);
      }
    });
  } else {
    res.writeHead(200);
    res.end('Bot ishlayapti ⚽');
  }
}).listen(PORT, '0.0.0.0', () => {
  console.log('Server ' + PORT + ' portda faol.');
});
