import React, { useState } from 'react';
import { useHistory } from 'react-router-dom';
import '../styles/Form.css'; // Import common form styles


const CreateRoomPage = () => {
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
        throw new Error(data.error || `Failed to create room (status: ${response.status})`);
      }

      if (data && data.roomId) {
        history.push(`/room/${data.roomId}`);
      } else {
        // This case should ideally not happen if response.ok is true and roomId is expected
        throw new Error('Room created but no roomId received.');
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