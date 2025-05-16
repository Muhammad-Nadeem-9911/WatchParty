import React, { useState } from 'react';
import { Link, useHistory } from 'react-router-dom'; // Changed useNavigate to useHistory
import axios from 'axios'; // Or your preferred HTTP client
import '../styles/Form.css'; // Import common form styles

const ForgotPasswordPage = () => {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const history = useHistory(); // Changed to useHistory

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage('');
    setError('');

    if (!email) {
      setError('Please enter your email address.');
      setIsLoading(false);
      return;
    }

    try {
        const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001'; // Define the API base URL
      // Actual API call
        const response = await axios.post(
        `${apiUrl}/api/auth/forgot-password`,
        { email },
        { meta: { skipGlobalNotification: true } } // Add this config
      );
      if (response.data.success) {
        setMessage(response.data.message);
        setEmail(''); // Clear the email field
      } else {
        // This part might not be reached if backend always returns 200 for this endpoint
        setError(response.data.error || 'An unexpected error occurred.');
      }
    } catch (err) {
      console.error('Forgot password error:', err);
      // Check if the error response has a specific message
      const errorMessage = err.response?.data?.error || err.message || 'Failed to send reset link. Please try again.';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

 

  return (
    <div className="formContainer">
      <h2>Forgot Your Password?</h2>
      <p style={{ textAlign: 'center', color: 'var(--text-secondary)', marginBottom: '25px' }}>
        Enter your email address below and we'll send you a link to reset your password.
      </p>
      <form onSubmit={handleSubmit}>
        <div className="formGroup">
          <label htmlFor="email">Email Address</label>
          <input
            type="email"
            id="email"
            className="formInput"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            disabled={isLoading}
          />
        </div>
        {/* Assuming Form.css has styles for .formSuccess and .formError */}
        {message && <p className="formSuccess">{message}</p>}
        {error && <p className="formError">{error}</p>}
        <button type="submit" className="formButton" disabled={isLoading}>
          {isLoading ? 'Sending...' : 'Send Reset Link'}
        </button>
      </form>
      <Link to="/login" className="formLink">Remember your password? Login</Link>
    </div>
  );
};

export default ForgotPasswordPage;