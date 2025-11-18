// js/logic.js - WERSJA KOMPLETNA
import { state, logTransaction, achievementsList, checkAchievements, checkLevelUp } from './state.js';
import { config } from './config.js';
import { hav, $, showNotification, fmt, getProximityBonus } from './utils.js';
import { updateUI, render } from './ui-core.js';
import { fetchTrainStationData, fetchTfLArrivals, fetchMbtaBusTerminalData, fetchCableCarStatus } from './api.js';
import { supabase } from './supabase.js';

// ===== GŁÓWNE CYKLE (TICKS) =====

export function tickEconomy() {
    let inMin = 0, outMin = 0;
    let currentTickEarnings = 0;
    const now = Date.now();

    for (const key in state.owned) {
        const ownedData = state.owned[key];
        const liveData = state.vehicles[ownedData.type]?.get(ownedData.id);
        
        if (!liveData || !isFinite(liveData.lat) || !isFinite(liveData.lon)) { ownedData.isMoving = false; continue; }

        const prevLat = ownedData.lat; const prevLon = ownedData.lon;
        ownedData.lat = liveData.lat; ownedData.lon = liveData.lon;

        let km = 0; ownedData.isMoving = false;
        if (prevLat && prevLon) {
            km = hav(prevLat, prevLon, ownedData.lat, ownedData.lon);
            if (km > 0.002 && km < 500) ownedData.isMoving = true; else km = 0;
        }

        if (!ownedData.history) ownedData.history = [];
        if (ownedData.isMoving) ownedData.history.push({ lat: ownedData.lat, lon: ownedData.lon, timestamp: now });
        ownedData.history = ownedData.history.filter(p => now - p.timestamp < 3600 * 1000);
        if(ownedData.isMoving) state.profile.minutes_in_transit++;

        const type = ownedData.type;
        const country = liveData.country || 'Europe';
        const levelIndex = (ownedData.level || 1) - 1;
        
        const reputationBonus = 1 + Math.floor((state.profile.reputation[type] || 0) / 1000) * 0.05;
        const levelBonus = config.upgrade.bonus[levelIndex] || 1;
        const proximityBonus = getProximityBonus(ownedData.lat, ownedData.lon, state.playerLocation);

        const baseRate = config.baseRate[type] || 1;
        const inc = km * baseRate * reputationBonus * levelBonus * proximityBonus;
        let energyCost = 0;
        const efficiencyBonus = config.upgrade.efficiencyBonus[levelIndex] || 1;
        const prices = state.economy.energyPrices[country] || state.economy.energyPrices['Europe'];

        if (config.fuelConsumption[type] > 0) {
            const consumption = config.fuelConsumption[type] * efficiencyBonus;
            const price = prices?.['Diesel'] || 1.85;
            energyCost = (km / 100) * consumption * price;
        } else if (config.energyConsumption[type] > 0) {
            const consumption = config.energyConsumption[type] * efficiencyBonus;
            const price = prices?.['Electricity'] || 0.22;
            energyCost = (km / 100) * consumption * price;
        }

        const delta = inc - energyCost;
        currentTickEarnings += delta;
        inMin += inc; outMin += energyCost;
        state.wallet += delta;
        if(delta > 0) state.profile.total_earned += delta;
        
        ownedData.odo_km = (ownedData.odo_km || 0) + km;
        ownedData.earned_vc = (ownedData.earned_vc || 0) + delta;
        ownedData.totalEnergyCost = (ownedData.totalEnergyCost || 0) + energyCost;
        
        let wearIncrease = 0.005; if (ownedData.isMoving) wearIncrease = 0.01;
        ownedData.wear = Math.min(100, (ownedData.wear || 0) + wearIncrease);

        if (ownedData.wear >= 100) {
            showNotification(`Pojazd ${ownedData.customName || ownedData.title} uległ awarii!`, true);
            delete state.owned[key];
            continue;
        }

        if (!ownedData.earningsLog) ownedData.earningsLog = [];
        ownedData.earningsLog.push({ timestamp: Date.now(), profit: delta, km: km });
        if (ownedData.earningsLog.length > 100) ownedData.earningsLog.shift();

        if (km > 0) { state.profile.km_total += km; state.profile.reputation[type] = (state.profile.reputation[type] || 0) + km; }
    }

    state.profile.earnings_history.push(currentTickEarnings);
    if(state.profile.earnings_history.length > 60) state.profile.earnings_history.shift();
    
    checkAchievements();
    checkLevelUp();
    updateUI(inMin, outMin);
}

