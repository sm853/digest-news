const cron = require('node-cron');
const { fetchAllArticles, generateHTML, saveDigest } = require('./digest');

// Функция для запуска дайджеста
async function runDigest() {
  console.log(`\n⏰ Плановое обновление дайджеста: ${new Date().toLocaleString('ru-RU')}`);
  
  try {
    const articles = await fetchAllArticles();
    
    if (articles.length === 0) {
      console.error('⚠️ Не удалось загрузить статьи');
      return;
    }

    const html = generateHTML(articles);
    await saveDigest(html);
    console.log('✅ Дайджест успешно обновлён\n');

  } catch (error) {
    console.error('❌ Ошибка при обновлении:', error.message);
  }
}

// Запускаем в 10:00 по Москве каждый день
// Cron формат: минута час * * *
// 10:00 по Москве (UTC+3)
const task = cron.schedule('0 10 * * *', () => {
  runDigest();
});

console.log('🚀 Планировщик запущен');
console.log('📅 Дайджесты будут генерироваться каждый день в 10:00 (Москва)');
console.log('⏹️  Для остановки нажмите Ctrl+C\n');

// Также можно запустить вручную при старте
const args = process.argv.slice(2);
if (args.includes('--now')) {
  console.log('🔄 Запуск ручного обновления...');
  runDigest();
}

// Обработка сигналов завершения
process.on('SIGINT', () => {
  console.log('\n\n👋 Планировщик остановлен');
  task.stop();
  process.exit(0);
});
