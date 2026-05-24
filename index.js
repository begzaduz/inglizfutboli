const http = require('http');
const https = require('https');

const TOKEN = '8701604879:AAEeEUPd6bclS1zvIKKNAGu1qojRe5r4m1k';
const CHANNEL = '@Inglizfutbol';
const GEMINI_KEY = 'AIzaSyADl3w0TDHZDSVgg4qCE-Fg0fm1mzAwIOA';
const pending = {};

// Telegram API ulanishi
function tg(method, data) {
  const body = JSON.stringify(data);
  return new Promise((res, rej) => {
    const req = https.request({
      hostname: 'api.telegram.org',
      path: `/bot${TOKEN}/${method}`,
      method: 'POST',
      headers: {'Content-Type':'application/json','Content-Length':Buffer.byteLength(body)}
    }, r => { let d=''; r.on('data',c=>d+=c); r.on('end',()=>res(JSON.parse(d))); });
    req.on('error', rej);
    req.write(body);
    req.end();
  });
}

// Gemini AI ulanishi (Eng oxirgi barqaror v1 versiyasi)
function gemini(prompt) {
  const body = JSON.stringify({
    contents: [{ parts: [{ text: prompt }] }]
  });
  return new Promise((res, rej) => {
    const req = https.request({
      hostname: 'generativelanguage.googleapis.com',
      path: `/v1/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`,
      method: 'POST',
      headers: {'Content-Type':'application/json','Content-Length':Buffer.byteLength(body)}
    }, r => { let d=''; r.on('data',c=>d+=c); r.on('end',()=>{
      try {
        const j = JSON.parse(d);
        if (j.error) {
          console.error("Google Gemini API Xatoligi:", j.error.message);
          return rej(new Error(j.error.message));
        }
        if (j.candidates && j.candidates[0] && j.candidates[0].content && j.candidates[0].content.parts) {
          res(j.candidates[0].content.parts[0].text);
        } else {
          rej(new Error("Kutilmagan javob formati"));
        }
      } catch(e) { rej(e); }
    }); });
    req.on('error', rej);
    req.write(body);
    req.end();
  });
}

// Avtomatik yoki buyruq orqali post tayyorlash
async function autoPost() {
  try {
    const mavzular = [
      'Premier League so\'nggi yangiliklari',
      'Premier League transferlar',
      'Arsenal FC yangiliklari',
      'Manchester City yangiliklari',
      'Liverpool FC yangiliklari',
      'Chelsea FC yangiliklari',
    ];
    const mavzu = mavzular[Math.floor(Math.random() * mavzular.length)];

    const post = await gemini(
      `Sen ingliz futboli mutaxassisisan. "${mavzu}" haqida qisqa, qiziqarli Telegram post yoz.
      Post o'zbek tilida bo'lsin. 3-4 gap. Emoji ishlatsin. 
      Faqat postni yoz, boshqa hech narsa yozma.
      Oxirida yangi qatordan: #InglizFutboli #PremierLeague`
    );

    const res = await tg('sendMessage', {
      chat_id: CHANNEL,
      text: post
    });

    if (!res.ok) {
      console.error("Telegram xatosi:", res.description);
      return false;
    }

    console.log('AI post yuborildi:', new Date().toLocaleString());
    return true; 
  } catch(e) {
    console.error('AI xato yuz berdi:', e.message);
    return false; 
  }
}

// Xabarlarni qayta ishlash (134-qatordagi xatolik to'liq tuzatildi)
async function handle(update) {
  try {
    if (!update || !update.message) return;
    const msg = update.message;
    const id = msg.chat.id;
    const text = msg.text ? msg.text.trim() : '';

    if (!text) return;

    if (text === '/start') {
      return tg('sendMessage', {
        chat_id: id,
        text: '⚽ *Ingliz Futboli Bot*\n\nYangilik yozing yoki /ai buyrug\'ini bering!\n\n/ai — AI yangilik yozadi\n/avtomatik — Har 3 soatda AI o\'zi yozadi',
        parse_mode: 'Markdown'
      });
    }

    if (text === '/ai') {
      await tg('sendMessage', {chat_id: id, text: '⏳ AI yangilik yozayapti...'});
      const muvaffaqiyat = await autoPost();
      if (muvaffaqiyat) {
        await tg('sendMessage', {chat_id: id, text: '✅ AI post kanalga yuborildi!'});
      } else {
        await tg('sendMessage', {chat_id: id, text: '❌ Xatolik bo\'ldi. Railway loglarini tekshiring.'});
      }
      return;
    }

    if (text === '✅ Yuborish' && pending[id]) {
      await tg('sendMessage', {chat_id: CHANNEL, text: pending[id]});
      delete pending[id];
      return tg('sendMessage', {chat_id: id, text: '✅ Yuborildi!', reply_markup: {remove_keyboard: true}});
    }

    if (text === '❌ Bekor' && pending[id]) {
      delete pending[id];
      return tg('sendMessage', {chat_id: id, text: '❌ Bekor.', reply_markup: {remove_keyboard: true}});
    }

    if (!text.startsWith('/')) {
      pending[id] = text;
      return tg('sendMessage', {
        chat_id: id,
        text: `👀 *Ko'rib chiqing:*\n\n${text}`,
        parse_mode: 'Markdown',
        reply_markup: {keyboard: [['✅ Yuborish'], ['❌ Bekor']], resize_keyboard: true}
      });
    }
  } catch (err) {
    console.error("Handle ichida xato:", err.message);
  }
}

// Har 3 soatda post
setInterval(autoPost, 3 * 60 * 60 * 1000);

// Server
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
      } catch(e) {
        console.error("JSON Parseda xato:", e.message);
      }
    });
  } else {
    res.writeHead(200);
    res.end('OK');
  }
}).listen(PORT, '0.0.0.0', () => console.log('Bot muvaffaqiyatli ishga tushdi, Port: ' + PORT));
