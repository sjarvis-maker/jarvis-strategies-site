import nodemailer from 'nodemailer';
import Anthropic from '@anthropic-ai/sdk';

const TIERS = [
  { max: 30,  label: 'Foundation Stage' },
  { max: 55,  label: 'Building Momentum' },
  { max: 80,  label: 'AI Ready' },
  { max: 100, label: 'Advanced Adopter' }
];

const QUESTION_LABELS = [
  'Industry',
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

async function generateReport({ name, company, score, tier, answers }) {
  const client = new Anthropic();

  const industryAnswer = answers.find(a => a.key === 'industry');
  const industry = industryAnswer ? industryAnswer.answer : 'Not specified';
  const scoredAnswers = answers.filter(a => a.key !== 'industry');

  const answersSummary = scoredAnswers.map((a, i) =>
    `${QUESTION_LABELS[i + 1] || a.key}: "${a.answer}" (${a.points} points out of a possible ${getMaxPoints(i)})`
  ).join('\n');

  const prompt = `You are writing a personalized AI Readiness Assessment report on behalf of Scott Jarvis at Jarvis Strategies, an AI implementation consultancy serving small and mid-size businesses in the Okanagan.

ASSESSMENT RESULTS:
Name: ${name}
Company: ${company || 'their company'}
Industry: ${industry || 'Not specified'}
Overall Score: ${score}/100
Tier: ${tier}

QUESTION-BY-QUESTION BREAKDOWN:
${answersSummary}

TIER-SPECIFIC TONE INSTRUCTIONS — follow these exactly based on their tier:
- Foundation Stage (0-30): Encouraging and clarifying. They need a clear starting point, not a list of problems. Focus on one concrete first step.
- Building Momentum (31-55): Direct and practical. They have some exposure. Name what's holding them back from moving faster and what to fix first.
- AI Ready (56-80): Sharp and challenging. They already know the general direction. Your job is to identify the specific gaps their score reveals that they may be overlooking, and name the operational consequence of leaving those gaps unaddressed. Do not validate what they already know — focus on what's blocking them.
- Advanced Adopter (81-100): Peer-level. Assume sophistication. Focus on scaling, governance, and competitive differentiation opportunities specific to their profile.
Reference their industry where relevant in the area analysis and recommendations. A construction firm and a professional services firm have different AI use cases — name the specific ones that apply.

RULES FOR ALL TIERS:
- Never write generic AI advice that could apply to any business.
- Every insight must reference their specific answer, not just their score.
- For any area scoring below 50% of its maximum points, name the specific operational problem that gap creates — not just that it's a gap.
- Recommendations must name a concrete action, not a category. Bad: "Improve data accessibility." Good: "Audit where your critical business data lives and whether it can be queried or exported — AI tools can only work with data they can reach."

Write a personalized assessment report with exactly these four sections. Return ONLY valid JSON with no markdown formatting or code fences:

{
  "executiveSummary": "2-3 sentences. Name their tier. Identify the most important tension or opportunity their specific score combination reveals — not just their overall number. For AI Ready and Advanced tiers, lead with the gap, not the strength.",
  "areaAnalysis": [
    {"area": "AI Experience", "insight": "1-2 sentences referencing their exact answer. For low scores, name the practical consequence. For high scores, name what that enables or what risk it creates if other areas are weak."},
    {"area": "Process Maturity", "insight": "..."},
    {"area": "Data Accessibility", "insight": "..."},
    {"area": "Team Readiness", "insight": "..."},
    {"area": "Urgency / Driver", "insight": "..."},
    {"area": "Budget Range", "insight": "..."}
  ],
  "recommendations": [
    "Concrete action tied to their lowest-scoring area. Name the action, the reason, and what it unblocks.",
    "Second recommendation — next priority gap.",
    "Third recommendation — momentum builder given their tier and urgency."
  ],
  "closingParagraph": "2-3 sentences. Name one specific thing a discovery call would accomplish for them based on their actual results — not a generic offer. Make it feel like the call has an agenda already."
}`;

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1200,
    messages: [{ role: 'user', content: prompt }]
  });

  let text = message.content[0].text.trim();
  // Strip markdown code fences if the model wraps its response
  text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  return JSON.parse(text);
}

function getMaxPoints(questionIndex) {
  // Max points per question — matches assessment.html option values
  return [20, 20, 15, 15, 15, 15][questionIndex] || 20;
}

