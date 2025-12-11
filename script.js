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

  let html = `
    <div style="text-align: center; padding: 20px; background: linear-gradient(135deg, #f5f5f5, #e0e0e0); border-radius: 10px; margin: 20px 0;">
      <h2 style="color: #d32f2f; margin: 0 0 10px 0;">${race.raceName || race.name || ''}</h2>
      <p style="font-size: 16px; margin: 6px 0;"><strong>Round:</strong> ${race.round || ''} ${race.season ? ('of ' + race.season) : ''}</p>
  `;

  // If circuit/location available (older shape)
  if (race.circuit && race.circuit.name) {
    html += `<p style="font-size:14px; margin:6px 0"><strong>Circuit:</strong> ${race.circuit.name} — ${race.circuit.location.city}, ${race.circuit.location.country}</p>`;
  }

  // If schedule object exists, list each event
  const schedule = race.schedule || {};
  const eventOrder = ['fp1', 'fp2', 'fp3', 'qualy', 'sprintQualy', 'sprintRace', 'race'];

  html += '<div style="margin-top:12px; text-align:left; display:inline-block;">';
  html += '<table style="border-collapse:collapse; font-size:14px;"><tbody>';

  let foundEvent = false;
  for (const key of eventOrder) {
    const ev = schedule[key];
    if (ev && (ev.date || ev.time)) {
      foundEvent = true;
      const dtStr = formatEvent(ev.date, ev.time);
      const label = key.toUpperCase();
      html += `<tr><td style="padding:6px 12px; font-weight:600">${label}</td><td style="padding:6px 12px">${dtStr}</td></tr>`;
    }
  }

  // Fallback for older flat fields
  if (!foundEvent && (race.date || race.time)) {
    const dtStr = formatEvent(race.date, race.time);
    html += `<tr><td style="padding:6px 12px; font-weight:600">RACE</td><td style="padding:6px 12px">${dtStr}</td></tr>`;
  }

  html += '</tbody></table></div>';

  html += '</div>';

  comparisonDiv.innerHTML = html;
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