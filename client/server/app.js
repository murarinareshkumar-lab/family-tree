import express from 'express';
import { decryptPii } from '../lib/crypto-pii.js';
import healthRouter from './routes/health.js';
import surnamesRouter from './routes/surnames.js';
import familiesRouter from './routes/families.js';
import treeRouter from './routes/tree.js';
import requestsRouter from './routes/requests.js';
import otpRouter from './routes/otp.js';
import adminRouter from './routes/admin.js';

const app = express();

// Parse JSON and form bodies
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// In-transit payload decryption middleware (transparently handles AES-256-GCM encrypted bodies)
app.use((req, res, next) => {
  if (req.body && typeof req.body === 'object' && req.body.encrypted_payload) {
    try {
      const decrypted = decryptPii(req.body.encrypted_payload);
      if (decrypted) {
        req.body = JSON.parse(decrypted);
      }
    } catch (err) {
      console.warn('[In-Transit Decryption] Error parsing decrypted body:', err.message);
    }
  }
  next();
});

// Sub-router containing all API routes
const apiRouter = express.Router();
apiRouter.use('/health', healthRouter);
apiRouter.use('/surnames', surnamesRouter);
apiRouter.use('/families', familiesRouter);
apiRouter.use('/tree', treeRouter);
apiRouter.use('/requests', requestsRouter);
apiRouter.use('/otp', otpRouter);
apiRouter.use('/admin', adminRouter);

// Mount under both /api and / so it works seamlessly whether Vercel strips /api or preserves it
app.use('/api', apiRouter);
app.use('/', apiRouter);

// Friendly 404 handler - never return raw technical errors like NOT_FOUND
app.use((req, res) => {
  res.status(404).json({
    ok: false,
    error: 'The requested service is currently unavailable. Please verify the URL or try again.'
  });
});

// Friendly error handler
app.use((err, req, res, next) => {
  console.error('API Error:', err);
  res.status(err.status || 500).json({
    ok: false,
    error: err.message || 'An unexpected error occurred. Please try again later.'
  });
});

export default app;

