import { state, map } from './state.js';
import { $ } from './utils.js';
//import { fetchPlanes, fetchBUS, fetchTUBE, fetchFI, fetchEnergyPrices, fetchGlobalTakenVehicles, updateVehiclesWithWeather } from './api.js';

import { fetchAllVehicles, fetchEnergyPrices, fetchGlobalTakenVehicles, forceRefreshVehicles, autoRefreshIfNeeded, getApiStatus } from './api-server.js';
import { updateVehiclesWithWeather } from './api.js';

import { 
    tickEconomy, 
    tickAllInfrastructure, 
    tickGuilds, 
    generateAIPlayers, 
    logDailyEarnings, 
    updateRankings 
} from './logic.js';

import { 
    render, 
    updateUI, 
    showPlayerLocation, 
    redrawMap 
} from './ui-core.js';

import { setupEventListeners } from './ui.js';
import { handleLogin, handleRegister } from './supabase.js';

// --- POPRAWKA JEST TUTAJ ---
// Usunąłem błędny fragment "/512" z adresu URL.
const MAP_KEY = 'gVLyar0EiT75LpMPvAGQ';
const MAP_URL = `https://api.maptiler.com/maps/streets-v2-dark/{z}/{x}/{y}.png?key=${MAP_KEY}`;

L.tileLayer(MAP_URL, { 
    attribution: '<a href="https://www.maptiler.com/copyright/" target="_blank">&copy; MapTiler</a>',
    // Te opcje są poprawne i muszą zostać, aby mapa działała z kafelkami 512px
    tileSize: 512, 
    zoomOffset: -1, 
    
    maxZoom: 22,
    minZoom: 0, 
    crossOrigin: true
}).addTo(map);
// --- KONIEC POPRAWKI ---


// Tworzymy warstwę dla budynków
map.createPane('buildingsPane');
map.getPane('buildingsPane').style.zIndex = 650;

map.on('zoomend', () => {
    redrawMap();
});

async function init() {
  console.log("Gra startuje...");
  
  const loginBtn = $('btn-login');
  const regBtn = $('btn-register');
  if(loginBtn) loginBtn.addEventListener('click', handleLogin);
  if(regBtn) regBtn.addEventListener('click', handleRegister);

  generateAIPlayers(); 
  setupEventListeners();
  showPlayerLocation();
  
try {
    await fetchAllVehicles();
    await fetchEnergyPrices();
    console.log("✅ Loaded vehicle data from server cache");
} catch (e) { 
    console.warn("Server API Error:", e); 
}

  await fetchGlobalTakenVehicles();
  
    // Update the periodic refresh:
    setInterval(async () => {
        console.log("⏰ Auto-refresh check...");
        await autoRefreshIfNeeded();
        await fetchGlobalTakenVehicles();
        updateVehiclesWithWeather(state.vehicles.plane);
        render();
    }, 5 * 60 * 1000); // 5 minutes instead of 1 minute

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