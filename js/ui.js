import { state, achievementsList, logTransaction } from './state.js';
import { config, lootboxConfig } from './config.js';
import { supabase } from './supabase.js';
import { $, fmt, showNotification, showConfirm, getProximityBonus, getWeatherIcon, ICONS, createIcon, getVehicleRarity } from './utils.js';
import { fetchGlobalTakenVehicles } from './api.js';
import { map } from './main.js';

// ===== 1. FUNKCJE POMOCNICZE (AKCJE GRACZA) =====

function openLootbox(boxType) {
    const box = lootboxConfig[boxType];
    if (state.wallet < box.cost) return;
    state.wallet -= box.cost;
    logTransaction(-box.cost, `Zakup: ${box.name}`);
    
    const rand = Math.random();
    let cumulativeProb = 0;
    let prizeRarity = 'common';
    for (const rarity in box.drops) { cumulativeProb += box.drops[rarity]; if (rand < cumulativeProb) { prizeRarity = rarity; break; } }
    
    let unownedVehicles = [];
    Object.values(state.vehicles).forEach(map => { for (const v of map.values()) { if (!state.owned[`${v.type}:${v.id}`]) { unownedVehicles.push(v); } } });
    if (box.type) { unownedVehicles = unownedVehicles.filter(v => v.type === box.type); }
    
    let prizePool = unownedVehicles.filter(v => getVehicleRarity(v) === prizeRarity);
    if (prizePool.length === 0) { const rarities = ['legendary', 'epic', 'rare', 'common']; for (let i = rarities.indexOf(prizeRarity) + 1; i < rarities.length; i++) { prizePool = unownedVehicles.filter(v => getVehicleRarity(v) === rarities[i]); if (prizePool.length > 0) break; } }
    
    const modal = $('lootbox-prize-modal');
    const prizeCard = $('prize-card');
    prizeCard.classList.remove('is-flipped');
    modal.style.display = 'flex';
    
    setTimeout(() => {
        prizeCard.classList.add('is-flipped');
        if (prizePool.length > 0) {
            const prize = prizePool[Math.floor(Math.random() * prizePool.length)];
            const key = `${prize.type}:${prize.id}`;
            const rarity = getVehicleRarity(prize);
            // Dodajemy pojazd (lokalnie, save zrobi sync)
            state.owned[key] = { ...prize, odo_km: 0, earned_vc: 0, wear: 0, purchaseDate: new Date().toISOString(), customName: null, level: 1, totalEnergyCost: 0, earningsLog: [], serviceHistory: [] };
            
            // Zapis do bazy od razu (dla bezpieczeństwa)
            (async () => {
                const user = (await supabase.auth.getUser()).data.user;
                if(user) {
                    await supabase.from('vehicles').insert([{
                        owner_id: user.id,
                        vehicle_api_id: prize.id,
                        type: prize.type,
                        custom_name: prize.title,
                        wear: 0,
                        is_moving: false
                    }]);
                    await supabase.from('profiles').update({ wallet: state.wallet }).eq('id', user.id);
                }
            })();

            $('prize-title').textContent = "Gratulacje!";
            $('prize-card-back').className = `prize-card-face prize-card-back absolute w-full h-full flex items-center justify-center rounded-lg bg-gray-900 border-l-8 rarity-${rarity}`;
            $('prize-details').innerHTML = `<div class="text-5xl">${ICONS[prize.type]}</div><h4 class="text-lg font-bold mt-2">${prize.title}</h4>`;
            $('prize-message').textContent = "Pojazd został dodany do Twojej floty!";
        } else {
            const fallbackVC = Math.round(box.cost * 0.5);
            state.wallet += fallbackVC;
            logTransaction(fallbackVC, "Zwrot za skrzynkę");
            $('prize-title').textContent = "Pech!";
            $('prize-card-back').className = `prize-card-face prize-card-back absolute w-full h-full flex items-center justify-center rounded-lg bg-gray-900 border-l-8 border-gray-500`;
            $('prize-details').innerHTML = `<h4 class="text-lg font-bold">Brak dostępnych pojazdów</h4>`;
            $('prize-message').textContent = `Otrzymujesz zwrot ${fmt(fallbackVC)} VC.`;
        }
        updateUI();
    }, 800);
}

function quickSellVehicle(key) {
    const vehicle = state.owned[key];
    if (!vehicle) return;
    const basePrice = config.basePrice[vehicle.type] || 0;
    const sellPrice = Math.round(basePrice * 0.40);
    showConfirm(`Czy na pewno chcesz szybko sprzedać ${vehicle.customName || vehicle.title} za ${fmt(sellPrice)} VC (40% wartości)?`, () => {
        state.wallet += sellPrice;
        logTransaction(sellPrice, `Szybka sprzedaż: ${vehicle.customName || vehicle.title}`);
        delete state.owned[key];
        state.selectedVehicleKey = null;
        
        // Usuwanie z bazy
        (async () => {
            const user = (await supabase.auth.getUser()).data.user;
            if(user) {
               await supabase.from('vehicles').delete().eq('vehicle_api_id', vehicle.id).eq('owner_id', user.id);
               await supabase.from('profiles').update({ wallet: state.wallet }).eq('id', user.id);
            }
        })();

        showNotification(`Sprzedano ${vehicle.customName || vehicle.title} za ${fmt(sellPrice)} VC.`);
        render();
    });
}

function openSellModal(key) {
    const vehicle = state.owned[key];
    if (!vehicle) return;
    const modal = $('sell-modal');
    const basePrice = config.basePrice[vehicle.type] || 0;
    
    $('sell-modal-text').textContent = `Wystawiasz na sprzedaż: ${vehicle.customName || vehicle.title}`;
    const priceInput = $('sell-price');
    priceInput.value = basePrice;
    
    const infoEl = $('sell-modal-info');
    const updateConfirmation = () => {
        const price = parseInt(priceInput.value) || 0;
        const commission = Math.round(price * 0.05);
        const profit = price - commission;
        infoEl.innerHTML = `Prowizja (5%): ${fmt(commission)} VC<br>Otrzymasz: ${fmt(profit)} VC`;
    };
    
    priceInput.addEventListener('input', updateConfirmation);
    updateConfirmation();
    
    modal.style.display = 'flex';
    const confirmBtn = $('confirm-sell-btn');
    const newConfirmBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);

    newConfirmBtn.onclick = () => {
        const price = parseInt(priceInput.value);
        if (isNaN(price) || price <= 0) { showNotification("Wprowadź poprawną cenę.", true); return; }
        const commission = Math.round(price * 0.05);
        state.wallet -= commission;
        logTransaction(-commission, `Prowizja giełdowa: ${vehicle.customName || vehicle.title}`);
        const durationHours = parseInt($('sell-duration').value);
        
        state.marketListings.push({ vehicle: { ...vehicle }, price: price, expiresAt: new Date(Date.now() + durationHours * 60 * 60 * 1000).toISOString(), seller: state.profile.companyName });
        delete state.owned[key];
        state.selectedVehicleKey = null;
        showNotification(`Wystawiono ${vehicle.customName || vehicle.title} na giełdę za ${fmt(price)} VC.`);
        render();
        modal.style.display = 'none';
    };
}

function upgradeVehicle(key) {
    const ownedData = state.owned[key];
    if (!ownedData || (ownedData.level || 1) >= 5) return;
    const nextLevelIndex = ownedData.level || 1;
    const cost = config.upgrade.costs[nextLevelIndex];
    if (state.wallet >= cost) {
        state.wallet -= cost;
        logTransaction(-cost, `Ulepszenie: ${ownedData.customName || ownedData.title}`);
        ownedData.level = (ownedData.level || 1) + 1;
        state.profile.upgrades_done++;
        render();
    } else {
        showNotification("Brak środków na ulepszenie!", true);
    }
}

function editVehicleName(key) {
    const ownedData = state.owned[key];
    if (!ownedData) return;
    const currentName = ownedData.customName || ownedData.title;
    const newName = prompt(`Zmień nazwę dla "${currentName}":`, currentName);
    if (newName && newName.trim() !== "") {
        ownedData.customName = newName.trim();
        render();
    }
}

function calculateStatsFromLog(log, valueKey, periodHours) {
    const now = Date.now();
    const periodMs = periodHours * 60 * 60 * 1000;
    return log.filter(entry => now - entry.timestamp < periodMs)
              .reduce((sum, entry) => sum + (entry[valueKey] || 0), 0);
}

