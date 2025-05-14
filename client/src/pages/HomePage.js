import React from 'react';
import { Link } from 'react-router-dom'; // For navigation buttons
import './HomePage.css'; // Import the CSS file
const HomePage = ({ isLoggedIn, currentUser }) => {
  return (
    <div className="homePageContainer">
      <h1 className="homePageTitle">
        Welcome {isLoggedIn && currentUser ? `, ${currentUser.username}` : ''} to WatchParty!
      </h1>      <p className="homePageSubtitle">
        Watch videos together with friends in real-time, no matter where you are.
        Create a room, invite your friends, and enjoy synchronized playback and chat.
      </p>
      <div className="homePageActions">
        {isLoggedIn ? (
          <Link to="/dashboard" className="homePageButton">
            Go to Dashboard
          </Link>
        ) : (
          <>
            <Link to="/signup" className="homePageButton">
              Get Started
            </Link>
            <Link to="/login" className="homePageButton secondary">
              Login
            </Link>
          </>
        )}
      </div>
    </div>
  );
};

export default HomePage;