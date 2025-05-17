require('dotenv').config(); // This should be at the top

// console.log("-----------------------------------------------------");
// console.log("[SERVER STARTUP] Attempting to load .env variables...");
// console.log(`[SERVER STARTUP] process.env.PORT: ${process.env.PORT}`);
// console.log(`[SERVER STARTUP] process.env.MONGODB_URI: ${process.env.MONGODB_URI ? 'SET' : 'NOT SET or EMPTY'}`);
// console.log(`[SERVER STARTUP] process.env.JWT_SECRET: ${process.env.JWT_SECRET ? 'SET (length: ' + process.env.JWT_SECRET.length + ')' : 'NOT SET or EMPTY'}`);
// console.log(`[SERVER STARTUP] process.env.CORS_ORIGIN: ${process.env.CORS_ORIGIN}`);
// console.log("-----------------------------------------------------");

const express = require('express');
const http = require('http');
const cors = require('cors'); // Missing in original code
const connectDB = require('./config/db'); // Import DB connection
const authRoutes = require('./routes/authRoutes'); // Import auth routes
const initializeRoomRoutes = require('./routes/roomRoutes'); // <-- Rename to reflect it's a function
const { protect } = require('./middlewares/authMiddleware'); // Import protect middleware
const { scheduleRoomCleanup } = require('./jobs/roomCleanupJob'); // <-- IMPORT THE CLEANUP JOB SCHEDULER
const requestIdMiddleware = require('./middlewares/requestIdMiddleware'); // <-- Import request ID middleware
const jwt = require('jsonwebtoken'); // Import jsonwebtoken
const User = require('./models/User'); // Import User model
const Room = require('./models/Room'); // Import Room model
const { v4: uuidv4 } = require('uuid');
const roomController = require('./controllers/roomController'); // For reusable logic
const { Server } = require("socket.io");


// Connect to Database
connectDB();

const app = express();

// // Simple request logger middleware (can be re-enabled for debugging)
// app.use((req, res, next) => {
//   console.log(`[SERVER INCOMING REQUEST] ${req.method} ${req.originalUrl}`);
//   next();
// });

// CORS Configuration
const corsOptions = {
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000', // Fallback for dev
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true
};
app.use(cors(corsOptions));
app.use(express.json()); // Apply globally instead of per route

// --- ADD REQUEST ID MIDDLEWARE ---
app.use(requestIdMiddleware); // Add this middleware early

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000', // Fallback for dev
    methods: ["GET", "POST"]
  }
});

