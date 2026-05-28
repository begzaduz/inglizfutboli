const http = require('http');
const https = require('https');

const TOKEN = '8701604879:AAEeEUPd6bclS1zvIKKNAGu1qojRe5r4m1k';
const CHANNEL = '@Inglizfutbol';
const GROQ_KEY = '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';
const NEWS_KEY = 'd5344d1dcf8a4af7bc15bbf122cc0366';
const pending = {};
const postedIds = new Set();

const NAMES = {
  'Premier League': 'Premier-liga',
  'Champions League': 'Chempionlar ligasi',
  'FA Cup': 'FA Kubogi',
  'Carabao Cup': 'Karabao Kubogi',
  'Europa League': 'Evropa ligasi',
  'Conference League': 'Konferensiyalar ligasi',
  'World Cup': 'Jahon chempionati',
  'Erling Haaland': 'Erling Holland',
  'Haaland': 'Holland',
  'Abdukodir Khusanov': 'Abduqodir Husanov',
  'Khusanov': 'Husanov',
  'Cole Palmer': 'Koul Palmer',
  'Phil Foden': 'Fil Foden',
  'Martin Odegaard': 'Martin Edegor',
  'Ødegaard': 'Edegor',
  'Bruno Fernandes': 'Bruno Fernandesh',
  'Declan Rice': 'Deklan Rays',
  'Kevin De Bruyne': 'Kevin De Bryuyne',
  'De Bruyne': 'De Bryuyne',
  'Marcus Rashford': 'Markus Reshford',
  'Rashford': 'Reshford',
  'Ollie Watkins': 'Olli Uotkins',
  'Alexander Isak': 'Aleksandr Isak',
  'Luis Diaz': 'Luis Dias',
  'Jack Grealish': 'Jek Grilish',
  'Kai Havertz': 'Kay Haverts',
  'Alejandro Garnacho': 'Alexandro Garnacho',
  'Virgil van Dijk': 'Virjil van Deyk',
  'van Dijk': 'van Deyk',
  'Nicolas Jackson': 'Nikolas Jekson',
  'Mohamed Salah': 'Muhammad Saloh',
  'Salah': 'Saloh',
  'Enzo Maresca': 'Enso Mareska',
  'Pep Guardiola': 'Pep Gvardiola',
  'Guardiola': 'Gvardiola',
  'Jurgen Klopp': 'Yurgen Klopp',
  'Erik ten Hag': 'Erik ten Xag',
  'Mikel Arteta': 'Mikel Arteta',
  'Arne Slot': 'Arne Slot',
  'Unai Emery': 'Unai Emeri',
  'Eddie Howe': 'Eddi Hau',
  'Thomas Frank': 'Tomas Frank',
  'Marco Silva': 'Marku Silva',
  // Klub nomlari
  'Manchester City': 'Manchester Siti',
  'Manchester United': 'Manchester Yunayted',
  'Newcastle United': 'Nyukasl',
  'Newcastle': 'Nyukasl',
  'Tottenham Hotspur': 'Tottenxem',
  'Tottenham': 'Tottenxem',
  'Aston Villa': 'Aston Villa',
  'West Ham United': 'Uest Xem',
  'West Ham': 'Uest Xem',
  'Crystal Palace': 'Kristal Pales',
  'Wolverhampton': 'Volverhempton',
  'Wolves': 'Bo\'rilar',
  'Brighton': 'Brayton',
  'Brentford': 'Brentford',
  'Fulham': 'Fulxem',
  'Bournemouth': 'Bornemut',
  'Nottingham Forest': 'Nottingem Forest',
  'Leicester City': 'Lester',
  'Ipswich': 'Ipsvich',
  'Southampton': 'Sautempton',
};

// ═══════════════════════════════════════════
// SYSTEM PROMPT — bir marta aniqlanadi
// ═══════════════════════════════════════════
const SYSTEM_PROMPT = `Sen @Inglizfutbol Telegram kanalining professional sport jurnalistisan.
Sening vazifang: inglizcha futbol yangiligini o'qib, uni to'liq, professional o'zbek jurnalistikasi uslubida Telegram post qilib yozish.

USLUB QOIDALARI:
- Inverted pyramid: eng muhim fakt birinchi, keyin tafsilot
- Jonli, faol til — passiv konstruksiyalardan qoching
- Raqamlar, sanalar, natijalar aniq keltirilsin
- Klub laqablarini ishlat: Arsenal="to'pchilar", Liverpool="qizillar", Chelsea="aristokratlar", Man City="fuqarolar", Man Utd="qizil iblislar", Tottenham="xo'rozlar", Newcastle="qarg'alar", Bournemouth="olchalar", West Ham="bolg'achilar", Crystal Palace="burgutlar", Wolves="bo'rilar", Brighton="qaldirg'ochlar", Brentford="arilar", Everton="karamellar", Aston Villa="villalar"

POST FORMATI:
[emoji] [Sarlavha — qisqa, zarba bilan]

[Kirish — 1-2 gap, eng muhim ma'lumot]

[Tafsilot — to'liq gap, kontekst, statistika, natijalar]

[Iqtibos bo'lsa: 🎙 "iqtibos matni" — Ism]

[Fakt/kontekst — jadval o'rni, rekord yoki "keyingi o'yin" ma'lumoti]

@Inglizfutbol

MUHIM:
- Transfer, ishdan bo'shatish, og'ir shikastda "#BREAKING" qo'sh
- Oddiy yangilikda "#BREAKING" ishlatma
- 400-700 belgi oralig'ida yoz
