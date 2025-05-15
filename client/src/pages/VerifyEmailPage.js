import React, { useState, useEffect } from 'react';
import { useParams, useHistory, Link } from 'react-router-dom';
import { useNotification } from '../contexts/NotificationContext';
import '../styles/Form.css'; // Common form styles
import '../styles/Verification.css'; // Verification specific styles

const VerifyEmailPage = () => {
  const { token } = useParams();
  const history = useHistory();
  const { addNotification } = useNotification();
  const [verificationStatus, setVerificationStatus] = useState('verifying'); // 'verifying', 'success', 'error'
  const [message, setMessage] = useState('Verifying your email address...');

  useEffect(() => {
    const verifyToken = async () => {
      if (!token) {
        setMessage('Invalid verification link.');
        setVerificationStatus('error');
        return;
      }

      try {
        const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001';
        // Assuming a GET request, adjust if your backend uses POST
        const response = await fetch(`${apiUrl}/api/auth/verify-email/${token}`);
        const data = await response.json();

        if (response.ok && data.success) {
          setMessage(data.message || 'Email verified successfully! Redirecting to login...');
          setVerificationStatus('success');
          addNotification('Email verified successfully!', 'success');
          setTimeout(() => {
            history.push('/login');
          }, 3000);
        } else {
          setMessage(data.error || 'Failed to verify email. The link may be invalid or expired.');
          setVerificationStatus('error');
          addNotification(data.error || 'Verification failed.', 'error');
        }
      } catch (err) {
        console.error('Verification error:', err);
        setMessage('An error occurred during verification. Please try again later.');
        setVerificationStatus('error');
        addNotification('Verification error.', 'error');
      }
    };

    verifyToken();
  }, [token, history, addNotification]);

  return (
    <div className="formContainer verificationContainer">
      <h2>Email Verification</h2>
      {verificationStatus === 'verifying' && (
        <>
          <div className="spinner"></div>
          <p className="verificationMessage">{message}</p>
        </>
      )}
      {verificationStatus === 'success' && (
        <div className="verificationStatus success">{message}</div>
      )}
      {verificationStatus === 'error' && (
        <>
          <div className="verificationStatus error">{message}</div>
          <p>
            <Link to="/resend-verification" className="formLink">Request a new verification link</Link>
          </p>
        </>
      )}
    </div>
  );
};

export default VerifyEmailPage;