export function openAssetDetailsModal(key) {
    const [assetType, ...idParts] = key.split(':');
    const id = idParts.join(':');
    let asset, isVehicle = true, title;

    if (assetType === 'station') {
        const stationConfig = config.infrastructure[id];
        const { type } = stationConfig;
        const category = type === 'river-bus' ? 'riverPiers' : type + 'Terminals';
        asset = state.infrastructure[type === 'train' ? 'trainStations' : type === 'tube' ? 'tubeStations' : type === 'cable' ? 'cableCar' : category][id];
        title = stationConfig.name;
        asset.type = stationConfig.type;
        isVehicle = false;
    } else {
        asset = state.owned[key];
        title = asset.customName || asset.title;
    }
    if (!asset) return;

    const modal = $('asset-details-modal');
    $('asset-details-icon').innerHTML = isVehicle 
        ? `<div class="text-5xl">${ICONS[asset.type] || '❓'}</div>`
        : `<div class="text-5xl">${ICONS['station_' + asset.type]}</div>`;
    $('asset-details-title').textContent = title;

    const grid = $('asset-details-grid');
    const log = asset.earningsLog || [];

    const profit_1h = calculateStatsFromLog(log, 'profit', 1);
    const profit_24h = calculateStatsFromLog(log, 'profit', 24);
    const profit_total = asset.earned_vc || asset.totalEarnings || 0;

    let statsHtml = `
        <div class="col-span-1 text-gray-400 font-semibold">Wskaźnik</div>
        <div class="col-span-1 text-gray-400 font-semibold text-right">Ostatnia 1h</div>
        <div class="col-span-1 text-gray-400 font-semibold text-right">Ostatnie 24h</div>
        <div class="col-span-1 text-gray-400 font-semibold text-right">Łącznie</div>
        <div class="col-span-4 border-t border-gray-700/50 my-1"></div>
        <div class="col-span-1">Zysk Netto</div>
        <div class="col-span-1 text-right font-medium">${fmt(profit_1h)} VC</div>
        <div class="col-span-1 text-right font-medium">${fmt(profit_24h)} VC</div>
        <div class="col-span-1 text-right font-medium">${fmt(profit_total)} VC</div>
    `;

    if (isVehicle) {
        const km_1h = calculateStatsFromLog(log, 'km', 1);
        const km_24h = calculateStatsFromLog(log, 'km', 24);
        const km_total = asset.odo_km || 0;
        statsHtml += `
            <div class="col-span-1">Dystans</div>
            <div class="col-span-1 text-right font-medium">${km_1h.toFixed(1)} km</div>
            <div class="col-span-1 text-right font-medium">${km_24h.toFixed(1)} km</div>
            <div class="col-span-1 text-right font-medium">${km_total.toFixed(1)} km</div>
        `;
    } else {
        const arrivals_1h = calculateStatsFromLog(log, 'arrivals', 1);
        const arrivals_24h = calculateStatsFromLog(log, 'arrivals', 24);
        const arrivals_total = asset.arrivals || 0;
        statsHtml += `
            <div class="col-span-1">Obsłużono (Przyj.)</div>
            <div class="col-span-1 text-right font-medium">${fmt(arrivals_1h)}</div>
            <div class="col-span-1 text-right font-medium">${fmt(arrivals_24h)}</div>
            <div class="col-span-1 text-right font-medium">${fmt(arrivals_total)}</div>
        `;
    }
    grid.innerHTML = `<div class="grid grid-cols-4 gap-x-4 gap-y-2 w-full">${statsHtml}</div>`;
    
    const earningsData = asset.earningsLog || [];
    const ctx = $('asset-earnings-chart').getContext('2d');
    if (state.assetChart) state.assetChart.destroy();
    
    state.assetChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: earningsData.map((_, i) => `T-${earningsData.length - i}`),
            datasets: [{ label: 'Zysk na Tick', data: earningsData.map(d => d.profit), borderColor: '#3b82f6', backgroundColor: 'rgba(59, 130, 246, 0.1)', fill: true, tension: 0.1, pointRadius: 0 }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { ticks: { color: '#9ca3af' }, grid: { color: 'rgba(107, 114, 128, 0.2)' } }, y: { ticks: { color: '#9ca3af' }, grid: { color: 'rgba(107, 114, 128, 0.2)' } } } }
    });
    modal.style.display = 'flex';
}

// ===== 2. FUNKCJE RENDERUJĄCE (WIDOKI) =====

export function renderEmptyState(container, message) { 
    container.innerHTML = `<div class="flex items-center justify-center h-full text-gray-500 p-8 text-center">${message}</div>`; 
}
export function renderSectionTitle(container, title) { 
    const el = document.createElement('div'); 
    el.className = 'px-4 py-2 bg-gray-800/50 text-sm font-semibold text-gray-300 sticky top-0 z-10 backdrop-blur-sm'; 
    el.textContent = title; 
    container.appendChild(el); 
}

// Lista Pojazdów (Sklep i Flota)
export function renderVehicleList(container) {
    const searchTerm = $('search').value.toLowerCase();
    let listSource = [];
    
    if (state.activeTab === 'store') { 
        let allVehicles = []; 
        Object.values(state.vehicles).forEach(map => allVehicles.push(...map.values())); 
        listSource = allVehicles.filter(v => !state.owned[`${v.type}:${v.id}`]); 
    } else { 
        listSource = Object.values(state.owned).map(ownedData => { 
            const liveData = state.vehicles[ownedData.type]?.get(String(ownedData.id)); 
            const data = { ...ownedData, ...(liveData || {}) }; 
            if (!liveData) { data.status = 'offline'; } 
            else if (data.isMoving) { data.status = 'in-use'; } 
            else { data.status = 'online'; } 
            return data; 
        }); 
    }

    const filtered = listSource.filter(v => {
        if (!v || !v.type) return false;
        const key = `${v.type}:${v.id}`;
        const isOwnedByMe = !!state.owned[key];
        
        // Ukryj zajęte w sklepie
        if (state.activeTab === 'store' && state.globalTaken.has(key) && !isOwnedByMe) { return false; }
        
        const typeMatch = state.filters.types.includes(v.type);
        const countryMatch = !v.country || state.filters.countries.includes(v.country);
        const safeName = (v.customName || v.title || '').toLowerCase();
        const searchMatch = !searchTerm || safeName.includes(searchTerm);
        const rarity = getVehicleRarity(v);
        const rarityMatch = state.filters.rarities.includes(rarity);
        return typeMatch && countryMatch && searchMatch && rarityMatch;
    });

    if (filtered.length === 0) { renderEmptyState(container, "Brak pojazdów spełniających kryteria."); return; }

    filtered.forEach(v => {
        const key = `${v.type}:${v.id}`;
        const isOwned = !!state.owned[key];
        const ownedData = state.owned[key];
        const price = config.basePrice[v.type] || 1000;
        const rarity = getVehicleRarity(v);
        const details = config.vehicleDetails[v.type];
        const el = document.createElement('div');
        el.className = `bg-gray-800/50 rounded-lg border border-gray-700/50 p-3 flex flex-col gap-3 transition-all duration-200 hover:border-blue-500 hover:bg-gray-800`;
        el.dataset.key = key;
        
        const earningsPerKm = config.baseRate[v.type] || 0;
        const isElectric = config.energyConsumption[v.type] > 0;
        const consumption = isElectric ? config.energyConsumption[v.type] : config.fuelConsumption[v.type];
        const pricePerUnit = state.economy.energyPrices[v.country || 'Europe']?.[isElectric ? 'Electricity' : 'Diesel'] || (isElectric ? 0.22 : 1.85);
        const costPerKm = (consumption / 100) * pricePerUnit;
        
        let ageInfo = '<span class="px-2 py-0.5 bg-green-600 text-white rounded-full text-xs font-semibold">Nowy</span>';
        let vehicleTitle = v.title || 'Nieznany Pojazd';
        if (isOwned) { 
            const ageDays = (new Date() - new Date(ownedData.purchaseDate)) / (1000 * 60 * 60 * 24); 
            ageInfo = `Wiek: <strong>${Math.floor(ageDays)} dni</strong> | Przebieg: <strong>${fmt(ownedData.odo_km || 0)} km</strong>`; 
            vehicleTitle = ownedData.customName || vehicleTitle; 
        }
        const rarityColors = { common: 'text-gray-400', rare: 'text-blue-400', epic: 'text-purple-400', legendary: 'text-amber-400' };
        
        el.innerHTML = `
            <div class="flex gap-3">
                <div class="w-20 h-20 rounded-md bg-gray-700 flex-shrink-0 flex items-center justify-center text-5xl">${ICONS[v.type] || '❓'}</div>
                <div class="flex-grow">
                    <div class="flex justify-between items-start">
                        <h4 class="font-bold text-white text-base leading-tight flex items-center gap-2">
                           ${isOwned ? `<span class="w-2.5 h-2.5 rounded-full ${v.status === 'online' ? 'bg-blue-500' : v.status === 'in-use' ? 'bg-green-500' : 'bg-gray-500'}" title="${v.status === 'online' ? 'Online' : v.status === 'in-use' ? 'W ruchu' : 'Offline'}"></span>` : ''}
                           <span>${vehicleTitle}</span>
                        </h4>
                        <span class="font-bold text-lg ${rarityColors[rarity]}">${rarity.charAt(0).toUpperCase() + rarity.slice(1)}</span>
                    </div>
                    <p class="text-xs text-gray-400">${v.type.toUpperCase()} • ${v.country || 'Brak danych'}</p>
                    <p class="text-xs text-gray-300 mt-1">${ageInfo}</p>
                </div>
            </div>
            <div class="grid grid-cols-3 gap-x-2 gap-y-1 text-xs text-center border-t border-gray-700/50 pt-2">
                <div><div class="text-gray-400">Moc</div><div class="font-semibold text-white">${details.power}</div></div>
                <div><div class="text-gray-400">V-max</div><div class="font-semibold text-white">${details.maxSpeed}</div></div>
                <div><div class="text-gray-400">V-śr.</div><div class="font-semibold text-white">${details.avgSpeed}</div></div>
                <div><div class="text-gray-400">Zysk/km</div><div class="font-semibold text-green-400">${earningsPerKm.toFixed(2)} VC</div></div>
                <div><div class="text-gray-400">Koszt/km</div><div class="font-semibold text-red-400">${costPerKm.toFixed(2)} VC</div></div>
                <div><div class="text-gray-400">Netto/km</div><div class="font-semibold text-blue-400">${(earningsPerKm - costPerKm).toFixed(2)} VC</div></div>
            </div>
            <div class="flex gap-2 mt-2">
                ${isOwned 
                    ? `<button class="flex-1 bg-gray-600 hover:bg-gray-500 text-white font-bold py-1.5 px-3 rounded-md text-sm transition" data-info-key="${key}">Szczegóły</button>`
                    : `<div class="flex-1 text-center font-bold text-2xl text-blue-400 self-center">${fmt(price)} VC</div>`
                }
                ${isOwned
                    ? `<button class="bg-blue-600 hover:bg-blue-500 text-white font-bold py-1.5 px-3 rounded-md text-sm transition" data-center="${key}" title="Pokaż na mapie"><i class="ri-focus-3-line"></i></button>`
                    : `<button class="flex-1 bg-green-600 hover:bg-green-500 text-white font-bold py-1.5 px-3 rounded-md text-sm transition" data-buy="${key}|${price}">Kup</button>`
                }
            </div>`;
        container.appendChild(el);
    });
}

