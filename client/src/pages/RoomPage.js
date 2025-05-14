import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';

import VideoPlayerWrapper from '../components/room/VideoPlayerWrapper';
import ChatWindow from '../components/room/ChatWindow';
import ParticipantList from '../components/room/ParticipantList';
import RoomControls from '../components/room/RoomControls';
import useSocket from '../hooks/useSocket'; // Import the custom hook
// Import the CSS for RoomPage layout
import './RoomPage.css'; 

const RoomPage = ({ currentUser }) => { // Accept currentUser as a prop
  const { roomId } = useParams(); // Get roomId from URL parameters
  const socket = useSocket(roomId); // Initialize socket connection for this room
  const [roomName, setRoomName] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const currentUserId = currentUser?.id; // Use the standardized 'id' property

  useEffect(() => {
    const fetchRoomDetails = async () => {
      try {
        const token = localStorage.getItem('watchPartyToken');
        if (!token) {
          console.warn('No token found, cannot fetch room details.');
          // This should ideally be handled by App.js routing, but as a fallback:
          setRoomName('Access Denied');
          setIsLoading(false);
          return;
        }
        const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001';
        const response = await fetch(`${apiUrl}/api/rooms/${roomId}`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (response.ok) {
          const data = await response.json();
          setRoomName(data.name);
        } else {
          console.error('Failed to fetch room details:', response.statusText);
          setRoomName('Unknown Room'); // Fallback name
        }
      } catch (error) {
        console.error('Error fetching room details:', error);
        setRoomName('Error Loading Room'); // Fallback name
      } finally {
        setIsLoading(false);
      }
    };

    if (roomId) {
      fetchRoomDetails();
    }
  }, [roomId]);

  // DEBUG: Listen for events directly in RoomPage on the socket from useSocket
  useEffect(() => {
    if (socket) {
      const directTestListener = (eventName, ...args) => {
        console.log(`%c[RoomPage DEBUG SOCKET (${socket.id})] Event Received: "${eventName}"`, 'color: green; font-weight: bold;', 'Data:', ...args);
      };
      socket.onAny(directTestListener);
      console.log(`[RoomPage DEBUG SOCKET (${socket.id})] Attached onAny listener in RoomPage.`);

      return () => {
        socket.offAny(directTestListener);
        console.log(`[RoomPage DEBUG SOCKET (${socket.id})] Detached onAny listener in RoomPage.`);
      };
    }
  }, [socket]); // Re-run if the socket instance changes

  return (
    <div className="roomPageContainer">
      <header className="roomPageHeader">
        {isLoading ? (
          <h2>Loading room...</h2>
        ) : (
          <h2>{roomName || `Room: ${roomId}`}</h2>
        )}
        {/* You can add more details here like Room ID or created by if needed */}
        {/* <p>Room ID: {roomId}</p> */}
      </header>

      {/* Only render layout if not loading and socket is available */}
      {!isLoading && socket && (
        <div className="roomLayout">
          <div className="mainContent">

            <VideoPlayerWrapper socket={socket} roomId={roomId} currentUserId={currentUserId} />
            <RoomControls socket={socket} roomId={roomId} currentUserId={currentUserId} />
          </div>
          <aside className="sidebar">
            <ParticipantList socket={socket} roomId={roomId} currentUserId={currentUserId} />
            <ChatWindow socket={socket} roomId={roomId} currentUserId={currentUserId} />
        </aside>
      </div>
      )}
      {/* If socket is not yet available after loading, you might show a connecting message */}
      {!isLoading && !socket && <p>Connecting to room services...</p>}
    </div>
  );
};

export default RoomPage;