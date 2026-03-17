// Vercel Serverless Function: Get Next Available Time from Google Calendar
// Path: /api/get-availability.js

import { google } from 'googleapis';

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID;
    const SERVICE_ACCOUNT_KEY = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;

    if (!CALENDAR_ID || !SERVICE_ACCOUNT_KEY) {
      return res.status(200).json({ 
        error: 'Calendar configuration missing',
        fallback: 'Book a Call'
      });
    }

    // Set up service account authentication
    const serviceAccountKey = JSON.parse(SERVICE_ACCOUNT_KEY);
    
    const auth = new google.auth.JWT({
      email: serviceAccountKey.client_email,
      key: serviceAccountKey.private_key,
      scopes: ['https://www.googleapis.com/auth/calendar.readonly']
    });

    const calendar = google.calendar({ version: 'v3', auth });
    
    // Get current time and 14 days ahead
    const now = new Date();
    const twoWeeksOut = new Date(now.getTime() + (14 * 24 * 60 * 60 * 1000));

    // Query free/busy
    const freeBusy = await calendar.freebusy.query({
      requestBody: {
        timeMin: now.toISOString(),
        timeMax: twoWeeksOut.toISOString(),
        items: [{ id: CALENDAR_ID }],
        timeZone: 'America/Vancouver' // Pacific Time
      }
    });

    const busySlots = freeBusy.data.calendars[CALENDAR_ID].busy || [];
    
    // Find next available slot (30min duration, business hours only)
    const nextAvailable = findNextAvailableSlot(now, twoWeeksOut, busySlots);
    
    if (!nextAvailable) {
      return res.status(200).json({
        available: false,
        text: 'Book a Call',
        fallback: true
      });
    }

    // Format the date/time nicely
    const formatted = formatAvailability(nextAvailable);
    
    return res.status(200).json({
      available: true,
      datetime: nextAvailable.toISOString(),
      text: `Next Available: ${formatted}`,
      fallback: false
    });

  } catch (error) {
    console.error('Calendar API Error:', error);
    return res.status(200).json({
      available: false,
      text: 'Book a Call',
      fallback: true,
      error: error.message
    });
  }
}

function findNextAvailableSlot(startTime, endTime, busySlots) {
  const BUSINESS_START = 9; // 9 AM Pacific
  const BUSINESS_END = 17;  // 5 PM Pacific
  const SLOT_DURATION = 30; // minutes
  const DAYS_TO_CHECK = 14;
  const PACIFIC_OFFSET = -7; // PDT is UTC-7

  // Get current time in Pacific
  const now = new Date();
  const pacificNow = new Date(now.toLocaleString('en-US', { timeZone: 'America/Vancouver' }));
  
  let checkDate = new Date(pacificNow);
  checkDate.setMinutes(Math.ceil(checkDate.getMinutes() / 30) * 30, 0, 0);

  for (let day = 0; day < DAYS_TO_CHECK; day++) {
    const dayOfWeek = checkDate.getDay();
    
    // Skip weekends
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      checkDate.setDate(checkDate.getDate() + 1);
      checkDate.setHours(BUSINESS_START, 0, 0, 0);
      continue;
    }

    // Check each 30min slot during business hours
    for (let hour = BUSINESS_START; hour < BUSINESS_END; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        // Create slot time in Pacific
        const slotTime = new Date(checkDate);
        slotTime.setHours(hour, minute, 0, 0);
        
        // Skip if in the past
        if (slotTime <= pacificNow) continue;

        // Convert to UTC for comparison with Google Calendar
        const slotStartUTC = new Date(slotTime.getTime() - (PACIFIC_OFFSET * 60 * 60 * 1000));
        const slotEndUTC = new Date(slotStartUTC.getTime() + SLOT_DURATION * 60 * 1000);

        // Check if slot conflicts with busy times
        const isConflict = busySlots.some(busy => {
          const busyStart = new Date(busy.start);
          const busyEnd = new Date(busy.end);
          return (slotStartUTC < busyEnd && slotEndUTC > busyStart);
        });

        if (!isConflict) {
          // Return as UTC ISO string
          return slotStartUTC;
        }
      }
    }

    // Move to next day
    checkDate.setDate(checkDate.getDate() + 1);
    checkDate.setHours(BUSINESS_START, 0, 0, 0);
  }

  return null;
}

function formatAvailability(datetime) {
  const options = { 
    weekday: 'short', 
    month: 'short', 
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/Vancouver',
    timeZoneName: 'short'
  };
  
  return datetime.toLocaleString('en-US', options);
}
