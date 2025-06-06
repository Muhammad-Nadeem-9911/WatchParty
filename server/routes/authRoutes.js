const express = require('express');
const router = express.Router();
const { registerUser, loginUser, getMe, updateUserDetails, updatePassword, deleteUserAccount, verifyEmail, resendVerificationEmail, forgotPassword, resetPassword } = require('../controllers/authController'); // Added email verification and password reset functions
const { protect } = require('../middlewares/authMiddleware'); // Import protect middleware

// @route   POST /api/auth/register
router.post('/register', registerUser);

// @route   POST /api/auth/login
router.post('/login', loginUser);

// @route   GET /api/auth/me
router.get('/me', protect, getMe); // Protect this route

// @route   PUT /api/auth/me/update
router.put('/me/update', protect, updateUserDetails); // Protect this route

// @route   PUT /api/auth/me/password
router.put('/me/password', protect, updatePassword); // Protect this route

// @route   DELETE /api/auth/me/delete
router.delete('/me/delete', protect, deleteUserAccount); // Protect this route

// @route   GET /api/auth/verify-email/:token
router.get('/verify-email/:token', verifyEmail);

// @route   POST /api/auth/resend-verification
router.post('/resend-verification', resendVerificationEmail);

// @route   POST /api/auth/forgot-password
router.post('/forgot-password', forgotPassword);

// @route   PUT /api/auth/reset-password/:resetToken
router.put('/reset-password/:resetToken', resetPassword);


module.exports = router;