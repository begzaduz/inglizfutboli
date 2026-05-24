const https = require('https');
const http = require('http');

const BOT_TOKEN = '8701604879:AAEeEUPd6bclS1zvIKKNAGu1qojRe5r4m1k';
const CHANNEL = '@Inglizfutbol';

function tg(method, data) {
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

const pending = {};

async function handle(update) {
  const msg = update.message;
  if (!msg) return;
  const chatId = msg.chat.id;
  const text = msg.text || '';

  if (text === '/start') {
    await tg('sendMessage', {
      chat_id: chatId,
      text: '⚽ *Ingliz Futboli Admin Bot*\n\nYangilik yozing — men kanalga yuboraman!',
      parse_mode: 'Markdown'
    });
    return;
  }

  if (text === '✅ Yuborish' && pending[chatId]) {
    await tg('sendMessage', { chat_id: CHANNEL, text: pending[chatId], parse_mode: 'Markdown' });
    delete pending[chatId];
    await tg('sendMessage', { chat_id: chatId, text: '✅ Kanalga yuborildi!', reply_markup: { remove_keyboard: true } });
    return;
  }

  if (text === '❌ Bekor' && pending[chatId]) {
    delete pending[chatId];
    await tg('sendMessage', { chat_id: chatId, text: '❌ Bekor qilindi.', reply_markup: { remove_keyboard: true } });
    return;
  }

  if (text && !text.startsWith('/')) {
    pending[chatId] = text;
    await tg('sendMessage', {
      chat_id: chatId,
      text: `👀 *Ko'rib chiqing:*\n\n${text}\n\n_Kanalga yuborilsinmi?_`,
      parse_mode: 'Markdown',
      reply_markup: {
        keyboard: [['✅ Yuborish'], ['❌ Bekor']],
        resize_keyboard: true
      }
    });
  }
}

const PORT = process.env.PORT || 8080;
http.createServer(async (req, res) => {
  if (req.method === 'POST' && req.url === '/webhook') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', async () => {
      try { await handle(JSON.parse(body)); } catch(e) { console.error(e.message); }
      res.writeHead(200); res.end('OK');
    });
  } else {
    res.writeHead(200); res.end('Bot ishlayapti!');
  }
}).listen(PORT, '0.0.0.0', () => console.log('Bot ishga tushdi: port ' + PORT));
