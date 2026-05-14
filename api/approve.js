// Vercel Serverless Function: Approve Booking Request
// Path: /api/approve.js

import nodemailer from 'nodemailer';
import { google } from 'googleapis';
import crypto from 'crypto';

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

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
      return res.status(403).send('Invalid or expired approval link');
    }

    // Decode request data
    const requestData = JSON.parse(Buffer.from(data, 'base64').toString());
    const { name, email, company, requestedTime, context } = requestData;

    // Set up Google Calendar with service account
    const serviceAccountKey = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);

    const auth = new google.auth.JWT({
      email: serviceAccountKey.client_email,
      key: serviceAccountKey.private_key,
      scopes: ['https://www.googleapis.com/auth/calendar']
    });

    const calendar = google.calendar({ version: 'v3', auth });

    const event = {
      summary: `Discovery Call: ${company}`,
      description: `Discovery call with ${name} from ${company}\n\nEmail: ${email}\n\nContext: ${context || 'None provided'}\n\nGoogle Meet: https://meet.google.com/new`,
      start: {
        dateTime: requestedTime,
        timeZone: 'America/Vancouver'
      },
      end: {
        dateTime: new Date(new Date(requestedTime).getTime() + 30 * 60000).toISOString(),
        timeZone: 'America/Vancouver'
      },
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 24 * 60 },
          { method: 'popup', minutes: 30 }
        ]
      }
    };

    await calendar.events.insert({
      calendarId: process.env.GOOGLE_CALENDAR_ID,
      resource: event
    });

    // Send confirmation email to prospect
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT, 10),
      secure: true,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });

    const formattedTime = new Date(requestedTime).toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: 'America/Vancouver',
      timeZoneName: 'short'
    });

    await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: email,
      subject: 'Your Discovery Call with Jarvis Strategies is Confirmed',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1a2332;">Discovery Call Confirmed</h2>

          <p>Hi ${escapeHtml(name)},</p>

          <p>Your discovery call with Jarvis Strategies has been confirmed.</p>

          <div style="background: #f2f4f8; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 8px 0;"><strong>Date &amp; Time:</strong> ${formattedTime}</p>
            <p style="margin: 8px 0;"><strong>Duration:</strong> 30 minutes</p>
          </div>

          <p>Looking forward to speaking with you.</p>

          <p>Scott Jarvis<br/>
          Jarvis Strategies<br/>
          <a href="mailto:${process.env.SMTP_USER}">${process.env.SMTP_USER}</a></p>
        </div>
      `
    });

    // Return success page — escape user data before rendering in HTML
    return res.status(200).send(`
      <html>
        <head>
          <title>Booking Approved</title>
          <style>
            body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
            .success { background: #4CAF50; color: white; padding: 20px; border-radius: 8px; text-align: center; }
            .details { background: #f2f4f8; padding: 15px; border-radius: 8px; margin: 20px 0; text-align: left; }
          </style>
        </head>
        <body>
          <div class="success">
            <h1>&#10003; Booking Approved</h1>
            <p>Confirmation email sent to ${escapeHtml(email)}</p>
          </div>
          <div class="details">
            <p><strong>Time:</strong> ${formattedTime}</p>
            <p><strong>Event created in your calendar</strong></p>
            <p><strong>Next step:</strong> Add a Google Meet link to the calendar event and send it to the prospect</p>
          </div>
        </body>
      </html>
    `);

  } catch (error) {
    console.error('Approve Error:', error);
    return res.status(500).send(`
      <html>
        <body style="font-family: Arial; max-width: 600px; margin: 50px auto; padding: 20px;">
          <h1 style="color: #f44336;">Error</h1>
          <p>Failed to approve booking. Please try again or contact support.</p>
        </body>
      </html>
    `);
  }
}
