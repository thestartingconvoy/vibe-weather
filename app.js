const app = document.querySelector("#app");
const checkButton = document.querySelector("#checkButton");
const buttonText = document.querySelector("#buttonText");
const errorMessage = document.querySelector("#errorMessage");
const resetButton = document.querySelector("#resetButton");
const unitSwitch = document.querySelector("#unitSwitch");

let unit = "celsius";
let currentForecast = null;

const weatherMap = {
  0: ["Clear skies", "Clear and easygoing for the next few hours.", "clear"],
  1: ["Soft sunshine", "Bright spells with just a little cloud cover.", "clear"],
  2: ["Partly cloudy", "A gentle mix of sun and passing clouds.", "cloud"],
  3: ["Cloudy calm", "Overcast, but settled through the next few hours.", "cloud"],
  45: ["Misty", "Visibility may soften as fog drifts through.", "cloud"],
  48: ["Frosty fog", "Low cloud and fog may linger for a while.", "cloud"],
  51: ["Light drizzle", "A little drizzle is possible. Nothing too dramatic.", "rain"],
  53: ["Drizzly", "Keep a light layer handy for passing drizzle.", "rain"],
  55: ["Steady drizzle", "Damp conditions are likely to hang around.", "rain"],
  61: ["Light rain", "A few light showers are moving through.", "rain"],
  63: ["Rainy", "Rain is likely to stay with you for a while.", "rain"],
  65: ["Heavy rain", "Expect a wet few hours. An umbrella earns its keep.", "rain"],
  71: ["Light snow", "A soft dusting of snow may pass through.", "snow"],
  73: ["Snowy", "Snow is likely over the next few hours.", "snow"],
  75: ["Heavy snow", "Conditions may turn wintry and slow.", "snow"],
  80: ["Passing showers", "Brief showers are nearby, with breaks between.", "rain"],
  81: ["Showery", "On-and-off rain is likely for the next few hours.", "rain"],
  82: ["Heavy showers", "A burst of heavy rain could arrive soon.", "rain"],
  95: ["Thunder nearby", "Storm energy is building. Stay weather-aware.", "rain"],
  96: ["Stormy", "Thunderstorms with hail are possible.", "rain"],
  99: ["Severe storms", "Strong thunderstorms and hail may move through.", "rain"],
};

function weatherDetails(code) {
  return weatherMap[code] || ["Changing skies", "Conditions are shifting over the next few hours.", "cloud"];
}

function getPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not supported."));
      return;
    }

    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: false,
      timeout: 9000,
      maximumAge: 300000,
    });
  });
}

async function fetchForecast(latitude, longitude) {
  const params = new URLSearchParams({
    latitude,
    longitude,
    current: "temperature_2m,weather_code,is_day,wind_speed_10m",
    hourly: "temperature_2m,precipitation_probability,weather_code,apparent_temperature",
    forecast_days: "2",
    timezone: "auto",
  });

  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
  if (!response.ok) throw new Error("Weather service is unavailable.");
  return response.json();
}

