// Vercel Serverless Function: Submit Booking Request
// Path: /api/submit-request.js

import nodemailer from 'nodemailer';
import crypto from 'crypto';

function signPayload(data) {
  return crypto.createHmac('sha256', process.env.APPROVE_SECRET || '').update(data).digest('hex');
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { name, email, company, requestedTime, context } = req.body;

    // Validate required fields
    if (!name || !email || !company || !requestedTime) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (!process.env.APPROVE_SECRET) {
      console.warn('APPROVE_SECRET not set — admin action links will be unsigned. Set this env var in Vercel immediately.');
    }

    // Generate unique request ID
    const requestId = generateRequestId();

    const requestData = Buffer.from(JSON.stringify({
      id: requestId,
      name,
      email,
      company,
      requestedTime,
      context
    })).toString('base64');

    const sig = signPayload(requestData);

    // Create email transporter
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT, 10),
      secure: true,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });

    // Base URL for action links
    const baseUrl = 'https://jarvisstrategies.com';

    // Format requested time nicely
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

    // Escape user input before embedding in HTML email
    const safeName = escapeHtml(name);
    const safeEmail = escapeHtml(email);
    const safeCompany = escapeHtml(company);
    const safeContext = context
      ? escapeHtml(context).replace(/\n/g, '<br/>')
      : null;

    // Send approval email to Scott
    const approvalEmail = {
      from: process.env.SMTP_USER,
      to: 'sjarvis@jarvisstrategies.com',
      subject: `Booking Request: ${safeName} from ${safeCompany}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1a2332;">New Booking Request</h2>

          <div style="background: #f2f4f8; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Name:</strong> ${safeName}</p>
            <p><strong>Email:</strong> ${safeEmail}</p>
            <p><strong>Company:</strong> ${safeCompany}</p>
            <p><strong>Requested Time:</strong> ${formattedTime}</p>
            ${safeContext ? `<p><strong>Context:</strong><br/>${safeContext}</p>` : ''}
          </div>

          <h3 style="color: #1a2332;">Take Action:</h3>

          <div style="margin: 30px 0;">
            <a href="${baseUrl}/api/approve?data=${encodeURIComponent(requestData)}&sig=${sig}"
               style="display: inline-block; background: #4CAF50; color: white; padding: 12px 30px;
                      text-decoration: none; border-radius: 4px; margin-right: 10px;">
              ✓ Approve
            </a>

            <a href="${baseUrl}/api/suggest-alternate?data=${encodeURIComponent(requestData)}&sig=${sig}"
               style="display: inline-block; background: #2196F3; color: white; padding: 12px 30px;
                      text-decoration: none; border-radius: 4px; margin-right: 10px;">
              ↻ Suggest Alternate Time
            </a>

            <a href="${baseUrl}/api/decline?data=${encodeURIComponent(requestData)}&sig=${sig}"
               style="display: inline-block; background: #f44336; color: white; padding: 12px 30px;
                      text-decoration: none; border-radius: 4px;">
              ✗ Decline
            </a>
          </div>

          <p style="color: #666; font-size: 12px; margin-top: 40px;">
            Request ID: ${requestId}<br/>
            Received: ${new Date().toLocaleString()}
          </p>
        </div>
      `
    };

    await transporter.sendMail(approvalEmail);

    return res.status(200).json({
      success: true,
      message: 'Request submitted successfully',
      requestId
    });

  } catch (error) {
    console.error('Submit Request Error:', error);
    return res.status(500).json({ error: 'Failed to submit request' });
  }
}

function generateRequestId() {
  return `REQ-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`.toUpperCase();
}
