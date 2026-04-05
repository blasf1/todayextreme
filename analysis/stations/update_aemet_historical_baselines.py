#!/usr/bin/env python3

"""Daily updater for Spain historical baseline datasets (local-only).

This script fetches one day's AEMET daily climatological observations, stores
an upserted local history CSV, and regenerates frontend-ready baseline files:

- data/spain/daily_recent_by_date/YYYY-MM-DD.csv
- data/spain/yearly_mean_by_day/1961_1990/MM_DD.csv
- data/spain/interpolated_hourly/1961_1990/interpolated_hourly_temperatures_1961_1990_MM_DD.csv

All output stays local.
"""

from __future__ import annotations

import argparse
import csv
import math
import os
import re
import time
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any

import requests
from zoneinfo import ZoneInfo

AEMET_BASE_URL = "https://opendata.aemet.es/opendata"
MADRID_TZ = ZoneInfo("Europe/Madrid")

HISTORY_HEADERS = [
    "station_id",
    "date",
    "min_temperature",
    "max_temperature",
    "mean_temperature",
    "mean_humidity",
]

DAILY_BY_DATE_HEADERS = [
    "station_id",
    "date",
    "max_temperature",
    "min_temperature",
    "mean_temperature",
    "mean_humidity",
]

YEARLY_MEAN_HEADERS = ["station_id", "tasmin", "tasmax", "tas"]

INTERPOLATED_HEADERS = ["station_id"] + [f"hour_{h}" for h in range(24)]

NORMALITY_HEADERS = [
    "station_id",
    "year",
    "tas",
    "tasmin",
    "tasmax",
]


@dataclass(frozen=True)
class DailyRecord:
    station_id: str
    day: date
    min_temperature: float | None
    max_temperature: float | None
    mean_temperature: float | None
    mean_humidity: float | None


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Update Spain historical baseline datasets from AEMET (local-only)."
    )
    parser.add_argument(
        "--api-key",
        default=os.getenv("AEMET_API_KEY"),
        help="AEMET API key (defaults to AEMET_API_KEY env var).",
    )
    parser.add_argument(
        "--output-root",
        default="./frontend/public/data/spain",
        help="Frontend output root directory (default: ./frontend/public/data/spain).",
    )
    parser.add_argument(
        "--history-file",
        default="./data/spain/history/daily_station_history.csv",
        help="Local history CSV path for upserted daily records.",
    )
    parser.add_argument(
        "--target-date",
        default=datetime.now(MADRID_TZ).date().isoformat(),
        help="Date to fetch in YYYY-MM-DD (default: today in Europe/Madrid).",
    )
    parser.add_argument(
        "--reference-start-year",
        type=int,
        default=1981,
        help="Reference start year used to compute baseline means (default: 1981).",
    )
    parser.add_argument(
        "--normality-start-year",
        type=int,
        default=1951,
        help=(
            "Start year used for displayed normality cloud values " "(default: 1951)."
        ),
    )
    parser.add_argument(
        "--reference-end-year",
        type=int,
        default=datetime.now(MADRID_TZ).year,
        help="Reference end year used to compute baseline means (default: current year).",
    )
    parser.add_argument(
        "--timeout-seconds",
        type=int,
        default=30,
        help="HTTP timeout in seconds (default: 30).",
    )
    parser.add_argument(
        "--rebuild-all-baselines",
        action="store_true",
        help="Rebuild yearly/interpolated baseline files for all month-days in history.",
    )
    parser.add_argument(
        "--normality-window-days",
        type=int,
        default=15,
        help="Days before/after the target date to include in the normality cloud (default: 15).",
    )
    parser.add_argument(
        "--lookback-days",
        type=int,
        default=7,
        help="If target date has no data yet, try previous days up to this limit (default: 7).",
    )
    parser.add_argument(
        "--live-csv-dir",
        default="./frontend/public/data/spain/station_data",
        help="Fallback source directory for daily records from 10min_station_data_YYYYMMDD.csv.",
    )
    return parser.parse_args()


