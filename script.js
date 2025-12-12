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
  // After rendering the cards, fetch temperatures for each event
  fetchTempsForRenderedCards();
}

// After rendering, fetch weather metrics (temp, precipitation, wind, humidity) for each event card using Open-Meteo
async function fetchTempsForRenderedCards() {
  const cards = document.querySelectorAll('.event-card');
  const weatherData = [];

  for (const card of cards) {
    const city = card.dataset.city;
    const country = card.dataset.country;
    const iso = card.dataset.iso; // e.g. 2025-03-16T04:00:00Z
    const eventName = card.dataset.event;

    // Ensure elements exist for each metric (order: temp, precipitation, wind, humidity)
    let tempEl = card.querySelector('.event-temp');
    let precipEl = card.querySelector('.event-precip');
    let windEl = card.querySelector('.event-wind');
    let humidityEl = card.querySelector('.event-humidity');

    if (!tempEl) {
      tempEl = document.createElement('p');
      tempEl.className = 'event-temp';
      tempEl.style.margin = '8px 0 0 0';
      tempEl.style.fontWeight = '600';
      card.appendChild(tempEl);
    }
    if (!precipEl) {
      precipEl = document.createElement('p');
      precipEl.className = 'event-precip';
      precipEl.style.margin = '4px 0 0 0';
      precipEl.style.color = '#444';
      card.appendChild(precipEl);
    }
    if (!windEl) {
      windEl = document.createElement('p');
      windEl.className = 'event-wind';
      windEl.style.margin = '4px 0 0 0';
      windEl.style.color = '#444';
      card.appendChild(windEl);
    }
    if (!humidityEl) {
      humidityEl = document.createElement('p');
      humidityEl.className = 'event-humidity';
      humidityEl.style.margin = '4px 0 0 0';
      humidityEl.style.color = '#444';
      card.appendChild(humidityEl);
    }

    // Set loading placeholders
    tempEl.textContent = 'Loading temp…';
    precipEl.textContent = '';
    windEl.textContent = '';
    humidityEl.textContent = '';

    if (!city) {
      tempEl.textContent = 'No city data';
      weatherData.push({
        event: eventName,
        city,
        country,
        iso,
        latitude: null,
        longitude: null,
        temperature: null,
        precipitation_mm: null,
        wind_kmh: null,
        humidity_pct: null,
        status: 'No city data'
      });
      continue;
    }

    try {
      const geo = await geocodeCity(city, country);
      if (!geo) {
        tempEl.textContent = 'Location not found';
        weatherData.push({
          event: eventName,
          city,
          country,
          iso,
          latitude: null,
          longitude: null,
          temperature: null,
          precipitation_mm: null,
          wind_kmh: null,
          humidity_pct: null,
          status: 'Location not found'
        });
        continue;
      }

      const metrics = await getWeatherAt(geo.latitude, geo.longitude, iso);
      if (!metrics) {
        tempEl.textContent = 'Data N/A';
        precipEl.textContent = 'Precip: N/A';
        windEl.textContent = 'Wind: N/A';
        humidityEl.textContent = 'Humidity: N/A';
        weatherData.push({
          event: eventName,
          city,
          country,
          iso,
          latitude: geo.latitude,
          longitude: geo.longitude,
          temperature: null,
          precipitation_mm: null,
          wind_kmh: null,
          humidity_pct: null,
          status: 'Data N/A'
        });
      } else {
        const t = (metrics.temperature === null || typeof metrics.temperature === 'undefined') ? null : Number(metrics.temperature);
        const p = (metrics.precipitation === null || typeof metrics.precipitation === 'undefined') ? null : Number(metrics.precipitation);
        const w = (metrics.wind_kmh === null || typeof metrics.wind_kmh === 'undefined') ? null : Number(metrics.wind_kmh);
        const h = (metrics.humidity === null || typeof metrics.humidity === 'undefined') ? null : Number(metrics.humidity);

        tempEl.textContent = t === null ? 'Temp: N/A' : `${t.toFixed(1)} °C`;
        precipEl.textContent = p === null ? 'Precip: N/A' : `Precip: ${p.toFixed(1)} mm`;
        windEl.textContent = w === null ? 'Wind: N/A' : `Wind: ${w.toFixed(1)} km/h`;
        humidityEl.textContent = h === null ? 'Humidity: N/A' : `Humidity: ${Math.round(h)} %`;

        weatherData.push({
          event: eventName,
          city,
          country,
          iso,
          latitude: geo.latitude,
          longitude: geo.longitude,
          temperature: t === null ? null : Number(t.toFixed(1)),
          precipitation_mm: p === null ? null : Number(p.toFixed(1)),
          wind_kmh: w === null ? null : Number(w.toFixed(1)),
          humidity_pct: h === null ? null : Math.round(h)
        });
      }
    } catch (err) {
      console.error('Error fetching weather for', city, err);
      tempEl.textContent = 'Error';
      precipEl.textContent = '';
      windEl.textContent = '';
      humidityEl.textContent = '';
      weatherData.push({
        event: eventName,
        city,
        country,
        iso,
        latitude: null,
        longitude: null,
        temperature: null,
        precipitation_mm: null,
        wind_kmh: null,
        humidity_pct: null,
        status: 'Error: ' + err.message
      });
    }
  }

  console.log('📊 Weather data collected for selected race:');
  console.table(weatherData);
}

