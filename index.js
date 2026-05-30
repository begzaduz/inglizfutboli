require('dotenv').config();
const { Telegraf } = require('telegraf');
const axios        = require('axios');
const TurndownService = require('turndown');
const sqlite3      = require('sqlite3').verbose();
const path         = require('path');

// ═══════════════════════════════════════
// CONFIG — env dan o'qiladi
// ═══════════════════════════════════════
['TOKEN','GROQ_KEY'].forEach(key => {
  if (!process.env[key]) {
    console.error(`[CONFIG] Missing env: ${key}`);
    process.exit(1);
  }
});

const CONFIG = {
  TOKEN    : process.env.TOKEN,
  CHANNEL  : process.env.CHANNEL  || '@Inglizfutbol',
  GROQ_KEY : process.env.GROQ_KEY,
  DB_PATH  : path.join(__dirname, 'news_cache.db'),
  PORT     : process.env.PORT || 8080,
  INTERVAL : 10 * 60 * 1000,
};

// ═══════════════════════════════════════
// SQLITE — async wrapper
// ═══════════════════════════════════════
const db = new sqlite3.Database(CONFIG.DB_PATH, err => {
  if (err) { console.error('[DB] Error:', err.message); process.exit(1); }
  console.log('[DB] Connected');
});

db.run(`CREATE TABLE IF NOT EXISTS processed_articles (
  url          TEXT PRIMARY KEY,
  title        TEXT,
  score        INTEGER DEFAULT 0,
  processed_at DATETIME DEFAULT CURRENT_TIMESTAMP
)`);

const dbGet = (sql, params=[]) => new Promise((res, rej) =>
  db.get(sql, params, (e, r) => e ? rej(e) : res(r)));

const dbRun = (sql, params=[]) => new Promise((res, rej) =>
  db.run(sql, params, e => e ? rej(e) : res()));

const isProcessed  = url => dbGet('SELECT url FROM processed_articles WHERE url=?', [url]).then(r => !!r);
const markProcessed = (url, title, score) =>
  dbRun('INSERT OR IGNORE INTO processed_articles (url,title,score) VALUES (?,?,?)', [url, title||'', score||0]);

// ═══════════════════════════════════════
// HTML → MARKDOWN (turndown — ishonchli)
// ═══════════════════════════════════════
const td = new TurndownService({ headingStyle:'atx', bulletListMarker:'-' });
td.remove(['script','style','nav','header','footer','aside','form','iframe']);

function htmlToMarkdown(html) {
  try {
    const md = td.turndown(html);
    return md.replace(/\n{3,}/g,'\n\n').trim().slice(0, 1500);
  } catch(_) {
    return html.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim().slice(0, 1500);
  }
}

// ═══════════════════════════════════════
// RELEVANCE SCORING
// ═══════════════════════════════════════
const HIGH = [
  'premier league','transfer','signing','manager','sacked','fired',
  'injured','injury','goal','match','result','win','defeat','score',
  'champions league','fa cup','europa league','breaking','confirmed','official',
  'arsenal','chelsea','liverpool','manchester','tottenham','newcastle',
  'aston villa','west ham','brighton','everton','wolves','bournemouth',
  'brentford','fulham','crystal palace','million','contract','deal','fee',
];

const LOW = [
  'nba','nfl','cricket','rugby','golf','tennis','formula 1','nascar',
  'baseball','hockey','basketball','ufc','boxing','bundesliga',
  'serie a','ligue 1','la liga','mls','eredivisie',
];

function scoreArticle(title, desc) {
  const text = ((title||'')+' '+(desc||'')).toLowerCase();
  let score = 0;
  HIGH.forEach(kw => { if (text.includes(kw)) score += 10; });
  LOW.forEach(kw  => { if (text.includes(kw)) score -= 20; });
  if (text.includes('breaking') || text.includes('official') || text.includes('confirmed')) score += 15;
  return score;
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
  'Real Madrid':'Real Madrid','Barcelona':'Barselona','Bayern Munich':'Bayern Myunxen',
  'Erling Haaland':'Erling Holland','Haaland':'Holland',
  'Abdukodir Khusanov':'Abduqodir Husanov','Khusanov':'Husanov',
  'Mohamed Salah':'Muhammad Saloh','Salah':'Saloh',
  'Virgil van Dijk':'Virjil van Deyk','van Dijk':'van Deyk',
  'Pep Guardiola':'Pep Gvardiola','Guardiola':'Gvardiola',
  'Mikel Arteta':'Mikel Arteta','Arne Slot':'Arne Slot',
  'Marcus Rashford':'Markus Reshford','Rashford':'Reshford',
  'Bruno Fernandes':'Bruno Fernandesh','Declan Rice':'Deklan Rays',
  'Kevin De Bruyne':'Kevin De Bryuyne','Cole Palmer':'Koul Palmer',
};

