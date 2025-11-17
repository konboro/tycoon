// js/renderers.js - POPRAWIONY
import { state, achievementsList } from './state.js'; // <-- TU JEST POPRAWKA
import { config, lootboxConfig } from './config.js';
import { $, fmt, getIconHtml, getVehicleRarity, getWeatherIcon, ICONS, createIcon, getProximityBonus } from './utils.js';
import { map } from './state.js';

// ===== RENDERERY WIDOKÓW =====

export function renderEmptyState(container, message) { 
    container.innerHTML = `<div class="flex items-center justify-center h-full text-gray-500 p-8 text-center">${message}</div>`; 
}
export function renderSectionTitle(container, title) { 
    const el = document.createElement('div'); 
    el.className = 'px-4 py-2 bg-gray-800/50 text-sm font-semibold text-gray-300 sticky top-0 z-10 backdrop-blur-sm'; 
    el.textContent = title; 
    container.appendChild(el); 
}

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
        
        const earningsPerKm = config.baseRate[v.type] || 0;
        const isElectric = config.energyConsumption[v.type] > 0;
        const consumption = isElectric ? config.energyConsumption[v.type] : config.fuelConsumption[v.type];
        const pricePerUnit = state.economy.energyPrices[v.country || 'Europe']?.[isElectric ? 'Electricity' : 'Diesel'] || (isElectric ? 0.22 : 1.85);
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
            let html = `<h5 class="font-bold text-xs text-blue-400 mt-3 mb-1 px-2">${title}</h5>
                        <table class="w-full text-[10px] text-left">
                        <thead><tr class="text-gray-500"><th class="px-2">Nr</th><th class="px-2">Kierunek</th><th class="px-2 text-right">Plan</th><th class="px-2 text-right">Fakt</th></tr></thead><tbody>`;
            if(list.length === 0) html += `<tr><td colspan="4" class="px-2 py-1 text-gray-500">Brak danych</td></tr>`;
            list.slice(0, 5).forEach(t => {
                const row = t.timeTableRows.find(r => r.stationShortCode === id && r.type === (title==='Odjazdy'?'DEPARTURE':'ARRIVAL'));
                const otherEnd = title === 'Odjazdy' ? t.timeTableRows[t.timeTableRows.length - 1].stationShortCode : t.timeTableRows[0].stationShortCode;
                const scheduled = new Date(row.scheduledTime);
                const actual = row.actualTime ? new Date(row.actualTime) : null;
                let timeClass = 'text-gray-300'; let actualText = '-';
                if (actual) { const delayMin = (actual - scheduled) / 60000; if (delayMin > 5) timeClass = 'text-red-500 font-bold'; else if (delayMin < -1) timeClass = 'text-green-400'; actualText = actual.toLocaleTimeString('pl-PL', {hour:'2-digit', minute:'2-digit'}); }
                const schedText = scheduled.toLocaleTimeString('pl-PL', {hour:'2-digit', minute:'2-digit'});
                html += `<tr class="border-t border-gray-700"><td class="px-2 py-1">${t.trainType} ${t.trainNumber}</td><td class="px-2 py-1">${otherEnd}</td><td class="px-2 py-1 text-right text-gray-400">${schedText}</td><td class="px-2 py-1 text-right ${timeClass}">${actualText}</td></tr>`;
            });
            return html + '</tbody></table>';
        };
        container.innerHTML = createTable('Odjazdy', departures) + createTable('Przyjazdy', arrivals);
    } else {
        const data = (state.stationData[id]?.data || []).slice(0, 8);
        let html = `<table class="w-full text-[10px] mt-2"><thead><tr><th class="text-left px-2">Linia</th><th class="text-left">Kierunek</th><th class="text-right px-2">Czas</th></tr></thead><tbody>`;
        data.forEach(d => { html += `<tr class="border-t border-gray-700"><td class="px-2 py-1 text-blue-300">${d.lineName || 'Bus'}</td><td>${d.destinationName || '-'}</td><td class="px-2 py-1 text-right font-bold">${d.timeToStation ? Math.floor(d.timeToStation/60)+'m' : '-'}</td></tr>`; });
        container.innerHTML = html + '</tbody></table>';
    }
}

