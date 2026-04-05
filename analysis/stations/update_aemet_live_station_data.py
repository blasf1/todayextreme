#!/usr/bin/env python3

"""Daily on-demand updater for Spain live station data via AEMET OpenData.

Output format matches frontend/src/services/LiveDataService.ts:
station_id,station_name,data_date,elevation,lat,lon,humidity,max_temperature,min_temperature,temperature
"""

from __future__ import annotations

import argparse
import csv
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


@dataclass(frozen=True)
class StationMeta:
    station_id: str
    station_name: str
    elevation: float | None
    lat: float | None
    lon: float | None


@dataclass(frozen=True)
class StationObservation:
    station_id: str
    timestamp: datetime | None
    temperature: float | None
    min_temperature: float | None
    max_temperature: float | None
    humidity: float | None


@dataclass(frozen=True)
class IntradaySnapshot:
    station_id: str
    timestamp: datetime
    temperature: float | None
    humidity: float | None


@dataclass(frozen=True)
class CityRecord:
    name: str
    lat: float
    lon: float


SPAIN_CITY_STATION_OVERRIDES: dict[str, list[str]] = {
    "albacete": ["8175"],
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Update Spain live station data from AEMET API."
    )
    parser.add_argument(
        "--api-key",
        default=os.getenv("AEMET_API_KEY"),
        help="AEMET API key (defaults to AEMET_API_KEY env var).",
    )
    parser.add_argument(
        "--output-root",
        default="./data/spain",
        help="Output root directory (default: ./data/spain).",
    )
    parser.add_argument(
        "--reference-date",
        default=datetime.now(MADRID_TZ).strftime("%Y%m%d"),
        help="Date suffix for output file name in YYYYMMDD (default: today in Europe/Madrid).",
    )
    parser.add_argument(
        "--timeout-seconds",
        type=int,
        default=30,
        help="HTTP timeout in seconds (default: 30).",
    )
    parser.add_argument(
        "--intraday-history-file",
        default="./data/spain/history/intraday_station_observations.csv",
        help="Local CSV cache for intraday observed snapshots used to compute day-so-far aggregates.",
    )
    parser.add_argument(
        "--city-csv",
        default="./frontend/public/spanish_cities_p5000.csv",
        help="City CSV used to identify relevant stations for station-page hourly scraping.",
    )
    return parser.parse_args()


def require_api_key(api_key: str | None) -> str:
    if api_key and api_key.strip():
        return api_key.strip()
    raise ValueError("Missing AEMET API key. Set AEMET_API_KEY or pass --api-key.")


def redact_api_key(text: str) -> str:
    return re.sub(r"api_key=[^&\s]+", "api_key=<redacted>", text)


def request_json(url: str, timeout_seconds: int) -> Any:
    safe_url = redact_api_key(url)

    try:
        response = requests.get(url, timeout=timeout_seconds)
    except requests.RequestException as exc:
        raise RuntimeError(f"HTTP request failed for {safe_url}: {exc}") from exc

    if response.status_code >= 400:
        raise RuntimeError(
            f"HTTP {response.status_code} calling {safe_url}: {response.reason}"
        )

    try:
        return response.json()
    except ValueError as exc:
        raise RuntimeError(f"Invalid JSON response from {safe_url}") from exc


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


def get_first_available_data_url(
    api_paths: list[str], api_key: str, timeout_seconds: int
) -> str:
    errors: list[str] = []

    for path in api_paths:
        try:
            return get_data_url(path, api_key, timeout_seconds)
        except RuntimeError as exc:
            errors.append(f"{path}: {exc}")

    joined_errors = " | ".join(errors)
    raise RuntimeError(
        f"Could not resolve AEMET data URL from candidates: {joined_errors}"
    )


