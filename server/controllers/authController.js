const User = require('../models/User');
const jwt = require('jsonwebtoken');
const crypto = require('crypto'); // For generating tokens
const nodemailer = require('nodemailer'); // Import nodemailer

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h'; // Default to 1 hour if not set
const FRONTEND_URL = process.env.CORS_ORIGIN || 'http://localhost:3000'; // For verification links

if (!JWT_SECRET) {
  console.error('FATAL ERROR: JWT_SECRET is not defined in environment variables. Auth controller cannot sign tokens.');
}

// Email sending utility using Nodemailer with basic HTML templates
const sendEmail = async ({ to, subject, text, html }) => {
  // Create a transporter object using Gmail SMTP.
  // For other services, configuration will differ.
  const transporter = nodemailer.createTransport({
    service: 'gmail', // Or your email provider
    host: process.env.EMAIL_HOST, // e.g., smtp.gmail.com
    port: process.env.EMAIL_PORT, // e.g., 587 for TLS, 465 for SSL
    secure: process.env.EMAIL_SECURE === 'true', // true for 465, false for other ports
    auth: {
      user: process.env.EMAIL_USER, // Your email address from .env
      pass: process.env.EMAIL_PASS, // Your email password or app password from .env
    },
    tls: {
        // This is often needed for local development with self-signed certs or certain providers.
        // Review carefully for production environments.
        rejectUnauthorized: process.env.EMAIL_REJECT_UNAUTHORIZED !== 'false' // Default to true
        }
  });

  const mailOptions = {
    from: `"WatchParty" <${process.env.EMAIL_USER}>`, // sender address
    to: to, // list of receivers
    subject: subject, // Subject line (used for both text and html)
    text: text, // plain text body (fallback)
    html: html, // html body
  };

  try {
    console.log(`Attempting to send email to ${to} with subject "${subject}"`);
    let info = await transporter.sendMail(mailOptions);
    console.log('Email sent: %s', info.messageId);
    return info;
  } catch (error) {
    console.error('Error sending email:', error);
    throw new Error('Failed to send email. Please check server logs.');
  }
};

// --- HTML Email Templates ---

const verificationEmailTemplate = (username, verificationUrl) => `
  <!DOCTYPE html>
  <html lang="en">
  <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Verify Your WatchParty Account</title>
      <style>
          body { font-family: sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; background-color: #f4f4f4; }
          .container { max-width: 600px; margin: 20px auto; background: #fff; padding: 30px; border-radius: 8px; box-shadow: 0 0 10px rgba(0, 0, 0, 0.1); }
          .header { text-align: center; margin-bottom: 20px; }
          .header h1 { color: #3498db; } /* Use your theme color */
          .content { margin-bottom: 20px; }
          .button { display: inline-block; background-color: #3498db; color: #ffffff !important; text-decoration: none; padding: 12px 25px; border-radius: 5px; font-size: 16px; margin-top: 15px; }
          .button:hover { background-color: #2980b9; } /* Darker shade on hover */
          .footer { text-align: center; font-size: 0.9em; color: #777; margin-top: 20px; }
          .footer p { margin: 5px 0; }
      </style>
  </head>
  <body>
      <div class="container">
          <div class="header">
              <h1>WatchParty</h1>
          </div>
          <div class="content">
              <p>Hello ${username},</p>
              <p>Thank you for signing up for WatchParty! To activate your account, please verify your email address by clicking the button below:</p>
              <p style="text-align: center;">
                  <a href="${verificationUrl}" class="button">Verify Email Address</a>
              </p>
              <p>If the button above doesn't work, you can also copy and paste the following link into your web browser:</p>
              <p><small>${verificationUrl}</small></p>
              <p>This link will expire in 10 minutes.</p>
              <p>If you did not create this account, please ignore this email.</p>
          </div>
          <div class="footer">
              <p>&copy; ${new Date().getFullYear()} WatchParty. All rights reserved.</p>
          </div>
      </div>
  </body>
  </html>
`;

