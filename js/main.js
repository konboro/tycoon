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

// KONFIGURACJA MAPY (MapTiler Streets v2 Dark)
const MAP_KEY = 'gVLyar0EiT75LpMPvAGQ';
const MAP_URL = `https://api.maptiler.com/maps/streets-v2-dark/512/{z}/{x}/{y}.png?key=${MAP_KEY}`;

L.tileLayer(MAP_URL, { 
    attribution: '<a href="https://www.maptiler.com/copyright/" target="_blank">&copy; MapTiler</a>',
    tileSize: 512, 
    zoomOffset: -1, 
    maxZoom: 22,
    minZoom: 0, 
    crossOrigin: true
}).addTo(map);

// Tworzymy warstwę dla budynków
map.createPane('buildingsPane');
map.getPane('buildingsPane').style.zIndex = 650;

map.on('zoomend', () => {
    redrawMap();
});


async function init() {
  console.log("Gra startuje...");
  
  // --- POPRAWKA JEST TUTAJ ---
  // Krok 1: Podpinamy przyciski logowania OD RAZU.
  // Dzięki temu logowanie zadziała, nawet jeśli API (samoloty) zawiodą.
  const loginBtn = $('btn-login');
  const regBtn = $('btn-register');
  if(loginBtn) loginBtn.addEventListener('click', handleLogin);
  if(regBtn) regBtn.addEventListener('click', handleRegister);

  // Krok 2: Podpinamy resztę interfejsu
  setupEventListeners();
  // --- KONIEC POPRAWKI ---

  generateAIPlayers(); 
  showPlayerLocation();
  
  // Krok 3: Ładujemy dane z API w tle, z obsługą błędów
  try {
      await Promise.all([
          fetchPlanes(), 
          fetchBUS(), 
          fetchTUBE(), 
          fetchFI(), 
          fetchEnergyPrices()
      ]);
  } catch (e) { 
      console.warn("Nie udało się pobrać niektórych danych API (np. 429). Gra działa dalej.", e);
  }

  await fetchGlobalTakenVehicles();
  
  // Pętle gry
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
  render(); // Pierwszy render (pokaże panel logowania)
}

document.addEventListener('DOMContentLoaded', init);