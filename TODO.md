# Marketing / SEO Backlog

Sourced from a competitive review of osprey.solutions (Vernon, BC local-business marketing agency) on 2026-07-27. All actionable items implemented 2026-07-27, verified with a local server smoke test — see checkmarks below. Remaining open items need a decision before they can be built (see "needs a decision first").

## 0. PRIORITY — do this first, before anything else on this list

- [x] **Reposition away from "Forward Deployment Strategist."** ✅ Implemented 2026-07-27 — applied to all 17 spots (16 in `index.html`/blog footers + `llms.txt`), plus the `assessment.html` $10M copy fix folded in below. Real-world feedback: it's not resonating with people in construction. Root cause traced via git history (commits `59d74f6` → `f82d46a`, 2026-06-01): the rebrand introduced Palantir/OpenAI/Anthropic name-dropping and a jobTitle that requires explaining Palantir to a contractor to make sense — plus it quietly dropped the "cancel anytime" flexibility in favor of a 12-month retainer, at the same time. Both likely hurt resonance, not just the label.
  - Keep the one good thing from the FDS pass: the substance that Scott builds it himself and stays involved, rather than handing over a report and leaving. Just say it in plain language, not "Forward Deployed Engineering."
  - Supersedes the "no contracts, cancel anytime" rejection below — that rejection assumed the current 12-month-retainer model; this item proposes reverting to monthly/cancel-anytime, which changes that assumption.
  - Drafted replacement copy, reviewed 2026-07-27, not yet applied to any file:

    1. **Meta description / OG description / Twitter description** (3 identical lines, `index.html` ~17/29/36)
       - Old: "Jarvis Strategies embeds inside trades and construction companies across the Okanagan to build and deploy AI systems connected to real workflows. Led by Scott Jarvis. 18 years in operations, now building AI that works."
       - New: "Jarvis Strategies helps trades and construction companies in Vernon, Kelowna, and across the Okanagan implement AI solutions that work, and sticks around to keep them running. Led by Scott Jarvis. 18 years in the trades, now building AI systems that fit how your team operates."

    2. **JSON-LD schema description** (`index.html` ~line 45)
       - Old: "Forward Deployed Engineering for trades and construction SMBs across the Okanagan. Scott Jarvis embeds inside client companies to build and deploy AI systems connected to real workflows. Then stays in."
       - New: "AI implementation consulting for trades and construction companies in the Okanagan. Scott Jarvis builds AI systems that fit how your team actually works, then stays on to make sure they keep delivering."

    3. **JSON-LD jobTitle** (`index.html` ~line 54): `"Forward Deployment Strategist"` → `"AI Implementation Consultant"`

    4. **JSON-LD founder description** (`index.html` ~line 55)
       - New: "18 years in trades and construction operations. Now helping Okanagan businesses implement AI that works, and staying on to keep it that way."

    5. **Hero tag** (`index.html` ~line 303): "Forward Deployment Strategist, embedded AI for trades and construction across the Okanagan" → "AI implementation for trades and construction companies across the Okanagan"

    6. **Hero subhead** (`index.html` ~line 305)
       - New: "69% of businesses say they can't find a clear use case for AI. That's exactly where I start. I help you find where AI fits, build it myself, and stick around to make sure it keeps working instead of collecting dust."

    7. **Problem-section closing line** (`index.html` ~line 331)
       - New: "I find them. I build the solution myself, connected to your actual data and workflows, and make sure the right guardrails are in place. Then I stay on to keep it working as your business changes."

    8. **Services tag** (`index.html` ~line 339): "The engagement model" → "How it works"

    9. **Discovery card description** (`index.html` ~line 351): drop "embedded engagement" → "This is where we start. 69% of B.C. businesses say they can't identify a clear use case for AI...before you start." (rest unchanged)

    10. **Build Sprint card** (`index.html` ~373-375): tag/heading "Embedded Build Sprint" → "AI Integration + Governance"; description drops "I embed inside your company for a month" → "I build this myself, hands-on. I diagnose where AI creates the most value, then design, build, and deploy the system, connected to your actual data, tools, and workflows. Governance built in from the start..."

    11. **Strategic Partnership card** (`index.html` ~385-386) — reverts the retainer model:
        - New: "AI moves fast, and your business keeps changing. Once the foundation's in place, I stay in your corner: ongoing iteration, new use cases, governance oversight, and support as your needs grow."
        - "Monthly retainer. Cancel anytime." (was "12-month strategic retainer")

    12. **Governance line** (`index.html` ~line 413): drop "embedded" → "...into every engagement from the start, not as an afterthought."

    13. **Results heading** (`index.html` ~line 429): "What the embedded engagement delivers." → "What this looks like in practice."

    14. **Who this is for list** (`index.html` ~line 465): drop the added "Companies ready for an embedded engagement" item, revert to the original 6.

    15. **About section, paragraph 2** (`index.html` ~line 490)
        - New: "I founded Jarvis Strategies to help construction and manufacturing firms find where AI creates real value, build it myself, and stay involved to make sure it keeps working. I've seen firsthand how proper governance and hands-on implementation transform how teams operate, without replacing them."

    16. **Footer tagline** — `index.html` + all 15 blog pages (16 files total)
        - Old: "Forward Deployment Strategist for construction, trades & manufacturing"
        - New: "AI implementation for construction, trades & manufacturing"

