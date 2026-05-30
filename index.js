const http    = require('http');
const https   = require('https');
const sqlite3 = require('sqlite3').verbose();
const path    = require('path');

// ═══════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════
const CONFIG = {
  TOKEN    : '8701604879:AAEeEUPd6bclS1zvIKKNAGu1qojRe5r4m1k',
  CHANNEL  : '@Inglizfutbol',
  GROQ_KEY : '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',
  DB_PATH  : path.join(__dirname, 'news_cache.db'),
  PORT     : process.env.PORT || 8080,
  INTERVAL : 10 * 60 * 1000, // 10 daqiqa
};

// ═══════════════════════════════════════
// SQLITE
// ═══════════════════════════════════════
const db = new sqlite3.Database(CONFIG.DB_PATH, err => {
  if (err) { console.error('[DB] Error:', err.message); process.exit(1); }
  console.log('[DB] Connected');
});

db.run(`CREATE TABLE IF NOT EXISTS processed_articles (
  url TEXT PRIMARY KEY,
  title TEXT,
  score INTEGER DEFAULT 0,
  processed_at DATETIME DEFAULT CURRENT_TIMESTAMP
)`);

const isProcessed = url => new Promise((res, rej) =>
  db.get('SELECT url FROM processed_articles WHERE url=?', [url], (e, r) => e ? rej(e) : res(!!r)));

const markProcessed = (url, title, score) => new Promise((res, rej) =>
  db.run('INSERT OR IGNORE INTO processed_articles (url,title,score) VALUES (?,?,?)',
    [url, title||'', score||0], e => e ? rej(e) : res()));

// ═══════════════════════════════════════
// RELEVANCE SCORING — LLM emas, tez ball tizimi
// ═══════════════════════════════════════
const HIGH_VALUE = [
  'premier league','transfer','signing','manager','sacked','fired','injured',
  'injury','goal','goals','match','result','score','win','lost','defeat',
  'champions league','fa cup','europa league','arsenal','chelsea','liverpool',
  'manchester','tottenham','newcastle','aston villa','west ham','brighton',
  'everton','wolves','crystal palace','bournemouth','brentford','fulham',
  'england','premier','epl','breaking'
];

const LOW_VALUE = [
  'nba','nfl','cricket','rugby','golf','tennis','formula','nascar',
  'baseball','hockey','basketball','ufc','boxing','cycling','swimming',
  'bundesliga','serie a','ligue 1','la liga','mls','eredivisie'
];

function scoreArticle(title, desc) {
  const text = ((title||'') + ' ' + (desc||'')).toLowerCase();
  let score = 0;

  for (const kw of HIGH_VALUE) {
    if (text.includes(kw)) score += 10;
  }
  for (const kw of LOW_VALUE) {
    if (text.includes(kw)) score -= 20;
  }

  // Bonus: breaking news
  if (text.includes('breaking') || text.includes('official') || text.includes('confirmed')) score += 15;
  // Bonus: transfer season keywords
  if (text.includes('million') || text.includes('fee') || text.includes('deal') || text.includes('contract')) score += 10;

  return score;
}

// ═══════════════════════════════════════
// HTML → MARKDOWN (80% token tejaydi)
// ═══════════════════════════════════════
function htmlToMarkdown(html) {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
    .replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, '')
    .replace(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/gi, '\n## $1\n')
    .replace(/<p[^>]*>(.*?)<\/p>/gi, '\n$1\n')
    .replace(/<li[^>]*>(.*?)<\/li>/gi, '\n- $1')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 1500); // Token limit
}

