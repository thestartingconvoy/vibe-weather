# Afterglow Weather

A premium, mobile-first four-hour weather experience. Afterglow uses native browser geolocation and the free Open-Meteo API, so there are no API keys or environment variables to configure.

## Run locally

Serve the folder with any static file server, then open it in a browser:

```bash
npx serve .
```

## Deploy

Import the repository into Vercel. The included `vercel.json` is all the configuration required.

## Data and privacy

- Forecasts: [Open-Meteo](https://open-meteo.com/)
- Place names: [OpenStreetMap Nominatim](https://nominatim.openstreetmap.org/)
- Location is requested by the browser and sent directly to the forecast APIs.
- If location access is unavailable, the app demonstrates the experience with a New York forecast.