const deletionConfirmationTemplate = (username) => `
  <!DOCTYPE html>
  <html lang="en">
  <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Account Deletion Confirmation</title>
      <style>
          body { font-family: sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; background-color: #f4f4f4; }
          .container { max-width: 600px; margin: 20px auto; background: #fff; padding: 30px; border-radius: 8px; box-shadow: 0 0 10px rgba(0, 0, 0, 0.1); }
          .header { text-align: center; margin-bottom: 20px; }
          .header h1 { color: #3498db; }
          .footer { text-align: center; font-size: 0.9em; color: #777; margin-top: 20px; }
      </style>
  </head>
  <body>
      <div class="container">
          <div class="header"><h1>WatchParty</h1></div>
          <p>Hello ${username},</p>
          <p>This email confirms that your WatchParty account has been successfully deleted as per your request.</p>
          <p>We're sorry to see you go!</p>
          <p>If you have any questions or believe this was done in error, please contact our support team.</p>
          <p>Thank you for using WatchParty.</p>
          <p>Sincerely,<br>The WatchParty Team</p>
          <div class="footer"><p>&copy; ${new Date().getFullYear()} WatchParty. All rights reserved.</p></div>
      </div>
  </body>
  </html>
`;

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

    // Generate email verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const emailVerificationToken = crypto
      .createHash('sha256')
      .update(verificationToken)
      .digest('hex');

    const emailVerificationTokenExpires = Date.now() + 10 * 60 * 1000; // Token valid for 10 minutes

    // Create user
    user = await User.create({
      username,
      email: lowercasedEmail,
      password,
      emailVerificationToken,
      emailVerificationTokenExpires,
      isEmailVerified: false, // Explicitly set to false
    });    
    console.log(`User ${username} registered successfully with email ${lowercasedEmail}.`);
    // Send verification email
    const verificationUrl = `${FRONTEND_URL}/verify-email/${verificationToken}`;
    const message = `Please verify your email address by clicking the following link: \n\n ${verificationUrl} \n\nIf you did not create this account, please ignore this email.`;

    await sendEmail({
      to: user.email,
      subject: 'WatchParty - Email Verification',
      text: message, // Plain text fallback
      html: verificationEmailTemplate(user.username, verificationUrl), // HTML version
    });
    res.status(201).json({ success: true, message: 'User registered successfully. Please check your email to verify your account.' });
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
    // Check if email is verified
    if (!user.isEmailVerified) {
      console.log(`Login failed: Email not verified for user ${user.username}`);
      return res.status(401).json({ success: false, error: 'Please verify your email address before logging in.', errorCode: 'ACCOUNT_NOT_VERIFIED' });
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

// @desc    Verify email address
// @route   GET /api/auth/verify-email/:token
// @access  Public
exports.verifyEmail = async (req, res, next) => {
  const verificationToken = req.params.token;
  const hashedToken = crypto
    .createHash('sha256')
    .update(verificationToken)
    .digest('hex');

  try {
    const user = await User.findOne({
      emailVerificationToken: hashedToken,
      emailVerificationTokenExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ success: false, error: 'Invalid or expired verification token.' });
    }

    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationTokenExpires = undefined;
    await user.save();

    res.status(200).json({ success: true, message: 'Email verified successfully. You can now log in.' });
  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({ success: false, error: 'Server error during email verification.' });
  }
};

// @desc    Resend verification email
// @route   POST /api/auth/resend-verification
// @access  Public
exports.resendVerificationEmail = async (req, res, next) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ success: false, error: 'Please provide an email address.' });
  }

  try {
    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      // To prevent user enumeration, send a generic success message even if user not found or already verified
      return res.status(200).json({ success: true, message: 'If an account with that email exists and is unverified, a new verification link has been sent.' });
    }

    if (user.isEmailVerified) {
      return res.status(200).json({ success: true, message: 'This email address is already verified.' });
    }

    // Generate new verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    user.emailVerificationToken = crypto
      .createHash('sha256')
      .update(verificationToken)
      .digest('hex');
    user.emailVerificationTokenExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
    await user.save();

    const verificationUrl = `${FRONTEND_URL}/verify-email/${verificationToken}`;
    const message = `Please verify your email address by clicking the following link: \n\n ${verificationUrl} \n\nIf you did not request this, please ignore this email.`;

    await sendEmail({
      to: user.email,
      subject: 'WatchParty - Resend Email Verification',
      text: message, // Plain text fallback
      html: verificationEmailTemplate(user.username, verificationUrl), // HTML version
    });

    res.status(200).json({ success: true, message: 'A new verification link has been sent to your email address.' });
  } catch (error) {
    console.error('Resend verification email error:', error);
    res.status(500).json({ success: false, error: 'Server error while resending verification email.' });
  }
};

// @desc    Delete user account
// @route   DELETE /api/auth/me/delete
// @access  Private
exports.deleteUserAccount = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });

    const userEmail = user.email; 
    const deletedUsername = user.username; // Get username before deleting
    await User.findByIdAndDelete(req.user.id);

    await sendEmail({
      to: userEmail,
      subject: 'WatchParty Account Deletion Confirmation',
      html: deletionConfirmationTemplate(deletedUsername)
    });
    
    res.json({ success: true, message: 'Account deleted successfully' });
  } catch (error) {
    console.error('Error deleting account:', error);
    res.status(500).json({ success: false, error: 'Server error while deleting account' });
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