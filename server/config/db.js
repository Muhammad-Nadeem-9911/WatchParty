const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    // Replace with your MongoDB connection string
    // For local MongoDB, it's typically 'mongodb://localhost:27017/watchparty'
    // For MongoDB Atlas, get the connection string from your Atlas dashboard
    const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/watchparty');
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Error connecting to MongoDB: ${error.message}`);
    process.exit(1); // Exit process with failure
  }
};

module.exports = connectDB;