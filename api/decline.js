// Vercel Serverless Function: Decline Booking Request
// Path: /api/decline.js

import nodemailer from 'nodemailer';
import crypto from 'crypto';

function verifyPayload(data, sig) {
  if (!process.env.APPROVE_SECRET) {
    console.warn('APPROVE_SECRET not set — skipping signature verification.');
    return true;
  }
  if (!sig) return false;
  try {
    const expected = Buffer.from(
      crypto.createHmac('sha256', process.env.APPROVE_SECRET).update(data).digest('hex'),
      'hex'
    );
    const provided = Buffer.from(sig, 'hex');
    if (expected.length !== provided.length) return false;
    return crypto.timingSafeEqual(expected, provided);
  } catch {
    return false;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { data, sig } = req.query;

    if (!data) {
      return res.status(400).send('Invalid request data');
    }

    if (!verifyPayload(data, sig)) {
      return res.status(403).send('Invalid or expired decline link');
    }

    // Decode request data
    const requestData = JSON.parse(Buffer.from(data, 'base64').toString());
    const { name, email } = requestData;

    // Send rejection email to prospect
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT, 10),
      secure: true,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });

    await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: email,
      subject: 'Re: Discovery Call Request',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <p>Hi ${name},</p>

          <p>Thank you for your interest in Jarvis Strategies.</p>

          <p>After reviewing your request, this doesn't look like a strong fit for what we focus on. I appreciate you reaching out and wish you the best with your AI implementation efforts.</p>

          <p>Best regards,</p>

          <p>Scott Jarvis<br/>
          Jarvis Strategies</p>
        </div>
      `
    });

    // Return success page
    return res.status(200).send(`
      <html>
        <head>
          <title>Request Declined</title>
          <style>
            body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
            .notice { background: #f44336; color: white; padding: 20px; border-radius: 8px; text-align: center; }
          </style>
        </head>
        <body>
          <div class="notice">
            <h1>Request Declined</h1>
            <p>Polite rejection email sent</p>
            <p>No calendar event created</p>
          </div>
        </body>
      </html>
    `);

  } catch (error) {
    console.error('Decline Error:', error);
    return res.status(500).send(`
      <html>
        <body style="font-family: Arial; max-width: 600px; margin: 50px auto; padding: 20px;">
          <h1 style="color: #f44336;">Error</h1>
          <p>Failed to decline booking. Please try again or contact support.</p>
        </body>
      </html>
    `);
  }
}
