const GEOCODING_API =
  "https://geocoding-api.open-meteo.com/v1/search";

const WEATHER_API =
  "https://api.open-meteo.com/v1/forecast";

const weatherCodeMap = {
  0: "Clear sky",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Depositing rime fog",
  51: "Light drizzle",
  53: "Moderate drizzle",
  55: "Dense drizzle",
  56: "Light freezing drizzle",
  57: "Dense freezing drizzle",
  61: "Slight rain",
  63: "Moderate rain",
  65: "Heavy rain",
  66: "Light freezing rain",
  67: "Heavy freezing rain",
  71: "Slight snow fall",
  73: "Moderate snow fall",
  75: "Heavy snow fall",
  77: "Snow grains",
  80: "Slight rain showers",
  81: "Moderate rain showers",
  82: "Violent rain showers",
  85: "Slight snow showers",
  86: "Heavy snow showers",
  95: "Thunderstorm",
  96: "Thunderstorm with slight hail",
  99: "Thunderstorm with heavy hail",
};

const getWeather = async ({
  location,
  forecastDays = 1,
}) => {
  if (!location || typeof location !== "string") {
    throw new Error("Location is required");
  }

  const safeForecastDays = Math.min(
    Math.max(Number(forecastDays) || 1, 1),
    7,
  );

  const locationQuery = location.trim();

  const geocodingUrl =
    `${GEOCODING_API}?name=${encodeURIComponent(locationQuery)}` +
    `&count=1&language=en&format=json`;

  let geocodingResponse;

  try {
    geocodingResponse = await fetch(geocodingUrl);
  } catch (error) {
    throw new Error("Weather location service is unavailable", { cause: error });
  }

  if (!geocodingResponse.ok) {
    throw new Error("Unable to find the requested location");
  }

  let geocodingData;

  try {
    geocodingData = await geocodingResponse.json();
  } catch (error) {
    throw new Error("Invalid location service response", { cause: error });
  }

  const place = geocodingData?.results?.[0];

  if (!place) {
    throw new Error(`Location not found: ${locationQuery}`);
  }

  const weatherUrl =
    `${WEATHER_API}?latitude=${encodeURIComponent(place.latitude)}` +
    `&longitude=${encodeURIComponent(place.longitude)}` +
    `&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m` +
    `&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code` +
    `&forecast_days=${safeForecastDays}` +
    `&timezone=auto`;

  let weatherResponse;

  try {
    weatherResponse = await fetch(weatherUrl);
  } catch (error) {
    throw new Error("Weather service is unavailable", { cause: error });
  }

  if (!weatherResponse.ok) {
    throw new Error("Unable to fetch weather data");
  }

  let weatherData;

  try {
    weatherData = await weatherResponse.json();
  } catch (error) {
    throw new Error("Invalid weather service response", { cause: error });
  }

  const current = weatherData?.current;
  const daily = weatherData?.daily;

  if (!current) {
    throw new Error("Weather data is unavailable");
  }

  const dailyForecast = (daily?.time || []).map((date, index) => ({
    date,
    condition:
      weatherCodeMap[daily?.weather_code?.[index]] ||
      "Unknown",
    temperatureMax: daily?.temperature_2m_max?.[index],
    temperatureMin: daily?.temperature_2m_min?.[index],
    precipitation:
      daily?.precipitation_sum?.[index],
  }));

  return {
    location: {
      name: place.name,
      country: place.country,
      countryCode: place.country_code,
      latitude: place.latitude,
      longitude: place.longitude,
    },

    timezone: weatherData.timezone,

    current: {
      temperature: current.temperature_2m,
      apparentTemperature:
        current.apparent_temperature,
      humidity:
        current.relative_humidity_2m,
      precipitation:
        current.precipitation,
      windSpeed:
        current.wind_speed_10m,
      condition:
        weatherCodeMap[current.weather_code] ||
        "Unknown",
      time: current.time,
    },

    forecast: dailyForecast,
  };
};

export default getWeather;
