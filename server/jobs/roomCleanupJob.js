const cron = require('node-cron');
const Room = require('../models/Room');
const User = require('../models/User');
const { handleRoomDeletionLogic } = require('../controllers/roomController'); // Import reusable logic

const AUTO_DELETE_AFTER_HOURS = 12;

const deleteOldRooms = async () => {
  console.log('[CRON JOB] Running deleteOldRooms job at', new Date().toISOString());
  try {
    const cutoffDate = new Date(Date.now() - AUTO_DELETE_AFTER_HOURS * 60 * 60 * 1000);
    
    // Find rooms older than the cutoff time
    const oldRooms = await Room.find({ createdAt: { $lt: cutoffDate } });

    if (oldRooms.length === 0) {
      console.log('[CRON JOB] No old rooms found to delete.');
      return;
    }

    console.log(`[CRON JOB] Found ${oldRooms.length} old room(s) to delete.`);

    for (const room of oldRooms) {
      console.log(`[CRON JOB] Deleting room: ${room.name} (ID: ${room.roomId}, Created: ${room.createdAt})`);

      // Use the reusable deletion logic
      // Pass null for ownerId as this is an automated job, not user-initiated delete check
      // The logic will still clear createdRoomId based on room.createdBy
      await handleRoomDeletionLogic(room.roomId, room.createdBy, io, 'CRON_JOB');
    }
  } catch (error) {
    console.error('[CRON JOB] Error in deleteOldRooms job:', error);
  }
};

exports.scheduleRoomCleanup = (io) => { // Accept io
  // Schedule to run every hour (at the start of the hour)
  cron.schedule('0 * * * *', deleteOldRooms);
  console.log('[CRON JOB] Room cleanup job scheduled to run every hour.');
};