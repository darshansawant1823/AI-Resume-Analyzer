
import express from "express";
import { createServer as createViteServer } from "vite";
import nodemailer from "nodemailer";
import dotenv from "dotenv";
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

dotenv.config();

// Initialize Firebase Admin (for OTP storage/verification)
// We'll use the same project ID as the client
const firebaseAdminApp = initializeApp({
  projectId: "airesumeanalyse",
});
const db = getFirestore(firebaseAdminApp);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.post("/api/auth/send-otp", async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email is required" });

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

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    app.use(express.static("dist"));
    app.get("*", (req, res) => {
      res.sendFile("dist/index.html", { root: "." });
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