function buildReportHtml(report) {
  const areasHtml = report.areaAnalysis.map(a => `
    <tr>
      <td style="padding: 10px 14px; color: #1a2332; font-size: 0.83rem; font-weight: 600; white-space: nowrap; vertical-align: top; border-bottom: 1px solid #e8edf3; width: 130px;">${escapeHtml(a.area)}</td>
      <td style="padding: 10px 14px; color: #555; font-size: 0.85rem; line-height: 1.6; border-bottom: 1px solid #e8edf3;">${escapeHtml(a.insight)}</td>
    </tr>
  `).join('');

  const recsHtml = report.recommendations.map((r, i) => `
    <p style="margin: 0 0 10px; color: #444; font-size: 0.88rem; line-height: 1.6;">
      <strong style="color: #e8a44d;">${i + 1}.</strong> ${escapeHtml(r)}
    </p>
  `).join('');

  return `
    <div style="margin-bottom: 28px;">
      <h2 style="font-family: Georgia, serif; font-size: 1.05rem; color: #1a2332; margin: 0 0 10px 0; padding-bottom: 8px; border-bottom: 2px solid #e8a44d;">Executive Summary</h2>
      <p style="margin: 0; color: #444; font-size: 0.9rem; line-height: 1.7;">${escapeHtml(report.executiveSummary)}</p>
    </div>

    <div style="margin-bottom: 28px;">
      <h2 style="font-family: Georgia, serif; font-size: 1.05rem; color: #1a2332; margin: 0 0 10px 0; padding-bottom: 8px; border-bottom: 2px solid #e8a44d;">Area-by-Area Analysis</h2>
      <table style="width: 100%; border-collapse: collapse; border: 1px solid #e0e6ed;">
        <tbody>${areasHtml}</tbody>
      </table>
    </div>

    <div style="margin-bottom: 28px;">
      <h2 style="font-family: Georgia, serif; font-size: 1.05rem; color: #1a2332; margin: 0 0 14px 0; padding-bottom: 8px; border-bottom: 2px solid #e8a44d;">Top Recommendations</h2>
      ${recsHtml}
    </div>

    <div style="border-left: 3px solid #e8a44d; padding: 12px 16px; background: #fffbf5; border-radius: 0 4px 4px 0; margin-bottom: 4px;">
      <p style="margin: 0; color: #555; font-size: 0.9rem; line-height: 1.7;">${escapeHtml(report.closingParagraph)}</p>
    </div>
  `;
}

function buildFallbackReportHtml() {
  return `
    <div style="border-left: 3px solid #e8a44d; padding: 12px 16px; background: #fffbf5; border-radius: 0 4px 4px 0; margin-bottom: 4px;">
      <p style="margin: 0; color: #555; font-size: 0.9rem; line-height: 1.7;">A discovery call is the best next step — we'll walk through your results together and map out exactly where AI can deliver the fastest ROI for your firm.</p>
    </div>
  `;
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

    // Generate personalized report via Claude — fall back gracefully if it fails
    let reportHtml;
    try {
      const report = await generateReport({ name, company, score, tier, answers });
      reportHtml = buildReportHtml(report);
    } catch (reportError) {
      console.error('Report generation failed, using fallback:', reportError);
      reportHtml = buildFallbackReportHtml();
    }

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT, 10),
      secure: true,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    });

    const safeName    = escapeHtml(name);
    const safeCompany = escapeHtml(company);
    const safeEmail   = escapeHtml(email);
    const safePhone   = escapeHtml(phone);

    // ── Email to user ─────────────────────────────────────────────────────────
    await transporter.sendMail({
      from: `"Jarvis Strategies" <${process.env.SMTP_USER}>`,
      to: email,
      subject: `Your AI Readiness Score: ${score}/100 — ${tier}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
          <div style="background: #1a2332; padding: 32px; border-radius: 6px 6px 0 0;">
            <p style="font-family: Georgia, serif; font-size: 1.1rem; color: #e8a44d; font-style: italic; margin: 0 0 4px;">Jarvis Strategies</p>
            <p style="color: #a8bcc8; font-size: 0.8rem; margin: 0;">AI Readiness Assessment Report</p>
          </div>
          <div style="background: #f7f9fc; padding: 32px; border-radius: 0 0 6px 6px; border: 1px solid #e0e6ed; border-top: none;">

            <p style="margin: 0 0 8px; color: #555;">Hi ${safeName},</p>
            <p style="margin: 0 0 24px; color: #555; line-height: 1.6;">Thank you for completing the AI Readiness Assessment. Your personalized report is below.</p>

            <div style="background: #1a2332; border-radius: 6px; padding: 28px; text-align: center; margin-bottom: 28px;">
              <div style="font-family: Georgia, serif; font-size: 4rem; color: #fff; line-height: 1; margin-bottom: 4px;">${score}</div>
              <div style="color: #7a8fa3; font-size: 0.85rem; margin-bottom: 14px;">out of 100</div>
              <div style="display: inline-block; background: rgba(232,164,77,0.15); color: #e8a44d; border: 1px solid rgba(232,164,77,0.3); padding: 5px 16px; border-radius: 3px; font-size: 0.78rem; letter-spacing: 0.12em; text-transform: uppercase; font-family: monospace;">${tier}</div>
            </div>

            ${reportHtml}

            <div style="text-align: center; margin-top: 28px; margin-bottom: 8px;">
              <a href="https://jarvisstrategies.com/?booking=true"
                 style="display: inline-block; background: #e8a44d; color: #1a2332; padding: 13px 28px; border-radius: 3px; font-weight: 700; text-decoration: none; font-size: 0.95rem;">
                Book a Free Discovery Call &rarr;
              </a>
            </div>

            <p style="color: #999; font-size: 0.78rem; border-top: 1px solid #e0e6ed; padding-top: 16px; margin: 28px 0 0; line-height: 1.6;">
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

            <table style="width:100%; border-collapse:collapse; border: 1px solid #e0e6ed; margin-bottom: 24px;">
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