def parse_dms_coordinate(value: str | None) -> float | None:
    # AEMET example: 412342N, 0034215W
    if not value:
        return None

    raw = value.strip()
    if len(raw) < 2:
        return None

    hemisphere = raw[-1].upper()
    digits = raw[:-1]

    if hemisphere not in {"N", "S", "E", "W"}:
        return None
    if not digits.isdigit() or len(digits) < 6:
        return None

    degree_len = len(digits) - 4
    degrees = int(digits[:degree_len])
    minutes = int(digits[degree_len : degree_len + 2])
    seconds = int(digits[degree_len + 2 : degree_len + 4])

    decimal = degrees + (minutes / 60.0) + (seconds / 3600.0)
    if hemisphere in {"S", "W"}:
        decimal *= -1

    return decimal


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    from math import asin, cos, radians, sin, sqrt

    r = 6371.0
    dlat = radians(lat2 - lat1)
    dlon = radians(lon2 - lon1)
    a = (
        sin(dlat / 2) ** 2
        + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon / 2) ** 2
    )
    c = 2 * asin(sqrt(a))
    return r * c


def parse_float(value: Any) -> float | None:
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def parse_timestamp(value: Any) -> datetime | None:
    if not value or not isinstance(value, str):
        return None

    normalized = value.replace("Z", "+00:00")
    try:
        return datetime.fromisoformat(normalized)
    except ValueError:
        return None


def to_station_meta(raw: dict[str, Any]) -> StationMeta | None:
    station_id = str(raw.get("indicativo", "")).strip()
    station_name = str(raw.get("nombre", "")).strip()

    if not station_id or not station_name:
        return None

    return StationMeta(
        station_id=station_id,
        station_name=station_name,
        elevation=parse_float(raw.get("altitud")),
        lat=parse_dms_coordinate(raw.get("latitud")),
        lon=parse_dms_coordinate(raw.get("longitud")),
    )


def to_station_observation(raw: dict[str, Any]) -> StationObservation | None:
    station_id = str(raw.get("idema", "")).strip()
    if not station_id:
        return None

    temperature = parse_float(raw.get("ta"))
    min_temperature = parse_float(raw.get("tamin"))
    max_temperature = parse_float(raw.get("tamax"))

    return StationObservation(
        station_id=station_id,
        timestamp=parse_timestamp(raw.get("fint")),
        temperature=temperature,
        min_temperature=min_temperature,
        max_temperature=max_temperature,
        humidity=parse_float(raw.get("hr")),
    )


def keep_latest_by_station(
    observations: list[StationObservation],
) -> dict[str, StationObservation]:
    latest: dict[str, StationObservation] = {}

    for obs in observations:
        current = latest.get(obs.station_id)
        if current is None:
            latest[obs.station_id] = obs
            continue

        current_ts = current.timestamp
        obs_ts = obs.timestamp

        if current_ts is None:
            latest[obs.station_id] = obs
        elif obs_ts is not None and obs_ts > current_ts:
            latest[obs.station_id] = obs

    return latest


def parse_reference_date(reference_date: str) -> date:
    try:
        return datetime.strptime(reference_date, "%Y%m%d").date()
    except ValueError as exc:
        raise ValueError(
            f"Invalid --reference-date '{reference_date}'. Expected YYYYMMDD."
        ) from exc


def to_intraday_snapshot(obs: StationObservation) -> IntradaySnapshot | None:
    if obs.timestamp is None:
        return None

    return IntradaySnapshot(
        station_id=obs.station_id,
        timestamp=obs.timestamp,
        temperature=obs.temperature,
        humidity=obs.humidity,
    )


