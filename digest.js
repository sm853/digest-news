const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

// Конфигурация источников и ключевых слов
const SOURCES = [
  { url: 'https://vc.ru/', name: 'VC.ru' },
  { url: 'https://www.forbes.ru/', name: 'Forbes Russia' },
  { url: 'https://www.theverge.com/', name: 'The Verge' },
  { url: 'https://techcrunch.com/', name: 'TechCrunch' },
  { url: 'https://wired.com', name: 'Wired' },
  { url: 'https://www.superhuman.ai/', name: 'Superhuman' }
];

const KEYWORDS = [
  'ai', 'tool', 'claude', 'chatgpt', 'neural', 'model',
  'developer', 'privacy', 'science', 'creative', 'software',
  'практич', 'инструмент', 'программ', 'алгоритм'
];

// Стили для 10 разных дизайнов
const STYLES = [
  { 
    name: 'main', 
    bg: '#000', 
    text: '#fff', 
    accent: '#00ff00',
    accentText: '#000'
  },
  { 
    name: 'midnight', 
    bg: '#0a0e27', 
    text: '#e0e6ff', 
    accent: '#6366f1',
    accentText: '#fff'
  },
  { 
    name: 'pink', 
    bg: '#fce7f3', 
    text: '#831843', 
    accent: '#ec4899',
    accentText: '#fff'
  },
  { 
    name: 'terminal', 
    bg: '#1a1a2e', 
    text: '#00ff41', 
    accent: '#ff006e',
    accentText: '#fff'
  },
  { 
    name: 'academic', 
    bg: '#f5f3ff', 
    text: '#2d1b69', 
    accent: '#7c3aed',
    accentText: '#fff'
  },
  { 
    name: 'stats', 
    bg: '#fef3c7', 
    text: '#78350f', 
    accent: '#f59e0b',
    accentText: '#000'
  },
  { 
    name: 'ocean', 
    bg: '#0369a1', 
    text: '#f0f9ff', 
    accent: '#06b6d4',
    accentText: '#fff'
  },
  { 
    name: 'forest', 
    bg: '#15803d', 
    text: '#f0fdf4', 
    accent: '#22c55e',
    accentText: '#000'
  },
  { 
    name: 'sunset', 
    bg: '#ea580c', 
    text: '#fef3c7', 
    accent: '#fbbf24',
    accentText: '#000'
  },
  { 
    name: 'lavender', 
    bg: '#6d28d9', 
    text: '#ede9fe', 
    accent: '#a78bfa',
    accentText: '#fff'
  }
];

// Функция для расчёта релевантности
function calculateRelevance(title, description) {
  const text = `${title} ${description}`.toLowerCase();
  return KEYWORDS.filter(kw => text.includes(kw.toLowerCase())).length;
}

