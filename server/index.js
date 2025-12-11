import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';

const app = express();
const PORT = 5000;

// Middleware
app.use(express.json());
app.use(cors());

// MongoDB Connection
mongoose.connect('mongodb://127.0.0.1:27017/dental-booking-app')
  .then(() => console.log('✅ MongoDB Connected Successfully'))
  .catch(err => console.error('❌ MongoDB Connection Error:', err));

// User Schema
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, lowercase: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  name: { type: String, required: true },
  role: { type: String, enum: ['doctor', 'patient'], required: true },
  createdAt: { type: Date, default: Date.now },
  otp: { type: String },
  otpExpires: { type: Date }
});

const User = mongoose.model('User', userSchema);

// --- Routes ---

// Register
app.post('/api/register', async (req, res) => {
  try {
    const { username, email, password, name, role } = req.body;
    
    const existingUser = await User.findOne({ $or: [{ username }, { email }] });
    if (existingUser) {
      return res.status(400).json({ error: 'Username or Email already exists' });
    }

    const newUser = new User({ username, email, password, name, role });
    await newUser.save();
    
    const userResponse = newUser.toObject();
    delete userResponse.password;
    delete userResponse.otp;
    delete userResponse.otpExpires;

    res.status(201).json(userResponse);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Login
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    const user = await User.findOne({ username: username.toLowerCase() });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    if (user.password !== password) {
      return res.status(401).json({ error: 'Invalid password.' });
    }

    const userResponse = user.toObject();
    delete userResponse.password;
    delete userResponse.otp;
    delete userResponse.otpExpires;

    res.json(userResponse);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Forgot Password
app.post('/api/forgot-password', async (req, res) => {
  try {
    const { identifier } = req.body; // email or username
    const user = await User.findOne({ $or: [{ username: identifier }, { email: identifier }] });
    
    if (!user) {
      // For security, do not reveal if user exists or not, but for this demo app we might return 404
      return res.status(404).json({ error: 'User not found' });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.otp = otp;
    user.otpExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
    await user.save();

    console.log(`
      ----------------------------------------------------
      🔑 PASSWORD RESET OTP
      ----------------------------------------------------
      User: ${user.username}
      OTP: ${otp}
      ----------------------------------------------------
    `);

    res.json({ message: 'OTP sent successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Reset Password
app.post('/api/reset-password', async (req, res) => {
  try {
    const { identifier, otp, newPassword } = req.body;
    const user = await User.findOne({ 
      $or: [{ username: identifier }, { email: identifier }],
      otp: otp,
      otpExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired OTP' });
    }

    user.password = newPassword;
    user.otp = undefined;
    user.otpExpires = undefined;
    await user.save();

    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
