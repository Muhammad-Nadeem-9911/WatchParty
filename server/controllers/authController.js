const User = require('../models/User');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h'; // Default to 1 hour if not set

if (!JWT_SECRET) {
  console.error('FATAL ERROR: JWT_SECRET is not defined in environment variables. Auth controller cannot sign tokens.');
}

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
exports.registerUser = async (req, res, next) => {
  const { username, email, password } = req.body;
  console.log(`Registration attempt for email: ${email}, username: ${username}`);
  try {
    const lowercasedEmail = email.toLowerCase(); // Convert email to lowercase

    // Check if user already exists
    let user = await User.findOne({ email: lowercasedEmail });
    if (user) {
      console.log(`Registration failed: Email ${lowercasedEmail} already exists.`);
      return res.status(400).json({ success: false, error: 'User already exists with this email' });
    }
    user = await User.findOne({ username }); // Username check can remain case-sensitive or be made case-insensitive as desired
    if (user) {
      console.log(`Registration failed: Username ${username} already taken.`);
      return res.status(400).json({ success: false, error: 'Username is already taken' });
    }

    // Create user
    user = await User.create({ username, email: lowercasedEmail, password }); // Store lowercase email
    console.log(`User ${username} registered successfully with email ${lowercasedEmail}.`);
    // For now, just send a success message. Later we'll send a JWT token.
    res.status(201).json({ success: true, message: 'User registered successfully' });
  } catch (error) {
    console.error(`Registration error for ${email}:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// @desc    Authenticate user & get token (Login)
// @route   POST /api/auth/login
// @access  Public
exports.loginUser = async (req, res, next) => {
  const { email, password } = req.body;
  console.log(`Login attempt for email: ${email}`); // Log attempt
  // Basic validation
  if (!email || !password) {
    console.log('Login failed: Email or password not provided.');
    return res.status(400).json({ success: false, error: 'Please provide email and password' });
  }

  try {
    // Check for user
    // To handle potential case sensitivity issues with email, convert to lowercase before querying
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');

    if (!user) {
      console.log(`Login failed: User not found for email ${email.toLowerCase()}`);
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }
    console.log(`User found: ${user.username}, ID: ${user._id}`);
    // Be careful logging hashed passwords, even in dev. This is for temporary debugging.
    // console.log(`Stored hashed password: ${user.password}`); 

    // Check if password matches
    const isMatch = await user.matchPassword(password);
    console.log(`Password match result for ${email.toLowerCase()}: ${isMatch}`);

    if (!isMatch) {
      console.log(`Login failed: Password mismatch for user ${user.username}`);
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }
    console.log(`Login successful for user: ${user.username}`);
    // Ensure JWT_SECRET is available before attempting to sign
    if (!JWT_SECRET) {
      console.error('Login failed: JWT_SECRET is not configured on the server.');
      return res.status(500).json({ success: false, error: 'Server authentication configuration error.' });
    }
    // Create token
    const token = jwt.sign({ id: user._id, username: user.username }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    res.status(200).json({ success: true, token, userId: user._id, username: user.username });
  } catch (error) {
    console.error(`Login error for ${email}:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res, next) => {
  try {
    // req.user is set by the 'protect' middleware
    const user = await User.findById(req.user.id).select('-password'); // Exclude password
    res.status(200).json({ success: true, data: user });
  } catch (error) {
    console.error('Error fetching current user:', error);
    res.status(500).json({ success: false, error: 'Server Error' });
  }
};

// @desc    Update user details (e.g., username)
// @route   PUT /api/auth/me/update
// @access  Private
exports.updateUserDetails = async (req, res, next) => {
  const { username } = req.body; // For now, only allowing username update

  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    if (username && username !== user.username) {
      // Check if the new username is already taken by another user
      const existingUser = await User.findOne({ username: username });
      if (existingUser && existingUser._id.toString() !== user._id.toString()) {
        return res.status(400).json({ success: false, error: 'Username already taken' });
      }
      user.username = username;
    }

    await user.save();
    res.status(200).json({ success: true, data: { id: user._id, username: user.username, email: user.email } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// @desc    Update user password
// @route   PUT /api/auth/me/password
// @access  Private
exports.updatePassword = async (req, res, next) => {
  const { currentPassword, newPassword } = req.body;

  // Basic validation
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ success: false, error: 'Please provide current and new passwords' });
  }

  try {
    // Find user by ID and explicitly select the password field
    const user = await User.findById(req.user.id).select('+password');

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // Check if current password matches
    const isMatch = await user.matchPassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({ success: false, error: 'Incorrect current password' });
    }

    // Update password and save (pre-save hook will hash it)
    user.password = newPassword;
    await user.save();

    res.status(200).json({ success: true, message: 'Password updated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};