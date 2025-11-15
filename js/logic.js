import { state, logTransaction, checkLevelUp, achievementsList } from './state.js';
import { config } from './config.js';
import { hav, $, showNotification, fmt, getProximityBonus } from './utils.js';
import { updateUI, render } from './ui.js';
import { fetchTrainStationData, fetchTfLArrivals, fetchMbtaBusTerminalData, fetchCableCarStatus } from './api.js';

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

function checkAchievements() { for (const key in achievementsList) { if (!state.achievements[key] && achievementsList[key].check()) { state.achievements[key] = { unlocked: true, claimed: false, date: new Date().toISOString() }; } } updateUI(); }

export const tickAllInfrastructure = () => {
    tickTrainStations();
    tickTfLStation('tubeStations', 50, state.tubeLog, '🚇');
    tickTfLStation('busTerminals', 25, state.busLog, '🚏');
    tickTfLStation('riverPiers', 40, state.riverBusLog, '⚓');
    tickMbtaBusTerminals();
    tickCableCar();
};

// ... (Wklej tutaj funkcje tickTrainStations, tickTfLStation itd. z oryginalnego pliku) ...
// Dla uproszczenia, są one identyczne jak w starym pliku, tylko trzeba dodać export jeśli chcemy ich używać gdzie indziej
// Ale tickAllInfrastructure jest głównym punktem wejścia.
// Wklejam skrócone wersje dla kontekstu, ale w swoim pliku wklej pełne:

