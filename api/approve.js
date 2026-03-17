// Vercel Serverless Function: Approve Booking Request
// Path: /api/approve.js

import nodemailer from 'nodemailer';
import { google } from 'googleapis';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { data } = req.query;
    
    if (!data) {
      return res.status(400).send('Invalid request data');
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

    const calendarResponse = await calendar.events.insert({
      calendarId: process.env.GOOGLE_CALENDAR_ID,
      resource: event
    });

    // Generate a simple meet link (you'll create it when you join)
    const meetLink = 'https://meet.google.com/new';

    // Send confirmation email to prospect
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
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
          
          <p>Hi ${name},</p>
          
          <p>Your discovery call with Jarvis Strategies has been confirmed.</p>
          
          <div style="background: #f2f4f8; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 8px 0;"><strong>Date & Time:</strong> ${formattedTime}</p>
            <p style="margin: 8px 0;"><strong>Duration:</strong> 30 minutes</p>
          </div>
          
          <p>A Google Meet link will be shared with you closer to the meeting time via email.</p>
          
          <p><strong>Please add this to your calendar:</strong></p>
          <ul>
            <li>Create a calendar event for ${formattedTime}</li>
            <li>Set duration to 30 minutes</li>
            <li>You'll receive the meeting link separately</li>
          </ul>
          
          <p>Looking forward to speaking with you.</p>
          
          <p>Scott Jarvis<br/>
          Jarvis Strategies<br/>
          <a href="mailto:${process.env.SMTP_USER}">${process.env.SMTP_USER}</a></p>
        </div>
      `
    });

    // Return success page
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
            <h1>✓ Booking Approved</h1>
            <p>Confirmation email sent to ${email}</p>
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
          <p>Failed to approve booking: ${error.message}</p>
        </body>
      </html>
    `);
  }
}
