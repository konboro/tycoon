// js/ui.js - WERSJA Z PEŁNYMI DETALAMI (FIX)
import { state, achievementsList, logTransaction } from './state.js';
import { config, lootboxConfig } from './config.js';
import { supabase } from './supabase.js';
import { $, fmt, showNotification, showConfirm, getProximityBonus, getWeatherIcon, ICONS, createIcon, getVehicleRarity, getIconHtml } from './utils.js';
import { fetchGlobalTakenVehicles } from './api.js';
import { map } from './state.js';

// ===== 1. FUNKCJE POMOCNICZE (AKCJE) =====

function openLootbox(boxType) {
    const box = lootboxConfig[boxType];
    if (state.wallet < box.cost) return;
    state.wallet -= box.cost;
    logTransaction(-box.cost, `Zakup: ${box.name}`);
    const rand = Math.random();
    let cumulativeProb = 0; let prizeRarity = 'common';
    for (const rarity in box.drops) { cumulativeProb += box.drops[rarity]; if (rand < cumulativeProb) { prizeRarity = rarity; break; } }
    let unownedVehicles = [];
    Object.values(state.vehicles).forEach(map => { for (const v of map.values()) { if (!state.owned[`${v.type}:${v.id}`]) unownedVehicles.push(v); } });
    if (box.type) unownedVehicles = unownedVehicles.filter(v => v.type === box.type);
    let prizePool = unownedVehicles.filter(v => getVehicleRarity(v) === prizeRarity);
    if (prizePool.length === 0) { const rarities = ['legendary', 'epic', 'rare', 'common']; for (let i = rarities.indexOf(prizeRarity) + 1; i < rarities.length; i++) { prizePool = unownedVehicles.filter(v => getVehicleRarity(v) === rarities[i]); if (prizePool.length > 0) break; } }
    
    const modal = $('lootbox-prize-modal'); const prizeCard = $('prize-card');
    prizeCard.classList.remove('is-flipped'); modal.style.display = 'flex';
    setTimeout(() => {
        prizeCard.classList.add('is-flipped');
        if (prizePool.length > 0) {
            const prize = prizePool[Math.floor(Math.random() * prizePool.length)];
            const key = `${prize.type}:${prize.id}`;
            const rarity = getVehicleRarity(prize);
            state.owned[key] = { ...prize, odo_km: 0, earned_vc: 0, wear: 0, purchaseDate: new Date().toISOString(), customName: null, level: 1, totalEnergyCost: 0, earningsLog: [], serviceHistory: [] };
            (async () => {
                const user = (await supabase.auth.getUser()).data.user;
                if(user) {
                    await supabase.from('vehicles').insert([{ owner_id: user.id, vehicle_api_id: prize.id, type: prize.type, custom_name: prize.title, wear: 0, is_moving: false }]);
                    await supabase.from('profiles').update({ wallet: state.wallet }).eq('id', user.id);
                }
            })();
            $('prize-title').textContent = "Gratulacje!";
            $('prize-card-back').className = `prize-card-face prize-card-back absolute w-full h-full flex items-center justify-center rounded-lg bg-gray-900 border-l-8 rarity-${rarity}`;
            $('prize-details').innerHTML = `<div class="w-32 h-32 mx-auto">${getIconHtml(prize.type)}</div><h4 class="text-lg font-bold mt-4">${prize.title}</h4>`;
            $('prize-message').textContent = "Pojazd został dodany do Twojej floty!";
        } else {
            const fallbackVC = Math.round(box.cost * 0.5);
            state.wallet += fallbackVC;
            logTransaction(fallbackVC, "Zwrot za skrzynkę");
            (async () => { const user = (await supabase.auth.getUser()).data.user; if(user) await supabase.from('profiles').update({ wallet: state.wallet }).eq('id', user.id); })();
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
    showConfirm(`Sprzedać ${vehicle.customName || vehicle.title} za ${fmt(sellPrice)} VC?`, () => {
        state.wallet += sellPrice;
        logTransaction(sellPrice, `Szybka sprzedaż: ${vehicle.customName || vehicle.title}`);
        delete state.owned[key];
        state.selectedVehicleKey = null;
        (async () => {
            const user = (await supabase.auth.getUser()).data.user;
            if(user) {
               await supabase.from('vehicles').delete().eq('vehicle_api_id', vehicle.id).eq('owner_id', user.id);
               await supabase.from('profiles').update({ wallet: state.wallet }).eq('id', user.id);
            }
        })();
        showNotification(`Sprzedano za ${fmt(sellPrice)} VC.`);
        render();
    });
}

function openSellModal(key) {
    const vehicle = state.owned[key];
    if (!vehicle) return;
    const modal = $('sell-modal');
    const basePrice = config.basePrice[vehicle.type] || 0;
    $('sell-modal-text').textContent = `Wystawiasz: ${vehicle.customName || vehicle.title}`;
    const priceInput = $('sell-price');
    priceInput.value = basePrice;
    const infoEl = $('sell-modal-info');
    const updateConfirmation = () => {
        const price = parseInt(priceInput.value) || 0;
        const commission = Math.round(price * 0.05);
        infoEl.innerHTML = `Prowizja (5%): ${fmt(commission)} VC<br>Otrzymasz: ${fmt(price - commission)} VC`;
    };
    priceInput.addEventListener('input', updateConfirmation);
    updateConfirmation();
    modal.style.display = 'flex';
    const confirmBtn = $('confirm-sell-btn');
    const newConfirmBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
    newConfirmBtn.onclick = () => {
        const price = parseInt(priceInput.value);
        if (isNaN(price) || price <= 0) { showNotification("Błędna cena.", true); return; }
        const commission = Math.round(price * 0.05);
        state.wallet -= commission;
        logTransaction(-commission, `Prowizja: ${vehicle.customName}`);
        const durationHours = parseInt($('sell-duration').value);
        state.marketListings.push({ vehicle: { ...vehicle }, price: price, expiresAt: new Date(Date.now() + durationHours * 3600000).toISOString(), seller: state.profile.companyName });
        delete state.owned[key];
        state.selectedVehicleKey = null;
        showNotification(`Wystawiono na giełdę.`);
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
        logTransaction(-cost, `Ulepszenie: ${ownedData.customName}`);
        ownedData.level = (ownedData.level || 1) + 1;
        state.profile.upgrades_done++;
        render();
    } else { showNotification("Brak środków!", true); }
}

function editVehicleName(key) {
    const ownedData = state.owned[key];
    if (!ownedData) return;
    const newName = prompt(`Nowa nazwa:`, ownedData.customName);
    if (newName && newName.trim() !== "") { ownedData.customName = newName.trim(); render(); }
}

function calculateStatsFromLog(log, valueKey, periodHours) {
    const now = Date.now();
    const periodMs = periodHours * 3600000;
    return log.filter(entry => now - entry.timestamp < periodMs).reduce((sum, entry) => sum + (entry[valueKey] || 0), 0);
}

export function openAssetDetailsModal(key) {
    const [assetType, ...idParts] = key.split(':');
    const id = idParts.join(':');
    let asset, isVehicle = true, title;
    if (assetType === 'station') {
        const stationConfig = config.infrastructure[id];
        const { type } = stationConfig;
        let cat; 
        switch(type) { case 'train': cat='trainStations'; break; case 'tube': cat='tubeStations'; break; case 'cable': cat='cableCar'; break; case 'river-bus': cat='riverPiers'; break; case 'bus': cat='busTerminals'; break; }
        asset = state.infrastructure[cat][id];
        title = stationConfig.name; isVehicle = false; asset.type = stationConfig.type;
    } else { asset = state.owned[key]; title = asset.customName || asset.title; }
    if (!asset) return;

    const modal = $('asset-details-modal');
    $('asset-details-icon').innerHTML = isVehicle ? `<div class="w-16 h-16">${getIconHtml(asset.type)}</div>` : `<div class="w-16 h-16">${getIconHtml('station_' + asset.type)}</div>`;
    $('asset-details-title').textContent = title;
    const grid = $('asset-details-grid');
    const log = asset.earningsLog || [];
    const profit_1h = calculateStatsFromLog(log, 'profit', 1);
    const profit_total = asset.earned_vc || asset.totalEarnings || 0;
    let statsHtml = `<div class="col-span-2">1h: ${fmt(profit_1h)} VC</div><div class="col-span-2">Total: ${fmt(profit_total)} VC</div>`;
    grid.innerHTML = `<div class="grid grid-cols-4 gap-4 text-sm">${statsHtml}</div>`;
    
    const ctx = $('asset-earnings-chart').getContext('2d');
    if (state.assetChart) state.assetChart.destroy();
    state.assetChart = new Chart(ctx, { type: 'line', data: { labels: log.map((_, i) => i), datasets: [{ label: 'Zysk', data: log.map(d => d.profit), borderColor: '#3b82f6' }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } } });
    modal.style.display = 'flex';
}

// ===== 2. FUNKCJE RENDERUJĄCE =====

export function renderEmptyState(container, message) { container.innerHTML = `<div class="flex items-center justify-center h-full text-gray-500 p-8 text-center">${message}</div>`; }
export function renderSectionTitle(container, title) { const el = document.createElement('div'); el.className = 'px-4 py-2 bg-gray-800/50 text-sm font-semibold text-gray-300 sticky top-0 z-10 backdrop-blur-sm'; el.textContent = title; container.appendChild(el); }

// --- TO JEST POPRAWIONA FUNKCJA Z DETALAMI ---
export function renderVehicleList(container) {
    const searchTerm = $('search').value.toLowerCase();
    let listSource = [];
    if (state.activeTab === 'store') { 
        let all = []; 
        Object.values(state.vehicles).forEach(m => all.push(...m.values())); 
        listSource = all.filter(v => !state.owned[`${v.type}:${v.id}`]); 
    } else { 
        listSource = Object.values(state.owned).map(od => { 
            const ld = state.vehicles[od.type]?.get(String(od.id)); 
            const d = { ...od, ...(ld || {}) }; 
            d.status = !ld ? 'offline' : (d.isMoving ? 'in-use' : 'online'); 
            return d; 
        }); 
    }
    
    const filtered = listSource.filter(v => {
        if (!v || !v.type) return false;
        const key = `${v.type}:${v.id}`;
        const isMine = !!state.owned[key];
        if (state.activeTab === 'store' && state.globalTaken.has(key) && !isMine) return false;
        
        const safeName = (v.customName || v.title || '').toLowerCase();
        const searchMatch = !searchTerm || safeName.includes(searchTerm);
        const rarity = getVehicleRarity(v);
        const rarityMatch = state.filters.rarities.includes(rarity);
        return searchMatch && rarityMatch;
    });

    if (filtered.length === 0) { renderEmptyState(container, "Brak pojazdów."); return; }

    filtered.forEach(v => {
        const key = `${v.type}:${v.id}`;
        const isOwned = !!state.owned[key];
        const ownedData = state.owned[key];
        const price = config.basePrice[v.type] || 1000;
        const rarity = getVehicleRarity(v);
        const details = config.vehicleDetails[v.type];
        const el = document.createElement('div');
        el.className = `bg-gray-800/50 rounded-lg border border-gray-700/50 p-3 flex flex-col gap-3 hover:border-blue-500 transition`;
        el.dataset.key = key;
        
        // Kalkulacje ekonomiczne
        const earningsPerKm = config.baseRate[v.type] || 0;
        const isElectric = config.energyConsumption[v.type] > 0;
        const consumption = isElectric ? config.energyConsumption[v.type] : config.fuelConsumption[v.type];
        const energyType = isElectric ? 'Electricity' : 'Diesel';
        const pricePerUnit = state.economy.energyPrices[v.country || 'Europe']?.[energyType] || (isElectric ? 0.22 : 1.85);
        const costPerKm = (consumption / 100) * pricePerUnit;
        const netEarnings = earningsPerKm - costPerKm;

        let ageInfo = '<span class="px-2 py-0.5 bg-green-600 text-white rounded-full text-xs font-semibold">Nowy</span>';
        let vTitle = v.title || 'Pojazd';
        if (isOwned) { 
            const ageDays = (new Date() - new Date(ownedData.purchaseDate)) / (1000 * 60 * 60 * 24); 
            ageInfo = `Wiek: <strong>${Math.floor(ageDays)} dni</strong>`; 
            vTitle = ownedData.customName || vTitle; 
        }
        const rColors = { common: 'text-gray-400', rare: 'text-blue-400', epic: 'text-purple-400', legendary: 'text-amber-400' };
        
        // BUDOWANIE HTML
        el.innerHTML = `
            <div class="flex gap-3">
                <div class="w-20 h-20 rounded-md bg-gray-700/50 flex-shrink-0 flex items-center justify-center p-2 border border-gray-600">
                   ${getIconHtml(v.type)}
                </div>
                <div class="flex-grow">
                    <div class="flex justify-between">
                        <h4 class="font-bold text-white leading-tight text-sm">
                           ${isOwned ? `<span class="w-2 h-2 rounded-full inline-block mr-1 ${v.status==='online'?'bg-blue-500':v.status==='in-use'?'bg-green-500':'bg-gray-500'}"></span>` : ''}
                           ${vTitle}
                        </h4>
                        <span class="text-xs font-bold ${rColors[rarity]}">${rarity}</span>
                    </div>
                    <p class="text-xs text-gray-400 mt-1">${v.type.toUpperCase()} • ${v.country || '-'}</p>
                    <div class="flex justify-between items-end mt-2">
                        <p class="text-xs text-gray-300">${ageInfo}</p>
                        <div class="font-mono text-blue-400 font-bold text-lg">${isOwned ? 'Posiadany' : fmt(price) + ' VC'}</div>
                    </div>
                </div>
            </div>
            
            <div class="grid grid-cols-3 gap-x-2 gap-y-1 text-xs text-center border-t border-gray-700/50 pt-2 mt-1 bg-gray-900/30 rounded p-1">
                <div><div class="text-gray-500">Moc</div><div class="font-semibold text-gray-300">${details.power}</div></div>
                <div><div class="text-gray-500">V-max</div><div class="font-semibold text-gray-300">${details.maxSpeed}</div></div>
                <div><div class="text-gray-500">V-śr.</div><div class="font-semibold text-gray-300">${details.avgSpeed}</div></div>
                
                <div><div class="text-gray-500">Zysk/km</div><div class="font-semibold text-green-400">${earningsPerKm.toFixed(2)}</div></div>
                <div><div class="text-gray-500">Koszt/km</div><div class="font-semibold text-red-400">${costPerKm.toFixed(2)}</div></div>
                <div><div class="text-gray-500">Netto</div><div class="font-bold text-blue-400">${netEarnings.toFixed(2)}</div></div>
            </div>

            ${isOwned ? `
            <div class="grid grid-cols-2 gap-2 text-xs text-center border-t border-gray-700/50 pt-2">
                <div class="bg-gray-800 rounded p-1">Przebieg: <span class="text-white font-mono">${fmt(ownedData.odo_km || 0)} km</span></div>
                <div class="bg-gray-800 rounded p-1">Zarobek: <span class="text-green-400 font-mono">${fmt(ownedData.earned_vc || 0)} VC</span></div>
            </div>` : ''}

            <div class="flex gap-2 mt-2">
                ${isOwned 
                    ? `<button class="flex-1 bg-gray-600 hover:bg-gray-500 text-white font-bold py-1 px-3 rounded text-sm" data-info-key="${key}">Szczegóły</button>`
                    : ``
                }
                ${isOwned
                    ? `<button class="bg-blue-600 hover:bg-blue-500 text-white font-bold py-1 px-3 rounded text-sm" data-center="${key}" title="Pokaż na mapie"><i class="ri-focus-3-line"></i></button>`
                    : `<button class="flex-1 bg-green-600 hover:bg-green-500 text-white font-bold py-1.5 px-3 rounded text-sm w-full" data-buy="${key}|${price}">KUP TERAZ</button>`
                }
            </div>`;
        container.appendChild(el);
    });
}

export function renderVehicleCard(key) {
    const [type, ...idParts] = key.split(':'); const id = idParts.join(':');
    const isOwned = !!state.owned[key];
    const baseData = isOwned ? state.owned[key] : state.vehicles[type]?.get(id);
    if (!baseData) { $('vehicle-card').classList.add('translate-y-full'); return; }
    const v = { ...baseData, ...(state.vehicles[type]?.get(id) || {}) };
    const rarity = getVehicleRarity(v);
    const card = $('vehicle-card');
    card.className = `absolute bottom-0 left-1/2 -translate-x-1/2 w-full max-w-3xl bg-gray-800/90 backdrop-blur-md border-t-4 p-4 rounded-t-lg transition-transform z-10 card-rarity-${rarity} shadow-2xl`;
    
    let details = `<div class="text-xs text-gray-400">Typ</div><div class="text-sm font-medium">${type}</div>`;
    let actions = '';
    if (isOwned) {
        const owned = state.owned[key];
        details += `<div class="text-xs text-gray-400">Przebieg</div><div class="text-sm font-medium">${fmt(owned.odo_km)} km</div>`;
        actions = `<button class="flex-1 bg-gray-600 text-white font-bold py-2 rounded" data-svc="${key}">Serwis</button>
                   <button class="flex-1 bg-purple-600 text-white font-bold py-2 rounded" id="upgrade-btn">Ulepsz</button>
                   <button class="flex-1 bg-red-700 text-white font-bold py-2 rounded" id="sell-quick-btn">Sprzedaj</button>`;
    } else {
        const price = config.basePrice[type] || 1000;
        actions = `<button class="flex-1 bg-blue-600 text-white font-bold py-2 rounded" data-buy="${key}|${price}">Kup (${fmt(price)})</button>`;
    }

    card.innerHTML = `
        <div class="flex justify-between mb-3 items-start">
            <div class="flex gap-4">
                <div class="w-16 h-16 bg-gray-900 rounded-lg border border-gray-700 p-1 flex items-center justify-center">
                    ${getIconHtml(type)}
                </div>
                <div>
                    <h3 class="text-xl font-bold text-white">${isOwned ? v.customName : v.title}</h3>
                    <div class="text-sm text-gray-400">${v.country || 'Global'}</div>
                </div>
            </div>
            <button class="text-2xl text-gray-400 hover:text-white" id="close-card-btn"><i class="ri-close-line"></i></button>
        </div>
        <div class="grid grid-cols-4 gap-4 mb-4 border-t border-gray-700 pt-3">${details}</div>
        <div class="flex gap-2">${actions}</div>`;
    card.classList.remove('translate-y-full');
}

export function renderInfrastructure(container) {
    const rColors = { common: 'text-gray-400', rare: 'text-blue-400', epic: 'text-purple-400', legendary: 'text-amber-400' };
    for (const id in config.infrastructure) {
        const conf = config.infrastructure[id];
        let cat; switch(conf.type) { case 'train': cat='trainStations'; break; case 'tube': cat='tubeStations'; break; case 'cable': cat='cableCar'; break; case 'river-bus': cat='riverPiers'; break; case 'bus': cat='busTerminals'; break; default: continue; }
        const data = state.infrastructure[cat]?.[id];
        if (!data) continue;
        const el = document.createElement('div'); el.className = `flex items-center gap-3 p-3 border-b border-gray-800 border-l-4 rarity-${conf.rarity}`; el.dataset.stationId = id;
        el.innerHTML = `<div class="w-12 h-12">${getIconHtml('station_'+conf.type)}</div><div class="flex-grow"><h4 class="font-semibold">${conf.name}</h4><div class="text-xs text-gray-400"><span class="${rColors[conf.rarity]}">${conf.rarity}</span> • Zysk: ${fmt(data.totalEarnings)} VC</div></div>${data.owned ? '<button class="text-xl" data-info-key="station:'+id+'"><i class="ri-information-line"></i></button>' : `<button class="bg-blue-600 text-white px-3 py-1 rounded text-sm" data-buy-station="${id}|${conf.price}">Kup ${fmt(conf.price)}</button>`}`;
        container.appendChild(el);
        if (id === state.selectedStationId && data.owned) { const det = document.createElement('div'); det.className='p-2 bg-gray-900/50'; renderStationDetails(id, det); container.appendChild(det); }
    }
}

export function renderStationDetails(id, container) {
    const stationConfig = config.infrastructure[id];
    const { type } = stationConfig;
    container.innerHTML = ''; 

    if (type === 'train') {
        const trains = state.stationData[id] || [];
        const departures = trains.filter(t => t.timeTableRows.some(r => r.stationShortCode === id && r.type === 'DEPARTURE'));
        const arrivals = trains.filter(t => t.timeTableRows.some(r => r.stationShortCode === id && r.type === 'ARRIVAL'));
        
        const createTable = (title, list) => {
            let html = `<h5 class="font-bold text-xs text-blue-400 mt-2 mb-1">${title}</h5><table class="w-full text-[10px]"><tbody>`;
            if(list.length === 0) html += `<tr><td class="text-gray-500">Brak danych</td></tr>`;
            list.slice(0, 5).forEach(t => {
                const row = t.timeTableRows.find(r => r.stationShortCode === id && r.type === (title==='Odjazdy'?'DEPARTURE':'ARRIVAL'));
                const time = new Date(row.scheduledTime).toLocaleTimeString('pl-PL', {hour:'2-digit', minute:'2-digit'});
                html += `<tr class="border-t border-gray-700"><td class="py-1">${t.trainType} ${t.trainNumber}</td><td class="text-right font-mono">${time}</td></tr>`;
            });
            return html + '</tbody></table>';
        };
        
        container.innerHTML = createTable('Odjazdy', departures) + createTable('Przyjazdy', arrivals);

    } else if (type === 'bus' && stationConfig.apiId.startsWith('place-')) { 
        const data = state.stationData[id]?.data || [];
        let html = `<table class="w-full text-[10px] mt-2"><thead><tr><th class="text-left">Kierunek</th><th class="text-right">Czas</th></tr></thead><tbody>`;
        if(data.length === 0) html += `<tr><td colspan="2" class="text-gray-500">Brak odjazdów</td></tr>`;
        data.slice(0,5).forEach(d => {
           const time = d.attributes.departure_time ? new Date(d.attributes.departure_time).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '-';
           html += `<tr class="border-t border-gray-700"><td class="py-1">Bus</td><td class="text-right font-mono text-green-400">${time}</td></tr>`;
        });
        container.innerHTML = html + '</tbody></table>';

    } else { 
        const data = (state.stationData[id]?.data || []).sort((a, b) => (a.timeToStation || 9999) - (b.timeToStation || 9999));
        let html = `<table class="w-full text-[10px] mt-2"><thead><tr><th class="text-left">Linia</th><th class="text-left">Kierunek</th><th class="text-right">Min</th></tr></thead><tbody>`;
        if(data.length === 0) html += `<tr><td colspan="3" class="text-gray-500">Brak danych live</td></tr>`;
        data.slice(0, 8).forEach(arr => {
            html += `<tr class="border-t border-gray-700"><td class="py-1 text-blue-300">${arr.lineName}</td><td>${arr.destinationName}</td><td class="text-right font-bold text-white">${Math.floor(arr.timeToStation/60)}</td></tr>`;
        });
        container.innerHTML = html + '</tbody></table>';
    }
}

export function renderLootboxTab(container) { container.innerHTML = '<div class="p-4 grid grid-cols-2 gap-4"></div>'; for(const k in lootboxConfig) { const b=lootboxConfig[k]; container.firstChild.innerHTML += `<div class="bg-gray-800 p-4 rounded text-center"><div class="text-4xl">${b.icon}</div><h3>${b.name}</h3><p class="text-blue-400 font-bold">${fmt(b.cost)} VC</p><button class="bg-green-600 w-full py-2 mt-2 rounded text-white" data-open-box="${k}">Otwórz</button></div>`; } }
export function renderMarket(container) { if(!state.marketListings.length) return renderEmptyState(container, "Pusto."); state.marketListings.forEach((l, i) => { const el = document.createElement('div'); el.className="p-3 border-b border-gray-800 flex gap-3"; el.innerHTML = `<div class="w-12 h-12">${getIconHtml(l.vehicle.type)}</div><div class="flex-grow"><h4>${l.vehicle.customName||l.vehicle.title}</h4><div class="text-blue-400 font-bold">${fmt(l.price)} VC</div></div><button class="bg-blue-600 text-white px-3 rounded" data-buy-market="${i}">Kup</button>`; container.appendChild(el); }); }
export function renderRankings(container) { container.innerHTML = '<div class="p-4">Rankingi...</div>'; }
export function renderCharts(container) { container.innerHTML = '<div class="p-4 text-center text-gray-500">Wykresy</div>'; }
export function renderAchievements(container) { for(const k in achievementsList) { const a=achievementsList[k]; const u=state.achievements[k]; const el=document.createElement('div'); el.className="p-3 border-b border-gray-800 flex gap-3"; el.innerHTML = `<div class="text-2xl">${u?.unlocked?'🏆':'🔒'}</div><div class="flex-grow"><h4>${a.title}</h4></div>${u?.unlocked && !u.claimed ? `<button class="bg-green-600 text-white px-3 rounded" data-claim="${k}">Odbierz</button>` : ''}`; container.appendChild(el); } }
export function renderEnergyPrices(container) { container.innerHTML = '<div class="p-4">Ceny paliw...</div>'; }
export function renderTransactionHistory(container) { (state.profile.transaction_history||[]).forEach(t => { const el=document.createElement('div'); el.className="p-3 border-b border-gray-800 flex justify-between"; el.innerHTML=`<span>${t.description}</span><span class="${t.amount>0?'text-green-400':'text-red-400'}">${fmt(t.amount)}</span>`; container.appendChild(el); }); }
export function renderGuildTab(container) { container.innerHTML = '<div class="p-4 text-center">System gildii wkrótce...</div>'; }
export function renderCompanyTab(container) { container.innerHTML = '<div class="p-4 text-center">Edycja firmy...</div>'; }
export function renderFriendsTab(container) { container.innerHTML = '<div class="p-4 text-center">Znajomi...</div>'; }

export function toggleContentPanel(show) { 
    const p = $('content-panel'); 
    const visible = show ?? p.classList.contains('-translate-x-full');
    p.classList.toggle('-translate-x-full', !visible); 
    p.classList.toggle('translate-x-0', visible);
    if (!isVisible) { state.activeTab = null; document.querySelectorAll('.nav-item.bg-gray-800').forEach(el => el.classList.remove('bg-gray-800', 'text-white')); }
}

export function updateUI(inM, outM) {
    const set = (id, v) => { const e = $(id); if(e) e.textContent = v; };
    set('wallet', fmt(state.wallet));
    set('company-name', state.profile.companyName);
    set('level', state.profile.level);
    set('xp', Math.round(state.profile.xp));
    set('xpNext', 100 + (state.profile.level-1)*50);
    $('xpProgressBar').style.width = `${(state.profile.xp / (100+(state.profile.level-1)*50))*100}%`;
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
const setTxt = (id, val) => { const el = $(id); if (el) el.textContent = val; };

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
                const iconHtml = `<div class="w-full h-full flex items-center justify-center">${getIconHtml(v.type, "w-8 h-8")}</div>`;
                
                if(!entry) {
                    const marker = L.marker([v.lat, v.lon], { icon: createIcon(isOwned && v.isMoving) }).addTo(map);
                    marker.getElement().innerHTML = iconHtml;
                    marker.on('click', () => { const vData = state.vehicles[v.type]?.get(v.id); if (!vData) return; state.selectedVehicleKey = key; render(); });
                    entry = { marker, trail: null }; state.markers.set(key, entry);
                } else {
                    entry.marker.setLatLng([v.lat, v.lon]);
                    entry.marker.getElement().innerHTML = iconHtml;
                    const iconEl = entry.marker.getElement();
                    if (iconEl) {
                        if (isOwned && v.isMoving) iconEl.classList.add('is-moving');
                        else iconEl.classList.remove('is-moving');
                    }
                }
                if (isOwned && v.history && v.history.length > 1) { const latlngs = v.history.map(p => [p.lat, p.lon]); if (entry.trail) { entry.trail.setLatLngs(latlngs); } else { entry.trail = L.polyline(latlngs, { color: 'rgba(59, 130, 246, 0.5)', weight: 3 }).addTo(map); } } else if (entry.trail) { entry.trail.remove(); entry.trail = null; }
            }
        }
    });
    for (const [key, entry] of state.markers.entries()) { if (!visibleKeys.has(key) && !key.startsWith('station:') && !key.startsWith('guildasset:')) { if(entry.marker) entry.marker.remove(); if(entry.trail) entry.trail.remove(); state.markers.delete(key); } }
    for (const stationCode in config.infrastructure) { const station = config.infrastructure[stationCode]; const key = `station:${stationCode}`; if (station && !state.markers.has(key)) { const marker = L.marker([station.lat, station.lon], { icon: L.divIcon({ className: 'leaflet-marker-icon', html: `<div class="w-10 h-10">${getIconHtml('station_' + station.type)}</div>`, iconSize: [40, 40], iconAnchor: [20, 20] }) }).addTo(map); marker.bindPopup(`<b>${station.name}</b>`).on('click', () => { document.querySelector('[data-nav-tab="stations"]').click(); }); state.markers.set(key, { marker }); } }
    for (const assetKey in config.guildAssets) { const asset = config.guildAssets[assetKey]; const key = `guildasset:${assetKey}`; let ownerGuildName = null; for (const guildId in state.guild.guilds) { if (state.guild.guilds[guildId].ownedAssets && state.guild.guilds[guildId].ownedAssets[assetKey]) { ownerGuildName = state.guild.guilds[guildId].name; break; } } let popupContent = `<b>${asset.name}</b><br>Dostępna do zakupu przez gildię.`; if (ownerGuildName) { popupContent = `<b>${asset.name}</b><br>Właściciel: ${ownerGuildName}`; } if (!state.markers.has(key)) { const marker = L.marker([asset.lat, asset.lon], { icon: L.divIcon({ className: 'leaflet-marker-icon', html: `<div class="w-10 h-10">${getIconHtml('asset_power-plant')}</div>`, iconSize: [40, 40], iconAnchor: [20, 20] }) }).addTo(map); marker.bindPopup(popupContent).on('click', () => { document.querySelector('[data-nav-tab="guild"]').click(); }); state.markers.set(key, { marker }); } else { state.markers.get(key).marker.getPopup().setContent(popupContent); } }
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
    document.querySelectorAll('[data-nav-tab]').forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.navTab;
            if(tab === 'profile') return;
            state.activeTab = tab;
            render();
            toggleContentPanel(true);
        });
    });
    $('close-content-panel').addEventListener('click', () => toggleContentPanel(false));
    $('edit-company-name-btn').addEventListener('click', () => { document.querySelector('[data-nav-tab="company"]').click(); });
    $('resetAll').addEventListener('click', () => { showConfirm('Na pewno zresetować grę?', () => { localStorage.removeItem('gameState_v9.1'); location.reload(); }); });
    const controls = $('panel-controls');
    controls.addEventListener('click', e => { if (e.target.id === 'refreshAll') doFetch(); });
    controls.addEventListener('input', e => { if (e.target.id === 'search') render(); });
    $('filters-container').addEventListener('change', e => { const parent = e.target.closest('div[id]'); if (!parent) return; const parentId = parent.id; if (parentId === 'filterType') state.filters.types = Array.from(parent.querySelectorAll('input:checked')).map(i => i.value); if (parentId === 'filterCountry') state.filters.countries = Array.from(parent.querySelectorAll('input:checked')).map(i => i.value); if (parentId === 'filterRarity') state.filters.rarities = Array.from(parent.querySelectorAll('input:checked')).map(i => i.value); if (parentId === 'filterMapView') state.filters.mapView = parent.querySelector('input:checked').value; render(); });

    $('mainList').addEventListener('click', e => {
      // 1. BEZPIECZNE KUPNO (RPC)
      const buyTarget = e.target.closest('[data-buy]');
      if (buyTarget) { 
          e.stopPropagation(); 
          (async () => {
              const [key, priceStr] = buyTarget.dataset.buy.split('|'); 
              const [type, ...idParts] = key.split(':'); 
              const id = idParts.join(':'); 
              const price = parseInt(priceStr); 
              const vehicleData = state.vehicles[type]?.get(id); 
              
              if (!vehicleData) { showNotification('Błąd danych pojazdu.', true); return; }

              const { data, error } = await supabase.rpc('buy_vehicle_secure', {
                  p_vehicle_api_id: id,
                  p_vehicle_type: type,
                  p_price: price,
                  p_custom_name: vehicleData.title
              });

              if (error) { showNotification('Błąd połączenia: ' + error.message, true); return; }

              if (data.success) {
                  state.wallet = data.new_wallet; 
                  logTransaction(-price, `Zakup: ${vehicleData.title}`); 
                  state.owned[key] = { ...vehicleData, odo_km: 0, earned_vc: 0, wear: 0, purchaseDate: new Date().toISOString(), customName: null, level: 1, totalEnergyCost: 0, earningsLog: [], serviceHistory: [] }; 
                  state.globalTaken.add(key);
                  updateUI(); render(); showNotification(`Zakupiono ${vehicleData.title}!`);
              } else {
                  showNotification(data.message, true);
                  if (data.message.includes('zajęty')) { state.globalTaken.add(key); render(); }
              }
          })(); 
          return; 
      }

      // 2. KUPNO STACJI (RPC)
      const buyStationTarget = e.target.closest('[data-buy-station]');
      if (buyStationTarget) { 
          e.stopPropagation(); 
          (async () => {
              const [id, priceStr] = buyStationTarget.dataset.buyStation.split('|'); 
              const price = parseInt(priceStr); 
              const stationConfig = config.infrastructure[id];
              
              if (state.wallet >= price) { 
                  const { data, error } = await supabase.rpc('buy_station_secure', {
                      p_station_id: id,
                      p_price: price
                  });
                  if (error) { showNotification('Błąd: ' + error.message, true); return; }
                  if (data.success) {
                      state.wallet = data.new_wallet;
                      logTransaction(-price, `Zakup: ${stationConfig.name}`); 
                      let cat; 
                      switch(stationConfig.type) {
                          case 'train': cat='trainStations'; break; 
                          case 'tube': cat='tubeStations'; break; 
                          case 'cable': cat='cableCar'; break; 
                          case 'river-bus': cat='riverPiers'; break; 
                          case 'bus': cat='busTerminals'; break; 
                      }
                      if(state.infrastructure[cat][id]) state.infrastructure[cat][id].owned = true;
                      updateUI(); render(); showNotification("Zakupiono stację!");
                  } else {
                      showNotification(data.message, true);
                  }
              } else { showNotification('Za mało środków!', true); } 
          })();
          return; 
      }

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