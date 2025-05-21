import React, { useState, useEffect } from 'react';
import { Switch, Route, Link, Redirect, useHistory, useLocation } from 'react-router-dom';
import SplashScreen from './pages/SplashScreen'; // Import the SplashScreen
import HomePage from './pages/HomePage';
import ForgotPasswordPage from './pages/ForgotPasswordPage'; // Import the ForgotPasswordPage
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import CreateRoomPage from './pages/CreateRoomPage'; // Import the new page
import RoomPage from './pages/RoomPage'; // Import the actual RoomPage
import ProfilePage from './pages/ProfilePage'; // Import the ProfilePage
import { NotificationProvider } from './contexts/NotificationContext'; // Import NotificationProvider
import ResetPasswordPage from './pages/ResetPasswordPage'; // Import the ResetPasswordPage
import Notification from './components/layout/Notification'; // Import Notification component
import { FaUserCircle, FaUserEdit, FaSignOutAlt, FaPlayCircle } from 'react-icons/fa'; // Added FaBars, FaTimes for mobile menu

import './App.css';

// Placeholder for SignupPage if you want to add it to nav
// import SignupPage from './pages/SignupPage';
// const SignupPagePlaceholder = () => <h2>Signup Page (Placeholder)</h2>;
import SignupPage from './pages/SignupPage'; // Import the SignupPage
import VerifyEmailPage from './pages/VerifyEmailPage'; // Import VerifyEmailPage
import ResendVerificationPage from './pages/ResendVerificationPage'; // Import ResendVerificationPage

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState(null); // To store user info like username
  const [authLoading, setAuthLoading] = useState(true); // New state for initial auth check
  const location = useLocation(); // Get current location
  const history = useHistory();

  // Check for token on initial load
  useEffect(() => {
    const token = localStorage.getItem('watchPartyToken');
    setAuthLoading(true); // Start loading
    const storedUser = localStorage.getItem('watchPartyUser');
    if (token && storedUser) {
      const parsedUser = JSON.parse(storedUser);
      // Standardize to use 'id' property
      const userToSet = {
        id: parsedUser.userId || parsedUser._id || parsedUser.id, // Prioritize, then fallback
        username: parsedUser.username,
        email: parsedUser.email // if available
      };
      setCurrentUser(userToSet);
      setIsLoggedIn(true);
      console.log("Restored user from localStorage and standardized:", userToSet);

      setAuthLoading(false); // Finish loading since we have token and user
    } else if (token && !storedUser) {
      // Token exists but no storedUser, try to fetch user details from backend
      const fetchUserOnLoad = async () => {
        try {
          const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001'; // Fallback for safety
          const response = await fetch(`${apiUrl}/api/auth/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (response.ok) {
            const userData = await response.json();
            if (userData.success && userData.data) {
              // Standardize to use 'id' property
              const userToSet = {
                id: userData.data._id || userData.data.userId || userData.data.id,
                username: userData.data.username,
                email: userData.data.email
              };
              setCurrentUser(userToSet);
              setIsLoggedIn(true); // CRITICAL: Set isLoggedIn to true here
              localStorage.setItem('watchPartyUser', JSON.stringify(userToSet)); // Store standardized user

            } else {
              throw new Error(userData.error || 'Failed to fetch user data');
            }
          } else {
             throw new Error('Token validation failed or user not found');
          }
        } catch (error) {
          console.error("Error fetching user on load with token:", error);
          localStorage.removeItem('watchPartyToken'); // Clear invalid token
          localStorage.removeItem('watchPartyUser');
          setIsLoggedIn(false);
          setCurrentUser(null);
        } finally {
          setAuthLoading(false); // Finish loading
        }
      };
      fetchUserOnLoad();
    } else {
      setAuthLoading(false); // No token, finish loading
    }
  }, []);

  const handleLoginSuccess = () => {
    setIsLoggedIn(true);
    const storedUser = localStorage.getItem('watchPartyUser');
    if (storedUser) {
      const parsedUser = JSON.parse(storedUser);
      setCurrentUser({ id: parsedUser.userId, username: parsedUser.username, email: parsedUser.email }); // Standardize    }
    }
    };

  // If still checking auth, show a loading indicator
  const handleLogout = () => {
    localStorage.removeItem('watchPartyToken');
    localStorage.removeItem('watchPartyUser');
    setIsLoggedIn(false);
    setCurrentUser(null);
    // Redirect to home or login page after logout
    history.push('/login');
  };
  if (authLoading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: 'var(--background-primary)', color: 'var(--text-primary)'}}>Loading application...</div>; // Or a proper spinner component
  }

  return (
    <NotificationProvider>
      <div className="App">
        <nav className="appNavbar">
          <ul className="navLinks"> {/* Group for left-aligned links */}
            <li>
              <Link to="/" className="navLogoLink" title="WatchParty Home">
                <FaPlayCircle className="navLogoIcon" /> WatchParty
              </Link>
            </li>            {/* Conditionally render Dashboard link if logged in AND not on home page AND not on dashboard page */}
            {isLoggedIn && currentUser && location.pathname !== '/' && location.pathname !== '/dashboard' && (
              <li><Link to="/dashboard">Dashboard</Link></li>
            )}          </ul>
          <ul> {/* Group for right-aligned items (auth links or user menu) */}
            {!isLoggedIn && (
              <li>
                <Link to="/login" className="authActionDisplay" title="Login or Signup">
                  <span className="userNameDisplay">Login / Signup</span> {/* Re-use userNameDisplay for style consistency */}
                </Link>
              </li>

            )}
            {isLoggedIn && currentUser && (
              <li className="userMenuContainer">
                <div className="userInfoDisplay" title="User Menu"> {/* Changed button to div */}
                  <FaUserCircle className="userIconButton" /> {/* Icon first */}
                  <span className="userNameDisplay"> {/* Username next */}
                    {currentUser.username}
                  </span>
                </div>
                <div className="dropdownMenu"> {/* Removed conditional rendering */}
                    <Link to="/profile" className="dropdownMenuItem"> {/* Removed onClick */}
                      <FaUserEdit className="dropdownItemIcon" /> Edit Profile
                    </Link>
                    <button 
                      onClick={handleLogout} // Removed setIsDropdownOpen(false)
                      className="dropdownMenuItem">
                      <FaSignOutAlt className="dropdownItemIcon" /> Logout
                    </button>
                </div> {/* Added missing closing div for dropdownMenu */}
              </li>
            )}
          </ul>
        </nav>


    <Notification /> {/* Display notifications here */}

      <div className="pageContent">
          <Switch>
          {/* SplashScreen will be the first route users hit */}
          <Route exact path="/" component={SplashScreen} />

          {/* HomePage is now at /home, SplashScreen will redirect here */}
          <Route path="/home">
             <HomePage isLoggedIn={isLoggedIn} currentUser={currentUser} />
          </Route>
          <Route path="/login">
              {isLoggedIn ? <Redirect to="/dashboard" /> : <LoginPage onLoginSuccess={handleLoginSuccess} />}
            </Route>
            <Route path="/verify-email/:token">
              <VerifyEmailPage />
            </Route>
            <Route path="/resend-verification">
              <ResendVerificationPage />
            </Route>
            {/* Password Reset Routes */}
            <Route path="/forgot-password">
              <ForgotPasswordPage />
            </Route>
            <Route path="/reset-password/:token">
              <ResetPasswordPage />
            </Route>
            <Route path="/signup">
              {isLoggedIn ? <Redirect to="/dashboard" /> : <SignupPage />}
            </Route>        <Route path="/dashboard">
              {isLoggedIn ? <DashboardPage currentUser={currentUser} /> : <Redirect to="/login" />}
            </Route>
            <Route path="/room/create">
              {isLoggedIn ? <CreateRoomPage /> : <Redirect to="/login" />}
            </Route>
            <Route path="/room/:roomId">
            {isLoggedIn && currentUser ? <RoomPage currentUser={currentUser} /> : <Redirect to="/login" />}
            </Route>
            <Route path="/profile">
              {isLoggedIn ? <ProfilePage /> : <Redirect to="/login" />}
            </Route>
            {/* Catch-all or 404 page */}
            <Route path="*">
              <Redirect to="/home" /> {/* Redirect unknown paths to home, or to splash if you prefer initial load */}
            </Route>
          </Switch>
        </div>
      </div>
    </NotificationProvider>
  );
}

export default App;