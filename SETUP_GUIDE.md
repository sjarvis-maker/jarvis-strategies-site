# Jarvis Strategies Booking System Setup Guide

This guide will help you configure the Google Calendar integration and email system for your booking request workflow.

## Prerequisites

- Google Account
- Gmail or SMTP email service
- Vercel account (already set up)

---

## PART 1: Google Calendar API Setup

### Step 1: Create Google Cloud Project

1. Go to https://console.cloud.google.com/
2. Click **Select a project** → **New Project**
3. Name: `Jarvis Strategies Booking`
4. Click **Create**

### Step 2: Enable Google Calendar API

1. In your new project, go to **APIs & Services** → **Library**
2. Search for "Google Calendar API"
3. Click on it, then click **Enable**

### Step 3: Create API Key

1. Go to **APIs & Services** → **Credentials**
2. Click **Create Credentials** → **API Key**
3. Copy the API key (you'll need this later)
4. Click **Edit API key** (pencil icon)
5. Under **API restrictions**, select **Restrict key**
6. Check **Google Calendar API**
7. Click **Save**

### Step 4: Get Your Calendar ID

1. Go to https://calendar.google.com
2. Find the calendar you want to use (usually your primary calendar)
3. Click the three dots next to it → **Settings and sharing**
4. Scroll down to **Integrate calendar**
5. Copy the **Calendar ID** (looks like: your-email@gmail.com or a long string)

### Step 5: Make Calendar Accessible

1. Still in Calendar Settings, scroll to **Access permissions**
2. Check **Make available to public** (only free/busy info will be exposed, not details)
3. Click **OK** on the warning

---

## PART 2: Email Setup (Gmail SMTP)

### Option A: Use Gmail with App Password (Recommended)

1. Go to https://myaccount.google.com/security
2. Enable **2-Step Verification** if not already enabled
3. Search for "App passwords" in the search bar
4. Select **Mail** and **Other (Custom name)**
5. Name it: `Jarvis Strategies Booking`
6. Click **Generate**
7. Copy the 16-character password (you'll need this)

**Your SMTP settings:**
- Host: `smtp.gmail.com`
- Port: `465`
- User: `sjarvis@jarvisstrategies.com`
- Pass: [16-character app password you just generated]

---

## PART 3: Configure Vercel Environment Variables

1. Go to https://vercel.com/dashboard
2. Select your `jarvis-strategies-site` project
3. Go to **Settings** → **Environment Variables**
4. Add the following variables:

| Variable Name | Value | Example |
|--------------|-------|---------|
| `GOOGLE_CALENDAR_API_KEY` | Your API key from Step 3 | `AIzaSyD...` |
| `GOOGLE_CALENDAR_ID` | Your calendar ID from Step 4 | `sjarvis@jarvisstrategies.com` |
| `SMTP_HOST` | `smtp.gmail.com` | `smtp.gmail.com` |
| `SMTP_PORT` | `465` | `465` |
| `SMTP_USER` | `sjarvis@jarvisstrategies.com` | `sjarvis@jarvisstrategies.com` |
| `SMTP_PASS` | Your Gmail app password | `abcd efgh ijkl mnop` |

**Important:** After adding all variables, click **Save**

---

## PART 4: Deploy to Vercel

Once you've:
1. Updated index.html with the changes
2. Added all the API files to your GitHub repo
3. Configured environment variables in Vercel

Vercel will automatically redeploy your site with the booking system enabled.

---

## Testing the System

### Test 1: Availability Display
- Visit your website
- The "Book a Call" button should update to show "Next Available: [date/time]"
- If it doesn't update within 30 seconds, check browser console for errors

### Test 2: Submit a Test Request
- Click the booking button
- Fill out the form with your own email
- Submit
- You should receive an approval email at sjarvis@jarvisstrategies.com

### Test 3: Approve the Request
- Click the "Approve" button in the email
- You should receive a calendar invitation
- Check your Google Calendar for the new event

### Test 4: Suggest Alternate Time
- Submit another test request
- Click "Suggest Alternate Time" in the approval email
- Pick a different time and send
- Check your test email for the alternate time proposal

### Test 5: Decline Request
- Submit another test request
- Click "Decline" in the approval email
- Check your test email for the polite rejection

---

## Troubleshooting

### "Calendar configuration missing" error
- Check that environment variables are set correctly in Vercel
- Redeploy the site after adding variables

### "Failed to fetch availability" error
- Verify Google Calendar API is enabled
- Check API key restrictions allow Calendar API
- Ensure calendar is set to public (free/busy only)

### Email not sending
- Verify Gmail app password is correct (no spaces)
- Check SMTP settings match exactly
- Ensure 2-Step Verification is enabled on Gmail

### Calendar invite not creating
- Calendar ID must match exactly (check for typos)
- API key must have Calendar API enabled
- Calendar must have edit permissions for the API

---

## Security Notes

- API key is restricted to Calendar API only
- Only free/busy information is public, not event details
- Calendar invites only go to approved requests
- All prospect data is transmitted via encrypted email links

---

## Maintenance

- API key: No expiration, but can be rotated if compromised
- Gmail app password: Can be revoked/regenerated anytime
- Environment variables: Can be updated in Vercel settings without code changes

---

## Support

If you run into issues:
1. Check Vercel function logs: Project → Deployments → [latest] → Functions
2. Check browser console for JavaScript errors
3. Verify environment variables are set correctly
4. Test API endpoints directly: https://jarvisstrategies.com/api/get-availability