## Homepage & assessment funnel

- [x] **Embed the Free Assessment directly in the homepage, near the top — not buried behind a click to `/assessment`.** ✅ Built 2026-07-27 — teaser section added between Hero and Stats, hands off to `/assessment?industry=&start=2`. Osprey Solutions recommendation, citing a roof-rejuvenation product with a cost estimator built directly into its homepage. Researched 2026-07-27:
  - Interactive tools embedded on-page convert far higher than links to a separate page (30-50% opt-in vs. low single digits for static content; ~4x time-on-page in one 2026 analysis).
  - Attention spans aren't as brutal as assumed (~76% of visitors scroll at least some, 22% to the bottom) — "near the top" matters more than literally the first pixel, but hero-adjacent placement still converts best.
  - Important distinction from the roofing example: that's an instant-calculator tool (shows a number before asking for contact — that's what cuts its bounce rate 40-62%). Jarvis's assessment is a scored quiz, a different shape — research on quiz funnels says gating the contact form immediately before the score reveal (which is what we already do) is the best-converting placement, not something to change. The fix here is *where the tool lives*, not the gating logic.
  - Implementation options: (1) inline the assessment's HTML/CSS/JS as a real homepage section; (2) iframe `/assessment` into a homepage section; (3) a short inline teaser (first question or two) that hands off to the full `/assessment` flow.
  - **Decision (2026-07-27): go with option 3, the teaser.** Confirmed via code check that option 1 has a real collision, not just a theoretical one: both `index.html` and `assessment.html` use `<canvas id="network-bg">` with their own top-level `const canvas` / `const ctx` animation loop — inlining as-is would throw a duplicate-declaration error and run two competing animation loops on one canvas. The teaser avoids touching the canvas code entirely: pull the first question (or two) into a hero-adjacent homepage section with its own click-to-advance UI, then hand off to the full `/assessment` flow at the contact-form step. Tradeoff accepted: one extra page load before the contact gate, versus the effort of deduping two canvas animations and reconciling two independent fade-in/scroll systems for option 1's marginal engagement gain. Not built yet.
  - Sources: [Guideflow — interactive lead magnets](https://www.guideflow.com/blog/interactive-lead-magnets), [RoofersCoffeeShop — roofing calculator embed](https://www.rooferscoffeeshop.com/post/your-free-roofing-calculator-embed-to-increase-website-conversion), [Involve.me — quiz funnel gate placement](https://www.involve.me/blog/how-to-create-a-quiz-funnel), [CXL — above the fold](https://cxl.com/blog/above-the-fold/)

- [x] **Fix: assessment silent-failure mode.** ✅ Fixed 2026-07-27. Root-caused, two compounding bugs:
  1. **Frontend (`assessment.html:590-604`):** the submit handler's `catch` block calls the exact same `showResults()` as the success path on *any* failure (network error, timeout, 500 response) — there is no failure UI state at all. It always renders "Your AI Readiness Report is being sent to [email]" regardless of what actually happened.
  2. **Backend (`api/assessment.js:280-383`):** the two `sendMail` calls (prospect report, then Scott's internal lead notification) are sequential `await`s inside one `try` block with no individual error handling. If the prospect's email sends fine but Scott's lead-notification email then throws, the whole handler 500s — even though the prospect genuinely got their report. This is the worse case: from the frontend's view it's identical to total failure (same false "success" screen), but here the prospect really did receive something while **Scott never sees the lead at all**, with no trace afterward that it happened.
  - **Proposed fix:** backend — send the two emails independently via `Promise.allSettled` instead of sequential awaits in one try block, and return which one(s) actually succeeded (`{ success, prospectEmailSent, scottEmailSent }`) instead of one boolean. Frontend — stop treating every failure path as success; if the request fails, still show the score (don't dead-end the user) but swap the email-confirmation line for an honest message with a real `tel:`/`mailto:` fallback instead of a false promise that an email is coming. No database exists here (stateless by design per `CLAUDE.md`), so a retry queue isn't realistic — the goal is just: never claim something happened that didn't, and never let a real lead vanish with zero trace.
- [x] **Fix: wire up the dynamic "next available slot" button text.** ✅ Wired up 2026-07-27 — `loadNextAvailability()` fetches on page load and updates `#availabilityText`, falling back to the static text on any failure.
- [x] **Add the phone number to the homepage Contact section and nav bar**, not just the footer. ✅ Added 2026-07-27. Researched 2026-07-27: confirmed via code check that `tel:+12502584465` currently exists in exactly one place on the whole site (footer) — not in nav, hero, or the Contact section cards (currently only "Send an Email" and "Book a Call"), and there's no click-to-call above the fold anywhere.
  - Best-practice findings: phone/call CTA belongs in the sticky header (visible without scrolling); primary CTAs should repeat at hero, mid-page, and end-of-page rather than appearing once; mobile tap targets for contact buttons should be ~60px (bigger than the standard 44-48px guideline) and sit in the thumb zone (bottom-center to mid-screen); the number must be a real `tel:` link so tapping dials immediately, no copy-paste friction.
  - **Recommendation:** add `tel:` links in two more places — a small phone entry in the nav bar (visible on every screen, no scroll needed) and a third Contact-section card alongside the existing two. Leave the floating CTA as-is pointed at `/assessment` (highest-intent funnel) rather than splitting it with a call option — avoids cluttering the hero, which already has three buttons.
  - Sources: [The Ad Firm — click-to-call best practices](https://www.theadfirm.net/click-to-call-and-contact-buttons-best-practices-to-turn-mobile-visitors-into-customers/), [Ventureharbour — CTA best practices](https://ventureharbour.com/15-call-action-best-practices-increase-conversions/), [Push Leads — restoration site conversion](https://pushleads.com/restoration-company-seo/website-conversion-optimization-2/), [UX Movement — mobile CTA placement](https://uxmovement.com/mobile/optimal-placement-for-mobile-call-to-action-buttons/), [Inkbot Design — mobile UX for thumbs](https://inkbotdesign.com/mobile-ux/), [OPTASY — usable mobile CTA buttons](https://medium.com/@OPTASY.com/how-to-make-your-mobile-call-to-action-buttons-intuitively-usable-10-best-practices-d820f30152b0)
- [x] **Check the assessment intro copy** — ✅ Fixed 2026-07-27, replaced with "built specifically for trades, construction, and manufacturing businesses" to match the stated ICP.

## High-value, directly applicable

- [x] **Promote blog "problem" posts into a Solutions page tier.** ✅ Built 2026-07-27 — `/solutions` hub plus 4 pages (proposal-turnaround, estimating, engineering-documentation, subcontractor-coordination), linked from nav on every page, cross-linked from the corresponding blog posts, added to `llms.txt` and `sitemap.xml`.
- [x] **Grow `llms.txt` as content grows; add `llms-full.txt` once there's enough to justify it.** FDE-language bug fixed 2026-07-27; `llms-full.txt` still intentionally not built (see recommendation below — unchanged). The spec supports this two-tier pattern (short summary file + expanded detail file). We only built the short version so far. Checked 2026-07-27:
  - Content audit: `llms.txt` currently lists all 15 blog posts plus homepage and assessment — cross-checked against `blog/*.html` and nothing is missing. Content-wise it's up to date.
  - **Bug found:** `llms.txt`'s own summary paragraph still carries the old FDE-era language — "Jarvis Strategies embeds inside trades, construction, and manufacturing companies... then stays in as an ongoing partner." This is the same positioning problem as the repositioning item above and was missed by that pass since `llms.txt` wasn't one of the ~16 files checked there. Add it as a 17th spot to that repositioning pass.
  - **`llms-full.txt` research:** the two-tier pattern (short index + full-text dump) is mainly valuable for documentation-heavy sites — API/SDK references, help centers — where a model benefits from ingesting full page text in one request instead of extra fetches. Most sites, including marketing/blog sites like this one, only need the short `llms.txt`. Neither file is a proven ranking lever for search; the value (where it exists) is in the agentic-AI-fetches-your-site layer, not search citations.
  - **Recommendation:** hold off on `llms-full.txt` for now — 15 blog posts of marketing/thought-leadership content doesn't clear the bar the research describes ("text-heavy," "extensive... reference" content). Revisit if the blog grows substantially heavier (e.g. the Solutions-page tier below gets built out) or if analytics show AI crawlers/agents hitting individual blog pages heavily enough that inlining would measurably help.
  - Sources: [Lab451 — llms.txt vs llms-full.txt](https://lab451.org/blog/llms-txt-vs-llms-full-txt), [llms-txt.io — do you need both](https://llms-txt.io/blog/llms-txt-and-llms-full-txt), [llmstxtgen.com — when to use each](https://llmstxtgen.com/llms-full-txt-explained)
- [x] **Add bottom-funnel, high-intent blog posts.** ✅ Written 2026-07-27: [What Does an AI Readiness Assessment Cost?](blog/assessment-cost.html), [AI Consultant vs. Hiring In-House](blog/ai-consultant-vs-in-house.html), [How Long Does AI Implementation Actually Take?](blog/ai-implementation-timeline.html) (dropped "Embedded" from the title to match the repositioning pass). Added to `blog/index.html`, `blog/rss.xml`, `llms.txt`, and `sitemap.xml`.

## Applicable with adaptation — needs a decision first

- [ ] **Industry-specific landing pages?** Worth it only if doubling down on sub-verticals (GC/subcontractor coordination vs. manufacturing/engineering docs vs. estimating-heavy trades) instead of staying a generalist across trades/construction/manufacturing. Blog content already splits this way naturally. Open question: stay broad, or build dedicated pages per segment?
- [ ] **Footer trust badges?** Only add if there's a real, verifiable credential (Chamber membership, certification, etc.) — do not fabricate volume claims like Osprey's "100+ businesses." Open question: does Scott have any such credential to display?

## Explicitly rejected — do not do

- "No contracts, cancel anytime" framing — Osprey sells month-to-month ad management; Jarvis sells embedded engagements (Discovery → Build Sprint → Strategic Partnership). Copying this would misrepresent the actual service model.
- Volume stat-counters ("100+ businesses," "40+ accounts") — not available at current scale; fabricating would be worse than omitting.

## Already validated, no action needed

- Homepage's "You know AI is coming, you just don't know where it fits" opener already matches Osprey's pain-agitation pattern.
- Floating sticky CTA (`#floatingCta` → Free Assessment) already matches their sticky call button.
- Dark-navy/orange palette and the AI-crawler-allow `robots.txt` pattern already independently match their setup.
