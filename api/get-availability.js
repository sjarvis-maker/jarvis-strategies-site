// Vercel Serverless Function: Find Free 30-Min Slots
// Path: /api/get-availability.js

import { google } from 'googleapis';

const SLOT_DURATION_MS = 30 * 60 * 1000;
const MORNING_START  = { hour: 9,  minute: 30 };
const MORNING_END    = { hour: 12, minute: 0  };
const AFTERNOON_START = { hour: 13, minute: 30 };
const AFTERNOON_END   = { hour: 15, minute: 0  };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID;
    const SERVICE_ACCOUNT_KEY = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;

    if (!CALENDAR_ID || !SERVICE_ACCOUNT_KEY) {
      return res.status(200).json({ available: false, slots: [], fallback: true });
    }

    const serviceAccountKey = JSON.parse(SERVICE_ACCOUNT_KEY);
    const auth = new google.auth.JWT({
      email: serviceAccountKey.client_email,
      key: serviceAccountKey.private_key,
      scopes: ['https://www.googleapis.com/auth/calendar.readonly']
    });

    const calendar = google.calendar({ version: 'v3', auth });

    // Start of tomorrow in Pacific time — no same-day bookings
    const startFrom = startOfTomorrowPacific();
    const tenDaysOut = new Date(startFrom.getTime() + 10 * 24 * 60 * 60 * 1000);

    const freeBusy = await calendar.freebusy.query({
      requestBody: {
        timeMin: startFrom.toISOString(),
        timeMax: tenDaysOut.toISOString(),
        items: [{ id: CALENDAR_ID }],
        timeZone: 'America/Vancouver'
      }
    });

    const busySlots = freeBusy.data.calendars[CALENDAR_ID]?.busy || [];
    const slots = findFreeSlots(startFrom, tenDaysOut, busySlots, 8);

    if (slots.length === 0) {
      return res.status(200).json({ available: false, slots: [], fallback: true });
    }

    return res.status(200).json({
      available: true,
      fallback: false,
      slots: slots.map(dt => ({
        datetime: dt.toISOString(),
        label: dt.toLocaleString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          timeZone: 'America/Vancouver',
          timeZoneName: 'short'
        })
      }))
    });

  } catch (error) {
    return res.status(200).json({
      available: false,
      slots: [],
      fallback: true,
      error: error.message
    });
  }
}

/** Returns a Date representing 00:00:00 tomorrow in America/Vancouver, expressed as UTC. */
function startOfTomorrowPacific() {
  const now = new Date();
  // en-CA locale gives YYYY-MM-DD format, making parsing unambiguous
  const todayPacific = now.toLocaleDateString('en-CA', { timeZone: 'America/Vancouver' });
  const [year, month, day] = todayPacific.split('-').map(Number);
  // Use noon UTC tomorrow as a stable reference to determine the Pacific UTC offset
  // (avoids DST edge case at midnight itself)
  const tomorrowNoonUtc = new Date(Date.UTC(year, month - 1, day + 1, 12, 0, 0));
  const offset = getPacificUtcOffsetMs(tomorrowNoonUtc);
  // Midnight tomorrow Pacific = midnight tomorrow UTC + Pacific UTC offset (7h PDT or 8h PST)
  return new Date(Date.UTC(year, month - 1, day + 1) + offset);
}

/** Returns the UTC offset in milliseconds for America/Vancouver at a given moment. */
function getPacificUtcOffsetMs(date) {
  // Compare local-as-UTC trick to find offset
  const utcStr = date.toLocaleString('en-US', { timeZone: 'UTC' });
  const pacStr = date.toLocaleString('en-US', { timeZone: 'America/Vancouver' });
  return new Date(utcStr) - new Date(pacStr); // e.g. 8*3600*1000 (PST) or 7*3600*1000 (PDT)
}

function getPacificParts(date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Vancouver',
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
    hour12: false
  }).formatToParts(date);
  const map = Object.fromEntries(parts.map(p => [p.type, p.value]));
  return {
    weekday: map.weekday, // 'Sun','Mon',...
    hour: parseInt(map.hour, 10),
    minute: parseInt(map.minute, 10)
  };
}

function findFreeSlots(startFrom, endTime, busySlots, maxSlots) {
  const results = [];
  let checkTime = new Date(startFrom);

  while (checkTime < endTime && results.length < maxSlots) {
    const { weekday, hour, minute } = getPacificParts(checkTime);

    // Skip weekends
    if (weekday === 'Sun' || weekday === 'Sat') {
      // Jump to next day midnight
      checkTime = new Date(checkTime.getTime() + SLOT_DURATION_MS);
      continue;
    }

    const inMorning = (hour > MORNING_START.hour || (hour === MORNING_START.hour && minute >= MORNING_START.minute)) &&
                      (hour < MORNING_END.hour   || (hour === MORNING_END.hour   && minute < MORNING_END.minute));

    const inAfternoon = (hour > AFTERNOON_START.hour || (hour === AFTERNOON_START.hour && minute >= AFTERNOON_START.minute)) &&
                        (hour < AFTERNOON_END.hour   || (hour === AFTERNOON_END.hour   && minute < AFTERNOON_END.minute));

    if (inMorning || inAfternoon) {
      const slotEnd = new Date(checkTime.getTime() + SLOT_DURATION_MS);
      const isConflict = busySlots.some(busy => {
        const busyStart = new Date(busy.start);
        const busyEnd = new Date(busy.end);
        return checkTime < busyEnd && slotEnd > busyStart;
      });

      if (!isConflict) {
        results.push(new Date(checkTime));
      }
    }

    checkTime = new Date(checkTime.getTime() + SLOT_DURATION_MS);
  }

  return results;
}