function applyNames(text) {
  if (!text) return '';
  let r = text;
  Object.entries(NAMES)
    .sort((a,b) => b[0].length - a[0].length)
    .forEach(([eng, uzb]) => {
      try {
        const esc = eng.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
        r = r.replace(new RegExp(`\\b${esc}\\b`,'gi'), uzb);
      } catch(_) {}
    });
  return r;
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
    const title = (item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/s) ||
                   item.match(/<title>(.*?)<\/title>/s) || [])[1] || '';
    const desc  = (item.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/s) ||
                   item.match(/<description>(.*?)<\/description>/s) || [])[1] || '';
    const url   = (item.match(/<link>(.*?)<\/link>/s) ||
                   item.match(/<guid[^>]*>(.*?)<\/guid>/s) || [])[1] || '';
    if (title && url) {
      const cleanDesc = desc.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
      articles.push({ title:title.trim(), description:cleanDesc.slice(0,300), url:url.trim() });
    }
  }
  return articles;
}

async function fetchRSSFeed(url) {
  try {
    const res = await axios.get(url, {
      timeout: 10000,
      headers: { 'User-Agent':'Mozilla/5.0 (compatible; NewsBot/2.0)', 'Accept':'application/rss+xml,text/xml' },
    });
    return parseRSS(res.data);
  } catch(e) {
    console.error('[RSS] Error:', url, e.message);
    return [];
  }
}

async function fetchArticleMarkdown(url) {
  try {
    const res = await axios.get(url, {
      timeout: 8000,
      headers: { 'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'Accept':'text/html' },
    });
    return htmlToMarkdown(res.data);
  } catch(_) { return null; }
}

async function fetchNews() {
  const seen = new Set();
  const all  = [];
  for (const feed of RSS_FEEDS) {
    const articles = await fetchRSSFeed(feed);
    for (const a of articles) {
      if (!seen.has(a.url)) {
        seen.add(a.url);
        a.score = scoreArticle(a.title, a.description);
        all.push(a);
      }
    }
  }
  const filtered = all.filter(a => a.score >= 20).sort((a,b) => b.score - a.score);
  console.log(`[News] Total:${all.length} Passed:${filtered.length}`);
  return filtered;
}

// ═══════════════════════════════════════
// GROQ AI
// ═══════════════════════════════════════
const SYSTEM_PROMPT = `You are a professional Uzbek sports journalist for Telegram channel @Inglizfutbol.
Transform English Premier League news into punchy, engaging Uzbek Telegram posts.

LANGUAGE: Uzbek only. Active voice. Short sentences. No Russian words.

CLUB NICKNAMES — always use:
Arsenal="to'pchilar" | Liverpool="qizillar" | Chelsea="aristokratlar"
Man City="fuqarolar" | Man Utd="qizil iblislar" | Tottenham="xo'rozlar"
Newcastle="qarg'alar" | Bournemouth="olchalar" | West Ham="bolg'achilar"
Crystal Palace="burgutlar" | Wolves="bo'rilar" | Brighton="qaldirg'ochlar"
Brentford="arilar" | Everton="karamellar" | Aston Villa="villalar"

BREAKING: Add #BREAKING only for confirmed transfers, sackings, serious injuries, shock results.

FORMAT (follow exactly):
[Emoji] [Headline — max 8 words]

[Lead — 1-2 sentences. Biggest fact first.]

[Detail — 2-3 sentences. Stats, context, numbers.]

[🎙 "Quote" — Name (only if in article)]

[Closing — table position, next match, or record]

@Inglizfutbol

RULES:
- No Markdown (* _ [ ] **)
- No invented facts — only from article
- No intro phrases like "Mana post:"
- 350-600 characters total
- Write ONLY the post, nothing else`;

async function generatePost(article) {
  let content = '';
  if (article.url) content = await fetchArticleMarkdown(article.url) || '';
  if (content.length < 100) content = [article.title, article.description].filter(Boolean).join('\n\n');

  const userPrompt = `Write an Uzbek Telegram post for @Inglizfutbol.
Only use facts from the article. Do NOT invent scores, transfers or quotes.

HEADLINE: ${article.title}
ARTICLE: ${content}

Write ONLY the post:`;

  const res = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
    model      : 'llama-3.3-70b-versatile',
    messages   : [{ role:'system', content:SYSTEM_PROMPT }, { role:'user', content:userPrompt }],
    max_tokens : 600,
    temperature: 0.4,
  }, {
    headers: { 'Authorization':`Bearer ${CONFIG.GROQ_KEY}`, 'Content-Type':'application/json' },
    timeout: 30000,
  });

  const text = res.data.choices?.[0]?.message?.content;
  if (!text) throw new Error('Groq empty response');
  return applyNames(text.trim());
}

