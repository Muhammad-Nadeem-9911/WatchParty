const express = require('express');
const roomController = require('../controllers/roomController'); // Import the whole controller

module.exports = (io) => {
    const router = express.Router();
    const { protect } = require('../middlewares/authMiddleware');

    // Pass io to controller methods that need it
    router.get('/', protect, roomController.getAllRooms);
    
    // Modify the createRoom route to pass io
    router.post('/', protect, (req, res) => {
        roomController.createRoom(req, res, io);
    });
    
    router.get('/myroom', protect, roomController.getMyRoom);
    router.get('/:roomId', roomController.getRoomDetails); // Assuming getRoomDetails doesn't need io
    router.post('/:roomId/join', protect, roomController.joinRoom); // Assuming joinRoom doesn't need io for global emit
    
    router.post('/:roomId/leave', protect, (req, res) => {
        roomController.leaveRoom(req, res, io);
    });
    
    // Modify the deleteRoom route to pass io
    router.delete('/:roomId', protect, (req, res) => {
        // Call the controller function, passing req, res, and io
        roomController.deleteRoom(req, res, io);
    });

    return router;
};