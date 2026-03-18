// Vercel Serverless Function: Find Next Free 30-Min Slot
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
    
    // Get current time and 14 days ahead
    const now = new Date();
    const twoWeeksOut = new Date(now.getTime() + (14 * 24 * 60 * 60 * 1000));

    // Query free/busy to see when you're actually busy
    const freeBusy = await calendar.freebusy.query({
      requestBody: {
        timeMin: now.toISOString(),
        timeMax: twoWeeksOut.toISOString(),
        items: [{ id: CALENDAR_ID }],
        timeZone: 'America/Vancouver'
      }
    });

    const busySlots = freeBusy.data.calendars[CALENDAR_ID]?.busy || [];
    
    // Find next free 30-min slot during business hours
    const nextAvailable = findNextFreeSlot(now, busySlots);
    
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
    return res.status(200).json({
      available: false,
      text: 'Book a Call',
      fallback: true,
      error: error.message
    });
  }
}

function findNextFreeSlot(startTime, busySlots) {
  const SLOT_DURATION_MS = 30 * 60 * 1000; // 30 minutes
  const DAYS_TO_CHECK = 14;

  // Business hours: 9:30 AM - 12:00 PM and 1:30 PM - 3:00 PM Pacific
  const MORNING_START = { hour: 9, minute: 30 };
  const MORNING_END = { hour: 12, minute: 0 };
  const AFTERNOON_START = { hour: 13, minute: 30 };
  const AFTERNOON_END = { hour: 15, minute: 0 };

  // Start from now, round up to next 30-min mark
  let checkTime = new Date(startTime);
  const minutes = checkTime.getMinutes();
  const roundedMinutes = Math.ceil(minutes / 30) * 30;
  checkTime.setMinutes(roundedMinutes, 0, 0);

  const endTime = new Date(startTime.getTime() + (DAYS_TO_CHECK * 24 * 60 * 60 * 1000));

  while (checkTime < endTime) {
    // Convert to Pacific time to check business hours
    const pacificDate = new Date(checkTime.toLocaleString('en-US', {
      timeZone: 'America/Vancouver'
    }));
    
    const dayOfWeek = pacificDate.getDay();
    const hour = pacificDate.getHours();
    const minute = pacificDate.getMinutes();
    
    // Skip weekends
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      // Check if within business hours
      const inMorningWindow = 
        (hour > MORNING_START.hour || (hour === MORNING_START.hour && minute >= MORNING_START.minute)) &&
        (hour < MORNING_END.hour || (hour === MORNING_END.hour && minute < MORNING_END.minute));
      
      const inAfternoonWindow = 
        (hour > AFTERNOON_START.hour || (hour === AFTERNOON_START.hour && minute >= AFTERNOON_START.minute)) &&
        (hour < AFTERNOON_END.hour || (hour === AFTERNOON_END.hour && minute < AFTERNOON_END.minute));
      
      if (inMorningWindow || inAfternoonWindow) {
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
