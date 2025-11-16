import { state, map } from './state.js';
import { $ } from './utils.js';
import { fetchPlanes, fetchBUS, fetchTUBE, fetchFI, fetchEnergyPrices, fetchGlobalTakenVehicles, updateVehiclesWithWeather } from './api.js';

// IMPORT Z LOGIC.JS (TERAZ POPRAWNY)
import { tickEconomy, tickAllInfrastructure, tickGuilds, generateAIPlayers, logDailyEarnings, updateRankings } from './logic.js';

import { render, updateUI, showPlayerLocation, redrawMap } from './ui-core.js';
import { setupEventListeners } from './ui.js';
import { handleLogin, handleRegister } from './supabase.js';

// KONFIGURACJA MAPY (MapTiler)
const MAP_KEY = 'gVLyar0EiT75LpMPvAGQ';
const MAP_URL = `https://api.maptiler.com/maps/satellite/{z}/{x}/{y}.jpg?key=${MAP_KEY}`;

L.tileLayer(MAP_URL, { 
    attribution: '<a href="https://www.maptiler.com/copyright/" target="_blank">&copy; MapTiler</a>',
    tileSize: 512, 
    zoomOffset: -1, 
    maxZoom: 20,
    crossOrigin: true
}).addTo(map);

map.on('zoomend', () => { redrawMap(); });

async function init() {
  console.log("Gra startuje...");
  
  const loginBtn = $('btn-login');
  const regBtn = $('btn-register');
  if(loginBtn) loginBtn.addEventListener('click', handleLogin);
  if(regBtn) regBtn.addEventListener('click', handleRegister);

  // TERAZ TA FUNKCJA JEST W LOGIC.JS
  generateAIPlayers();
  
  setupEventListeners();
  showPlayerLocation();
  
  try {
      await Promise.all([fetchPlanes(), fetchBUS(), fetchTUBE(), fetchFI(), fetchEnergyPrices()]);
  } catch (e) { console.warn("API Error:", e); }

  await fetchGlobalTakenVehicles();
  
  setInterval(() => {
      fetchPlanes(); fetchBUS(); fetchTUBE(); fetchFI();
      updateVehiclesWithWeather(state.vehicles.plane);
      fetchGlobalTakenVehicles();
      render();
  }, 60000);

  setInterval(tickEconomy, 60000);
  setInterval(tickGuilds, 60000);
  setInterval(() => { logDailyEarnings(); updateRankings(); }, 300000);
  setTimeout(tickEconomy, 3000);
  
  tickAllInfrastructure();
  setInterval(tickAllInfrastructure, 90000);
  
  updateRankings();
  render();
}

document.addEventListener('DOMContentLoaded', init);