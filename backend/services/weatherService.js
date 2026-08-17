const axios = require('axios');

const OWM_KEY = process.env.OPENWEATHER_API_KEY;
const OWM_BASE = 'https://api.openweathermap.org/data/2.5';

// Check real weather at store coordinates
async function checkWeatherAtStore(lat, lng) {
  if (!OWM_KEY || OWM_KEY === 'your_openweathermap_api_key') {
    // Demo mode - return mock data
    return mockWeatherData(lat, lng);
  }
  try {
    const [current, forecast] = await Promise.all([
      axios.get(`${OWM_BASE}/weather?lat=${lat}&lon=${lng}&appid=${OWM_KEY}&units=metric`),
      axios.get(`${OWM_BASE}/forecast?lat=${lat}&lon=${lng}&appid=${OWM_KEY}&units=metric&cnt=8`)
    ]);

    const w = current.data;
    const rain1h = w.rain?.['1h'] || 0;
    const rain3h = w.rain?.['3h'] || 0;
    const temp = w.main?.temp || 0;
    const humidity = w.main?.humidity || 0;
    const windSpeed = w.wind?.speed || 0;

    return {
      source: 'OpenWeatherMap Live',
      lat, lng,
      temperature: temp,
      humidity,
      wind_speed: windSpeed,
      rain_1h_mm: rain1h,
      rain_3h_mm: rain3h,
      weather_main: w.weather?.[0]?.main || 'Clear',
      weather_desc: w.weather?.[0]?.description || '',
      city_name: w.name,
      // Trigger checks
      flood_trigger: rain1h >= 13.3 || rain3h >= 40, // 40mm/3h or 13.3mm/1h
      heat_trigger: temp >= 45,
      storm_trigger: windSpeed >= 20,
      raw: w
    };
  } catch (err) {
    console.error('OpenWeatherMap error:', err.message);
    return mockWeatherData(lat, lng);
  }
}

// Check AQI via CPCB mock (real CPCB API requires registration)
async function checkAQIAtStore(city) {
  // Using OpenWeather Air Pollution API (free)
  if (!OWM_KEY || OWM_KEY === 'your_openweathermap_api_key') {
    return { aqi: Math.floor(Math.random() * 200 + 80), source: 'Mock AQI', aqi_trigger: false };
  }
  try {
    // Get coordinates for city center as fallback
    const cityCoords = {
      'Bengaluru': { lat: 12.9716, lng: 77.5946 },
      'Mumbai': { lat: 19.0760, lng: 72.8777 },
      'Delhi': { lat: 28.6139, lng: 77.2090 },
      'Hyderabad': { lat: 17.3850, lng: 78.4867 },
      'Pune': { lat: 18.5204, lng: 73.8567 }
    };
    const coords = cityCoords[city] || cityCoords['Bengaluru'];
    const resp = await axios.get(
      `${OWM_BASE}/air_pollution?lat=${coords.lat}&lon=${coords.lng}&appid=${OWM_KEY}`
    );
    const aqi = resp.data.list?.[0]?.main?.aqi || 1;
    // OWM AQI: 1=Good,2=Fair,3=Moderate,4=Poor,5=Very Poor → scale to CPCB 0-500
    const aqiScaled = aqi * 80;
    return {
      aqi: aqiScaled,
      source: 'OpenWeather Air Pollution API',
      aqi_trigger: aqiScaled >= 300,
      raw_owm_aqi: aqi
    };
  } catch (err) {
    return { aqi: 120, source: 'AQI API Error - fallback', aqi_trigger: false };
  }
}

// Mock weather for demo mode
function mockWeatherData(lat, lng) {
  // Generate realistic-looking data based on coords
  const isKoramangala = Math.abs(lat - 12.935) < 0.01;
  const isDelhi = Math.abs(lat - 28.63) < 0.1;
  return {
    source: 'Demo Mode (add OPENWEATHER_API_KEY for live data)',
    lat, lng,
    temperature: isDelhi ? 38.5 : 28.3,
    humidity: isKoramangala ? 88 : 65,
    wind_speed: 4.2,
    rain_1h_mm: isKoramangala ? 18.5 : 2.1,
    rain_3h_mm: isKoramangala ? 52.0 : 6.3,
    weather_main: isKoramangala ? 'Rain' : 'Clouds',
    weather_desc: isKoramangala ? 'heavy intensity rain' : 'scattered clouds',
    flood_trigger: isKoramangala,
    heat_trigger: isDelhi && false,
    storm_trigger: false
  };
}

// Check all triggers for a store
async function checkAllTriggers(store) {
  const weather = await checkWeatherAtStore(store.lat, store.lng);
  const aqiData = await checkAQIAtStore(store.city);

  const triggers = [];

  if (weather.flood_trigger) {
    triggers.push({
      type: 'flood',
      icon: '🌊',
      label: 'Flash Flood / Heavy Rain',
      evidence: `Rainfall: ${weather.rain_1h_mm}mm/hr at store GPS`,
      source: weather.source,
      severity: Math.min(100, (weather.rain_1h_mm / 13.3) * 50 + 50),
      payout_pct: weather.rain_1h_mm >= 20 ? 100 : 60
    });
  }

  if (weather.heat_trigger) {
    triggers.push({
      type: 'heat',
      icon: '🔥',
      label: 'Extreme Heat Advisory',
      evidence: `Temperature: ${weather.temperature}°C at store location`,
      source: weather.source,
      severity: 75,
      payout_pct: 75
    });
  }

  if (aqiData.aqi_trigger) {
    triggers.push({
      type: 'aqi',
      icon: '😷',
      label: 'Severe Air Pollution',
      evidence: `AQI: ${aqiData.aqi} (threshold: 300)`,
      source: aqiData.source,
      severity: 50,
      payout_pct: 50
    });
  }

  return { weather, aqi: aqiData, active_triggers: triggers };
}

module.exports = { checkWeatherAtStore, checkAQIAtStore, checkAllTriggers };
