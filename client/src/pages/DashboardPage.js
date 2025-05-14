import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom'; // Import Link for navigation
import './DashboardPage.css'; // Import the CSS file
import { FaTrash } from 'react-icons/fa'; // Icon for delete button
import { useNotification } from '../contexts/NotificationContext'; // Import useNotification
import ConfirmModal from '../components/common/ConfirmModal'; // Import the modal

const DashboardPage = () => {
  const [availableRooms, setAvailableRooms] = useState([]);
  const [isLoadingRooms, setIsLoadingRooms] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const { addNotification } = useNotification();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [roomIdToDelete, setRoomIdToDelete] = useState(null);


  useEffect(() => {
    const fetchAvailableRooms = async () => {
      // Get current user info from localStorage to compare with room creator
      const storedUser = localStorage.getItem('watchPartyUser');
      if (storedUser) {
        // Assuming watchPartyUser stores { username: '...', id: '...' }
        // If not, we might need to fetch /api/auth/me here or ensure login stores ID
        // For now, we'll rely on the ID coming from the /api/rooms 'createdById' field
        // and compare it with the ID of the user who is logged in.
        // A better approach would be to have the user's ID readily available in a context or from /me
      }

      setIsLoadingRooms(true);
      try {
        const token = localStorage.getItem('watchPartyToken');
        if (!token) {
          // If no token, user is not logged in (should be handled by App.js routing,
          // but good to have a fallback or log here)
          console.warn('No token found, cannot fetch rooms.');
          setIsLoadingRooms(false);
          return;
        }
        const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001';
        const response = await fetch(`${apiUrl}/api/rooms`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        if (response.ok) {
          const data = await response.json();
          setAvailableRooms(data);
        } else {
          console.error('Failed to fetch available rooms:', response.statusText);
        }
      } catch (error) {
        console.error('Error fetching available rooms:', error);
      } finally {
        setIsLoadingRooms(false);
      }
    };

    fetchAvailableRooms();
  }, []);

  // Fetch current user's full details (including ID) if not already available
  // This is a more robust way to get the current user's ID for comparison
  useEffect(() => {
    const fetchCurrentUser = async () => {
      const token = localStorage.getItem('watchPartyToken');
      if (token && !currentUser) { // Fetch only if token exists and currentUser is not set
        const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001';
    const response = await fetch(`${apiUrl}/api/auth/me`, { 
      headers: { 'Authorization': `Bearer ${token}` }
      });
        if (response.ok) {
          const result = await response.json();
          setCurrentUser(result.data); // result.data should contain { _id, username, email }
        }
      }
    };
    fetchCurrentUser();
  }, [currentUser]); // Re-fetch if currentUser changes (e.g. on login/logout, though App.js handles that)

  const openDeleteConfirmModal = (roomId) => {
    setRoomIdToDelete(roomId);
    setIsModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!roomIdToDelete) return;
    setIsModalOpen(false); // Close modal immediately
    try {
      const token = localStorage.getItem('watchPartyToken');
       const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001';
       const response = await fetch(`${apiUrl}/api/rooms/${roomIdToDelete}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to delete room');
      }
      // Refresh the list of rooms
      setAvailableRooms(prevRooms => prevRooms.filter(room => room.id !== roomIdToDelete)); // Use the captured roomIdToDelete
      addNotification('Room deleted successfully!', 'success');
    } catch (error) {
      console.error('Error deleting room:', error);
      addNotification(`Error: ${error.message}`, 'error');
    }
    setRoomIdToDelete(null); // Reset after action
  };

  return (
    <div className="dashboardContainer">
      <header className="dashboardHeader">
        <h2>User Dashboard</h2>
        <p>Welcome, {currentUser?.username || 'User'}! Manage your rooms and profile here.</p>
      </header>
      
      <div className="dashboardActions">
        <Link to="/room/create" className="dashboardButton">
          Create a New Room
        </Link>
        
      </div>
      <h3 className="roomsSectionHeader">Available Rooms</h3>
      {isLoadingRooms ? <p>Loading rooms...</p> : (
        availableRooms.length > 0 ? (
          <ul className="roomList">
            {availableRooms.map(room => (
              <li key={room.id} className="roomListItem">
                <div>
                  <Link to={`/room/${room.id}`} className="roomLink">{room.name}</Link>
                  <span className="roomMeta">(Created by: {room.createdByUsername})</span>
                </div>
                {currentUser && room.createdById === currentUser._id && (
                  <button onClick={() => openDeleteConfirmModal(room.id)} className="deleteRoomButton" title="Delete Room">
                    <FaTrash />
                  </button>
                )}
              </li>
            ))}
          </ul>
        ) : <p>No active rooms. Why not create one?</p>
      )}
      <ConfirmModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Delete Room"
        message={`Are you sure you want to delete this room? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
      />
    </div>
  );
};

export default DashboardPage;