// Karta Pojazdu (Szczegóły)
export function renderVehicleCard(key) {
    const [type, ...idParts] = key.split(':');
    const id = idParts.join(':');
    const isOwned = !!state.owned[key];
    const baseData = isOwned ? state.owned[key] : state.vehicles[type]?.get(id);
    
    if (!baseData) { $('vehicle-card').classList.add('translate-y-full'); return; }
    
    const liveData = state.vehicles[type]?.get(id);
    const vehicle = { ...baseData, ...(liveData || {}) };
    const rarity = getVehicleRarity(vehicle);
    const card = $('vehicle-card');
    
    card.className = `absolute bottom-0 left-1/2 -translate-x-1/2 w-full max-w-3xl bg-gray-800/80 backdrop-blur-sm border-t-4 p-4 rounded-t-lg transform transition-transform duration-300 ease-in-out z-10 shadow-[0_-10px_30px_-15px_rgba(0,0,0,0.3)] card-rarity-${rarity}`;
    
    const ownedData = state.owned[key] || {};
    const price = config.basePrice[type] || 1000;
    const weatherData = vehicle.weather || { temperature: 15, weathercode: 3 };
    const weatherIcon = getWeatherIcon(weatherData.weathercode);
    
    let status;
    if (!liveData && isOwned) { status = 'offline'; } else if (vehicle.isMoving) { status = 'in-use'; } else { status = 'online'; }
    const statusClasses = { online: 'bg-blue-500', 'in-use': 'bg-green-500', offline: 'bg-gray-500' };
    const statusTexts = { online: 'Online', 'in-use': 'W trasie', offline: 'Offline' };
    
    let detailsHtml = `<div class="text-xs text-gray-400">Lokalizacja</div><div class="text-sm font-medium">${isFinite(vehicle.lat) ? vehicle.lat.toFixed(4) + ', ' + vehicle.lon.toFixed(4) : 'N/A'}</div><div class="text-xs text-gray-400">Pogoda</div><div class="text-sm font-medium">${weatherData.temperature}°C <i class="${weatherIcon}"></i></div>`;
    
    if (isOwned) {
        const levelIndex = (ownedData.level || 1) - 1;
        const efficiencyBonus = config.upgrade.efficiencyBonus[levelIndex] || 1;
        const isElectric = config.energyConsumption[type] > 0;
        let baseConsumption = isElectric ? config.energyConsumption[type] : config.fuelConsumption[type];
        const currentConsumption = baseConsumption * efficiencyBonus;
        let consumptionHtml = `${baseConsumption.toFixed(1)}`;
        if (ownedData.level > 1) consumptionHtml += ` <i class="ri-arrow-right-line"></i> <span class="text-green-400">${currentConsumption.toFixed(1)}</span>`;
        
        detailsHtml += `<div class="text-xs text-gray-400">Poziom</div><div class="text-sm font-medium">${ownedData.level || 1}</div><div class="text-xs text-gray-400">Przebieg</div><div class="text-sm font-medium">${(ownedData.odo_km || 0).toFixed(2)} km</div><div class="text-xs text-gray-400">Zysk Netto</div><div class="text-sm font-medium">${fmt(ownedData.earned_vc || 0)} VC</div><div class="text-xs text-gray-400">Zużycie</div><div class="text-sm font-medium">${(ownedData.wear || 0).toFixed(1)}%</div><div class="text-xs text-gray-400">${isElectric ? "Zużycie energii" : "Spalanie"}</div><div class="text-sm font-medium">${consumptionHtml}</div>`;
    } else {
        detailsHtml += `<div class="text-xs text-gray-400">Kraj</div><div class="text-sm font-medium">${vehicle.country || 'Brak danych'}</div>`;
    }

    let upgradeButtonHtml = '';
    if(isOwned && (ownedData.level || 1) < 5) {
        const nextLevelIndex = ownedData.level || 1;
        const cost = config.upgrade.costs[nextLevelIndex];
        const kmReq = config.upgrade.kms[nextLevelIndex];
        const canUpgrade = state.wallet >= cost && (ownedData.odo_km || 0) >= kmReq;
        upgradeButtonHtml = `<button class="flex-1 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-2 px-3 rounded-md text-sm transition" id="upgrade-btn" ${canUpgrade ? '' : 'disabled'}><i class="ri-arrow-up-circle-line"></i> Ulepsz (${fmt(cost)} VC)</button>`;
    } else if (isOwned) { upgradeButtonHtml = `<button class="flex-1 bg-gray-600 text-white font-bold py-2 px-3 rounded-md text-sm" disabled>Maks. poziom</button>`; }
    
    const bonusHtml = getProximityBonus(vehicle.lat, vehicle.lon, state.playerLocation) > 1 ? `<span class="text-green-400 text-sm font-bold ml-2"><i class="ri-signal-wifi-line"></i> Bonus +50%</span>` : '';

    card.innerHTML = `<div class="flex justify-between items-start mb-3"><div><div class="flex items-center gap-2"><h3 class="text-xl font-bold text-white">${ownedData.customName || vehicle.title}</h3>${isOwned ? `<button id="edit-vehicle-name-btn" class="text-gray-400 hover:text-white transition-colors"><i class="ri-pencil-line"></i></button>` : ''}</div><div class="flex items-center gap-2 text-sm text-gray-300"><span class="w-2.5 h-2.5 rounded-full ${statusClasses[status]}"></span><span>${statusTexts[status]}</span>${bonusHtml}</div></div><button class="text-gray-400 hover:text-white transition-colors text-2xl" id="close-card-btn"><i class="ri-close-line"></i></button></div><div class="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-2 mb-4">${detailsHtml}</div><div class="flex flex-wrap gap-2"><button class="flex-1 bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-3 rounded-md text-sm transition" data-svc="${key}"><i class="ri-tools-line"></i> Serwis</button>${isOwned ? upgradeButtonHtml : `<button class="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-3 rounded-md text-sm transition" data-buy="${key}|${price}"><i class="ri-shopping-cart-line"></i> Kup</button>`}${isOwned ? `<button class="flex-1 bg-red-700 hover:bg-red-600 text-white font-bold py-2 px-3 rounded-md text-sm transition" id="sell-quick-btn"><i class="ri-money-dollar-circle-line"></i> Szybka sprzedaż</button>` : ''}${isOwned ? `<button class="flex-1 bg-teal-600 hover:bg-teal-500 text-white font-bold py-2 px-3 rounded-md text-sm transition" id="sell-market-btn"><i class="ri-store-2-line"></i> Giełda</button>` : ''}</div>`;
    card.classList.remove('translate-y-full');
}

// Infrastruktura (Stacje)
export function renderInfrastructure(container) {
    const rarityColors = { common: 'text-gray-400', rare: 'text-blue-400', epic: 'text-purple-400', legendary: 'text-amber-400' };
    for (const id in config.infrastructure) {
        const stationConfig = config.infrastructure[id];
        let category;
        switch(stationConfig.type) {
            case 'train': category = 'trainStations'; break; case 'tube': category = 'tubeStations'; break; case 'cable': category = 'cableCar'; break; case 'river-bus': category = 'riverPiers'; break; case 'bus': category = 'busTerminals'; break; default: continue;
        }
        const stationData = state.infrastructure[category] ? state.infrastructure[category][id] : undefined;
        if (!stationData) continue;
        const wrapper = document.createElement('div'); wrapper.className = "border-b border-gray-800";
        const el = document.createElement('div'); el.className = `flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-800/50 transition-colors border-l-4 rarity-${stationConfig.rarity}`; el.dataset.stationId = id;
        let actionsHtml = stationData.owned ? `<button class="ml-auto text-gray-400 hover:text-white transition-colors text-xl" data-info-key="station:${id}" title="Szczegóły"><i class="ri-information-line"></i></button>` : `<div class="text-right"><div class="font-bold text-blue-400">${fmt(stationConfig.price)} VC</div><button class="bg-blue-600 hover:bg-blue-500 text-white font-bold py-1 px-3 rounded-md text-sm transition mt-1" data-buy-station="${id}|${stationConfig.price}">Kup</button></div>`;
        const bonusHtml = getProximityBonus(stationConfig.lat, stationConfig.lon, state.playerLocation) > 1 ? `<span class="text-green-400 text-xs font-bold"><i class="ri-signal-wifi-line"></i> +50%</span>` : '';
        el.innerHTML = `<div class="text-3xl">${ICONS['station_' + stationConfig.type]}</div><div class="flex-grow"><h4 class="font-semibold text-white">${stationConfig.name}</h4><div class="text-xs text-gray-400 flex items-center gap-2 mt-1"><span class="font-semibold ${rarityColors[stationConfig.rarity]}">${stationConfig.rarity.charAt(0).toUpperCase() + stationConfig.rarity.slice(1)}</span><span>• Zysk: ${fmt(stationData.totalEarnings)} VC</span><span>• Szac: ~${fmt(stationConfig.estimatedIncome)} VC/h</span>${bonusHtml}</div></div>${actionsHtml}`;
        const detailsContainer = document.createElement('div'); detailsContainer.className = 'station-details-container';
        if (id === state.selectedStationId && stationData.owned) { detailsContainer.classList.add('visible', 'p-2'); renderStationDetails(id, detailsContainer); }
        wrapper.appendChild(el); wrapper.appendChild(detailsContainer); container.appendChild(wrapper);
    }
}

