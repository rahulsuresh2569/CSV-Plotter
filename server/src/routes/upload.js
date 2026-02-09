import { Router } from 'express';
import multer from 'multer';
import { validateFile } from '../utils/validators.js';
import { parseCSV, ParseError } from '../services/parser.js';

const router = Router();

// Store uploaded file in memory (no disk writes). Limit to 10 MB.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

router.post('/upload', (req, res) => {
  // Use multer manually so we can catch its errors in one place
  const uploadMiddleware = upload.single('file');

  uploadMiddleware(req, res, (multerErr) => {
    // --- Multer errors (file too large, etc.) ---
    if (multerErr) {
      if (multerErr.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({
          error: 'This file exceeds the 10 MB limit. Please upload a smaller file.',
          code: 'FILE_TOO_LARGE',
        });
      }
      return res.status(400).json({
        error: 'Error processing the uploaded file.',
        code: 'UPLOAD_ERROR',
      });
    }

    try {
      // --- Validate the file ---
      const validation = validateFile(req.file);
      if (!validation.valid) {
        return res.status(400).json({
          error: validation.error,
          code: validation.code,
        });
      }

      // --- Extract optional override params from the form body ---
      const overrides = {
        delimiter: req.body?.delimiter || 'auto',
        decimal: req.body?.decimal || 'auto',
        hasHeader: req.body?.hasHeader || 'auto',
      };

      // --- Run the parsing pipeline ---
      const result = parseCSV(req.file.buffer, overrides);
      result.metadata.originalFileName = req.file.originalname;

      return res.json(result);
    } catch (err) {
      // ParseError = known, user-facing error
      if (err instanceof ParseError) {
        const response = { error: err.message, code: err.code };
        if (err.metadata) {
          response.metadata = {
            ...err.metadata,
            originalFileName: req.file?.originalname || null,
          };
        }
        return res.status(400).json(response);
      }

      // Unexpected error
      console.error('Upload error:', err);
      return res.status(500).json({
        error: 'Internal server error',
        code: 'SERVER_ERROR',
      });
    }
  });
});

export default router;
