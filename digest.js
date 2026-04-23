const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

// Конфигурация источников и ключевых слов
const SOURCES = [
  { url: 'https://www.forbes.ru/', name: 'Forbes RU' },
  { url: 'https://www.vedomosti.ru/', name: 'Vedomosti' },
  { url: 'https://snob.ru/', name: 'Snob' },
  { url: 'https://vc.ru/', name: 'VC.ru' },
];

const KEYWORDS = [
  'vpn', 'блокировка', 'роскомнадзор', 'ограничение', 'сервис', 'белые',
  'списки', 'блокировка', 'ресурс', 'макс', 'MAX',
  'правительство', 'ограничение', 'программ', 'алгоритм'
];

// Стили для 10 разных дизайнов - все в зеленом Matrix стиле
const STYLES = [
  { name: 'main', bg: '#000', text: '#00ff00', accent: '#00ff00', accentText: '#000' },
  { name: 'midnight', bg: '#0a0e27', text: '#00ff41', accent: '#00ff41', accentText: '#000' },
  { name: 'pink', bg: '#0d0d0d', text: '#00dd00', accent: '#00ff00', accentText: '#000' },
  { name: 'terminal', bg: '#000000', text: '#00ff00', accent: '#00ff00', accentText: '#000' },
  { name: 'academic', bg: '#0f0f0f', text: '#00ee00', accent: '#00ff00', accentText: '#000' },
  { name: 'stats', bg: '#050505', text: '#00ff41', accent: '#00ff00', accentText: '#000' },
  { name: 'ocean', bg: '#0a0a0a', text: '#00dd00', accent: '#00ff00', accentText: '#000' },
  { name: 'forest', bg: '#000000', text: '#00ff00', accent: '#00ff00', accentText: '#000' },
  { name: 'sunset', bg: '#0d0d0d', text: '#00ff41', accent: '#00ff00', accentText: '#000' },
  { name: 'lavender', bg: '#000000', text: '#00ff00', accent: '#00ff00', accentText: '#000' }
];

function calculateRelevance(title, description) {
  const text = `${title} ${description}`.toLowerCase();
  return KEYWORDS.filter(kw => text.includes(kw.toLowerCase())).length;
}

async function fetchFromSource(source) {
  const articles = [];
  try {
    console.log(`📥 Загружаю ${source.name}...`);
    const { data } = await axios.get(source.url, {
      timeout: 10000,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });
    const $ = cheerio.load(data);
    const selectors = ['article', '[data-article]', '.post', '.article', '[class*="story"]', '[class*="post"]', 'main > div > div'];
    let $items = [];
    for (const selector of selectors) {
      $items = $(selector);
      if ($items.length > 0) break;
    }
    if ($items.length === 0) {
      console.log(`⚠️  Не удалось найти статьи на ${source.name}`);
      return articles;
    }
    $items.each((i, elem) => {
      if (articles.length >= 20) return;
      const $elem = $(elem);
      let title = $elem.find('h1, h2, h3, h4').first().text().trim();
      if (!title) title = $elem.find('[class*="title"]').first().text().trim();
      let description = $elem.find('p').first().text().trim();
      if (!description) description = $elem.find('[class*="summary"], [class*="excerpt"], [class*="description"]').first().text().trim();
      let link = $elem.find('a').first().attr('href') || '';
      if (!link) link = source.url;
      let image = $elem.find('img').attr('src') || $elem.find('img').attr('data-src') || '';
      if (title && title.length > 10) {
        if (!link.startsWith('http')) {
          try { link = new URL(link, source.url).href; } catch { link = source.url; }
        }
        if (image && !image.startsWith('http')) {
          try { image = new URL(image, source.url).href; } catch { image = ''; }
        }
        const relevance = calculateRelevance(title, description);
        articles.push({
          title: title.substring(0, 200),
          description: description.substring(0, 400),
          link,
          image,
          source: source.name,
          relevance,
          timestamp: new Date().toISOString()
        });
      }
    });
    console.log(`✅ ${source.name}: найдено ${articles.length} статей`);
    return articles;
  } catch (error) {
    console.error(`❌ Ошибка при парсинге ${source.name}: ${error.message}`);
    return articles;
  }
}

