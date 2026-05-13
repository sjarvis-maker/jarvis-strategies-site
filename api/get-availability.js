// Vercel Serverless Function: Find Free Slots from Appointment Schedule
// Path: /api/get-availability.js

import { google } from 'googleapis';

const SCHEDULE_ID = 'AcZssZ0EIuZpAkPQjNlIMfFRI4ZyKa56Hs75bcLlvLk=';

// Fallback: matches previous hardcoded business hours
const FALLBACK_WINDOWS = [
  { days: ['Mon','Tue','Wed','Thu','Fri'], start: { hour: 9, minute: 30 }, end: { hour: 12, minute: 0 } },
  { days: ['Mon','Tue','Wed','Thu','Fri'], start: { hour: 13, minute: 30 }, end: { hour: 15, minute: 0 } }
];
const FALLBACK_SLOT_MS = 30 * 60 * 1000;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID;
    const SERVICE_ACCOUNT_KEY = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;

    if (!CALENDAR_ID || !SERVICE_ACCOUNT_KEY) {
      return res.status(200).json({ available: false, slots: [], fallback: true });
    }

    const key = JSON.parse(SERVICE_ACCOUNT_KEY);
    const auth = new google.auth.JWT({
      email: key.client_email,
      key: key.private_key,
      scopes: ['https://www.googleapis.com/auth/calendar.readonly']
    });
    const calendar = google.calendar({ version: 'v3', auth });

    // Fetch appointment schedule for actual availability windows
    let windows = FALLBACK_WINDOWS;
    let slotDurationMs = FALLBACK_SLOT_MS;
    try {
      const { data } = await calendar.appointmentSchedules.get({ scheduleId: SCHEDULE_ID });
      const parsed = parseSchedule(data);
      if (parsed.windows.length > 0) {
        windows = parsed.windows;
        slotDurationMs = parsed.slotDurationMs;
      }
    } catch (_err) {
      // Fall through to hardcoded fallback
    }

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
    const slots = findFreeSlots(startFrom, tenDaysOut, busySlots, windows, slotDurationMs, 8);

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
    return res.status(200).json({ available: false, slots: [], fallback: true, error: error.message });
  }
}

/**
 * Parse appointment schedule API response into availability windows.
 * Handles field name variations across API versions.
 */
function parseSchedule(data) {
  const windows = [];
  let slotDurationMs = FALLBACK_SLOT_MS;

  // Duration may be a seconds string ("1800s"), ISO 8601 ("PT30M"), or number (seconds)
  const raw = data.duration || data.appointmentDuration;
  if (raw) {
    if (typeof raw === 'string' && raw.endsWith('s')) {
      slotDurationMs = parseInt(raw, 10) * 1000;
    } else if (typeof raw === 'string' && raw.startsWith('PT')) {
      const m = raw.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
      if (m) slotDurationMs = ((parseInt(m[1] || 0) * 60) + parseInt(m[2] || 0)) * 60 * 1000;
    } else if (typeof raw === 'number') {
      slotDurationMs = raw * 1000;
    }
  }

  const DAY_ENUM = {
    'SUNDAY': 'Sun', 'MONDAY': 'Mon', 'TUESDAY': 'Tue',
    'WEDNESDAY': 'Wed', 'THURSDAY': 'Thu', 'FRIDAY': 'Fri', 'SATURDAY': 'Sat'
  };

  const hours = data.openingHours || data.openingHoursRules || data.schedulingWindows || [];
  for (const entry of hours) {
    const rawDays = entry.daysOfWeek || entry.dayOfWeek || entry.days || [];
    const days = (Array.isArray(rawDays) ? rawDays : [rawDays])
      .map(d => DAY_ENUM[d] || null).filter(Boolean);
    if (days.length === 0) continue;

    const start = toTimeObj(entry.startTime);
    const end = toTimeObj(entry.endTime);
    if (!start || !end) continue;

    windows.push({ days, start, end });
  }

  return { windows, slotDurationMs };
}

function toTimeObj(t) {
  if (!t) return null;
  if (typeof t === 'string') {
    const [h, m] = t.split(':').map(Number);
    return isNaN(h) ? null : { hour: h, minute: m || 0 };
  }
  if (typeof t === 'object') {
    return { hour: t.hours ?? t.hour ?? 0, minute: t.minutes ?? t.minute ?? 0 };
  }
  return null;
}

/** Returns a Date representing 00:00:00 tomorrow in America/Vancouver, expressed as UTC. */
function startOfTomorrowPacific() {
  const now = new Date();
  const todayPacific = now.toLocaleDateString('en-CA', { timeZone: 'America/Vancouver' });
  const [year, month, day] = todayPacific.split('-').map(Number);
  const tomorrowNoonUtc = new Date(Date.UTC(year, month - 1, day + 1, 12, 0, 0));
  const offset = getPacificUtcOffsetMs(tomorrowNoonUtc);
  return new Date(Date.UTC(year, month - 1, day + 1) + offset);
}

/** Returns the UTC offset in milliseconds for America/Vancouver at a given moment. */
function getPacificUtcOffsetMs(date) {
  const utcStr = date.toLocaleString('en-US', { timeZone: 'UTC' });
  const pacStr = date.toLocaleString('en-US', { timeZone: 'America/Vancouver' });
  return new Date(utcStr) - new Date(pacStr);
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
  return { weekday: map.weekday, hour: parseInt(map.hour, 10), minute: parseInt(map.minute, 10) };
}

function inAnyWindow(weekday, hour, minute, windows) {
  return windows.some(w => {
    if (!w.days.includes(weekday)) return false;
    const afterStart = hour > w.start.hour || (hour === w.start.hour && minute >= w.start.minute);
    const beforeEnd  = hour < w.end.hour   || (hour === w.end.hour   && minute < w.end.minute);
    return afterStart && beforeEnd;
  });
}

function findFreeSlots(startFrom, endTime, busySlots, windows, slotDurationMs, maxSlots) {
  const results = [];
  let checkTime = new Date(startFrom);

  while (checkTime < endTime && results.length < maxSlots) {
    const { weekday, hour, minute } = getPacificParts(checkTime);

    if (inAnyWindow(weekday, hour, minute, windows)) {
      const slotEnd = new Date(checkTime.getTime() + slotDurationMs);
      const conflict = busySlots.some(({ start, end }) =>
        checkTime < new Date(end) && slotEnd > new Date(start)
      );
      if (!conflict) results.push(new Date(checkTime));
    }

    checkTime = new Date(checkTime.getTime() + slotDurationMs);
  }

  return results;
}