// ═══════════════════════════════════════
// O'ZBEK NOMLARI
// ═══════════════════════════════════════
const NAMES = {
  'Premier League':'Premier-liga','Champions League':'Chempionlar ligasi',
  'FA Cup':'FA Kubogi','Carabao Cup':'Karabao Kubogi',
  'Europa League':'Evropa ligasi','Conference League':'Konferensiyalar ligasi',
  'World Cup':'Jahon chempionati',
  'Manchester City':'Manchester Siti','Man City':'Manchester Siti',
  'Manchester United':'Manchester Yunayted','Man United':'Manchester Yunayted','Man Utd':'Manchester Yunayted',
  'Arsenal':'Arsenal','Chelsea':'Chelsi','Liverpool':'Liverpul',
  'Tottenham Hotspur':'Tottenhem Xotspur','Tottenham':'Tottenhem','Spurs':'Tottenhem',
  'Aston Villa':'Aston Villa','Newcastle United':'Nyukasl Yunayted','Newcastle':'Nyukasl',
  'West Ham United':'Vest Hem Yunayted','West Ham':'Vest Hem',
  'Brighton':'Brayton','Crystal Palace':'Kristal Pelas','Fulham':'Fulhem',
  'Brentford':'Brentford','Bournemouth':'Bornmut','Nottingham Forest':'Nottingem Forest',
  'Leicester City':'Lester Siti','Leicester':'Lester','Everton':'Everton',
  'Wolverhampton Wanderers':'Vulverhempton','Wolverhampton':'Vulverhempton','Wolves':'Vulverhempton',
  'Ipswich Town':'Ipsvich Taun','Ipswich':'Ipsvich','Southampton':'Sautgempton',
  'Leeds United':'Lids Yunayted','Leeds':'Lids',
  'Real Madrid':'Real Madrid','Barcelona':'Barselona','Bayern Munich':'Bayern Myunxen',
  'PSG':'PSJ','Paris Saint-Germain':'Parij Sen-Jermen',
  'Erling Haaland':'Erling Holland','Haaland':'Holland',
  'Abdukodir Khusanov':'Abduqodir Husanov','Khusanov':'Husanov',
  'Cole Palmer':'Koul Palmer','Phil Foden':'Fil Foden',
  'Martin Odegaard':'Martin Edegor','Odegaard':'Edegor',
  'Bruno Fernandes':'Bruno Fernandesh','Declan Rice':'Deklan Rays',
  'Kevin De Bruyne':'Kevin De Bryuyne','De Bruyne':'De Bryuyne',
  'Marcus Rashford':'Markus Reshford','Rashford':'Reshford',
  'Mohamed Salah':'Muhammad Saloh','Salah':'Saloh',
  'Virgil van Dijk':'Virjil van Deyk','van Dijk':'van Deyk',
  'Pep Guardiola':'Pep Gvardiola','Guardiola':'Gvardiola',
  'Mikel Arteta':'Mikel Arteta','Arne Slot':'Arne Slot',
  'Eddie Howe':'Eddi Hau','Unai Emery':'Unai Emeri',
};

function applyNames(text) {
  if (!text) return '';
  let result = text;
  const sorted = Object.entries(NAMES).sort((a,b) => b[0].length - a[0].length);
  for (const [eng, uzb] of sorted) {
    try {
      const esc = eng.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
      result = result.replace(new RegExp(`\\b${esc}\\b`,'gi'), uzb);
    } catch(_) {}
  }
  return result;
}

// ═══════════════════════════════════════
// SYSTEM PROMPT
// ═══════════════════════════════════════
const SYSTEM_PROMPT = `You are a professional Uzbek sports journalist for Telegram channel @Inglizfutbol.
Transform English Premier League news into punchy, engaging Uzbek Telegram posts.

LANGUAGE: Uzbek only. Active voice. Short sentences.

CLUB NICKNAMES — always use:
Arsenal="to'pchilar" | Liverpool="qizillar" | Chelsea="aristokratlar"
Man City="fuqarolar" | Man Utd="qizil iblislar" | Tottenham="xo'rozlar"
Newcastle="qarg'alar" | Bournemouth="olchalar" | West Ham="bolg'achilar"
Crystal Palace="burgutlar" | Wolves="bo'rilar" | Brighton="qaldirg'ochlar"
Brentford="arilar" | Everton="karamellar" | Aston Villa="villalar"

BREAKING: Add #BREAKING only for transfers, sackings, serious injuries, shock results.

FORMAT:
[Emoji] [Headline — max 8 words]

[Lead — 1-2 sentences. Biggest fact first.]

[Detail — 2-3 sentences. Stats, context, numbers.]

[🎙 "Quote" — Name (only if exists in article)]

[Closing — table position, next match, or record]

@Inglizfutbol

RULES:
- No Markdown symbols (* _ [ ] **)
- No invented facts — only from given article
- No intro phrases
- 350-600 characters total
- Write ONLY the post`;