async function tickTrainStations() { for (const stationCode in state.infrastructure.trainStations) { try { const station = state.infrastructure.trainStations[stationCode]; if (!station.owned) continue; const stationConfig = config.infrastructure[stationCode]; const proximityBonus = getProximityBonus(stationConfig.lat, stationConfig.lon, state.playerLocation); const trains = await fetchTrainStationData(stationConfig.apiId); if (!Array.isArray(trains)) { state.stationData[stationCode] = []; continue; } state.stationData[stationCode] = trains; let earningsThisTick = 0; let departures = 0; let arrivals = 0; for (const train of trains) { const trainId = `${train.trainNumber}-${train.departureDate}`; const stationData = train.timeTableRows.find(row => row.stationShortCode === stationConfig.apiId); if (!stationData) continue; if (!state.trainLog[trainId]) state.trainLog[trainId] = { departedPaid: false, arrivedPaid: false }; const baseEarning = 100 * proximityBonus; if (stationData.type === 'DEPARTURE' && stationData.actualTime && !state.trainLog[trainId].departedPaid) { state.wallet += baseEarning; earningsThisTick += baseEarning; departures++; station.departures++; state.trainLog[trainId].departedPaid = true; } if (stationData.type === 'ARRIVAL' && stationData.actualTime && !state.trainLog[trainId].arrivedPaid) { state.wallet += baseEarning; earningsThisTick += baseEarning; arrivals++; station.arrivals++; state.trainLog[trainId].arrivedPaid = true; } } station.hourlyEarnings = earningsThisTick * 40; if (earningsThisTick > 0) { const notifMsg = `🏛️ Dworzec ${stationCode} zarobił ${fmt(earningsThisTick)} VC` + (proximityBonus > 1 ? ' (Bonus!)' : '.'); station.totalEarnings += earningsThisTick; state.profile.total_earned += earningsThisTick; if (!station.earningsLog) station.earningsLog = []; station.earningsLog.push({ timestamp: Date.now(), profit: earningsThisTick, arrivals: arrivals, departures: departures }); if (station.earningsLog.length > 100) station.earningsLog.shift(); showNotification(notifMsg); updateUI(); } } catch (error) { console.error(`Error ticking train station ${stationCode}:`, error); } } }
async function tickTfLStation(stationCategory, baseEarnings, logObject, notificationIcon) { for (const stationCode in state.infrastructure[stationCategory]) { try { const station = state.infrastructure[stationCategory][stationCode]; if (!station.owned) continue; const stationConfig = config.infrastructure[stationCode]; if (stationConfig.apiId.startsWith('place-')) continue; const proximityBonus = getProximityBonus(stationConfig.lat, stationConfig.lon, state.playerLocation); const arrivalsData = await fetchTfLArrivals(stationConfig.apiId); if (!Array.isArray(arrivalsData)) { state.stationData[stationCode] = { data: arrivalsData }; continue; } state.stationData[stationCode] = { data: arrivalsData }; let earningsThisTick = 0; let arrivals = 0; for (const arrival of arrivalsData) { const arrivalId = arrival.id; if (!logObject[arrivalId]) { const earning = baseEarnings * proximityBonus; state.wallet += earning; earningsThisTick += earning; arrivals++; station.arrivals++; logObject[arrivalId] = { paid: true, timestamp: Date.now() }; } } station.hourlyEarnings = earningsThisTick * 40; if (earningsThisTick > 0) { const notifMsg = `${notificationIcon} ${stationConfig.name} zarobiła ${fmt(earningsThisTick)} VC` + (proximityBonus > 1 ? ' (Bonus!)' : '.'); station.totalEarnings += earningsThisTick; state.profile.total_earned += earningsThisTick; if (!station.earningsLog) station.earningsLog = []; station.earningsLog.push({ timestamp: Date.now(), profit: earningsThisTick, arrivals: arrivals, departures: 0 }); if (station.earningsLog.length > 100) station.earningsLog.shift(); showNotification(notifMsg); updateUI(); } } catch (error) { console.error(`Error ticking TfL station ${stationCode}:`, error); } } const now = Date.now(); for (const id in logObject) { if (now - logObject[id].timestamp > 1800000) { delete logObject[id]; } } }
async function tickMbtaBusTerminals() { for (const terminalCode in state.infrastructure.busTerminals) { const stationConfig = config.infrastructure[terminalCode]; if (!stationConfig.apiId.startsWith('place-')) continue; try { const terminal = state.infrastructure.busTerminals[terminalCode]; if (!terminal.owned) continue; const proximityBonus = getProximityBonus(stationConfig.lat, stationConfig.lon, state.playerLocation); const predictionsData = await fetchMbtaBusTerminalData(stationConfig.apiId); state.stationData[terminalCode] = predictionsData; let earningsThisTick = 0; let arrivals = 0; if (predictionsData && predictionsData.data) { for (const prediction of predictionsData.data) { const arrivalId = prediction.id; if (!state.busLog[arrivalId]) { const earning = 25 * proximityBonus; state.wallet += earning; earningsThisTick += earning; arrivals++; terminal.arrivals++; state.busLog[arrivalId] = { paid: true, timestamp: Date.now() }; } } } terminal.hourlyEarnings = earningsThisTick * 40; if (earningsThisTick > 0) { const notifMsg = `🚏 Terminal ${terminalCode} zarobił ${fmt(earningsThisTick)} VC (${arrivals} autobusów)` + (proximityBonus > 1 ? ' (Bonus!)' : '.'); terminal.totalEarnings += earningsThisTick; state.profile.total_earned += earningsThisTick; if (!terminal.earningsLog) terminal.earningsLog = []; terminal.earningsLog.push({ timestamp: Date.now(), profit: earningsThisTick, arrivals: arrivals, departures: 0 }); if (terminal.earningsLog.length > 100) terminal.earningsLog.shift(); showNotification(notifMsg); updateUI(); } } catch (error) { console.error(`Error ticking bus terminal ${terminalCode}:`, error); } } }
function isCableCarOpenNow() { const now = new Date(); const londonTime = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/London' })); const day = londonTime.getDay(); const hour = londonTime.getHours(); if (day >= 1 && day <= 4) { return hour >= 7 && hour < 22; } else if (day === 5) { return hour >= 7 && hour < 23; } else if (day === 6) { return hour >= 8 && hour < 23; } else { return hour >= 9 && hour < 22; } }
async function tickCableCar() { try { const cableCar = state.infrastructure.cableCar.LCC; if (!cableCar.owned) return; const stationConfig = config.infrastructure.LCC; const proximityBonus = getProximityBonus(stationConfig.lat, stationConfig.lon, state.playerLocation); const statusData = await fetchCableCarStatus(stationConfig.apiId); let isActive = false; let earningsThisTick = 0; if (statusData && Array.isArray(statusData.lineStatuses) && statusData.lineStatuses[0]) { const status = statusData.lineStatuses[0].statusSeverityDescription; cableCar.status = status; isActive = (status === 'Good Service'); } else { if (isCableCarOpenNow()) { cableCar.status = 'Otwarta'; isActive = true; } else { cableCar.status = 'Zamknięta'; isActive = false; } } if (isActive) { earningsThisTick = 5000 * 1.5 * proximityBonus; state.wallet += earningsThisTick; cableCar.totalEarnings += earningsThisTick; state.profile.total_earned += earningsThisTick; if (!cableCar.earningsLog) cableCar.earningsLog = []; cableCar.earningsLog.push({ timestamp: Date.now(), profit: earningsThisTick, arrivals: 1, departures: 1 }); if (cableCar.earningsLog.length > 100) cableCar.earningsLog.shift(); } cableCar.hourlyEarnings = isActive ? 5000 * 60 * proximityBonus : 0; updateUI(); } catch (error) { } }