export function renderGuildTab(container) {
    const { playerGuildId, guilds } = state.guild;
    if (!playerGuildId) {
        container.innerHTML = `<div class="p-4 space-y-6"><div><h3 class="text-lg font-semibold mb-2 text-white">Stwórz Gildię</h3><div class="bg-gray-800/50 p-4 rounded-lg border border-gray-700/50 space-y-3"><input type="text" id="guild-name-input" placeholder="Nazwa..." class="w-full bg-gray-800 border border-gray-600 rounded-md px-3 py-1.5 text-white"><button id="create-guild-btn" class="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-2 px-4 rounded-md">Załóż (${fmt(config.guilds.creationCost)} VC)</button></div></div><div><h3 class="text-lg font-semibold mb-2 text-white">Dołącz</h3><div id="guild-list" class="space-y-2"></div></div></div>`;
        const list = $('guild-list');
        for (const gid in guilds) { const g = guilds[gid]; list.innerHTML += `<div class="flex justify-between items-center bg-gray-800/50 p-3 rounded-lg border border-gray-700"><span class="text-white">${g.name} (${g.members.length})</span><button class="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1 rounded-md text-sm" data-join-guild="${gid}">Dołącz</button></div>`; }
    } else {
        const myGuild = guilds[playerGuildId]; if(!myGuild) return;
        let totalIncome = 0; for(const k in myGuild.ownedAssets) if(config.guildAssets[k]) totalIncome += config.guildAssets[k].incomePerTick;
        container.innerHTML = `<div class="p-4 space-y-4 h-full flex flex-col"><div class="bg-gray-800/90 p-4 rounded-xl border border-indigo-500/30 shadow-lg"><div class="flex justify-between items-start"><div><h2 class="text-2xl font-bold text-white">${myGuild.name}</h2><p class="text-xs text-gray-400">Lider: ${myGuild.leader}</p></div><div class="text-right"><div class="text-xs text-gray-400">Skarbiec</div><div class="text-xl font-mono font-bold text-yellow-400">${fmt(myGuild.bank)} VC</div><div class="text-xs text-green-400">+${fmt(totalIncome)} VC/min</div></div></div><div class="flex gap-2 mt-3 border-t border-gray-700 pt-3"><input type="number" id="treasury-amount" placeholder="Kwota" class="w-24 bg-gray-900 text-white text-xs p-1 rounded border border-gray-600"><button id="deposit-treasury-btn" class="bg-green-700 hover:bg-green-600 text-white text-xs px-3 py-1 rounded">Wpłać</button><button id="withdraw-treasury-btn" class="bg-orange-700 hover:bg-orange-600 text-white text-xs px-3 py-1 rounded">Wypłać</button><button class="ml-auto bg-red-900/50 hover:bg-red-900 text-red-200 text-xs px-3 py-1 rounded" data-leave-guild>Opuść</button></div></div><div class="flex-grow overflow-y-auto space-y-4"><div><h3 class="font-bold text-white mb-2">Posiadane Elektrownie</h3><div id="guild-owned-list" class="space-y-2"></div></div><div><h3 class="font-bold text-white mb-2">Rynek Inwestycyjny</h3><div id="guild-shop-list" class="space-y-2"></div></div></div><div class="h-32 bg-gray-900/50 rounded-lg border border-gray-700 flex flex-col"><div id="guild-chat-messages" class="flex-grow overflow-y-auto p-2 text-xs"></div><div class="flex p-1 border-t border-gray-700"><input id="chat-message-input" class="flex-grow bg-transparent text-white px-2 outline-none" placeholder="Wiadomość..."><button id="send-chat-msg-btn" class="text-blue-400 px-2">></button></div></div></div>`;
        const ownedDiv = $('guild-owned-list'); const shopDiv = $('guild-shop-list'); const allOwned = Object.values(guilds).flatMap(g => Object.keys(g.ownedAssets || {}));
        for(const k in myGuild.ownedAssets) { const a = config.guildAssets[k]; ownedDiv.innerHTML += `<div class="bg-green-900/20 border border-green-700/50 p-2 rounded flex justify-between items-center"><div class="flex items-center gap-2"><div class="text-xl">${ICONS['asset_power-plant']}</div><div><div class="font-bold text-white text-sm">${a.name}</div><div class="text-xs text-gray-400">Zysk: ${fmt(a.incomePerTick)}/min</div></div></div></div>`; }
        if(Object.keys(myGuild.ownedAssets).length === 0) ownedDiv.innerHTML = '<div class="text-xs text-gray-500">Brak aktywów.</div>';
        for(const k in config.guildAssets) { if(allOwned.includes(k)) continue; const a = config.guildAssets[k]; shopDiv.innerHTML += `<div class="bg-gray-800 border border-gray-700 p-2 rounded flex justify-between items-center"><div class="flex items-center gap-2"><div class="text-xl grayscale opacity-50">${ICONS['asset_power-plant']}</div><div><div class="font-bold text-white text-sm">${a.name}</div><div class="text-xs text-gray-400">${a.country}</div></div></div><button class="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-3 py-1 rounded" data-buy-guild-asset="${k}">Kup ${fmt(a.price)}</button></div>`; }
        const chat = $('guild-chat-messages'); (myGuild.chat || []).forEach(m => { chat.innerHTML += `<div><span class="text-blue-400 font-bold">${m.sender}:</span> <span class="text-gray-300">${m.message}</span></div>`; }); chat.scrollTop = chat.scrollHeight;
    }
}

