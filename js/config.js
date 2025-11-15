export const PROXIES = ['','https://cors.isomorphic-git.org/','https://api.allorigins.win/raw?url='];
export const config = {
  baseRate: { plane: 45, train: 8, tube: 7, bus: 5, bike: 1, 'river-bus': 12, tram: 6 },
  basePrice: { plane: 60000, train: 15000, tube: 12000, bus: 4000, bike: 700, 'river-bus': 9000, tram: 10000 },
  fuelConsumption: { plane: 350, train: 0, tube: 0, bus: 38, bike: 0, 'river-bus': 55, tram: 0 },
  energyConsumption: { train: 1400, tube: 900, tram: 300 },
  estimatedDailyKm: { plane: 5000, train: 1000, tube: 800, bus: 600, bike: 100, 'river-bus': 200, tram: 500 },
  vehicleDetails: {
      plane: { power: '50,000 KM', maxSpeed: '900 km/h', avgSpeed: '750 km/h' },
      train: { power: '8,000 KM', maxSpeed: '250 km/h', avgSpeed: '120 km/h' },
      tube: { power: '1,500 KM', maxSpeed: '100 km/h', avgSpeed: '45 km/h' },
      bus: { power: '300 KM', maxSpeed: '100 km/h', avgSpeed: '40 km/h' },
      bike: { power: '0.5 KM', maxSpeed: '25 km/h', avgSpeed: '15 km/h' },
      'river-bus': { power: '1,000 KM', maxSpeed: '50 km/h', avgSpeed: '25 km/h' },
      tram: { power: '600 KM', maxSpeed: '70 km/h', avgSpeed: '30 km/h' }
  },
  infrastructure: {
      HKI: { name: "Dworzec Główny (Helsinki)", price: 7500000, lat: 60.1719, lon: 24.9414, type: 'train', apiId: 'HKI', rarity: 'epic', estimatedIncome: 12000 },
      TPE: { name: "Dworzec Kolejowy (Tampere)", price: 6000000, lat: 61.4981, lon: 23.7749, type: 'train', apiId: 'TPE', rarity: 'rare', estimatedIncome: 9000 },
      VIC: { name: "Victoria Station (Metro)", price: 8000000, lat: 51.4966, lon: -0.1449, type: 'tube', apiId: '940GZZLUVIC', rarity: 'epic', estimatedIncome: 15000 },
      SOU: { name: "South Station Bus Terminal", price: 5000000, lat: 42.3523, lon: -71.0553, type: 'bus', apiId: 'place-sstat', rarity: 'rare', estimatedIncome: 7500 },
      VCS: { name: "Victoria Coach Station", price: 6500000, lat: 51.4926, lon: -0.1495, type: 'bus', apiId: '490000248A', rarity: 'rare', estimatedIncome: 10000 },
      TFS: { name: "Trafalgar Square", price: 4000000, lat: 51.5080, lon: -0.1281, type: 'bus', apiId: '490001249Z', rarity: 'common', estimatedIncome: 5000 },
      WSP: { name: "Westminster Pier", price: 3000000, lat: 51.5015, lon: -0.1245, type: 'river-bus', apiId: '940GZZLUWSP', rarity: 'common', estimatedIncome: 6000 },
      LCC: { name: "IFS Cloud Cable Car", price: 12000000, lat: 51.5008, lon: 0.0052, type: 'cable', apiId: 'emirates-air-line', rarity: 'legendary', estimatedIncome: 20000 }
  },
  upgrade: {
    costs: [0, 50000, 150000, 500000, 2000000], kms: [0, 100, 500, 2000, 5000],
    bonus: [1, 1.25, 1.6, 2.0, 2.5], efficiencyBonus: [1, 0.95, 0.88, 0.80, 0.70]
  },
  guilds: { creationCost: 5000000 },
  guildAssets: {
      BEL: { name: "Elektrownia Bełchatów", country: "PL", price: 250000000, incomePerTick: 11000, realProduction: "22 TWh/rok", lat: 51.28, lon: 19.33, description: "Największa elektrownia węglowa w Europie." },
      KOZ: { name: "Elektrownia Kozienice", country: "PL", price: 150000000, incomePerTick: 6500, realProduction: "14 TWh/rok", lat: 51.62, lon: 21.58, description: "Jedna z największych elektrowni w Polsce." },
      NEU: { name: "Elektrownia Neurath", country: "DE", price: 300000000, incomePerTick: 15000, realProduction: "30 TWh/rok", lat: 51.02, lon: 6.61, description: "Potężna elektrownia w Niemczech." },
      JAN: { name: "Elektrownia Jänschwalde", country: "DE", price: 180000000, incomePerTick: 10000, realProduction: "20 TWh/rok", lat: 51.83, lon: 14.43, description: "Ważny element niemieckiej sieci energetycznej." }
  }
};
export const lootboxConfig = {
  common: { cost: 25000, name: "Zwykła Skrzynka", icon: "📦", description: "Duża szansa na zwykłe i rzadkie pojazdy.", drops: { common: 0.8, rare: 0.18, epic: 0.02, legendary: 0 } },
  rare: { cost: 100000, name: "Rzadka Skrzynka", icon: "📫", description: "Gwarantowany rzadki pojazd lub lepszy.", drops: { common: 0, rare: 0.7, epic: 0.25, legendary: 0.05 } },
  epic: { cost: 500000, name: "Epicka Skrzynka", icon: "📮", description: "Gwarantowany epicki pojazd lub lepszy.", drops: { common: 0, rare: 0, epic: 0.8, legendary: 0.2 } },
  train_pack: { cost: 75000, name: "Paczka Kolejowa", icon: "🚂", type: 'train', drops: { common: 0, rare: 0.8, epic: 0.18, legendary: 0.02 } },
  plane_pack: { cost: 300000, name: "Paczka Lotnicza", icon: "✈️", type: 'plane', drops: { legendary: 1.0 } },
  bus_pack: { cost: 20000, name: "Paczka Autobusowa", icon: "🚌", type: 'bus', drops: { common: 1.0 } },
  tube_pack: { cost: 80000, name: "Paczka Metra", icon: "🚇", type: 'tube', drops: { common: 0, rare: 0.7, epic: 0.25, legendary: 0.05 } }
};
export const countryCoords = { Poland: { lat: 52.23, lon: 21.01 }, USA: { lat: 39.09, lon: -94.57 }, Finland: { lat: 60.16, lon: 24.93 }, UK: { lat: 51.50, lon: -0.12 }, Europe: { lat: 52.52, lon: 13.40 } };
export const genericWeather = { temperature: 15, weathercode: 3 };