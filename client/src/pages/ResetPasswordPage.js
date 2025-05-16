import React, { useState, useEffect } from 'react';
import { useParams, useHistory, Link } from 'react-router-dom'; // Changed useNavigate to useHistory
import axios from 'axios'; // Or your preferred HTTP client

const ResetPasswordPage = () => {
  const { token } = useParams(); // Get token from URL
  const history = useHistory(); // Changed to useHistory

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isTokenValid, setIsTokenValid] = useState(true); // Assume valid initially, can add a check

  // Optional: You could add a check here to see if the token format is plausible
  // or even make a lightweight API call to check token validity on page load,
  // but the main validation happens on submit.
  useEffect(() => {
    if (!token) {
      setError('No reset token provided. Please use the link from your email.');
      setIsTokenValid(false);
    }
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage('');
    setError('');

    if (!password || !confirmPassword) {
      setError('Please fill in both password fields.');
      setIsLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      setIsLoading(false);
      return;
    }

    // Optional: Add password strength validation here

    try {
      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001'; // Define the API base URL
      // Actual API call with a flag to skip global notifications
      const response = await axios.put(
        `${apiUrl}/api/auth/reset-password/${token}`,
        { password },
        { meta: { skipGlobalNotification: true } } // Add this config
      );



      if (response.data.success) {
        setMessage(response.data.message);
        setPassword('');
        setConfirmPassword('');
        // Optionally, redirect to login after a short delay
        setTimeout(() => history.push('/login'), 3000); // Changed navigate to history.push
      } else {
        setError(response.data.error || 'Failed to reset password.');
      }
    } catch (err) {
      console.error('Reset password error:', err);
      const errorMessage = err.response?.data?.error || err.message || 'An error occurred. Please try again.';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };


  if (!isTokenValid) {
    return (
      <div className="formContainer">
        <h2>Reset Password</h2>
        {error && <p className="formError">{error}</p>}
        <Link to="/forgot-password" className="formLink">Request a new reset link</Link>
      </div>
    );
  }

  return (
    <div className="formContainer">
      <h2>Set Your New Password</h2>
      <form onSubmit={handleSubmit}>
        <div className="formGroup">
          <label htmlFor="password">New Password</label>
          <input type="password" id="password" className="formInput" value={password} onChange={(e) => setPassword(e.target.value)} required disabled={isLoading} />
        </div>
        <div className="formGroup">
          <label htmlFor="confirmPassword">Confirm New Password</label>
          <input
            type="password"
            id="confirmPassword"
            className="formInput"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            disabled={isLoading}
          />
        </div>
        {message && <p className="formSuccess">{message}</p>}
        {error && <p className="formError">{error}</p>}
        <button type="submit" className="formButton" disabled={isLoading || !!message}>
          {isLoading ? 'Resetting...' : 'Reset Password'}
        </button>
      </form>
      {message && <Link to="/login" className="formLink">Proceed to Login</Link>}
    </div>
  );
};

export default ResetPasswordPage;