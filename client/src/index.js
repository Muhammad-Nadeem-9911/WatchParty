import React from 'react';
import ReactDOM from 'react-dom';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { BrowserRouter as Router } from 'react-router-dom';

// Attempt to polyfill process for libraries that might expect it
if (typeof window !== 'undefined' && typeof window.process === 'undefined') {
  window.process = {
    env: { DEBUG: undefined }, // Provide a minimal env object
    // Add other properties if specific libraries complain about them
  };
}

// You can create a global CSS file later if needed, e.g., './index.css'

ReactDOM.render(
  <React.StrictMode>
    <Router>
      <App />
    </Router>
  </React.StrictMode>,
  document.getElementById('root')
);

reportWebVitals();