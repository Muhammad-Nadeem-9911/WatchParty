const cron = require('node-cron');
const Room = require('../models/Room');
const User = require('../models/User');

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

      // Update all members (including owner) who were in this room
      // room.members is an array of User ObjectIds
      if (room.members && room.members.length > 0) {
        await User.updateMany(
          { _id: { $in: room.members } },
          { $set: { currentRoomId: null } }
        );
      }

      // Specifically clear createdRoomId for the owner
      if (room.createdBy) {
        await User.findByIdAndUpdate(room.createdBy, { $set: { createdRoomId: null } });
        // The owner's currentRoomId should have been cleared by the updateMany above if they were in members.
      }

      // Delete the room document
      await Room.findByIdAndDelete(room._id);
      console.log(`[CRON JOB] Successfully deleted room ${room.roomId} and updated associated users.`);
    }
  } catch (error) {
    console.error('[CRON JOB] Error in deleteOldRooms job:', error);
  }
};

exports.scheduleRoomCleanup = () => {
  // Schedule to run every hour (at the start of the hour)
  cron.schedule('0 * * * *', deleteOldRooms);
  console.log('[CRON JOB] Room cleanup job scheduled to run every hour.');
};