import { state, logTransaction, checkLevelUp, achievementsList } from './state.js';
import { config } from './config.js';
import { hav, $, showNotification, fmt, getProximityBonus } from './utils.js';
import { updateUI, render } from './ui.js';
import { fetchTrainStationData, fetchTfLArrivals, fetchMbtaBusTerminalData, fetchCableCarStatus } from './api.js';
import { supabase } from './supabase.js';

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

export const tickAllInfrastructure = () => {
    tickTrainStations();
    tickTfLStation('tubeStations', 50, state.tubeLog, '🚇');
    tickTfLStation('busTerminals', 25, state.busLog, '🚏');
    tickTfLStation('riverPiers', 40, state.riverBusLog, '⚓');
    tickMbtaBusTerminals();
    tickCableCar();
};

// --- NOWA LOGIKA INFRASTRUKTURY (Z KARAMI ZA OPÓŹNIENIA) ---

async function tickTrainStations() { 
    for (const stationCode in state.infrastructure.trainStations) { 
        try { 
            const station = state.infrastructure.trainStations[stationCode]; 
            if (!station.owned) continue; 
            const stationConfig = config.infrastructure[stationCode]; 
            const proximityBonus = getProximityBonus(stationConfig.lat, stationConfig.lon, state.playerLocation); 
            const trains = await fetchTrainStationData(stationConfig.apiId); 
            
            if (!Array.isArray(trains)) { state.stationData[stationCode] = []; continue; } 
            state.stationData[stationCode] = trains; 
            
            let earningsThisTick = 0; 
            let departures = 0; 
            let arrivals = 0; 
            
            for (const train of trains) { 
                const trainId = `${train.trainNumber}-${train.departureDate}`; 
                const stationData = train.timeTableRows.find(row => row.stationShortCode === stationConfig.apiId); 
                if (!stationData) continue; 
                
                if (!state.trainLog[trainId]) state.trainLog[trainId] = { departedPaid: false, arrivedPaid: false }; 
                
                // --- OBLICZANIE OPÓŹNIENIA ---
                let penaltyFactor = 1.0;
                let delayMinutes = 0;

                if (stationData.actualTime && stationData.scheduledTime) {
                    const actual = new Date(stationData.actualTime);
                    const scheduled = new Date(stationData.scheduledTime);
                    delayMinutes = (actual - scheduled) / 60000;
                    
                    // Kary za opóźnienia:
                    if (delayMinutes > 5) penaltyFactor = 0.8;  // 5 min spóźnienia = 80% zarobku
                    if (delayMinutes > 15) penaltyFactor = 0.5; // 15 min spóźnienia = 50% zarobku
                    if (delayMinutes > 60) penaltyFactor = 0.1; // >1h = 10% zarobku
                }
                
                const baseEarning = 100 * proximityBonus * penaltyFactor; 

                if (stationData.type === 'DEPARTURE' && stationData.actualTime && !state.trainLog[trainId].departedPaid) { 
                    state.wallet += baseEarning; 
                    earningsThisTick += baseEarning; 
                    departures++; station.departures++; 
                    state.trainLog[trainId].departedPaid = true; 
                } 
                if (stationData.type === 'ARRIVAL' && stationData.actualTime && !state.trainLog[trainId].arrivedPaid) { 
                    state.wallet += baseEarning; 
                    earningsThisTick += baseEarning; 
                    arrivals++; station.arrivals++; 
                    state.trainLog[trainId].arrivedPaid = true; 
                } 
            } 
            
            station.hourlyEarnings = earningsThisTick * 40; 
            if (earningsThisTick > 0) { 
                const notifMsg = `🏛️ ${stationConfig.name}: +${fmt(earningsThisTick)} VC`;
                station.totalEarnings += earningsThisTick; 
                state.profile.total_earned += earningsThisTick; 
                if (!station.earningsLog) station.earningsLog = []; 
                station.earningsLog.push({ timestamp: Date.now(), profit: earningsThisTick, arrivals: arrivals, departures: departures }); 
                if (station.earningsLog.length > 100) station.earningsLog.shift(); 
                showNotification(notifMsg); 
                updateUI(); 
            } 
        } catch (error) { console.error(`Error ticking train station ${stationCode}:`, error); } 
    } 
}

// Reszta funkcji tick (bez zmian logicznych, tylko copy-paste dla kompletności pliku)
async function tickTfLStation(cat, base, log, icon) { for (const code in state.infrastructure[cat]) { try { const s = state.infrastructure[cat][code]; if (!s.owned) continue; const conf = config.infrastructure[code]; if (conf.apiId.startsWith('place-')) continue; const bonus = getProximityBonus(conf.lat, conf.lon, state.playerLocation); const data = await fetchTfLArrivals(conf.apiId); state.stationData[code] = { data: Array.isArray(data) ? data : [] }; let earn = 0; let arr = 0; for (const a of (state.stationData[code].data)) { const id = a.id; if (!log[id]) { const e = base * bonus; state.wallet += e; earn += e; arr++; s.arrivals++; log[id] = { paid: true, ts: Date.now() }; } } s.hourlyEarnings = earn * 40; if (earn > 0) { s.totalEarnings += earn; state.profile.total_earned += earn; if(!s.earningsLog) s.earningsLog=[]; s.earningsLog.push({timestamp:Date.now(), profit:earn}); showNotification(`${icon} ${conf.name}: +${fmt(earn)} VC`); updateUI(); } } catch (e) {} } const now=Date.now(); for(const k in log) if(now-log[k].ts > 1800000) delete log[k]; }
async function tickMbtaBusTerminals() { for (const code in state.infrastructure.busTerminals) { const conf = config.infrastructure[code]; if (!conf.apiId.startsWith('place-')) continue; try { const s = state.infrastructure.busTerminals[code]; if (!s.owned) continue; const bonus = getProximityBonus(conf.lat, conf.lon, state.playerLocation); const data = await fetchMbtaBusTerminalData(conf.apiId); state.stationData[code] = data; let earn = 0; let arr = 0; if (data?.data) { for (const p of data.data) { const id = p.id; if (!state.busLog[id]) { const e = 25 * bonus; state.wallet += e; earn += e; arr++; s.arrivals++; state.busLog[id] = { paid: true, ts: Date.now() }; } } } s.hourlyEarnings = earn * 40; if (earn > 0) { s.totalEarnings += earn; state.profile.total_earned += earn; showNotification(`🚏 ${conf.name}: +${fmt(earn)} VC`); updateUI(); } } catch (e) {} } }
function isCableCarOpenNow() { const now = new Date(); const h = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/London' })).getHours(); return h >= 7 && h < 22; }
async function tickCableCar() { try { const s = state.infrastructure.cableCar.LCC; if (!s.owned) return; const conf = config.infrastructure.LCC; const bonus = getProximityBonus(conf.lat, conf.lon, state.playerLocation); const data = await fetchCableCarStatus(conf.apiId); const active = data?.lineStatuses?.[0]?.statusSeverityDescription === 'Good Service' || isCableCarOpenNow(); if (active) { const e = 5000 * 1.5 * bonus; state.wallet += e; s.totalEarnings += e; state.profile.total_earned += e; showNotification(`🚠 ${conf.name}: +${fmt(e)} VC`); updateUI(); } s.hourlyEarnings = active ? 5000 * 60 * bonus : 0; } catch (e) {} }