const yearSlider = document.getElementById("yearSlider");
const yearValue = document.getElementById("yearValue");
const infoPeriod = document.getElementById("infoPeriod");
const countryName = document.getElementById("countryName");
const anomalyValue = document.getElementById("anomalyValue");
const annualButton = document.getElementById("annualButton");
const monthlyButton = document.getElementById("monthlyButton");
const monthGroup = document.getElementById("monthGroup");
const monthSelect = document.getElementById("monthSelect");

const configElement = document.getElementById("gws-config");
const config = JSON.parse(configElement.textContent);

let mode = "annual";
let year = config.annual.selectedYear;
let month = config.monthly.selectedMonth;
let lockedCountry = null;
let geoJsonLayer = null;
let anomalies = {};

const map = L.map("map", {
  zoomControl: true,
  attributionControl: false,
  worldCopyJump: false,
});

function getColor(value) {
  if (value === null || value === undefined) return "#222222";
  if (value < -1.5) return "#2c35b6";
  if (value < -0.5) return "#23a2f0";
  if (value < 0.5) return "#ffff5e";
  if (value < 1.5) return "#ff9c39";
  return "#d7191c";
}

function formatAnomaly(value) {
  if (value === null || value === undefined) return "No data";
  return `${value.toFixed(2)} °C`;
}

function monthLabel(value) {
  const item = config.monthly.months.find((entry) => entry.value === value);
  return item ? item.label : value;
}

function formatPeriod() {
  return mode === "monthly" ? `${monthLabel(month)} ${year}` : String(year);
}

function monthsForYear(selectedYear) {
  return config.monthly.availableMonthsByYear[String(selectedYear)] || [];
}

function clampYear(nextMode, nextYear) {
  const range = config[nextMode];
  return Math.min(Math.max(nextYear, range.minYear), range.maxYear);
}

function apiUrl(path, params = {}) {
  const url = new URL(path, window.location.origin);

  for (const [key, value] of Object.entries(params)) {
    if (value !== null && value !== undefined && value !== "") {
      url.searchParams.set(key, value);
    }
  }

  return url;
}

function updateMonthSelect() {
  const available = monthsForYear(year);

  if (available.length === 0) {
    monthSelect.innerHTML = "";
    return;
  }

  if (!available.includes(month)) {
    month = available[available.length - 1];
  }

  monthSelect.innerHTML = "";

  for (const item of config.monthly.months) {
    if (!available.includes(item.value)) continue;

    const option = document.createElement("option");
    option.value = item.value;
    option.textContent = item.label;
    option.selected = item.value === month;
    monthSelect.appendChild(option);
  }
}

function updateControls() {
  const range = config[mode];

  yearSlider.min = range.minYear;
  yearSlider.max = range.maxYear;
  yearSlider.value = year;
  yearValue.textContent = String(year);

  annualButton.classList.toggle("active", mode === "annual");
  monthlyButton.classList.toggle("active", mode === "monthly");
  monthGroup.classList.toggle("hidden", mode !== "monthly");
}

function updateInfoPanel(data) {
  infoPeriod.textContent = formatPeriod();

  if (!data) {
    countryName.textContent = "Hover over a country";
    anomalyValue.textContent = "--";
    return;
  }

  countryName.textContent = data.name;
  anomalyValue.textContent = formatAnomaly(data.anomaly);
}

async function fetchCountry(countryCode) {
  const response = await fetch(
    apiUrl(`${config.countryUrlBase}${countryCode}`, {
      mode,
      year,
      month: mode === "monthly" ? month : null,
    }),
  );

  return response.json();
}

function setFeatureStyle(layer) {
  const value = anomalies[layer.feature.id] ?? null;

  layer.setStyle({
    fillColor: getColor(value),
    weight: 1,
    opacity: 1,
    color: "#333333",
    fillOpacity: 0.85,
  });
}

function refreshMap() {
  if (!geoJsonLayer) return;

  geoJsonLayer.eachLayer((layer) => {
    setFeatureStyle(layer);

    if (layer.feature.id === lockedCountry) {
      layer.setStyle({
        weight: 2,
        color: "#ffffff",
      });
    }
  });
}

async function fetchMapData() {
  const response = await fetch(
    apiUrl(config.mapDataUrl, {
      mode,
      year,
      month: mode === "monthly" ? month : null,
    }),
  );

  const data = await response.json();
  anomalies = data.anomalies;

  if (mode === "monthly" && data.month) {
    month = data.month;
    updateMonthSelect();
  }

  refreshMap();
}

async function refreshSelection() {
  await fetchMapData();

  if (!lockedCountry) {
    updateInfoPanel(null);
    return;
  }

  updateInfoPanel(await fetchCountry(lockedCountry));
}

function createGeoJsonLayer(worldGeoJson) {
  geoJsonLayer = L.geoJSON(worldGeoJson, {
    style(feature) {
      return {
        fillColor: getColor(anomalies[feature.id] ?? null),
        weight: 1,
        opacity: 1,
        color: "#333333",
        fillOpacity: 0.85,
      };
    },
    onEachFeature(feature, layer) {
      layer.on("mouseover", async () => {
        layer.setStyle({
          weight: 2,
          color: "#ffffff",
        });

        if (!lockedCountry) {
          updateInfoPanel(await fetchCountry(feature.id));
        }
      });

      layer.on("mouseout", () => {
        if (lockedCountry !== feature.id) {
          setFeatureStyle(layer);
        }

        if (!lockedCountry) {
          updateInfoPanel(null);
        }
      });

      layer.on("click", async () => {
        lockedCountry = feature.id;
        refreshMap();
        updateInfoPanel(await fetchCountry(feature.id));
      });
    },
  }).addTo(map);

  map.fitBounds(geoJsonLayer.getBounds(), {
    padding: [10, 10],
  });
}

async function loadPage() {
  updateMonthSelect();
  updateControls();

  const response = await fetch(config.geoJsonUrl);
  const worldGeoJson = await response.json();

  await fetchMapData();
  createGeoJsonLayer(worldGeoJson);
}

yearSlider.addEventListener("input", async (event) => {
  year = Number(event.target.value);
  yearValue.textContent = String(year);

  if (mode === "monthly") {
    updateMonthSelect();
  }

  await refreshSelection();
});

monthSelect.addEventListener("change", async (event) => {
  month = event.target.value;
  await refreshSelection();
});

annualButton.addEventListener("click", async () => {
  mode = "annual";
  year = clampYear("annual", year);
  updateControls();
  await refreshSelection();
});

monthlyButton.addEventListener("click", async () => {
  mode = "monthly";
  year = clampYear("monthly", year);
  updateMonthSelect();
  updateControls();
  await refreshSelection();
});

loadPage().catch((error) => {
  console.error(error);
  countryName.textContent = "Could not load data";
  anomalyValue.textContent = "Check the console";
});
