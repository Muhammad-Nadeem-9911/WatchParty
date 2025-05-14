import React, { useState, useEffect, useCallback } from 'react';
import './ParticipantList.css'; // Import the CSS file
import { 
  FaCrown,         // For Primary Host
  FaGamepad,       // For Controller
  FaUserShield,    // For Grant Control
  FaUserSlash      // For Revoke Control
} from 'react-icons/fa';

const ParticipantList = ({ socket, roomId, currentUserId }) => { // Accept currentUserId as prop
  const [participants, setParticipants] = useState([]);
  const [hostId, setHostId] = useState(null);
  const [controllerIds, setControllerIds] = useState([]);

  // Memoize the onAnyHandler. It depends on state setters.
  const onAnyHandler = useCallback((eventName, ...args) => {
    // Note: To log socket.id here, you'd need to pass `socket` as a dependency to useCallback,
    // which would then also make `socket` a dependency of the main useEffect.
    // For now, we focus on the event data.
    console.log(
      `%c ### [ParticipantList onAny] Event: "${eventName}" ### `,
      'background: yellow; color: black; font-size: 14px; font-weight: bold;',
      'Data:', ...args
    );
    if (eventName === 'update_participants') {
      console.log('%c [ParticipantList onAny] Received update_participants. Setting state.', 'color: green; font-weight: bold;', args[0]);
      setParticipants(Array.isArray(args[0]) ? args[0] : []);
    }
    if (eventName === 'sync_room_state') {
      const state = args[0];
      console.log(`%c [ParticipantList onAny] Received sync_room_state. Current hostId state: ${hostId}. New state from server:`, 'color: green; font-weight: bold;', state);
      if (state) {
        console.log(`%c [ParticipantList onAny] Setting hostId to: ${state.hostId || null}`, 'color: green; font-weight: bold;');
        setHostId(state.hostId || null);
        setControllerIds(state.controllerIds || []);
      }
    }
    if (eventName === 'direct_test_event') { // From server debug
        console.log('%c [ParticipantList onAny] Received direct_test_event!', 'color: green; font-weight: bold;', args[0]);
    }
  }, [setParticipants, setHostId, setControllerIds, hostId]); // Added hostId as a dependency as it's used in the log

  useEffect(() => {
    // This effect now directly depends on the `socket` prop.
    if (!socket) {
      console.log('[ParticipantList Effect] Socket is null. Clearing state and returning.');
      setParticipants([]);
      setHostId(null);
      setControllerIds([]);
      return;
    }

    console.log(`[ParticipantList Effect] Running for socket ${socket.id}, Room: ${roomId}, User: ${currentUserId}. Attaching onAny.`);

    const onConnectHandler = () => {
      console.log(`%c [ParticipantList] Socket ${socket.id} CONFIRMED CONNECTED. Requesting room state for ${roomId}.`, 'color: orange; font-weight: bold;');
      socket.emit('request_room_state', roomId);
    };

    // Attach the memoized onAnyHandler
    socket.onAny(onAnyHandler);
    socket.on('connect', onConnectHandler); // Listen for connect/reconnect

    // If socket is already connected when this effect runs, 'connect' might not fire again.
    // So, if connected, call the handler logic directly.
    if (socket.connected) {
      console.log(`[ParticipantList Effect] Socket ${socket.id} already connected. Manually calling onConnectHandler logic (requesting state).`);
      onConnectHandler(); // Manually trigger what would happen on 'connect'
    } else {
      console.log(`[ParticipantList Effect] Socket ${socket.id} not connected yet. Waiting for 'connect' event.`);
    }

    return () => {
      console.log(`[ParticipantList Cleanup] Removing listeners for socket instance with ID: ${socket?.id} (from socket prop), for roomId: ${roomId}`);
      if (socket) {
        socket.offAny(onAnyHandler);
        socket.off('connect', onConnectHandler);
      }
    };
  }, [socket, roomId, currentUserId, onAnyHandler]); // `onAnyHandler` is memoized and now a dependency.
  console.log('[ParticipantList RENDER] Participants state:', participants); // Log the state before render
  const handleToggleControl = (targetUserId) => {
    if (socket && currentUserId === hostId && currentUserId !== targetUserId) { // Only primary host can grant/revoke, and not to self
      const isController = controllerIds.includes(targetUserId);
      if (isController) {
        socket.emit('revoke_control_permission', { roomId, targetUserId });
      } else {
        socket.emit('grant_control_permission', { roomId, targetUserId });
      }
    } else {
      // Consider using themed notification instead of alert
      // alert("You are not the primary host or there's a connection issue.");
      console.warn("[ParticipantList] Control toggle denied: Not host or connection issue.");
    }
  };
  console.log('[ParticipantList RENDER] Participants Count (from state):', participants.length, 'Host ID:', hostId, 'Current User ID:', currentUserId);
  return (
    <div className="participantListContainer">
      <h4>
        Participants ({participants.length})
        {currentUserId && hostId === currentUserId && <span className="hostIndicator">(You are Host)</span>}
      </h4>
      <ul className="participantList">
        {participants.map(participant => (
          <li key={participant.userId || participant.id} className="participantItem">
            <span className="participantName">
              {participant.username || participant.id.substring(0, 8) + '...'}
              {hostId === participant.userId && 
                <FaCrown className="statusIcon hostIcon" title="Primary Host" />
              }
              {(controllerIds.includes(participant.userId) && participant.userId !== hostId) && 
                <FaGamepad className="statusIcon controllerIcon" title="Controller" />
              }
            </span>
            {currentUserId && hostId === currentUserId && participant.userId !== currentUserId && (
              <button
                onClick={() => handleToggleControl(participant.userId)}
                className="controlToggleButton"
                title={controllerIds.includes(participant.userId) ? 'Revoke Control' : 'Grant Control'}
              >
                {controllerIds.includes(participant.userId) ? <FaUserSlash /> : <FaUserShield />}
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default ParticipantList;
