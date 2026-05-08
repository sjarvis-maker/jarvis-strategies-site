// Vercel Serverless Function: Process AI Readiness Assessment
// Path: /api/assessment.js

import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';

const TIERS = [
  { max: 30,  label: 'Foundation Stage' },
  { max: 55,  label: 'Building Momentum' },
  { max: 80,  label: 'AI Ready' },
  { max: 100, label: 'Advanced Adopter' }
];

const QUESTION_LABELS = [
  'AI Experience',
  'Process Maturity',
  'Data Accessibility',
  'Team Readiness',
  'Urgency / Driver',
  'Budget Range'
];

function getTier(score) {
  return (TIERS.find(t => score <= t.max) || TIERS[TIERS.length - 1]).label;
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { name, email, company, phone, answers } = req.body;

    if (!name || !email || !Array.isArray(answers) || answers.length === 0) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Calculate score server-side — don't trust client value
    const score = answers.reduce((sum, a) => sum + (Number(a.points) || 0), 0);
    const tier = getTier(score);

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT, 10),
      secure: true,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    });

    // Attach PDF report if the file has been dropped into the project root
    const pdfPath = path.join(process.cwd(), 'ai-readiness-report.pdf');
    const attachments = [];
    if (fs.existsSync(pdfPath)) {
      attachments.push({
        filename: 'AI-Readiness-Report-Jarvis-Strategies.pdf',
        path: pdfPath,
        contentType: 'application/pdf'
      });
    }

    const safeName    = escapeHtml(name);
    const safeCompany = escapeHtml(company);
    const safeEmail   = escapeHtml(email);
    const safePhone   = escapeHtml(phone);

    // ── Email to user ─────────────────────────────────────────────────────────
    const pdfLine = attachments.length
      ? '<p>Your AI Readiness Report is attached to this email.</p>'
      : '<p>Your detailed AI Readiness Report will follow shortly in a separate email.</p>';

    await transporter.sendMail({
      from: `"Jarvis Strategies" <${process.env.SMTP_USER}>`,
      to: email,
      subject: `Your AI Readiness Score: ${score}/100 — ${tier}`,
      attachments,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 580px; margin: 0 auto; color: #333;">
          <div style="background: #1a2332; padding: 32px; border-radius: 6px 6px 0 0;">
            <p style="font-family: Georgia, serif; font-size: 1.1rem; color: #e8a44d; font-style: italic; margin: 0 0 4px;">Jarvis Strategies</p>
            <p style="color: #a8bcc8; font-size: 0.8rem; margin: 0;">AI Readiness Assessment</p>
          </div>
          <div style="background: #f7f9fc; padding: 32px; border-radius: 0 0 6px 6px; border: 1px solid #e0e6ed; border-top: none;">
            <p style="margin: 0 0 8px; color: #555;">Hi ${safeName},</p>
            <p style="margin: 0 0 24px; color: #555; line-height: 1.6;">Thank you for completing the AI Readiness Assessment. Here are your results:</p>

            <div style="background: #1a2332; border-radius: 6px; padding: 28px; text-align: center; margin-bottom: 24px;">
              <div style="font-family: Georgia, serif; font-size: 4rem; color: #fff; line-height: 1; margin-bottom: 4px;">${score}</div>
              <div style="color: #7a8fa3; font-size: 0.85rem; margin-bottom: 14px;">out of 100</div>
              <div style="display: inline-block; background: rgba(232,164,77,0.15); color: #e8a44d; border: 1px solid rgba(232,164,77,0.3); padding: 5px 16px; border-radius: 3px; font-size: 0.78rem; letter-spacing: 0.12em; text-transform: uppercase; font-family: monospace;">${tier}</div>
            </div>

            ${pdfLine}

            <div style="border-left: 3px solid #e8a44d; padding: 12px 16px; background: #fffbf5; margin-bottom: 24px; border-radius: 0 4px 4px 0;">
              <p style="margin: 0; color: #666; font-size: 0.9rem; line-height: 1.6;">A discovery call is the best next step — we'll walk through your results together and map out exactly where AI can deliver the fastest ROI for your firm.</p>
            </div>

            <div style="text-align: center; margin-bottom: 28px;">
              <a href="https://jarvisstrategies.com/?booking=true"
                 style="display: inline-block; background: #e8a44d; color: #1a2332; padding: 13px 28px; border-radius: 3px; font-weight: 700; text-decoration: none; font-size: 0.95rem;">
                Book a Free Discovery Call &rarr;
              </a>
            </div>

            <p style="color: #999; font-size: 0.78rem; border-top: 1px solid #e0e6ed; padding-top: 16px; margin: 0; line-height: 1.6;">
              Scott Jarvis &nbsp;&middot;&nbsp; Jarvis Strategies &nbsp;&middot;&nbsp;
              <a href="mailto:sjarvis@jarvisstrategies.com" style="color: #999;">sjarvis@jarvisstrategies.com</a>
            </p>
          </div>
        </div>
      `
    });

    // ── Email to Scott ────────────────────────────────────────────────────────
    const answersHtml = answers.map((a, i) => `
      <tr style="border-bottom: 1px solid #e0e6ed;">
        <td style="padding: 8px 12px; color: #555; font-size: 0.85rem; white-space: nowrap;">${escapeHtml(QUESTION_LABELS[i] || a.key)}</td>
        <td style="padding: 8px 12px; color: #333; font-size: 0.85rem;">${escapeHtml(a.answer)}</td>
        <td style="padding: 8px 12px; color: #e8a44d; font-size: 0.85rem; font-family: monospace; text-align: right;">${a.points} pts</td>
      </tr>
    `).join('');

    await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: 'sjarvis@jarvisstrategies.com',
      subject: `Assessment Lead: ${safeName}${company ? ` from ${safeCompany}` : ''} — ${score}/100 (${tier})`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 580px; margin: 0 auto; color: #333;">
          <div style="background: #1a2332; padding: 24px; border-radius: 6px 6px 0 0;">
            <p style="font-family: Georgia, serif; color: #e8a44d; font-style: italic; margin: 0 0 4px;">New Assessment Lead</p>
            <p style="color: #a8bcc8; font-size: 0.8rem; margin: 0;">Jarvis Strategies AI Readiness Assessment</p>
          </div>
          <div style="background: #f7f9fc; padding: 28px; border-radius: 0 0 6px 6px; border: 1px solid #e0e6ed; border-top: none;">

            <table style="width:100%; border-collapse:collapse; margin-bottom: 24px;">
              <tr><td style="padding:6px 0; color:#777; font-size:0.82rem; width:110px;">Name</td><td style="padding:6px 0; font-weight:600;">${safeName}</td></tr>
              <tr><td style="padding:6px 0; color:#777; font-size:0.82rem;">Email</td><td style="padding:6px 0;"><a href="mailto:${safeEmail}">${safeEmail}</a></td></tr>
              ${company ? `<tr><td style="padding:6px 0; color:#777; font-size:0.82rem;">Company</td><td style="padding:6px 0;">${safeCompany}</td></tr>` : ''}
              ${phone ? `<tr><td style="padding:6px 0; color:#777; font-size:0.82rem;">Phone</td><td style="padding:6px 0;"><a href="tel:${safePhone}">${safePhone}</a></td></tr>` : ''}
            </table>

            <div style="background: #1a2332; border-radius: 6px; padding: 20px; text-align: center; margin-bottom: 24px;">
              <div style="font-family: Georgia, serif; font-size: 3rem; color: #fff; line-height: 1;">${score}</div>
              <div style="color: #7a8fa3; font-size: 0.8rem; margin-bottom: 10px;">/ 100</div>
              <div style="display: inline-block; background: rgba(232,164,77,0.15); color: #e8a44d; border: 1px solid rgba(232,164,77,0.3); padding: 4px 14px; border-radius: 3px; font-size: 0.75rem; letter-spacing: 0.12em; text-transform: uppercase; font-family: monospace;">${tier}</div>
            </div>

            <table style="width:100%; border-collapse:collapse; border: 1px solid #e0e6ed; border-radius: 4px; overflow: hidden; margin-bottom: 24px;">
              <thead>
                <tr style="background: #edf0f5;">
                  <th style="padding: 8px 12px; text-align:left; font-size:0.78rem; color:#555; font-weight:600;">Area</th>
                  <th style="padding: 8px 12px; text-align:left; font-size:0.78rem; color:#555; font-weight:600;">Answer</th>
                  <th style="padding: 8px 12px; text-align:right; font-size:0.78rem; color:#555; font-weight:600;">Score</th>
                </tr>
              </thead>
              <tbody>${answersHtml}</tbody>
              <tfoot>
                <tr style="background: #edf0f5;">
                  <td colspan="2" style="padding: 8px 12px; font-weight:600; font-size:0.85rem;">Total</td>
                  <td style="padding: 8px 12px; font-weight:700; color: #e8a44d; font-family:monospace; text-align:right;">${score} / 100</td>
                </tr>
              </tfoot>
            </table>

            <div style="text-align: center;">
              <a href="https://jarvisstrategies.com/?booking=true"
                 style="display: inline-block; background: #e8a44d; color: #1a2332; padding: 12px 24px; border-radius: 3px; font-weight: 700; text-decoration: none; font-size: 0.9rem;">
                View Booking Calendar &rarr;
              </a>
            </div>
          </div>
        </div>
      `
    });

    return res.status(200).json({ success: true, score, tier });

  } catch (error) {
    console.error('Assessment Error:', error);
    return res.status(500).json({ error: 'Failed to process assessment' });
  }
}