export function renderStationDetails(id, container) {
    const stationConfig = config.infrastructure[id];
    container.innerHTML = `<p class="text-xs text-gray-400 px-2 pb-2">Szczegóły w przygotowaniu dla ${stationConfig.name}...</p>`;
}

// Pozostałe funkcje renderujące
export function renderLootboxTab(container) {
    container.innerHTML = `<div class="p-4 grid grid-cols-1 md:grid-cols-2 gap-4"></div>`;
    const content = container.firstChild;
    for (const boxType in lootboxConfig) {
        const box = lootboxConfig[boxType];
        const el = document.createElement('div'); el.className = "bg-gray-800/50 p-4 rounded-lg border border-gray-700/50 flex flex-col text-center";
        el.innerHTML = `<h3 class="text-2xl font-bold">${box.icon} ${box.name}</h3><p class="text-sm text-gray-400 flex-grow my-2">${box.description || ''}</p><div class="text-lg font-semibold text-blue-400 mb-3">${fmt(box.cost)} VC</div><button class="w-full bg-green-600 hover:bg-green-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-2 px-4 rounded-md transition" data-open-box="${boxType}" ${state.wallet < box.cost ? 'disabled' : ''}><i class="ri-inbox-unarchive-line"></i> Otwórz</button>`;
        content.appendChild(el);
    }
}

export function renderMarket(container) {
    if (state.marketListings.length === 0) { renderEmptyState(container, "Brak ofert na giełdzie."); return; }
    state.marketListings.forEach((listing, index) => {
        const v = listing.vehicle; const rarity = getVehicleRarity(v);
        const el = document.createElement('div'); el.className = `flex items-center gap-3 p-3 border-b border-gray-800 border-l-4 border-transparent rarity-${rarity}`;
        const timeStr = Math.floor((new Date(listing.expiresAt) - new Date()) / 3600000) + 'h';
        el.innerHTML = `<div class="text-3xl">${ICONS[v.type] || '❓'}</div><div class="flex-grow"><h4 class="font-semibold text-white">${v.customName || v.title}</h4><div class="text-xs text-gray-400">Lvl ${v.level || 1} | ${(v.odo_km || 0).toFixed(0)} km | Wygasa za: ${timeStr}</div></div><div class="text-right"><div class="font-bold text-blue-400">${fmt(listing.price)} VC</div><button class="bg-blue-600 hover:bg-blue-500 text-white font-bold py-1 px-3 rounded-md text-sm transition mt-1" data-buy-market="${index}" ${state.wallet < listing.price ? 'disabled' : ''}>Kup</button></div>`;
        container.appendChild(el);
    });
}

export function renderRankings(container) {
    const renderList = (title, data, key, unit) => {
        renderSectionTitle(container, title); const list = document.createElement('ul');
        data.slice(0, 20).forEach((p, i) => { const el = document.createElement('li'); el.className = `flex items-center p-2 border-b border-gray-800 text-sm ${p.isPlayer ? 'bg-blue-900/50' : ''}`; el.innerHTML = `<div class="w-8 text-center font-bold text-gray-400">${i + 1}</div><div class="flex-grow font-medium">${p.name}</div><div class="font-semibold text-blue-400">${fmt(p[key])} ${unit}</div>`; list.appendChild(el); }); container.appendChild(list);
    };
    renderList('Wartość Aktywów', state.rankings.assetValue, 'assetValue', 'VC');
    renderList('Zysk Tygodniowy', state.rankings.weeklyEarnings, 'weeklyEarnings', 'VC');
}

function calculateFleetStatsByType() { const stats = {}; ['plane', 'train', 'tube', 'bus', 'bike', 'river-bus', 'tram'].forEach(type => { stats[type] = { count: 0, totalEarnings: 0, totalKm: 0, totalValue: 0, estimatedVcPerHour: 0 }; }); for (const key in state.owned) { const vehicle = state.owned[key]; const type = vehicle.type; if (stats[type]) { stats[type].count++; stats[type].totalEarnings += vehicle.earned_vc || 0; stats[type].totalKm += vehicle.odo_km || 0; stats[type].totalValue += config.basePrice[type] || 0; } } for (const type in stats) { if (stats[type].count > 0) { const dailyKm = config.estimatedDailyKm[type] || 0; const baseRate = config.baseRate[type] || 0; stats[type].estimatedVcPerHour = (stats[type].count * dailyKm / 24) * baseRate; } } return stats; }

