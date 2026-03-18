// Vercel Serverless Function: Get Next Available Appointment Slot
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
    
    // Get current time and 14 days ahead
    const now = new Date();
    const twoWeeksOut = new Date(now.getTime() + (14 * 24 * 60 * 60 * 1000));

    // List all events in the next 2 weeks
    const eventsResponse = await calendar.events.list({
      calendarId: CALENDAR_ID,
      timeMin: now.toISOString(),
      timeMax: twoWeeksOut.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 250
    });

    const events = eventsResponse.data.items || [];
    
    // Find next available appointment slot
    const result = findNextAppointmentSlot(events, now);
    
    if (!result.slot) {
      return res.status(200).json({
        available: false,
        text: 'Book a Call',
        fallback: true,
        debug: result.debug
      });
    }

    // Format for display
    const formatted = new Date(result.slot).toLocaleString('en-US', {
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
      datetime: result.slot,
      text: `Next Available: ${formatted}`,
      fallback: false,
      debug: result.debug
    });

  } catch (error) {
    console.error('Calendar API Error:', error);
    return res.status(200).json({
      available: false,
      text: 'Book a Call',
      fallback: true,
      error: error.message,
      debug: {
        errorDetails: error.toString()
      }
    });
  }
}

function findNextAppointmentSlot(events, now) {
  const debugInfo = {
    totalEvents: events.length,
    eventsChecked: [],
    foundSlot: null
  };
  
  for (const event of events) {
    const eventStart = new Date(event.start.dateTime || event.start.date);
    
    const eventInfo = {
      summary: event.summary,
      start: eventStart.toISOString(),
      eventType: event.eventType,
      transparency: event.transparency,
      attendeesCount: event.attendees?.length || 0,
      organizer: event.organizer?.email
    };
    
    debugInfo.eventsChecked.push(eventInfo);
    
    // Skip events in the past
    if (eventStart <= now) {
      eventInfo.skipped = 'past event';
      continue;
    }
    
    // Check if this is an appointment slot event
    const isAppointmentSlot = 
      (event.summary && event.summary.toLowerCase().includes('min with scott')) ||
      (event.summary && event.summary.toLowerCase().includes('30 min')) ||
      (event.eventType === 'workingLocation') ||
      (event.visibility === 'public' && event.summary && event.summary.includes('Scott'));
    
    eventInfo.isAppointmentSlot = isAppointmentSlot;
    
    if (!isAppointmentSlot) {
      eventInfo.skipped = 'not an appointment slot';
      continue;
    }
    
    // Check if slot is still available (no attendees or only organizer)
    const attendees = event.attendees || [];
    const hasBooking = attendees.some(a => a.email !== event.organizer?.email && a.responseStatus !== 'declined');
    
    eventInfo.hasBooking = hasBooking;
    
    if (!hasBooking) {
      debugInfo.foundSlot = eventInfo;
      return { slot: eventStart.toISOString(), debug: debugInfo };
    }
  }
  
  return { slot: null, debug: debugInfo };
}