// ═══════════════════════════════════════
// AUTO POST
// ═══════════════════════════════════════
async function autoNewsPost() {
  console.log('[autoNewsPost] Started:', new Date().toLocaleString());
  let articles;
  try { articles = await fetchNews(); }
  catch(e) { console.error('[autoNewsPost] Fetch error:', e.message); return false; }

  if (!articles.length) { console.log('[autoNewsPost] No articles.'); return false; }

  for (const article of articles) {
    try { if (await isProcessed(article.url)) continue; } catch(_) { continue; }

    console.log(`[autoNewsPost] Processing (score:${article.score}):`, article.title);

    let post;
    try { post = await generatePost(article); }
    catch(e) {
      console.error('[autoNewsPost] AI error:', e.message);
      await markProcessed(article.url, article.title, article.score).catch(()=>{});
      continue;
    }

    if (!post?.trim()) { await markProcessed(article.url, article.title, article.score).catch(()=>{}); continue; }

    try {
      await bot.telegram.sendMessage(CONFIG.CHANNEL, post);
      await markProcessed(article.url, article.title, article.score).catch(()=>{});
      console.log('[autoNewsPost] Posted:', article.title);
      return true;
    } catch(e) {
      // Telegram rate limit — kuting
      if (e.response?.error_code === 429) {
        const wait = (e.response.parameters?.retry_after || 30) * 1000;
        console.warn(`[TG] Rate limit. Waiting ${wait/1000}s...`);
        await new Promise(r => setTimeout(r, wait));
      } else {
        console.error('[autoNewsPost] TG error:', e.message);
      }
      continue;
    }
  }

  console.log('[autoNewsPost] All done.');
  return false;
}

// ═══════════════════════════════════════
// TELEGRAF BOT
// ═══════════════════════════════════════
const bot = new Telegraf(CONFIG.TOKEN);
const pending = {};

bot.command('start', ctx => ctx.reply(
  'Ingliz Futboli Bot v2.0\n\n' +
  'Matn yuboring — professional post\n' +
  'Rasm + matn — kanalga chiqadi\n' +
  '/yangilik — Yangi xabar\n' +
  '/stat — Statistika\n' +
  '/clearcache — Keshni tozalash'
));

bot.command('yangilik', async ctx => {
  await ctx.reply('Yangilik olinayapti...');
  const ok = await autoNewsPost().catch(e => { console.error(e.message); return false; });
  return ctx.reply(ok ? 'Post kanalga yuborildi!' : 'Yangi yangilik topilmadi.');
});

bot.command('stat', async ctx => {
  const row = await dbGet('SELECT COUNT(*) as cnt, AVG(score) as avg FROM processed_articles').catch(()=>null);
  return ctx.reply(row
    ? `Bazada ${row.cnt} ta yangilik.\nO'rtacha ball: ${Math.round(row.avg||0)}`
    : 'Statistika xatosi');
});

bot.command('clearcache', async ctx => {
  await dbRun('DELETE FROM processed_articles').catch(()=>{});
  return ctx.reply('Kesh tozalandi! /yangilik yuboring.');
});

