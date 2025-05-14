import React, { useState, useEffect } from 'react';
import './RoomControls.css'; // Import the CSS file
import { 
  FaPlay, 
  FaPause, 
  FaUndo, // Rewind
  FaRedo, // Forward
  FaUpload, // Load Videof  <div className="roomControlsContainer">

  FaVolumeUp, FaVolumeMute, FaVolumeDown 
} from 'react-icons/fa';

const RoomControls = ({ socket, roomId, currentUserId }) => { // Accept currentUserId as prop
  const [videoUrl, setVideoUrl] = useState('');
  const [canControl, setCanControl] = useState(false);
  const [playbackState, setPlaybackState] = useState({
    url: null,
    serverTimeAtReference: 0,
    referenceTimestamp: 0,
    isPlaying: false,
  });
  const [displayTime, setDisplayTime] = useState(0);
  const [volumeLevel, setVolumeLevel] = useState(50); // Visual Only
  const [controlError, setControlError] = useState('');
  // currentUserId is now a prop, no longer internal state for it.
  // const lastProcessedRoomStateRef = useRef(null); // Removed for simplification

  useEffect(() => {
    if (!socket) return;

    // Request initial state from server once socket and user ID are ready
    console.log(`[RoomControls Effect] Requesting initial room state for room ${roomId}`);
    socket.emit('request_room_state', roomId);
    
    const handleSyncRoomState = (state) => {
      console.log('[RoomControls] handleSyncRoomState called. State:', state, 'Current User ID Prop:', currentUserId);

      if (state && state.hostId) {
        if (currentUserId) { // Crucial: currentUserId prop must be valid
          const primaryHostId = state.hostId;
          const currentControllerIds = state.controllerIds || [];
          const hasPrivilege = currentUserId === primaryHostId || currentControllerIds.includes(currentUserId);
          
          setCanControl(hasPrivilege); // Set based on current evaluation
          console.log(`[RoomControls] Sync: User ${currentUserId}, Host ${primaryHostId}, Controllers ${currentControllerIds.join(',') || 'none'}. Calculated canControl: ${hasPrivilege}`);
          
          setPlaybackState({
            url: state.url || null,
            serverTimeAtReference: state.referenceTime || 0,
            referenceTimestamp: state.referenceTimestamp || Date.now(),
            isPlaying: state.isPlaying || false,
          });
        } else {
          console.warn('[RoomControls] No currentUserId prop available during sync_room_state. Controls likely disabled.');
          setCanControl(false); // Cannot determine control without user ID
        }
      } else {
        console.log('[RoomControls] Sync: No state or state.hostId received.');
        setCanControl(false);
      }
    };

    const controlErrorListener = (data) => {
      setControlError(data.message);
      setTimeout(() => setControlError(''), 3000);
    };

    const hostChangedListener = (data) => {
      console.log('[RoomControls] hostChangedListener called. Data:', data);
      // sync_room_state will handle updating canControl based on new hostId
    };

    socket.on('sync_room_state', handleSyncRoomState);
    socket.on('control_error', controlErrorListener);
    socket.on('host_changed', hostChangedListener);

    return () => {
      socket.off('sync_room_state', handleSyncRoomState);
      socket.off('control_error', controlErrorListener);
      socket.off('host_changed', hostChangedListener);
    };
    }, [socket,roomId, currentUserId]); // Re-run if socket or currentUserId prop changes.


  // Effect for display time (no changes needed here)
  useEffect(() => {
    let intervalId;
    if (playbackState.url && playbackState.isPlaying) {
      const initialElapsed = (Date.now() - playbackState.referenceTimestamp) / 1000;
      setDisplayTime(playbackState.serverTimeAtReference + initialElapsed);

      intervalId = setInterval(() => {
        const elapsed = (Date.now() - playbackState.referenceTimestamp) / 1000;
        setDisplayTime(playbackState.serverTimeAtReference + elapsed);
      }, 250);
    } else if (playbackState.url) {
      setDisplayTime(playbackState.serverTimeAtReference);
    } else {
      setDisplayTime(0);
    }
    return () => clearInterval(intervalId);
  }, [playbackState]);

  const handleLoadVideo = () => {
    console.log('[RoomControls] handleLoadVideo called. Socket:', socket, 'RoomID:', roomId, 'CanControl:', canControl, 'VideoURL:', videoUrl);
    if (videoUrl.trim() && socket && canControl) { // Ensure canControl is true
      if (videoUrl.includes('youtube.com/watch?v=') || videoUrl.includes('youtu.be/')) {
        socket.emit('load_video', { roomId, url: videoUrl });
        setVideoUrl('');
      } else {
        alert('Please enter a valid YouTube video URL.');
      }
    }
  };

  const handlePlayVideo = () => {
    if (socket && canControl) { // Ensure canControl is true
      socket.emit('video_play', { roomId });
    }
  };

  const handlePauseVideo = () => {
    if (socket && canControl) { // Ensure canControl is true
      socket.emit('video_pause', { roomId });
    }
  };

  const handleSeekRelative = (offsetSeconds) => {
    if (!playbackState.url || !socket || !canControl) return; // Ensure canControl is true
    let currentTimeEstimate = playbackState.serverTimeAtReference;
    if (playbackState.isPlaying) {
      const elapsedSinceLastSync = (Date.now() - playbackState.referenceTimestamp) / 1000;
      currentTimeEstimate += elapsedSinceLastSync;
    }
    const newTime = Math.max(0, currentTimeEstimate + offsetSeconds);
    socket.emit('video_seek', { roomId, time: newTime });
  };

  const handleVolumeChange = (event) => {
    const newVolume = parseInt(event.target.value, 10);
    setVolumeLevel(newVolume);
    // TODO: Connect to player volume
  };
  console.log('[RoomControls RENDER] canControl state:', canControl, 'currentUserId prop:', currentUserId);

  return (
    <div className="roomControlsContainer">
      <h4>Room Controls ({displayTime > 0 ? new Date(displayTime * 1000).toISOString().substr(14, 5) : '00:00'})</h4>
      {controlError && <p className="controlError">{controlError}</p>}
      
      <div className="inputGroup">
        <input
          type="text"
          className="videoUrlInput"
          value={videoUrl}
          onChange={(e) => setVideoUrl(e.target.value)}
          placeholder="Enter YouTube Video URL"
          disabled={!socket || !canControl}
        />
        <button onClick={handleLoadVideo} disabled={!socket || !canControl} className="controlButton" title="Load Video">
          <FaUpload /> 
        </button>
      </div>

      <div className="playbackControls">
        <button onClick={() => handleSeekRelative(-5)} disabled={!socket || !canControl || !playbackState.url} className="controlButton" title="Rewind 5s">
          <FaUndo />
        </button>
        {playbackState.isPlaying ? (
          <button onClick={handlePauseVideo} disabled={!socket || !canControl || !playbackState.url} className="controlButton" title="Pause">
            <FaPause />
          </button>
        ) : (
          <button onClick={handlePlayVideo} disabled={!socket || !canControl || !playbackState.url} className="controlButton" title="Play">
            <FaPlay />
          </button>
        )}
        <button onClick={() => handleSeekRelative(5)} disabled={!socket || !canControl || !playbackState.url} className="controlButton" title="Forward 5s">
          <FaRedo />
        </button>
      </div>

      <div className="volumeControls">
        <label htmlFor="volume" className="volumeLabel">
          {volumeLevel === 0 ? <FaVolumeMute /> : volumeLevel < 50 ? <FaVolumeDown /> : <FaVolumeUp />}
        </label>
        <input
          type="range"
          id="volume"
          name="volume"
          className="volumeSlider"
          min="0"
          max="100"
          value={volumeLevel}
          onChange={handleVolumeChange}
          disabled={!socket || !playbackState.url} // Add !canControl if volume should also be host-controlled
        />
        <span className="volumePercentage">{volumeLevel}%</span> 
      </div>
    </div>
  );
};

export default RoomControls;
