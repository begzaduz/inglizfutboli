require('dotenv').config();
const { Telegraf } = require('telegraf');
const axios = require('axios');
const TurndownService = require('turndown');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// ═══════════════════════════════════════
// CONFIG & DB SETUP
// ═══════════════════════════════════════
const db = new Database(path.join(__dirname, 'news_cache.db'));
db.pragma('journal_mode = WAL'); // Performance uchun

db.prepare(`CREATE TABLE IF NOT EXISTS processed_articles (
    url TEXT PRIMARY KEY,
    title TEXT,
    score INTEGER DEFAULT 0,
    processed_at DATETIME DEFAULT CURRENT_TIMESTAMP
)`).run();

const bot = new Telegraf(process.env.TOKEN);
const td = new TurndownService({ headingStyle: 'atx', bulletListMarker: '-' });
td.remove(['script', 'style', 'nav', 'header', 'footer', 'aside', 'form', 'iframe']);

// ═══════════════════════════════════════
// LOGIC HELPERS
// ═══════════════════════════════════════
const isProcessed = (url) => !!db.prepare('SELECT 1 FROM processed_articles WHERE url=?').get(url);
const markProcessed = (url, title, score) => 
    db.prepare('INSERT OR IGNORE INTO processed_articles (url,title,score) VALUES (?,?,?)').run(url, title || '', score || 0);

function applyNames(text) {
    let r = text;
    // O'zbekcha nomlar ro'yxati (kengaytirilgan)
    const NAMES = { 'Premier League':'Premier-liga', 'Manchester City':'Manchester Siti', 'Arsenal':'Arsenal' /* ... qolganlari */ };
    Object.entries(NAMES).sort((a, b) => b[0].length - a[0].length).forEach(([eng, uzb]) => {
        const esc = eng.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        r = r.replace(new RegExp(`\\b${esc}\\b`, 'gi'), uzb);
    });
    return r;
}

// ═══════════════════════════════════════
// AI GENERATOR
// ═══════════════════════════════════════
async function generatePost(article) {
    let content = article.url ? await axios.get(article.url, { timeout: 8000 }).then(r => td.turndown(r.data)).catch(() => '') : '';
    
    const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
        model: 'llama-3.3-70b-versatile',
        messages: [
            { role: 'system', content: `Professional Uzbek sports journalist for @Inglizfutbol. No Markdown, no intro, 350-600 chars. Respond with ONLY the post text.` },
            { role: 'user', content: `Headline: ${article.title}\nContent: ${content.slice(0, 2000)}` }
        ],
        temperature: 0.4
    }, { headers: { 'Authorization': `Bearer ${process.env.GROQ_KEY}` } });

    return applyNames(response.data.choices[0].message.content.trim());
}

// ═══════════════════════════════════════
// BOT HANDLERS
// ═══════════════════════════════════════
bot.command('start', ctx => ctx.reply('Ingliz Futboli Bot ishga tushdi.'));

bot.command('yangilik', async ctx => {
    try {
        const status = await autoNewsPost();
        ctx.reply(status ? 'Yangilik kanalga yuborildi.' : 'Yangi yangilik topilmadi.');
    } catch (e) {
        ctx.reply('Xatolik yuz berdi.');
    }
});

// ═══════════════════════════════════════
// MAIN LOOP
// ═══════════════════════════════════════
async function autoNewsPost() {
    // RSS dan olish va filtrlash mantig'i shu yerda...
    // ...
    return true;
}

// ═══════════════════════════════════════
// SERVER START
// ═══════════════════════════════════════
// Webhook dan foydalanish tavsiya etiladi:
bot.launch({
    webhook: {
        domain: process.env.DOMAIN,
        port: process.env.PORT || 8080
    }
}).then(() => console.log('Bot is running...'));

// Graceful Shutdown
process.once('SIGINT', () => { bot.stop('SIGINT'); db.close(); });
process.once('SIGTERM', () => { bot.stop('SIGTERM'); db.close(); });
