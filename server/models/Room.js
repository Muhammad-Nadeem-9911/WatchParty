const mongoose = require('mongoose');
const Schema = mongoose.Schema; // Or const { Schema } = mongoose;

const RoomSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please provide a room name'],
    trim: true,
    maxlength: [100, 'Room name cannot be more than 100 characters'],
  },
  roomId: { // This will be our user-facing, shareable ID (like the UUID we generate)
    type: String,
    required: true,
    unique: true,
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User', // Reference to the User model
    required: true,
  },
  host: { // The current host of the room
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  members: [{ // Users currently in the room (including the owner/host)
    type: Schema.Types.ObjectId,
    ref: 'User',
  }],
  createdAt: {
    type: Date,
    default: Date.now,
  },
  // We can add more fields later, like currentVideoUrl, participants (though socket handles live participants)
  // Example: videoUrl: { type: String, default: '' }
});

module.exports = mongoose.model('Room', RoomSchema);