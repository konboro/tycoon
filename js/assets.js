// js/assets.js - Centralized Asset Configuration
// This file contains all asset definitions for easy editing and maintenance

// Vehicle asset icons and metadata
export const VEHICLE_ICONS = {
    plane: 'assets/plane.png',
    bus: 'assets/bus.png', 
    train: 'assets/train.png',
    tube: 'assets/tube.png',
    tram: 'assets/tram.png',
    bike: '🚲',
    'river-bus': 'assets/ship.png'
};

// Infrastructure asset icons
export const INFRASTRUCTURE_ICONS = {
    station_train: 'assets/station.png',
    station_tube: 'assets/station_small.png', 
    station_bus: '🚏',
    station_cable: '🚠',
    'station_river-bus': '⚓'
};

// Guild/Company asset icons
export const COMPANY_ICONS = {
    'asset_power-plant': '⚡️',
    'asset_factory': '🏭',
    'asset_warehouse': '📦',
    'asset_office': '🏢'
};

// Consolidated icon registry
export const ICONS = {
    ...VEHICLE_ICONS,
    ...INFRASTRUCTURE_ICONS,
    ...COMPANY_ICONS
};

// Vehicle specifications and economics
export const VEHICLE_SPECS = {
    plane: {
        baseRate: 45,
        basePrice: 60000,
        fuelConsumption: 350,
        energyConsumption: 0,
        estimatedDailyKm: 5000,
        details: { power: '50,000 KM', maxSpeed: '900 km/h', avgSpeed: '750 km/h' }
    },
    train: {
        baseRate: 8,
        basePrice: 15000,
        fuelConsumption: 0,
        energyConsumption: 1400,
        estimatedDailyKm: 1000,
        details: { power: '8,000 KM', maxSpeed: '250 km/h', avgSpeed: '120 km/h' }
    },
    tube: {
        baseRate: 7,
        basePrice: 12000,
        fuelConsumption: 0,
        energyConsumption: 900,
        estimatedDailyKm: 800,
        details: { power: '1,500 KM', maxSpeed: '100 km/h', avgSpeed: '45 km/h' }
    },
    bus: {
        baseRate: 5,
        basePrice: 4000,
        fuelConsumption: 38,
        energyConsumption: 0,
        estimatedDailyKm: 600,
        details: { power: '300 KM', maxSpeed: '100 km/h', avgSpeed: '40 km/h' }
    },
    bike: {
        baseRate: 1,
        basePrice: 700,
        fuelConsumption: 0,
        energyConsumption: 0,
        estimatedDailyKm: 100,
        details: { power: '0.5 KM', maxSpeed: '25 km/h', avgSpeed: '15 km/h' }
    },
    'river-bus': {
        baseRate: 12,
        basePrice: 9000,
        fuelConsumption: 55,
        energyConsumption: 0,
        estimatedDailyKm: 200,
        details: { power: '1,000 KM', maxSpeed: '50 km/h', avgSpeed: '25 km/h' }
    },
    tram: {
        baseRate: 6,
        basePrice: 10000,
        fuelConsumption: 0,
        energyConsumption: 300,
        estimatedDailyKm: 500,
        details: { power: '600 KM', maxSpeed: '70 km/h', avgSpeed: '30 km/h' }
    }
};

