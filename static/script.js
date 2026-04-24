const yearSlider = document.getElementById("yearSlider");
const yearValue = document.getElementById("yearValue");
const infoPeriod = document.getElementById("infoPeriod");
const countryName = document.getElementById("countryName");
const anomalyValue = document.getElementById("anomalyValue");
const annualButton = document.getElementById("annualButton");
const monthlyButton = document.getElementById("monthlyButton");
const monthGroup = document.getElementById("monthGroup");
const monthSelect = document.getElementById("monthSelect");

let selectedMode = "annual";
let selectedYear = window.EARTHPULSE_CONFIG.annual.selectedYear;
let selectedMonth = window.EARTHPULSE_CONFIG.monthly.selectedMonth;
let lockedCountryCode = null;
let geoJsonLayer = null;
let anomalyByCountry = {};

const map = L.map("map", {
  zoomControl: true,
  attributionControl: false,
  worldCopyJump: false,
});

function getColor(anomaly) {
  // Turn the anomaly number into a choropleth color.
  if (anomaly === null || anomaly === undefined) {
    return "#222222";
  }
  if (anomaly < -1.5) return "#2c7bb6";
  if (anomaly < -0.5) return "#74add1";
  if (anomaly < 0.5) return "#ffffbf";
  if (anomaly < 1.5) return "#fdae61";
  return "#d7191c";
}

function formatAnomaly(anomaly) {
  if (anomaly === null || anomaly === undefined) {
    return "No data";
  }
  return `${anomaly.toFixed(2)} °C`;
}

function getMonthLabel(monthValue) {
  const month = window.EARTHPULSE_CONFIG.monthly.months.find((item) => item.value === monthValue);
  return month ? month.label : monthValue;
}

function formatPeriodLabel() {
  if (selectedMode === "monthly") {
    return `${getMonthLabel(selectedMonth)} ${selectedYear}`;
  }
  return String(selectedYear);
}

function getAvailableMonthsForYear(year) {
  return window.EARTHPULSE_CONFIG.monthly.availableMonthsByYear[String(year)] || [];
}

function clampYearForMode(mode, year) {
  const modeConfig = window.EARTHPULSE_CONFIG[mode];
  return Math.min(Math.max(year, modeConfig.minYear), modeConfig.maxYear);
}

function syncMonthOptions() {
  const availableMonths = getAvailableMonthsForYear(selectedYear);

  if (availableMonths.length === 0) {
    monthSelect.innerHTML = "";
    selectedMonth = window.EARTHPULSE_CONFIG.monthly.selectedMonth;
    return;
  }

  if (!availableMonths.includes(selectedMonth)) {
    selectedMonth = availableMonths[availableMonths.length - 1];
  }

  monthSelect.innerHTML = "";

  window.EARTHPULSE_CONFIG.monthly.months.forEach((month) => {
    if (!availableMonths.includes(month.value)) {
      return;
    }

    const option = document.createElement("option");
    option.value = month.value;
    option.textContent = month.label;
    option.selected = month.value === selectedMonth;
    monthSelect.appendChild(option);
  });
}

function setSliderRange() {
  const modeConfig = window.EARTHPULSE_CONFIG[selectedMode];
  yearSlider.min = modeConfig.minYear;
  yearSlider.max = modeConfig.maxYear;
  yearSlider.value = selectedYear;
  yearValue.textContent = String(selectedYear);
}

function updateModeControls() {
  annualButton.classList.toggle("active", selectedMode === "annual");
  monthlyButton.classList.toggle("active", selectedMode === "monthly");
  monthGroup.classList.toggle("hidden", selectedMode !== "monthly");
}

function updateInfoPanel(data) {
  infoPeriod.textContent = formatPeriodLabel();

  if (!data) {
    countryName.textContent = "Hover over a country";
    anomalyValue.textContent = "--";
    return;
  }

  countryName.textContent = data.name;
  anomalyValue.textContent = formatAnomaly(data.anomaly);
}

async function fetchCountryInfo(countryCode) {
  const monthParam = selectedMode === "monthly" ? `&month=${selectedMonth}` : "";
  const response = await fetch(
    `${window.EARTHPULSE_CONFIG.countryUrlBase}${countryCode}?mode=${selectedMode}&year=${selectedYear}${monthParam}`,
  );
  return response.json();
}

