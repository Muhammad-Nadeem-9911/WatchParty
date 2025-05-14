import { useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';
const socketUrl = process.env.REACT_APP_WEBSOCKET_URL || 'ws://localhost:3001'; // Fallback for safety, prefer ws://

const useSocket = (roomId) => {
  const [connectedSocket, setConnectedSocket] = useState(null); // Renamed for clarity
  const socketRef = useRef(null);

  useEffect(() => {
    if (!roomId) {
      // If roomId is not provided, disconnect any existing socket
      if (socketRef.current) {
        console.log(`[useSocket] No roomId, disconnecting existing socket: ${socketRef.current.id}`);
        socketRef.current.disconnect();
        socketRef.current = null;
        setConnectedSocket(null);
      }
      return;
    }

    // If a socket connection already exists but for a different room, disconnect it
    if (socketRef.current && socketRef.current.query?.roomId !== roomId) {
      console.log(`[useSocket] RoomId changed. Disconnecting old socket: ${socketRef.current.id}`);
      socketRef.current.disconnect();
      socketRef.current = null;
      setConnectedSocket(null); // Ensure state is cleared
    }

    // Only create a new socket if one doesn't exist or if the previous one was for a different room
    // and has been cleaned up.
    if (!socketRef.current) {    
    const token = localStorage.getItem('watchPartyToken');
    console.log(`[useSocket] Creating new socket connection for room: ${roomId}`);
      const newSocket = io(socketUrl, {
      query: {
        roomId,
        token, // Send the JWT with the connection
      },
      transports: ['websocket'], // Force WebSocket transport
      upgrade: false // Disable upgrade from polling
    });
      socketRef.current = newSocket; // Store in ref immediately

newSocket.on('connect', () => {
        console.log(`[useSocket] Socket connected: ${newSocket.id} to room ${roomId}`);
        setConnectedSocket(newSocket); // Set state only AFTER successful connection
      });

      newSocket.on('disconnect', (reason) => {
        console.log(`[useSocket] Socket disconnected: ${newSocket.id} from room ${roomId}. Reason: ${reason}`);
        if (socketRef.current === newSocket) { // Ensure we are clearing the correct socket
          socketRef.current = null;
          setConnectedSocket(null);
        }
      });

      newSocket.on('connect_error', (error) => {
        console.error(`[useSocket] Connection Error for room ${roomId}:`, error);
        if (socketRef.current === newSocket) socketRef.current = null;
        setConnectedSocket(null); // Clear socket on connection error
      });
    }

    // Cleanup function
    return () => {
      if (socketRef.current) {
        console.log(`[useSocket] Cleanup: Disconnecting socket ${socketRef.current.id} from room ${roomId}`);
        socketRef.current.disconnect();
        socketRef.current = null;
        setConnectedSocket(null); // Ensure state is also cleared on unmount or roomId change
      }
    };
  }, [roomId]); // Re-run effect if roomId changes

  return connectedSocket; // Return the socket state that's set on 'connect'
};

export default useSocket;
