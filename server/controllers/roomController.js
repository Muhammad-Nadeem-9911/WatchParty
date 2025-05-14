const Room = require('../models/Room');
const User = require('../models/User');
const { v4: uuidv4 } = require('uuid');
const mongoose = require('mongoose');

// @desc    Create a new room
// @route   POST /api/rooms
// @access  Private
exports.createRoom = async (req, res, io) => { // Accept io as a parameter
    console.log(`[${req.requestId}] Create room request body:`, req.body); // Log the received body with ID

    // Let's expect 'roomName' from the body, consistent with your previous setup,
    // but the model's field is 'name'.
    const { roomName, videoUrl } = req.body;    const userId = req.user._id; // Assuming auth middleware sets req.user

    try {
        console.log(`[${req.requestId}] Attempting to create room for user: ${userId}`);
        const user = await User.findById(userId);
        if (!user) {
            console.log(`[${req.requestId}] User not found for ID: ${userId}`);
            return res.status(404).json({ message: 'User not found.' });
        }

        // Rule 1: User can create only 1 room
        if (user.createdRoomId) {
            console.log(`[${req.requestId}] User already owns a room: ${user.createdRoomId}`);
            return res.status(400).json({ message: 'You already own a room. Please delete it before creating a new one.' });
        }

        // Rule 2: User can only be in 1 room at a time (even if creating)
        if (user.currentRoomId) {
            return res.status(400).json({ message: 'You are already in a room. Please leave it before creating a new one.' });
        }
        if (!roomName) { // Explicit check for roomName
            return res.status(400).json({ message: 'Room name is required.' });
        }
        console.log(`[${req.requestId}] User ${user.username} does not own a room. Proceeding with creation.`);
        const newRoom = new Room({
            name: roomName, // Use roomName from req.body for the 'name' field
            roomId: uuidv4(), // Generate a unique shareable ID
            createdBy: userId,
            host: userId, // Creator is the initial host
            members: [userId], // Creator is the first member
            // videoUrl: videoUrl || '', // Optional: set video URL
        });

        await newRoom.save();
        console.log(`[${req.requestId}] New room created: ${newRoom.roomId}. Updating user status.`);
        // Update user's status
        user.createdRoomId = newRoom._id;
        user.currentRoomId = newRoom._id;
        await user.save();

        console.log(`[${req.requestId}] User status updated. Emitting 'room_created' event.`);
        // Emit an event to all connected clients that a new room was created
        if (io) {
            // We need to populate createdBy to send username in the event
            const populatedNewRoom = await Room.findById(newRoom._id)
                .populate('createdBy', 'username _id')
                .populate('host', 'username _id') // Also good to populate host
                .populate('members', 'username _id'); // And members

            io.emit('room_created', populatedNewRoom);
            console.log(`[${req.requestId}] Emitted 'room_created' for new room: ${populatedNewRoom.name}`);
        }

        res.status(201).json(newRoom);
        console.log(`[${req.requestId}] Room creation successful. Response sent.`);
    } catch (error) {
        console.error("Error creating room:", error);
        res.status(500).json({ message: 'Server error creating room', error: error.message });
    }
};