// ═══════════════════════════════════════
// HTTP REQUEST
// ═══════════════════════════════════════
function httpRequest(options, body, redirectCount=0) {
  return new Promise((resolve, reject) => {
    if (redirectCount > 5) return reject(new Error('Too many redirects'));
    const lib = options.protocol === 'http:' ? http : https;
    try {
      const req = lib.request(options, r => {
        if ([301,302,303,307,308].includes(r.statusCode) && r.headers.location) {
          try {
            const loc = new URL(r.headers.location, `https://${options.hostname}`);
            return httpRequest({
              protocol:loc.protocol, hostname:loc.hostname,
              path:loc.pathname+loc.search, method:options.method||'GET',
              headers:options.headers||{}
            }, body, redirectCount+1).then(resolve).catch(reject);
          } catch(e) { return reject(new Error('Redirect error: '+e.message)); }
        }
        let d = '';
        r.on('data', c => { if(d.length < 50000) d += c; });
        r.on('end', () => resolve({ statusCode: r.statusCode, body: d }));
        r.on('error', reject);
      });
      req.on('error', e => reject(new Error('Request error: '+e.message)));
      req.setTimeout(options.timeout||15000, () => { req.destroy(); reject(new Error('Timeout: '+options.hostname)); });
      if (body) req.write(body);
      req.end();
    } catch(e) { reject(new Error('httpRequest error: '+e.message)); }
  });
}

// ═══════════════════════════════════════
// TELEGRAM
// ═══════════════════════════════════════
async function tg(method, data) {
  const body = JSON.stringify(data);
  const res = await httpRequest({
    hostname:'api.telegram.org',
    path:`/bot${CONFIG.TOKEN}/${method}`,
    method:'POST',
    headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(body)},
    timeout:15000,
  }, body);
  try {
    const json = JSON.parse(res.body);
    if (!json.ok) console.error(`[TG] ${method} error:`, json.description);
    return json;
  } catch(e) { throw new Error('TG JSON parse: '+e.message); }
}

const tgSend = (chatId, text) => tg('sendMessage', { chat_id:chatId, text });

// ═══════════════════════════════════════
// GROQ
// ═══════════════════════════════════════
async function groq(userContent) {
  const body = JSON.stringify({
    model      : 'llama-3.3-70b-versatile',
    messages   : [
      { role:'system', content:SYSTEM_PROMPT },
      { role:'user',   content:userContent   },
    ],
    max_tokens : 600,
    temperature: 0.4,
  });

  const res = await httpRequest({
    hostname:'api.groq.com',
    path:'/openai/v1/chat/completions',
    method:'POST',
    headers:{
      'Content-Type':'application/json',
      'Authorization':`Bearer ${CONFIG.GROQ_KEY}`,
      'Content-Length':Buffer.byteLength(body),
    },
    timeout:30000,
  }, body);

  let json;
  try { json = JSON.parse(res.body); } catch(e) { throw new Error('Groq JSON parse: '+e.message); }
  if (json.error) throw new Error('Groq API: '+json.error.message);
  const text = json.choices?.[0]?.message?.content;
  if (!text) throw new Error('Groq empty response');
  return text.trim();
}

