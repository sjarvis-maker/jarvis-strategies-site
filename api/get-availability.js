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

    // Determine search window — single date or next 10 days
    const requestedDate = req.query.date; // Optional YYYY-MM-DD Pacific
    let startFrom, endTime, maxSlots;
    if (requestedDate && /^\d{4}-\d{2}-\d{2}$/.test(requestedDate)) {
      const [year, month, day] = requestedDate.split('-').map(Number);
      startFrom = pacificMidnight(year, month, day);
      endTime = new Date(startFrom.getTime() + 24 * 60 * 60 * 1000);
      maxSlots = 20;
      // Reject past dates and today — no same-day bookings
      if (startFrom < startOfTomorrowPacific()) {
        return res.status(200).json({ available: false, slots: [], fallback: false });
      }
    } else {
      startFrom = startOfTomorrowPacific();
      endTime = new Date(startFrom.getTime() + 10 * 24 * 60 * 60 * 1000);
      maxSlots = 8;
    }

    const freeBusy = await calendar.freebusy.query({
      requestBody: {
        timeMin: startFrom.toISOString(),
        timeMax: endTime.toISOString(),
        items: [{ id: CALENDAR_ID }],
        timeZone: 'America/Vancouver'
      }
    });
    const busySlots = freeBusy.data.calendars[CALENDAR_ID]?.busy || [];
    const slots = findFreeSlots(startFrom, endTime, busySlots, windows, slotDurationMs, maxSlots);

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

/** Returns a Date representing 00:00:00 of the given Pacific date, expressed as UTC. */
function pacificMidnight(year, month, day) {
  const noonUtc = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  const offset = getPacificUtcOffsetMs(noonUtc);
  return new Date(Date.UTC(year, month - 1, day) + offset);
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

/** Gregorian Easter Sunday for a given year (UTC midnight). */
function calcEaster(year) {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

/** nth occurrence of weekday (0=Sun…6=Sat) in a month (1-based). */
function nthWeekday(year, month, dow, n) {
  const firstDow = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  return 1 + (dow - firstDow + 7) % 7 + (n - 1) * 7;
}

/** Returns a Set of 'YYYY-MM-DD' strings for BC statutory holidays in the given year. */
function bcHolidays(year) {
  const set = new Set();
  const add = (y, m, d) => {
    const dt = new Date(Date.UTC(y, m - 1, d));
    set.add(dt.toISOString().split('T')[0]);
  };

  // Fixed-date holidays
  add(year, 1, 1);   // New Year's Day
  add(year, 7, 1);   // Canada Day
  add(year, 9, 30);  // National Day for Truth and Reconciliation
  add(year, 11, 11); // Remembrance Day
  add(year, 12, 25); // Christmas Day
  add(year, 12, 26); // Boxing Day

  // Family Day — 3rd Monday of February (BC)
  add(year, 2, nthWeekday(year, 2, 1, 3));

  // Good Friday — Easter minus 2 days
  const easter = calcEaster(year);
  const gf = new Date(easter.getTime() - 2 * 86400000);
  set.add(gf.toISOString().split('T')[0]);

  // Victoria Day — last Monday before May 25
  const may25dow = new Date(Date.UTC(year, 4, 25)).getUTCDay();
  add(year, 5, 25 - (may25dow === 1 ? 7 : (may25dow + 6) % 7));

  // BC Day — 1st Monday of August
  add(year, 8, nthWeekday(year, 8, 1, 1));

  // Labour Day — 1st Monday of September
  add(year, 9, nthWeekday(year, 9, 1, 1));

  // Thanksgiving — 2nd Monday of October
  add(year, 10, nthWeekday(year, 10, 1, 2));

  return set;
}

function findFreeSlots(startFrom, endTime, busySlots, windows, slotDurationMs, maxSlots) {
  const results = [];
  let checkTime = new Date(startFrom);
  const holidayCache = {};

  while (checkTime < endTime && results.length < maxSlots) {
    const dateStr = checkTime.toLocaleDateString('en-CA', { timeZone: 'America/Vancouver' });
    const year = parseInt(dateStr, 10);
    if (!holidayCache[year]) holidayCache[year] = bcHolidays(year);

    if (holidayCache[year].has(dateStr)) {
      checkTime = new Date(checkTime.getTime() + slotDurationMs);
      continue;
    }

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
