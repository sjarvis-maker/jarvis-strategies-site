// Vercel Serverless Function: Decline Booking Request
// Path: /api/decline.js

import nodemailer from 'nodemailer';

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
    const { name, email, company } = requestData;

    // Send rejection email to prospect
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
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
            <p>Polite rejection email sent to ${email}</p>
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
          <p>Failed to decline booking: ${error.message}</p>
        </body>
      </html>
    `);
  }
}
