import { state } from './state.js';
import { $ } from './utils.js';
import { fetchPlanes, fetchBUS, fetchTUBE, fetchFI, fetchEnergyPrices, fetchGlobalTakenVehicles, updateVehiclesWithWeather } from './api.js';
import { tickEconomy, tickAllInfrastructure } from './logic.js';
import { setupEventListeners, render, updateUI, showPlayerLocation, generateAIPlayers, logDailyEarnings, updateRankings, redrawMap } from './ui.js';
import { handleLogin, handleRegister } from './supabase.js';

export const map = L.map('map', { zoomControl: true }).setView([52.23, 21.01], 6);
L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { attribution: '&copy; OSM &copy; CARTO', maxZoom: 19 }).addTo(map);

async function init() {
  console.log("Gra startuje...");
  $('btn-login').addEventListener('click', handleLogin);
  $('btn-register').addEventListener('click', handleRegister);

  generateAIPlayers();
  setupEventListeners();
  showPlayerLocation();
  
  await Promise.all([fetchPlanes(), fetchBUS(), fetchTUBE(), fetchFI(), fetchEnergyPrices()]);
  await fetchGlobalTakenVehicles();
  
  setInterval(() => {
      fetchPlanes(); fetchBUS(); fetchTUBE(); fetchFI();
      updateVehiclesWithWeather(state.vehicles.plane);
      fetchGlobalTakenVehicles();
      render();
  }, 120000);

  setInterval(tickEconomy, 60000);
  setInterval(() => { logDailyEarnings(); updateRankings(); }, 60000 * 5);
  setTimeout(tickEconomy, 3000);
  
  // Start Infrastructure Ticks
  tickAllInfrastructure();
  setInterval(tickAllInfrastructure, 90000);
  
  updateRankings();
}

document.addEventListener('DOMContentLoaded', init);