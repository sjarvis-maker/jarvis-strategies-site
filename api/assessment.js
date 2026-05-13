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

const MAX_POINTS = [20, 20, 15, 15, 15, 15];

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

function generateLeadProfile(scoredAnswers) {
  const aiExpPts   = Number(scoredAnswers[0]?.points) || 0; // AI Experience, max 20
  const urgencyPts = Number(scoredAnswers[4]?.points) || 0; // Urgency / Driver, max 15

  const aiLevel  = aiExpPts  <= 7 ? 'naive' : aiExpPts  <= 14 ? 'aware' : 'sophisticated';
  const urgLevel = urgencyPts <= 5 ? 'low'   : 'high';

  const profiles = {
    'naive-low':          'Lead profile: AI-naive, low urgency — start with education, establish why this matters now',
    'naive-high':         'Lead profile: AI-naive, motivated — start with education, move quickly to a quick win',
    'aware-low':          'Lead profile: AI-aware, low urgency — validate the business case before recommending next steps',
    'aware-high':         'Lead profile: AI-aware, pain-driven — lead with ROI and a concrete use case, skip the basics',
    'sophisticated-low':  'Lead profile: Sophisticated, exploring — peer-level conversation, they will drive the agenda',
    'sophisticated-high': 'Lead profile: Sophisticated, ready to move — give them a roadmap, skip the pitch',
  };

  return profiles[`${aiLevel}-${urgLevel}`] || 'Lead profile: Review answers manually';
}

async function generateReport({ name, company, score, tier, industry, scoredAnswers }) {
  const client = new Anthropic();

  const answersSummary = scoredAnswers.map((a, i) =>
    `${QUESTION_LABELS[i + 1] || a.key}: "${a.answer}" (${a.points} points out of a possible ${MAX_POINTS[i] || 20})`
  ).join('\n');

  const prompt = `You are writing a personalized AI Readiness Assessment report on behalf of Scott Jarvis at Jarvis Strategies, an AI implementation consultancy serving trades and construction companies in the Okanagan.

ASSESSMENT RESULTS:
Name: ${name}
Company: ${company || 'their company'}
Industry: ${industry || 'Not specified'}
Overall Score: ${score}/100
Tier: ${tier}

QUESTION-BY-QUESTION BREAKDOWN:
${answersSummary}

TIER-SPECIFIC APPROACH — match your approach exactly to their tier:
- Foundation Stage (0-30): Encouraging without being patronizing. Focus on one quick win they can act on this week. Do not list everything wrong. Name the single AI use case closest to their current capability and explain what doing it would produce.
- Building Momentum (31-55): Direct and diagnostic. Skip the encouragement — they do not need it. Name the one specific thing holding them back based on their lowest-scoring area. Tell them what fixing it first would unblock.
- AI Ready (56-80): Gap analysis only. Do not validate what they already know. Look at the combination of scores, find the specific weakness they are likely overlooking, name the operational consequence of leaving it unaddressed, and tell them what fixing it unlocks. Do not lead with their strengths.
- Advanced Adopter (81-100): Peer-level. Assume they know what they are doing. Address scaling, governance risk, or competitive differentiation specific to their scores. No beginner framing.

INDUSTRY REQUIREMENT:
The respondent works in: ${industry || 'Not specified'}
Name at least one specific AI use case for their industry in the area analysis and at least one in the recommendations. Not as a suggestion or example — as a direct statement. A plumbing company and a chartered accounting firm have different AI use cases. Name the ones that apply to this respondent.

RULES FOR ALL TIERS:
- Never write generic AI advice that could apply to any business.
- Every insight must reference their specific answer, not just their score.
- For any area scoring below 50% of its maximum points, name the specific operational problem that gap creates — not just that it is a gap.
- Recommendations must name a concrete action, not a category. Bad: "Improve data accessibility." Good: "Audit where your critical business data lives and whether it can be queried or exported — AI tools can only work with data they can reach."
- Each area insight must be 1-2 sentences maximum. Make the point, then stop.

VOICE AND STYLE:
Write like a direct, knowledgeable person — not like AI-generated content. Vary sentence length. Use plain language throughout.
Never use these words or phrases: crucial, pivotal, delve, enhance, fostering, tapestry, testament, underscore, showcase, vibrant, align with, interplay, intricate, key (as adjective), valuable, landscape (abstract), additionally, emphasizing.
Do not use em dashes. Use commas, periods, or parentheses instead.
Do not use rule-of-three sentence structures.
Do not end with a generic positive conclusion.
Every sentence must be true specifically for this respondent — no statement that could apply to any business.

Write a personalized assessment report with exactly these sections. Return ONLY valid JSON with no markdown formatting or code fences:

{
  "executiveSummary": "2-3 sentences. Name their tier. Identify the most important tension or opportunity their specific score combination reveals. For AI Ready and Advanced tiers, lead with the gap, not the strength.",
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
  "keySummaryBullets": [
    "One line, specific to their scores. State a finding or direction, not a compliment. Max 18 words.",
    "Second bullet.",
    "Third bullet — only include if there is a genuinely distinct third point worth stating."
  ],
  "closingMessage": "1-2 sentences written as Scott speaking directly to the person. Plain, conversational, no jargon. Name one specific thing a call would accomplish for them based on their actual results — not a generic offer. Example tone: Your data accessibility score is the sticking point — that is what the first call would focus on."
}`;

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1400,
    messages: [{ role: 'user', content: prompt }]
  });

  let text = message.content[0].text.trim();
  text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  return JSON.parse(text);
}

