const sqlite3 = require('sqlite3');
const { open } = require('sqlite');

(async () => {
  try {
    const db = await open({ filename: './data.sqlite', driver: sqlite3.Database });
    const users = await db.all('SELECT id, name, email, created_at FROM users ORDER BY id DESC LIMIT 20');
    console.log('Users (latest 20):');
    if (!users || users.length === 0) {
      console.log('  No users found.');
      process.exit(0);
    }
    users.forEach(u => {
      console.log(`  ${u.id} | ${u.email} | ${u.name} | created: ${u.created_at}`);
    });
    await db.close();
  } catch (err) {
    console.error('Failed to read DB:', err.message);
    process.exit(1);
  }
})();
