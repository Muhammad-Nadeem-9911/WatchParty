import React, { useState } from 'react';
import { useHistory, Link } from 'react-router-dom';
import '../styles/Form.css'; // Import common form styles

const SignupPage = () => {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false); // New state for submission
  const history = useHistory();

  const { username, email, password, confirmPassword } = formData;

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsSubmitting(true); // Start submission

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      setIsSubmitting(false); // Stop submission
      return;
    }

    try {
      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001';
      const response = await fetch(`${apiUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to register');
      }

      setSuccess('Registration successful! Please check your email to verify your account.');
      // Do not redirect automatically, user needs to verify first.
      // setTimeout(() => history.push('/login'), 3000); // Or redirect to a page saying "check your email"
    } catch (err) {
      setError(err.message);
      } finally {
      setIsSubmitting(false); // Stop submission in finally block
    }
  };

  return (
    <div className="formContainer">
      <h2>Sign Up for WatchParty</h2>
      {error && <p className="formError">{error}</p>}
      {success && <p className="formSuccess">{success}</p>}

      <form onSubmit={handleSubmit}>
        <div className="formGroup"><label htmlFor="username">Username:</label><input className="formInput" type="text" name="username" id="username" value={username} onChange={handleChange} required /></div>
        <div className="formGroup"><label htmlFor="email">Email:</label><input className="formInput" type="email" name="email" id="email" value={email} onChange={handleChange} required /></div>
        <div className="formGroup"><label htmlFor="password">Password:</label><input className="formInput" type="password" name="password" id="password" value={password} onChange={handleChange} minLength="6" required /></div>
        <div className="formGroup"><label htmlFor="confirmPassword">Confirm Password:</label><input className="formInput" type="password" name="confirmPassword" id="confirmPassword" value={confirmPassword} onChange={handleChange} required disabled={isSubmitting} /></div>
        <button type="submit" className="formButton" disabled={isSubmitting}>{isSubmitting ? 'Signing Up...' : 'Sign Up'}</button>

      </form>
      <Link to="/login" className="formLink">Already have an account? Login here</Link>
    </div>
  );
};

export default SignupPage;