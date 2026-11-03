import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { query } from '../config/database.js';
import { authenticate, authorize } from '../middleware/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure upload storage
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const userDir = path.join(UPLOAD_DIR, req.user.id);
    if (!fs.existsSync(userDir)) {
      fs.mkdirSync(userDir, { recursive: true });
    }
    cb(null, userDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e6);
    const ext = path.extname(file.originalname);
    cb(null, `${req.body.document_type || 'doc'}-${uniqueSuffix}${ext}`);
  },
});

const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'application/pdf'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIMES.includes(file.mimetype)) {
      return cb(new Error('Only JPEG, PNG, and PDF files are accepted.'));
    }
    cb(null, true);
  },
});

const DOC_TYPE_ALIASES = {
  pan: 'pan_card',
  pan_card: 'pan_card',
  aadhaar: 'aadhaar_card',
  aadhaar_card: 'aadhaar_card',
  address: 'address_proof',
  address_proof: 'address_proof',
  bank: 'bank_statement',
  bank_statement: 'bank_statement',
  photo: 'photograph',
  photograph: 'photograph',
  signature: 'signature',
  salary: 'salary_slip',
  salary_slip: 'salary_slip',
  other: 'other',
};

const router = Router();

// GET /api/documents/me - List all documents uploaded by the authenticated applicant
router.get('/me', authenticate, authorize('applicant'), async (req, res) => {
  try {
    const result = await query(
      `SELECT d.id, d.application_id, d.document_type, d.original_filename, d.mime_type, 
              d.file_size_bytes, d.verification_status, d.reviewer_note, d.uploaded_at, d.reviewed_at,
              la.application_number
       FROM documents d
       LEFT JOIN loan_applications la ON la.id = d.application_id
       WHERE d.applicant_id = $1
       ORDER BY d.uploaded_at DESC`,
      [req.user.id]
    );
    res.json({ documents: result.rows });
  } catch (err) {
    console.error('Fetch applicant documents error:', err.message);
    res.status(500).json({ error: 'Failed to retrieve documents.' });
  }
});

// POST /api/documents - Upload a document
router.post('/', authenticate, authorize('applicant'), upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded.' });
    }

    const rawDocType = req.body.document_type;
    const document_type = DOC_TYPE_ALIASES[rawDocType] || rawDocType;
    const { application_id } = req.body;

    if (!document_type) {
      return res.status(400).json({ error: 'Document type is required.' });
    }

    // Verify application belongs to this user
    if (application_id) {
      const appCheck = await query(
        'SELECT id FROM loan_applications WHERE id = $1 AND applicant_id = $2',
        [application_id, req.user.id]
      );
      if (appCheck.rows.length === 0) {
        return res.status(403).json({ error: 'Application not found or access denied.' });
      }
    }

    const storageKey = path.relative(UPLOAD_DIR, req.file.path).replace(/\\/g, '/');

    const result = await query(
      `INSERT INTO documents (applicant_id, application_id, document_type, original_filename, 
       mime_type, file_size_bytes, storage_key)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        req.user.id,
        application_id || null,
        document_type,
        req.file.originalname,
        req.file.mimetype,
        req.file.size,
        storageKey,
      ]
    );

    // Audit log
    await query(
      `INSERT INTO audit_logs (actor_user_id, action, entity_type, entity_id, details)
       VALUES ($1, 'DOCUMENT_UPLOADED', 'document', $2, $3)`,
      [req.user.id, result.rows[0].id, JSON.stringify({ document_type, filename: req.file.originalname })]
    );

    res.status(201).json({ message: 'Document uploaded successfully', document: result.rows[0] });
  } catch (err) {
    console.error('Document upload error:', err.message);
    if (err.message.includes('Only JPEG')) {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: 'Document upload failed.' });
  }
});

// GET /api/documents/:id - Get document metadata
router.get('/:id', authenticate, async (req, res) => {
  try {
    const result = await query('SELECT * FROM documents WHERE id = $1', [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Document not found.' });
    }

    const doc = result.rows[0];
    const userRole = (req.user?.role || '').toLowerCase();

    // Applicants can only view their own documents
    if (userRole === 'applicant' && doc.applicant_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    res.json({ document: doc });
  } catch (err) {
    console.error('Document fetch error:', err.message);
    res.status(500).json({ error: 'Failed to retrieve document.' });
  }
});

// GET /api/documents/:id/download - Download document file (supports ?inline=true)
router.get('/:id/download', authenticate, async (req, res) => {
  try {
    const result = await query('SELECT * FROM documents WHERE id = $1', [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Document not found.' });
    }

    const doc = result.rows[0];
    const userRole = (req.user?.role || '').toLowerCase();

    // Applicants can only download their own documents; admin and lender can download any
    if (userRole === 'applicant' && doc.applicant_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    const filePath = path.join(UPLOAD_DIR, doc.storage_key);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Document file not found on server.' });
    }

    const disposition = req.query.inline === 'true' ? 'inline' : 'attachment';
    res.setHeader('Content-Type', doc.mime_type);
    res.setHeader('Content-Disposition', `${disposition}; filename="${doc.original_filename}"`);
    res.sendFile(filePath);
  } catch (err) {
    console.error('Document download error:', err.message);
    res.status(500).json({ error: 'Document download failed.' });
  }
});

// GET /api/documents/:id/view - Inline view endpoint for browser/lightbox preview
router.get('/:id/view', authenticate, async (req, res) => {
  try {
    const result = await query('SELECT * FROM documents WHERE id = $1', [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Document not found.' });
    }

    const doc = result.rows[0];
    const userRole = (req.user?.role || '').toLowerCase();

    if (userRole === 'applicant' && doc.applicant_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    const filePath = path.join(UPLOAD_DIR, doc.storage_key);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Document file not found on server.' });
    }

    res.setHeader('Content-Type', doc.mime_type);
    res.setHeader('Content-Disposition', `inline; filename="${doc.original_filename}"`);
    res.sendFile(filePath);
  } catch (err) {
    console.error('Document view error:', err.message);
    res.status(500).json({ error: 'Document view failed.' });
  }
});

export default router;