export function renderCharts(container) {
    container.innerHTML = `<div class="chart-carousel h-full flex flex-col p-2"><div class="carousel-track-container"><div class="carousel-track"><div class="carousel-slide"><div class="chart-wrapper"><h4 class="font-bold text-center text-lg mb-2">Podsumowanie Floty</h4><div id="fleet-summary-container" class="overflow-y-auto flex-grow pr-2"></div></div></div><div class="carousel-slide"><div class="chart-wrapper"><h4 class="font-bold text-center text-lg mb-2">Przychody (godz.)</h4><div class="flex-grow relative"><canvas id="earningsChart"></canvas></div></div></div><div class="carousel-slide"><div class="chart-wrapper"><h4 class="font-bold text-center text-lg mb-2">Struktura floty</h4><div class="flex-grow relative"><canvas id="compositionChart"></canvas></div></div></div></div></div><div class="flex justify-center gap-4 p-2"><button id="prevChartBtn" class="bg-gray-700 hover:bg-gray-600 rounded-full w-8 h-8"><i class="ri-arrow-left-s-line"></i></button><button id="nextChartBtn" class="bg-gray-700 hover:bg-gray-600 rounded-full w-8 h-8"><i class="ri-arrow-right-s-line"></i></button></div></div>`;
    const summaryContainer = $('fleet-summary-container'); const fleetStats = calculateFleetStatsByType();
    for (const type in fleetStats) { const data = fleetStats[type]; if (data.count > 0) { const el = document.createElement('div'); el.className = 'bg-gray-800/50 p-3 rounded-lg border border-gray-700/50 mb-2'; el.innerHTML = `<div class="flex items-center gap-2 font-bold mb-2"><span class="text-xl">${ICONS[type]}</span><span>${type} (${data.count})</span></div><div class="grid grid-cols-2 gap-x-4 gap-y-1 text-xs"><span class="text-gray-400">Wartość:</span><span class="text-right font-medium">${fmt(data.totalValue)} VC</span><span class="text-gray-400">Zarobek:</span><span class="text-right font-medium">${fmt(data.totalEarnings)} VC</span></div>`; summaryContainer.appendChild(el); } }
    const earningsCtx = $('earningsChart').getContext('2d'); new Chart(earningsCtx, { type: 'line', data: { labels: Array(60).fill(''), datasets: [{ label: 'VC', data: state.profile.earnings_history, borderColor: '#3b82f6', tension: 0.3 }] }, options: { responsive: true, maintainAspectRatio: false } });
    const compositionCtx = $('compositionChart').getContext('2d'); const fleetComp = Object.values(state.owned).reduce((acc, v) => { acc[v.type] = (acc[v.type] || 0) + 1; return acc; }, {}); new Chart(compositionCtx, { type: 'doughnut', data: { labels: Object.keys(fleetComp), datasets: [{ data: Object.values(fleetComp), backgroundColor: ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'] }] }, options: { responsive: true, maintainAspectRatio: false } });
    let cur = 0; const track = document.querySelector('.carousel-track');
    $('nextChartBtn').onclick = () => { if(cur < 2) { cur++; track.style.transform = `translateX(-${cur * 100}%)`; } };
    $('prevChartBtn').onclick = () => { if(cur > 0) { cur--; track.style.transform = `translateX(-${cur * 100}%)`; } };
}

export function renderAchievements(container) {
    for (const key in achievementsList) {
        const ach = achievementsList[key]; const data = state.achievements[key];
        const isClaimed = data?.claimed; const isUnlocked = data?.unlocked;
        const el = document.createElement('div'); el.className = `p-3 border-b border-gray-800 flex items-center gap-4 ${!isUnlocked ? 'opacity-50' : ''} ${isClaimed ? 'bg-gray-800/30' : ''}`;
        const action = (!isUnlocked || isClaimed) ? '' : `<button class="ml-auto bg-green-600 text-white py-1 px-3 rounded-md text-sm" data-claim="${key}">Odbierz</button>`;
        el.innerHTML = `<div class="text-3xl">${isUnlocked ? '🏆' : '⏳'}</div><div class="flex-grow"><h4 class="font-semibold">${ach.title}</h4><p class="text-xs text-gray-400">${ach.description}</p></div>${action}`;
        container.appendChild(el);
    }
}

export function renderEnergyPrices(container) {
    container.innerHTML = `<div class="p-4"><table class="w-full text-sm text-left text-gray-400"><thead class="text-xs text-gray-300 uppercase bg-gray-800"><tr><th class="px-4 py-2">Region</th><th class="px-4 py-2">Typ</th><th class="px-4 py-2">Cena</th></tr></thead><tbody id="energy-prices-body"></tbody></table></div>`;
    const tbody = $('energy-prices-body');
    for (const c in state.economy.energyPrices) { for (const t in state.economy.energyPrices[c]) { const row = tbody.insertRow(); row.className="border-b border-gray-800"; row.innerHTML=`<td class="px-4 py-2 font-medium text-white">${c}</td><td class="px-4 py-2">${t}</td><td class="px-4 py-2 text-blue-400">${state.economy.energyPrices[c][t].toFixed(2)}</td>`; } }
}

export function renderTransactionHistory(container) {
    (state.profile.transaction_history || []).forEach(tx => {
        const el = document.createElement('div'); el.className = 'p-3 border-b border-gray-800 flex justify-between items-center';
        el.innerHTML = `<div><p class="font-medium text-white">${tx.description}</p><p class="text-xs text-gray-500">${new Date(tx.timestamp).toLocaleString()}</p></div><div class="text-right"><p class="font-semibold ${tx.amount>=0?'text-green-400':'text-red-400'}">${tx.amount>0?'+':''}${fmt(tx.amount)} VC</p></div>`;
        container.appendChild(el);
    });
}

export function renderGuildTab(container) {
    const { playerGuildId, guilds } = state.guild;
    if (!playerGuildId) {
        container.innerHTML = `<div class="p-4 space-y-6"><div><h3 class="text-lg font-semibold mb-2">Stwórz Gildię</h3><div class="bg-gray-800/50 p-4 rounded-lg border border-gray-700/50 space-y-3"><input type="text" id="guild-name-input" placeholder="Nazwa..." class="w-full bg-gray-800 border border-gray-600 rounded-md px-3 py-1.5"><button id="create-guild-btn" class="w-full bg-green-600 text-white font-bold py-2 px-4 rounded-md">Załóż (${fmt(config.guilds.creationCost)} VC)</button></div></div><div><h3 class="text-lg font-semibold mb-2">Dołącz</h3><div id="guild-list" class="space-y-2"></div></div></div>`;
        const list = $('guild-list');
        for (const gid in guilds) { const g = guilds[gid]; const el = document.createElement('div'); el.className = 'flex justify-between bg-gray-800/50 p-3 rounded-lg'; el.innerHTML = `<span>${g.name} (${g.members.length})</span><button class="bg-blue-600 text-white px-3 py-1 rounded-md text-sm" data-join-guild="${gid}">Dołącz</button>`; list.appendChild(el); }
    } else {
        const myGuild = guilds[playerGuildId];
        container.innerHTML = `<div class="p-4 space-y-4"><div class="bg-gray-800/50 p-4 rounded-lg border border-gray-700/50"><div class="flex justify-between"><div><h3 class="text-xl font-bold">${myGuild.name}</h3><p class="text-sm text-gray-400">${myGuild.description}</p></div><button class="bg-red-600 text-white px-3 py-1 rounded-md text-xs" data-leave-guild>Opuść</button></div><div class="mt-4"><h4 class="text-sm font-semibold">Skarbiec</h4><p class="text-lg font-bold text-blue-400">${fmt(myGuild.bank)} VC</p></div></div><div><h3 class="text-lg font-semibold">Czat</h3><div class="bg-gray-800/50 p-2 rounded-lg h-64 flex flex-col"><div id="guild-chat-messages" class="flex-grow overflow-y-auto p-2"></div><div class="flex gap-2 p-2"><input type="text" id="chat-message-input" class="flex-grow bg-gray-800 border border-gray-600 rounded-md px-3 py-1"><button id="send-chat-msg-btn" class="bg-blue-600 text-white px-4 rounded-md">></button></div></div></div></div>`;
        const chat = $('guild-chat-messages'); (myGuild.chat || []).forEach(m => { const d = document.createElement('div'); d.innerHTML = `<span class="text-xs text-gray-400">[${new Date(m.timestamp).toLocaleTimeString()}]</span> <b class="text-blue-400">${m.sender}:</b> ${m.message}`; chat.appendChild(d); });
    }
}

export function renderCompanyTab(container) {
    const logos = ['🏢', '🏭', '🚀', '🌐', '⚡️', '🚂', '✈️', '🚌', '🚢', '⭐'];
    const colors = ['blue', 'green', 'red', 'yellow', 'purple'];
    const colorHex = { blue: '#3b82f6', green: '#22c55e', red: '#ef4444', yellow: '#eab308', purple: '#8b5cf6' };
    container.innerHTML = `<div class="p-4 space-y-6"><div><h3 class="text-lg font-semibold mb-2">Nazwa</h3><div class="bg-gray-800/50 p-4 rounded-lg space-y-3"><input type="text" id="company-name-input" value="${state.profile.companyName}" class="w-full bg-gray-800 border border-gray-600 rounded-md px-3 py-1.5"><button id="save-company-btn" class="w-full bg-green-600 text-white font-bold py-2 px-4 rounded-md">Zapisz</button></div></div><div><h3 class="text-lg font-semibold mb-2">Logo</h3><div class="bg-gray-800/50 p-4 rounded-lg grid grid-cols-5 gap-3">${logos.map(l => `<button class="text-3xl p-2 bg-gray-700 rounded-md" data-logo="${l}">${l}</button>`).join('')}</div></div><div><h3 class="text-lg font-semibold mb-2">Kolor</h3><div class="bg-gray-800/50 p-4 rounded-lg flex justify-around">${colors.map(c => `<button class="w-10 h-10 rounded-full" style="background:${colorHex[c]}" data-color="${c}"></button>`).join('')}</div></div></div>`;
}

export function renderFriendsTab(container) {
    container.innerHTML = `<div class="p-4 space-y-4"><div><h3 class="text-lg font-semibold mb-2">Dodaj</h3><div class="flex gap-2"><input type="text" id="friend-name-input" class="flex-grow bg-gray-800 border border-gray-600 rounded-md px-3 py-1.5"><button id="add-friend-btn" class="bg-green-600 text-white font-bold px-4 rounded-md">Dodaj</button></div></div><div id="friends-list" class="space-y-2"></div></div>`;
    const list = $('friends-list'); (state.profile.friends || []).forEach((f, i) => { const el = document.createElement('div'); el.className = 'flex justify-between bg-gray-800/50 p-3 rounded-lg'; el.innerHTML = `<span>${f}</span><button class="text-red-500" data-remove-friend="${i}">Usuń</button>`; list.appendChild(el); });
}

export function toggleContentPanel(forceVisible) {
    const panel = $('content-panel');
    const isVisible = typeof forceVisible === 'boolean' ? forceVisible : panel.classList.contains('-translate-x-full');
    panel.classList.toggle('-translate-x-full', !isVisible);
    panel.classList.toggle('translate-x-0', isVisible);
    if (!isVisible) { state.activeTab = null; document.querySelectorAll('.nav-item.bg-gray-800').forEach(el => el.classList.remove('bg-gray-800', 'text-white')); }
}

export function updateUI(inMin = 0, outMin = 0) {
    const setTxt = (id, val) => { const el = $(id); if (el) el.textContent = val; };
    setTxt('company-name', state.profile.companyName || 'Moja Firma');
    setTxt('wallet', fmt(state.wallet));
    setTxt('level', state.profile.level);
    const xp = Math.round(state.profile.xp);
    const xpNext = 100 + (state.profile.level - 1) * 50;
    setTxt('xp', xp); setTxt('xpNext', xpNext);
    $('xpProgressBar').style.width = `${(xp / xpNext) * 100}%`;
    setTxt('owned-vehicles-count', Object.keys(state.owned).length);
    const buildingCount = Object.values(state.infrastructure).reduce((sum, category) => sum + Object.values(category).filter(item => item.owned).length, 0);
    setTxt('owned-buildings-count', buildingCount);
    const estimatedAssets = Math.max(0, calculateAssetValue() - state.wallet);
    setTxt('estimated-assets', fmt(estimatedAssets));
    
    const earningsHistory = state.profile.earnings_history || [];
    const hourlyEstimate = earningsHistory.reduce((a, b) => a + b, 0) * (60 / Math.max(1, earningsHistory.length));
    const odometer = $('hourly-earnings-odometer');
    const formattedEarnings = Math.round(hourlyEstimate).toLocaleString('pl-PL').padStart(8, '0');
    odometer.innerHTML = '';
    for (const digit of formattedEarnings) { if (digit === ' ' || digit === '.' || digit === ',') {} else { const digitEl = document.createElement('span'); digitEl.className = 'odometer-digit'; digitEl.textContent = digit; odometer.appendChild(digitEl); } }
    const labelEl = document.createElement('span'); labelEl.className = 'odometer-label'; labelEl.textContent = 'VC/h'; odometer.appendChild(labelEl);

    const hasUnclaimed = Object.values(state.achievements).some(a => a.unlocked && !a.claimed);
    $('ach-notification-dot').style.display = hasUnclaimed ? 'block' : 'none';
    setTxt('company-logo', state.profile.logo || '🏢');
    const kpiPanel = $('kpi-panel');
    kpiPanel.classList.remove('border-blue-500', 'border-green-500', 'border-red-500', 'border-yellow-500', 'border-purple-500');
    kpiPanel.classList.add(`border-${state.profile.color}-500`);
}

const panelTitles = { stations: "Infrastruktura", store: "Sklep", fleet: "Moja Flota", market: "Giełda", lootbox: "Skrzynki", achievements: "Osiągnięcia", stats: "Statystyki", friends: "Znajomi", rankings: "Ranking", energy: "Ceny Energii", guild: "Gildia", transactions: "Historia Transakcji", company: "Personalizacja Firmy" };

export function render() {
    const listContainer = $('mainList');
    listContainer.innerHTML = '';
    $('panel-title').textContent = panelTitles[state.activeTab] || "";
    const controls = $('panel-controls');
    const filtersContainer = $('filters-container');
    const showControls = ['store', 'fleet', 'stations', 'market'].includes(state.activeTab);
    controls.style.display = showControls ? 'block' : 'none';
    if (showControls) {
        filtersContainer.innerHTML = '';
        let filterHtml = `<div id="filterRarity"><h4 class="font-semibold text-sm mb-2">Rzadkość</h4><div class="space-y-1 text-sm"><label class="flex items-center"><input type="checkbox" value="common" ${state.filters.rarities.includes('common') ? 'checked' : ''} class="mr-2 rounded bg-gray-700 border-gray-500 text-blue-500 focus:ring-blue-600"> Common</label><label class="flex items-center"><input type="checkbox" value="rare" ${state.filters.rarities.includes('rare') ? 'checked' : ''} class="mr-2 rounded bg-gray-700 border-gray-500 text-blue-500 focus:ring-blue-600"> Rare</label><label class="flex items-center"><input type="checkbox" value="epic" ${state.filters.rarities.includes('epic') ? 'checked' : ''} class="mr-2 rounded bg-gray-700 border-gray-500 text-blue-500 focus:ring-blue-600"> Epic</label><label class="flex items-center"><input type="checkbox" value="legendary" ${state.filters.rarities.includes('legendary') ? 'checked' : ''} class="mr-2 rounded bg-gray-700 border-gray-500 text-blue-500 focus:ring-blue-600"> Legendary</label></div></div><div id="filterMapView"><h4 class="font-semibold text-sm mb-2">Widok mapy</h4><div class="space-y-1 text-sm"><label class="flex items-center"><input type="radio" name="mapView" value="all" ${state.filters.mapView === 'all' ? 'checked' : ''} class="mr-2 bg-gray-700 border-gray-500 text-blue-500 focus:ring-blue-600"> Wszystkie</label><label class="flex items-center"><input type="radio" name="mapView" value="fleet" ${state.filters.mapView === 'fleet' ? 'checked' : ''} class="mr-2 bg-gray-700 border-gray-500 text-blue-500 focus:ring-blue-600"> Moja flota</label></div></div>`;
        if (state.activeTab !== 'stations') { filterHtml += `<div id="filterType"><h4 class="font-semibold text-sm mb-2">Typ</h4><div class="space-y-1 text-sm"><label class="flex items-center"><input type="checkbox" value="plane" ${state.filters.types.includes('plane') ? 'checked' : ''} class="mr-2 rounded"> Samoloty</label><label class="flex items-center"><input type="checkbox" value="train" ${state.filters.types.includes('train') ? 'checked' : ''} class="mr-2 rounded"> Pociągi</label><label class="flex items-center"><input type="checkbox" value="tube" ${state.filters.types.includes('tube') ? 'checked' : ''} class="mr-2 rounded"> Metro</label><label class="flex items-center"><input type="checkbox" value="tram" ${state.filters.types.includes('tram') ? 'checked' : ''} class="mr-2 rounded"> Tramwaje</label><label class="flex items-center"><input type="checkbox" value="bus" ${state.filters.types.includes('bus') ? 'checked' : ''} class="mr-2 rounded"> Autobusy</label><label class="flex items-center"><input type="checkbox" value="bike" ${state.filters.types.includes('bike') ? 'checked' : ''} class="mr-2 rounded"> Sharing</label></div></div><div id="filterCountry"><h4 class="font-semibold text-sm mb-2">Kraj</h4><div class="space-y-1 text-sm"><label class="flex items-center"><input type="checkbox" value="USA" ${state.filters.countries.includes('USA') ? 'checked' : ''} class="mr-2 rounded"> USA</label><label class="flex items-center"><input type="checkbox" value="Poland" ${state.filters.countries.includes('Poland') ? 'checked' : ''} class="mr-2 rounded"> Polska</label><label class="flex items-center"><input type="checkbox" value="Finland" ${state.filters.countries.includes('Finland') ? 'checked' : ''} class="mr-2 rounded"> Finlandia</label><label class="flex items-center"><input type="checkbox" value="UK" ${state.filters.countries.includes('UK') ? 'checked' : ''} class="mr-2 rounded"> UK</label></div></div>`; }
        filtersContainer.innerHTML = filterHtml;
    }
    switch (state.activeTab) { 
        case 'stats': renderCharts(listContainer); break; 
        case 'achievements': renderAchievements(listContainer); break; 
        case 'lootbox': renderLootboxTab(listContainer); break; 
        case 'stations': renderInfrastructure(listContainer); break; 
        case 'energy': renderEnergyPrices(listContainer); break; 
        case 'market': renderMarket(listContainer); break; 
        case 'rankings': renderRankings(listContainer); break; 
        case 'guild': renderGuildTab(listContainer); break; 
        case 'friends': renderFriendsTab(listContainer); break; 
        case 'transactions': renderTransactionHistory(listContainer); break; 
        case 'company': renderCompanyTab(listContainer); break; 
        case 'store': case 'fleet': renderVehicleList(listContainer); break; 
        default: break; 
    }
    if (state.selectedVehicleKey) { renderVehicleCard(state.selectedVehicleKey); } else { $('vehicle-card').classList.add('translate-y-full'); }
    redrawMap();
}

export function redrawMap() {
    const visibleKeys = new Set();
    Object.values(state.vehicles).forEach(vehicleMap => {
        for (const v of vehicleMap.values()) {
            const key = `${v.type}:${v.id}`;
            const isOwned = !!state.owned[key];
            if (state.filters.mapView === 'fleet' && !isOwned) { continue; }
            const typeMatch = state.filters.types.includes(v.type);
            const countryMatch = v.country && state.filters.countries.includes(v.country);
            let entry = state.markers.get(key);
            if (typeMatch && countryMatch && v.lat != null && isFinite(v.lat) && v.lon != null && isFinite(v.lon)) {
                visibleKeys.add(key);
                const iconHtml = `<div class="text-2xl">${(isOwned && state.owned[key].skin) || ICONS[v.type] || '❓'}</div>`;
                if (!entry) {
                    const marker = L.marker([v.lat, v.lon], { icon: createIcon(isOwned && v.isMoving) }).addTo(map);
                    marker.getElement().innerHTML = iconHtml;
                    marker.on('click', () => { const vData = state.vehicles[v.type]?.get(v.id); if (!vData) return; state.selectedVehicleKey = key; render(); });
                    entry = { marker, trail: null }; state.markers.set(key, entry);
                } else {
                    entry.marker.setLatLng([v.lat, v.lon]); entry.marker.setIcon(createIcon(isOwned && v.isMoving)); entry.marker.getElement().innerHTML = iconHtml;
                }
                if (isOwned && v.history && v.history.length > 1) { const latlngs = v.history.map(p => [p.lat, p.lon]); if (entry.trail) { entry.trail.setLatLngs(latlngs); } else { entry.trail = L.polyline(latlngs, { color: 'rgba(59, 130, 246, 0.5)', weight: 3 }).addTo(map); } } else if (entry.trail) { entry.trail.remove(); entry.trail = null; }
            }
        }
    });
    for (const [key, entry] of state.markers.entries()) { if (!visibleKeys.has(key) && !key.startsWith('station:') && !key.startsWith('guildasset:')) { if(entry.marker) entry.marker.remove(); if(entry.trail) entry.trail.remove(); state.markers.delete(key); } }
    for (const stationCode in config.infrastructure) { const station = config.infrastructure[stationCode]; const key = `station:${stationCode}`; if (station && !state.markers.has(key)) { const marker = L.marker([station.lat, station.lon], { icon: L.divIcon({ className: 'leaflet-marker-icon', html: `<div class="text-4xl">${ICONS['station_' + station.type]}</div>`, iconSize: [40, 40], iconAnchor: [20, 20] }) }).addTo(map); marker.bindPopup(`<b>${station.name}</b>`).on('click', () => { document.querySelector('[data-nav-tab="stations"]').click(); }); state.markers.set(key, { marker }); } }
    for (const assetKey in config.guildAssets) { const asset = config.guildAssets[assetKey]; const key = `guildasset:${assetKey}`; let ownerGuildName = null; for (const guildId in state.guild.guilds) { if (state.guild.guilds[guildId].ownedAssets && state.guild.guilds[guildId].ownedAssets[assetKey]) { ownerGuildName = state.guild.guilds[guildId].name; break; } } let popupContent = `<b>${asset.name}</b><br>Dostępna do zakupu przez gildię.`; if (ownerGuildName) { popupContent = `<b>${asset.name}</b><br>Właściciel: ${ownerGuildName}`; } if (!state.markers.has(key)) { const marker = L.marker([asset.lat, asset.lon], { icon: L.divIcon({ className: 'leaflet-marker-icon', html: `<div class="text-4xl">${ICONS['asset_power-plant']}</div>`, iconSize: [40, 40], iconAnchor: [20, 20] }) }).addTo(map); marker.bindPopup(popupContent).on('click', () => { document.querySelector('[data-nav-tab="guild"]').click(); }); state.markers.set(key, { marker }); } else { state.markers.get(key).marker.getPopup().setContent(popupContent); } }
}

export function showPlayerLocation() {
    if ('geolocation' in navigator) {
        navigator.geolocation.watchPosition(position => {
            const { latitude, longitude } = position.coords;
            state.playerLocation = { lat: latitude, lon: longitude }; 
            const playerIcon = L.divIcon({ className: 'player-location-icon', html: `<div class="text-3xl">${state.profile.logo}</div>`, iconSize: [32, 32], iconAnchor: [16, 32] });
            if (state.playerMarker) { state.playerMarker.setLatLng([latitude, longitude]); } 
            else { state.playerMarker = L.marker([latitude, longitude], { icon: playerIcon }).addTo(map); state.playerMarker.bindPopup(getCompanyInfoPopupContent); map.setView([latitude, longitude], 13); }
            if (state.proximityCircle) { state.proximityCircle.setLatLng([latitude, longitude]); } 
            else { state.proximityCircle = L.circle([latitude, longitude], { radius: 100000, color: 'green', fillColor: '#22c55e', fillOpacity: 0.15, weight: 1 }).addTo(map); }
        }, (error) => { console.warn("Nie można uzyskać lokalizacji:", error.message); }, { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 });
    } else { console.warn("Geolokalizacja nie jest wspierana przez tę przeglądarkę."); }
}

export function updatePlayerMarkerIcon() {
    if (state.playerMarker) { const playerIcon = L.divIcon({ className: 'player-location-icon', html: `<div class="text-3xl">${state.profile.logo}</div>`, iconSize: [32, 32], iconAnchor: [16, 32] }); state.playerMarker.setIcon(playerIcon); }
}

export function calculateAssetValue() {
    const fleetValue = Object.values(state.owned).reduce((sum, v) => sum + (config.basePrice[v.type] || 0), 0);
    const infraValue = Object.values(state.infrastructure).reduce((sum, category) => { return sum + Object.keys(category).reduce((catSum, key) => { return catSum + (category[key].owned ? config.infrastructure[key].price : 0); }, 0); }, 0);
    return state.wallet + fleetValue + infraValue;
}
export function generateAIPlayers() { if (state.rankings.assetValue.length > 0) return; const names = ["Global Trans", "Szybki Max", "Cargo Corp", "JetSetters", "Rail Baron", "Metro Movers", "Bus Empire", "Oceanic Trade", "Urban Wheeler"]; for (let i = 0; i < 25; i++) { const name = names[i % names.length] + ` ${i+1}`; const assetValue = Math.floor(Math.random() * 200000000) + 50000; const weeklyEarnings = Math.floor(Math.random() * 5000000) + 10000; const aiPlayer = { name, assetValue, weeklyEarnings, isAI: true }; state.rankings.assetValue.push(aiPlayer); state.rankings.weeklyEarnings.push(aiPlayer); } }
export function logDailyEarnings() { const today = new Date().toISOString().slice(0, 10); if (today === state.lastDayCheck) return; const yesterday = state.lastDayCheck; const totalEarnedYesterday = state.profile.total_earned; const lastEntry = state.profile.dailyEarningsHistory[state.profile.dailyEarningsHistory.length - 1]; const earningsForDay = lastEntry ? totalEarnedYesterday - lastEntry.totalAtEnd : totalEarnedYesterday; state.profile.dailyEarningsHistory.push({ date: yesterday, earnings: earningsForDay, totalAtEnd: totalEarnedYesterday }); if (state.profile.dailyEarningsHistory.length > 7) { state.profile.dailyEarningsHistory.shift(); } state.lastDayCheck = today; }
export function updateRankings() { state.rankings.assetValue.forEach(p => { if (p.isAI) p.assetValue *= (1 + (Math.random() - 0.45) * 0.05); }); state.rankings.weeklyEarnings.forEach(p => { if (p.isAI) p.weeklyEarnings *= (1 + (Math.random() - 0.45) * 0.1); }); const playerEntry = { name: state.profile.companyName || "Moja Firma", assetValue: calculateAssetValue(), weeklyEarnings: state.profile.dailyEarningsHistory.reduce((sum, day) => sum + day.earnings, 0), isPlayer: true }; const updateList = (list, key) => { let playerFound = false; const newList = list.map(p => { if (p.isPlayer) { playerFound = true; return playerEntry; } return p; }); if (!playerFound) newList.push(playerEntry); return newList.sort((a, b) => b[key] - a[key]); }; state.rankings.assetValue = updateList(state.rankings.assetValue, 'assetValue'); state.rankings.weeklyEarnings = updateList(state.rankings.weeklyEarnings, 'weeklyEarnings'); }

function getCompanyInfoPopupContent() {
    const companyName = state.profile.companyName || 'Moja Firma';
    const vehicleCount = Object.keys(state.owned).length;
    let buildingCount = 0; Object.values(state.infrastructure).forEach(category => { Object.values(category).forEach(item => { if (item.owned) buildingCount++; }); });
    const companyValue = calculateAssetValue();
    return `<div style="font-family: 'Inter', sans-serif;"><h3 style="margin: 0; font-size: 16px; font-weight: bold;">${companyName}</h3><ul style="list-style: none; padding: 0; margin: 8px 0 0 0; font-size: 14px;"><li style="margin-bottom: 4px;"><strong>Pojazdy:</strong> ${vehicleCount}</li><li style="margin-bottom: 4px;"><strong>Budynki:</strong> ${buildingCount}</li><li><strong>Wartość firmy:</strong> ${fmt(companyValue)} VC</li></ul></div>`;
}

export function setupEventListeners() {
    document.querySelectorAll('[data-nav-tab]').forEach(btn => { btn.addEventListener('click', () => { const tab = btn.dataset.navTab; if (tab === 'profile') return; if (state.activeTab === tab) { toggleContentPanel(false); } else { state.activeTab = tab; document.querySelectorAll('.nav-item').forEach(item => { item.classList.toggle('bg-gray-800', item.dataset.navTab === tab); item.classList.toggle('text-white', item.dataset.navTab === tab); }); render(); toggleContentPanel(true); } }); });
    $('close-content-panel').addEventListener('click', () => toggleContentPanel(false));
    $('edit-company-name-btn').addEventListener('click', () => { document.querySelector('[data-nav-tab="company"]').click(); });
    $('resetAll').addEventListener('click', () => { showConfirm('Na pewno zresetować grę?', () => { localStorage.removeItem('gameState_v9.1'); location.reload(); }); });
    const controls = $('panel-controls');
    controls.addEventListener('click', e => { if (e.target.id === 'refreshAll') doFetch(); });
    controls.addEventListener('input', e => { if (e.target.id === 'search') render(); });
    $('filters-container').addEventListener('change', e => { const parent = e.target.closest('div[id]'); if (!parent) return; const parentId = parent.id; if (parentId === 'filterType') state.filters.types = Array.from(parent.querySelectorAll('input:checked')).map(i => i.value); if (parentId === 'filterCountry') state.filters.countries = Array.from(parent.querySelectorAll('input:checked')).map(i => i.value); if (parentId === 'filterRarity') state.filters.rarities = Array.from(parent.querySelectorAll('input:checked')).map(i => i.value); if (parentId === 'filterMapView') state.filters.mapView = parent.querySelector('input:checked').value; render(); });

    $('mainList').addEventListener('click', e => {
      const buyTarget = e.target.closest('[data-buy]');
      if (buyTarget) { e.stopPropagation(); (async () => { const [key, priceStr] = buyTarget.dataset.buy.split('|'); const [type, ...idParts] = key.split(':'); const id = idParts.join(':'); const price = parseInt(priceStr); const vehicleData = state.vehicles[type]?.get(id); if (state.wallet >= price && vehicleData) { const { data, error } = await supabase.from('vehicles').insert([{ owner_id: state.guild.playerGuildId || (await supabase.auth.getUser()).data.user.id, vehicle_api_id: id, type: type, custom_name: vehicleData.title, wear: 0, is_moving: false }]).select(); if (error) { showNotification('Błąd bazy danych: ' + error.message, true); return; } state.wallet -= price; logTransaction(-price, `Zakup: ${vehicleData.title}`); state.owned[key] = { ...vehicleData, odo_km: 0, earned_vc: 0, wear: 0, purchaseDate: new Date().toISOString(), customName: null, level: 1, totalEnergyCost: 0, earningsLog: [], serviceHistory: [] }; await supabase.from('profiles').update({ wallet: state.wallet }).eq('id', (await supabase.auth.getUser()).data.user.id); updateUI(); render(); showNotification(`Zakupiono ${vehicleData.title}!`); } else { showNotification('Za mało środków!', true); } })(); return; }
      const buyStationTarget = e.target.closest('[data-buy-station]');
      if (buyStationTarget) { e.stopPropagation(); const [id, priceStr] = buyStationTarget.dataset.buyStation.split('|'); const price = parseInt(priceStr); const stationType = config.infrastructure[id].type; if (state.wallet >= price) { state.wallet -= price; logTransaction(-price, `Zakup: ${config.infrastructure[id].name}`); if(stationType === 'train') state.infrastructure.trainStations[id].owned = true; else if (stationType === 'tube') state.infrastructure.tubeStations[id].owned = true; else if (stationType === 'bus') state.infrastructure.busTerminals[id].owned = true; else if (stationType === 'river-bus') state.infrastructure.riverPiers[id].owned = true; else if (stationType === 'cable') state.infrastructure.cableCar[id].owned = true; updateUI(); render(); } else { showNotification('Za mało środków!', true); } return; }
      const buyMarketTarget = e.target.closest('[data-buy-market]');
      if (buyMarketTarget) { e.stopPropagation(); const index = parseInt(buyMarketTarget.dataset.buyMarket, 10); const listing = state.marketListings[index]; if (!listing) { showNotification('Ta oferta jest już nieaktualna!', true); state.marketListings.splice(index, 1); render(); return; } if (state.wallet >= listing.price) { state.wallet -= listing.price; logTransaction(-listing.price, `Zakup z giełdy: ${listing.vehicle.title || listing.vehicle.customName}`); const key = `${listing.vehicle.type}:${listing.vehicle.id}`; state.owned[key] = { ...listing.vehicle }; state.marketListings.splice(index, 1); showNotification(`Kupiono ${listing.vehicle.title || listing.vehicle.customName} z giełdy!`); render(); } else { showNotification('Za mało środków!', true); } return; }
      const claimTarget = e.target.closest('[data-claim]'); if (claimTarget) { e.stopPropagation(); const key = claimTarget.dataset.claim; const ach = achievementsList[key]; state.wallet += ach.reward.vc; state.profile.xp += ach.reward.xp; state.achievements[key].claimed = true; render(); return; }
      const openBoxTarget = e.target.closest('[data-open-box]'); if (openBoxTarget) { e.stopPropagation(); openLootbox(openBoxTarget.dataset.openBox); return; }
      const vehicleItem = e.target.closest('[data-key]'); if (vehicleItem && !e.target.closest('button')) { state.selectedVehicleKey = vehicleItem.dataset.key; render(); }
      const centerTarget = e.target.closest('[data-center]'); if (centerTarget) { e.stopPropagation(); const key = centerTarget.dataset.center; const [type, ...idParts] = key.split(':'); const id = idParts.join(':'); const vehicle = state.vehicles[type]?.get(id) || state.owned[key]; if (vehicle && vehicle.lat != null && isFinite(vehicle.lat)) { map.setView([vehicle.lat, vehicle.lon], 14); toggleContentPanel(false); } return; }
      const infoTarget = e.target.closest('[data-info-key]'); if (infoTarget) { e.stopPropagation(); openAssetDetailsModal(infoTarget.dataset.infoKey); return; }
      const stationItem = e.target.closest('[data-station-id]'); if (stationItem && !e.target.closest('button')) { const stationId = stationItem.dataset.stationId; state.selectedStationId = state.selectedStationId === stationId ? null : stationId; render(); }
      const addFriendTarget = e.target.closest('#add-friend-btn'); if (addFriendTarget) { const input = $('friend-name-input'); const friendName = input.value.trim(); if (friendName && !state.profile.friends.includes(friendName)) { state.profile.friends.push(friendName); render(); input.value = ''; } return; }
      const removeFriendTarget = e.target.closest('[data-remove-friend]'); if (removeFriendTarget) { const index = parseInt(removeFriendTarget.dataset.removeFriend, 10); state.profile.friends.splice(index, 1); render(); return; }
      const createTarget = e.target.closest('#create-guild-btn'); if (createTarget) { const nameInput = $('guild-name-input'); const name = nameInput.value.trim(); if (name && state.wallet >= config.guilds.creationCost) { state.wallet -= config.guilds.creationCost; logTransaction(-config.guilds.creationCost, `Założenie gildii: ${name}`); const newGuildId = `g${Date.now()}`; state.guild.guilds[newGuildId] = { name: name, leader: state.profile.companyName, description: "Witaj w naszej gildii!", level: 1, xp: 0, bank: 0, members: [state.profile.companyName], ownedAssets: {}, chat: [] }; state.guild.playerGuildId = newGuildId; showNotification(`Stworzono gildię: ${name}`); render(); } else { showNotification('Błąd tworzenia gildii.', true); } return; }
      const joinTarget = e.target.closest('[data-join-guild]'); if (joinTarget) { state.guild.playerGuildId = joinTarget.dataset.joinGuild; state.guild.guilds[state.guild.playerGuildId].members.push(state.profile.companyName); showNotification(`Dołączono do gildii.`); render(); return; }
      const leaveTarget = e.target.closest('[data-leave-guild]'); if (leaveTarget) { showConfirm('Czy na pewno chcesz opuścić gildię?', () => { const guildId = state.guild.playerGuildId; const guild = state.guild.guilds[guildId]; guild.members = guild.members.filter(m => m !== state.profile.companyName); if (guild.members.length === 0) { delete state.guild.guilds[guildId]; } else if (guild.leader === state.profile.companyName) { guild.leader = guild.members[0]; } state.guild.playerGuildId = null; showNotification(`Opuszczono gildię.`); render(); }); return; }
      const buyAssetTarget = e.target.closest('[data-buy-guild-asset]'); if (buyAssetTarget) { const assetKey = buyAssetTarget.dataset.buyGuildAsset; const assetConfig = config.guildAssets[assetKey]; const myGuild = state.guild.guilds[state.guild.playerGuildId]; if (myGuild.bank >= assetConfig.price) { myGuild.bank -= assetConfig.price; if (!myGuild.ownedAssets) myGuild.ownedAssets = {}; myGuild.ownedAssets[assetKey] = true; showNotification(`Gildia zakupiła: ${assetConfig.name}`); render(); } return; }
      const depositTarget = e.target.closest('#deposit-treasury-btn'); if(depositTarget) { const amount = parseInt($('treasury-amount-input').value); if (amount > 0 && state.wallet >= amount) { state.wallet -= amount; state.guild.guilds[state.guild.playerGuildId].bank += amount; showNotification(`Wpłacono ${fmt(amount)} VC.`); render(); } return; }
      const withdrawTarget = e.target.closest('#withdraw-treasury-btn'); if(withdrawTarget) { const amount = parseInt($('treasury-amount-input').value); const myGuild = state.guild.guilds[state.guild.playerGuildId]; if (amount > 0 && myGuild.bank >= amount) { myGuild.bank -= amount; state.wallet += amount; showNotification(`Wypłacono ${fmt(amount)} VC.`); render(); } return; }
      const sendChatTarget = e.target.closest('#send-chat-msg-btn'); if(sendChatTarget) { const input = $('chat-message-input'); const message = input.value.trim(); if (message) { const myGuild = state.guild.guilds[state.guild.playerGuildId]; if(!myGuild.chat) myGuild.chat = []; myGuild.chat.push({ sender: state.profile.companyName, message, timestamp: new Date().toISOString() }); input.value = ''; render(); } return; }
      const editDescTarget = e.target.closest('[data-edit-guild-desc]'); if(editDescTarget) { const myGuild = state.guild.guilds[state.guild.playerGuildId]; const newDesc = prompt("Nowy opis:", myGuild.description); if (newDesc) { myGuild.description = newDesc.trim(); render(); } return; }
      const saveCompanyTarget = e.target.closest('#save-company-btn'); if(saveCompanyTarget) { const newName = $('company-name-input').value.trim(); if(newName) { state.profile.companyName = newName; updateUI(); showNotification("Zapisano."); } }
      const logoTarget = e.target.closest('[data-logo]'); if(logoTarget) { state.profile.logo = logoTarget.dataset.logo; updatePlayerMarkerIcon(); render(); }
      const colorTarget = e.target.closest('[data-color]'); if(colorTarget) { state.profile.color = colorTarget.dataset.color; updateUI(); render(); }
    });

    $('vehicle-card').addEventListener('click', e => {
        const target = e.target.closest('button');
        if (!target) return;
        const key = state.selectedVehicleKey;
        if (target.id === 'close-card-btn') { state.selectedVehicleKey = null; render(); }
        if (target.id === 'edit-vehicle-name-btn') { editVehicleName(key); }
        if (target.id === 'upgrade-btn') { upgradeVehicle(key); }
        if (target.id === 'sell-quick-btn') { quickSellVehicle(key); }
        if (target.id === 'sell-market-btn') { openSellModal(key); }
        if (target.dataset.svc) { 
            const owned = state.owned[target.dataset.svc]; 
            if(owned) { 
                const cost = Math.round((owned.wear || 0) * (config.basePrice[owned.type] / 200));
                showConfirm(`Serwis ${fmt(cost)} VC?`, () => {
                    if (state.wallet < cost) { showNotification("Brak środków!", true); return; }
                    state.wallet -= cost; owned.wear = 0; state.profile.services_done++; render(); 
                });
            } 
        }
    });
    
    $('close-prize-modal').addEventListener('click', () => $('lootbox-prize-modal').style.display = 'none');
    $('cancel-sell-btn').addEventListener('click', () => $('sell-modal').style.display = 'none');
    $('close-asset-details-modal').addEventListener('click', () => $('asset-details-modal').style.display = 'none');
}