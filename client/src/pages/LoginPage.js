import React, { useState } from 'react';
import { useHistory, Link } from 'react-router-dom';
import '../styles/Form.css'; // Import common form styles


const LoginPage = ({ onLoginSuccess }) => {
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false); // New state for submission
  const [showResendLink, setShowResendLink] = useState(false);
  const history = useHistory();

  const { email, password } = formData;

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true); // Start submission
    setShowResendLink(false);

    try {
      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001';
      const response = await fetch(`${apiUrl}/api/auth/login`, {        
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        // Check for specific error code from backend for unverified account
        if (data.errorCode === 'ACCOUNT_NOT_VERIFIED') {
          setError(data.error || 'Your account is not verified. Please check your email.');
          setShowResendLink(true);
        } else {
          setError(data.error || 'Login failed');
        }
        setIsSubmitting(false); // Stop submission on error
        return; // Stop further processing
      }

      // Store token and user info (e.g., username)
      const userToStore = {
        id: data.userId, // Assuming login API returns userId
        userId: data.userId, // Keep for compatibility if other parts expect userId directly
        username: data.username,
        email: data.email // if available from login response
      };
      localStorage.setItem('watchPartyToken', data.token);
      localStorage.setItem('watchPartyUser', JSON.stringify(userToStore)); 

      onLoginSuccess(); // Notify App component
      history.push('/dashboard'); // Redirect to dashboard
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false); // Stop submission in finally block
    }
  };

  return (
    <div className="formContainer">
      <h2>Login Page</h2>
      {showResendLink && (
        <p style={{ textAlign: 'center', marginTop: '10px' }}>
          <Link to="/resend-verification" className="formLink">Resend verification email?</Link>
        </p>
      )}
      {error && <p className="formError">{error}</p>}
      <form onSubmit={handleSubmit}>
        <div className="formGroup"><label htmlFor="email">Email:</label><input className="formInput" type="email" name="email" id="email" value={email} onChange={handleChange} required /></div>
        <div className="formGroup"><label htmlFor="password">Password:</label><input className="formInput" type="password" name="password" id="password" value={password} onChange={handleChange} required /></div>
        <button type="submit" className="formButton" disabled={isSubmitting}>{isSubmitting ? 'Logging In...' : 'Log In'}</button>
      </form>
      <div style={{ textAlign: 'center', marginTop: '10px' }}> {/* Added a div for better spacing/styling if needed */}
        <Link to="/forgot-password" className="formLink">Forgot your password?</Link>
      </div>
      <Link to="/signup" className="formLink">Don't have an account? Sign up here</Link>
    </div>  );
};

export default LoginPage;