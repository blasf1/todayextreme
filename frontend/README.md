# Ist es jetzt wirklich warm? - Frontend

A React-based interactive web application that shows real-time temperature data across Germany, allowing users to compare and analyze temperature patterns.

## Features

- Interactive D3-based map visualization of temperature data
- Historical temperature analysis
- City comparison functionality
- Responsive design for mobile and desktop
- Redux state management

## Tech Stack

- React (with React Router for routing)
- Redux (with Redux Toolkit for state management)
- D3.js for interactive data visualizations
- CSS for styling

## Getting Started

### Installation

1. Clone the repository:

```bash
git clone https://github.com/yourusername/itishotnow.git
cd itishotnow/frontend
```

2. Install dependencies:

```bash
npm install
```

### Development

To start the development server:

```bash
npm run start
```

The application will be available at [http://localhost:3000](http://localhost:3000).

#### Configuration

You can configure the environment variables below before starting the service.

| Variable         | Value                  | Effect                                                                                                              |
| ---------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------- |
| REACT_APP_NOW    | '2025-07-07T17:35:00Z' | All data corresponds to the given date, i.e. all calls to getDate() return getDate('2025-07-07T17:35:00Z') instead. |
| VITE_APP_COUNTRY | 'germany'              | Selects the active country profile. Supported values are currently `germany` and `netherlands`.                     |

You can also deep-link into a city with `?city=Berlin` or select a profile with `?country=netherlands&city=Amsterdam`.

### Building for Production

There is a GitHub Action that automatically builds the frontend on push and stores it in an S3 bucket for serving.

## Data Sources

The application uses data from:

- GeoNames for city information
- Weather station data for temperature information
- Europe GeoJSON data for map rendering

The active country profile controls which city CSV, boundary GeoJSON, and data root are loaded. Germany remains the default profile, while the Netherlands profile is now wired in as the first non-German target.

### Data Setup

By default, during development the app is using data from the production bucket. You may instead use local data for display that you have previously curated into the required format. If you want to use your own data, follow the instructions below.

1. Downloaded and generate the data following the hints left in FILES.md and .vscode/launch.json. Real instructions will follow.
2. Symlink the data to the data directories:

   ```bash
   # Run the script from the project root
   ./symlink_data_to_frontend.sh
   ```

   This script creates symlinks in the frontend directory that point to the required data files:
   - Station data for the map of Germany
   - Rolling average data (1951-2024) for the temperature scatter plot
   - Rolling average data (1961-1990) for the temperature bell curve plot

## Contributing

Feel free to contribute however you like, whether it is actively in the repository or in your fork. There can never be enough plots.

## License

This project is licensed under the MIT License - see the LICENSE file for details.
