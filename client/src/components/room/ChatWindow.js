import React, { useState, useEffect, useRef } from 'react';
import './ChatWindow.css'; // Import the CSS file
import { FaPaperPlane } from 'react-icons/fa'; // Icon for send button
const ChatWindow = ({ socket, roomId, currentUserId }) => { // Accept currentUserId
  const [message, setMessage] = useState('');
  const [chatLog, setChatLog] = useState([]);
  const chatLogRef = useRef(null);

  useEffect(() => {
    if (socket) {
      // Only set up listeners and request history if socket and currentUserId are available
    if (!socket || !currentUserId) {
      console.log('[ChatWindow Effect] Waiting for socket or currentUserId. currentUserId:', currentUserId, 'socket:', !!socket);
      // Clear chat log if prerequisites are missing (e.g., on logout or if socket disconnects)
      setChatLog([]);
      return;
    }
    console.log('[ChatWindow Effect] Setting up listeners and requesting history. Socket ID:', socket.id, 'Room ID:', roomId, 'Current User ID:', currentUserId);

    socket.emit('request_chat_history', roomId); // Request history
      const messageListener = (newMessage) => {
        console.log('[ChatWindow] Received new message:', newMessage);
        setChatLog((prevLog) => [...prevLog, newMessage]);
      };
      const historyListener = (history) => {
        console.log('[ChatWindow] Received chat history:', history);
        // Ensure history is an array before setting
        setChatLog(Array.isArray(history) ? history : []); 
      };

      socket.on('chat_history', historyListener);
      socket.on('receive_message', messageListener);

      return () => {
        socket.off('receive_message', messageListener);
        socket.off('chat_history', historyListener);
      };
    }
  }, [socket, roomId, currentUserId]); // Add roomId and currentUserId to dependencies

  // Auto-scroll to bottom of chat
  useEffect(() => {
    if (chatLogRef.current) {
      chatLogRef.current.scrollTop = chatLogRef.current.scrollHeight;
    }
  }, [chatLog]);

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (message.trim() && socket) {
    // Sender info will be added by the server based on the authenticated socket.user
      const msgData = { 
        room: roomId, 
        text: message 
      };      socket.emit('send_message', msgData);
      // Optionally, add message to own chat log immediately for better UX
      // setChatLog((prevLog) => [...prevLog, `You: ${message}`]);
      setMessage('');
    }
  };

  return (
    <div className="chatWindowContainer">
      <h4>Chat Window</h4>
      <div ref={chatLogRef} className="chatLog">
        {chatLog.map((msg, index) => (
          <div key={msg.timestamp || index} className="chatMessage">
            <strong>
              {msg.sender?.username || (typeof msg.sender?.id === 'string' ? msg.sender.id.substring(0, 5) + '...' : 'System')}:
            </strong> {msg.text}
          </div>
        ))}      
      </div>
      <form onSubmit={handleSendMessage} className="chatForm">
        <input
          type="text"
          className="chatInput"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Type a message..."
        />
        <button type="submit" disabled={!socket || !message.trim()} className="sendButton" title="Send Message">
          <FaPaperPlane />
        </button>      </form>
    </div>
  );
};

export default ChatWindow;