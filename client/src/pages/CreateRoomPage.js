import React, { useState } from 'react';
import { useHistory } from 'react-router-dom';
import '../styles/Form.css'; // Import common form styles

import { useNotification } from '../contexts/NotificationContext'; // Import useNotification
const CreateRoomPage = () => {
  const { addNotification } = useNotification(); // <-- Call the hook here, at the top level
  const [roomName, setRoomName] = useState('');
  const [error, setError] = useState('');
  const history = useHistory();

  const handleCreateRoom = async (e) => {
    e.preventDefault();
    setError('');
    if (!roomName.trim()) {
      alert('Please enter a room name.');
      return;
    }

    const token = localStorage.getItem('watchPartyToken');
    if (!token) {
      setError('You must be logged in to create a room.');
      // Optionally redirect to login or show a more prominent message
      history.push('/login');
      return;
    }

    try {
      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001';

        const response = await fetch(`${apiUrl}/api/rooms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ roomName }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Handle error responses
        if (data.message === "You are already in a room. Please leave it before creating a new one.") {
          addNotification("You can't create a new room while you are already in another room. Please leave the current room first.", 'warning');
        } else {
          // For other errors, show a generic failure notification
          addNotification(data.message || `Failed to create room (status: ${response.status})`, 'error');        
        }
      // IMPORTANT: Stop processing here if the response was not OK
        return;
    }
      // If response.ok is true, proceed with the success path
      if (data && data.roomId) {
        history.push(`/room/${data.roomId}`); // Navigate on successful creation

      }
    } catch (err) {
      console.error('Error creating room:', err);
      setError(err.message);
    }
  };


  return (
    <div className="formContainer">
      <h2>Create a New Watch Party Room</h2>
      {error && <p className="formError">{error}</p>}
      <form onSubmit={handleCreateRoom}>
        <div className="formGroup">
          <label htmlFor="roomName">Room Name:</label>
          <input
            className="formInput"
            type="text"
            id="roomName"
            value={roomName}
            onChange={(e) => setRoomName(e.target.value)}
            required
          />
        </div>
        <button type="submit" className="formButton">Create Room</button>
      </form>
    </div>
  );
};


export default CreateRoomPage;