export function renderLootboxTab(container) { container.innerHTML = '<div class="p-4 grid grid-cols-1 md:grid-cols-2 gap-4"></div>'; for(const k in lootboxConfig) { const b=lootboxConfig[k]; container.firstChild.innerHTML += `<div class="bg-gray-800 p-4 rounded-lg border border-gray-700 flex flex-col text-center"><div class="text-4xl mb-2">${b.icon}</div><h3 class="text-xl font-bold text-white">${b.name}</h3><p class="text-sm text-gray-400 flex-grow my-2">${b.description || ''}</p><div class="text-lg font-semibold text-blue-400 mb-3">${fmt(b.cost)} VC</div><button class="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-2 px-4 rounded transition" data-open-box="${k}">Otwórz</button></div>`; } }
export function renderMarket(container) { if(!state.marketListings.length) return renderEmptyState(container, "Brak ofert na giełdzie."); state.marketListings.forEach((l, i) => { const el = document.createElement('div'); el.className="p-3 border-b border-gray-800 flex gap-3 items-center"; el.innerHTML = `<div class="w-12 h-12 bg-gray-800 rounded flex items-center justify-center">${getIconHtml(l.vehicle.type)}</div><div class="flex-grow"><h4 class="font-bold text-white">${l.vehicle.customName||l.vehicle.title}</h4><div class="text-xs text-gray-400">Sprzedaje: ${l.seller}</div></div><div class="text-right"><div class="text-blue-400 font-bold">${fmt(l.price)} VC</div><button class="bg-blue-600 hover:bg-blue-500 text-white font-bold px-3 py-1 rounded text-sm mt-1" data-buy-market="${i}">Kup</button></div>`; container.appendChild(el); }); }
export function renderRankings(container) { const renderList = (title, data, key, unit) => { renderSectionTitle(container, title); const list = document.createElement('ul'); data.slice(0, 20).forEach((p, i) => { const el = document.createElement('li'); el.className = `flex items-center p-2 border-b border-gray-800 text-sm ${p.isPlayer ? 'bg-blue-900/30 border-l-2 border-blue-500' : ''}`; el.innerHTML = `<div class="w-8 text-center font-bold text-gray-500">${i + 1}</div><div class="flex-grow font-medium text-white">${p.name}</div><div class="font-semibold text-blue-400">${fmt(p[key])} ${unit}</div>`; list.appendChild(el); }); container.appendChild(list); }; renderList('Wartość Aktywów', state.rankings.assetValue, 'assetValue', 'VC'); renderList('Zysk Tygodniowy', state.rankings.weeklyEarnings, 'weeklyEarnings', 'VC'); }
export function renderCharts(container) { container.innerHTML = `<div class="chart-carousel h-full flex flex-col p-2"><div class="carousel-track-container"><div class="carousel-track"><div class="carousel-slide"><div class="chart-wrapper"><h4 class="font-bold text-center text-lg mb-2">Podsumowanie Floty</h4><div id="fleet-summary-container" class="overflow-y-auto flex-grow pr-2"></div></div></div><div class="carousel-slide"><div class="chart-wrapper"><h4 class="font-bold text-center text-lg mb-2">Przychody (godz.)</h4><div class="flex-grow relative"><canvas id="earningsChart"></canvas></div></div></div><div class="carousel-slide"><div class="chart-wrapper"><h4 class="font-bold text-center text-lg mb-2">Struktura floty</h4><div class="flex-grow relative"><canvas id="compositionChart"></canvas></div></div></div></div></div><div class="flex justify-center gap-4 p-2"><button id="prevChartBtn" class="bg-gray-700 hover:bg-gray-600 rounded-full w-8 h-8"><i class="ri-arrow-left-s-line"></i></button><button id="nextChartBtn" class="bg-gray-700 hover:bg-gray-600 rounded-full w-8 h-8"><i class="ri-arrow-right-s-line"></i></button></div></div>`; 
    const summaryContainer = $('fleet-summary-container'); 
    const fleetStats = {}; ['plane', 'train', 'tube', 'bus', 'bike', 'river-bus', 'tram'].forEach(type => { fleetStats[type] = { count: 0, totalEarnings: 0, totalValue: 0 }; });
    for (const key in state.owned) { const v = state.owned[key]; if (fleetStats[v.type]) { fleetStats[v.type].count++; fleetStats[v.type].totalEarnings += v.earned_vc || 0; fleetStats[v.type].totalValue += config.basePrice[v.type] || 0; } }
    for (const type in fleetStats) { const data = fleetStats[type]; if (data.count > 0) { const el = document.createElement('div'); el.className = 'bg-gray-800/50 p-3 rounded-lg border border-gray-700/50 mb-2'; el.innerHTML = `<div class="flex items-center gap-2 font-bold mb-2"><span class="text-xl">${ICONS[type]}</span><span>${type} (${data.count})</span></div><div class="grid grid-cols-2 gap-x-4 gap-y-1 text-xs"><span class="text-gray-400">Wartość:</span><span class="text-right font-medium">${fmt(data.totalValue)} VC</span><span class="text-gray-400">Zarobek:</span><span class="text-right font-medium">${fmt(data.totalEarnings)} VC</span></div>`; summaryContainer.appendChild(el); } } 
    const earningsCtx = $('earningsChart').getContext('2d'); new Chart(earningsCtx, { type: 'line', data: { labels: Array(60).fill(''), datasets: [{ label: 'VC', data: state.profile.earnings_history, borderColor: '#3b82f6', tension: 0.3 }] }, options: { responsive: true, maintainAspectRatio: false } }); 
    const compositionCtx = $('compositionChart').getContext('2d'); const fleetComp = Object.values(state.owned).reduce((acc, v) => { acc[v.type] = (acc[v.type] || 0) + 1; return acc; }, {}); new Chart(compositionCtx, { type: 'doughnut', data: { labels: Object.keys(fleetComp), datasets: [{ data: Object.values(fleetComp), backgroundColor: ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'] }] }, options: { responsive: true, maintainAspectRatio: false } });
    let cur = 0; const track = document.querySelector('.carousel-track'); $('nextChartBtn').onclick = () => { if(cur < 2) { cur++; track.style.transform = `translateX(-${cur * 100}%)`; } }; $('prevChartBtn').onclick = () => { if(cur > 0) { cur--; track.style.transform = `translateX(-${cur * 100}%)`; } }; }
export function renderAchievements(container) { for(const k in achievementsList) { const a=achievementsList[k]; const u=state.achievements[k]; const el=document.createElement('div'); el.className = `p-3 border-b border-gray-800 flex items-center gap-4 ${!u?.unlocked ? 'opacity-50' : ''} ${u?.claimed ? 'bg-green-900/20' : ''}`; const action = (!u?.unlocked || u.claimed) ? '' : `<button class="ml-auto bg-green-600 text-white py-1 px-3 rounded-md text-sm hover:bg-green-500" data-claim="${k}">Odbierz</button>`; el.innerHTML = `<div class="text-3xl">${u?.unlocked ? '🏆' : '🔒'}</div><div class="flex-grow"><h4 class="font-semibold text-white">${a.title}</h4><p class="text-xs text-gray-400">${a.description}</p></div>${action}`; container.appendChild(el); } }
export function renderEnergyPrices(container) { container.innerHTML = `<div class="p-4"><table class="w-full text-sm text-left text-gray-400"><thead class="text-xs text-gray-300 uppercase bg-gray-800"><tr><th class="px-4 py-2">Region</th><th class="px-4 py-2">Typ</th><th class="px-4 py-2">Cena</th></tr></thead><tbody id="energy-prices-body"></tbody></table></div>`; const tbody = $('energy-prices-body'); for (const c in state.economy.energyPrices) { for (const t in state.economy.energyPrices[c]) { const row = tbody.insertRow(); row.className="border-b border-gray-800"; row.innerHTML=`<td class="px-4 py-2 font-medium text-white">${c}</td><td class="px-4 py-2">${t}</td><td class="px-4 py-2 font-bold text-blue-400">${state.economy.energyPrices[c][t].toFixed(2)}</td>`; } } }
export function renderTransactionHistory(container) { (state.profile.transaction_history||[]).forEach(t => { const el=document.createElement('div'); el.className="p-3 border-b border-gray-800 flex justify-between items-center"; el.innerHTML=`<div><p class="font-medium text-white">${t.description}</p><p class="text-xs text-gray-500">${new Date(t.timestamp).toLocaleString()}</p></div><div class="text-right"><p class="font-bold ${t.amount>=0?'text-green-400':'text-red-400'}">${t.amount>0?'+':''}${fmt(t.amount)} VC</p></div>`; container.appendChild(el); }); }
export function renderCompanyTab(container) { const logos = ['🏢', '🏭', '🚀', '🌐', '⚡️', '🚂', '✈️', '🚌', '🚢', '⭐']; const colors = ['blue', 'green', 'red', 'yellow', 'purple']; const colorHex = { blue: '#3b82f6', green: '#22c55e', red: '#ef4444', yellow: '#eab308', purple: '#8b5cf6' }; container.innerHTML = `<div class="p-4 space-y-6"><div><h3 class="text-lg font-semibold mb-2">Nazwa</h3><div class="bg-gray-800/50 p-4 rounded-lg border border-gray-700 space-y-3"><input type="text" id="company-name-input" value="${state.profile.companyName}" class="w-full bg-gray-900 border border-gray-600 rounded-md px-3 py-1.5 text-white"><button id="save-company-btn" class="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-2 px-4 rounded-md">Zapisz</button></div></div><div><h3 class="text-lg font-semibold mb-2">Logo</h3><div class="bg-gray-800/50 p-4 rounded-lg border border-gray-700 grid grid-cols-5 gap-3">${logos.map(l => `<button class="text-3xl p-2 bg-gray-700 rounded-md hover:bg-gray-600 transition" data-logo="${l}">${l}</button>`).join('')}</div></div><div><h3 class="text-lg font-semibold mb-2">Kolor</h3><div class="bg-gray-800/50 p-4 rounded-lg border border-gray-700 flex justify-around">${colors.map(c => `<button class="w-10 h-10 rounded-full border-2 border-transparent hover:border-white transition" style="background:${colorHex[c]}" data-color="${c}"></button>`).join('')}</div></div></div>`; }
export function renderFriendsTab(container) { container.innerHTML = `<div class="p-4 space-y-4"><div><h3 class="text-lg font-semibold mb-2">Dodaj</h3><div class="flex gap-2"><input type="text" id="friend-name-input" class="flex-grow bg-gray-900 border border-gray-600 rounded-md px-3 py-1.5 text-white"><button id="add-friend-btn" class="bg-green-600 hover:bg-green-500 text-white font-bold px-4 rounded-md">Dodaj</button></div></div><div id="friends-list" class="space-y-2"></div></div>`; const list = $('friends-list'); (state.profile.friends || []).forEach((f, i) => { const el = document.createElement('div'); el.className = 'flex justify-between items-center bg-gray-800/50 p-3 rounded-lg border border-gray-700'; el.innerHTML = `<span class="font-medium text-white">${f}</span><button class="text-red-500 hover:text-red-400" data-remove-friend="${i}"><i class="ri-delete-bin-line"></i></button>`; list.appendChild(el); }); }