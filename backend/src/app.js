import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from backend/.env or root .env
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });
dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env') });

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { testConnection } from './config/database.js';

// Route imports
import authRoutes from './routes/auth.js';
import applicantRoutes from './routes/applicants.js';
import applicationRoutes from './routes/applications.js';
import documentRoutes from './routes/documents.js';
import loanRoutes from './routes/loans.js';
import repaymentRoutes from './routes/repayments.js';
import adminRoutes from './routes/admin.js';

const app = express();
const PORT = process.env.PORT || 5000;
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:5173';

// ──── Security Headers ────
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// ──── CORS ────
app.use(cors({
  origin: FRONTEND_ORIGIN,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ──── Body Parsing ────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ──── Rate Limiting ────
const isDevOrTest = process.env.NODE_ENV !== 'production';

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isDevOrTest ? 1000 : 20,
  message: { error: 'Too many requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDevOrTest ? 5000 : 200,
  message: { error: 'Too many requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', generalLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// ──── Health Check ────
app.get('/api/health', async (req, res) => {
  const dbOk = await testConnection();
  res.json({
    status: dbOk ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    service: 'CredChain API',
    database: dbOk ? 'connected' : 'disconnected',
  });
});

// ──── API Routes ────
app.use('/api/auth', authRoutes);
app.use('/api/applicants', applicantRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/loans', loanRoutes);
app.use('/api/repayments', repaymentRoutes);
app.use('/api/admin', adminRoutes);

// ──── Global Error Handler ────
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.message);

  // Multer file size error
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'File size exceeds the 10MB limit.' });
  }

  // Multer general error or file filter rejection
  if (err.name === 'MulterError' || (err.message && err.message.includes('Only JPEG, PNG, and PDF'))) {
    return res.status(400).json({ error: err.message });
  }

  res.status(500).json({
    error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error.',
  });
});

// ──── 404 Handler ────
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.url} not found.` });
});

// ──── Start Server ────
async function startServer() {
  console.log('\n🚀 CredChain API Server Starting...');
  console.log(`📡 Connecting to PostgreSQL...`);

  const dbOk = await testConnection();
  if (!dbOk) {
    console.error('❌ Cannot start server without database connection.');
    console.error('👉 Run "npm run db:setup" first, then restart the server.');
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log(`\n✅ CredChain API Server running at http://localhost:${PORT}`);
    console.log(`📋 Health check: http://localhost:${PORT}/api/health`);
    console.log(`🔗 Frontend origin: ${FRONTEND_ORIGIN}`);
    console.log(`🔐 Auth endpoints: POST /api/auth/login, POST /api/auth/register`);
    console.log(`\n📌 Available API Routes:`);
    console.log(`   AUTH:         /api/auth/*`);
    console.log(`   APPLICANTS:   /api/applicants/*`);
    console.log(`   APPLICATIONS: /api/applications/*`);
    console.log(`   DOCUMENTS:    /api/documents/*`);
    console.log(`   LOANS:        /api/loans/*`);
    console.log(`   REPAYMENTS:   /api/repayments/*`);
    console.log(`   ADMIN:        /api/admin/*`);
    console.log('');
  });
}

startServer();

export default app;