// Tasdiqlash tugmalari
bot.hears('Yuborish', async ctx => {
  const id = ctx.chat.id;
  const p  = pending[id];
  if (!p) return;
  try {
    if (p.type === 'photo') {
      const cap = p.text.length > 1024 ? p.text.slice(0,1020)+'...' : p.text;
      await bot.telegram.sendPhoto(CONFIG.CHANNEL, p.fileId, { caption:cap });
    } else {
      await bot.telegram.sendMessage(CONFIG.CHANNEL, p.text);
    }
    delete pending[id];
    return ctx.reply('Kanalga yuborildi!', { reply_markup:{ remove_keyboard:true }});
  } catch(e) { return ctx.reply('Yuborishda xato: '+e.message); }
});

bot.hears('Bekor', ctx => {
  delete pending[ctx.chat.id];
  return ctx.reply('Bekor qilindi.', { reply_markup:{ remove_keyboard:true }});
});

// Rasm
bot.on('photo', async ctx => {
  const id      = ctx.chat.id;
  const fileId  = ctx.message.photo[ctx.message.photo.length-1].file_id;
  const caption = (ctx.message.caption||'').trim();

  if (caption) {
    await ctx.reply('Tayyorlanayapti...');
    try {
      const post = await generatePost({ title:caption, description:'', url:null });
      pending[id] = { type:'photo', fileId, text:post };
      await ctx.reply(`Ko'rib chiqing:\n\n${post}`);
      return ctx.reply('Yuborishni tasdiqlaysizmi?', { reply_markup:{ keyboard:[['Yuborish'],['Bekor']], resize_keyboard:true }});
    } catch(e) { return ctx.reply('Xatolik: '+e.message); }
  } else {
    pending[id] = { type:'waitText', fileId };
    return ctx.reply('Yangilik matnini yozing:');
  }
});

// Matn
bot.on('text', async ctx => {
  const id   = ctx.chat.id;
  const text = ctx.message.text;
  if (text.startsWith('/')) return;

  if (pending[id]?.type === 'waitText') {
    const { fileId } = pending[id];
    await ctx.reply('Tayyorlanayapti...');
    try {
      const post = await generatePost({ title:text, description:'', url:null });
      pending[id] = { type:'photo', fileId, text:post };
      await ctx.reply(`Ko'rib chiqing:\n\n${post}`);
      return ctx.reply('Yuborishni tasdiqlaysizmi?', { reply_markup:{ keyboard:[['Yuborish'],['Bekor']], resize_keyboard:true }});
    } catch(e) {
      delete pending[id];
      return ctx.reply('Xatolik: '+e.message, { reply_markup:{ remove_keyboard:true }});
    }
  }

  await ctx.reply('Tayyorlanayapti...');
  try {
    const post = await generatePost({ title:text, description:'', url:null });
    pending[id] = { type:'text', text:post };
    await ctx.reply(`Ko'rib chiqing:\n\n${post}`);
    return ctx.reply('Yuborishni tasdiqlaysizmi?', { reply_markup:{ keyboard:[['Yuborish'],['Bekor']], resize_keyboard:true }});
  } catch(e) { return ctx.reply('Xatolik: '+e.message); }
});

// ═══════════════════════════════════════
// WEBHOOK SERVER
// ═══════════════════════════════════════
const http = require('http');

const server = http.createServer(async (req, res) => {
  if (req.method === 'POST') {
    let body = '';
    req.on('data', c => { body += c; });
    req.on('end', async () => {
      res.writeHead(200); res.end('OK');
      if (!body) return;
      try {
        const update = JSON.parse(body);
        await bot.handleUpdate(update);
      } catch(e) { console.error('[webhook] error:', e.message); }
    });
  } else {
    res.writeHead(200); res.end('Ingliz Futboli Bot v2.0');
  }
});

server.listen(CONFIG.PORT, '0.0.0.0', () => {
  console.log(`[server] Port ${CONFIG.PORT} started`);
  autoNewsPost().catch(e => console.error('[startup]', e.message));
});

setInterval(() => autoNewsPost().catch(e => console.error('[interval]', e.message)), CONFIG.INTERVAL);

process.on('uncaughtException',  e => console.error('[uncaughtException]',  e.message));
process.on('unhandledRejection', r => console.error('[unhandledRejection]', r));