async function fetchAllArticles() {
  console.log('\n🚀 Начинаю загрузку статей...\n');
  const allArticles = [];
  for (const source of SOURCES) {
    const articles = await fetchFromSource(source);
    allArticles.push(...articles);
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  const topArticles = allArticles.sort((a, b) => b.relevance - a.relevance).slice(0, 10);
  console.log(`\n📊 Отобрано топ ${topArticles.length} статей из ${allArticles.length}\n`);
  return topArticles;
}

function generateHTML(articles) {
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  const dayNum = now.getDate();
  const monthName = now.toLocaleDateString('ru-RU', { month: 'long' });
  const yearNum = now.getFullYear();
  const time = now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  const issueNumber = dayNum;

  let html = `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>FOMO-утро • ${dateStr}</title>
  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600;700&display=swap" rel="stylesheet">
  <style>
    @keyframes matrixGlow {
      0%, 100% { text-shadow: 0 0 10px #00ff00, 0 0 20px #00aa00, 0 0 30px #008800; }
      50% { text-shadow: 0 0 20px #00ff00, 0 0 40px #00cc00, 0 0 60px #00aa00; }
    }
    
    @keyframes scanline {
      0% { transform: translateY(0); }
      100% { transform: translateY(10px); }
    }
    
    @keyframes flicker {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.98; }
    }
    
    @keyframes buttonHover {
      0%, 100% { box-shadow: 0 0 10px #00ff00, inset 0 0 10px rgba(0,255,0,0.3); }
      50% { box-shadow: 0 0 20px #00ff00, inset 0 0 20px rgba(0,255,0,0.5); }
    }

    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { height: 100%; }
    
    body {
      font-family: 'IBM Plex Mono', monospace;
      background: #000000;
      color: #00ff00;
      overflow-x: hidden;
      position: relative;
    }
    
    body::before {
      content: '';
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: repeating-linear-gradient(
        0deg,
        rgba(0,255,0,0.03) 0px,
        rgba(0,255,0,0.03) 1px,
        transparent 1px,
        transparent 2px
      );
      pointer-events: none;
      z-index: 9999;
      animation: scanline 8s linear infinite;
    }

    .header {
      min-height: 100vh;
      padding: 60px 80px;
      background: #000000;
      color: #00ff00;
      position: relative;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      border-bottom: 3px solid #00ff00;
    }

    .header::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: radial-gradient(circle at 20% 50%, rgba(0,255,0,0.05) 0%, transparent 50%),
                  radial-gradient(circle at 80% 80%, rgba(0,255,0,0.05) 0%, transparent 50%);
      z-index: 0;
    }

    .header::after {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      border: 2px solid rgba(0,255,0,0.1);
      box-shadow: inset 0 0 20px rgba(0,255,0,0.05);
      z-index: 0;
    }

    .header-content {
      position: relative;
      z-index: 1;
      text-align: center;
    }

    .header-logo {
      position: relative;
      z-index: 1;
      margin-bottom: 40px;
    }

    .header-logo img {
      max-width: 200px;
      max-height: 200px;
      object-fit: contain;
      filter: drop-shadow(0 0 20px rgba(0,255,0,0.6)) brightness(1.2);
      border: 2px solid #00ff00;
      padding: 15px;
      background: rgba(0,255,0,0.05);
    }

    .header h1 {
      font-family: 'IBM Plex Mono', monospace;
      font-size: 7rem;
      margin-bottom: 30px;
      font-weight: 700;
      letter-spacing: 4px;
      line-height: 1;
      color: #00ff00;
      animation: matrixGlow 3s ease-in-out infinite, flicker 0.15s infinite;
      text-shadow: 0 0 10px #00ff00, 0 0 20px #00aa00;
    }

    .header-meta {
      font-size: 1.3rem;
      margin-bottom: 10px;
      color: #00dd00;
      text-transform: capitalize;
      letter-spacing: 2px;
    }

    .header-issue {
      font-size: 1.1rem;
      color: #00ff00;
      font-weight: 600;
      letter-spacing: 1px;
    }

    .articles {
      display: grid;
      grid-template-columns: 1fr;
      gap: 0;
    }

    .article {
      min-height: 100vh;
      padding: 80px 80px;
      display: grid;
      grid-template-columns: 1fr 400px;
      gap: 60px;
      align-items: center;
      position: relative;
      overflow: hidden;
      background: #000000;
      border-bottom: 2px solid rgba(0,255,0,0.3);
      color: #00ff00;
    }

    .article::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: radial-gradient(circle at 10% 50%, rgba(0,255,0,0.08) 0%, transparent 50%);
      z-index: -1;
    }

    .article-content {
      position: relative;
      z-index: 1;
      display: flex;
      flex-direction: column;
    }

    .article-number {
      font-family: 'IBM Plex Mono', monospace;
      font-size: 5rem;
      opacity: 0.2;
      margin-bottom: 20px;
      font-weight: 700;
      line-height: 1;
      color: #00ff00;
      letter-spacing: 2px;
    }

    .article-source {
      font-size: 0.9rem;
      opacity: 0.8;
      margin-bottom: 20px;
      text-transform: uppercase;
      letter-spacing: 3px;
      font-weight: 600;
      color: #00dd00;
      border-left: 3px solid #00ff00;
      padding-left: 15px;
    }

    .article h2 {
      font-family: 'IBM Plex Mono', monospace;
      font-size: 2.8rem;
      margin-bottom: 30px;
      line-height: 1.2;
      font-weight: 700;
      color: #00ff00;
      letter-spacing: 1px;
      text-shadow: 0 0 10px rgba(0,255,0,0.5);
    }

    .article-quote {
      font-size: 1.1rem;
      line-height: 1.8;
      margin-bottom: 30px;
      opacity: 0.95;
      padding: 20px;
      border-left: 4px solid #00ff00;
      background: rgba(0,255,0,0.05);
      font-style: italic;
      color: #00ee00;
    }

    .article-image-container {
      position: relative;
      z-index: 1;
      width: 100%;
      height: 100%;
      min-height: 400px;
      border-radius: 0px;
      overflow: hidden;
      background: #0a0a0a;
      border: 2px solid #00ff00;
      box-shadow: 0 0 20px rgba(0,255,0,0.3);
    }

    .article-image {
      width: 100%;
      height: 100%;
      object-fit: cover;
      filter: brightness(1.1) contrast(1.2);
    }

    .article-image-placeholder {
      width: 100%;
      height: 100%;
      background: linear-gradient(135deg, rgba(0,255,0,0.1), rgba(0,255,0,0.05));
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.9rem;
      opacity: 0.5;
      color: #00ff00;
      border: 1px dashed #00ff00;
    }

    .article .read-more {
      display: inline-block;
      margin-top: auto;
      padding: 15px 35px;
      font-size: 0.95rem;
      font-weight: 700;
      text-decoration: none;
      border-radius: 0px;
      transition: all 0.3s ease;
      text-transform: uppercase;
      letter-spacing: 2px;
      border: 2px solid #00ff00;
      background: transparent;
      color: #00ff00;
      width: fit-content;
      position: relative;
      overflow: hidden;
    }

    .article .read-more::before {
      content: '';
      position: absolute;
      top: 0;
      left: -100%;
      width: 100%;
      height: 100%;
      background: rgba(0,255,0,0.2);
      transition: left 0.3s ease;
      z-index: -1;
    }

    .article .read-more:hover {
      animation: buttonHover 0.6s ease;
    }

    .article .read-more:hover::before {
      left: 0;
    }

    @media (max-width: 1024px) {
      .header {
        flex-direction: column;
        text-align: center;
      }

      .header h1 {
        font-size: 5rem;
      }

      .article {
        grid-template-columns: 1fr;
        gap: 40px;
        padding: 60px 50px;
      }

      .article-image-container {
        min-height: 300px;
      }
    }

    @media (max-width: 768px) {
      .header {
        padding: 40px 20px;
        min-height: auto;
      }

      .header h1 {
        font-size: 3rem;
      }

      .header-logo img {
        max-width: 150px;
      }

      .article {
        grid-template-columns: 1fr;
        gap: 30px;
        padding: 40px 20px;
        min-height: auto;
      }

      .article h2 {
        font-size: 1.8rem;
      }

      .article-quote {
        font-size: 1rem;
      }

      .article-image-container {
        min-height: 250px;
      }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-logo">
      <img src="logo.png" alt="FOMO-утро logo" onerror="this.style.display='none'">
    </div>
    <div class="header-content">
      <h1>FOMO-УТРО</h1>
      <div class="header-meta">${dayNum} ${monthName} ${yearNum} • ${time}</div>
      <div class="header-issue">Выпуск №${issueNumber}</div>
    </div>
  </div>

  <div class="articles">
  `;

  articles.forEach((article, idx) => {
    const quote = article.description.split('.')[0] + '.';

    html += `
    <article class="article">
      <div class="article-content">
        <div class="article-number">${String(idx + 1).padStart(2, '0')}</div>
        <div class="article-source">${article.source}</div>
        <h2>${article.title}</h2>
        <div class="article-quote">${quote}</div>
        <a href="${article.link}" target="_blank" rel="noopener noreferrer" class="read-more">Читать →</a>
      </div>
      <div class="article-image-container">
        ${article.image ? `<img src="${article.image}" alt="" class="article-image" onerror="this.parentElement.innerHTML='<div class=\\'article-image-placeholder\\'>Нет изображения</div>'">` : `<div class="article-image-placeholder">Нет изображения</div>`}
      </div>
    </article>
    `;
  });

  html += `</div></body></html>`;
  return html;
}

async function saveDigest(html) {
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  const dir = path.join(__dirname, 'magazines');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`📁 Создана папка: ${dir}`);
  }
  const filePath = path.join(dir, `${dateStr}.html`);
  fs.writeFileSync(filePath, html, 'utf-8');
  console.log(`✅ Дайджест сохранён: ${filePath}`);
  console.log(`🌐 Откройте в браузере: file://${filePath}`);
  return filePath;
}

async function main() {
  try {
    console.log('\n' + '='.repeat(60));
    console.log('   FOMO-утро: Генератор дайджеста AI новостей');
    console.log('='.repeat(60) + '\n');
    const articles = await fetchAllArticles();
    if (articles.length === 0) {
      console.error('❌ Не удалось загрузить статьи. Проверьте интернет-соединение.');
      process.exit(1);
    }
    const html = generateHTML(articles);
    await saveDigest(html);
    console.log('\n' + '='.repeat(60));
    console.log('✨ Дайджест готов!');
    console.log('='.repeat(60) + '\n');
  } catch (error) {
    console.error('❌ Критическая ошибка:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { fetchAllArticles, generateHTML, saveDigest };