// @desc    Join an existing room
// @route   POST /api/rooms/:roomId/join
// @access  Private
exports.joinRoom = async (req, res) => {
    const { roomId } = req.params; // This is the shareable roomId (UUID)
    const userId = req.user._id;

    try {
        console.log(`[${req.requestId}] POST /api/rooms/:roomId/join hit for roomId: ${roomId}, user: ${userId}`);
        const user = await User.findById(userId);
        if (!user) {
            console.log(`[${req.requestId}] User not found for ID: ${userId}`);
            return res.status(404).json({ message: 'User not found.' });
        }

        console.log(`[${req.requestId}] Checking if user ${user.username} is already in a room. user.currentRoomId: ${user.currentRoomId}`);

        // Rule: User can only be in 1 room at a time
        if (user.currentRoomId) {
            console.log(`[${req.requestId}] User ${user.username} has currentRoomId: ${user.currentRoomId}. Fetching this existing room.`);
            const existingRoom = await Room.findById(user.currentRoomId);

            if (existingRoom) {
                // User is marked as being in a room, and that room actually exists.
                console.log(`[${req.requestId}] Existing room found: ${existingRoom.name} (Shareable ID: ${existingRoom.roomId}). Comparing with requested roomId: ${roomId}`);
                if (existingRoom.roomId === roomId) {
                    // Trying to join the same room they are already in.
                    console.log(`[${req.requestId}] User is already in this specific room. Denying re-join.`);
                    return res.status(400).json({ message: 'You are already in this room.' });
                } else {
                    // Trying to join a different room while already in one.
                    console.log(`[${req.requestId}] User is in a different room ('${existingRoom.name}'). Denying join to room with shareable ID '${roomId}'.`);
                    return res.status(400).json({ message: 'You are already in another room. Please leave it before joining a new one.' });
                }
            } else {
                // User has a currentRoomId, but that room doesn't exist in the DB (stale ID).
                // Treat as if they are not in a room, allow them to join.
                console.log(`[${req.requestId}] User's currentRoomId ${user.currentRoomId} is stale (room not found). Allowing join to ${roomId}.`);
            }
        }

        // If user.currentRoomId is null, or was stale, proceed to join.
        console.log(`[${req.requestId}] User ${user.username} is allowed to join. Proceeding to find roomToJoin: ${roomId}`);
        const roomToJoin = await Room.findOne({ roomId });
        console.log(`[${req.requestId}] Found room to join? ${!!roomToJoin}`);
        if (!roomToJoin) {
            return res.status(404).json({ message: 'Room not found.' });
        }

        // Add user to members list if not already present
        const userIdStr = userId.toString();
        if (!roomToJoin.members.map(id => id.toString()).includes(userIdStr)) {
            console.log(`[${req.requestId}] Adding user ${user.username} to members list of room ${roomToJoin.name}.`);
            roomToJoin.members.push(userId);
            await roomToJoin.save(); // Save the room because its members list changed
        } else {
            console.log(`[${req.requestId}] User ${user.username} is already in the members list of room ${roomToJoin.name}. No change to members list.`);
        }

        // Update user's currentRoomId
        user.currentRoomId = roomToJoin._id; // roomToJoin._id is the MongoDB ObjectId
        console.log(`[${req.requestId}] Updating user's currentRoomId to ${roomToJoin._id} for room ${roomToJoin.name}.`);
        await user.save();

        const populatedRoom = await Room.findById(roomToJoin._id).populate('members', 'username _id').populate('createdBy', 'username _id').populate('host', 'username _id');
        console.log(`[${req.requestId}] Successfully joined room ${roomToJoin.roomId}. Response sent.`);
        res.status(200).json({ message: 'Successfully joined room', room: populatedRoom });
    } catch (error) {
        console.error(`[${req.requestId}] Error joining room:`, error);
        res.status(500).json({ message: 'Server error joining room', error: error.message });
    }
};

