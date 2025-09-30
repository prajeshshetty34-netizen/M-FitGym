require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const { open } = require('sqlite');
const sqlite3 = require('sqlite3');
const { body, validationResult } = require('express-validator');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
const port = process.env.PORT || 3000;
// FRONTEND_ORIGIN may contain a comma-separated list of allowed origins, e.g.
// FRONTEND_ORIGIN=http://localhost:5500,http://127.0.0.1:5500
const FRONTEND = process.env.FRONTEND_ORIGIN || 'http://localhost:5500';
const ALLOWED_ORIGINS = FRONTEND.split(',').map(s => s.trim()).filter(Boolean);

// Basic security
app.use(helmet());
app.use(express.json());
app.use(cookieParser());
// Use a dynamic origin function so we can allow multiple origins (localhost and 127.0.0.1)
app.use(cors({
  origin: function(origin, callback) {
    // If no origin (e.g., same-origin or non-browser tool), allow
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.indexOf(origin) !== -1) return callback(null, true);
    // As a fallback, allow matching localhost with same port if configured
    try {
      const url = new URL(origin);
      const hostport = `${url.hostname}:${url.port}`;
      for (const allowed of ALLOWED_ORIGINS) {
        try {
          const a = new URL(allowed);
          if (`${a.hostname}:${a.port}` === hostport) return callback(null, true);
        } catch (e) { /* ignore */ }
      }
    } catch (e) { /* ignore */ }
    // Respond with false (not allowed) rather than an error to let the CORS middleware handle preflight properly
    return callback(null, false);
  },
  credentials: true
}));
app.set('trust proxy', 1);

// Rate limiter
app.use(rateLimit({ windowMs: 60 * 1000, max: 120 }));

// Initialize Gemini client (if key provided)
let genAI = null;
if (process.env.GEMINI_API_KEY) {
  try {
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  } catch (err) {
    console.warn('Failed to initialize Gemini client:', err.message);
  }
}

// Initialize SQLite DB
let db;
(async () => {
  db = await open({ filename: './data.sqlite', driver: sqlite3.Database });
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
})();

// Signup endpoint
app.post('/api/signup',
  body('name').isLength({ min: 2 }).trim().escape(),
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: 'Validation failed', details: errors.array() });

    const { name, email, password } = req.body;
    try {
      const salt = await bcrypt.genSalt(12);
      const hash = await bcrypt.hash(password, salt);
      await db.run('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)', [name, email, hash]);
      return res.status(201).json({ message: 'User created' });
    } catch (err) {
      if (err && err.code === 'SQLITE_CONSTRAINT') return res.status(409).json({ error: 'Email already in use' });
      console.error(err);
      return res.status(500).json({ error: 'Server error' });
    }
  });

// Login endpoint
app.post('/api/login',
  body('email').isEmail().normalizeEmail(),
  body('password').exists(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: 'Validation failed', details: errors.array() });

    const { email, password } = req.body;
    try {
      const user = await db.get('SELECT id, password_hash FROM users WHERE email = ?', [email]);
      if (!user) return res.status(401).json({ error: 'Invalid credentials' });
      const match = await bcrypt.compare(password, user.password_hash);
      if (!match) return res.status(401).json({ error: 'Invalid credentials' });

      // Issue JWT
      const payload = { userId: user.id };
      const token = jwt.sign(payload, process.env.JWT_SECRET || 'dev_secret_change', { expiresIn: '7d' });

      // Set HttpOnly cookie
      res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      });

      return res.json({ message: 'Logged in', userId: user.id });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Server error' });
    }
  });

// Endpoint to get current user based on cookie
app.get('/api/me', async (req, res) => {
  const token = req.cookies && req.cookies.token;
  if (!token) return res.status(401).json({ error: 'Not authenticated' });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'dev_secret_change');
    const user = await db.get('SELECT id, name, email, created_at FROM users WHERE id = ?', [payload.userId]);
    if (!user) return res.status(404).json({ error: 'User not found' });
    return res.json({ user });
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
});

// Logout endpoint
app.post('/api/logout', (req, res) => {
  res.clearCookie('token');
  return res.json({ message: 'Logged out' });
});

// Chat endpoint (proxied to Gemini if configured)
app.post('/chat', async (req, res) => {
  const userMessage = req.body.message;
  if (!userMessage) return res.status(400).json({ error: 'Message is required' });
  if (!genAI) return res.status(503).json({ error: 'AI not configured' });

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    const result = await model.generateContent(userMessage);
    const response = await result.response;
    const text = response.text();
    res.json({ reply: text });
  } catch (error) {
    console.error('Error calling Gemini API:', error);
    res.status(500).json({ error: 'Failed to get response from AI' });
  }
});

// Basic endpoints for diet/workout proxy if needed
app.post('/diet', async (req, res) => {
  if (!genAI) return res.status(503).json({ error: 'AI not configured' });
  try {
    const { prompt } = req.body;
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    res.json({ reply: response.text() });
  } catch (error) {
    console.error('Diet API Error:', error);
    res.status(500).json({ error: 'Failed to generate diet plan' });
  }
});

app.post('/workout', async (req, res) => {
  if (!genAI) return res.status(503).json({ error: 'AI not configured' });
  try {
    const { gender, age, goal, level } = req.body;
    const prompt = `Act as a professional fitness trainer. Create a detailed weekly workout plan in Markdown format for a ${level} level person. The person's gender is ${gender}, age is ${age}, and their primary goal is ${goal}. The plan should be structured with headings for each day (e.g., Day 1, Day 2), bold text for exercise names, and include details on sets, reps, and a brief description. Do not include a meal plan.`;
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    res.json({ reply: response.text() });
  } catch (error) {
    console.error('Workout API Error:', error);
    res.status(500).json({ error: 'Failed to generate workout plan' });
  }
});

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});
