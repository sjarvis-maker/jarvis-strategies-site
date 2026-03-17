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
    const API_KEY = process.env.GOOGLE_CALENDAR_API_KEY;

    if (!CALENDAR_ID || !API_KEY) {
      return res.status(200).json({ 
        error: 'Calendar configuration missing',
        fallback: 'Book a Call'
      });
    }

    const calendar = google.calendar({ version: 'v3', auth: API_KEY });
    
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
  const BUSINESS_START = 9; // 9 AM
  const BUSINESS_END = 17;  // 5 PM
  const SLOT_DURATION = 30; // minutes
  const DAYS_TO_CHECK = 14;

  let currentCheck = new Date(startTime);
  
  // Round up to next 30min increment
  currentCheck.setMinutes(Math.ceil(currentCheck.getMinutes() / 30) * 30, 0, 0);

  for (let day = 0; day < DAYS_TO_CHECK; day++) {
    const dayOfWeek = currentCheck.getDay();
    
    // Skip weekends
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      currentCheck.setDate(currentCheck.getDate() + 1);
      currentCheck.setHours(BUSINESS_START, 0, 0, 0);
      continue;
    }

    // Check each 30min slot during business hours
    for (let hour = BUSINESS_START; hour < BUSINESS_END; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const slotStart = new Date(currentCheck);
        slotStart.setHours(hour, minute, 0, 0);
        
        const slotEnd = new Date(slotStart);
        slotEnd.setMinutes(slotEnd.getMinutes() + SLOT_DURATION);

        // Check if slot is in the past
        if (slotStart < new Date()) continue;

        // Check if slot conflicts with busy times
        const isConflict = busySlots.some(busy => {
          const busyStart = new Date(busy.start);
          const busyEnd = new Date(busy.end);
          return (slotStart < busyEnd && slotEnd > busyStart);
        });

        if (!isConflict) {
          return slotStart;
        }
      }
    }

    // Move to next day
    currentCheck.setDate(currentCheck.getDate() + 1);
    currentCheck.setHours(BUSINESS_START, 0, 0, 0);
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