def load_dotenv(dotenv_path: Path) -> None:
    if not dotenv_path.exists():
        return

    for raw_line in dotenv_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue

        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")

        if key and key not in os.environ:
            os.environ[key] = value


def redact_api_key(text: str) -> str:
    return re.sub(r"api_key=[^&\s]+", "api_key=<redacted>", text)


def require_api_key(api_key: str | None) -> str:
    if api_key and api_key.strip():
        return api_key.strip()
    raise ValueError("Missing AEMET API key. Set AEMET_API_KEY or pass --api-key.")


def request_json(url: str, timeout_seconds: int, max_attempts: int = 5) -> Any:
    safe_url = redact_api_key(url)

    for attempt in range(1, max_attempts + 1):
        try:
            response = requests.get(url, timeout=timeout_seconds)
        except requests.RequestException as exc:
            if attempt == max_attempts:
                raise RuntimeError(
                    f"HTTP request failed for {safe_url}: {exc}"
                ) from exc
            time.sleep(min(2**attempt, 20))
            continue

        if response.status_code in (429, 500, 502, 503, 504):
            if attempt == max_attempts:
                raise RuntimeError(
                    f"HTTP {response.status_code} calling {safe_url}: {response.reason}"
                )
            retry_after = response.headers.get("Retry-After")
            wait_seconds = (
                float(retry_after)
                if retry_after and retry_after.isdigit()
                else min(2**attempt, 20)
            )
            time.sleep(wait_seconds)
            continue

        if response.status_code >= 400:
            raise RuntimeError(
                f"HTTP {response.status_code} calling {safe_url}: {response.reason}"
            )

        try:
            return response.json()
        except ValueError as exc:
            raise RuntimeError(f"Invalid JSON response from {safe_url}") from exc

    raise RuntimeError(f"Unable to fetch JSON from {safe_url}")


def get_data_url(api_path: str, api_key: str, timeout_seconds: int) -> str:
    descriptor_url = f"{AEMET_BASE_URL}{api_path}?api_key={api_key}"
    descriptor = request_json(descriptor_url, timeout_seconds)

    if not isinstance(descriptor, dict):
        raise RuntimeError(f"Unexpected AEMET descriptor payload: {descriptor}")

    status = descriptor.get("estado")
    if status not in (None, 200):
        raise RuntimeError(
            f"AEMET descriptor call failed with status {status}: {descriptor}"
        )

    data_url = descriptor.get("datos")
    if not data_url:
        raise RuntimeError(f"AEMET descriptor has no data URL: {descriptor}")

    return str(data_url)


def parse_aemet_number(value: Any) -> float | None:
    if value is None:
        return None

    if isinstance(value, (int, float)):
        return float(value)

    text = str(value).strip()
    if not text:
        return None

    normalized = text.replace(",", ".")
    try:
        return float(normalized)
    except ValueError:
        return None


def parse_daily_record(raw: dict[str, Any]) -> DailyRecord | None:
    station_id = str(raw.get("idema") or raw.get("indicativo") or "").strip()
    date_str = str(raw.get("fecha", "")).strip()

    if not station_id or not date_str:
        return None

    try:
        day = datetime.strptime(date_str, "%Y-%m-%d").date()
    except ValueError:
        return None

    min_temperature = parse_aemet_number(raw.get("tmin"))
    max_temperature = parse_aemet_number(raw.get("tmax"))
    mean_temperature = parse_aemet_number(raw.get("tmed"))

    # If mean is missing but min/max exists, approximate with midpoint.
    if (
        mean_temperature is None
        and min_temperature is not None
        and max_temperature is not None
    ):
        mean_temperature = (min_temperature + max_temperature) / 2.0

    humidity_mean = parse_aemet_number(raw.get("hrMedia"))
    if humidity_mean is None:
        hr_max = parse_aemet_number(raw.get("hrMax"))
        hr_min = parse_aemet_number(raw.get("hrMin"))
        if hr_max is not None and hr_min is not None:
            humidity_mean = (hr_max + hr_min) / 2.0

    return DailyRecord(
        station_id=station_id,
        day=day,
        min_temperature=min_temperature,
        max_temperature=max_temperature,
        mean_temperature=mean_temperature,
        mean_humidity=humidity_mean,
    )


