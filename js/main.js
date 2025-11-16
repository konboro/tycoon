import { state, map } from './state.js';
import { $ } from './utils.js';
import { fetchPlanes, fetchBUS, fetchTUBE, fetchFI, fetchEnergyPrices, fetchGlobalTakenVehicles, updateVehiclesWithWeather } from './api.js';

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

const MAP_KEY = 'gVLyar0EiT75LpMPvAGQ';
const MAP_URL = `https://api.maptiler.com/maps/streets-v4/512/{z}/{x}/{y}.png?key=${MAP_KEY}`;

L.tileLayer(MAP_URL, { 
    attribution: '<a href="https://www.maptiler.com/copyright/" target="_blank">&copy; MapTiler</a>',
    tileSize: 512, 
    zoomOffset: -1, 
    maxZoom: 22,
    
    // --- TO JEST POPRAWKA ---
    // Nie pozwala Leafletowi prosić o kafelki na zoomie -1
    minZoom: 0,
    // -------------------------

    crossOrigin: true
}).addTo(map);

// Tworzymy warstwę dla budynków (z-index wyżej niż pojazdy)
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