// ═══════════════════════════════════════
// RSS FEEDS
// ═══════════════════════════════════════
const RSS_FEEDS = [
  'https://feeds.bbci.co.uk/sport/football/premier-league/rss.xml',
  'https://www.skysports.com/rss/12040',
  'https://talksport.com/feed/',
  'https://www.90min.com/feeds/latest',
  'https://www.fourfourtwo.com/rss/news',
];

function parseRSS(xml) {
  const articles = [];
  const items = xml.match(/<item>([\s\S]*?)<\/item>/gi) || [];
  for (const item of items) {
    const title   = (item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/s) ||
                     item.match(/<title>(.*?)<\/title>/s) || [])[1] || '';
    const desc    = (item.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/s) ||
                     item.match(/<description>(.*?)<\/description>/s) || [])[1] || '';
    const url     = (item.match(/<link>(.*?)<\/link>/s) ||
                     item.match(/<guid[^>]*>(.*?)<\/guid>/s) || [])[1] || '';
    if (title && url) {
      const cleanDesc = desc.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
      articles.push({ title:title.trim(), description:cleanDesc.slice(0,300), url:url.trim() });
    }
  }
  return articles;
}

async function fetchRSSFeed(feedUrl) {
  try {
    const u = new URL(feedUrl);
    const res = await httpRequest({
      protocol:u.protocol, hostname:u.hostname, path:u.pathname+u.search,
      method:'GET',
      headers:{ 'User-Agent':'Mozilla/5.0 (compatible; NewsBot/1.0)', 'Accept':'application/rss+xml,application/xml,text/xml' },
      timeout:10000,
    });
    if (res.statusCode !== 200) return [];
    return parseRSS(res.body);
  } catch(e) {
    console.error('[RSS] Error:', feedUrl, e.message);
    return [];
  }
}