def parse_live_csv_datetime(value: str) -> date | None:
    text = value.strip()
    if not text:
        return None

    for fmt in ("%d.%m.%Y %H:%M", "%Y-%m-%d %H:%M:%S"):
        try:
            return datetime.strptime(text, fmt).date()
        except ValueError:
            continue

    return None


def load_history(history_path: Path) -> dict[tuple[str, str], DailyRecord]:
    if not history_path.exists():
        return {}

    records: dict[tuple[str, str], DailyRecord] = {}

    with history_path.open("r", newline="", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            station_id = str(row.get("station_id", "")).strip()
            date_str = str(row.get("date", "")).strip()
            if not station_id or not date_str:
                continue

            try:
                day = datetime.strptime(date_str, "%Y-%m-%d").date()
            except ValueError:
                continue

            record = DailyRecord(
                station_id=station_id,
                day=day,
                min_temperature=parse_aemet_number(row.get("min_temperature")),
                max_temperature=parse_aemet_number(row.get("max_temperature")),
                mean_temperature=parse_aemet_number(row.get("mean_temperature")),
                mean_humidity=parse_aemet_number(row.get("mean_humidity")),
            )
            records[(station_id, date_str)] = record

    return records


def write_history(
    history_path: Path, records: dict[tuple[str, str], DailyRecord]
) -> None:
    history_path.parent.mkdir(parents=True, exist_ok=True)

    ordered = sorted(
        records.values(),
        key=lambda r: (r.day.isoformat(), r.station_id),
    )

    with history_path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=HISTORY_HEADERS)
        writer.writeheader()

        for r in ordered:
            writer.writerow(
                {
                    "station_id": r.station_id,
                    "date": r.day.isoformat(),
                    "min_temperature": (
                        "" if r.min_temperature is None else f"{r.min_temperature:.2f}"
                    ),
                    "max_temperature": (
                        "" if r.max_temperature is None else f"{r.max_temperature:.2f}"
                    ),
                    "mean_temperature": (
                        ""
                        if r.mean_temperature is None
                        else f"{r.mean_temperature:.2f}"
                    ),
                    "mean_humidity": (
                        "" if r.mean_humidity is None else f"{r.mean_humidity:.2f}"
                    ),
                }
            )


def write_daily_recent_by_date(
    output_root: Path, target_day: date, records: list[DailyRecord]
) -> Path:
    out_path = output_root / "daily_recent_by_date" / f"{target_day.isoformat()}.csv"
    out_path.parent.mkdir(parents=True, exist_ok=True)

    filtered = [r for r in records if r.day == target_day]
    filtered.sort(key=lambda r: r.station_id)

    with out_path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=DAILY_BY_DATE_HEADERS)
        writer.writeheader()

        for r in filtered:
            writer.writerow(
                {
                    "station_id": r.station_id,
                    "date": r.day.isoformat(),
                    "max_temperature": (
                        "" if r.max_temperature is None else f"{r.max_temperature:.2f}"
                    ),
                    "min_temperature": (
                        "" if r.min_temperature is None else f"{r.min_temperature:.2f}"
                    ),
                    "mean_temperature": (
                        ""
                        if r.mean_temperature is None
                        else f"{r.mean_temperature:.2f}"
                    ),
                    "mean_humidity": (
                        "" if r.mean_humidity is None else f"{r.mean_humidity:.2f}"
                    ),
                }
            )

    return out_path


def monthly_day_key(day: date) -> str:
    return f"{day.month:02d}_{day.day:02d}"


def mean(values: list[float]) -> float | None:
    if not values:
        return None
    return sum(values) / len(values)


