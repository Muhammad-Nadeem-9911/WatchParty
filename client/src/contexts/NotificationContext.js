// d:\WatchParty\client\src\contexts\NotificationContext.js
import React, { createContext, useState, useCallback, useContext } from 'react';

const NotificationContext = createContext();

export const useNotification = () => useContext(NotificationContext);

export const NotificationProvider = ({ children }) => {
  const [notification, setNotification] = useState(null); // { message: '', type: 'success' | 'error' }

  const addNotification = useCallback((message, type = 'info') => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification(null);
    }, 3000); // Auto-dismiss after 3 seconds
  }, []);

  const clearNotification = useCallback(() => {
    setNotification(null);
  }, []);

  return (
    <NotificationContext.Provider value={{ notification, addNotification, clearNotification }}>
      {children}
    </NotificationContext.Provider>
  );
};

export default NotificationContext;