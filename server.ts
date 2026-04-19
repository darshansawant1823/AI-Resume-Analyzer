
import express from "express";
import nodemailer from "nodemailer";
import dotenv from "dotenv";
import path from "path";
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';

dotenv.config();

let db: any;

try {
  // Initialize Firebase Admin (for OTP storage/verification)
  // We'll use the project ID from environment or fallback to the one in src/firebase.ts
  const projectId = process.env.FIREBASE_PROJECT_ID || "airesumeanalyse";
  const firebaseAdminApp = initializeApp({
    projectId: projectId,
  });
  db = getFirestore(firebaseAdminApp);
  console.log(`Firebase Admin initialized for project: ${projectId}`);
} catch (error) {
  console.error("Failed to initialize Firebase Admin:", error);
  // We don't exit here to allow the server to start even if Firebase is misconfigured
  // but API routes using 'db' will fail gracefully
}

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;

  app.use(express.json());

  // API Routes
  app.post("/api/auth/send-otp", async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email is required" });

    if (!db) {
      return res.status(503).json({ error: "Firebase service is currently unavailable. Please try again later." });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    try {
      // Store OTP in Firestore
      await db.collection("otps").doc(email).set({
        otp,
        expiresAt: expiresAt.toISOString(),
      });

      // Send Email
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || "smtp.ethereal.email",
        port: parseInt(process.env.SMTP_PORT || "587"),
        secure: process.env.SMTP_SECURE === "true",
        auth: {
          user: process.env.SMTP_USER || "test@ethereal.email",
          pass: process.env.SMTP_PASS || "testpassword",
        },
      });

      // If using ethereal, log the URL
      if (!process.env.SMTP_USER) {
        console.log("Using Ethereal for testing. No SMTP credentials provided.");
      }

      await transporter.sendMail({
        from: '"AI Resume Analyzer" <noreply@airesumeanalyzer.com>',
        to: email,
        subject: "Your Verification Code",
        text: `Your verification code is: ${otp}. It will expire in 10 minutes.`,
        html: `
          <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px; max-width: 500px; margin: auto;">
            <h2 style="color: #4f46e5; text-align: center;">AI Resume Analyzer</h2>
            <p style="font-size: 16px; color: #333;">Hello,</p>
            <p style="font-size: 16px; color: #333;">Your verification code is:</p>
            <div style="background: #f3f4f6; padding: 20px; text-align: center; border-radius: 10px; margin: 20px 0;">
              <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #111;">${otp}</span>
            </div>
            <p style="font-size: 14px; color: #666; text-align: center;">This code will expire in 10 minutes.</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
            <p style="font-size: 12px; color: #999; text-align: center;">If you didn't request this, please ignore this email.</p>
          </div>
        `,
      });

      res.json({ success: true, message: "OTP sent successfully" });
    } catch (error: any) {
      console.error("Error sending OTP:", error);
      res.status(500).json({ error: "Failed to send OTP", details: error.message });
    }
  });

  app.post("/api/auth/verify-otp", async (req, res) => {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ error: "Email and OTP are required" });

    if (!db) {
      return res.status(503).json({ error: "Firebase service is currently unavailable. Please try again later." });
    }

    try {
      const otpDoc = await db.collection("otps").doc(email).get();
      if (!otpDoc.exists) return res.status(400).json({ error: "OTP not found or expired" });

      const data = otpDoc.data();
      if (!data) return res.status(400).json({ error: "OTP not found or expired" });

      if (data.otp !== otp) return res.status(400).json({ error: "Invalid OTP" });

      const expiresAt = new Date(data.expiresAt);
      if (expiresAt < new Date()) return res.status(400).json({ error: "OTP expired" });

      // Clear OTP after successful verification
      await db.collection("otps").doc(email).delete();

      res.json({ success: true, message: "OTP verified successfully" });
    } catch (error: any) {
      console.error("Error verifying OTP:", error);
      res.status(500).json({ error: "Failed to verify OTP", details: error.message });
    }
  });

  // Job Search Proxy Route
  app.get("/api/jobs", async (req, res) => {
    const { query, location } = req.query;
    const apiKey = process.env.RAPIDAPI_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: "RAPIDAPI_KEY is not configured on the server." });
    }

    if (!query) {
      return res.status(400).json({ error: "Query parameter is required" });
    }

    try {
      // If there are multiple locations, JSearch works better if we join them with OR in the query
      // or simply include them naturally.
      const formattedLocation = Array.isArray(location) 
        ? location.join(' OR ') 
        : (location as string || '').split(',').map(s => s.trim()).filter(Boolean).join(' OR ');

      const searchQuery = formattedLocation 
        ? `${query} in ${formattedLocation}` 
        : (query as string);

      // We explicitly log the query to help debug if volume is low (visible in server logs)
      console.log(`JSearch Query: "${searchQuery}"`);

      const url = `https://jsearch.p.rapidapi.com/search?query=${encodeURIComponent(searchQuery)}&page=1&num_pages=3`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'x-rapidapi-key': apiKey,
          'x-rapidapi-host': 'jsearch.p.rapidapi.com'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `RapidAPI responded with status: ${response.status}`);
      }

      const data = await response.json();
      
      // Map JSearch response to our frontend expected format
      const formattedJobs = (data.data || []).map((job: any) => ({
        title: job.job_title,
        company: job.employer_name,
        location: job.job_city && job.job_country ? `${job.job_city}, ${job.job_country}` : (job.job_location || 'Remote'),
        source: job.job_publisher || 'Web',
        url: job.job_apply_link,
        postedAt: job.job_posted_at_timestamp ? new Date(job.job_posted_at_timestamp * 1000).toLocaleDateString() : 'Active',
        descriptionSnippet: job.job_description ? job.job_description.substring(0, 200) + '...' : ''
      }));

      res.json(formattedJobs);
    } catch (error: any) {
      console.error("Error fetching jobs from RapidAPI:", error);
      res.status(500).json({ error: "Failed to fetch jobs from RapidAPI", details: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    const distPath = path.join(process.cwd(), "dist");
    
    if (fs.existsSync(distPath)) {
      console.log(`Serving static files from: ${distPath}`);
      app.use(express.static(distPath));
      app.get("*all", (req, res) => {
        res.sendFile(path.join(distPath, "index.html"));
      });
    } else {
      console.error(`Warning: dist directory not found at ${distPath}. Build might have failed.`);
      app.get("*all", (req, res) => {
        res.status(500).send("Application is not built correctly. Please run 'npm run build'.");
      });
    }
  }

  app.listen(Number(PORT), "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
