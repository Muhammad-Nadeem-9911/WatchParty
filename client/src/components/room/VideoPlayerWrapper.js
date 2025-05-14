import React, { useState, useEffect, useRef, useCallback } from 'react';

const PLAYER_DIV_ID = 'youtube-player-stable-div'; // Static ID

const VideoPlayerWrapper = ({ socket, roomId, currentUserId: currentUserIdProp }) => { // Add roomId and currentUserIdProp
  const [videoId, setVideoId] = useState(''); // This is the YouTube video ID, not the room URL
  const [lastActionStatus, setLastActionStatus] = useState('');
  const playerRef = useRef(null);
  // playerDivRef is now less critical as we use a static ID, but can be kept for direct DOM access if needed.
  const playerDivRef = useRef(null); 
  const initialStateToApplyRef = useRef(null);
  const initialSyncDone = useRef(false);
  const [isHost, setIsHost] = useState(false);
  const currentUserId = useRef(currentUserIdProp || JSON.parse(localStorage.getItem('watchPartyUser'))?.id); // Use prop first
  const isProgrammaticChange = useRef(false); // To prevent event feedback loops
  const isSyncingRef = useRef(false);
  const currentVideoIdInPlayer = useRef(''); // Track what videoId the YT player instance thinks it has

  const getYouTubeVideoId = useCallback((url) => {
    if (!url) return '';
    let videoIdResult;
    if (url.includes('youtube.com/watch?v=')) {
      videoIdResult = url.split('v=')[1].split('&')[0];
    } else if (url.includes('youtu.be/')) {
      videoIdResult = url.split('youtu.be/')[1].split('?')[0];
    }
    return videoIdResult || '';
  }, []);

  const onPlayerReady = useCallback((event) => {
    console.log(`[VideoPlayerWrapper] onPlayerReady: Player ready. Current React videoId state: ${videoId}. Player's current video via API (if available): ${playerRef.current?.getVideoData?.().video_id}`);
    const readyPlayer = event.target;
    currentVideoIdInPlayer.current = videoId; // Assume ready for the current React videoId state
    
    if (initialStateToApplyRef.current &&
        initialStateToApplyRef.current.url &&
        getYouTubeVideoId(initialStateToApplyRef.current.url) === currentVideoIdInPlayer.current && // Compare with what player is ready for
        isSyncingRef.current && 
        !initialSyncDone.current) { 

        const stateToApply = initialStateToApplyRef.current;
        console.log(`[VideoPlayerWrapper] onPlayerReady: Applying initial/sync state for videoId '${currentVideoIdInPlayer.current}':`, stateToApply);
        isProgrammaticChange.current = true; 
        readyPlayer.seekTo(stateToApply.referenceTime || stateToApply.time, true); 
        if (stateToApply.isPlaying) {
            readyPlayer.playVideo();
        } else {
            readyPlayer.pauseVideo();
        }
    } else {
        console.log(`[VideoPlayerWrapper] onPlayerReady: Conditions not met to apply initialStateToApplyRef. Ref:`, initialStateToApplyRef.current, `isSyncing: ${isSyncingRef.current}, initialSyncDone: ${initialSyncDone.current}, currentVideoIdInPlayer: ${currentVideoIdInPlayer.current}`);
        if (initialStateToApplyRef.current && initialStateToApplyRef.current.url && getYouTubeVideoId(initialStateToApplyRef.current.url) !== currentVideoIdInPlayer.current) {
            console.warn(`[VideoPlayerWrapper] onPlayerReady: Mismatch between initialStateToApplyRef video (${getYouTubeVideoId(initialStateToApplyRef.current.url)}) and player's ready video (${currentVideoIdInPlayer.current})`);
        }
    }
  }, [videoId, getYouTubeVideoId]); // videoId is used to update currentVideoIdInPlayer.current
  
  const onPlayerStateChange = useCallback((event) => {
    const playerState = event.data;
    const currentRoomId = socket?.handshake?.query?.roomId; 
    const actualPlayerVideoId = playerRef.current?.getVideoData?.().video_id || currentVideoIdInPlayer.current;

    console.log(`[VideoPlayerWrapper] onPlayerStateChange: State ${playerState}, Actual Player videoId: ${actualPlayerVideoId}, React videoId: ${videoId}, isProg: ${isProgrammaticChange.current}, isSync: ${isSyncingRef.current}, initSyncDone: ${initialSyncDone.current}, initialToApply:`, initialStateToApplyRef.current); 

    if (initialStateToApplyRef.current &&
        initialStateToApplyRef.current.url && 
        playerState !== window.YT.PlayerState.UNSTARTED && 
        getYouTubeVideoId(initialStateToApplyRef.current.url) === actualPlayerVideoId && 
        !initialSyncDone.current && 
        isSyncingRef.current && 
        playerRef.current) { 

        console.log(`[VideoPlayerWrapper] onPlayerStateChange (State: ${playerState}): Applying/Re-applying for videoId '${actualPlayerVideoId}':`, initialStateToApplyRef.current); 
        const stateToApply = initialStateToApplyRef.current;
        isProgrammaticChange.current = true; 
        playerRef.current.seekTo(stateToApply.referenceTime || stateToApply.time, true);
        if (stateToApply.isPlaying) {
            playerRef.current.playVideo();
        } else {
            playerRef.current.pauseVideo();
        }        
    }

    if (isProgrammaticChange.current || isSyncingRef.current) {
        if (isSyncingRef.current && initialStateToApplyRef.current) {
            const targetIsPlaying = initialStateToApplyRef.current.isPlaying;
            const stateVideoId = getYouTubeVideoId(initialStateToApplyRef.current.url);
            let syncActionCompleted = false;

            if (stateVideoId === actualPlayerVideoId) { // Ensure we are completing for the correct video
                if (targetIsPlaying && playerState === window.YT.PlayerState.PLAYING) {
                    syncActionCompleted = true;
                } else if (!targetIsPlaying && (playerState === window.YT.PlayerState.PAUSED || playerState === window.YT.PlayerState.CUED || playerState === window.YT.PlayerState.ENDED)) {
                    syncActionCompleted = true;
                }
            }

            if (syncActionCompleted) {
                console.log(`[VideoPlayerWrapper] Syncing action complete for video ${actualPlayerVideoId}. Target playing: ${targetIsPlaying}, Actual state: ${playerState}`);
                initialSyncDone.current = true;
                initialStateToApplyRef.current = null; 
                isSyncingRef.current = false;
                isProgrammaticChange.current = false;
            }
            if (isSyncingRef.current && !syncActionCompleted) return;
        }
        else if (isProgrammaticChange.current && !isSyncingRef.current &&
                 (playerState === window.YT.PlayerState.PAUSED || playerState === window.YT.PlayerState.PLAYING || playerState === window.YT.PlayerState.CUED)) {
            isProgrammaticChange.current = false;
        }
      if (isProgrammaticChange.current === false && isSyncingRef.current === false) { /* flags were just reset */ } else return;
    }

    if (!socket || !isHost || isSyncingRef.current || isProgrammaticChange.current) { 
      return; 
    }

    if (playerState === window.YT.PlayerState.PLAYING) {
      socket.emit('video_play', { roomId: currentRoomId });
    } else if (playerState === window.YT.PlayerState.PAUSED) {
      socket.emit('video_pause', { roomId: currentRoomId });
    }
  }, [socket, isHost, videoId, getYouTubeVideoId]); 

  const createPlayer = useCallback((targetVideoId) => {
      if (!targetVideoId) {
        console.log('[VideoPlayerWrapper createPlayer] Aborting: No targetVideoId.');
        return;
      }
      const playerElement = document.getElementById(PLAYER_DIV_ID);
      if (!playerElement) {
        console.error(`[VideoPlayerWrapper createPlayer] Player div with ID ${PLAYER_DIV_ID} not found!`);
        return;
      }
      
      if (window.YT && window.YT.Player) {
        if (playerRef.current && typeof playerRef.current.destroy === 'function') {
            console.log('[VideoPlayerWrapper createPlayer] Existing player found. Destroying it before creating new one.');
            playerRef.current.destroy();
            playerRef.current = null;
        }
        
        console.log(`[VideoPlayerWrapper createPlayer] Creating new YT.Player for videoId: ${targetVideoId} in div ID: ${PLAYER_DIV_ID}`);
        const playerOptions = {
          videoId: targetVideoId,
          width: '100%',
          height: '450', 
          playerVars: { 'controls': 0 },
          events: {
            'onReady': onPlayerReady,
            'onStateChange': onPlayerStateChange
          }
        };
        playerRef.current = new window.YT.Player(PLAYER_DIV_ID, playerOptions);
        currentVideoIdInPlayer.current = targetVideoId;
      } else {
        console.error('[VideoPlayerWrapper createPlayer] YouTube IFrame API not loaded yet.');
      }
    }, [onPlayerReady, onPlayerStateChange]); 
  
  useEffect(() => {
    if (socket) {
      // Update currentUserId ref if prop changes
      currentUserId.current = currentUserIdProp || JSON.parse(localStorage.getItem('watchPartyUser'))?.id;

      const syncOrInitialStateListenerForHostCheck = (state) => { 
        if (state && state.hostId && currentUserId.current) {
          // Assuming currentUserId.current holds the actual ID string
          setIsHost(currentUserId.current === state.hostId);
          console.log(`[VideoPlayerWrapper] Host check on sync: MyID: ${currentUserId.current}, HostID from state: ${state.hostId}, isHost set to: ${currentUserId.current === state.hostId}, RoomID: ${roomId}`);
        }
      };
      const hostChangedListenerForHostCheck = (data) => {
        if (data && data.newHostId && currentUserId.current) {
          setIsHost(currentUserId.current === data.newHostId);
          console.log(`[VideoPlayerWrapper] Host check on host_changed: MyID: ${currentUserId.current}, New HostID: ${data.newHostId}, isHost set to: ${currentUserId.current === data.newHostId}`);
        }
      };
      socket.on('sync_room_state', syncOrInitialStateListenerForHostCheck); 
      // Request initial state using the roomId prop
      if (roomId) { // Ensure roomId is available
        socket.emit('request_room_state', roomId);
        console.log(`[VideoPlayerWrapper] Requested initial room state for room: ${roomId}`);
      }
      socket.on('host_changed', hostChangedListenerForHostCheck);
      return () => {
        socket.off('sync_room_state', syncOrInitialStateListenerForHostCheck);
        socket.off('host_changed', hostChangedListenerForHostCheck);
      };
    }
  }, [socket, roomId, currentUserIdProp]); // Add roomId and currentUserIdProp to dependencies

  useEffect(() => {
    if (socket) {
      const syncRoomStateListener = (state) => { 
        const videoIdFromReactState = videoId; // Capture current React state videoId
        console.log('[VideoPlayerWrapper] Received sync_room_state:', state, 'Current React videoId:', videoIdFromReactState);
        
        if (state.lastActionBy?.username) { 
          setLastActionStatus(`Synced. Last action by ${state.lastActionBy.username}.`);
        } else if (state.url) {
          setLastActionStatus('Synced. Video loaded.');
        } else {
          setLastActionStatus('Synced. No video.');
        }

        if (!state.url) {
          console.log('[VideoPlayerWrapper] Sync: No URL in state, clearing video.'); 
          if (playerRef.current && typeof playerRef.current.destroy === 'function') {
            console.log('[VideoPlayerWrapper Sync] No URL, destroying existing player.');
            playerRef.current.destroy();
            playerRef.current = null;
            currentVideoIdInPlayer.current = '';
          }
          setVideoId(''); 
          initialStateToApplyRef.current = null; 
          initialSyncDone.current = true; 
          isSyncingRef.current = false; 
          return; 
        }

        const newVideoIdFromState = getYouTubeVideoId(state.url);
        console.log('[VideoPlayerWrapper] Sync: Preparing to apply state for newVideoIdFromState:', newVideoIdFromState, state);
        
        initialStateToApplyRef.current = state; 
        console.log('[VideoPlayerWrapper Sync Listener] initialStateToApplyRef.current AFTER assignment:', 
        initialStateToApplyRef.current); 
        initialSyncDone.current = false;      
        isSyncingRef.current = true;          

        setVideoId(newVideoIdFromState); // Update React's videoId state

        if (playerRef.current && typeof playerRef.current.loadVideoById === 'function') {
          if (currentVideoIdInPlayer.current !== newVideoIdFromState) {
            console.log(`[VideoPlayerWrapper Sync] Player exists. Current player video: ${currentVideoIdInPlayer.current}. New video: ${newVideoIdFromState}. Calling loadVideoById.`);
            isProgrammaticChange.current = true;
            playerRef.current.loadVideoById({'videoId': newVideoIdFromState});
            currentVideoIdInPlayer.current = newVideoIdFromState; // Optimistically update
          } else {
            // Same video, player exists, just apply state (seek/play/pause)
            console.log('[VideoPlayerWrapper] Sync: Same video. Player exists. Commanding state.');
            isProgrammaticChange.current = true; 
            playerRef.current.seekTo(state.referenceTime || state.time, true);
            if (state.isPlaying) {
                playerRef.current.playVideo();
            } else {
                playerRef.current.pauseVideo();
            }
          }
        } else {
          // No player yet, or it's not ready for loadVideoById.
          // The useEffect for player creation will handle creating the player with the new videoId.
          console.log('[VideoPlayerWrapper] Sync: No player instance or not ready. Player will be created/updated by videoId effect.');
        }
      };
      socket.on('sync_room_state', syncRoomStateListener); 
      return () => {
        socket.off('sync_room_state', syncRoomStateListener);
      };
    }
  }, [socket, videoId, getYouTubeVideoId]); // videoId is needed to get videoIdFromReactState

  // Effect for player creation and YouTube API loading (runs once on mount, and when videoId changes if no player)
  useEffect(() => {
    const initPlayer = () => {
      if (videoId && !playerRef.current) { // Only create if videoId is set and no player exists
        console.log(`[VideoPlayerWrapper initPlayer] videoId is ${videoId}, no player. Attempting to create.`);
        createPlayer(videoId);
      } else if (videoId && playerRef.current && currentVideoIdInPlayer.current !== videoId) {
        // This case should ideally be handled by syncRoomStateListener calling loadVideoById
        // But as a fallback, if React's videoId state diverges from what player has, try to reconcile.
        console.warn(`[VideoPlayerWrapper initPlayer] Player exists for ${currentVideoIdInPlayer.current}, but React videoId is ${videoId}. Attempting loadVideoById.`);
        isProgrammaticChange.current = true;
        playerRef.current.loadVideoById({'videoId': videoId});
        currentVideoIdInPlayer.current = videoId;
      } else if (!videoId && playerRef.current && typeof playerRef.current.destroy === 'function') {
        console.log('[VideoPlayerWrapper initPlayer] No videoId. Destroying existing player.');
        playerRef.current.destroy();
        playerRef.current = null;
        currentVideoIdInPlayer.current = '';
      }
    };

    if (!window.YT || !window.YT.Player) {
      if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
          const tag = document.createElement('script');
          tag.src = "https://www.youtube.com/iframe_api";
          document.head.appendChild(tag);
      }
      const previousOnReady = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        console.log("YouTube IFrame API Ready (global onYouTubeIframeAPIReady).");
        if (previousOnReady) previousOnReady();
        initPlayer(); // Attempt to init player once API is ready
      };
    } else { // API already loaded
      initPlayer();
    }

    // Cleanup: Runs ONLY when the VideoPlayerWrapper component unmounts
    return () => {
        console.log('[VideoPlayerWrapper MAIN UNMOUNT cleanup] Component unmounting.');
        if (playerRef.current && typeof playerRef.current.destroy === 'function') {
            console.log('[VideoPlayerWrapper MAIN UNMOUNT cleanup] Destroying player instance.');
            playerRef.current.destroy();
            playerRef.current = null;
            currentVideoIdInPlayer.current = '';
        }
    };
  }, [videoId, createPlayer]); // Runs when videoId or createPlayer changes

  return (
    <div style={{ border: '1px solid blue', padding: '10px', margin: '10px' }}>
      <h4>Video Player Area</h4>
      {lastActionStatus && <p style={{ fontStyle: 'italic', fontSize: '0.9em', margin: '5px 0' }}>{lastActionStatus}</p>}
      
      <div style={{ 
        position: 'relative', 
        width: '100%', 
        height: '450px' 
      }}>
          <div 
            // No key={videoId} here. The div is stable.
            id={PLAYER_DIV_ID} 
            ref={playerDivRef} // Assign ref here if needed, though createPlayer uses getElementById
            style={{width: '100%', height: '100%'}}></div>        
        {videoId && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              zIndex: 10, 
            }}
            title="Video interaction is controlled by the host via custom controls." 
          ></div>
        )}
      </div>

      {!videoId && (
        <p>No video loaded. Use controls to load a YouTube video.</p>
      )}
    </div>
  );
};

export default VideoPlayerWrapper;
