# DHT Sensor Dashboard

Static dashboard for temperature and humidity from a Google Sheet served by Google Apps Script. Shows **current** (last) reading and charts for **last hour**, **last 24 hours**, and **last 7 days**.

## Deploy to Git (e.g. GitHub Pages)

1. Create a repo and push this folder:
   ```bash
   git init
   git add .
   git commit -m "DHT dashboard"
   git remote add origin <your-repo-url>
   git push -u origin main
   ```
2. On GitHub: **Settings → Pages → Source**: Deploy from branch `main`, folder `/ (root)`.
3. Your site will be at `https://<username>.github.io/<repo>/`.

## Google Apps Script setup

Your script currently only **writes** (appends rows when the ESP sends `?temp=...&hum=...`). The dashboard needs to **read** the sheet. Use a `doGet` that supports both:

1. **Write** (unchanged): `GET ?temp=25&hum=60` → append row, return `OK`
2. **Read** (for dashboard): `GET ?action=read` → return sheet data as JSON

Replace your Apps Script with the contents of **`apps-script-doGet.gs`** in this repo (or copy the logic below). Then deploy as **Web app** → Execute as **me**, Who has access **Anyone**. The dashboard already calls `.../exec?action=read` to load data.

**Important:** The sheet’s first row must be the header (e.g. `Timestamp`, `Temperature`, `Humidity`). The script returns an array of objects using those column names so the dashboard can parse it.

## Local preview

Open `index.html` in a browser, or serve the folder (e.g. `npx serve .`). If the script URL is on another origin, the browser must allow CORS (Apps Script web apps do when deployed with "Anyone" access).

## Files

- `index.html` – layout and chart placeholders
- `styles.css` – dark theme and layout
- `app.js` – fetch, parse, current values, Chart.js (last 1h / 24h / 7d)