// Infrastructure assets
export const INFRASTRUCTURE_ASSETS = {
    // Train Stations
    HKI: { 
        name: "Dworzec Główny (Helsinki)", 
        price: 7500000, 
        lat: 60.1719, 
        lon: 24.9414, 
        type: 'train', 
        apiId: 'HKI', 
        rarity: 'epic', 
        estimatedIncome: 12000,
        country: 'Finland'
    },
    TPE: { 
        name: "Dworzec Kolejowy (Tampere)", 
        price: 6000000, 
        lat: 61.4981, 
        lon: 23.7749, 
        type: 'train', 
        apiId: 'TPE', 
        rarity: 'rare', 
        estimatedIncome: 9000,
        country: 'Finland'
    },
    
    // Metro/Tube Stations
    VIC: { 
        name: "Victoria Station (Metro)", 
        price: 8000000, 
        lat: 51.4966, 
        lon: -0.1449, 
        type: 'tube', 
        apiId: '940GZZLUVIC', 
        rarity: 'epic', 
        estimatedIncome: 15000,
        country: 'UK'
    },
    
    // Bus Terminals
    SOU: { 
        name: "South Station Bus Terminal", 
        price: 5000000, 
        lat: 42.3523, 
        lon: -71.0553, 
        type: 'bus', 
        apiId: 'place-sstat', 
        rarity: 'rare', 
        estimatedIncome: 7500,
        country: 'USA'
    },
    VCS: { 
        name: "Victoria Coach Station", 
        price: 6500000, 
        lat: 51.4926, 
        lon: -0.1495, 
        type: 'bus', 
        apiId: '490000248A', 
        rarity: 'rare', 
        estimatedIncome: 10000,
        country: 'UK'
    },
    TFS: { 
        name: "Trafalgar Square", 
        price: 4000000, 
        lat: 51.5080, 
        lon: -0.1281, 
        type: 'bus', 
        apiId: '490001249Z', 
        rarity: 'common', 
        estimatedIncome: 5000,
        country: 'UK'
    },
    
    // River Piers
    WSP: { 
        name: "Westminster Pier", 
        price: 3000000, 
        lat: 51.5015, 
        lon: -0.1245, 
        type: 'river-bus', 
        apiId: '940GZZLUWSP', 
        rarity: 'common', 
        estimatedIncome: 6000,
        country: 'UK'
    },
    
    // Cable Car
    LCC: { 
        name: "IFS Cloud Cable Car", 
        price: 12000000, 
        lat: 51.5008, 
        lon: 0.0052, 
        type: 'cable', 
        apiId: 'emirates-air-line', 
        rarity: 'legendary', 
        estimatedIncome: 20000,
        country: 'UK'
    }
};

// Guild/Corporate assets - Industrial buildings and power plants
export const GUILD_ASSETS = {
    BEL: { 
        name: "Elektrownia Bełchatów", 
        country: "Poland", 
        price: 250000000, 
        incomePerTick: 11000, 
        realProduction: "22 TWh/rok", 
        lat: 51.28, 
        lon: 19.33, 
        description: "Największa elektrownia węglowa w Europie.",
        type: 'power-plant'
    },
    KOZ: { 
        name: "Elektrownia Kozienice", 
        country: "Poland", 
        price: 150000000, 
        incomePerTick: 6500, 
        realProduction: "14 TWh/rok", 
        lat: 51.62, 
        lon: 21.58, 
        description: "Jedna z największych elektrowni w Polsce.",
        type: 'power-plant'
    },
    NEU: { 
        name: "Elektrownia Neurath", 
        country: "Germany", 
        price: 300000000, 
        incomePerTick: 15000, 
        realProduction: "30 TWh/rok", 
        lat: 51.02, 
        lon: 6.61, 
        description: "Potężna elektrownia w Niemczech.",
        type: 'power-plant'
    },
    JAN: { 
        name: "Elektrownia Jänschwalde", 
        country: "Germany", 
        price: 180000000, 
        incomePerTick: 10000, 
        realProduction: "20 TWh/rok", 
        lat: 51.83, 
        lon: 14.43, 
        description: "Ważny element niemieckiej sieci energetycznej.",
        type: 'power-plant'
    }
};

