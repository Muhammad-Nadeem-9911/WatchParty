import React, { useState, useEffect, useCallback } from 'react'; // Import useCallback
import { useParams, useHistory } from 'react-router-dom'; // Import useHistory

import VideoPlayerWrapper from '../components/room/VideoPlayerWrapper';
import ChatWindow from '../components/room/ChatWindow';
import ParticipantList from '../components/room/ParticipantList';
import RoomControls from '../components/room/RoomControls';
import { useNotification } from '../contexts/NotificationContext'; // For notifications
import ConfirmModal from '../components/common/ConfirmModal'; // Import the modal
import useSocket from '../hooks/useSocket'; // Import the custom hook
// Import the CSS for RoomPage layout
import './RoomPage.css'; 

const RoomPage = ({ currentUser }) => { // Accept currentUser as a prop
  const { roomId } = useParams(); // Get roomId from URL parameters
  const socket = useSocket(roomId); // Initialize socket connection for this room
  const history = useHistory(); // For navigation
  const [roomName, setRoomName] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const currentUserId = currentUser?.id; // Use the standardized 'id' property
  const [roomHostId, setRoomHostId] = useState(null); // Track the host ID
  const { addNotification } = useNotification();
  const [isEndRoomModalOpen, setIsEndRoomModalOpen] = useState(false); // State for the modal

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
          if (data.host && data.host._id) {
            setRoomHostId(data.host._id);
          } else {
            console.warn('[RoomPage] Host ID not found in fetched room details.');
          }
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

  // Memoize handleLeaveRoom as it's used in a useEffect dependency array
  const handleLeaveRoom = useCallback(async (roomAlreadyGone = false) => {
    if (!roomAlreadyGone) { // Only make API call if room isn't known to be gone
      const token = localStorage.getItem('watchPartyToken'); // Get token inside async function
      if (!token) {
        addNotification('Authentication error.', 'error');
        history.push('/login');
        return;
      }
      try {
        const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001';
        const response = await fetch(`${apiUrl}/api/rooms/${roomId}/leave`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
        });
        const data = await response.json();
        if (!response.ok) {
          // If the room was deleted by host, this might return 404, which is fine.
          // We still want to navigate away.
          console.warn(`Attempt to leave room ${roomId} failed (possibly already deleted): ${data.message}`);
          // Don't throw an error that stops navigation if the goal is just to leave.
        }
        addNotification('You have left the room.', 'success');
      } catch (err) {
        console.error('Error leaving room via API:', err);
        addNotification(err.message || 'Could not leave room via API.', 'error');
        // Still attempt to navigate even if API call fails, as user wants to leave the page.
      }
    } else {
      // If roomAlreadyGone is true, we just proceed to navigate.
      // The alert "The room has been ended by the host." was already shown.
    }
      history.push('/dashboard');
  }, [roomId, history, addNotification]); // Dependencies for handleLeaveRoom

  // Socket.IO Listeners for RoomPage (attached as soon as socket state is available)
  useEffect(() => {
    // This effect runs whenever the 'socket' object changes (becomes available or changes)
    if (socket) {

      // Define handleRoomDeleted inside useEffect to capture current currentUser and roomHostId
      const handleRoomDeleted = ({ roomId: deletedRoomId }) => {
        if (deletedRoomId === roomId) {
          // The room this user is currently in has been deleted
          // If not the host, set a flag so dashboard can show notification
          if (!(currentUser && roomHostId && currentUser.id === roomHostId)) {
            localStorage.setItem('watchPartyRoomEndedByHost', 'true');
            // No alert here, dashboard will handle it.
          } else {
            // Host deleted the room, no special flag needed for them.
          }
          // Automatically trigger the leave room logic for this user (host or participant)
          // This will clear their currentRoomId and navigate them away
          // Pass true for roomAlreadyGone so handleLeaveRoom skips the API call.
          handleLeaveRoom(true); // Pass true for roomAlreadyGone
        }
      };

      socket.on('room_deleted', handleRoomDeleted);

      return () => {
          // Detach listeners on cleanup
          socket.off('room_deleted', handleRoomDeleted); // Detach 'room_deleted' listener here
        };
      }
  }, [socket, currentUser, roomHostId, roomId, handleLeaveRoom]); // Correct dependencies

  const handleEndRoom = async () => {
    // This function is only visible to the host
    const token = localStorage.getItem('watchPartyToken'); // Get token inside async function
    if (!token) {
      addNotification('Authentication error.', 'error');
      history.push('/login');
      return;
    }
    // Open the confirmation modal instead of window.confirm
    setIsEndRoomModalOpen(true);
  };

  const confirmEndRoom = async () => {
    setIsEndRoomModalOpen(false); // Close modal
    const token = localStorage.getItem('watchPartyToken'); // Token needed again for the actual action
    // Note: Token check already done in handleEndRoom before opening modal, but good for safety.

    try {
      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001';
      const response = await fetch(`${apiUrl}/api/rooms/${roomId}`, { // DELETE request
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Failed to end room');
      }
      // Backend delete logic handles clearing user statuses and emitting socket event
      // The socket event listener will handle navigation for all users (including host)
    } catch (err) {
      console.error('Error ending room:', err);
      addNotification(err.message || 'Could not end room.', 'error');
    }
  };

  return (
    <div className="roomPageContainer">
      <header className="roomPageHeader">
        {isLoading ? (
          <h2>Loading room...</h2>
        ) : (
          <h2>{roomName || `Room: ${roomId}`}</h2>
        )}
        <div className="roomPageHeaderButtons"> {/* Wrapper for buttons */}
          {/* Show End Room button for the host, Leave Room for others */}
          {currentUser && roomHostId && currentUser.id === roomHostId ? (
            <button onClick={handleEndRoom} className="endRoomButton">End Room</button>
          ) : (
            <button onClick={handleLeaveRoom} className="leaveRoomButton">Leave Room</button>
          )}
        </div>
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

      <ConfirmModal
        isOpen={isEndRoomModalOpen}
        onClose={() => setIsEndRoomModalOpen(false)}
        onConfirm={confirmEndRoom} // Call the actual deletion logic
        title="End Room"
        message="Are you sure you want to end this room? This action will close the room for all participants and cannot be undone."
        confirmText="Yes, End Room"
        cancelText="Cancel"
      />
    </div>
  );
};

export default RoomPage;