function buildReportHtml(report, scoredAnswers) {
  const areasHtml = report.areaAnalysis.map((a, i) => {
    const pts = (scoredAnswers && scoredAnswers[i]) ? Number(scoredAnswers[i].points) : 0;
    const max = MAX_POINTS[i] || 20;
    const pct = Math.min(100, Math.round((pts / max) * 100));
    const empty = 100 - pct;

    return `
    <tr>
      <td style="padding: 12px 14px; color: #1a2332; font-size: 0.83rem; font-weight: 600; white-space: nowrap; vertical-align: top; border-bottom: 1px solid #e8edf3; width: 140px;">
        ${escapeHtml(a.area)}
        <div style="margin-top: 5px; font-size: 0.68rem; color: #999; font-family: monospace; letter-spacing: 0.04em;">${pts} / ${max} pts</div>
        <table width="110" cellpadding="0" cellspacing="0" style="border-collapse: collapse; margin-top: 5px;">
          <tr>
            <td width="${pct}%" style="height: 5px; background: #e8a44d; padding: 0; font-size: 0;"></td>
            <td width="${empty}%" style="height: 5px; background: #dde3ea; padding: 0; font-size: 0;"></td>
          </tr>
        </table>
      </td>
      <td style="padding: 12px 14px; color: #555; font-size: 0.85rem; line-height: 1.6; border-bottom: 1px solid #e8edf3;">${escapeHtml(a.insight)}</td>
    </tr>`;
  }).join('');

  const recsHtml = report.recommendations.map((r, i) => `
    <p style="margin: 0 0 10px; color: #444; font-size: 0.88rem; line-height: 1.6;">
      <strong style="color: #e8a44d;">${i + 1}.</strong> ${escapeHtml(r)}
    </p>
  `).join('');

  const bullets = Array.isArray(report.keySummaryBullets) ? report.keySummaryBullets : [];
  const bulletsHtml = bullets.map(b => `
    <tr>
      <td width="14" valign="top" style="color: #e8a44d; font-weight: 700; font-size: 1rem; padding: 0 6px 7px 0; line-height: 1.5;">&#8250;</td>
      <td style="color: #444; font-size: 0.88rem; line-height: 1.6; padding: 0 0 7px 0;">${escapeHtml(b)}</td>
    </tr>`).join('');

  const closingMsg = report.closingMessage || report.closingParagraph || '';

  return `
    <div style="margin-bottom: 28px;">
      <h2 style="font-family: Georgia, serif; font-size: 1.15rem; color: #1a2332; margin: 0 0 10px 0; padding-bottom: 8px; border-bottom: 2px solid #e8a44d;">Executive Summary</h2>
      <p style="margin: 0; color: #444; font-size: 0.9rem; line-height: 1.7;">${escapeHtml(report.executiveSummary)}</p>
    </div>

    <div style="margin-bottom: 28px;">
      <h2 style="font-family: Georgia, serif; font-size: 1.15rem; color: #1a2332; margin: 0 0 10px 0; padding-bottom: 8px; border-bottom: 2px solid #e8a44d;">Area-by-Area Analysis</h2>
      <table style="width: 100%; border-collapse: collapse; border: 1px solid #e0e6ed;">
        <tbody>${areasHtml}</tbody>
      </table>
    </div>

    <div style="margin-bottom: 28px;">
      <h2 style="font-family: Georgia, serif; font-size: 1.05rem; color: #1a2332; margin: 0 0 14px 0; padding-bottom: 8px; border-bottom: 2px solid #e8a44d;">Top Recommendations</h2>
      ${recsHtml}
    </div>

    ${bulletsHtml ? `
    <div style="margin-bottom: 28px; background: #f7f9fc; border: 1px solid #e0e6ed; border-radius: 4px; padding: 18px 20px;">
      <p style="margin: 0 0 12px; font-size: 0.8rem; color: #999; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; font-family: monospace;">Key Takeaways</p>
      <table cellpadding="0" cellspacing="0" style="border-collapse: collapse; width: 100%;">
        <tbody>${bulletsHtml}</tbody>
      </table>
    </div>` : ''}

    <table cellpadding="0" cellspacing="0" style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
      <tr>
        <td width="80" valign="top" style="padding: 0 0 0 0;">
          <img src="https://jarvisstrategies.com/headshot.jpg" alt="Scott Jarvis" width="64" height="80" style="border-radius: 3px; display: block; border: 0;" />
        </td>
        <td valign="top" style="padding: 0 0 0 16px;">
          <p style="margin: 0 0 8px; color: #333; font-size: 0.9rem; line-height: 1.7;">${escapeHtml(closingMsg)}</p>
          <p style="margin: 0; font-size: 0.8rem; color: #888;">Scott Jarvis &middot; Jarvis Strategies</p>
        </td>
      </tr>
    </table>

    <div style="padding: 16px 20px; background: #fffbf5; border: 1px solid #f0ddb8; border-radius: 4px;">
      <p style="margin: 0 0 10px; font-size: 0.8rem; color: #999; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; font-family: monospace;">What we'll cover on the call</p>
      <table cellpadding="0" cellspacing="0" style="border-collapse: collapse; width: 100%;">
        <tr><td width="14" valign="top" style="color: #e8a44d; font-weight: 700; font-size: 1rem; padding: 0 6px 7px 0; line-height: 1.5;">&#8250;</td><td style="font-size: 0.88rem; color: #555; line-height: 1.6; padding: 0 0 7px 0;">Review the specific gaps your score revealed and what to do about them first</td></tr>
        <tr><td width="14" valign="top" style="color: #e8a44d; font-weight: 700; font-size: 1rem; padding: 0 6px 7px 0; line-height: 1.5;">&#8250;</td><td style="font-size: 0.88rem; color: #555; line-height: 1.6; padding: 0 0 7px 0;">Match AI use cases to how your business operates, not generic examples</td></tr>
        <tr><td width="14" valign="top" style="color: #e8a44d; font-weight: 700; font-size: 1rem; padding: 0 6px 7px 0; line-height: 1.5;">&#8250;</td><td style="font-size: 0.88rem; color: #555; line-height: 1.6; padding: 0 0 7px 0;">Be direct about where you're ready and where you're not</td></tr>
        <tr><td width="14" valign="top" style="color: #e8a44d; font-weight: 700; font-size: 1rem; padding: 0 6px 0 0; line-height: 1.5;">&#8250;</td><td style="font-size: 0.88rem; color: #555; line-height: 1.6;">Leave with a clear sense of whether and how to move forward</td></tr>
      </table>
    </div>
  `;
}

