// Vercel Serverless Function: Suggest Alternate Time
// Path: /api/suggest-alternate.js

import nodemailer from 'nodemailer';

export default async function handler(req, res) {
  const { data, alternateTime } = req.query;
  
  if (!data) {
    return res.status(400).send('Invalid request data');
  }

  // Decode request data
  const requestData = JSON.parse(Buffer.from(data, 'base64').toString());
  const { name, email, company } = requestData;

  // If no alternate time provided yet, show selection form
  if (!alternateTime) {
    return res.status(200).send(`
      <html>
        <head>
          <title>Suggest Alternate Time</title>
          <style>
            body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
            h1 { color: #1a2332; }
            .form-group { margin: 20px 0; }
            label { display: block; margin-bottom: 8px; font-weight: bold; }
            input { padding: 10px; font-size: 16px; width: 100%; box-sizing: border-box; border: 1px solid #ccc; border-radius: 4px; }
            button { background: #2196F3; color: white; padding: 12px 30px; border: none; border-radius: 4px; font-size: 16px; cursor: pointer; }
            button:hover { background: #1976D2; }
            .info { background: #f2f4f8; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
          </style>
        </head>
        <body>
          <h1>Suggest Alternate Time</h1>
          
          <div class="info">
            <p><strong>Prospect:</strong> ${name} from ${company}</p>
            <p><strong>Email:</strong> ${email}</p>
          </div>

          <form method="GET" action="/api/suggest-alternate">
            <input type="hidden" name="data" value="${data}" />
            
            <div class="form-group">
              <label for="alternateTime">Propose Alternate Date & Time:</label>
              <input 
                type="datetime-local" 
                id="alternateTime" 
                name="alternateTime" 
                required 
              />
            </div>

            <button type="submit">Send Alternate Time Proposal</button>
          </form>
        </body>
      </html>
    `);
  }

  // Alternate time was provided, send email to prospect
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: true,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });

    const formattedTime = new Date(alternateTime).toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: 'America/Vancouver',
      timeZoneName: 'short'
    });

    // Create new request data with alternate time
    const updatedData = Buffer.from(JSON.stringify({
      ...requestData,
      requestedTime: new Date(alternateTime).toISOString()
    })).toString('base64');

    const baseUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` 
      : 'https://jarvisstrategies.com';

    await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: email,
      subject: 'Alternate Time Proposed for Your Discovery Call',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1a2332;">Alternate Time Proposed</h2>
          
          <p>Hi ${name},</p>
          
          <p>Thank you for your interest in Jarvis Strategies. I'd like to propose an alternate time for our discovery call:</p>
          
          <div style="background: #f2f4f8; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Proposed Time:</strong> ${formattedTime}</p>
            <p><strong>Duration:</strong> 30 minutes</p>
          </div>
          
          <p>Does this time work for you?</p>
          
          <div style="margin: 30px 0;">
            <a href="${baseUrl}/api/approve?data=${encodeURIComponent(updatedData)}" 
               style="display: inline-block; background: #4CAF50; color: white; padding: 12px 30px; 
                      text-decoration: none; border-radius: 4px; margin-right: 10px;">
              Yes, Confirm This Time
            </a>
            
            <a href="mailto:sjarvis@jarvisstrategies.com?subject=Re: Discovery Call - Alternate Time Needed" 
               style="display: inline-block; background: #666; color: white; padding: 12px 30px; 
                      text-decoration: none; border-radius: 4px;">
              No, Suggest Another Time
            </a>
          </div>
          
          <p>Looking forward to speaking with you.</p>
          
          <p>Scott Jarvis<br/>
          Jarvis Strategies<br/>
          <a href="mailto:sjarvis@jarvisstrategies.com">sjarvis@jarvisstrategies.com</a></p>
        </div>
      `
    });

    return res.status(200).send(`
      <html>
        <head>
          <title>Alternate Time Sent</title>
          <style>
            body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
            .success { background: #2196F3; color: white; padding: 20px; border-radius: 8px; text-align: center; }
          </style>
        </head>
        <body>
          <div class="success">
            <h1>✓ Alternate Time Sent</h1>
            <p>Email sent to ${email}</p>
            <p>Proposed time: ${formattedTime}</p>
          </div>
        </body>
      </html>
    `);

  } catch (error) {
    console.error('Suggest Alternate Error:', error);
    return res.status(500).send(`
      <html>
        <body style="font-family: Arial; max-width: 600px; margin: 50px auto; padding: 20px;">
          <h1 style="color: #f44336;">Error</h1>
          <p>Failed to send alternate time: ${error.message}</p>
        </body>
      </html>
    `);
  }
}
