require("dotenv").config();
const express = require("express");
const fs = require("fs");
const path = require("path");
const router = express.Router();

const BASE_DIR = process.env.MONITORING_BASE_DIR;
const ALLOWED_EXT = process.env.ALLOWED_EXTENSIONS.split(",");

// Enhanced path validation
const isSafePath = (filePath) => {
  try {
    const resolvedPath = path.normalize(filePath).replace(/\\/g, '/');
    const baseDir = path.normalize(BASE_DIR).replace(/\\/g, '/');
    
    // Additional check for directory traversal
    if (resolvedPath.includes('../') || resolvedPath.includes('..\\')) {
      return false;
    }
    
    return resolvedPath.startsWith(baseDir);
  } catch (error) {
    console.error('Path validation error:', error);
    return false;
  }
};

// Helper to get real case-sensitive path
const getRealPath = (filePath) => {
  try {
    return fs.realpathSync.native(filePath);
  } catch (error) {
    return filePath;
  }
};

// 1. LIST FILE (Untuk navigasi)
router.get("/list", (req, res) => {
  try {
    if (!fs.existsSync(BASE_DIR)) {
      return res.status(404).json({
        code: 404,
        message: "Direktori monitoring tidak ditemukan",
      });
    }

    const files = [];
    const scanDir = (dir) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        try {
          const fullPath = path.join(dir, entry.name);
          const realPath = getRealPath(fullPath);

          if (entry.isDirectory()) {
            scanDir(realPath);
          } else if (entry.isFile()) {
            const ext = path.extname(entry.name).toLowerCase();
            if (ALLOWED_EXT.includes(ext)) {
              files.push({
                name: entry.name,
                path: path.relative(BASE_DIR, fullPath).replace(/\\/g, "/"),
                type: ext.substring(1),
                size: fs.statSync(realPath).size,
                modified: fs.statSync(realPath).mtime
              });
            }
          }
        } catch (error) {
          console.error(`Error processing ${entry.name}:`, error);
        }
      }
    };

    scanDir(BASE_DIR);
    res.json({ 
      success: true,
      data: files,
      count: files.length
    });
  } catch (error) {
    console.error('Directory scan error:', error);
    res.status(500).json({
      success: false,
      message: "Gagal membaca direktori",
      error: error.message,
    });
  }
});

// 2. VIEW FILE (Preview di browser)
router.get("/view", (req, res) => {
  try {
    if (!req.query.path) {
      throw new Error("Parameter path diperlukan");
    }

    // Decode and normalize path
    const decodedPath = decodeURIComponent(req.query.path);
    const filePath = path.join(BASE_DIR, decodedPath);
    const realPath = getRealPath(filePath);

    console.log('Request:', {
      queryPath: req.query.path,
      decodedPath: decodedPath,
      constructedPath: filePath,
      realPath: realPath
    });

    if (!isSafePath(filePath)) {
      throw new Error("Path tidak valid atau tidak diizinkan");
    }

    if (!fs.existsSync(realPath)) {
      console.log('File not found at:', realPath);
      // Check if it exists with different case
      const dir = path.dirname(realPath);
      const fileName = path.basename(realPath);
      const files = fs.readdirSync(dir);
      const caseMatch = files.find(f => f.toLowerCase() === fileName.toLowerCase());
      
      if (caseMatch) {
        throw new Error(`File tidak ditemukan (case mismatch). Maksud Anda ${caseMatch}?`);
      }
      throw new Error("File tidak ditemukan");
    }

    const ext = path.extname(realPath).toLowerCase();
    if (!ALLOWED_EXT.includes(ext)) {
      throw new Error(`Tipe file ${ext} tidak didukung`);
    }

    // Verify read permission
    try {
      fs.accessSync(realPath, fs.constants.R_OK);
    } catch (accessError) {
      throw new Error("Tidak memiliki izin membaca file");
    }

    const mimeTypes = {
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".pdf": "application/pdf",
      ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    };

    // Set cache headers
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.setHeader("Content-Type", mimeTypes[ext] || "application/octet-stream");
    
    // Add error handling for the stream
    const stream = fs.createReadStream(realPath);
    stream.on('error', (error) => {
      console.error('Stream error:', error);
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: "Gagal membaca file",
          error: error.message
        });
      }
    });
    
    stream.pipe(res);
  } catch (error) {
    console.error('View endpoint error:', error);
    res.status(400).json({
      success: false,
      message: error.message,
      error: error.stack
    });
  }
});

// 3. DOWNLOAD FILE
router.get("/download", (req, res) => {
  try {
    if (!req.query.path) {
      throw new Error("Parameter path diperlukan");
    }

    const decodedPath = decodeURIComponent(req.query.path);
    const filePath = path.join(BASE_DIR, decodedPath);
    const realPath = getRealPath(filePath);

    if (!isSafePath(filePath)) {
      throw new Error("Path tidak valid");
    }

    if (!fs.existsSync(realPath)) {
      throw new Error("File tidak ditemukan");
    }

    // Verify read permission
    fs.accessSync(realPath, fs.constants.R_OK);

    // Set download headers
    res.setHeader('Content-Disposition', `attachment; filename="${path.basename(realPath)}"`);
    
    // Add error handling for the stream
    const stream = fs.createReadStream(realPath);
    stream.on('error', (error) => {
      console.error('Download stream error:', error);
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: "Gagal mengunduh file",
          error: error.message
        });
      }
    });
    
    stream.pipe(res);
  } catch (error) {
    console.error('Download error:', error);
    res.status(400).json({
      success: false,
      message: error.message,
      error: error.stack
    });
  }
});

module.exports = router;