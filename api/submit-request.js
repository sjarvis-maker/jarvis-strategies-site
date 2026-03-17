// Vercel Serverless Function: Submit Booking Request
// Path: /api/submit-request.js

const nodemailer = require('nodemailer');

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

    // Generate unique request ID
    const requestId = generateRequestId();

    // Store request data (in production, use database)
    // For now, we'll pass it through URL parameters
    const requestData = Buffer.from(JSON.stringify({
      id: requestId,
      name,
      email,
      company,
      requestedTime,
      context
    })).toString('base64');

    // Create email transporter
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: true,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });

    // Base URL for action links
    const baseUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` 
      : 'https://jarvisstrategies.com';

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

    // Send approval email to Scott
    const approvalEmail = {
      from: process.env.SMTP_USER,
      to: 'sjarvis@jarvisstrategies.com',
      subject: `📅 Booking Request: ${name} from ${company}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1a2332;">New Booking Request</h2>
          
          <div style="background: #f2f4f8; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Name:</strong> ${name}</p>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Company:</strong> ${company}</p>
            <p><strong>Requested Time:</strong> ${formattedTime}</p>
            ${context ? `<p><strong>Context:</strong><br/>${context.replace(/\n/g, '<br/>')}</p>` : ''}
          </div>

          <h3 style="color: #1a2332;">Take Action:</h3>
          
          <div style="margin: 30px 0;">
            <a href="${baseUrl}/api/approve?data=${encodeURIComponent(requestData)}" 
               style="display: inline-block; background: #4CAF50; color: white; padding: 12px 30px; 
                      text-decoration: none; border-radius: 4px; margin-right: 10px;">
              ✓ Approve
            </a>
            
            <a href="${baseUrl}/api/suggest-alternate?data=${encodeURIComponent(requestData)}" 
               style="display: inline-block; background: #2196F3; color: white; padding: 12px 30px; 
                      text-decoration: none; border-radius: 4px; margin-right: 10px;">
              ↻ Suggest Alternate Time
            </a>
            
            <a href="${baseUrl}/api/decline?data=${encodeURIComponent(requestData)}" 
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
    return res.status(500).json({ 
      error: 'Failed to submit request',
      details: error.message 
    });
  }
}

function generateRequestId() {
  return `REQ-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`.toUpperCase();
}
