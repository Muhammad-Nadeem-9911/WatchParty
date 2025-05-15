import React, { useState, useEffect } from 'react';
import { useHistory } from 'react-router-dom'; // Import useHistory for redirection
import '../styles/Form.css'; // Import common form styles
import './ProfilePage.css'; // <--- THIS IMPORT IS CRUCIAL
import { FaUserEdit, FaKey } from 'react-icons/fa'; // Icons for sections
import ConfirmModal from '../components/common/ConfirmModal'; // Import the modal
import { useNotification } from '../contexts/NotificationContext'; // For success/error messages

const ProfilePage = () => {
  const [userData, setUserData] = useState({ username: '', email: '' });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [passwordFormData, setPasswordFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmNewPassword: '',
  });
  const [successMessage, setSuccessMessage] = useState('');
  const { addNotification } = useNotification(); // Use notification context
  const history = useHistory(); // For redirection
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  useEffect(() => {
    const fetchUserProfile = async () => {
      setIsLoading(true);
      setError('');
      const token = localStorage.getItem('watchPartyToken');
      if (!token) {
        setError('Not authorized. Please log in.');
        setIsLoading(false);
        // Optionally redirect to login
        return;
      }

      try {
        const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001';
        const response = await fetch(`${apiUrl}/api/auth/me`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        const result = await response.json();
        if (!response.ok || !result.success) {
          throw new Error(result.error || 'Failed to fetch profile');
        }
        setUserData({ username: result.data.username, email: result.data.email });
      } catch (err) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserProfile();
  }, []);

  const handleProfileUpdateSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');

    // Only update if username has actually changed or if we decide to allow email updates later
    // For now, we only allow username update via this form
    if (userData.username === (JSON.parse(localStorage.getItem('watchPartyUser'))?.username || '')) {
        addNotification('No changes to username detected.', 'info');
        return;    }
    setIsLoading(true);

    const token = localStorage.getItem('watchPartyToken');
    if (!token) {
      setError('Not authorized. Please log in.');
      setIsLoading(false);
      return;
    }

    try {
        const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001';
       
        const response = await fetch(`${apiUrl}/api/auth/me/update`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ username: userData.username }), // Only send username for now
      });
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to update profile');
      }
      addNotification('Profile updated successfully!', 'success');
      setSuccessMessage('Profile updated successfully!'); // Keep local success message if desired
      // Update local storage if username changed, so navbar updates on next App.js effect run or refresh
      localStorage.setItem('watchPartyUser', JSON.stringify({ ...JSON.parse(localStorage.getItem('watchPartyUser')), username: result.data.username }));
    } catch (err) {
      addNotification(err.message, 'error');
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordChange = (e) => {
    setPasswordFormData({ ...passwordFormData, [e.target.name]: e.target.value });
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    setIsLoading(true);

    const { currentPassword, newPassword, confirmNewPassword } = passwordFormData;

    if (newPassword !== confirmNewPassword) {
      addNotification('New passwords do not match.', 'error');
      setError('New passwords do not match');
      setIsLoading(false);
      return;
    }

    const token = localStorage.getItem('watchPartyToken');
    if (!token) {
      addNotification('Not authorized. Please log in.', 'error');
      setIsLoading(false);
      return;
    }

    try {
       const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001';
       const response = await fetch(`${apiUrl}/api/auth/me/password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to change password');
      }
      addNotification('Password changed successfully!', 'success');
      setSuccessMessage('Password changed successfully!'); // Keep local success message if desired
      setPasswordFormData({ currentPassword: '', newPassword: '', confirmNewPassword: '' }); // Clear form
    } catch (err) {
      setError(err.message);
      addNotification(err.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };
  const openDeleteAccountModal = () => {
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDeleteAccount = async () => {
    setIsDeleteModalOpen(false);
    setError('');
    setSuccessMessage('');
    setIsLoading(true);

    const token = localStorage.getItem('watchPartyToken');
    if (!token) {
      addNotification('Not authorized. Please log in.', 'error');
      setIsLoading(false);
      return;
    }

    try {
       const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001';
       const response = await fetch(`${apiUrl}/api/auth/me/delete`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (response.ok) {
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.indexOf("application/json") !== -1) {
          const result = await response.json(); // Now it's safer to parse
          if (result.success) {
            addNotification('Account deleted successfully.', 'success');
            localStorage.removeItem('watchPartyToken');
            localStorage.removeItem('watchPartyUser');
            history.push('/'); 
            window.location.reload(); 
          } else {
            // Backend responded with JSON but success: false
            throw new Error(result.error || 'Failed to delete account (server error)');
          }
        } else {
          // Response was OK, but not JSON. This is unusual for a successful DELETE.
          const textResponse = await response.text();
          console.error("Server responded with OK status but non-JSON content:", textResponse);
          throw new Error('Account deletion status unclear: Server sent non-JSON response.');
        }
      } else {
        // Response not OK (e.g., 400, 401, 403, 404, 500)
        let errorMessage = `Failed to delete account. Status: ${response.status}`;
        try {
          // Try to parse error as JSON, as backend might send structured errors
          const errorResult = await response.json(); // This might fail if HTML
          errorMessage = errorResult.error || errorResult.message || errorMessage;
        } catch (e) {
          // If parsing error as JSON fails, it's likely HTML or plain text
          const textResponse = await response.text(); // Get the HTML/text
          console.error("Server returned non-JSON error. Response body:", textResponse); 
          errorMessage = `Failed to delete account. Server returned an unexpected response (Status: ${response.status}). Check console for details.`;
        }
        throw new Error(errorMessage);
      }
    } catch (err) {
      addNotification(err.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };
  return (
    <div className="formContainer"> {/* Use formContainer for overall page structure */}
      <h2 className="profilePageMainHeading">Edit Profile</h2>
      {/* Messages can be styled with formSuccess/formError or specific classes */}
      {successMessage && <p className="formSuccess">{successMessage}</p>}
      {error && <p className="formError">{error}</p>}

      <div className="profileLayoutContainer"> {/* New wrapper for side-by-side layout */}
        <div className="profileSection">
          <h3><FaUserEdit /> User Details</h3>
          {isLoading && !error && <p>Loading user data...</p>}
          {!isLoading && !error && userData && (
            <form onSubmit={handleProfileUpdateSubmit}>
            <div className="formGroup">
              <label htmlFor="username">Username:</label>
              <input
                className="formInput"
                type="text"
                id="username"
                name="username"
                value={userData.username}
                onChange={(e) => setUserData({ ...userData, username: e.target.value })}
              />
            </div>
            <div className="formGroup">
              <label htmlFor="email">Email:</label>
              <input className="formInput" type="email" id="email" name="email" value={userData.email} readOnly />
            </div>
            <button type="submit" className="formButton" disabled={isLoading}>{isLoading ? 'Saving...' : 'Save Changes'}</button>
            {/* Add some space and then the delete button */}
            <button type="button" onClick={openDeleteAccountModal} className="formButton deleteAccountButton" disabled={isLoading}>
              {isLoading ? 'Processing...' : 'Delete Account'}
            </button>
          </form>
          )}
        </div>

       <div className="profileSection">
          <h3><FaKey /> Change Password</h3>
          <form onSubmit={handlePasswordSubmit}>
            <div className="formGroup">
              <label htmlFor="currentPassword">Current Password:</label>
              <input className="formInput" type="password" id="currentPassword" name="currentPassword" value={passwordFormData.currentPassword} onChange={handlePasswordChange} required />
            </div>
            <div className="formGroup">
              <label htmlFor="newPassword">New Password:</label>
              <input className="formInput" type="password" id="newPassword" name="newPassword" value={passwordFormData.newPassword} onChange={handlePasswordChange} minLength="6" required />
            </div>
            <div className="formGroup">
              <label htmlFor="confirmNewPassword">Confirm New Password:</label>
              <input className="formInput" type="password" id="confirmNewPassword" name="confirmNewPassword" value={passwordFormData.confirmNewPassword} onChange={handlePasswordChange} required />
            </div>
            <button type="submit" className="formButton" disabled={isLoading}>{isLoading ? 'Changing...' : 'Change Password'}</button>
          </form>
        </div>
      </div>
      <ConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleConfirmDeleteAccount}
        title="Delete Account"
        message="Are you sure you want to permanently delete your account? This action cannot be undone."
        confirmText="Delete My Account"
        cancelText="Cancel"
      />
    </div>
  );
};

export default ProfilePage;