def build_yearly_mean_rows(
    records: list[DailyRecord], month: int, day: int, start_year: int, end_year: int
) -> list[dict[str, str]]:
    bucket: dict[str, dict[str, list[float]]] = {}

    for r in records:
        if r.day.month != month or r.day.day != day:
            continue
        if r.day.year < start_year or r.day.year > end_year:
            continue

        station = bucket.setdefault(
            r.station_id,
            {"tasmin": [], "tasmax": [], "tas": []},
        )

        if r.min_temperature is not None:
            station["tasmin"].append(r.min_temperature)
        if r.max_temperature is not None:
            station["tasmax"].append(r.max_temperature)
        if r.mean_temperature is not None:
            station["tas"].append(r.mean_temperature)

    rows: list[dict[str, str]] = []

    for station_id in sorted(bucket.keys()):
        values = bucket[station_id]
        tasmin = mean(values["tasmin"])
        tasmax = mean(values["tasmax"])
        tas = mean(values["tas"])

        if tasmin is None and tasmax is None and tas is None:
            continue

        rows.append(
            {
                "station_id": station_id,
                "tasmin": "" if tasmin is None else f"{tasmin:.2f}",
                "tasmax": "" if tasmax is None else f"{tasmax:.2f}",
                "tas": "" if tas is None else f"{tas:.2f}",
            }
        )

    return rows


def build_hourly_curve(
    tmin: float | None, tmax: float | None, tmean: float | None
) -> list[float | None]:
    # Keep deterministic fallback behavior for sparse baselines.
    if tmean is None and tmin is None and tmax is None:
        return [None] * 24

    if tmin is None and tmax is None:
        return [tmean] * 24

    if tmin is None:
        tmin = tmax
    if tmax is None:
        tmax = tmin

    if tmin is None or tmax is None:
        return [tmean] * 24

    values: list[float] = []

    # Simple diurnal cycle approximation:
    # - minimum around 06:00
    # - maximum around 15:00
    min_hour = 6
    max_hour = 15

    for hour in range(24):
        if min_hour <= hour <= max_hour:
            # warming phase
            ratio = (hour - min_hour) / max(max_hour - min_hour, 1)
            value = tmin + (tmax - tmin) * ratio
        else:
            # cooling phase wrapped across midnight
            if hour > max_hour:
                distance = hour - max_hour
            else:
                distance = (24 - max_hour) + hour
            cooldown_hours = (24 - max_hour) + min_hour
            ratio = distance / max(cooldown_hours, 1)
            value = tmax - (tmax - tmin) * ratio

        values.append(value)

    if tmean is not None:
        avg = sum(values) / 24.0
        offset = tmean - avg
        values = [v + offset for v in values]

    return values


def write_yearly_mean_file(
    output_root: Path, month: int, day: int, rows: list[dict[str, str]]
) -> Path:
    out_path = (
        output_root / "yearly_mean_by_day" / "1961_1990" / f"{month:02d}_{day:02d}.csv"
    )
    out_path.parent.mkdir(parents=True, exist_ok=True)

    with out_path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=YEARLY_MEAN_HEADERS)
        writer.writeheader()
        for row in rows:
            writer.writerow(row)

    return out_path


def write_interpolated_file(
    output_root: Path, month: int, day: int, rows: list[dict[str, str]]
) -> Path:
    out_path = (
        output_root
        / "interpolated_hourly"
        / "1961_1990"
        / f"interpolated_hourly_temperatures_1961_1990_{month:02d}_{day:02d}.csv"
    )
    out_path.parent.mkdir(parents=True, exist_ok=True)

    with out_path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=INTERPOLATED_HEADERS)
        writer.writeheader()

        for row in rows:
            station_id = row["station_id"]
            tmin = parse_aemet_number(row.get("tasmin"))
            tmax = parse_aemet_number(row.get("tasmax"))
            tmean = parse_aemet_number(row.get("tas"))
            curve = build_hourly_curve(tmin, tmax, tmean)

            out_row: dict[str, str] = {"station_id": station_id}
            for hour, value in enumerate(curve):
                out_row[f"hour_{hour}"] = "" if value is None else f"{value:.2f}"
            writer.writerow(out_row)

    return out_path


