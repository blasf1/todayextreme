# ziemlichwarmhier

## Python Environment Setup

### Using pyenv for Python version management

```bash
# Install the specific version if needed
pyenv install 3.13.1
```

### Running the project

```bash
# Activate the Poetry environment
poetry env activate

# Install dependencies
poetry install --no-root

# Or run commands directly through Poetry
poetry run python your_script.py
```

## Spain Data via AEMET API

Use the daily on-demand updater to fetch the latest AEMET station observations and write a frontend-compatible CSV:

```bash
cp .env.example .env
# edit .env and set AEMET_API_KEY
poetry run python analysis/stations/update_aemet_live_station_data.py --output-root ./frontend/public/data/spain
```

Notes:

- `.env` is ignored by git and should never be committed.
- The updater automatically loads `.env` from the repository root.

By default, this writes:

```text
./frontend/public/data/spain/station_data/10min_station_data_YYYYMMDD.csv
```

Run it for a specific day (useful for manual retries):

```bash
poetry run python analysis/stations/update_aemet_live_station_data.py \
	--output-root ./frontend/public/data/spain \
	--reference-date 20260131
```

### Spain Historical Baselines (daily local update)

To keep baseline datasets up to date as new daily data arrives, run:

```bash
poetry run python analysis/stations/update_aemet_historical_baselines.py \
  --output-root ./frontend/public/data/spain
```

This updates local files used by the frontend:

```text
./frontend/public/data/spain/daily_recent_by_date/YYYY-MM-DD.csv
./frontend/public/data/spain/yearly_mean_by_day/1961_1990/MM_DD.csv
./frontend/public/data/spain/interpolated_hourly/1961_1990/interpolated_hourly_temperatures_1961_1990_MM_DD.csv
./data/spain/history/daily_station_history.csv
```

Optional: rebuild baseline files for all month/day combinations already present in local history:

```bash
poetry run python analysis/stations/update_aemet_historical_baselines.py \
  --output-root ./frontend/public/data/spain \
  --rebuild-all-baselines
```

Daily scheduler example (runs at 00:15 Europe/Madrid):

```cron
15 0 * * * cd /root/personal/todayextreme && /root/.local/bin/poetry run python analysis/stations/update_aemet_live_station_data.py --output-root ./frontend/public/data/spain
30 0 * * * cd /root/personal/todayextreme && /root/.local/bin/poetry run python analysis/stations/update_aemet_historical_baselines.py --output-root ./frontend/public/data/spain
```

Then run the frontend with Spain selected:

```bash
cd frontend
VITE_APP_COUNTRY=spain npm run start:remote
```