function buildFallbackReportHtml() {
  return `
    <div style="border-left: 3px solid #e8a44d; padding: 12px 16px; background: #fffbf5; border-radius: 0 4px 4px 0; margin-bottom: 4px;">
      <p style="margin: 0; color: #555; font-size: 0.9rem; line-height: 1.7;">A discovery call is the best next step — we'll walk through your results together and map out exactly where AI can deliver the fastest ROI for your business.</p>
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

    // Extract industry and scored answers
    const industryAnswer = answers.find(a => a.key === 'industry');
    const industry = industryAnswer ? industryAnswer.answer : 'Not specified';
    const scoredAnswers = answers.filter(a => a.key !== 'industry');

    // Calculate score server-side — do not trust client value
    const score = answers.reduce((sum, a) => sum + (Number(a.points) || 0), 0);
    const tier = getTier(score);

    // Lead profile note for Scott's internal email
    const leadProfile = generateLeadProfile(scoredAnswers);

    // Generate personalized report via Claude — fall back gracefully if it fails
    let reportHtml;
    try {
      const report = await generateReport({ name, company, score, tier, industry, scoredAnswers });
      reportHtml = buildReportHtml(report, scoredAnswers);
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

    // ── Email to prospect ─────────────────────────────────────────────────────
    await transporter.sendMail({
      from: `"Jarvis Strategies" <${process.env.SMTP_USER}>`,
      to: email,
      subject: `Your AI Readiness Score: ${score}/100 — ${tier}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
          <div style="background: #1a2332; padding: 28px 32px; border-radius: 6px 6px 0 0;">
            <img src="https://jarvisstrategies.com/logo.png" alt="Jarvis Strategies" width="180" style="display:block;border:0;max-width:180px;" />
            <p style="color: #a8bcc8; font-size: 0.85rem; margin: 10px 0 0; letter-spacing: 0.04em;">AI Readiness Assessment Report</p>
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
              Jarvis Strategies &nbsp;&middot;&nbsp;
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

            <div style="border-left: 3px solid #e8a44d; padding: 10px 14px; background: #fffbf5; border-radius: 0 4px 4px 0; margin-bottom: 20px;">
              <p style="margin: 0; font-size: 0.85rem; color: #555;">${escapeHtml(leadProfile)}</p>
            </div>

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