def build_normality_rows(records: list[DailyRecord]) -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []

    for r in records:
        if r.mean_temperature is None:
            continue

        rows.append(
            {
                "station_id": r.station_id,
                "year": str(r.day.year),
                "tas": f"{r.mean_temperature:.2f}",
                "tasmin": (
                    "" if r.min_temperature is None else f"{r.min_temperature:.2f}"
                ),
                "tasmax": (
                    "" if r.max_temperature is None else f"{r.max_temperature:.2f}"
                ),
            }
        )

    rows.sort(key=lambda row: (row["station_id"], int(row["year"])))
    return rows


def write_normality_file(
    output_root: Path, month: int, day: int, rows: list[dict[str, str]]
) -> Path:
    out_path = output_root / "normality_by_day" / f"{month:02d}_{day:02d}.csv"
    out_path.parent.mkdir(parents=True, exist_ok=True)

    with out_path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=NORMALITY_HEADERS)
        writer.writeheader()
        for row in rows:
            writer.writerow(row)

    return out_path


def parse_target_date(value: str) -> date:
    try:
        return datetime.strptime(value, "%Y-%m-%d").date()
    except ValueError as exc:
        raise ValueError(
            f"Invalid --target-date '{value}'. Expected YYYY-MM-DD."
        ) from exc


def fetch_daily_observations(
    target_day: date,
    api_key: str,
    timeout_seconds: int,
    lookback_days: int,
    live_csv_dir: Path,
) -> tuple[list[DailyRecord], date]:
    def fetch_from_daily_endpoint(day_to_try: date) -> list[DailyRecord]:
        start = f"{day_to_try.isoformat()}T00:00:00UTC"
        end = f"{day_to_try.isoformat()}T23:59:59UTC"

        api_path = (
            "/api/valores/climatologicos/diarios/datos/"
            f"fechaini/{start}/fechafin/{end}/todasestaciones/"
        )

        data_url = get_data_url(api_path, api_key, timeout_seconds)
        payload = request_json(data_url, timeout_seconds)

        if not isinstance(payload, list):
            raise RuntimeError(f"Unexpected daily observations payload: {payload}")

        records = [
            parse_daily_record(item) for item in payload if isinstance(item, dict)
        ]
        return [r for r in records if r is not None]

    def fetch_from_live_csv(day_to_try: date) -> list[DailyRecord]:
        suffix = day_to_try.strftime("%Y%m%d")
        csv_path = live_csv_dir / f"10min_station_data_{suffix}.csv"
        if not csv_path.exists():
            return []

        rows: list[DailyRecord] = []
        with csv_path.open("r", newline="", encoding="utf-8") as handle:
            reader = csv.DictReader(handle)
            for row in reader:
                station_id = str(row.get("station_id", "")).strip()
                if not station_id:
                    continue

                date_field = str(row.get("data_date", "")).strip()
                parsed_day = parse_live_csv_datetime(date_field) or day_to_try

                rows.append(
                    DailyRecord(
                        station_id=station_id,
                        day=parsed_day,
                        min_temperature=parse_aemet_number(row.get("min_temperature")),
                        max_temperature=parse_aemet_number(row.get("max_temperature")),
                        mean_temperature=(
                            parse_aemet_number(row.get("day_mean_temperature"))
                            if parse_aemet_number(row.get("day_mean_temperature"))
                            is not None
                            else parse_aemet_number(row.get("temperature"))
                        ),
                        mean_humidity=(
                            parse_aemet_number(row.get("day_mean_humidity"))
                            if parse_aemet_number(row.get("day_mean_humidity"))
                            is not None
                            else parse_aemet_number(row.get("humidity"))
                        ),
                    )
                )
        return rows

    # 1) Try requested target day directly: endpoint first, then same-day local live fallback.
    try:
        direct = fetch_from_daily_endpoint(target_day)
        if direct:
            return direct, target_day
    except RuntimeError as exc:
        message = str(exc)
        if "status 404" not in message and "No hay datos" not in message:
            raise

    direct_live = fetch_from_live_csv(target_day)
    if direct_live:
        return direct_live, target_day

    # 2) Look back by day: endpoint and then local fallback.
    for delta in range(1, max(lookback_days, 0) + 1):
        day_to_try = target_day - timedelta(days=delta)

        try:
            from_endpoint = fetch_from_daily_endpoint(day_to_try)
            if from_endpoint:
                return from_endpoint, day_to_try
        except RuntimeError as exc:
            message = str(exc)
            if "status 404" not in message and "No hay datos" not in message:
                raise

        from_live = fetch_from_live_csv(day_to_try)
        if from_live:
            return from_live, day_to_try

    raise RuntimeError(
        "No daily records found via AEMET daily endpoint or local live CSV fallback "
        f"from {target_day.isoformat()} back {lookback_days} day(s)."
    )