def load_intraday_history(history_path: Path) -> list[IntradaySnapshot]:
    if not history_path.exists():
        return []

    snapshots: list[IntradaySnapshot] = []

    with history_path.open("r", newline="", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            station_id = str(row.get("station_id", "")).strip()
            ts_raw = str(row.get("timestamp", "")).strip()
            if not station_id or not ts_raw:
                continue

            parsed_timestamp = parse_timestamp(ts_raw)
            if parsed_timestamp is None:
                continue

            snapshots.append(
                IntradaySnapshot(
                    station_id=station_id,
                    timestamp=parsed_timestamp,
                    temperature=parse_float(row.get("temperature")),
                    humidity=parse_float(row.get("humidity")),
                )
            )

    return snapshots


def write_intraday_history(
    history_path: Path,
    snapshots: list[IntradaySnapshot],
    keep_since_local_day: date,
) -> None:
    history_path.parent.mkdir(parents=True, exist_ok=True)

    filtered = [
        s
        for s in snapshots
        if s.timestamp.astimezone(MADRID_TZ).date() >= keep_since_local_day
    ]
    filtered.sort(key=lambda s: (s.station_id, s.timestamp.isoformat()))

    with history_path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=["station_id", "timestamp", "temperature", "humidity"],
        )
        writer.writeheader()
        for s in filtered:
            writer.writerow(
                {
                    "station_id": s.station_id,
                    "timestamp": s.timestamp.isoformat(),
                    "temperature": "" if s.temperature is None else f"{s.temperature}",
                    "humidity": "" if s.humidity is None else f"{s.humidity}",
                }
            )


def merge_intraday_snapshots(
    existing: list[IntradaySnapshot],
    latest_obs: dict[str, StationObservation],
) -> list[IntradaySnapshot]:
    merged: dict[tuple[str, str], IntradaySnapshot] = {
        (s.station_id, s.timestamp.isoformat()): s for s in existing
    }

    for obs in latest_obs.values():
        snapshot = to_intraday_snapshot(obs)
        if snapshot is None:
            continue
        merged[(snapshot.station_id, snapshot.timestamp.isoformat())] = snapshot

    return list(merged.values())


def build_day_so_far_metrics(
    snapshots: list[IntradaySnapshot],
    reference_day: date,
) -> dict[str, dict[str, float | None]]:
    grouped: dict[str, list[IntradaySnapshot]] = {}

    for snapshot in snapshots:
        if snapshot.timestamp.astimezone(MADRID_TZ).date() != reference_day:
            continue
        grouped.setdefault(snapshot.station_id, []).append(snapshot)

    metrics: dict[str, dict[str, float | None]] = {}

    for station_id, values in grouped.items():
        values.sort(key=lambda item: item.timestamp)

        temperatures = [v.temperature for v in values if v.temperature is not None]
        humidities = [v.humidity for v in values if v.humidity is not None]

        min_temperature = min(temperatures) if temperatures else None
        max_temperature = max(temperatures) if temperatures else None
        mean_temperature = (
            sum(temperatures) / len(temperatures) if temperatures else None
        )
        latest_humidity = values[-1].humidity if values else None
        mean_humidity = (sum(humidities) / len(humidities)) if humidities else None

        metrics[station_id] = {
            "min_temperature": min_temperature,
            "max_temperature": max_temperature,
            "mean_temperature": mean_temperature,
            "latest_humidity": latest_humidity,
            "mean_humidity": mean_humidity,
        }

    return metrics


