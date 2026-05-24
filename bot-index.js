const https = require('https');

const BOT_TOKEN = '8701604879:AAEeEUPd6bclS1zvIKKNAGu1qojRe5r4m1k';
const CHANNEL = '@Inglizfutbol';
const GEMINI_KEY = 'AIzaSyBfEszXmTlfqnVlkhxhpNPkNtfV9RR4XjU';
const ADMIN_ID = ''; // sizning Telegram ID ingiz

// Telegram API
function telegram(method, data) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(data);
    const req = https.request({
      hostname: 'api.telegram.org',
      path: `/bot${BOT_TOKEN}/${method}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve(JSON.parse(d)));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// Gemini AI
function gemini(text) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      contents: [{
        parts: [{
          text: `Sen ingliz futboli mutaxassisisan. Quyidagi matnni professional o'zbek tiliga tarjima qil va chiroyli Telegram post formatida yoz. Emoji qo'sh. Faqat tayyor postni yoz, boshqa hech narsa yozma:\n\n${text}`
        }]
      }]
    });
    const req = https.request({
      hostname: 'generativelanguage.googleapis.com',
      path: `/v1beta/models/gemini-pro:generateContent?key=${GEMINI_KEY}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try {
          const r = JSON.parse(d);
          resolve(r.candidates[0].content.parts[0].text);
        } catch(e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// Pending posts (xotira)
const pending = {};

// Webhook handler
async function handleUpdate(update) {
  const msg = update.message;
  if (!msg) return;

  const chatId = msg.chat.id;
  const text = msg.text || '';
  const userId = msg.from.id;

  // Faqat admin
  // if (String(userId) !== ADMIN_ID) return;

  // /start
  if (text === '/start') {
    await telegram('sendMessage', {
      chat_id: chatId,
      text: `👋 *Ingliz Futboli Admin Bot*\n\nYangilik yozib yuboring — AI chiroyli qiladi, siz tasdiqlaysiz.\n\n*Buyruqlar:*\n/start — Boshlash\n/help — Yordam`,
      parse_mode: 'Markdown'
    });
    return;
  }

  // /help
  if (text === '/help') {
    await telegram('sendMessage', {
      chat_id: chatId,
      text: `📖 *Qanday ishlaydi:*\n\n1. Yangilik matnini yozing\n2. AI o'zbek tiliga tarjima qiladi\n3. Siz ko'rasiz — tasdiqlaysiz yoki o'zgartirasiz\n4. Kanalga chiqadi\n\n✍️ Boshlash uchun yangilik yozing!`,
      parse_mode: 'Markdown'
    });
    return;
  }

  // Tasdiqlash
  if (text === '✅ Kanalga yuborish' && pending[chatId]) {
    await telegram('sendMessage', {
      chat_id: CHANNEL,
      text: pending[chatId],
      parse_mode: 'Markdown'
    });
    delete pending[chatId];
    await telegram('sendMessage', {
      chat_id: chatId,
      text: '✅ Post kanalga yuborildi!',
      reply_markup: { remove_keyboard: true }
    });
    return;
  }

  // Bekor qilish
  if (text === '❌ Bekor qilish' && pending[chatId]) {
    delete pending[chatId];
    await telegram('sendMessage', {
      chat_id: chatId,
      text: '❌ Bekor qilindi. Yangi yangilik yozing.',
      reply_markup: { remove_keyboard: true }
    });
    return;
  }

  // Qayta yozish
  if (text === '🔄 Qayta yozish' && pending[chatId]) {
    await telegram('sendMessage', {
      chat_id: chatId,
      text: '✍️ Yangilik matnini qaytadan yozing:',
      reply_markup: { remove_keyboard: true }
    });
    delete pending[chatId];
    return;
  }

  // Yangilik matni — AI ga yuborish
  if (text && !text.startsWith('/')) {
    const thinking = await telegram('sendMessage', {
      chat_id: chatId,
      text: '⏳ AI tayyorlayapti...'
    });

    try {
      const aiText = await gemini(text);
      pending[chatId] = aiText;

      await telegram('deleteMessage', {
        chat_id: chatId,
        message_id: thinking.result.message_id
      });

      await telegram('sendMessage', {
        chat_id: chatId,
        text: `📝 *Ko'rib chiqing:*\n\n${aiText}\n\n---\n_Kanalga yuborilsinmi?_`,
        parse_mode: 'Markdown',
        reply_markup: {
          keyboard: [
            ['✅ Kanalga yuborish'],
            ['🔄 Qayta yozish', '❌ Bekor qilish']
          ],
          resize_keyboard: true
        }
      });
    } catch(e) {
      await telegram('sendMessage', {
        chat_id: chatId,
        text: '❌ Xato yuz berdi. Qaytadan urinib ko\'ring.'
      });
    }
  }
}

// HTTP server
const http = require('http');
const server = http.createServer(async (req, res) => {
  if (req.method === 'POST' && req.url === '/webhook') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', async () => {
      try {
        const update = JSON.parse(body);
        await handleUpdate(update);
      } catch(e) {}
      res.writeHead(200);
      res.end('OK');
    });
  } else {
    res.writeHead(200);
    res.end('Ingliz Futboli Bot — Ishlayapti!');
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Bot ishga tushdi: port ${PORT}`));
