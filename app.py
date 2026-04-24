from __future__ import annotations

import json
import os
from pathlib import Path

from flask import Flask, jsonify, render_template, request, send_from_directory


BASE_DIR = Path(__file__).parent
DATA_DIR = BASE_DIR / "data"
DEFAULT_MODE = "annual"


def load_json(filename: str) -> dict:
    with (DATA_DIR / filename).open() as file:
        return json.load(file)


annual_data = load_json("annual-temperature-anomalies.json")
monthly_data = load_json("monthly-temperature-anomalies.json")

app = Flask(__name__)


def normalize_mode(mode: str | None) -> str:
    return "monthly" if mode == "monthly" else DEFAULT_MODE


def data_for_mode(mode: str) -> dict:
    return monthly_data if mode == "monthly" else annual_data


def latest_year(mode: str) -> int:
    data = data_for_mode(mode)
    if mode == "monthly":
        return int(data["latest"]["year"])
    return int(data["years"][-1])


def latest_month() -> str:
    return monthly_data["latest"]["month"]


def months_for_year(year: int) -> list[str]:
    return monthly_data["availableMonthsByYear"].get(str(year), [])


def normalize_month(year: int, month: str | None) -> str:
    available = months_for_year(year)
    if not available:
        return latest_month()
    if month in available:
        return month
    return available[-1]


def country_record(mode: str, country_code: str) -> dict | None:
    return data_for_mode(mode)["countries"].get(country_code)


def anomaly_value(
    mode: str,
    country_code: str,
    year: int,
    month: str | None = None,
) -> float | None:
    record = country_record(mode, country_code)
    if not record:
        return None

    key = str(year)
    if mode == "monthly":
        key = f"{year}-{normalize_month(year, month)}"

    value = record["values"].get(key)
    if isinstance(value, (int, float)):
        return float(value)
    return None


def map_values(
    mode: str, year: int, month: str | None = None
) -> dict[str, float | None]:
    return {
        country_code: anomaly_value(mode, country_code, year, month)
        for country_code in data_for_mode(mode)["countries"]
    }


def read_period() -> tuple[str, int, str | None]:
    mode = normalize_mode(request.args.get("mode", type=str))
    year = request.args.get("year", default=latest_year(mode), type=int)

    if mode == "monthly":
        month = normalize_month(
            year, request.args.get("month", default=latest_month(), type=str)
        )
        return mode, year, month

    return mode, year, None


@app.route("/")
def index():
    return render_template(
        "index.html",
        annual_min_year=annual_data["years"][0],
        annual_max_year=annual_data["years"][-1],
        annual_selected_year=annual_data["years"][-1],
        monthly_min_year=monthly_data["years"][0],
        monthly_max_year=monthly_data["latest"]["year"],
        monthly_selected_year=monthly_data["latest"]["year"],
        monthly_selected_month=monthly_data["latest"]["month"],
        monthly_months=monthly_data["months"],
        monthly_available_months=monthly_data["availableMonthsByYear"],
    )


@app.route("/api/years")
def years():
    return jsonify(
        {
            "annualYears": annual_data["years"],
            "monthlyYears": monthly_data["years"],
            "monthlyAvailableMonthsByYear": monthly_data["availableMonthsByYear"],
        }
    )


@app.route("/data/<path:filename>")
def data_file(filename: str):
    return send_from_directory(DATA_DIR, filename)


@app.route("/api/map-data")
def map_data():
    mode, year, month = read_period()
    return jsonify(
        {
            "mode": mode,
            "year": year,
            "month": month,
            "anomalies": map_values(mode, year, month),
        }
    )


@app.route("/api/country/<country_code>")
def country(country_code: str):
    mode, year, month = read_period()
    country_code = country_code.upper()
    record = country_record(mode, country_code)

    if not record:
        return jsonify(
            {
                "code": country_code,
                "name": "No matching data",
                "mode": mode,
                "year": year,
                "month": month,
                "anomaly": None,
            }
        )

    return jsonify(
        {
            "code": country_code,
            "name": record["name"],
            "mode": mode,
            "year": year,
            "month": month,
            "anomaly": anomaly_value(mode, country_code, year, month),
        }
    )


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8000"))
    app.run(host="127.0.0.1", port=port, debug=True, use_reloader=False)
