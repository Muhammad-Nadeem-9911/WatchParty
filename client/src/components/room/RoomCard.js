import React from 'react';
import './RoomCard.css'; // Import the CSS for the card

// Placeholder image - replace with actual room photo when implemented
const PLACEHOLDER_IMAGE = 'https://placehold.co/320x180/1A1A1A/FFD700?text=WatchParty&font=montserrat'; // Using placehold.co with theme colors

const RoomCard = ({ room, isMyRoom, onJoinRoom }) => {
  // 'room' prop should contain { _id, roomId, name, createdBy: { username, _id } }
  // 'isMyRoom' is a boolean indicating if this card represents the user's owned room
  // 'onJoinRoom' is the function to call when joining (for other rooms)
  // 'onDeleteRoom' is handled outside this component for "My Room"

  const cardContent = (
    <>
      <div className="roomCardImage">
        {/* Placeholder Image - Replace with actual room photo when available */}
        <img src={PLACEHOLDER_IMAGE} alt={`Thumbnail for ${room.name}`} />
      </div>
      <div className="roomCardContent">
        <h3 className="roomCardTitle">{room.name}</h3>
        <p className="roomCardMeta">Created by: {room.createdBy?.username || 'Unknown'}</p>
      </div>
           {/* Action buttons are no longer rendered inside this component directly */}

    </>
  );

  // If onJoinRoom is provided, make the card clickable.
  if (onJoinRoom) {
    return (
      <div className="roomCard clickable" onClick={() => onJoinRoom(room.roomId, room.name)} title={`Join room: ${room.name}`}>
        {cardContent}
      </div>
    );
  } 
  // Fallback if no onJoinRoom (though for your use case, it will always be there)
  return <div className="roomCard">{cardContent}</div>;
};
export default RoomCard;