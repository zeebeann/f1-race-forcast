const driver1Select = document.getElementById('driver1');
const comparisonDiv = document.getElementById('comparison');

// We'll use the `raceId` from the dropdown directly (e.g. "abu_dhabi_2025")

// Fetch race schedule information by raceId (string locator)
async function fetchRaceScheduleByRaceId(raceId) {
  try {
    const year = 2025;
    console.log('Fetching race schedule for year:', year);
    const res = await fetch(`https://f1api.dev/api/current`); //DONT CHANGE URL CLAUDE
    const data = await res.json();

    console.log('API Response:', data);

    // Find the race by raceId field returned from API (e.g. "abu_dhabi_2025")
    const race = data.races.find(r => r.raceId === raceId || String(r.round) === String(raceId));

    console.log('Found race:', race);

    if (race) {
      // Extract city/country for the selected race (useful for weather lookups)
      const circuit = race.circuit || {};
      const city = (circuit.city) || (circuit.location && (circuit.location.city || circuit.location.locality)) || '';
      const country = (circuit.country) || (circuit.location && circuit.location.country) || '';
      console.log('Selected race location:', { raceId: race.raceId || race.round, city, country });

      displayRaceInfo(race);
    } else {
      comparisonDiv.innerHTML = '<p style="color:red">Race schedule not found for that raceId.</p>';
    }
  } catch (err) {
    comparisonDiv.innerHTML = '<p style="color:red">Failed to load race schedule.</p>';
    console.error('Error fetching race schedule:', err);
  }
}


// Display race schedule information
function displayRaceInfo(race) {
  // Handle two possible shapes:
  // 1) race.schedule exists with nested events (race.schedule.race, qualy, fp1...)
  // 2) older shape with top-level date/time and circuit info

  // Header (title + round)
  let html = `
    <div style="text-align: center; padding: 20px; background: transparent; border-radius: 10px; margin: 20px 0;">
      <h2 style="color: #d32f2f; margin: 0 0 10px 0;">${race.raceName || race.name || ''}</h2>
      <p style="font-size: 16px; margin: 6px 0;"><strong>Round:</strong> ${race.round || ''} ${race.season ? ('of ' + race.season) : ''}</p>
  `;

  // Circuit info (if present)
  if (race.circuit && race.circuit.name) {
    html += `<p style="font-size:14px; margin:6px 0"><strong>Circuit:</strong> ${race.circuit.name} — ${race.circuit.location.city}, ${race.circuit.location.country}</p>`;
  }

  // Events: split into two rows. Top row for practice/qualifying, bottom row for Sprint Race and Race (larger)
  const schedule = race.schedule || {};
  const topOrder = ['fp1', 'fp2', 'fp3', 'qualy', 'sprintQualy'];
  const bottomOrder = ['sprintRace', 'race'];

  let foundAny = false;

  // Top row (smaller cards)
  html += '<div id="events-top" style="margin-top:16px; display:flex; flex-direction:row; gap:12px; align-items:flex-start; justify-content:center; overflow-x:auto; padding:8px 12px;">';
  for (const key of topOrder) {
    const ev = schedule[key];
    if (ev && (ev.date || ev.time)) {
      foundAny = true;
      html += createEventHTML(key, ev, false, race.circuit);
    }
  }
  html += '</div>'; // events-top

  // Bottom row (larger, more prominent cards)
  html += '<div id="events-bottom" style="margin-top:12px; display:flex; flex-direction:row; gap:18px; align-items:flex-start; justify-content:center; overflow-x:auto; padding:8px 12px;">';
  for (const key of bottomOrder) {
    const ev = schedule[key];
    if (ev && (ev.date || ev.time)) {
      foundAny = true;
      html += createEventHTML(key, ev, true, race.circuit);
    }
  }
  html += '</div>'; // events-bottom

  // Fallback for older flat fields (top-level date/time) -> render as large bottom card
  if (!foundAny && (race.date || race.time)) {
    html += '<div id="events-bottom" style="margin-top:12px; display:flex; justify-content:center;">';
    html += createEventHTML('race', { date: race.date, time: race.time }, true, race.circuit);
    html += '</div>';
  }

  // If no events at all
  if (!foundAny && !(race.date || race.time)) {
    html += `<div style="padding:12px; color:#666">No schedule available</div>`;
  }
  html += '</div>'; // main wrapper

  comparisonDiv.innerHTML = html;
}

// Helper to build an event card HTML string
function createEventHTML(eventKey, ev, large = false, circuit = null) {
  const eventLabels = {
    fp1: 'Practice 1',
    fp2: 'Practice 2',
    fp3: 'Practice 3',
    qualy: 'Qualifying',
    sprintQualy: 'Sprint Qualifying',
    sprintRace: 'Sprint Race',
    race: 'Race'
  };
  const label = eventLabels[eventKey] || eventKey.toUpperCase();
  const dateStr = ev.date || null;
  const timeStr = ev.time || null;
  const iso = (dateStr && timeStr) ? `${dateStr}T${timeStr}` : '';
  const local = formatEvent(dateStr, timeStr);
  // Determine circuit city/country (support multiple shapes)
  const city = (circuit && (circuit.city || (circuit.location && (circuit.location.city || circuit.location.locality)))) || '';
  const country = (circuit && (circuit.country || (circuit.location && circuit.location.country))) || '';
  // Adjust styling for large (bottom-row) cards
  const cardWidth = large ? 340 : 220;
  const titleSize = large ? '16px' : '14px';
  const dateSize = large ? '15px' : '14px';

  // Minimal styling; each card has data attributes for later weather API use
  return `
    <div class="event-card" data-event="${eventKey}" data-iso="${iso}" data-city="${city}" data-country="${country}" style="flex:0 0 ${cardWidth}px; width:${cardWidth}px; background:#fff; border-radius:10px; box-shadow:0 2px 6px rgba(0,0,0,0.10); padding:12px; text-align:left;">
      <p style="margin:0 0 8px 0; font-weight:700; font-size:${titleSize}">${label}</p>
      <p style="margin:0; color:#333; font-size:${dateSize}">${local}</p>
    </div>
  `;
}

// Helper to format event date/time (returns readable string or 'TBA')
function formatEvent(dateStr, timeStr) {
  if (!dateStr || !timeStr) return 'TBA';
  // Construct an ISO datetime (UTC) and convert to local
  const iso = `${dateStr}T${timeStr}`;
  const dt = new Date(iso);
  if (isNaN(dt)) return 'TBA';
  return dt.toLocaleString(undefined, { dateStyle: 'full', timeStyle: 'short' });
}

driver1Select.addEventListener('change', (e) => {
  const raceId = e.target.value;
  if (raceId) {
    fetchRaceScheduleByRaceId(raceId);
  } else {
    comparisonDiv.innerHTML = '';
  }
});

// (Removed bulk-fetch helper) We now fetch city/country for the selected race only.