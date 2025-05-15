import React, { useState } from 'react';
import { useHistory, Link } from 'react-router-dom';
import { useNotification } from '../contexts/NotificationContext';
import '../styles/Form.css'; // Common form styles
import '../styles/Verification.css'; // Verification specific styles

const ResendVerificationPage = () => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { addNotification } = useNotification();
  const history = useHistory();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001';
      const response = await fetch(`${apiUrl}/api/auth/resend-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();

      if (response.ok && data.success) {
        addNotification(data.message || 'If an account with that email exists and is unverified, a new verification link has been sent.', 'success');
        // Optionally redirect or just show message
        history.push('/login'); // Or stay on page
      } else {
        addNotification(data.error || 'Failed to resend verification email.', 'error');
      }
    } catch (err) {
      console.error('Resend verification error:', err);
      addNotification('An error occurred. Please try again.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="formContainer">
      <h2>Resend Verification Email</h2>
      <form onSubmit={handleSubmit}>
        <div className="formGroup">
          <label htmlFor="email">Email Address:</label>
          <input
            className="formInput"
            type="email"
            id="email"
            name="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={isLoading}
          />
        </div>
        <button type="submit" className="formButton" disabled={isLoading}>
          {isLoading ? 'Sending...' : 'Resend Verification Email'}
        </button>
      </form>
      {isLoading && <div className="spinner" style={{ margin: '20px auto' }}></div>}
      <p style={{ textAlign: 'center', marginTop: '20px' }}>
        <Link to="/login" className="formLink">Back to Login</Link>
      </p>
    </div>
  );
};

export default ResendVerificationPage;