// Lootbox configurations
export const LOOTBOX_CONFIG = {
    common: { 
        cost: 25000, 
        name: "Zwykła Skrzynka", 
        icon: "📦", 
        description: "Duża szansa na zwykłe i rzadkie pojazdy.", 
        drops: { common: 0.8, rare: 0.18, epic: 0.02, legendary: 0 } 
    },
    rare: { 
        cost: 100000, 
        name: "Rzadka Skrzynka", 
        icon: "📫", 
        description: "Gwarantowany rzadki pojazd lub lepszy.", 
        drops: { common: 0, rare: 0.7, epic: 0.25, legendary: 0.05 } 
    },
    epic: { 
        cost: 500000, 
        name: "Epicka Skrzynka", 
        icon: "📮", 
        description: "Gwarantowany epicki pojazd lub lepszy.", 
        drops: { common: 0, rare: 0, epic: 0.8, legendary: 0.2 } 
    },
    train_pack: { 
        cost: 75000, 
        name: "Paczka Kolejowa", 
        icon: "🚂", 
        type: 'train', 
        description: "Specjalna paczka z pojazdami kolejowymi.",
        drops: { common: 0, rare: 0.8, epic: 0.18, legendary: 0.02 } 
    },
    plane_pack: { 
        cost: 300000, 
        name: "Paczka Lotnicza", 
        icon: "✈️", 
        type: 'plane', 
        description: "Ekskluzywne samoloty dla prawdziwych magnatów.",
        drops: { legendary: 1.0 } 
    },
    bus_pack: { 
        cost: 20000, 
        name: "Paczka Autobusowa", 
        icon: "🚌", 
        type: 'bus', 
        description: "Podstawowe autobusy miejskie.",
        drops: { common: 1.0 } 
    },
    tube_pack: { 
        cost: 80000, 
        name: "Paczka Metra", 
        icon: "🚇", 
        type: 'tube', 
        description: "Pociągi metra z różnych miast.",
        drops: { common: 0, rare: 0.7, epic: 0.25, legendary: 0.05 } 
    }
};

// Upgrade system configuration
export const UPGRADE_CONFIG = {
    costs: [0, 50000, 150000, 500000, 2000000],
    kms: [0, 100, 500, 2000, 5000],
    bonus: [1, 1.25, 1.6, 2.0, 2.5],
    efficiencyBonus: [1, 0.95, 0.88, 0.80, 0.70]
};

// Company logos for personalization
export const COMPANY_LOGOS = ['🏢', '🏭', '🚀', '🌐', '⚡️', '🚂', '✈️', '🚌', '🚢', '⭐'];

// Company color schemes
export const COMPANY_COLORS = {
    blue: '#3b82f6',
    green: '#22c55e', 
    red: '#ef4444',
    yellow: '#eab308',
    purple: '#8b5cf6'
};

// Guild system configuration
export const GUILD_CONFIG = {
    creationCost: 5000000,
    maxMembers: 50,
    bankInterestRate: 0.01, // 1% daily interest
    assetMaintenanceCost: 0.005 // 0.5% of asset value daily
};

// Energy pricing by region
export const ENERGY_PRICES = {
    'Poland': { 'Diesel': 1.55, 'Electricity': 0.18 },
    'Europe': { 'Diesel': 1.85, 'Electricity': 0.22 },
    'USA': { 'Diesel': 1.05, 'Electricity': 0.15 },
    'UK': { 'Diesel': 1.80, 'Electricity': 0.35 },
    'Finland': { 'Diesel': 1.95, 'Electricity': 0.12 }
};

// Helper function to get icon HTML with fallback
export function getIconHtml(type, sizeClass = "w-full h-full") {
    const src = ICONS[type] || '❓';
    
    // If path contains dot or slash, treat as image file
    if (src.includes('.') || src.includes('/')) {
        return `<img src="${src}" class="${sizeClass} object-contain drop-shadow-md" onerror="this.style.display='none';this.parentNode.innerHTML='❓'">`;
    }
    
    // Otherwise it's an emoji/text
    return `<div class="flex items-center justify-center ${sizeClass} text-3xl">${src}</div>`;
}

// Asset rarity system
export const ASSET_RARITY = {
    common: { color: '#9ca3af', multiplier: 1.0 },
    rare: { color: '#3b82f6', multiplier: 1.25 },
    epic: { color: '#8b5cf6', multiplier: 1.5 },
    legendary: { color: '#f59e0b', multiplier: 2.0 }
};

// Helper function to get vehicle rarity
export function getVehicleRarity(vehicle) {
    if (!vehicle || !vehicle.type) return 'common';
    const nameToCheck = (vehicle.title || vehicle.customName || '').toLowerCase();
    
    switch (vehicle.type) {
        case 'bike': 
        case 'bus': 
            return 'common';
        case 'train': 
        case 'tube': 
            if (nameToCheck.includes('victoria')) return 'legendary';
            if (nameToCheck.includes('jubilee') || nameToCheck.includes('piccadilly')) return 'epic';
            return 'rare';
        case 'ship': 
        case 'river-bus':
            return 'epic';
        case 'plane': 
            return 'legendary';
        case 'tram': 
            return 'rare';
        default: 
            return 'common';
    }
}