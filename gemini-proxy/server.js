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

// Validate required environment variables
const requiredEnvVars = ['GEMINI_API_KEY', 'JWT_SECRET'];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
}

// FRONTEND_ORIGIN may contain a comma-separated list of allowed origins
const FRONTEND = process.env.FRONTEND_ORIGIN || 'http://localhost:5500';
const ALLOWED_ORIGINS = FRONTEND.split(',').map(s => s.trim()).filter(Boolean);

// Enhanced security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://www.gstatic.com", "https://cdn.jsdelivr.net"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://generativelanguage.googleapis.com"]
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

// CORS with strict origin checking
app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (mobile apps, postman, etc.)
    if (!origin) return callback(null, true);
    
    if (ALLOWED_ORIGINS.indexOf(origin) !== -1) {
      return callback(null, true);
    }
    
    // Enhanced origin validation
    try {
      const url = new URL(origin);
      for (const allowed of ALLOWED_ORIGINS) {
        try {
          const allowedUrl = new URL(allowed);
          if (url.hostname === allowedUrl.hostname && url.port === allowedUrl.port) {
            return callback(null, true);
          }
        } catch (e) { /* ignore malformed URLs */ }
      }
    } catch (e) { /* ignore malformed origin */ }
    
    console.warn(`CORS: Blocked origin ${origin}`);
    return callback(new Error('Not allowed by CORS'), false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cookie']
}));

app.set('trust proxy', 1);

// Enhanced rate limiting
app.use(rateLimit({ 
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP',
  standardHeaders: true,
  legacyHeaders: false
}));

// API-specific rate limiting
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // limit each IP to 20 API calls per minute
  message: 'Too many API requests, please try again later'
});

// Initialize Gemini client with error handling
let genAI = null;
if (process.env.GEMINI_API_KEY) {
  try {
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  } catch (err) {
    console.warn('Failed to initialize Gemini client:', err.message);
  }
} else {
  console.warn('GEMINI_API_KEY not provided - AI features will be disabled');
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

      // Issue JWT with secure secret
      const jwtSecret = process.env.JWT_SECRET;
      if (!jwtSecret || jwtSecret === 'dev_secret_change') {
        throw new Error('Invalid JWT secret configuration');
      }
      const payload = { userId: user.id };
      const token = jwt.sign(payload, jwtSecret, { expiresIn: '7d' });

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
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret || jwtSecret === 'dev_secret_change') {
      return res.status(500).json({ error: 'Server configuration error' });
    }
    const payload = jwt.verify(token, jwtSecret);
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
app.post('/chat', apiLimiter, [
  body('message').isLength({ min: 1, max: 1000 }).trim().escape()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Invalid message format' });
  }
  
  const userMessage = req.body.message;
  if (!genAI) return res.status(503).json({ error: 'AI service not available' });

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
app.post('/diet', apiLimiter, async (req, res) => {
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

app.post('/workout', apiLimiter, async (req, res) => {
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
