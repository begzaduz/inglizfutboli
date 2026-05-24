const http = require('http');
const https = require('https');

const TOKEN = '8701604879:AAEeEUPd6bclS1zvIKKNAGu1qojRe5r4m1k';
const CHANNEL = '@Inglizfutbol';
const GEMINI_KEY = 'AIzaSyADl3w0TDHZDSVgg4qCE-Fg0fm1mzAwIOA';
const pending = {};

// Telegram API bilan ishlash funksiyasi
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

// Gemini AI bilan ishlash funksiyasi
// Gemini AI (Xatolikni aniq ko'rsatadigan yangi versiya)
function gemini(prompt) {
  const body = JSON.stringify({
    contents: [{ parts: [{ text: prompt }] }]
  });
  return new Promise((res, rej) => {
    const req = https.request({
      hostname: 'generativelanguage.googleapis.com',
      path: `/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`,
      method: 'POST',
      headers: {'Content-Type':'application/json','Content-Length':Buffer.byteLength(body)}
    }, r => { let d=''; r.on('data',c=>d+=c); r.on('end',()=>{
      try {
        const j = JSON.parse(d);
        
        // Agar Google biror xato qaytargan bo'lsa, uni konsolga chiqaramiz
        if (j.error) {
          console.error("Google Gemini API Xatoligi:", j.error.message);
          return rej(new Error(`Google API xatosi: ${j.error.message}`));
        }

        if (j.candidates && j.candidates[0] && j.candidates[0].content && j.candidates[0].content.parts) {
          res(j.candidates[0].content.parts[0].text);
        } else {
          console.error("Google javob formati boshqacha keldi:", d);
          rej(new Error("Kutilmagan javob formati"));
        }
      } catch(e) { rej(e); }
    }); });
    req.on('error', rej);
    req.write(body);
    req.end();
  });
}

// AI yangilik yozish funksiyasi (Tuzatilgan versiya)
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
      `Sen ingliz futboli mutaxassisisan. "${mavzu}" haqica qisqa, qiziqarli Telegram post yoz.
      Post o'zbek tilida bo'lsin. 3-4 gap. Emoji ishlatsin. 
      Faqat postni yoz, boshqa hech narsa yozma.
      Oxirida yangi qatordan: #InglizFutboli #PremierLeague`
    );

    // Markdown olib tashlandi, chunki Gemini belgilari xatolikka sabab bo'layotgan edi
    const res = await tg('sendMessage', {
      chat_id: CHANNEL,
      text: post
    });

    if (!res.ok) {
      throw new Error(res.description);
    }

    console.log('AI post yuborildi:', new Date().toLocaleString());
    return true; 
  } catch(e) {
    console.error('AI xato yuz berdi:', e.message);
    return false; 
  }
}

// Kelayotgan xabarlarni qayta ishlash
async function handle(update) {
  const msg = update.message;
  if (!msg) return;
  const id = msg.chat.id;
  const text = msg.text || '';

  if (text === '/start') {
    return tg('sendMessage', {
      chat_id: id,
      text: '⚽ *Ingliz Futboli Bot*\n\nYangilik yozing yoki /ai buyrug\'ini bering!\n\n/ai — AI yangilik yozadi\n/avtomatik — Har 3 soatda AI o\'zi yozadi',
      parse_mode: 'Markdown'
    });
  }

  // AI buyrug'i (Tuzatilgan qismi)
  if (text === '/ai') {
    await tg('sendMessage', {chat_id: id, text: '⏳ AI yangilik yozayapti...'});
    const muvaffaqiyat = await autoPost();
    
    if (muvaffaqiyat) {
      await tg('sendMessage', {chat_id: id, text: '✅ AI post kanalga yuborildi!'});
    } else {
      await tg('sendMessage', {chat_id: id, text: '❌ AI xabar yuborishda xatolik bo\'ldi. Kanalda bot adminligini va konsolni tekshiring.'});
    }
    return;
  }

  // Tasdiqlash
  if (text === '✅ Yuborish' && pending[id]) {
    await tg('sendMessage', {chat_id: CHANNEL, text: pending[id]});
    delete pending[id];
    return tg('sendMessage', {chat_id: id, text: '✅ Yuborildi!', reply_markup: {remove_keyboard: true}});
  }

  // Bekor qilish
  if (text === '❌ Bekor' && pending[id]) {
    delete pending[id];
    return tg('sendMessage', {chat_id: id, text: '❌ Bekor.', reply_markup: {remove_keyboard: true}});
  }

  // Oddiy xabar (Siz yozgan xabar)
  if (text && !text.startsWith('/')) {
    pending[id] = text;
    return tg('sendMessage', {
      chat_id: id,
      text: `👀 *Ko'rib chiqing:*\n\n${text}`,
      parse_mode: 'Markdown',
      reply_markup: {keyboard: [['✅ Yuborish'], ['❌ Bekor']], resize_keyboard: true}
    });
  }
}

// Har 3 soatda AI avtomatik post joylaydi
setInterval(autoPost, 3 * 60 * 60 * 1000);

// Serverni ishga tushirish
const PORT = process.env.PORT || 8080;
http.createServer((req, res) => {
  if (req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      res.writeHead(200);
      res.end('OK');
      try { handle(JSON.parse(body)); } catch(e) {}
    });
  } else {
    res.writeHead(200);
    res.end('OK');
  }
}).listen(PORT, '0.0.0.0', () => console.log('Bot muvaffaqiyatli ishga tushdi, Port: ' + PORT));
