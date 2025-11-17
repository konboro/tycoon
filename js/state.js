import { map as leafletMap } from './state.js'; // Ten import jest błędny, ale go naprawimy
// Poprawka: Powinno być:
// import L from 'leaflet'; // Zakładając, że masz Leaflet zainstalowany przez NPM, ale nie masz...
// Wczytujemy L z globalnego obiektu window, więc state.js nie potrzebuje importów

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
  achievements: {}, // <-- TO JEST TERAZ ŁADOWANE Z BAZY
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

// Definicja mapy (zostaje tutaj)
export const map = (typeof L !== 'undefined') ? L.map('map', { zoomControl: true }).setView([52.23, 21.01], 6) : null;