export function tickGuilds() {
    for (const guildId in state.guild.guilds) {
        const guild = state.guild.guilds[guildId];
        let tickIncome = 0;
        for(const assetKey in guild.ownedAssets) {
            const asset = config.guildAssets[assetKey];
            if(asset) tickIncome += asset.incomePerTick;
        }
        if (tickIncome > 0) {
            guild.bank += tickIncome;
            if (state.guild.playerGuildId === guildId) {
                const perMemberShare = Math.floor(tickIncome * 0.05); 
                if (perMemberShare > 0) {
                    state.wallet += perMemberShare;
                    logTransaction(perMemberShare, `Dywidenda: ${guild.name}`);
                    showNotification(`💰 Dywidenda: +${fmt(perMemberShare)} VC`);
                }
            }
        }
    }
    if (state.activeTab === 'guild') render();
}

export const tickAllInfrastructure = () => {
    tickTrainStations();
    tickTfLStation('tubeStations', 50, state.tubeLog, '🚇');
    tickTfLStation('busTerminals', 25, state.busLog, '🚏');
    tickTfLStation('riverPiers', 40, state.riverBusLog, '⚓');
    tickMbtaBusTerminals();
    tickCableCar();
};

// ===== FUNKCJE POMOCNICZE (LOGIKA GRY) =====

export function calculateAssetValue() { // <--- TU JEST EKSPORT
    const fleetValue = Object.values(state.owned).reduce((sum, v) => sum + (config.basePrice[v.type] || 0), 0);
    const infraValue = Object.values(state.infrastructure).reduce((sum, category) => { return sum + Object.keys(category).reduce((catSum, key) => { return catSum + (category[key].owned ? config.infrastructure[key].price : 0); }, 0); }, 0);
    return state.wallet + fleetValue + infraValue;
}

export function generateAIPlayers() { 
    if (state.rankings.assetValue.length > 0) return; 
    const names = ["Global Trans", "Szybki Max", "Cargo Corp", "JetSetters", "Rail Baron", "Metro Movers", "Bus Empire", "Oceanic Trade", "Urban Wheeler"]; 
    for (let i = 0; i < 25; i++) { 
        const name = names[i % names.length] + ` ${i+1}`; 
        const assetValue = Math.floor(Math.random() * 200000000) + 50000; 
        const weeklyEarnings = Math.floor(Math.random() * 5000000) + 10000; 
        const aiPlayer = { name, assetValue, weeklyEarnings, isAI: true }; 
        state.rankings.assetValue.push(aiPlayer); 
        state.rankings.weeklyEarnings.push(aiPlayer); 
    } 
}

export function logDailyEarnings() { 
    const today = new Date().toISOString().slice(0, 10); 
    if (today === state.lastDayCheck) return; 
    const yesterday = state.lastDayCheck; 
    const totalEarnedYesterday = state.profile.total_earned; 
    const lastEntry = state.profile.dailyEarningsHistory[state.profile.dailyEarningsHistory.length - 1]; 
    const earningsForDay = lastEntry ? totalEarnedYesterday - lastEntry.totalAtEnd : totalEarnedYesterday; 
    state.profile.dailyEarningsHistory.push({ date: yesterday, earnings: earningsForDay, totalAtEnd: totalEarnedYesterday }); 
    if (state.profile.dailyEarningsHistory.length > 7) { state.profile.dailyEarningsHistory.shift(); } 
    state.lastDayCheck = today; 
}

export function updateRankings() { 
    state.rankings.assetValue.forEach(p => { if (p.isAI) p.assetValue *= (1 + (Math.random() - 0.45) * 0.05); }); 
    state.rankings.weeklyEarnings.forEach(p => { if (p.isAI) p.weeklyEarnings *= (1 + (Math.random() - 0.45) * 0.1); }); 
    const playerEntry = { name: state.profile.companyName || "Moja Firma", assetValue: calculateAssetValue(), weeklyEarnings: state.profile.dailyEarningsHistory.reduce((sum, day) => sum + day.earnings, 0), isPlayer: true }; 
    const updateList = (list, key) => { 
        let playerFound = false; 
        const newList = list.map(p => { if (p.isPlayer) { playerFound = true; return playerEntry; } return p; }); 
        if (!playerFound) newList.push(playerEntry); 
        return newList.sort((a, b) => b[key] - a[key]); 
    }; 
    state.rankings.assetValue = updateList(state.rankings.assetValue, 'assetValue'); 
    state.rankings.weeklyEarnings = updateList(state.rankings.weeklyEarnings, 'weeklyEarnings'); 
}

// ===== LOGIKA INFRASTRUKTURY (BEZ ZMIAN) =====

async function tickTrainStations() { /* ... */ }
async function tickTfLStation(cat, base, log, icon) { /* ... */ }
async function tickMbtaBusTerminals() { /* ... */ }
async function tickCableCar() { /* ... */ }