// Reusable logic for when a user leaves a room (either via HTTP or socket disconnect)
async function handleUserLeaveRoomLogic(userId, shareableRoomId, io, requestId = 'SOCKET_LEAVE') {
    console.log(`[${requestId}] handleUserLeaveRoomLogic called for user: ${userId}, shareableRoomId: ${shareableRoomId}`);
    const user = await User.findById(userId);
    if (!user) {
        console.log(`[${requestId}] User ${userId} not found during leave logic.`);
        return { success: false, error: 'User not found.' };
    }

    const roomToLeave = await Room.findOne({ roomId: shareableRoomId });
    if (!roomToLeave) {
        console.log(`[${requestId}] Room with shareableId ${shareableRoomId} not found during leave logic.`);
        // If room doesn't exist, but user thinks they are in it, clear their status
        if (user.currentRoomId) { // Check if currentRoomId is set before trying to clear
            user.currentRoomId = null;
            await user.save();
            console.log(`[${requestId}] Cleared stale currentRoomId for user ${userId} as room ${shareableRoomId} not found.`);
            if (io) io.emit('user_room_status_changed', { userId: userId.toString(), currentRoomId: null });
        }
        return { success: false, error: 'Room not found.' };
    }

    // Check if user is actually in this room based on their currentRoomId
    if (!user.currentRoomId || !user.currentRoomId.equals(roomToLeave._id)) {
        console.log(`[${requestId}] User ${userId} is not marked as being in room ${roomToLeave.name} (DB ID: ${roomToLeave._id}). User's currentRoomId: ${user.currentRoomId}. No action needed for this room.`);
        return { success: true, message: 'User not in this room according to DB.' }; // Or false if this is an error state
    }

    // Owner cannot "leave" their own room this way; they must "delete" it.
    if (roomToLeave.createdBy.equals(userId)) {
        console.log(`[${requestId}] Owner ${userId} attempted to leave room ${shareableRoomId} via general leave logic. This should be handled by delete.`);
        // For socket disconnect, owner "leaving" means they disconnected. We don't delete the room here.
        // We will still clear their currentRoomId and remove from members.
    }

    roomToLeave.members.pull(userId);
    if (roomToLeave.host.equals(userId) && !roomToLeave.createdBy.equals(userId)) { // If leaving user is host but not owner
        roomToLeave.host = roomToLeave.createdBy; // Make owner the host
    }
    await roomToLeave.save();

    user.currentRoomId = null;
    await user.save();
    console.log(`[${requestId}] User ${userId} successfully left room ${roomToLeave.name}. currentRoomId cleared.`);

    if (io) {
        io.to(roomToLeave.roomId).emit('user_left_room', { roomId: roomToLeave.roomId, userId: userId.toString(), username: user.username });
        io.emit('user_room_status_changed', { userId: userId.toString(), currentRoomId: null });
        console.log(`[${requestId}] Emitted 'user_left_room' for room ${roomToLeave.roomId} and 'user_room_status_changed' for user ${userId}`);
    }
    return { success: true, message: 'Successfully left room.' };
}

// Export the helper function so it can be used by server.js
exports.handleUserLeaveRoomLogic = handleUserLeaveRoomLogic;

// @desc    Leave a room
// @route   POST /api/rooms/:roomId/leave
// @access  Private
exports.leaveRoom = async (req, res, io) => { // Accept io
    const { roomId } = req.params; // Shareable roomId
    const userId = req.user._id;

    try {
        const roomToLeave = await Room.findOne({ roomId }); // Need to check if user is owner before calling generic logic
        if (roomToLeave.createdBy.equals(userId)) {
            console.log(`[${req.requestId}] Owner attempted to leave room ${roomId}.`);
            return res.status(400).json({ message: 'Owner cannot leave the room. Please delete the room instead.' });
        }

        const result = await handleUserLeaveRoomLogic(userId, roomId, io, req.requestId);
        if (result.success) {
            res.status(200).json({ message: result.message });
        } else {
            res.status(400).json({ message: result.error || 'Failed to leave room' }); // Or appropriate status code
        }
    } catch (error) {
        console.error("Error leaving room:", error);
        res.status(500).json({ message: 'Server error leaving room', error: error.message });
    }
};

// @desc    Delete a room (only by owner)
// @route   DELETE /api/rooms/:roomId
// @access  Private
exports.deleteRoom = async (req, res, io) => { // Accept io as a parameter
    const { roomId } = req.params; // Shareable roomId
    const userId = req.user._id; // Owner's ID from auth middleware

    try {
        console.log(`[${req.requestId}] DELETE /api/rooms/:roomId hit for roomId: ${roomId}, user: ${userId}`);
        const roomToDelete = await Room.findOne({ roomId });
        if (!roomToDelete) {
            return res.status(404).json({ message: 'Room not found.' });
        }
        console.log(`[${req.requestId}] Found room to delete: ${roomToDelete.roomId}. Checking ownership.`);
        // Check if the requester is the owner of the room
        if (!roomToDelete.createdBy.equals(userId)) {
            return res.status(403).json({ message: 'You are not authorized to delete this room.' });
        }

        // Update all members (including owner) who were in this room
        const memberIds = roomToDelete.members.map(member => member._id);
        console.log(`[${req.requestId}] Clearing currentRoomId for ${memberIds.length} members.`);        
        await User.updateMany(
            { _id: { $in: memberIds } },
            { $set: { currentRoomId: null } }
        );

        // Specifically clear createdRoomId for the owner
        const owner = await User.findById(userId);
        console.log(`[${req.requestId}] Clearing createdRoomId for owner: ${owner.username}.`);
        if (owner) {
            owner.createdRoomId = null;
            // owner.currentRoomId is already set to null by the updateMany above if owner was in members
            await owner.save();
        }

        await Room.findByIdAndDelete(roomToDelete._id);
        console.log(`[${req.requestId}] Room document deleted from DB.`);

        // Emit an event to all connected clients that a room was deleted
        if (io) {
            console.log(`[${req.requestId}] Emitting 'room_deleted' event for roomId: ${roomToDelete.roomId}`);
            io.emit('room_deleted', { roomId: roomToDelete.roomId }); // Send the shareable roomId
            console.log(`[CONTROLLER] Emitted 'room_deleted' for roomId: ${roomToDelete.roomId}`);
        }

        res.status(200).json({ message: 'Room successfully deleted.' });
    } catch (error) {
        console.error("Error deleting room:", error);
        res.status(500).json({ message: 'Server error deleting room', error: error.message });
    }
};