function resetFeatureStyle(layer) {
  const countryCode = layer.feature.id;
  const anomaly = anomalyByCountry[countryCode] ?? null;

  layer.setStyle({
    fillColor: getColor(anomaly),
    weight: 1,
    opacity: 1,
    color: "#333333",
    fillOpacity: 0.85,
  });
}

function refreshMapStyles() {
  if (!geoJsonLayer) {
    return;
  }

  geoJsonLayer.eachLayer((layer) => {
    resetFeatureStyle(layer);

    if (layer.feature.id === lockedCountryCode) {
      layer.setStyle({
        weight: 2,
        color: "#ffffff",
      });
    }
  });
}

async function loadMapData() {
  // Ask the Python app for anomaly values for the selected year.
  const monthParam = selectedMode === "monthly" ? `&month=${selectedMonth}` : "";
  const response = await fetch(
    `${window.EARTHPULSE_CONFIG.mapDataUrl}?mode=${selectedMode}&year=${selectedYear}${monthParam}`,
  );
  const data = await response.json();
  anomalyByCountry = data.anomalies;
  if (selectedMode === "monthly" && data.month) {
    selectedMonth = data.month;
    syncMonthOptions();
  }
  refreshMapStyles();
}

function createGeoJsonLayer(worldGeoJson) {
  geoJsonLayer = L.geoJSON(worldGeoJson, {
    style(feature) {
      const anomaly = anomalyByCountry[feature.id] ?? null;
      return {
        fillColor: getColor(anomaly),
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

        if (!lockedCountryCode) {
          const data = await fetchCountryInfo(feature.id);
          updateInfoPanel(data);
        }
      });

      layer.on("mouseout", () => {
        if (lockedCountryCode !== feature.id) {
          resetFeatureStyle(layer);
        }

        if (!lockedCountryCode) {
          updateInfoPanel(null);
        }
      });

      layer.on("click", async () => {
        lockedCountryCode = feature.id;
        refreshMapStyles();
        const data = await fetchCountryInfo(feature.id);
        updateInfoPanel(data);
      });
    },
  }).addTo(map);

  map.fitBounds(geoJsonLayer.getBounds(), {
    padding: [10, 10],
  });
}

async function loadPage() {
  const geoJsonResponse = await fetch(window.EARTHPULSE_CONFIG.geoJsonUrl);
  const worldGeoJson = await geoJsonResponse.json();

  syncMonthOptions();
  setSliderRange();
  updateModeControls();
  await loadMapData();
  createGeoJsonLayer(worldGeoJson);
}

yearSlider.addEventListener("input", async (event) => {
  selectedYear = Number(event.target.value);
  yearValue.textContent = String(selectedYear);

  if (selectedMode === "monthly") {
    syncMonthOptions();
  }

  await loadMapData();

  if (lockedCountryCode) {
    const data = await fetchCountryInfo(lockedCountryCode);
    updateInfoPanel(data);
  } else {
    updateInfoPanel(null);
  }
});

monthSelect.addEventListener("change", async (event) => {
  selectedMonth = event.target.value;
  await loadMapData();

  if (lockedCountryCode) {
    const data = await fetchCountryInfo(lockedCountryCode);
    updateInfoPanel(data);
  } else {
    updateInfoPanel(null);
  }
});

annualButton.addEventListener("click", () => {
  selectedMode = "annual";
  selectedYear = clampYearForMode("annual", selectedYear);
  setSliderRange();
  updateModeControls();
  loadMapData().then(async () => {
    if (lockedCountryCode) {
      const data = await fetchCountryInfo(lockedCountryCode);
      updateInfoPanel(data);
    } else {
      updateInfoPanel(null);
    }
  });
});

monthlyButton.addEventListener("click", () => {
  selectedMode = "monthly";
  selectedYear = clampYearForMode("monthly", selectedYear);
  selectedMonth = selectedMonth || window.EARTHPULSE_CONFIG.monthly.selectedMonth;
  syncMonthOptions();
  setSliderRange();
  updateModeControls();
  loadMapData().then(async () => {
    if (lockedCountryCode) {
      const data = await fetchCountryInfo(lockedCountryCode);
      updateInfoPanel(data);
    } else {
      updateInfoPanel(null);
    }
  });
});

loadPage().catch((error) => {
  console.error(error);
  countryName.textContent = "Could not load data";
  anomalyValue.textContent = "Check the console";
});
