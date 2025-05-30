import React, { useState, useEffect, useRef, useMemo } from 'react'; // Import useRef and useMemo
import { Link, useHistory } from 'react-router-dom'; // Import Link and useHistory for navigation
import './DashboardPage.css'; // Import the CSS file
import { FaTrash } from 'react-icons/fa'; // Icon for delete button
import { useNotification } from '../contexts/NotificationContext'; // Import useNotification
import ConfirmModal from '../components/common/ConfirmModal'; // Import the modal // Make sure this path is correct
import RoomCard from '../components/room/RoomCard'; // Import the new RoomCard component
import io from 'socket.io-client'; // Import socket.io-client

const DashboardPage = () => {
  const [myRoom, setMyRoom] = useState(null);
  const [otherRooms, setOtherRooms] = useState([]);
  const [userOwnedRoomId, setUserOwnedRoomId] = useState(null); // To track if user owns a room, even if not in it
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const { addNotification } = useNotification();
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false); // Renamed for clarity
  const history = useHistory(); // Get history object for navigation
  const dashboardSocketRef = useRef(null); // Use useRef for the socket instance
  // No need for roomIdToDelete state if we are always deleting `myRoom`
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [roomToJoin, setRoomToJoin] = useState(null); // Store { roomId, roomName }

  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState('newest'); // Default sort: newest, oldest, name_asc, name_desc

  useEffect(() => {
    // This effect handles all initial data loading for the dashboard.
    let isMounted = true;
    setIsLoading(true); // Set loading true at the start of data fetching sequence

    const fetchInitialDashboardData = async () => {
      const token = localStorage.getItem('watchPartyToken');
      if (!token) {
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
        if (isMounted) setIsLoading(false);
        return;
      }

      // 2. If user fetch was successful, fetch dashboard room data
      if (fetchedUser && isMounted) {
        const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001';
        let currentRoomDataForFiltering = null; // For filtering otherRooms
        try {
          // Fetch my current room
          const myRoomResponse = await fetch(`${apiUrl}/api/rooms/myroom`, {
            headers: { 'Authorization': `Bearer ${token}` },
          });
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

          // Fetch all rooms for "other rooms" section
          const allRoomsResponse = await fetch(`${apiUrl}/api/rooms`, {
            headers: { 'Authorization': `Bearer ${token}` },
          });
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
          if (isMounted) setIsLoading(false); // All initial data fetching attempts are done
        }
      } else if (isMounted) { // Case: fetchedUser was valid, but we didn't proceed to room fetch (e.g. isMounted became false, though unlikely here)
        setIsLoading(false);
      }
    }; // end of fetchInitialDashboardData
    fetchInitialDashboardData();

    return () => {
      isMounted = false;
    };
  }, [addNotification]); // Runs once on mount (addNotification is stable)

  const filteredAndSortedRooms = useMemo(() => {
    if (!otherRooms) return [];
    let roomsToProcess = [...otherRooms];

    // Filtering
    if (searchTerm.trim()) {
      const lowerSearchTerm = searchTerm.toLowerCase();
      roomsToProcess = roomsToProcess.filter(room =>
        room.name.toLowerCase().includes(lowerSearchTerm) ||
        (room.description && room.description.toLowerCase().includes(lowerSearchTerm)) // Assuming rooms might have a description
      );
    }

    // Sorting
    switch (sortOrder) {
      case 'newest':
        roomsToProcess.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        break;
      case 'oldest':
        roomsToProcess.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        break;
      case 'name_asc':
        roomsToProcess.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'name_desc':
        roomsToProcess.sort((a, b) => b.name.localeCompare(a.name));
        break;
      default:
        break;
    }
    return roomsToProcess;
  }, [otherRooms, searchTerm, sortOrder]);

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
        dashboardSocketRef.current = null; // Clear the ref

      }
      return;
    }

    // Condition to create socket: token and currentUser exist, AND no socket exists in the ref.
    if (!dashboardSocketRef.current) {
      const newSocketInstance = io(process.env.REACT_APP_API_URL || 'http://localhost:3001', {
        query: { token } // Send token for authentication of this general socket
      });
      dashboardSocketRef.current = newSocketInstance; // Store the new instance in the ref

    }

    // At this point, dashboardSocketRef.current should hold a valid socket instance.
    const socket = dashboardSocketRef.current; // Use the instance from the ref

    const handleConnect = () => {
      // console.log('[DashboardPage] General dashboard socket connected:', socket.id); // Example of a log you might keep for specific debugging
    };

    const handleRoomDeleted = ({ roomId: deletedRoomId }) => {
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

  const executeJoinRoom = async (roomIdToJoin, roomName) => { // Renamed to avoid conflict, added roomName for notification
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
      addNotification(data.message || `Successfully joined room: ${roomName}!`, 'success');
      history.push(`/room/${roomIdToJoin}`);
    } catch (err) {
      console.error(`[DashboardPage] Error joining room ${roomIdToJoin}:`, err);
      addNotification(err.message || 'Could not join room.', 'error');
    } finally {
      setIsJoinModalOpen(false); // Close modal regardless of outcome
      setRoomToJoin(null);
    }
  };

  // This function will be passed to RoomCard and will open the join confirmation modal
  const initiateJoinRoom = (roomId, roomName) => {
    setRoomToJoin({ roomId, roomName });
    setIsJoinModalOpen(true);
  };


  const handleConfirmDeleteMyRoom = async () => { // This function handles confirming deletion of MY room
    if (!myRoom || !myRoom.roomId) return; // myRoom.roomId is the shareable UUID
    setIsDeleteModalOpen(false); // Close modal immediately
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
    setIsDeleteModalOpen(true);
  };
  // Log the state right before rendering to understand what the UI will show
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
              <div className="myRoomContentArea"> {/* Added wrapper for consistent height */}
                {/* Display "My Room" if they are currently in the room they created */}
                {myRoom && currentUser && userOwnedRoomId && myRoom._id.toString() === userOwnedRoomId && myRoom.createdBy._id === currentUser._id ? (
                  <div className="myRoomCardContainer">
                    <RoomCard room={myRoom} isMyRoom={true} onJoinRoom={() => initiateJoinRoom(myRoom.roomId, myRoom.name)} />
                    <button onClick={() => openDeleteConfirmModal(myRoom.roomId)} className="deleteRoomButton myRoomEndButton" title="End My Room">
                      <FaTrash /> End My Room
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
              </div> {/* End of myRoomContentArea */}
              {/* Room list for My Room - currently only shows the single owned room if user is in it */}
              {/* If you want to list ALL rooms the user has ever created, you'd fetch them here */}
              {/* <ul className="roomList"> ... </ul> */}
            </div>

          </div> {/* End dashboardLeftPanel */}

          <div className="dashboardRightPanel">
            {/* Right Panel: Other Rooms Section */}
            <div className="otherRoomsSection">
              <h2 className="sectionHeader">Other Active Rooms</h2>
             <div className="roomFilters">
                <input
                  type="text"
                  placeholder="Search rooms by name or description..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="searchInput"
                />
                <select
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value)}
                  className="sortSelect"
                >
                  <option value="newest">Newest First</option>
                  <option value="oldest">Oldest First</option>
                  <option value="name_asc">Name (A-Z)</option>
                  <option value="name_desc">Name (Z-A)</option>
                </select>
              </div>
              <div className="otherRoomsGrid">
                {filteredAndSortedRooms.length > 0 ? (
                  filteredAndSortedRooms.map(room => (
                    <RoomCard key={room.roomId} room={room} isMyRoom={false} onJoinRoom={() => initiateJoinRoom(room.roomId, room.name)} />
                  ))
                ) : (
                  <p className="dashboardDescription noRoomsMessage">
                    {searchTerm ? "No rooms match your search criteria." : "No other active rooms available right now."}
                  </p>
                )}
              </div>
          </div>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleConfirmDeleteMyRoom}
        title="End My Room" // Changed title to End My Room
        message={`Are you sure you want to delete your room? This action cannot be undone.`}
        confirmText="Yes, Delete It"
        cancelText="Cancel"
      />

      <ConfirmModal
        isOpen={isJoinModalOpen}
        onClose={() => { setIsJoinModalOpen(false); setRoomToJoin(null); }}
        onConfirm={() => roomToJoin && executeJoinRoom(roomToJoin.roomId, roomToJoin.roomName)}
        title="Join Room"
        message={`Are you sure you want to join the room "${roomToJoin?.roomName || 'this room'}"?`}
        confirmText="Yes, Join"
        cancelText="Cancel"
      />
    </div>
  );
};

export default DashboardPage;