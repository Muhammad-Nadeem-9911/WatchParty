// d:\WatchParty\client\src\components\layout\Notification.js
import React from 'react';
import { useNotification } from '../../contexts/NotificationContext';
import './Notification.css'; // We'll create this CSS file next

const Notification = () => {
  const { notification, clearNotification } = useNotification();

  if (!notification) {
    return null;
  }

  return (
    <div className={`notification notification-${notification.type}`}>
      <p>{notification.message}</p>
      <button onClick={clearNotification} className="notification-close-btn">&times;</button>
    </div>
  );
};

export default Notification;