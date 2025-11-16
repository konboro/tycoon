// js/main.js - WERSJA Z MAPTILER (SATELLITE)
import { state, map } from './state.js'; // Importujemy mapę ze state.js, żeby uniknąć błędów "addLayer"
import { $ } from './utils.js';
import { fetchPlanes, fetchBUS, fetchTUBE, fetchFI, fetchEnergyPrices, fetchGlobalTakenVehicles, updateVehiclesWithWeather } from './api.js';
import { tickEconomy, tickAllInfrastructure } from './logic.js';
import { setupEventListeners, render, updateUI, showPlayerLocation, generateAIPlayers, logDailyEarnings, updateRankings, redrawMap } from './ui.js';
import { handleLogin, handleRegister } from './supabase.js';

// KONFIGURACJA MAPY (MapTiler Satellite)
// Używamy formatu Raster XYZ (.jpg), bo to Leaflet
const MAP_KEY = 'gVLyar0EiT75LpMPvAGQ';
const MAP_URL = `https://api.maptiler.com/maps/satellite/{z}/{x}/{y}.jpg?key=${MAP_KEY}`;

L.tileLayer(MAP_URL, { 
    attribution: '<a href="https://www.maptiler.com/copyright/" target="_blank">&copy; MapTiler</a> <a href="https://www.openstreetmap.org/copyright" target="_blank">&copy; OpenStreetMap contributors</a>',
    tileSize: 512, 
    zoomOffset: -1, 
    maxZoom: 20, // Satelita zazwyczaj ma max zoom ok. 20
    crossOrigin: true
}).addTo(map);

// Nasłuchiwanie zoomu dla dynamicznych ikon (jeśli wdrożyłeś skalowanie)
map.on('zoomend', () => {
    redrawMap();
});

async function init() {
  console.log("Gra startuje...");
  
  // Obsługa guzików logowania
  const loginBtn = $('btn-login');
  const regBtn = $('btn-register');
  if(loginBtn) loginBtn.addEventListener('click', handleLogin);
  if(regBtn) regBtn.addEventListener('click', handleRegister);

  // Inicjalizacja mechanik
  generateAIPlayers();
  setupEventListeners();
  showPlayerLocation();
  
  // Pierwsze pobranie danych z API
  try {
      await Promise.all([
          fetchPlanes(), 
          fetchBUS(), 
          fetchTUBE(), 
          fetchFI(), 
          fetchEnergyPrices()
      ]);
  } catch (e) {
      console.warn("Niektóre dane API nie zostały pobrane:", e);
  }

  await fetchGlobalTakenVehicles();
  
  // PĘTLE GRY (LOOPS)
  
  // 1. Odświeżanie pozycji pojazdów (co 60s)
  setInterval(() => {
      fetchPlanes(); 
      fetchBUS(); 
      fetchTUBE(); 
      fetchFI();
      updateVehiclesWithWeather(state.vehicles.plane);
      fetchGlobalTakenVehicles();
      render();
  }, 60000);

  // 2. Ekonomia (co 60s)
  setInterval(tickEconomy, 60000);
  
  // 3. Długie interwały (Zarobki dzienne, rankingi - co 5 min)
  setInterval(() => { 
      logDailyEarnings(); 
      updateRankings(); 
  }, 300000);
  
  // Start ekonomii po 3 sekundach (żeby dane zdążyły się załadować)
  setTimeout(tickEconomy, 3000);
  
  // 4. Infrastruktura (Stacje - co 90s)
  tickAllInfrastructure();
  setInterval(tickAllInfrastructure, 90000);
  
  updateRankings();
  render(); // Pierwsze narysowanie interfejsu
}

document.addEventListener('DOMContentLoaded', init);