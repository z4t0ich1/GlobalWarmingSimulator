# Global Warming Simulator (GWS)

Global Warming Simulator is a very simple one-page climate change visualization.

It shows:

- a world leaflet map
- a year slider
- an annual/monthly toggle
- a month selector in monthly mode
- a small info panel for country data
- a simple legend

## Simple architecture

My project uses a Python web app:

- `app.py` for the server, anomaly lookup, and JSON API
- `templates/index.html` for the page structure
- `static/styles.css` for the layout and ecofriendly theme
- `static/script.js` for the minimal browser-side map code
- `data/annual-temperature-anomalies.json` as a local processed copy of the Our World in Data annual dataset
- `data/monthly-temperature-anomalies.json` as a local processed copy of the Our World in Data monthly dataset
- `data/world-countries.geojson` as the local country boundary file


## File tree

```text
GWS/
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

goto: https://earthpulse-3sr4.onrender.com/

## Data source

Main data source:

- Our World in Data annual temperature anomalies:
  `https://ourworldindata.org/grapher/annual-temperature-anomalies.csv?v=1&csvType=full&useColumnShortNames=false`
- Our World in Data monthly temperature anomalies:
  `https://ourworldindata.org/grapher/monthly-temperature-anomalies.csv?v=1&csvType=full&useColumnShortNames=false`

Boundary file:

- `https://github.com/johan/world.geo.json`


## Deploy

The easiest temporary public URL for this app is Render.

This repo includes [render.yaml](.../GWS/render.yaml)

Then the repo is being hosten on render.
