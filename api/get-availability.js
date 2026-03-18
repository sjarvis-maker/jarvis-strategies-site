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
        available: false,
        text: 'Book a Call',
        fallback: true
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
    
    // Get current time and 14 days ahead in UTC
    const now = new Date();
    const twoWeeksOut = new Date(now.getTime() + (14 * 24 * 60 * 60 * 1000));

    // Query free/busy
    const freeBusy = await calendar.freebusy.query({
      requestBody: {
        timeMin: now.toISOString(),
        timeMax: twoWeeksOut.toISOString(),
        items: [{ id: CALENDAR_ID }],
        timeZone: 'America/Vancouver'
      }
    });

    const busySlots = freeBusy.data.calendars[CALENDAR_ID]?.busy || [];
    
    // Find next available slot
    const nextAvailable = findNextAvailableSlot(now, busySlots);
    
    if (!nextAvailable) {
      return res.status(200).json({
        available: false,
        text: 'Book a Call',
        fallback: true
      });
    }

    // Format for display
    const formatted = nextAvailable.toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: 'America/Vancouver',
      timeZoneName: 'short'
    });
    
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

function findNextAvailableSlot(startTime, busySlots) {
  const BUSINESS_START = 9; // 9 AM
  const BUSINESS_END = 17;  // 5 PM  
  const SLOT_DURATION_MS = 30 * 60 * 1000; // 30 minutes
  const DAYS_TO_CHECK = 14;

  // Start checking from now
  let checkTime = new Date(startTime);
  
  // Round up to next 30-minute increment
  const minutes = checkTime.getMinutes();
  const roundedMinutes = Math.ceil(minutes / 30) * 30;
  checkTime.setMinutes(roundedMinutes, 0, 0);
  
  const endTime = new Date(startTime.getTime() + (DAYS_TO_CHECK * 24 * 60 * 60 * 1000));

  while (checkTime < endTime) {
    // Get hour in Pacific timezone
    const pacificHour = parseInt(checkTime.toLocaleString('en-US', {
      timeZone: 'America/Vancouver',
      hour: '2-digit',
      hour12: false
    }));
    
    // Get day of week in Pacific timezone
    const pacificDay = new Date(checkTime.toLocaleString('en-US', {
      timeZone: 'America/Vancouver'
    })).getDay();
    
    // Skip weekends (0 = Sunday, 6 = Saturday)
    if (pacificDay !== 0 && pacificDay !== 6) {
      // Check if within business hours
      if (pacificHour >= BUSINESS_START && pacificHour < BUSINESS_END) {
        const slotEnd = new Date(checkTime.getTime() + SLOT_DURATION_MS);
        
        // Check if this slot conflicts with any busy time
        const isConflict = busySlots.some(busy => {
          const busyStart = new Date(busy.start);
          const busyEnd = new Date(busy.end);
          return checkTime < busyEnd && slotEnd > busyStart;
        });
        
        if (!isConflict) {
          return checkTime;
        }
      }
    }
    
    // Move to next 30-minute slot
    checkTime = new Date(checkTime.getTime() + SLOT_DURATION_MS);
  }

  return null;
}
