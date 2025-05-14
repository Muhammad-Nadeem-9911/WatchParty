const mongoose = require('mongoose');

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
    type: mongoose.Schema.ObjectId,
    ref: 'User', // Reference to the User model
    required: true,
  },
  host: { // The current host of the room
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  // We can add more fields later, like currentVideoUrl, participants (though socket handles live participants)
});

module.exports = mongoose.model('Room', RoomSchema);