def fetch_reference_day_records(
    month: int,
    day: int,
    start_year: int,
    end_year: int,
    api_key: str,
    timeout_seconds: int,
) -> list[DailyRecord]:
    records: list[DailyRecord] = []

    for year in range(start_year, end_year + 1):
        try:
            target = date(year, month, day)
        except ValueError:
            continue

        start = f"{target.isoformat()}T00:00:00UTC"
        end = f"{target.isoformat()}T23:59:59UTC"
        api_path = (
            "/api/valores/climatologicos/diarios/datos/"
            f"fechaini/{start}/fechafin/{end}/todasestaciones/"
        )

        payload: Any = None
        max_year_attempts = 4
        for attempt in range(1, max_year_attempts + 1):
            try:
                data_url = get_data_url(api_path, api_key, timeout_seconds)
                payload = request_json(data_url, timeout_seconds)
                break
            except RuntimeError as exc:
                message = str(exc)
                if "status 404" in message or "No hay datos" in message:
                    payload = []
                    break
                if "429" in message and attempt < max_year_attempts:
                    time.sleep(20 * attempt)
                    continue
                if (
                    "HTTP 500" in message
                    or "HTTP 502" in message
                    or "HTTP 503" in message
                    or "HTTP 504" in message
                ):
                    if attempt < max_year_attempts:
                        time.sleep(10 * attempt)
                        continue
                    payload = []
                    break
                raise

        if not isinstance(payload, list):
            continue

        for item in payload:
            if not isinstance(item, dict):
                continue
            rec = parse_daily_record(item)
            if rec is not None:
                records.append(rec)

        # Small pacing delay to reduce API throttling in large loops.
        time.sleep(0.6)

    return records


def fetch_reference_window_records(
    month: int,
    day: int,
    start_year: int,
    end_year: int,
    window_days: int,
    api_key: str,
    timeout_seconds: int,
) -> list[DailyRecord]:
    records: list[DailyRecord] = []
    max_chunk_days = 15

    for year in range(start_year, end_year + 1):
        try:
            target = date(year, month, day)
        except ValueError:
            continue

        start_target = target - timedelta(days=window_days)
        end_target = target + timedelta(days=window_days)

        chunk_start = start_target
        while chunk_start <= end_target:
            chunk_end = min(
                chunk_start + timedelta(days=max_chunk_days - 1), end_target
            )

            api_path = (
                "/api/valores/climatologicos/diarios/datos/"
                f"fechaini/{chunk_start.isoformat()}T00:00:00UTC/"
                f"fechafin/{chunk_end.isoformat()}T23:59:59UTC/todasestaciones/"
            )

            payload: Any = None
            max_year_attempts = 4
            for attempt in range(1, max_year_attempts + 1):
                try:
                    data_url = get_data_url(api_path, api_key, timeout_seconds)
                    payload = request_json(data_url, timeout_seconds)
                    break
                except RuntimeError as exc:
                    message = str(exc)
                    if "status 404" in message or "No hay datos" in message:
                        payload = []
                        break
                    if "429" in message and attempt < max_year_attempts:
                        time.sleep(20 * attempt)
                        continue
                    if (
                        "HTTP 500" in message
                        or "HTTP 502" in message
                        or "HTTP 503" in message
                        or "HTTP 504" in message
                    ):
                        if attempt < max_year_attempts:
                            time.sleep(10 * attempt)
                            continue
                        payload = []
                        break
                    raise

            if isinstance(payload, list):
                for item in payload:
                    if not isinstance(item, dict):
                        continue

                    rec = parse_daily_record(item)
                    if rec is None:
                        continue

                    if rec.day < start_target or rec.day > end_target:
                        continue

                    records.append(rec)

            chunk_start = chunk_end + timedelta(days=1)

        time.sleep(0.6)

    return records


