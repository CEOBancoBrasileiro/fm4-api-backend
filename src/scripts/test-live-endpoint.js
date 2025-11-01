import db from '../database/database.js';
import logger from '../utils/logger.js';
import transformer from '../utils/broadcast-transformer.js';

db.initialize();

const today = new Date();
const todayDay = parseInt(
  `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`
);

console.log('Today:', todayDay);

const broadcasts = db.getBroadcastsByDateRange(todayDay, todayDay);
console.log('Broadcasts found for today:', broadcasts.length);

if (broadcasts.length > 0) {
  console.log('\nSample broadcast:');
  console.log('  Title:', broadcasts[0].title);
  console.log('  Program Key:', broadcasts[0].program_key);
  console.log('  Start:', new Date(broadcasts[0].start_time).toISOString());
  console.log('  End:', broadcasts[0].end_time ? new Date(broadcasts[0].end_time).toISOString() : 'N/A');
  
  const now = Date.now();
  const liveBroadcasts = broadcasts.filter(b => 
    b.start_time <= now && (!b.end_time || b.end_time >= now)
  );
  
  console.log('\nCurrently live broadcasts:', liveBroadcasts.length);
  if (liveBroadcasts.length > 0) {
    console.log('  Live now:', liveBroadcasts[0].title);
  }
  
  const nextBroadcast = broadcasts.find(b => b.start_time > now);
  if (nextBroadcast) {
    console.log('\nNext broadcast:', nextBroadcast.title);
    console.log('  Starts at:', new Date(nextBroadcast.start_time).toISOString());
  }
} else {
  console.log('\nNo broadcasts found for today!');
  console.log('This is why /api/live returns []');
  
  // Check if there are any broadcasts at all
  const allBroadcasts = db.getAllBroadcasts(10);
  console.log('\nTotal broadcasts in database:', allBroadcasts.length);
  if (allBroadcasts.length > 0) {
    console.log('Most recent broadcast:');
    console.log('  Day:', allBroadcasts[0].broadcast_day);
    console.log('  Title:', allBroadcasts[0].title);
  }
}

console.log('\n--- Testing transformLiveData (includes yesterday) ---');
const liveData = await transformer.transformLiveData('http://localhost:3000', true);
console.log('Live data returned:', liveData.length, 'broadcast(s)');
if (liveData.length > 0) {
  console.log('✓ First broadcast:', liveData[0].title);
  console.log('  Program Key:', liveData[0].programKey);
  console.log('  Broadcast Day:', liveData[0].broadcastDay);
  console.log('\n/api/live should now return data!');
}

db.close();
