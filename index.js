const http = require('http');
const https = require('https');

const TOKEN = '8701604879:AAEeEUPd6bclS1zvIKKNAGu1qojRe5r4m1k';
const CHANNEL = '@Inglizfutbol';
const pending = {};

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

async function handle(update) {
  const msg = update.message;
  if (!msg) return;
  const id = msg.chat.id;
  const text = msg.text || '';
  if (text === '/start') {
    return tg('sendMessage', {chat_id:id, text:'⚽ Ingliz Futboli Bot\n\nYangilik yozing!'});
  }
  if (text === '✅ Yuborish' && pending[id]) {
    await tg('sendMessage', {chat_id:CHANNEL, text:pending[id]});
    delete pending[id];
    return tg('sendMessage', {chat_id:id, text:'✅ Yuborildi!', reply_markup:{remove_keyboard:true}});
  }
  if (text === '❌ Bekor' && pending[id]) {
    delete pending[id];
    return tg('sendMessage', {chat_id:id, text:'❌ Bekor.', reply_markup:{remove_keyboard:true}});
  }
  if (text && !text.startsWith('/')) {
    pending[id] = text;
    return tg('sendMessage', {
      chat_id:id,
      text:`👀 Ko'rib chiqing:\n\n${text}`,
      reply_markup:{keyboard:[['✅ Yuborish'],['❌ Bekor']],resize_keyboard:true}
    });
  }
}

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
}).listen(PORT, '0.0.0.0', () => console.log('Ishga tushdi: ' + PORT));
