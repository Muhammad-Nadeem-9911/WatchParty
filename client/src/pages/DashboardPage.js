import React, { useState, useEffect, useRef } from 'react'; // Import useRef
import { Link, useHistory } from 'react-router-dom'; // Import Link and useHistory for navigation
import './DashboardPage.css'; // Import the CSS file
import { FaTrash } from 'react-icons/fa'; // Icon for delete button
import { useNotification } from '../contexts/NotificationContext'; // Import useNotification
import ConfirmModal from '../components/common/ConfirmModal'; // Import the modal
import io from 'socket.io-client'; // Import socket.io-client

const DashboardPage = () => {
  const [myRoom, setMyRoom] = useState(null);
  const [otherRooms, setOtherRooms] = useState([]);
  const [userOwnedRoomId, setUserOwnedRoomId] = useState(null); // To track if user owns a room, even if not in it
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const { addNotification } = useNotification();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const history = useHistory(); // Get history object for navigation
  const dashboardSocketRef = useRef(null); // Use useRef for the socket instance
  // No need for roomIdToDelete state if we are always deleting `myRoom`

  useEffect(() => {
    // This effect handles all initial data loading for the dashboard.
    let isMounted = true;
    setIsLoading(true); // Set loading true at the start of data fetching sequence

    const fetchInitialDashboardData = async () => {
      const token = localStorage.getItem('watchPartyToken');
      if (!token) {
        console.log('[DashboardPage] No token found. Setting loading to false.');
        if (isMounted) {
          setCurrentUser(null);
          setMyRoom(null);
          setOtherRooms([]);
          setIsLoading(false);
        }
        return;
      }

      let fetchedUser = null;
      try {
        // 1. Fetch Current User
        const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001';
        const userResponse = await fetch(`${apiUrl}/api/auth/me`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });

        if (userResponse.ok) {
          const result = await userResponse.json();
          fetchedUser = result.data;
          if (isMounted) setCurrentUser(fetchedUser);
        } else {
          console.log('[DashboardPage] User fetch failed (not ok). Setting loading to false.');
          console.error("Failed to fetch current user, response not ok:", userResponse.status);
          if (isMounted) {
            localStorage.removeItem('watchPartyToken');
            localStorage.removeItem('watchPartyUser');
            setCurrentUser(null);
            setMyRoom(null);
            setOtherRooms([]);
            setUserOwnedRoomId(null);
            setIsLoading(false); // Stop if user fetch fails
          }
          return; // Don't proceed
        }
      } catch (err) {
        console.error("Error fetching current user:", err);
        console.log('[DashboardPage] User fetch error. Setting loading to false.');
        if (isMounted) {
          localStorage.removeItem('watchPartyToken');
          localStorage.removeItem('watchPartyUser');
          setCurrentUser(null);
          setMyRoom(null);
          setOtherRooms([]);
          setIsLoading(false); // Stop on error
        }
        return; // Don't proceed
      }

      // Crucial check: if fetchedUser is null/undefined after API call, stop and set loading false.
      if (!fetchedUser) {
        console.log('[DashboardPage] fetchedUser is null after API call (e.g., token valid, but no user data). Setting loading to false.');
        if (isMounted) setIsLoading(false);
        return;
      }

      // 2. If user fetch was successful, fetch dashboard room data
      if (fetchedUser && isMounted) {
        const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001';
        let currentRoomDataForFiltering = null; // For filtering otherRooms
        try {
          console.log('[DashboardPage] Attempting to fetch /api/rooms/myroom...');
          // Fetch my current room
          const myRoomResponse = await fetch(`${apiUrl}/api/rooms/myroom`, {
            headers: { 'Authorization': `Bearer ${token}` },
          });
          console.log('[DashboardPage] Fetched /api/rooms/myroom. Status:', myRoomResponse.status);
          if (myRoomResponse.ok) {
            const myRoomResult = await myRoomResponse.json();
            if (isMounted) setUserOwnedRoomId(myRoomResult.createdRoomId); // Store the ID of the room they own
            if (myRoomResult.room) {
              currentRoomDataForFiltering = myRoomResult.room;
              // Set myRoom only if they are currently IN the room they created
              if (fetchedUser && myRoomResult.room.createdBy._id === fetchedUser._id) {
                if (isMounted) setMyRoom(myRoomResult.room);
              } else {
                // They are in a room, but it's not one they created (e.g., joined someone else's)
                // or the room data from /myroom is for their created room but they are not "in" it.
                if (isMounted) setMyRoom(null);
              }
            } else {
              if (isMounted) setMyRoom(null);
            }
          } else {
            console.error('Failed to fetch my room:', await myRoomResponse.text());
            if (isMounted) setMyRoom(null);
          }

          console.log('[DashboardPage] Attempting to fetch /api/rooms...');
          // Fetch all rooms for "other rooms" section
          const allRoomsResponse = await fetch(`${apiUrl}/api/rooms`, {
            headers: { 'Authorization': `Bearer ${token}` },
          });
          console.log('[DashboardPage] Fetched /api/rooms. Status:', allRoomsResponse.status);
          if (allRoomsResponse.ok) {
            const allRoomsData = await allRoomsResponse.json();
            const filteredRooms = allRoomsData.filter(r => {
              const isMyCreation = fetchedUser ? r.createdBy._id === fetchedUser._id : false;
              const isMyCurrentRoom = currentRoomDataForFiltering ? r._id === currentRoomDataForFiltering._id : false;
              return !isMyCreation && !isMyCurrentRoom;
            });
            if (isMounted) setOtherRooms(filteredRooms);
          } else {
            console.error('Failed to fetch all rooms:', await allRoomsResponse.text());
            if (isMounted) setOtherRooms([]);
          }
        } catch (dashboardError) {
          console.error('Error fetching dashboard room data:', dashboardError);
          if (isMounted) addNotification('Could not load dashboard room data.', 'error');
        } finally {
          console.log('[DashboardPage] Room data fetch sequence finished. Setting loading to false.');
          if (isMounted) setIsLoading(false); // All initial data fetching attempts are done
        }
      } else if (isMounted) { // Case: fetchedUser was valid, but we didn't proceed to room fetch (e.g. isMounted became false, though unlikely here)
        console.log('[DashboardPage] fetchedUser was valid, but not proceeding to room fetch. Setting loading to false.');
        setIsLoading(false);
      }
    }; // end of fetchInitialDashboardData
    fetchInitialDashboardData();

    return () => {
      isMounted = false;
    };
  }, [addNotification]); // Runs once on mount (addNotification is stable)

  // Effect to check for room ended by host message
  useEffect(() => {
    const roomEndedByHost = localStorage.getItem('watchPartyRoomEndedByHost');
    if (roomEndedByHost === 'true') {
      addNotification("The room you were in was ended by the host.", 'info');
      localStorage.removeItem('watchPartyRoomEndedByHost'); // Clear the flag
    }
  }, [addNotification]); // Runs once on mount (addNotification is stable)

  useEffect(() => {
    // Effect for general dashboard socket connection
      // This effect manages the socket instance lifecycle and its listeners.

    const token = localStorage.getItem('watchPartyToken');

    // Condition to establish/maintain socket: token and currentUser must exist.
    if (!token || !currentUser) {
    // If socket exists but conditions are no longer met, disconnect it.
      if (dashboardSocketRef.current) {        
        console.log('[DashboardPage] No token or currentUser, disconnecting existing dashboard socket.');
        dashboardSocketRef.current.disconnect();
        dashboardSocketRef.current = null; // Clear the ref

      }
      return;
    }

    // Condition to create socket: token and currentUser exist, AND no socket exists in the ref.
    if (!dashboardSocketRef.current) {
      console.log('[DashboardPage] Token and currentUser exist, creating new dashboard socket.');
      const newSocketInstance = io(process.env.REACT_APP_API_URL || 'http://localhost:3001', {
        query: { token } // Send token for authentication of this general socket
      });
      dashboardSocketRef.current = newSocketInstance; // Store the new instance in the ref

    }

    // At this point, dashboardSocketRef.current should hold a valid socket instance.
    const socket = dashboardSocketRef.current; // Use the instance from the ref
    console.log('[DashboardPage] Attaching listeners to dashboard socket:', socket.id);

    const handleConnect = () => {
      console.log('[DashboardPage] General dashboard socket connected:', socket.id);
    };

    const handleRoomDeleted = ({ roomId: deletedRoomId }) => {
      console.log('[DashboardPage] Received room_deleted event for roomId:', deletedRoomId);
      // Update myRoom state - check if the deleted room was the one I created
      // Also check if the deleted room was the one the user owned
      setMyRoom(prevMyRoom => {
        if (prevMyRoom && prevMyRoom.roomId === deletedRoomId) {
          return null;
        }
        return prevMyRoom;
      });
      setUserOwnedRoomId(prevOwnedId => {
        if (prevOwnedId && myRoom?.roomId === deletedRoomId) { // If myRoom (which implies ownership for display) matches
          return null;
        }
        return prevOwnedId; // Use prevOwnedId here, not prevMyRoom
      });
      // Update otherRooms state - filter out the deleted room
      setOtherRooms(prevOtherRooms => prevOtherRooms.filter(room => room.roomId !== deletedRoomId));
    };

    const handleRoomCreated = (newlyCreatedRoom) => {
      console.log('[DashboardPage] Received room_created event:', newlyCreatedRoom);
      // Check if the current user created this room (currentUser is from state, captured by effect closure)
      if (currentUser && newlyCreatedRoom.createdBy._id === currentUser._id) {
        // If it's my room, set it as myRoom
        setMyRoom(newlyCreatedRoom);
      } else {
        // If it's someone else's room, add it to otherRooms
        // Filter out any existing room with the same ID just in case (shouldn't happen with unique IDs)
        setOtherRooms(prevOtherRooms => [
          newlyCreatedRoom,
          ...prevOtherRooms.filter(r => r.roomId !== newlyCreatedRoom.roomId)
        ]);      }
    };

        const handleUserRoomStatusChanged = ({ userId: changedUserId, currentRoomId: newCurrentRoomId }) => {
      console.log(`[DashboardPage] Received user_room_status_changed for user ${changedUserId}, new currentRoomId: ${newCurrentRoomId}`);
      if (currentUser && currentUser._id === changedUserId) {
        // This is an update for the currently logged-in user
        if (!newCurrentRoomId) {
          // User left their current room.
          // If the room they left was the one they created and were viewing in "My Room", clear myRoom.
          // They might still own a room (userOwnedRoomId will persist unless a delete event comes).
          setMyRoom(prevMyRoom => {
            if (prevMyRoom && prevMyRoom.createdBy._id === changedUserId) { // Compare with changedUserId
              return null;
            }
            return prevMyRoom;
          });
        } else {
          // User joined a new room. The /myroom fetch on next load or a specific "room_joined_details" event
          // would be needed to update `myRoom` state with the new room's full details.
          // For now, this event primarily signals they are no longer in the *previous* room if `myRoom` was set.
        } // Closes the else block
      }
    };

    socket.on('connect', handleConnect);
    socket.on('room_deleted', handleRoomDeleted);
    socket.on('room_created', handleRoomCreated);

    socket.on('user_room_status_changed', handleUserRoomStatusChanged);

    // Cleanup function: Remove listeners and disconnect socket when dependencies change or component unmounts.
    return () => {
      console.log('[DashboardPage] Cleaning up listeners and potentially disconnecting socket:', socket.id);
      if (socket) { // Ensure socket exists before trying to call methods on it
        socket.off('connect', handleConnect);
        socket.off('room_deleted', handleRoomDeleted);
        socket.off('room_created', handleRoomCreated);
        socket.off('user_room_status_changed', handleUserRoomStatusChanged);

      }
      // The socket is disconnected by the logic at the top of the effect if token/currentUser becomes invalid.
      // If the component unmounts while token/currentUser are still valid, we should disconnect.
      if (dashboardSocketRef.current === socket) { // Check if it's the same socket we are cleaning up for
         socket.disconnect();
         dashboardSocketRef.current = null; // Clear the ref after disconnecting
      }
    };
  }, [currentUser, addNotification]); // Reworked dependencies, socket instance managed by ref

  const handleJoinRoom = async (roomIdToJoin) => { // roomIdToJoin is the shareable UUID
    console.log(`[DashboardPage] Attempting to join room with shareable ID: ${roomIdToJoin}`);
    const token = localStorage.getItem('watchPartyToken');
    if (!token) {
      addNotification('You must be logged in to join a room.', 'error');
      history.push('/login'); // Redirect to login if no token
      return;
    }

    try {
      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001';
      const response = await fetch(`${apiUrl}/api/rooms/${roomIdToJoin}/join`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || `Failed to join room (status: ${response.status})`);
      }
    // If successful, navigate to the room
      addNotification(data.message || 'Successfully joined room!', 'success');
      history.push(`/room/${roomIdToJoin}`);
    } catch (err) {
      console.error(`[DashboardPage] Error joining room ${roomIdToJoin}:`, err);
      addNotification(err.message || 'Could not join room.', 'error');
    }
  };

  const handleConfirmDeleteMyRoom = async () => { // This function handles confirming deletion of MY room
    if (!myRoom || !myRoom.roomId) return; // myRoom.roomId is the shareable UUID
    setIsModalOpen(false); // Close modal immediately
    try {
      const token = localStorage.getItem('watchPartyToken');
       const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001';
       const response = await fetch(`${apiUrl}/api/rooms/${myRoom.roomId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok) { // Check only response.ok for success status (2xx)
        throw new Error(data.message || 'Failed to delete room');
      }
      setMyRoom(null); // Clear the deleted room from state
      setUserOwnedRoomId(null); // Also clear the owned room ID state
      addNotification('Room deleted successfully!', 'success');

      // Optionally, re-fetch otherRooms or trigger a full data refresh if needed
    } catch (error) {
      console.error('Error deleting room:', error);
      addNotification(`Error: ${error.message}`, 'error');
    }
  };

  const openDeleteConfirmModal = (roomId) => {
    // We will always delete `myRoom` if this modal is for it.
    setIsModalOpen(true);
  };
  // Log the state right before rendering to understand what the UI will show
  console.log('[DashboardPage RENDER] isLoading:', isLoading, 'currentUser:', currentUser?.username, 'myRoom:', myRoom?.name, 'userOwnedRoomId:', userOwnedRoomId, 'otherRooms count:', otherRooms.length);
  return (
    <div className="dashboardContainer">
      {isLoading ? <p>Loading dashboard...</p> : (
        <div className="dashboardLayout"> {/* Optional: Add a wrapper if needed, but dashboardContainer is already flex */}
          <div className="dashboardLeftPanel">
            {/* Top-left: Dashboard Info */}
            <div className="dashboardInfoSection">
              <h1 className="dashboardMainHeading">Dashboard</h1>
              <p className="dashboardDescription">
                Welcome, {currentUser?.username || 'User'}! Manage your rooms and profile here. Create a new room or join existing ones.
              </p>
            </div>

            {/* Bottom-left: My Room Section */}
            <div className="myRoomsSection">
              <h2 className="sectionHeader">My Room</h2>
            {/* Display "My Room" if they are currently in the room they created */}
            {myRoom && currentUser && userOwnedRoomId && myRoom._id.toString() === userOwnedRoomId && myRoom.createdBy._id === currentUser._id ? (              <div className="roomListItem myRoomItem">
                <div>
                  <Link to={`/room/${myRoom.roomId}`} className="roomLink">{myRoom.name}</Link>
                  <span className="roomMeta">(Shareable ID: {myRoom.roomId})</span>
                </div>
                {/* Delete button for the owned room */}
                <button onClick={() => openDeleteConfirmModal(myRoom.roomId)} className="deleteRoomButton" title="End My Room">
                  <FaTrash /> Delete My Room
                </button>
              </div>
            ) : (
              // If they are not in their created room, check if they still own one
              currentUser && userOwnedRoomId ? (
                <div className="dashboardActions"> {/* Use dashboardActions for layout */}
                  <p className="dashboardDescription">You own a room but are not currently in it. You must end it to create a new one.</p>
                  {/* TODO: Fetch and display details of the owned room here if needed */}
                  {/* For now, just the message and potentially a delete button if you can delete without being in it */}
                   {/* Example: <button onClick={() => openDeleteConfirmModal(userOwnedRoomId)} className="deleteRoomButton">End Owned Room</button> */}
                </div>
              ) : (
              <div className="dashboardActions"> {/* Use dashboardActions for layout */}
                <p className="dashboardDescription">You haven't created a room yet.</p>
                <Link to="/room/create" className="dashboardButton">
                  Create a New Room
                </Link>
              </div>
              )
            )}
            {/* Room list for My Room - currently only shows the single owned room if user is in it */}
            {/* If you want to list ALL rooms the user has ever created, you'd fetch them here */}
            {/* <ul className="roomList"> ... </ul> */}
          </div>

          </div> {/* End dashboardLeftPanel */}

          <div className="dashboardRightPanel">
            {/* Right Panel: Other Rooms Section */}
            <div className="otherRoomsSection">
              <h2 className="sectionHeader">Other Active Rooms</h2>
            {otherRooms.length > 0 ? (
              <ul className="roomList">
                {otherRooms.map(room => (
                  <li key={room.roomId} className="roomListItem">
                    <div>
                      <span className="roomName">{room.name}</span>
                      <span className="roomMeta">Created by: {room.createdBy.username}</span>
                    </div>
                    {/* Change Link to a button with onClick handler */}
                    <button onClick={() => handleJoinRoom(room.roomId)} className="dashboardButton joinRoomButton">
                      Join Room
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p>No other rooms available to join at the moment.</p>
            )}
          </div>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onConfirm={handleConfirmDeleteMyRoom}
        title="Delete My Room"
        message={`Are you sure you want to delete your room? This action cannot be undone.`}
        confirmText="Yes, Delete It"
        cancelText="Cancel"
      />
    </div>
  );
};

export default DashboardPage;