require("dotenv").config();
const express = require("express");
const cors = require("cors"); // Untuk handle CORS jika diperlukan
const monitoringRouter = require("./routes"); // Sesuaikan path ke file router Anda

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors()); // Enable CORS for all routes
app.use(express.json()); // Untuk parsing application/json
app.use(express.urlencoded({ extended: true })); // Untuk parsing application/x-www-form-urlencoded

// Routes
app.use("/v1", monitoringRouter); // Mount the monitoring router

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({ status: "OK", timestamp: new Date() });
});

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ message: "Endpoint not found" });
});

// Error Handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: "Internal Server Error" });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Monitoring base directory: ${process.env.MONITORING_BASE_DIR}`);
  console.log(`Allowed extensions: ${process.env.ALLOWED_EXTENSIONS}`);
});