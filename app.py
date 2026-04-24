from __future__ import annotations

import json
import os
from pathlib import Path

from flask import Flask, jsonify, render_template, request, send_from_directory


BASE_DIR = Path(__file__).parent
DATA_DIR = BASE_DIR / "data"


def load_json(filename: str) -> dict:
    data_path = DATA_DIR / filename
    with data_path.open() as file:
        return json.load(file)


ANNUAL_DATA = load_json("annual-temperature-anomalies.json")
MONTHLY_DATA = load_json("monthly-temperature-anomalies.json")


app = Flask(__name__)


def get_mode_data(mode: str) -> dict:
    if mode == "monthly":
        return MONTHLY_DATA
    return ANNUAL_DATA


def get_country_record(mode: str, country_code: str) -> dict | None:
    return get_mode_data(mode)["countries"].get(country_code)


def get_latest_year(mode: str) -> int:
    data = get_mode_data(mode)
    if mode == "monthly":
        return int(data["latest"]["year"])
    return int(data["years"][-1])


def get_latest_month() -> str:
    return str(MONTHLY_DATA["latest"]["month"])


def get_available_months(year: int) -> list[str]:
    return MONTHLY_DATA["availableMonthsByYear"].get(str(year), [])


def normalize_month(year: int, month: str | None) -> str:
    available_months = get_available_months(year)
    if not available_months:
        return get_latest_month()
    if month in available_months:
        return str(month)
    return available_months[-1]


def get_anomaly(mode: str, country_code: str, year: int, month: str | None = None) -> float | None:
    # The anomaly value already comes from the Our World in Data dataset.
    record = get_country_record(mode, country_code)
    if not record:
        return None

    key = str(year)
    if mode == "monthly":
        normalized_month = normalize_month(year, month)
        key = f"{year}-{normalized_month}"

    value = record["values"].get(key)
    if isinstance(value, (int, float)):
        return float(value)
    return None


def build_map(mode: str, year: int, month: str | None = None) -> dict[str, float | None]:
    # Build one simple mapping for the selected period.
    return {
        country_code: get_anomaly(mode, country_code, year, month)
        for country_code in get_mode_data(mode)["countries"]
    }


@app.route("/")
def index():
    return render_template(
        "index.html",
        annual_min_year=ANNUAL_DATA["years"][0],
        annual_max_year=ANNUAL_DATA["years"][-1],
        annual_selected_year=ANNUAL_DATA["years"][-1],
        monthly_min_year=MONTHLY_DATA["years"][0],
        monthly_max_year=MONTHLY_DATA["latest"]["year"],
        monthly_selected_year=MONTHLY_DATA["latest"]["year"],
        monthly_selected_month=MONTHLY_DATA["latest"]["month"],
        monthly_months=MONTHLY_DATA["months"],
        monthly_available_months=MONTHLY_DATA["availableMonthsByYear"],
    )


@app.route("/api/years")
def years():
    return jsonify(
        {
            "annualYears": ANNUAL_DATA["years"],
            "monthlyYears": MONTHLY_DATA["years"],
            "monthlyAvailableMonthsByYear": MONTHLY_DATA["availableMonthsByYear"],
        }
    )


@app.route("/data/<path:filename>")
def data_file(filename: str):
    return send_from_directory(DATA_DIR, filename)


@app.route("/api/map-data")
def map_data():
    mode = request.args.get("mode", default="annual", type=str)
    year = request.args.get("year", default=get_latest_year(mode), type=int)
    month = request.args.get("month", default=get_latest_month(), type=str)
    normalized_month = normalize_month(year, month) if mode == "monthly" else None

    return jsonify(
        {
            "mode": mode,
            "year": year,
            "month": normalized_month,
            "anomalies": build_map(mode, year, normalized_month),
        }
    )


@app.route("/api/country/<country_code>")
def country(country_code: str):
    mode = request.args.get("mode", default="annual", type=str)
    year = request.args.get("year", default=get_latest_year(mode), type=int)
    month = request.args.get("month", default=get_latest_month(), type=str)
    normalized_month = normalize_month(year, month) if mode == "monthly" else None
    record = get_country_record(mode, country_code.upper())

    if not record:
        return jsonify(
            {
                "code": country_code.upper(),
                "name": "No matching data",
                "mode": mode,
                "year": year,
                "month": normalized_month,
                "anomaly": None,
            }
        )

    return jsonify(
        {
            "code": country_code.upper(),
            "name": record["name"],
            "mode": mode,
            "year": year,
            "month": normalized_month,
            "anomaly": get_anomaly(mode, country_code.upper(), year, normalized_month),
        }
    )


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8000"))
    app.run(host="127.0.0.1", port=port, debug=True, use_reloader=False)
