require("dotenv").config();
const express = require("express");
const fs = require("fs");
const path = require("path");
const router = express.Router();

const BASE_DIR = process.env.MONITORING_BASE_DIR;
const ALLOWED_EXT = process.env.ALLOWED_EXTENSIONS.split(",");

// Helper: Validasi path aman
const isSafePath = (filePath) => {
  const resolvedPath = path.normalize(filePath);
  return resolvedPath.startsWith(BASE_DIR);
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
      fs.readdirSync(dir).forEach((file) => {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
          scanDir(fullPath);
        } else if (ALLOWED_EXT.includes(path.extname(file).toLowerCase())) {
          files.push({
            name: file,
            path: path.relative(BASE_DIR, fullPath).replace(/\\/g, "/"),
            type: path.extname(file).substring(1),
          });
        }
      });
    };

    scanDir(BASE_DIR);
    res.json({ data: files });
  } catch (error) {
    res.status(500).json({
      message: "Gagal membaca direktori",
      error: error.message,
    });
  }
});

// 2. VIEW FILE (Preview di browser)
router.get("/view", (req, res) => {
  try {
    if (!req.query.path) throw new Error("Parameter path diperlukan");
    console/log(req.query.path)
    const filePath = path.join(BASE_DIR, req.query.path);
    if (!isSafePath(filePath) || !fs.existsSync(filePath)) {
      throw new Error("File tidak ditemukan");
    }

    const ext = path.extname(filePath).toLowerCase();
    if (!ALLOWED_EXT.includes(ext)) {
      throw new Error("Tipe file tidak didukung");
    }

    // Set header sesuai tipe file
    const mimeTypes = {
      ".jpg": "image/jpeg",
      ".png": "image/png",
      ".pdf": "application/pdf",
      ".xlsx":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    };

    res.setHeader("Content-Type", mimeTypes[ext] || "application/octet-stream");
    fs.createReadStream(filePath).pipe(res);
  } catch (error) {
    console.error(error);
    res.status(400).json({
      message: error.message,
    });
  }
});

// 3. DOWNLOAD FILE
router.get("/download", (req, res) => {
  try {
    if (!req.query.path) throw new Error("Parameter path diperlukan");

    const filePath = path.join(BASE_DIR, req.query.path);
    if (!isSafePath(filePath) || !fs.existsSync(filePath)) {
      throw new Error("File tidak ditemukan");
    }

    res.download(filePath);
  } catch (error) {
    res.status(400).json({
      message: error.message,
    });
  }
});

module.exports = router;
