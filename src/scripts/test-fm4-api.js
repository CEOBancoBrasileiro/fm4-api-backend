import fm4Api from '../services/fm4-api.js';
import logger from '../utils/logger.js';

async function testFM4Api() {
  try {
    logger.info('Testing FM4 API endpoints');
    
    logger.info('\n1. Testing /live endpoint...');
    const liveData = await fm4Api.getLive();
    console.log('Live broadcasts:', liveData.length);
    if (liveData.length > 0) {
      console.log('Sample live broadcast:');
      console.log('  Program Key:', liveData[0].programKey);
      console.log('  Broadcast Day:', liveData[0].broadcastDay);
      console.log('  Title:', liveData[0].program);
    }
    
    logger.info('\n2. Testing /broadcasts endpoint...');
    const broadcastsData = await fm4Api.getBroadcasts();
    console.log('Days available:', broadcastsData.length);
    
    if (broadcastsData.length > 0) {
      console.log('\nFirst 3 days:');
      for (let i = 0; i < Math.min(3, broadcastsData.length); i++) {
        const dayData = broadcastsData[i];
        console.log(`  Day ${dayData.day}: ${dayData.broadcasts ? dayData.broadcasts.length : 0} broadcasts`);
      }
      
      // Check if today is in the list
      const today = new Date();
      const todayDay = parseInt(
        `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`
      );
      
      const todayData = broadcastsData.find(d => d.day === todayDay);
      if (todayData) {
        console.log(`\n✓ Today (${todayDay}) is in the broadcasts list with ${todayData.broadcasts.length} broadcasts`);
      } else {
        console.log(`\n✗ Today (${todayDay}) is NOT in the broadcasts list`);
        console.log('This explains why the scraper didn\'t fetch today\'s broadcasts');
      }
    }
    
  } catch (error) {
    logger.error('Error testing FM4 API:', error);
  }
}

testFM4Api();