async function fetchLocationName(latitude, longitude) {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=10`
    );
    if (!response.ok) throw new Error();
    const data = await response.json();
    return (
      data.address.city ||
      data.address.town ||
      data.address.village ||
      data.address.county ||
      "Your location"
    );
  } catch {
    return "Your location";
  }
}

function getNextHours(data) {
  const now = new Date(data.current.time).getTime();
  let start = data.hourly.time.findIndex((time) => new Date(time).getTime() >= now);
  if (start < 0) start = 0;

  return data.hourly.time.slice(start, start + 4).map((time, index) => ({
    time,
    temperature: data.hourly.temperature_2m[start + index],
    apparent: data.hourly.apparent_temperature[start + index],
    rainChance: data.hourly.precipitation_probability[start + index],
    code: data.hourly.weather_code[start + index],
  }));
}

function displayTemperature(celsius) {
  return Math.round(unit === "celsius" ? celsius : celsius * 1.8 + 32);
}

function formatHour(time, index) {
  if (index === 0) return "Now";
  return new Intl.DateTimeFormat([], { hour: "numeric" }).format(new Date(time));
}

function createChart(hours) {
  const values = hours.map((hour) => hour.temperature);
  const min = Math.min(...values) - 1;
  const max = Math.max(...values) + 1;
  const range = max - min || 1;
  const width = 360;
  const top = 14;
  const height = 53;
  const points = values.map((value, index) => ({
    x: 8 + index * ((width - 16) / (values.length - 1)),
    y: top + (1 - (value - min) / range) * height,
  }));

  const line = points.reduce((path, point, index) => {
    if (index === 0) return `M ${point.x} ${point.y}`;
    const previous = points[index - 1];
    const midX = (previous.x + point.x) / 2;
    return `${path} C ${midX} ${previous.y}, ${midX} ${point.y}, ${point.x} ${point.y}`;
  }, "");

  document.querySelector("#chartLine").setAttribute("d", line);
  document
    .querySelector("#chartArea")
    .setAttribute("d", `${line} L ${points.at(-1).x} 82 L ${points[0].x} 82 Z`);

  document.querySelector("#chartPoints").innerHTML = points
    .map(
      (point, index) =>
        `<span class="chart-point" style="left:${(point.x / width) * 100}%;top:${point.y}px;animation-delay:${0.8 + index * 0.18}s"></span>`
    )
    .join("");
}

function buildInsight(hours, wind) {
  const maxRain = Math.max(...hours.map((hour) => hour.rainChance || 0));
  const startTemp = hours[0].temperature;
  const endTemp = hours.at(-1).temperature;
  const delta = Math.round(Math.abs(endTemp - startTemp));

  if (maxRain >= 60) return `Rain chance climbs to ${maxRain}%. An umbrella is the smart move.`;
  if (wind >= 30) return `Breezy outside at ${Math.round(wind)} km/h. Secure anything light.`;
  if (endTemp - startTemp >= 2) return `It warms by about ${delta}° soon. You can lose a layer.`;
  if (startTemp - endTemp >= 2) return `It cools by about ${delta}° soon. Bring a light layer.`;
  return "Conditions stay remarkably steady. Your next few hours look easy.";
}

function renderForecast(data, locationName) {
  const hours = getNextHours(data);
  currentForecast = { data, locationName, hours };
  const [label, summary, type] = weatherDetails(data.current.weather_code);

  app.classList.remove("weather-rain", "weather-night");
  if (type === "rain" || type === "snow") app.classList.add("weather-rain");
  if (data.current.is_day === 0) app.classList.add("weather-night");

  document.querySelector("#location").textContent = locationName;
  document.querySelector("#temperatureValue").textContent = displayTemperature(data.current.temperature_2m);
  document.querySelector("#weatherLabel").textContent = label;
  document.querySelector("#weatherSummary").textContent = summary;
  document.querySelector("#insightText").textContent = buildInsight(hours, data.current.wind_speed_10m);
  document.querySelector("#updatedTime").textContent = `Updated ${new Intl.DateTimeFormat([], {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date())}`;

  document.querySelector("#hourly").innerHTML = hours
    .map((hour, index) => {
      const hourType = weatherDetails(hour.code)[2];
      return `
        <article class="hour-card ${index === 0 ? "current" : ""}" style="animation-delay:${0.45 + index * 0.1}s">
          <time>${formatHour(hour.time, index)}</time>
          <div class="mini-icon ${hourType === "rain" || hourType === "snow" ? "rain" : ""}" aria-hidden="true"></div>
          <div class="hour-temp">${displayTemperature(hour.temperature)}°</div>
        </article>
      `;
    })
    .join("");

  createChart(hours);
  app.classList.add("is-revealed");
}

async function checkWeather() {
  checkButton.classList.add("loading");
  checkButton.disabled = true;
  errorMessage.textContent = "";
  buttonText.textContent = "Finding your forecast";

  try {
    const position = await getPosition();
    const { latitude, longitude } = position.coords;
    const [data, locationName] = await Promise.all([
      fetchForecast(latitude, longitude),
      fetchLocationName(latitude, longitude),
    ]);
    renderForecast(data, locationName);
  } catch (error) {
    try {
      const fallback = await fetchForecast(40.7128, -74.006);
      renderForecast(fallback, "New York");
    } catch {
      errorMessage.textContent = "Couldn’t reach the forecast. Please try again.";
    }
  } finally {
    checkButton.classList.remove("loading");
    checkButton.disabled = false;
    buttonText.textContent = "Check weather";
  }
}

checkButton.addEventListener("click", checkWeather);

resetButton.addEventListener("click", () => {
  app.classList.remove("is-revealed", "weather-rain", "weather-night");
  currentForecast = null;
});

unitSwitch.addEventListener("click", () => {
  unit = unit === "celsius" ? "fahrenheit" : "celsius";
  document.querySelectorAll(".unit-option").forEach((option) => {
    option.classList.toggle("active", option.dataset.unit === unit);
  });
  if (currentForecast) {
    renderForecast(currentForecast.data, currentForecast.locationName);
  }
});