// @desc    Get room details by shareable roomId
// @route   GET /api/rooms/:roomId
// @access  Public or Private (adjust as needed)
exports.getRoomDetails = async (req, res) => {
    console.log(`[${req.requestId}] GET /api/rooms/:roomId hit for roomId: ${req.params.roomId}`);
    try {
        const room = await Room.findOne({ roomId: req.params.roomId })
            .populate('createdBy', 'username')
            .populate('host', 'username')
            .populate('members', 'username');

        if (!room) {
            return res.status(404).json({ message: 'Room not found' });
            console.log(`[${req.requestId}] Room ${req.params.roomId} not found.`);
        }
        res.status(200).json(room);
    } catch (error) {
        console.error('Error fetching room details:', error);
        res.status(500).json({ message: 'Server error fetching room details' });
    }
};

// @desc    Get current user's room (either owned or joined)
// @route   GET /api/rooms/myroom
// @access  Private
exports.getMyRoom = async (req, res) => {
    console.log(`[${req.requestId}] GET /api/rooms/myroom hit for user: ${req.user ? req.user.username : 'UNKNOWN_USER'}`);
    try {
        const user = await User.findById(req.user._id); // Fetch user without populating yet
        if (!user) {
            console.log(`[${req.requestId}] User not found for /myroom`);
            return res.status(404).json({ message: 'User not found.' });
        }

        let roomInDetails = null;
        let ownsRoomId = user.createdRoomId ? user.createdRoomId.toString() : null;

        if (!user.currentRoomId) {
            console.log(`[${req.requestId}] User ${user.username} is not currently in any room.`);
            // User is not in a room, but might still own one.
            // If they own a room but are not in it, we might want to return that owned room's details.
            if (user.createdRoomId) {
                roomInDetails = await Room.findById(user.createdRoomId)
                    .populate('createdBy', 'username _id')
                    .populate('host', 'username _id')
                    .populate('members', 'username _id');
                console.log(`[${req.requestId}] User is not in a room, but owns room: ${roomInDetails ? roomInDetails.name : 'N/A (possibly stale createdRoomId)'}`);
            }
        } else {
            // User is in a room, fetch its details
            roomInDetails = await Room.findById(user.currentRoomId)
                .populate('createdBy', 'username _id')
                .populate('host', 'username _id')
                .populate('members', 'username _id');
            console.log(`[${req.requestId}] User is in room: ${roomInDetails ? roomInDetails.name : 'N/A (possibly stale currentRoomId)'}`);
        }
        
        res.status(200).json({ room: roomInDetails, createdRoomId: ownsRoomId });
    } catch (error) {
        console.error("Error fetching user's room:", error);
        res.status(500).json({ message: "Server error fetching user's room", error: error.message });
    }
};

// @desc    Get all active rooms
// @route   GET /api/rooms
// @access  Private (or Public, adjust as needed in routes)
exports.getAllRooms = async (req, res) => {
    console.log(`[${req.requestId}] GET /api/rooms hit for user: ${req.user ? req.user.username : 'UNKNOWN_USER'}`);
    try {
        const activeRooms = await Room.find()
            .populate('createdBy', 'username _id') // Ensure _id is populated for comparisons
            .populate('host', 'username');
        res.status(200).json(activeRooms);
    } catch (error) {
        console.error('Error fetching all rooms:', error);
        console.log(`[${req.requestId}] Error fetching all rooms.`);
        res.status(500).json({ message: 'Server error fetching rooms' });
    }
};