(function () {
  'use strict';

  // Read: .../exec or .../exec?action=read  (script appends with ?temp=...&hum=...)
  const API_URL = 'https://script.google.com/macros/s/AKfycbxcpvQ4rfarHfloSrvO5PyR42xYU6lX_G3KnMwflFhe7wZ3jruTIAPAvpl4no1AtxRO/exec';

  const COLORS = {
    temp: { border: '#ff6b4a', fill: 'rgba(255, 107, 74, 0.12)' },
    humidity: { border: '#4fc3f7', fill: 'rgba(79, 195, 247, 0.12)' }
  };

  const RANGES = { '1h': 3600000, '24h': 86400000, '7d': 604800000 };

  let allRows = [];
  let charts = { temp: null, humidity: null };
  let selectedRange = '1h';

  const $ = (id) => document.getElementById(id);
  const statusEl = $('status');
  const currentTempEl = $('currentTemp');
  const currentHumidityEl = $('currentHumidity');
  const avgTemp24El = $('avgTemp24');
  const avgHum24El = $('avgHum24');
  const airScoreEl = $('airScore');
  const airEmojiEl = $('airEmoji');
  const airLabelEl = $('airLabel');
  const lastMeasurementEl = $('lastMeasurement');
  const btnRefresh = $('btnRefresh');

  /**
   * Ocjena zraka 0–10 na osnovu temperature i vlažnosti (udobnost / suhoća-zraka).
   * Idealno: vlažnost 35–50%, temp 18–24°C. Suh/vlažan zrak i ekstremna temp utječu na ocjenu i label.
   */
  function airQualityScore(temp, humidity) {
    if (temp == null || humidity == null || Number.isNaN(temp) || Number.isNaN(humidity)) {
      return { score: null, label: '—', emoji: '—' };
    }
    let score = 5;
    let label = 'Zrak umjeren';
    let emoji = '😐';
    if (humidity < 15) {
      score = Math.max(0, 2 - (15 - humidity) / 5);
      label = humidity < 8 ? 'Zrak opasno suh' : humidity < 12 ? 'Zrak izuzetno suh' : 'Zrak suh';
      emoji = humidity < 8 ? '⚠️' : humidity < 12 ? '😟' : '😕';
    } else if (humidity < 30) {
      score = 2 + (humidity - 15) / 5;
      label = humidity < 22 ? 'Zrak izuzetno suh' : 'Zrak suh';
      emoji = humidity < 22 ? '😕' : '😐';
    } else if (humidity <= 55) {
      score = 6 + (4 * (1 - Math.abs(humidity - 42) / 20));
      if (temp >= 18 && temp <= 24) score = Math.min(10, score + 1);
      else if (temp >= 15 && temp <= 27) score = Math.min(10, score + 0.5);
      else if (temp < 10 || temp > 30) score = Math.max(0, score - 1.5);
      if (score >= 8.5) { label = 'Zrak ugodan'; emoji = '😊'; }
      else if (score >= 7) { label = 'Zrak ugodan'; emoji = '🙂'; }
      else { label = 'Zrak umjeren'; emoji = '😐'; }
    } else if (humidity <= 75) {
      score = 6 - (humidity - 55) / 10;
      label = humidity <= 62 ? 'Zrak vlažan' : 'Zrak izuzetno vlažan';
      emoji = humidity <= 62 ? '😐' : '😕';
    } else {
      score = Math.max(0, 3 - (humidity - 75) / 15);
      label = humidity > 85 ? 'Zrak opasno vlažan' : 'Zrak izuzetno vlažan';
      emoji = humidity > 85 ? '⚠️' : '😟';
    }
    // Preuzimanje po temperaturi: prevruće / hladno
    if (temp >= 35) {
      label = 'Prevruće';
      emoji = '🔥';
      score = Math.min(score, 1);
    } else if (temp >= 30) {
      label = 'Prevruće';
      emoji = '🔥';
      score = Math.min(score, 3);
    } else if (temp >= 28) {
      label = 'Vruće';
      emoji = '🌡️';
      score = Math.min(score, 5);
    } else if (temp <= -5) {
      label = 'Izuzetno hladno';
      emoji = '❄️';
      score = Math.min(score, 1);
    } else if (temp <= 5) {
      label = 'Hladno';
      emoji = '❄️';
      score = Math.min(score, 4);
    } else if (temp <= 10) {
      label = 'Blago hladno';
      emoji = '🥶';
      score = Math.min(score, 6);
    }
    score = Math.round(Math.max(0, Math.min(10, score)));
    if (score <= 2 && emoji === '😐') emoji = '😟';
    return { score, label, emoji };
  }

  function setStatus(msg, type = '') {
    statusEl.textContent = msg;
    statusEl.className = 'status ' + type;
  }

  function parseTimestamp(str) {
    if (!str) return null;
    const d = new Date(str.trim());
    return isNaN(d.getTime()) ? null : d;
  }

  function parseRow(obj) {
    const ts = parseTimestamp(obj.Timestamp || obj.timestamp || obj[0]);
    if (!ts) return null;
    const temp = parseFloat(obj.Temperature ?? obj.temperature ?? obj[1]);
    const humidity = parseFloat(obj.Humidity ?? obj.humidity ?? obj[2]);
    if (Number.isNaN(temp) || Number.isNaN(humidity)) return null;
    // Ignore obvious bad readings (sensor off / wiring issue)
    if (temp < -40 || temp > 80 || humidity < 0 || humidity > 100) return null;
    return { ts, temp, humidity };
  }

  function parseCSV(text) {
    const lines = text.trim().split(/\r?\n/);
    if (lines.length < 2) return [];
    const sep = lines[0].includes('\t') ? '\t' : ',';
    const cols = lines[0].split(sep).map((c) => c.trim().toLowerCase());
    const tsIdx = cols.indexOf('timestamp');
    const tempIdx = cols.indexOf('temperature');
    const humIdx = cols.indexOf('humidity');
    if (tsIdx < 0 || tempIdx < 0 || humIdx < 0) return [];
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const cells = lines[i].split(sep).map((c) => c.trim());
      const row = parseRow({
        Timestamp: cells[tsIdx],
        Temperature: cells[tempIdx],
        Humidity: cells[humIdx]
      });
      if (row) rows.push(row);
    }
    return rows;
  }

  function parseJSON(data) {
    if (!Array.isArray(data)) return [];
    return data.map((obj) => parseRow(obj)).filter(Boolean);
  }

  function normalizeData(response) {
    if (typeof response === 'string') {
      const trimmed = response.trim();
      if (trimmed.startsWith('[')) return parseJSON(JSON.parse(trimmed));
      return parseCSV(trimmed);
    }
    if (Array.isArray(response)) return parseJSON(response);
    return [];
  }

  function filterSince(rows, ms) {
    if (!rows.length) return [];
    const cutoff = Date.now() - ms;
    return rows.filter((r) => r.ts.getTime() >= cutoff);
  }

  function sortByTime(rows) {
    return [...rows].sort((a, b) => a.ts.getTime() - b.ts.getTime());
  }

  function formatTime(d) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function formatAxisLabel(d, rangeMs) {
    const day = 86400000;
    if (rangeMs <= 2 * 3600000) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (rangeMs <= 2 * day) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  function buildSingleSeriesConfig(rows, rangeMs, metric) {
    const sorted = sortByTime(rows);
    const labels = sorted.length ? sorted.map((r) => formatAxisLabel(r.ts, rangeMs)) : [];
    const isTemp = metric === 'temp';
    const c = isTemp ? COLORS.temp : COLORS.humidity;
    const label = isTemp ? 'Temperatura °C' : 'Vlažnost %';
    const values = sorted.length ? sorted.map((r) => (isTemp ? r.temp : r.humidity)) : [];
    const pointRadius = sorted.length > 40 ? 0 : 2;
    return {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label,
          data: values,
          borderColor: c.border,
          backgroundColor: c.fill,
          borderWidth: 2,
          fill: true,
          tension: 0.35,
          pointRadius,
          pointHoverRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            display: false
          }
        },
        scales: {
          x: {
            grid: { color: 'rgba(255,255,255,0.06)' },
            ticks: {
              color: '#9aa0a6',
              font: { size: 10 },
              maxRotation: 45,
              maxTicksLimit: 10
            }
          },
          y: {
            grid: { color: 'rgba(255,255,255,0.06)' },
            ticks: { color: '#9aa0a6', font: { size: 10 } },
            min: metric === 'temp' ? -10 : 0
          }
        }
      }
    };
  }

  function destroyChart(key) {
    if (charts[key]) {
      charts[key].destroy();
      charts[key] = null;
    }
  }

  function renderCharts() {
    const rangeMs = RANGES[selectedRange];
    const rows = filterSince(allRows, rangeMs);

    destroyChart('temp');
    destroyChart('humidity');

    charts.temp = new Chart(
      document.getElementById('chartTemp').getContext('2d'),
      buildSingleSeriesConfig(rows, rangeMs, 'temp')
    );
    charts.humidity = new Chart(
      document.getElementById('chartHumidity').getContext('2d'),
      buildSingleSeriesConfig(rows, rangeMs, 'humidity')
    );
  }

  function setRange(range) {
    if (!RANGES[range] || range === selectedRange) return;
    selectedRange = range;
    document.querySelectorAll('.range-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-range') === range);
    });
    if (allRows.length) renderCharts();
  }

  function updateCards() {
    const empty = '—';
    currentTempEl.textContent = empty;
    currentHumidityEl.textContent = empty;
    avgTemp24El.textContent = empty;
    avgHum24El.textContent = empty;
    lastMeasurementEl.textContent = 'Zadnje mjerenje: —';
    airScoreEl.textContent = '—';
    airEmojiEl.textContent = '—';
    airLabelEl.textContent = '—';
    if (!allRows.length) return;
    const last = sortByTime(allRows).pop();
    currentTempEl.textContent = last.temp.toFixed(1);
    currentHumidityEl.textContent = last.humidity.toFixed(0);
    const air = airQualityScore(last.temp, last.humidity);
    if (air.score != null) {
      airScoreEl.textContent = air.score;
      airEmojiEl.textContent = air.emoji;
      airLabelEl.textContent = air.label;
    }
    lastMeasurementEl.textContent = 'Zadnje mjerenje: ' + last.ts.toLocaleString('bs-BA', {
      dateStyle: 'medium',
      timeStyle: 'medium'
    });
    const rows24h = filterSince(allRows, RANGES['24h']);
    if (rows24h.length) {
      const sumT = rows24h.reduce((a, r) => a + r.temp, 0);
      const sumH = rows24h.reduce((a, r) => a + r.humidity, 0);
      avgTemp24El.textContent = (sumT / rows24h.length).toFixed(1);
      avgHum24El.textContent = (sumH / rows24h.length).toFixed(0);
    }
  }

  function render() {
    updateCards();
    renderCharts();
  }

  function fetchData() {
    setStatus('Učitavanje…', 'loading');
    btnRefresh.disabled = true;

    fetch(API_URL, { method: 'GET', mode: 'cors' })
      .then((res) => {
        if (!res.ok) throw new Error('Mreža ' + res.status);
        const ct = res.headers.get('content-type') || '';
        if (ct.includes('application/json')) return res.json();
        return res.text();
      })
      .then((data) => {
        const raw = typeof data === 'string' ? data.trim() : '';
        if (raw === 'Missing parameters' || raw === 'OK') {
          setStatus('Skripta vraća "' + raw + '". Uvedi ažurirani doGet (apps-script-doGet.gs) s podrškom za ?action=read i kreiraj novu verziju objave.', 'error');
          return;
        }
        const rows = normalizeData(data);
        allRows = rows;
        render();
        if (!rows.length) {
          setStatus('Nema podataka. Senzor možda nije radio.');
        } else {
          setStatus('Ažurirano ' + new Date().toLocaleTimeString('bs-BA'));
        }
      })
      .catch((err) => {
        setStatus('Greška: ' + (err.message || 'nepoznata greška').replace(/^Failed to fetch/i, 'Mrežna greška (CORS ili nedostupno).'), 'error');
        if (allRows.length) render();
      })
      .finally(() => {
        btnRefresh.disabled = false;
      });
  }

  document.querySelectorAll('.range-btn').forEach((btn) => {
    btn.addEventListener('click', () => setRange(btn.getAttribute('data-range')));
  });
  btnRefresh.addEventListener('click', fetchData);
  fetchData();

  setInterval(fetchData, 60000);
})();