// Geocode city name -> prefer result matching country
async function geocodeCity(name, country) {
  if (!name) return null;
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=10&language=en`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    if (!data || !data.results || data.results.length === 0) return null;
    // try to find exact country match (case-insensitive)
    if (country) {
      const found = data.results.find(r => r.country && r.country.toLowerCase() === country.toLowerCase());
      if (found) return found;
    }
    // fallback: return first result
    return data.results[0];
  } catch (err) {
    console.error('Geocoding error', err);
    return null;
  }
}

// Get weather metrics at given lat/lon and ISO datetime using Open-Meteo archive API
// Returns: { temperature, precipitation, wind_kmh, humidity } or null
async function getWeatherAt(latitude, longitude, iso) {
  if (!latitude || !longitude || !iso) return null;
  const dt = new Date(iso);
  if (isNaN(dt)) return null;
  const date = dt.toISOString().slice(0, 10); // YYYY-MM-DD

  const vars = 'temperature_2m,relativehumidity_2m,windspeed_10m,precipitation';
  const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${latitude}&longitude=${longitude}&start_date=${date}&end_date=${date}&hourly=${vars}&timezone=UTC`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    if (!data || !data.hourly || !data.hourly.time) return null;
    const times = data.hourly.time; // e.g. "2025-03-16T04:00"
    const temps = data.hourly.temperature_2m || [];
    const hums = data.hourly.relativehumidity_2m || [];
    const winds = data.hourly.windspeed_10m || [];
    const precs = data.hourly.precipitation || [];

    // build target string in UTC without seconds: YYYY-MM-DDTHH:MM
    const target = dt.toISOString().slice(0, 16);
    let idx = times.findIndex(t => t === target);
    if (idx === -1) {
      // try matching by hour
      idx = times.findIndex(t => t.startsWith(target.slice(0, 13)));
      if (idx === -1) return null;
    }

    const temperature = (temps[idx] === undefined) ? null : temps[idx];
    const humidity = (hums[idx] === undefined) ? null : hums[idx];
    const wind_ms = (winds[idx] === undefined) ? null : winds[idx];
    const precipitation = (precs[idx] === undefined) ? null : precs[idx];

    const wind_kmh = wind_ms === null ? null : wind_ms * 3.6;

    return {
      temperature,
      precipitation,
      wind_kmh,
      humidity
    };
  } catch (err) {
    console.error('Weather API error', err);
    return null;
  }
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
    <div class="event-card" data-event="${eventKey}" data-iso="${iso}" data-city="${city}" data-country="${country}" style="flex:0 0 ${cardWidth}px; width:${cardWidth}px; background:#fff; border-radius:10px; box-shadow:0 2px 6px rgba(0,0,0,0.10); padding:12px; text-align:center; display:flex; flex-direction:column; align-items:center; justify-content:flex-start;">
      <p style="margin:0 0 8px 0; font-weight:700; font-size:${titleSize}">${label}</p>
      <p style="margin:0; color:#333; font-size:${dateSize}; line-height:1.1">${local}</p>
    </div>
  `;
}

// Helper to format event date/time (returns string like: "FRI - 3 OCT 2025<br>09:00 PM" or 'TBA')
function formatEvent(dateStr, timeStr) {
  if (!dateStr || !timeStr) return 'TBA';
  const iso = `${dateStr}T${timeStr}`;
  const dt = new Date(iso);
  if (isNaN(dt)) return 'TBA';

  // Weekday short (e.g. FRI), day number, month short (OCT), year
  const weekday = dt.toLocaleDateString(undefined, { weekday: 'short' }).toUpperCase();
  const day = dt.getDate();
  const month = dt.toLocaleDateString(undefined, { month: 'short' }).toUpperCase();
  const year = dt.getFullYear();

  // Time on its own line, keep user's locale short time format
  const time = dt.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

  return `${weekday} - ${day} ${month} ${year}<br>${time}`;
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