// ═══════════════════════════════════════
// ARTICLE FULL TEXT (HTML → Markdown)
// ═══════════════════════════════════════
async function fetchArticleMarkdown(url) {
  try {
    const u = new URL(url);
    const res = await httpRequest({
      protocol:u.protocol, hostname:u.hostname, path:u.pathname+u.search,
      method:'GET',
      headers:{ 'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'Accept':'text/html' },
      timeout:8000,
    });
    return htmlToMarkdown(res.body);
  } catch(_) { return null; }
}

// ═══════════════════════════════════════
// FETCH + SCORE + DEDUPLICATE
// ═══════════════════════════════════════
async function fetchNews() {
  const seen = new Set();
  const allArticles = [];

  for (const feed of RSS_FEEDS) {
    const articles = await fetchRSSFeed(feed);
    for (const a of articles) {
      if (!seen.has(a.url)) {
        seen.add(a.url);
        a.score = scoreArticle(a.title, a.description);
        allArticles.push(a);
      }
    }
  }

  // Faqat threshold dan oshganlar, scorega qarab tartiblash
  const filtered = allArticles
    .filter(a => a.score >= 20)
    .sort((a,b) => b.score - a.score);

  console.log(`[News] Total: ${allArticles.length}, Passed filter: ${filtered.length}`);
  return filtered;
}

// ═══════════════════════════════════════
// AI PIPELINE
// ═══════════════════════════════════════
async function generatePost(article) {
  // HTML → Markdown (80% token tejash)
  let content = '';
  if (article.url) {
    content = await fetchArticleMarkdown(article.url) || '';
  }
  if (content.length < 100) {
    content = [article.title, article.description].filter(Boolean).join('\n\n');
  }

  const userPrompt = `Write an Uzbek Telegram post for @Inglizfutbol based on this Premier League news.
Only use facts from the article. Do NOT invent scores, transfers or quotes.

HEADLINE: ${article.title}
ARTICLE: ${content}

Write ONLY the post:`;

  const raw = await groq(userPrompt);
  return applyNames(raw);
}

// ═══════════════════════════════════════
// AUTO POST — EVENT BASED
// ═══════════════════════════════════════
async function autoNewsPost() {
  console.log('[autoNewsPost] Started:', new Date().toLocaleString());

  let articles;
  try { articles = await fetchNews(); }
  catch(e) { console.error('[autoNewsPost] Fetch error:', e.message); return false; }

  if (!articles.length) {
    console.log('[autoNewsPost] No articles passed filter.');
    return false;
  }

  for (const article of articles) {
    try {
      if (await isProcessed(article.url)) continue;
    } catch(e) { continue; }

    console.log(`[autoNewsPost] Processing (score:${article.score}):`, article.title);

    let post;
    try { post = await generatePost(article); }
    catch(e) {
      console.error('[autoNewsPost] AI error:', e.message);
      await markProcessed(article.url, article.title, article.score).catch(()=>{});
      continue;
    }

    if (!post?.trim()) {
      await markProcessed(article.url, article.title, article.score).catch(()=>{});
      continue;
    }

    try {
      const result = await tg('sendMessage', { chat_id:CONFIG.CHANNEL, text:post });
      if (!result.ok) { console.error('[autoNewsPost] TG rejected:', result.description); continue; }
      await markProcessed(article.url, article.title, article.score).catch(()=>{});
      console.log('[autoNewsPost] Posted:', article.title);
      return true;
    } catch(e) {
      console.error('[autoNewsPost] TG error:', e.message);
      continue;
    }
  }

  console.log('[autoNewsPost] All articles processed or errored.');
  return false;
}

// ═══════════════════════════════════════
// ADMIN BOT
// ═══════════════════════════════════════
const pending = {};

async function handle(update) {
  try {
    if (!update?.message) return;
    const msg   = update.message;
    const id    = msg.chat.id;
    const text  = (msg.text||'').trim();
    const photo = msg.photo;

    if (photo) {
      const fileId  = photo[photo.length-1].file_id;
      const caption = (msg.caption||'').trim();
      if (caption) {
        await tgSend(id, 'Tayyorlanayapti...');
        try {
          const article = { title:caption, description:'', url:null };
          const post = await generatePost(article);
          pending[id] = { type:'photo', fileId, text:post };
          await tgSend(id, `Ko'rib chiqing:\n\n${post}`);
          return tg('sendMessage', { chat_id:id, text:'Yuborishni tasdiqlaysizmi?',
            reply_markup:{ keyboard:[['Yuborish'],['Bekor']], resize_keyboard:true }});
        } catch(e) { return tgSend(id, 'Xatolik: '+e.message); }
      } else {
        pending[id] = { type:'waitText', fileId };
        return tgSend(id, 'Yangilik matnini yozing:');
      }
    }

    if (!text) return;

    if (text === '/start') {
      return tgSend(id,
        'Ingliz Futboli Bot\n\n'+
        'Matn yuboring — professional post\n'+
        'Rasm + matn — kanalga chiqadi\n'+
        '/yangilik — Yangi xabar\n'+
        '/stat — Statistika\n'+
        '/clearcache — Keshni tozalash'
      );
    }

    if (text === '/yangilik') {
      await tgSend(id, 'Yangilik olinayapti...');
      const ok = await autoNewsPost();
      return tgSend(id, ok ? 'Post kanalga yuborildi!' : 'Yangi yangilik topilmadi.');
    }

    if (text === '/stat') {
      return new Promise(resolve => {
        db.get('SELECT COUNT(*) as cnt, AVG(score) as avg FROM processed_articles', [], (err, row) => {
          const msg = err ? 'Xato' : `Bazada ${row.cnt} ta yangilik.\nO'rtacha ball: ${Math.round(row.avg||0)}`;
          tgSend(id, msg).then(resolve).catch(resolve);
        });
      });
    }

    if (text === '/clearcache') {
      return new Promise(resolve => {
        db.run('DELETE FROM processed_articles', [], err => {
          tgSend(id, err ? 'Xato: '+err.message : 'Kesh tozalandi! /yangilik yuboring.').then(resolve).catch(resolve);
        });
      });
    }

    if (text === 'Yuborish' && pending[id]) {
      const p = pending[id];
      try {
        if (p.type === 'photo') {
          const cap = p.text.length > 1024 ? p.text.slice(0,1020)+'...' : p.text;
          await tg('sendPhoto', { chat_id:CONFIG.CHANNEL, photo:p.fileId, caption:cap });
        } else {
          await tg('sendMessage', { chat_id:CONFIG.CHANNEL, text:p.text });
        }
        delete pending[id];
        return tg('sendMessage', { chat_id:id, text:'Kanalga yuborildi!', reply_markup:{ remove_keyboard:true }});
      } catch(e) { return tgSend(id, 'Yuborishda xato: '+e.message); }
    }

    if (text === 'Bekor') {
      delete pending[id];
      return tg('sendMessage', { chat_id:id, text:'Bekor qilindi.', reply_markup:{ remove_keyboard:true }});
    }

    if (pending[id]?.type === 'waitText') {
      const { fileId } = pending[id];
      await tgSend(id, 'Tayyorlanayapti...');
      try {
        const article = { title:text, description:'', url:null };
        const post = await generatePost(article);
        pending[id] = { type:'photo', fileId, text:post };
        await tgSend(id, `Ko'rib chiqing:\n\n${post}`);
        return tg('sendMessage', { chat_id:id, text:'Yuborishni tasdiqlaysizmi?',
          reply_markup:{ keyboard:[['Yuborish'],['Bekor']], resize_keyboard:true }});
      } catch(e) {
        delete pending[id];
        return tg('sendMessage', { chat_id:id, text:'Xatolik: '+e.message, reply_markup:{ remove_keyboard:true }});
      }
    }

    if (!text.startsWith('/')) {
      await tgSend(id, 'Tayyorlanayapti...');
      try {
        const article = { title:text, description:'', url:null };
        const post = await generatePost(article);
        pending[id] = { type:'text', text:post };
        await tgSend(id, `Ko'rib chiqing:\n\n${post}`);
        return tg('sendMessage', { chat_id:id, text:'Yuborishni tasdiqlaysizmi?',
          reply_markup:{ keyboard:[['Yuborish'],['Bekor']], resize_keyboard:true }});
      } catch(e) { return tgSend(id, 'Xatolik: '+e.message); }
    }

  } catch(err) {
    console.error('[handle] Unexpected error:', err.message);
    try { await tgSend(update?.message?.chat?.id, 'Ichki xatolik yuz berdi.'); } catch(_) {}
  }
}

// ═══════════════════════════════════════
// HTTP SERVER
// ═══════════════════════════════════════
const server = http.createServer((req, res) => {
  if (req.method === 'POST') {
    let body = '';
    req.on('data', c => { body += c; });
    req.on('end', () => {
      res.writeHead(200); res.end('OK');
      if (!body) return;
      try {
        const update = JSON.parse(body);
        handle(update).catch(e => console.error('[webhook] error:', e.message));
      } catch(e) { console.error('[webhook] JSON parse:', e.message); }
    });
    req.on('error', e => { console.error('[req] error:', e.message); res.writeHead(500); res.end(); });
  } else {
    res.writeHead(200); res.end('Ingliz Futboli Bot — ishlayapti');
  }
});

server.listen(CONFIG.PORT, '0.0.0.0', () => {
  console.log(`[server] Port ${CONFIG.PORT} started`);
  autoNewsPost().catch(e => console.error('[startup] error:', e.message));
});

server.on('error', e => console.error('[server] error:', e.message));

setInterval(() => {
  autoNewsPost().catch(e => console.error('[interval] error:', e.message));
}, CONFIG.INTERVAL);

process.on('uncaughtException',  e => console.error('[uncaughtException]', e.message));
process.on('unhandledRejection', r => console.error('[unhandledRejection]', r));