def load_city_records(city_csv_path: Path) -> list[CityRecord]:
    if not city_csv_path.exists():
        return []

    cities: list[CityRecord] = []
    with city_csv_path.open("r", newline="", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            city_name = str(row.get("city_name", "")).strip()
            lat = parse_float(row.get("lat"))
            lon = parse_float(row.get("lon"))
            if not city_name or lat is None or lon is None:
                continue
            cities.append(CityRecord(name=city_name, lat=lat, lon=lon))

    return cities


def find_relevant_station_ids(
    cities: list[CityRecord],
    stations: dict[str, StationMeta],
) -> set[str]:
    relevant: set[str] = set()
    candidates = [
        s for s in stations.values() if s.lat is not None and s.lon is not None
    ]

    for city in cities:
        nearest_id: str | None = None
        nearest_dist: float | None = None
        for station in candidates:
            dist = haversine_km(
                city.lat, city.lon, float(station.lat), float(station.lon)
            )
            if nearest_dist is None or dist < nearest_dist:
                nearest_dist = dist
                nearest_id = station.station_id

        if nearest_id:
            relevant.add(nearest_id)

        normalized_city_name = city.name.strip().lower()
        for override_station_id in SPAIN_CITY_STATION_OVERRIDES.get(
            normalized_city_name, []
        ):
            if override_station_id in stations:
                relevant.add(override_station_id)

    return relevant


def parse_station_hourly_temperatures_from_html(html_text: str) -> list[float]:
    # Extract the inline JavaScript array used by AEMET station chart page.
    match = re.search(r"d1_temperatura\s*=\s*\[(.*?)\];", html_text, re.DOTALL)
    if not match:
        return []

    pairs_block = match.group(1)
    value_matches = re.findall(r"\[\s*\d+\s*,\s*(-?\d+(?:\.\d+)?)\s*\]", pairs_block)
    temperatures: list[float] = []
    for raw_value in value_matches:
        try:
            temperatures.append(float(raw_value))
        except ValueError:
            continue

    return temperatures


def fetch_station_page_day_metrics(
    station_id: str,
    timeout_seconds: int,
) -> dict[str, float] | None:
    url = (
        "https://www.aemet.es/es/eltiempo/observacion/ultimosdatos"
        f"?l={station_id}&w=0&datos=img&f=temperatura"
    )

    try:
        response = requests.get(url, timeout=timeout_seconds)
    except requests.RequestException:
        return None

    if response.status_code != 200:
        return None

    response.encoding = "ISO-8859-15"
    temperatures = parse_station_hourly_temperatures_from_html(response.text)
    if not temperatures:
        return None

    min_temperature = min(temperatures)
    max_temperature = max(temperatures)
    mean_temperature = sum(temperatures) / len(temperatures)

    return {
        "min_temperature": min_temperature,
        "max_temperature": max_temperature,
        "mean_temperature": mean_temperature,
    }


def merge_station_page_metrics(
    day_metrics: dict[str, dict[str, float | None]],
    relevant_station_ids: set[str],
    timeout_seconds: int,
) -> dict[str, dict[str, float | None]]:
    merged = {station_id: dict(values) for station_id, values in day_metrics.items()}

    for station_id in sorted(relevant_station_ids):
        station_page_metrics = fetch_station_page_day_metrics(
            station_id, timeout_seconds
        )
        if station_page_metrics is None:
            continue

        existing = merged.setdefault(station_id, {})
        existing["min_temperature"] = station_page_metrics["min_temperature"]
        existing["max_temperature"] = station_page_metrics["max_temperature"]
        existing["mean_temperature"] = station_page_metrics["mean_temperature"]

        # Be conservative with request pacing to avoid triggering anti-abuse rules.
        time.sleep(0.2)

    return merged


def format_data_date(ts: datetime | None) -> str:
    if ts is None:
        return datetime.now(MADRID_TZ).strftime("%d.%m.%Y %H:%M")

    try:
        local_ts = ts.astimezone(MADRID_TZ)
    except ValueError:
        local_ts = ts

    return local_ts.strftime("%d.%m.%Y %H:%M")


def write_output_csv(
    output_path: Path,
    stations: dict[str, StationMeta],
    latest_obs: dict[str, StationObservation],
    day_metrics: dict[str, dict[str, float | None]],
) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)

    fieldnames = [
        "station_id",
        "station_name",
        "data_date",
        "elevation",
        "lat",
        "lon",
        "humidity",
        "max_temperature",
        "min_temperature",
        "temperature",
        "day_mean_temperature",
        "day_mean_humidity",
    ]

    with output_path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()

        for station_id in sorted(stations.keys()):
            station = stations[station_id]
            obs = latest_obs.get(station_id)
            if obs is None:
                continue

            station_metrics = day_metrics.get(station_id, {})
            min_temperature = station_metrics.get("min_temperature")
            max_temperature = station_metrics.get("max_temperature")
            day_mean_temperature = station_metrics.get("mean_temperature")
            latest_humidity = station_metrics.get("latest_humidity")
            day_mean_humidity = station_metrics.get("mean_humidity")

            writer.writerow(
                {
                    "station_id": station.station_id,
                    "station_name": station.station_name,
                    "data_date": format_data_date(obs.timestamp),
                    "elevation": (
                        "" if station.elevation is None else f"{station.elevation}"
                    ),
                    "lat": "" if station.lat is None else f"{station.lat}",
                    "lon": "" if station.lon is None else f"{station.lon}",
                    "humidity": "" if latest_humidity is None else f"{latest_humidity}",
                    "max_temperature": (
                        "" if max_temperature is None else f"{max_temperature}"
                    ),
                    "min_temperature": (
                        "" if min_temperature is None else f"{min_temperature}"
                    ),
                    "temperature": (
                        "" if obs.temperature is None else f"{obs.temperature}"
                    ),
                    "day_mean_temperature": (
                        ""
                        if day_mean_temperature is None
                        else f"{day_mean_temperature}"
                    ),
                    "day_mean_humidity": (
                        "" if day_mean_humidity is None else f"{day_mean_humidity}"
                    ),
                }
            )