def main() -> None:
    repo_root = Path(__file__).resolve().parents[2]
    load_dotenv(repo_root / ".env")

    args = parse_args()
    api_key = require_api_key(args.api_key)

    target_day = parse_target_date(args.target_date)
    output_root = Path(args.output_root)
    history_path = Path(args.history_file)

    daily_records, resolved_day = fetch_daily_observations(
        target_day,
        api_key,
        args.timeout_seconds,
        args.lookback_days,
        Path(args.live_csv_dir),
    )

    # Backfill true historical baseline source for this month/day.
    reference_records = fetch_reference_day_records(
        resolved_day.month,
        resolved_day.day,
        args.reference_start_year,
        args.reference_end_year,
        api_key,
        args.timeout_seconds,
    )

    normality_records = fetch_reference_window_records(
        resolved_day.month,
        resolved_day.day,
        min(args.normality_start_year, args.reference_end_year),
        args.reference_end_year,
        args.normality_window_days,
        api_key,
        args.timeout_seconds,
    )

    history = load_history(history_path)

    for record in daily_records:
        history[(record.station_id, record.day.isoformat())] = record

    for record in reference_records:
        history[(record.station_id, record.day.isoformat())] = record

    write_history(history_path, history)

    history_records = list(history.values())

    daily_file = write_daily_recent_by_date(output_root, resolved_day, history_records)

    if args.rebuild_all_baselines:
        month_days = sorted({(r.day.month, r.day.day) for r in history_records})
    else:
        month_days = [(resolved_day.month, resolved_day.day)]

    yearly_outputs: list[Path] = []
    interpolated_outputs: list[Path] = []
    normality_outputs: list[Path] = []

    for month, day in month_days:
        yearly_rows = build_yearly_mean_rows(
            history_records,
            month,
            day,
            args.reference_start_year,
            args.reference_end_year,
        )

        yearly_path = write_yearly_mean_file(output_root, month, day, yearly_rows)
        interpolated_path = write_interpolated_file(
            output_root, month, day, yearly_rows
        )
        normality_rows = build_normality_rows(normality_records)
        normality_path = write_normality_file(output_root, month, day, normality_rows)

        yearly_outputs.append(yearly_path)
        interpolated_outputs.append(interpolated_path)
        normality_outputs.append(normality_path)

    print(
        f"Fetched AEMET daily records: {len(daily_records)} for {resolved_day.isoformat()}"
    )
    print(f"Backfilled reference-day records: {len(reference_records)}")
    print(f"Fetched normality-window records: {len(normality_records)}")
    print(f"History records stored: {len(history_records)}")
    print(f"Wrote daily file: {daily_file}")
    print(f"Updated yearly baseline files: {len(yearly_outputs)}")
    print(f"Updated interpolated baseline files: {len(interpolated_outputs)}")
    print(f"Updated normality files: {len(normality_outputs)}")


if __name__ == "__main__":
    main()
