# EarthPulse

EarthPulse is a very simple single-page climate visualization.

It shows:

- a world choropleth map
- a year slider
- an annual/monthly toggle
- a month selector in monthly mode
- a small info panel for country data
- a simple legend

## Simplest architecture

This project now uses a tiny Python web app:

- `app.py` for the server, anomaly lookup, and JSON API
- `templates/index.html` for the page structure
- `static/styles.css` for the layout and black theme
- `static/script.js` for the minimal browser-side map code
- `data/annual-temperature-anomalies.json` as a local processed copy of the Our World in Data annual dataset
- `data/monthly-temperature-anomalies.json` as a local processed copy of the Our World in Data monthly dataset
- `data/world-countries.geojson` as the local country boundary file

Why this is simple:

- one small Python app
- no database
- no build step
- Python handles the data lookup logic
- JavaScript only handles the Leaflet map UI

## File tree

```text
EarthPulse/
  app.py
  README.md
  requirements.txt
  data/
    annual-temperature-anomalies.csv
    annual-temperature-anomalies.json
    monthly-temperature-anomalies.csv
    monthly-temperature-anomalies.json
    world-countries.geojson
  static/
    styles.css
    script.js
  templates/
    index.html
```

## Run

Install the one Python dependency and run the app:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python app.py
```

Then open:

`http://127.0.0.1:8000`

## Data source

Main data source:

- Our World in Data annual temperature anomalies:
  `https://ourworldindata.org/grapher/annual-temperature-anomalies.csv?v=1&csvType=full&useColumnShortNames=false`
- Our World in Data monthly temperature anomalies:
  `https://ourworldindata.org/grapher/monthly-temperature-anomalies.csv?v=1&csvType=full&useColumnShortNames=false`

Boundary file:

- `https://github.com/johan/world.geo.json`

## Notes

- The anomaly lookup now lives in Python in `app.py`.
- The browser asks Flask for year data and country info through `/api/map-data` and `/api/country/<code>`.
- Monthly mode uses the same map and info panel, with a month dropdown shown only when monthly is active.
- The map joins data to countries using ISO3 country codes.
- If port `8000` is busy, you can run `PORT=8080 python app.py` and open `http://127.0.0.1:8080`.

## Deploy

The easiest temporary public URL for this app is Render.

This repo now includes [render.yaml](/Users/kirill/development/projects/EarthPulse/render.yaml), so the basic flow is:

```bash
git init
git add .
git commit -m "EarthPulse"
```

Then:

1. Push the project to GitHub.
2. In Render, create a new Web Service from that repo.
3. Render will read `render.yaml`.
4. After the first deploy, Render gives you a public `onrender.com` URL.

If you prefer to configure it manually in Render, use:

- Build Command: `pip install -r requirements.txt`
- Start Command: `gunicorn app:app`
