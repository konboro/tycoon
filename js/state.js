// js/state.js - WERSJA KOMPLETNA
import { showNotification } from './utils.js';
import { updateUI } from './ui-core.js';
import { fmt } from './utils.js'; // Dodany import fmt dla powiadomień

// ===== GŁÓWNY OBIEKT STANU =====
export const state = {
  vehicles: { plane: new Map(), train: new Map(), tube: new Map(), bus: new Map(), bike: new Map(), 'river-bus': new Map(), tram: new Map() },
  profile: { companyName: null, logo: '🏢', color: 'blue', level: 1, xp: 0, km_total: 0, total_earned: 0, reputation: {}, minutes_in_transit: 0, earnings_history: [], dailyEarningsHistory: [], services_done: 0, upgrades_done: 0, transaction_history: [], friends: [] },
  wallet: 900000000,
  owned: {},
  economy: { energyPrices: {} },
  marketListings: [],
  rankings: { assetValue: [], weeklyEarnings: [] },
  lastDayCheck: new Date().toISOString().slice(0, 10),
  infrastructure: {
      trainStations: { HKI: { owned: false, totalEarnings: 0, arrivals: 0, departures: 0, hourlyEarnings: 0, earningsLog: [] }, TPE: { owned: false, totalEarnings: 0, arrivals: 0, departures: 0, hourlyEarnings: 0, earningsLog: [] } },
      tubeStations: { VIC: { owned: false, totalEarnings: 0, arrivals: 0, hourlyEarnings: 0, earningsLog: [] } },
      busTerminals: { SOU: { owned: false, totalEarnings: 0, arrivals: 0, hourlyEarnings: 0, earningsLog: [] } },
      riverPiers: { WSP: { owned: false, totalEarnings: 0, arrivals: 0, hourlyEarnings: 0, earningsLog: [] } },
      cableCar: { LCC: { owned: false, totalEarnings: 0, status: 'Unknown', hourlyEarnings: 0, earningsLog: [] } }
  },
  guild: { playerGuildId: null, guilds: {} },
  trainLog: {}, tubeLog: {}, busLog: {}, riverBusLog: {},
  stationData: { HKI: [], TPE: [], VIC: [], SOU: [], LCC: [], WSP: [] },
  lastPos: new Map(),
  globalTaken: new Set(),
  achievements: {}, // Ładowane z Supabase
  marketDemand: {},
  filters: { types: ['plane', 'train', 'tube', 'tram', 'bus', 'bike', 'river-bus'], countries: ['Poland', 'USA', 'Finland', 'UK', 'Europe'], rarities: ['common', 'rare', 'epic', 'legendary'], mapView: 'all' },
  activeTab: null,
  selectedVehicleKey: null, selectedStationId: null,
  markers: new Map(), weatherCache: new Map(), countryWeatherCache: new Map(),
  charts: {}, assetChart: null,
  playerMarker: null,
  playerLocation: null,
  proximityCircle: null
};

// ===== DEFINICJA MAPY =====
export const map = (typeof L !== 'undefined') ? L.map('map', { zoomControl: true }).setView([52.23, 21.01], 6) : null;

// ===== OSIĄGNIĘCIA I LOGIKA STANU (BRAKOWAŁO TEGO) =====

export const achievementsList = {
  FIRST_PURCHASE: { title: "Pierwszy zakup", description: "Kup swój pierwszy pojazd.", reward: { vc: 1000, xp: 50 }, check: () => Object.keys(state.owned).length >= 1 },
  TEN_VEHICLES: { title: "Mała flota", description: "Posiadaj 10 pojazdów.", reward: { vc: 5000, xp: 200 }, check: () => Object.keys(state.owned).length >= 10 },
  FIFTY_VEHICLES: { title: "Prawdziwy Magnat", description: "Posiadaj 50 pojazdów.", reward: { vc: 25000, xp: 1000 }, check: () => Object.keys(state.owned).length >= 50 },
  EARN_100K: { title: "Pierwsze 100 tysięcy", description: "Zarób łącznie 100,000 VC.", reward: { vc: 10000, xp: 500 }, check: () => state.profile.total_earned >= 100000 },
  FIRST_MILLION: { title: "Pierwszy Milion", description: "Zarób łącznie 1,000,000 VC.", reward: { vc: 100000, xp: 2500 }, check: () => state.profile.total_earned >= 1000000 },
  LEVEL_5: { title: "Weteran", description: "Osiągnij 5 poziom.", reward: { vc: 10000, xp: 0 }, check: () => state.profile.level >= 5 },
  STATION_OWNER: { title: "Baron Kolejowy", description: "Kup swój pierwszy dworzec.", reward: { vc: 750000, xp: 7500 }, check: () => Object.values(state.infrastructure.trainStations).some(a => a.owned) },
  FINNISH_RAIL_LORD: { title: "Władca Finlandii", description: "Posiadaj oba dworce w Finlandii.", reward: { vc: 2500000, xp: 10000 }, check: () => state.infrastructure.trainStations.HKI.owned && state.infrastructure.trainStations.TPE.owned },
  ONE_THOUSAND_KM: { title: "Tysiąc kilometrów", description: "Przejedź łącznie 1000 km.", reward: { vc: 10000, xp: 250 }, check: () => state.profile.km_total >= 1000 },
  MECHANIC_1: { title: "Mechanik I", description: "Serwisuj pojazdy 10 razy.", reward: { vc: 5000, xp: 100 }, check: () => state.profile.services_done >= 10 },
  FIRST_UPGRADE: { title: "Pierwsze ulepszenie", description: "Ulepsz dowolny pojazd.", reward: { vc: 10000, xp: 200 }, check: () => state.profile.upgrades_done >= 1 },
  MAX_OUT_VEHICLE: { title: "Maksymalna moc", description: "Ulepsz dowolny pojazd do maks. poziomu.", reward: { vc: 100000, xp: 2000 }, check: () => Object.values(state.owned).some(v => v.level >= 5) },
};

export function logTransaction(amount, description) { 
    if (!state.profile.transaction_history) state.profile.transaction_history = []; 
    state.profile.transaction_history.unshift({ amount, description, timestamp: new Date().toISOString(), balance: state.wallet }); 
    if (state.profile.transaction_history.length > 200) state.profile.transaction_history.pop(); 
}

export function checkAchievements() { 
    for (const key in achievementsList) { 
        if (!state.achievements[key] && achievementsList[key].check()) { 
            state.achievements[key] = { unlocked: true, claimed: false, date: new Date().toISOString() }; 
            showNotification(`🏆 Osiągnięcie: ${achievementsList[key].title}`);
        } 
    } 
    updateUI(); 
}

export function checkLevelUp() { 
    function xpNeededForLevel(level) { return 100 + (level - 1) * 50; } 
    while (state.profile.xp >= xpNeededForLevel(state.profile.level)) { 
        state.profile.xp -= xpNeededForLevel(state.profile.level); 
        state.profile.level++; 
        showNotification(`⭐ Awans na poziom ${state.profile.level}!`);
    } 
}