// Парсинг статей с обработкой ошибок
async function fetchFromSource(source) {
  const articles = [];
  
  try {
    console.log(`📥 Загружаю ${source.name}...`);
    
    const { data } = await axios.get(source.url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    const $ = cheerio.load(data);
    
    // Пытаемся найти статьи по разным селекторам
    const selectors = [
      'article',
      '[data-article]',
      '.post',
      '.article',
      '[class*="story"]',
      '[class*="post"]',
      'main > div > div'
    ];

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
      
      // Ищем заголовок
      let title = $elem.find('h1, h2, h3, h4').first().text().trim();
      if (!title) {
        title = $elem.find('[class*="title"]').first().text().trim();
      }

      // Ищем описание
      let description = $elem.find('p').first().text().trim();
      if (!description) {
        description = $elem.find('[class*="summary"], [class*="excerpt"], [class*="description"]').first().text().trim();
      }

      // Ищем ссылку
      let link = $elem.find('a').first().attr('href') || '';
      if (!link) {
        link = source.url;
      }

      // Ищем изображение
      let image = $elem.find('img').attr('src') || 
                  $elem.find('img').attr('data-src') || '';

      // Валидация
      if (title && title.length > 10) {
        // Нормализуем ссылку
        if (!link.startsWith('http')) {
          try {
            link = new URL(link, source.url).href;
          } catch {
            link = source.url;
          }
        }

        // Нормализуем изображение
        if (image && !image.startsWith('http')) {
          try {
            image = new URL(image, source.url).href;
          } catch {
            image = '';
          }
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

// Основная функция парсинга
async function fetchAllArticles() {
  console.log('\n🚀 Начинаю загрузку статей...\n');
  
  const allArticles = [];
  
  for (const source of SOURCES) {
    const articles = await fetchFromSource(source);
    allArticles.push(...articles);
    
    // Задержка между запросами, чтобы не спамить серверы
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  // Сортируем по релевантности и берём топ 10
  const topArticles = allArticles
    .sort((a, b) => b.relevance - a.relevance)
    .slice(0, 10);

  console.log(`\n📊 Отобрано топ ${topArticles.length} статей из ${allArticles.length}\n`);
  
  return topArticles;
}

// Генерация HTML
function generateHTML(articles) {
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  
  // Русская локаль
  const dayName = now.toLocaleDateString('ru-RU', { weekday: 'long' });
  const monthYear = now.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
  const time = now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

  let html = `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>FOMO-утро • ${dateStr}</title>
  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600;700&display=swap" rel="stylesheet">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    html, body {
      height: 100%;
    }

    body {
      font-family: 'IBM Plex Mono', monospace;
      background: #f9f9f9;
      overflow-x: hidden;
    }

    .header {
      text-align: center;
      padding: 80px 40px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      position: relative;
      overflow: hidden;
    }

    .header::before {
      content: '';
      position: absolute;
      top: -50%;
      right: -50%;
      width: 200%;
      height: 200%;
      background: radial-gradient(circle, rgba(255,255,255,0.1) 1px, transparent 1px);
      background-size: 50px 50px;
    }

    .header > * {
      position: relative;
      z-index: 1;
    }

    .header h1 {
      font-family: 'IBM Plex Mono', monospace;
      font-size: 5rem;
      margin-bottom: 15px;
      font-weight: 700;
      letter-spacing: -2px;
    }

    .header .meta {
      font-size: 1.1rem;
      opacity: 0.95;
      text-transform: capitalize;
    }

    .header .time {
      font-size: 0.9rem;
      opacity: 0.8;
      margin-top: 10px;
    }

    .articles {
      display: grid;
      grid-template-columns: 1fr;
      gap: 0;
    }

    .article {
      min-height: 100vh;
      padding: 100px 80px;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: flex-start;
      position: relative;
      overflow: hidden;
    }

    .article::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: -1;
    }

    .article-image {
      position: absolute;
      right: 0;
      top: 50%;
      transform: translateY(-50%);
      width: 40%;
      height: 100%;
      object-fit: cover;
      opacity: 0.15;
      z-index: 0;
    }

    .article-content {
      position: relative;
      z-index: 1;
      max-width: 700px;
    }

    .article-number {
      font-family: 'IBM Plex Mono', monospace;
      font-size: 6rem;
      opacity: 0.2;
      margin-bottom: 20px;
      font-weight: 700;
      line-height: 1;
    }

    .article-source {
      font-size: 0.85rem;
      opacity: 0.7;
      margin-bottom: 15px;
      text-transform: uppercase;
      letter-spacing: 2px;
      font-weight: 600;
    }

    .article h2 {
      font-family: 'IBM Plex Mono', monospace;
      font-size: 3.5rem;
      margin-bottom: 30px;
      line-height: 1.15;
      font-weight: 700;
    }

    .article p {
      font-size: 1.15rem;
      line-height: 1.7;
      margin-bottom: 40px;
      opacity: 0.95;
    }

    .article .read-more {
      display: inline-block;
      padding: 18px 50px;
      font-size: 1rem;
      font-weight: 700;
      text-decoration: none;
      border-radius: 50px;
      transition: all 0.3s ease;
      text-transform: uppercase;
      letter-spacing: 1px;
      border: 2px solid;
    }

    .article .read-more:hover {
      transform: translateY(-3px);
      box-shadow: 0 15px 40px rgba(0,0,0,0.2);
    }

    @media (max-width: 1024px) {
      .article {
        padding: 60px 50px;
      }
      
      .article h2 {
        font-size: 2.8rem;
      }
      
      .article-image {
        width: 50%;
      }
    }

    @media (max-width: 768px) {
      .article {
        padding: 50px 30px;
        min-height: auto;
      }

      .article-image {
        display: none;
      }

      .article h2 {
        font-size: 2rem;
      }

      .article p {
        font-size: 1rem;
      }

      .header h1 {
        font-size: 3rem;
      }

      .header {
        padding: 50px 20px;
      }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>FOMO-утро</h1>
    <div class="meta">${dayName}, ${monthYear}</div>
    <div class="time">Выпуск от ${time}</div>
  </div>

  <div class="articles">
  `;

  // Добавляем каждую статью
  articles.forEach((article, idx) => {
    const style = STYLES[idx % STYLES.length];
    
    const readMoreStyle = `
      background: ${style.accent};
      color: ${style.accentText};
      border-color: ${style.accent};
    `;

    html += `
    <article class="article" style="background: ${style.bg}; color: ${style.text};">
      ${article.image ? `<img src="${article.image}" alt="" class="article-image" onerror="this.style.display='none'">` : ''}
      <div class="article-content">
        <div class="article-number">${String(idx + 1).padStart(2, '0')}</div>
        <div class="article-source">${article.source}</div>
        <h2>${article.title}</h2>
        <p>${article.description}</p>
        <a href="${article.link}" target="_blank" rel="noopener noreferrer" class="read-more" style="${readMoreStyle}">
          Читать полностью →
        </a>
      </div>
    </article>
    `;
  });

  html += `
  </div>
</body>
</html>
  `;

  return html;
}

// Сохранение файла
async function saveDigest(html) {
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  
  const dir = path.join(__dirname, 'magazines');
  
  // Создаём папку, если её нет
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

// Главная функция
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

// Запуск
if (require.main === module) {
  main();
}

module.exports = { fetchAllArticles, generateHTML, saveDigest };
