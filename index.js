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
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    }, r => { 
      let d = ''; 
      r.on('data', c => d += c); 
      r.on('end', () => res(JSON.parse(d))); 
    });
    req.on('error', rej);
    req.write(body);
    req.end();
  });
}

// Gemini AI ulanishi (Eng oxirgi barqaror v1 standarti va majburiy user roli bilan)
function gemini(prompt) {
  const body = JSON.stringify({
    contents: [
      {
        role: "user",
        parts: [{ text: prompt }]
      }
    ]
  });

  return new Promise((res, rej) => {
    const req = https.request({
      hostname: 'generativelanguage.googleapis.com',
      path: `/v1/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    }, r => { 
      let d = ''; 
      r.on('data', c => d += c); 
      r.on('end', () => {
        try {
          const j = JSON.parse(d);
          
          if (j.error) {
            console.error("Google Gemini API Xatoligi:", j.error.message);
            return rej(new Error(j.error.message));
          }

          if (j.candidates && j.candidates[0] && j.candidates[0].content && j.candidates[0].content.parts) {
            res(j.candidates[0].content.parts[0].text);
          } else {
            console.error("Google'dan kutilmagan javob formati keldi:", d);
            rej(new Error("Kutilmagan javob formati"));
          }
        } catch(e) { 
          rej(e); 
        }
      }); 
    });
    
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

    // Markdown parse_mode olib tashlandi (Gemini belgilari xatoga sabab bo'lmasligi uchun)
    const res = await tg('sendMessage
