import db from '../database/database.js';

db.initialize();

const doneCount = db.db.prepare('SELECT COUNT(*) as count FROM broadcasts WHERE done = 1').get();
const totalCount = db.db.prepare('SELECT COUNT(*) as count FROM broadcasts').get();

console.log(`\nBroadcasts marked as done: ${doneCount.count}`);
console.log(`Total broadcasts: ${totalCount.count}`);

console.log('\nSample of old broadcasts (should be marked as done):');
const oldBroadcasts = db.db.prepare(`
  SELECT broadcast_day, program_key, end_time, done, title 
  FROM broadcasts 
  WHERE broadcast_day < 20251023 
  ORDER BY end_time DESC 
  LIMIT 10
`).all();

oldBroadcasts.forEach(b => {
  const endDate = new Date(b.end_time);
  const now = new Date();
  const hasEnded = b.end_time < now.getTime();
  console.log(`  ${b.program_key}/${b.broadcast_day} - ${b.title}`);
  console.log(`    End: ${endDate.toISOString()} (ended: ${hasEnded})`);
  console.log(`    Done: ${b.done === 1 ? 'YES' : 'NO'}`);
});

console.log('\nToday\'s broadcasts:');
const todayBroadcasts = db.db.prepare(`
  SELECT broadcast_day, program_key, end_time, done, title 
  FROM broadcasts 
  WHERE broadcast_day = 20251023 
  ORDER BY end_time DESC
`).all();

todayBroadcasts.forEach(b => {
  const endDate = new Date(b.end_time);
  const now = new Date();
  const hasEnded = b.end_time < now.getTime();
  console.log(`  ${b.program_key}/${b.broadcast_day} - ${b.title}`);
  console.log(`    End: ${endDate.toISOString()} (ended: ${hasEnded})`);
  console.log(`    Done: ${b.done === 1 ? 'YES' : 'NO'}`);
});

db.close();
