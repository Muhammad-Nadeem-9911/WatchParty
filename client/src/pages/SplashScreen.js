import React, { useEffect } from 'react';
import { useHistory } from 'react-router-dom'; // Changed from useNavigate
import './SplashScreen.css'; // We'll create this file next

const SplashScreen = () => {
  const history = useHistory(); // Changed from useNavigate

  useEffect(() => {
    const timer = setTimeout(() => {
      history.push('/home'); // Changed from navigate('/home') to history.push('/home')
    }, 5000); // 5000 milliseconds = 5 seconds

    // Cleanup function to clear the timer if the component unmounts early
    return () => clearTimeout(timer);
  }, [history]); // Dependency changed to history

  return (
    <div className="splash-screen">
      <div className="splash-content">
        <h1 className="splash-title">WatchParty</h1>
        <p className="splash-tagline">Your movies, your friends, in sync.</p>
        <div className="play-icon-container">
          <div className="play-icon"></div>
        </div>
      </div>
    </div>
  );
};

export default SplashScreen;