// Add this for low-level connection error debugging
io.engine.on("connection_error", (err) => {
  console.log("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
  console.log("[SERVER IO ENGINE ERROR] Low-level connection error detected:");
  console.log(`Error Code: ${err.code}`);       // e.g., 0, 1, 2, 3, 4, 5
  console.log(`Error Message: ${err.message}`); // e.g., "Transport unknown"
  console.log(`Error Context:`, err.context);   // Additional context, if any
  console.log("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
});


const PORT = process.env.PORT || 3001;

// In-memory store for current video state per room
const roomVideoStates = {};
const roomChatHistories = {}; // { roomId: [messageObject1, messageObject2, ...] }


// In-memory room store is now replaced by MongoDB
// const rooms = {};

app.get('/', (req, res) => {
  res.send('<h1>WatchParty Server</h1>');
});

// Initialize roomRoutes with io instance
const roomRouter = initializeRoomRoutes(io); // Call the function to get the router
// console.log('[SERVER STARTUP] roomRouter initialized. Type:', typeof roomRouter); // Optional: keep if you want to confirm router setup

app.use('/api/auth', authRoutes); // Mount auth routes
// --- MOUNT THE NEW ROOM ROUTES ---
app.use('/api/rooms', roomRouter); // Use the actual router instance


// Helper function to get room participants
const getRoomParticipants = (roomId) => {
  const room = io.sockets.adapter.rooms.get(roomId);
  if (!room) return [];
  const participants = [];
  // console.log(`[getRoomParticipants] Processing room: ${roomId}. Sockets in room: ${room ? [...room].join(', ') : 'N/A (room not found or empty)'}`);
  for (const socketId of room) {
    const participantSocket = io.sockets.sockets.get(socketId);
    // Log the raw user object attached to the socket, if it exists
    // console.log(`[getRoomParticipants] For socketId ${socketId}, participantSocket.user:`, participantSocket ? JSON.stringify(participantSocket.user) : 'Socket not found');
    if (participantSocket && participantSocket.user) {
      // Return user info if available on the socket
      participants.push({
        id: participantSocket.id, // Socket ID
        userId: participantSocket.user._id.toString(), // User ID as string
        username: participantSocket.user.username, // Username
      });
    } else {
      // Fallback to just socket ID if user info isn't attached (shouldn't happen with auth)
      participants.push({ id: socketId, username: 'Anonymous' });
    }
  }
  // console.log(`[getRoomParticipants] Final participants list for room ${roomId}:`, JSON.stringify(participants));
  return participants;
};

// Socket.IO connection
io.on('connection', (socket) => {
  // console.log("=====================================================");
  // console.log(`[SERVER IO] !!! NEW SOCKET CONNECTION ATTEMPT !!! Socket ID: ${socket.id}`);
  let { roomId, token } = socket.handshake.query; // Use let for roomId
  // console.log(`[SERVER IO] Handshake Query: roomId=${roomId}, token=${token ? 'PRESENT' : 'ABSENT'}`);
  // console.log(`[SERVER IO] JWT_SECRET available in this handler: ${process.env.JWT_SECRET ? 'YES' : 'NO!!!'}`);
  // console.log("=====================================================");

  // All connections require a token
  if (!token) {
    console.warn(`[SERVER IO] Socket ${socket.id} attempted to connect (room query: ${roomId || 'N/A'}) without a token. Disconnecting.`);
    socket.disconnect(true);
    return;
  }

  // Authenticate the socket connection using the token
  if (token) {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      console.error(`FATAL ERROR: JWT_SECRET is not defined. Socket ${socket.id} (room query: ${roomId || 'N/A'}) disconnected.`);
      socket.disconnect(true);
      return;
    }
    jwt.verify(token, secret, async (err, decoded) => { // Use the secret, avoid insecure fallback
      if (err) {
        console.warn(`[SERVER IO] Socket ${socket.id} (room query: ${roomId || 'N/A'}) failed token verification: ${err.message}. Disconnecting.`);
        socket.disconnect(true);
        return;
      } else {
        // Token is structurally valid and signature matches, now check user and proceed
        try {
          const user = await User.findById(decoded.id).select('-password');
          if (!user) {
            console.warn(`[SERVER IO] Socket ${socket.id} token valid, but user ${decoded.id} not found in DB. Disconnecting.`);
            socket.disconnect(true);
            return;
          } else {
            socket.user = user; // Attach user info to the socket instance
            // console.log(`[SERVER IO] User ${socket.user.username} (${socket.id}) authenticated. Room query: ${roomId || 'N/A (general connection)'}.`);
            
            if (roomId) { // This is a room-specific connection
              // console.log(`[SERVER IO] Proceeding to join room ${roomId} for user ${socket.user.username}.`);
              socket.join(roomId);
              // console.log(`[SERVER IO] User ${socket.user.username} (${socket.id}) has joined Socket.IO room: ${roomId}`);

            // IMMEDIATE TEST EMIT
            // socket.emit('direct_test_event', { message: `Hello from server to socket ${socket.id} in room ${roomId}` });
            // console.log(`[SERVER DEBUG] DIRECTLY EMITTED 'direct_test_event' to socket ${socket.id}`);

            // 2. Initialize or retrieve room state
            if (!roomVideoStates[roomId]) {
              const dbRoom = await Room.findOne({ roomId: roomId });
              if (dbRoom) {
                roomVideoStates[roomId] = {
                  hostId: socket.user._id.toString(), 
                  url: null, 
                  referenceTime: 0,
                  referenceTimestamp: Date.now(), 
                  isPlaying: false, 
                  lastActionBy: null, 
                  controllerIds: []
                };
                // console.log(`[SERVER] Initialized NEW room state for ${roomId} with host ${socket.user.username}:`, roomVideoStates[roomId]);
              } else {
                console.error(`[SERVER] DB Room ${roomId} not found for user ${socket.user.username}. Initializing fallback state.`);
                roomVideoStates[roomId] = { // Fallback
                  hostId: socket.user._id.toString(), url: null, referenceTime: 0,
                  referenceTimestamp: Date.now(), isPlaying: false, lastActionBy: null, controllerIds: []
                };
                // console.log(`[SERVER] Initialized FALLBACK room state for ${roomId} with host ${socket.user.username}:`, roomVideoStates[roomId]);
              }
            } else {
              // Existing room session, ensure state is complete (defensive) - your existing logic here is good
              let existingState = roomVideoStates[roomId];
              if (typeof existingState.url === 'undefined') existingState.url = null;
              if (typeof existingState.referenceTime === 'undefined') existingState.referenceTime = 0;
              if (typeof existingState.referenceTimestamp === 'undefined') existingState.referenceTimestamp = Date.now();
              if (typeof existingState.isPlaying === 'undefined') existingState.isPlaying = false;
              if (typeof existingState.hostId === 'undefined') {
                  const dbRoom = await Room.findOne({ roomId: roomId });
                  existingState.hostId = dbRoom ? dbRoom.host.toString() : socket.user._id.toString(); // Fallback
              }
              if (typeof existingState.controllerIds === 'undefined') existingState.controllerIds = [];
              roomVideoStates[roomId] = existingState;
              // console.log(`[SERVER] Using EXISTING room state for ${roomId} for user ${socket.user.username}:`, roomVideoStates[roomId]);
            }
            
            // 3. Prepare and broadcast sync_room_state
            if (roomVideoStates[roomId]) { // Ensure state exists before trying to use it
              let broadcastState = { ...roomVideoStates[roomId] };
              let timeToSyncAt = broadcastState.referenceTime;
              if (broadcastState.isPlaying && broadcastState.url) {
                const elapsedSeconds = (Date.now() - broadcastState.referenceTimestamp) / 1000;
                timeToSyncAt = broadcastState.referenceTime + elapsedSeconds;
              }
              broadcastState = {
                ...broadcastState,
                referenceTime: timeToSyncAt,
                isPlaying: false, // Always pause for new joiner sync
                referenceTimestamp: Date.now(),
                lastActionBy: { id: socket.user._id.toString(), username: `${socket.user.username} (joined)` } 
              };
              roomVideoStates[roomId] = broadcastState; // Update the authoritative state
              io.to(roomId).emit('sync_room_state', broadcastState);
              // console.log(`[SERVER] Room ${roomId} BROADCASTED sync state for user ${socket.user.username}. Sent state:`, broadcastState);
            }

            // 4. Broadcast update_participants
            const currentParticipants = getRoomParticipants(roomId);
            io.to(roomId).emit('update_participants', currentParticipants);
            // console.log(`[SERVER] BROADCASTED update_participants for room ${roomId}. Participants:`, currentParticipants.map(p => p.username));
            
            // DEBUG: Emit directly to the joining socket as well
            // socket.emit('update_participants', currentParticipants);
            // console.log(`[SERVER DEBUG] DIRECTLY EMITTED update_participants to socket ${socket.id} with data:`, JSON.stringify(currentParticipants));

            // 5. Send chat history
            socket.emit('chat_history', roomChatHistories[roomId] || []);
            // if (roomChatHistories[roomId]) {
                // console.log(`[SERVER] Sent chat history of ${roomChatHistories[roomId].length} messages to ${user.username} for room ${roomId}`);
            // } else {
                // console.log(`[SERVER] Sent empty chat history to ${user.username} for room ${roomId}`);
            // }
            
            // Specific event handlers for room-specific sockets go here
            // (e.g., send_message, load_video, etc. are already here and should remain within the if(roomId) block if they depend on it)
            } else { // No roomId in query - this is a general authenticated socket (e.g., for dashboard)
              // It's authenticated but not joined to a specific room via query.
              // console.log(`[SERVER IO] User ${socket.user.username} (${socket.id}) established a general authenticated connection.`);
              // No specific room joining actions here unless you want to add them to a "lobby" room.
            }

            // Define canControlVideo helper function within this scope
            const canControlVideo = (currentRoomId, currentUserId) => {
              const roomState = roomVideoStates[currentRoomId];
              return roomState && (roomState.hostId === currentUserId.toString() || (roomState.controllerIds && roomState.controllerIds.includes(currentUserId.toString())));
            };

            // Handle chat messages
            socket.on('send_message', (data) => {
              if (socket.user && data.room === roomId) {
                // console.log(`Message in room ${roomId} from ${socket.user.username}: ${data.text}`);
                const messageObject = {
                  text: data.text,
                  sender: { id: socket.user._id, username: socket.user.username },
                  timestamp: Date.now()
                };
                if (!roomChatHistories[roomId]) {
                  roomChatHistories[roomId] = [];
                }
                roomChatHistories[roomId].push(messageObject);
                io.to(roomId).emit('receive_message', messageObject);
              }
            });

            // Video control events
            socket.on('load_video', (data) => {
              if (socket.user && data.roomId === roomId && canControlVideo(roomId, socket.user._id)) {
                // console.log(`Video load request in room ${roomId} from ${socket.user.username} for URL: ${data.url}`);
                roomVideoStates[roomId] = {
                  ...roomVideoStates[roomId],
                  url: data.url,
                  referenceTime: 0,
                  isPlaying: false,
                  referenceTimestamp: Date.now(),
                  lastActionBy: { id: socket.user._id, username: socket.user.username }
                };
                io.to(roomId).emit('video_loaded', { url: data.url, requestedBy: { id: socket.user._id, username: socket.user.username } });
                io.to(roomId).emit('sync_room_state', roomVideoStates[roomId]);
                // console.log(`[SERVER] Room ${roomId} state updated after video load:`, roomVideoStates[roomId]);
              } else if (socket.user && data.roomId === roomId) {
                socket.emit('control_error', { message: 'Only the host or a controller can load videos.' });
              }
            });

            socket.on('video_play', (data) => {
              if (socket.user && data.roomId === roomId && canControlVideo(roomId, socket.user._id)) {
                const roomState = roomVideoStates[roomId];
                if (roomState && !roomState.isPlaying) {
                  roomVideoStates[roomId].isPlaying = true;
                  roomVideoStates[roomId].referenceTimestamp = Date.now();
                  roomVideoStates[roomId].lastActionBy = { id: socket.user._id, username: socket.user.username };
                  io.to(roomId).emit('sync_room_state', roomVideoStates[roomId]);
                } else if (roomState && roomState.isPlaying) {
                  io.to(roomId).emit('sync_room_state', roomVideoStates[roomId]);
                }
              } else if (socket.user && data.roomId === roomId) {
                socket.emit('control_error', { message: 'Only the host or a controller can control playback.' });
              }
            });

            socket.on('video_pause', (data) => {
              if (socket.user && data.roomId === roomId && canControlVideo(roomId, socket.user._id)) {
                const roomState = roomVideoStates[roomId];
                if (roomState && roomState.isPlaying) {
                  const elapsedSeconds = (Date.now() - roomState.referenceTimestamp) / 1000;
                  roomVideoStates[roomId].referenceTime = roomState.referenceTime + elapsedSeconds;
                  roomVideoStates[roomId].isPlaying = false;
                  roomVideoStates[roomId].referenceTimestamp = Date.now();
                  roomVideoStates[roomId].lastActionBy = { id: socket.user._id, username: socket.user.username };
                  io.to(roomId).emit('sync_room_state', roomVideoStates[roomId]);
                } else if (roomState && !roomState.isPlaying) {
                  io.to(roomId).emit('sync_room_state', roomVideoStates[roomId]);
                }
              } else if (socket.user && data.roomId === roomId) {
                socket.emit('control_error', { message: 'Only the host or a controller can control playback.' });
              }
            });

            socket.on('video_seek', (data) => {
              if (socket.user && data.roomId === roomId && canControlVideo(roomId, socket.user._id)) {
                const roomState = roomVideoStates[roomId];
                if (roomState) {
                  roomVideoStates[roomId].referenceTime = data.time;
                  roomVideoStates[roomId].referenceTimestamp = Date.now();
                  roomVideoStates[roomId].lastActionBy = { id: socket.user._id, username: socket.user.username };
                  io.to(roomId).emit('sync_room_state', roomVideoStates[roomId]);
                }
              } else if (socket.user && data.roomId === roomId) {
                socket.emit('control_error', { message: 'Only the host or a controller can control playback.' });
              }
            });

            // Handler for client explicitly requesting chat history (already present, good)
            socket.on('request_chat_history', (requestedRoomId) => {
              if (requestedRoomId === roomId && socket.user) {
                if (roomChatHistories[roomId]) {
                  socket.emit('chat_history', roomChatHistories[roomId]);
                } else {
                  socket.emit('chat_history', []);
                }
              }
            });

            // Handler for client requesting initial/current room state
            socket.on('request_room_state', (currentRoomId) => {
              if (currentRoomId === roomId && socket.user) {
                if (roomVideoStates[roomId]) {
                  socket.emit('sync_room_state', roomVideoStates[roomId]);
                }
                const currentParticipants = getRoomParticipants(roomId);
                socket.emit('update_participants', currentParticipants);
              }
            });

            // Host control permission events
            socket.on('grant_control_permission', (data) => {
              // data should contain { roomId, targetUserId }
              const roomState = roomVideoStates[roomId];
              if (socket.user && data.roomId === roomId && roomState?.hostId === socket.user._id.toString()) {
                if (!roomState.controllerIds) {
                  roomState.controllerIds = [];
                }
                if (data.targetUserId && !roomState.controllerIds.includes(data.targetUserId.toString())) {
                  roomState.controllerIds.push(data.targetUserId.toString());
                  // console.log(`[SERVER] User ${data.targetUserId} granted control in room ${roomId} by ${socket.user.username}. Controllers: ${roomState.controllerIds.join(', ')}`);
                  // Broadcast the updated state which includes the new controllerIds
                  io.to(roomId).emit('sync_room_state', roomState);
                }
              } else if (socket.user && data.roomId === roomId) {
                socket.emit('control_error', { message: 'Only the primary host can grant control permissions.' });
              } else {
                console.warn(`[SERVER] Grant control permission denied or room state not found for room ${roomId}`);
              }
            });

            socket.on('revoke_control_permission', (data) => {
              // data should contain { roomId, targetUserId }
              const roomState = roomVideoStates[roomId];
              if (socket.user && data.roomId === roomId && roomState?.hostId === socket.user._id.toString()) {
                if (roomState.controllerIds && data.targetUserId) {
                  const initialLength = roomState.controllerIds.length;
                  roomState.controllerIds = roomState.controllerIds.filter(id => id !== data.targetUserId.toString());
                  if (roomState.controllerIds.length < initialLength) {
                    // console.log(`[SERVER] User ${data.targetUserId} revoked control in room ${roomId} by ${socket.user.username}. Controllers: ${roomState.controllerIds.join(', ')}`);
                    // Broadcast the updated state
                    io.to(roomId).emit('sync_room_state', roomState);
                  }
                }
              } else if (socket.user && data.roomId === roomId) {
                socket.emit('control_error', { message: 'Only the primary host can revoke control permissions.' });
              } else {
                console.warn(`[SERVER] Revoke control permission denied or room state not found for room ${roomId}`);
              }
            });

            // Disconnect handler for ALL authenticated sockets (general or room-specific)
            socket.on('disconnect', (reason) => {
              const identifier = socket.user ? `${socket.user.username} (${socket.id})` : `Socket ${socket.id}`;
              // Use the roomId captured at connection time for this socket instance
              const connectionRoomId = socket.handshake.query.roomId; // This is the shareable UUID
              // console.log(`[SERVER IO] Authenticated user ${identifier} disconnected. Room query was: ${connectionRoomId || 'N/A'}. Reason: ${reason}`);
              if (connectionRoomId) { // If it was a room-specific connection, update participants for that room
                // Call the leave room logic
                // We need the user's ID (socket.user._id) and the shareable room ID (connectionRoomId)
                // Pass io to the logic function
                if (socket.user && socket.user._id) {
                    roomController.handleUserLeaveRoomLogic(socket.user._id, connectionRoomId, io)
                        // .then(result => console.log(`[SERVER IO] handleUserLeaveRoomLogic result for ${identifier} from room ${connectionRoomId}:`, result))
                        .catch(err => console.error(`[SERVER IO] Uncaught error in handleUserLeaveRoomLogic for ${identifier} from room ${connectionRoomId}:`, err));
                }
              }
            });
          }
        } catch (asyncOperationError) {
          // This catches errors from User.findById, socket.join, Room.findOne, or any other await inside this block
          console.error(`[SERVER IO] Error during async operations for user ${decoded?.id} (room query: ${roomId || 'N/A'}) after token verification:`, asyncOperationError);
          socket.disconnect(true); 
          return;
        }
      }
    });
  } else {
    // Decide how to handle connections without a token.
    // For a secure app, you usually want to disconnect them.
    console.warn(`[SERVER IO] Socket ${socket.id} attempted to connect (room query: ${roomId || 'N/A'}) without a token. Disconnecting.`);
    socket.disconnect(true);
    return;
  }

  // Add a general error handler for the socket
  socket.on('error', (err) => {
    console.error(`[SERVER] Socket ${socket.id} reported an error:`, err);
    // Depending on the error, you might want to disconnect the socket here as well
    // if (!socket.disconnected) {
    //   socket.disconnect(true);
    // }
  });

  // General disconnect handler (e.g., if auth fails or for unauthenticated sockets)
  socket.on('disconnect', (reason) => {
    // If socket.user is not attached, it means this socket didn't fully authenticate/join.
    const connectionRoomId = socket.handshake.query.roomId; // Get roomId from handshake for this specific socket
    // console.log(`[SERVER IO] Socket ${socket.id} (potentially unauthenticated or pre-join) disconnected. Room query: ${connectionRoomId || 'N/A'}. Reason: ${reason}`);
    // If it was in a room, update_participants would be handled by the specific disconnect if it fired,
    // or by Socket.IO's automatic room leaving. We can still broadcast an update if roomId is known.
    if (connectionRoomId) { // Use the specific roomId for this socket
        io.to(connectionRoomId).emit('update_participants', getRoomParticipants(connectionRoomId));
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server listening on *:${PORT}`);
  
  // Schedule background jobs
 // Modify scheduleRoomCleanup to pass io
  scheduleRoomCleanup(io); // <-- START THE ROOM CLEANUP JOB, PASSING IO
  
});

// Handle unhandled promise rejections (good practice)
process.on('unhandledRejection', (err, promise) => {
  console.error(`[SERVER] Unhandled Rejection: ${err.message}`, err);
  // Optionally close server: server.close(() => process.exit(1));
});