def main() -> None:
    repo_root = Path(__file__).resolve().parents[2]
    load_dotenv(repo_root / ".env")

    args = parse_args()
    api_key = require_api_key(args.api_key)

    stations_url = get_data_url(
        "/api/valores/climatologicos/inventarioestaciones/todasestaciones/",
        api_key,
        args.timeout_seconds,
    )
    observations_url = get_first_available_data_url(
        [
            "/api/observacion/convencional/datos/todasestaciones/",
            "/api/observacion/convencional/datos/todas/",
            "/api/observacion/convencional/todas/",
        ],
        api_key,
        args.timeout_seconds,
    )

    stations_payload = request_json(stations_url, args.timeout_seconds)
    observations_payload = request_json(observations_url, args.timeout_seconds)

    station_records = [
        to_station_meta(item) for item in stations_payload if isinstance(item, dict)
    ]
    stations = {s.station_id: s for s in station_records if s is not None}

    observation_records = [
        to_station_observation(item)
        for item in observations_payload
        if isinstance(item, dict)
    ]
    latest_obs = keep_latest_by_station(
        [o for o in observation_records if o is not None]
    )

    reference_day = parse_reference_date(args.reference_date)
    intraday_history_path = Path(args.intraday_history_file)
    existing_snapshots = load_intraday_history(intraday_history_path)
    merged_snapshots = merge_intraday_snapshots(existing_snapshots, latest_obs)
    day_metrics = build_day_so_far_metrics(merged_snapshots, reference_day)

    cities = load_city_records(Path(args.city_csv))
    relevant_station_ids = find_relevant_station_ids(cities, stations)
    day_metrics = merge_station_page_metrics(
        day_metrics,
        relevant_station_ids,
        args.timeout_seconds,
    )

    keep_since = reference_day - timedelta(days=2)
    write_intraday_history(intraday_history_path, merged_snapshots, keep_since)

    output_path = (
        Path(args.output_root)
        / "station_data"
        / f"10min_station_data_{args.reference_date}.csv"
    )

    write_output_csv(output_path, stations, latest_obs, day_metrics)

    print(f"Stations in inventory: {len(stations)}")
    print(f"Stations with latest observations: {len(latest_obs)}")
    print(f"Stations with day-so-far metrics: {len(day_metrics)}")
    print(f"Stations enriched from station-page series: {len(relevant_station_ids)}")
    print(f"Wrote: {output_path}")


if __name__ == "__main__":
    main()
