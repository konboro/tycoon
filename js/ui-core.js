// js/ui-core.js - ZARZĄDZANIE WIDOKIEM
import { state } from './state.js';
import { config } from './config.js';
import { map } from './state.js';
import { $, fmt, getProximityBonus, createIcon, getIconHtml, ICONS } from './utils.js';

// Importujemy "Malarzy" z pliku, który przed chwilą stworzyłeś
import { 
    renderVehicleList, renderInfrastructure, renderLootboxTab, renderMarket, 
    renderRankings, renderCharts, renderAchievements, renderEnergyPrices, 
    renderTransactionHistory, renderGuildTab, renderCompanyTab, renderFriendsTab, 
    renderStationDetails, renderVehicleCard, renderEmptyState 
} from './renderers.js';

// Helpery obliczeniowe dla UI
export function calculateAssetValue() {
    const fleetValue = Object.values(state.owned).reduce((sum, v) => sum + (config.basePrice[v.type] || 0), 0);
    const infraValue = Object.values(state.infrastructure).reduce((sum, category) => { return sum + Object.keys(category).reduce((catSum, key) => { return catSum + (category[key].owned ? config.infrastructure[key].price : 0); }, 0); }, 0);
    return state.wallet + fleetValue + infraValue;
}

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
    const xpBar = $('xpProgressBar'); if(xpBar) xpBar.style.width = `${(state.profile.xp / (100+(state.profile.level-1)*50))*100}%`;
    
    set('owned-vehicles-count', Object.keys(state.owned).length);
    const buildingCount = Object.values(state.infrastructure).reduce((sum, category) => sum + Object.values(category).filter(item => item.owned).length, 0);
    set('owned-buildings-count', buildingCount);
    const estimatedAssets = Math.max(0, calculateAssetValue() - state.wallet);
    set('estimated-assets', fmt(estimatedAssets));
    
    // Odometer i inne bajery
    const earningsHistory = state.profile.earnings_history || [];
    const hourlyEstimate = earningsHistory.reduce((a, b) => a + b, 0) * (60 / Math.max(1, earningsHistory.length));
    const odometer = $('hourly-earnings-odometer');
    if(odometer) {
        const formattedEarnings = Math.round(hourlyEstimate).toLocaleString('pl-PL').padStart(8, '0');
        odometer.innerHTML = '';
        for (const digit of formattedEarnings) { if (digit === ' ' || digit === '.' || digit === ',') {} else { const digitEl = document.createElement('span'); digitEl.className = 'odometer-digit'; digitEl.textContent = digit; odometer.appendChild(digitEl); } }
        const labelEl = document.createElement('span'); labelEl.className = 'odometer-label'; labelEl.textContent = 'VC/h'; odometer.appendChild(labelEl);
    }

    const hasUnclaimed = Object.values(state.achievements).some(a => a.unlocked && !a.claimed);
    const dot = $('ach-notification-dot'); if(dot) dot.style.display = hasUnclaimed ? 'block' : 'none';
    set('company-logo', state.profile.logo || '🏢');
    
    const kpiPanel = $('kpi-panel');
    if(kpiPanel) {
        kpiPanel.classList.remove('border-blue-500', 'border-green-500', 'border-red-500', 'border-yellow-500', 'border-purple-500');
        kpiPanel.classList.add(`border-${state.profile.color}-500`);
    }
}

const panelTitles = { stations: "Infrastruktura", store: "Sklep", fleet: "Moja Flota", market: "Giełda", lootbox: "Skrzynki", achievements: "Osiągnięcia", stats: "Statystyki", friends: "Znajomi", rankings: "Ranking", energy: "Ceny Energii", guild: "Gildia", transactions: "Historia Transakcji", company: "Personalizacja Firmy" };

export function render() {
    const listContainer = $('mainList');
    if(!listContainer) return;
    listContainer.innerHTML = '';
    const titleEl = $('panel-title'); if(titleEl) titleEl.textContent = panelTitles[state.activeTab] || state.activeTab;
    
    const controls = $('panel-controls');
    if(controls) controls.style.display = ['store','fleet','market'].includes(state.activeTab) ? 'block' : 'none';
    const filtersContainer = $('filters-container');

    // Renderowanie filtrów (można to też przenieść do renderers, ale jest krótkie)
    if (['store','fleet','market'].includes(state.activeTab) && filtersContainer) {
        filtersContainer.innerHTML = '';
        let filterHtml = `<div id="filterRarity"><h4 class="font-semibold text-sm mb-2">Rzadkość</h4><div class="space-y-1 text-sm"><label class="flex items-center"><input type="checkbox" value="common" ${state.filters.rarities.includes('common') ? 'checked' : ''} class="mr-2 rounded bg-gray-700 border-gray-500 text-blue-500 focus:ring-blue-600"> Common</label><label class="flex items-center"><input type="checkbox" value="rare" ${state.filters.rarities.includes('rare') ? 'checked' : ''} class="mr-2 rounded bg-gray-700 border-gray-500 text-blue-500 focus:ring-blue-600"> Rare</label><label class="flex items-center"><input type="checkbox" value="epic" ${state.filters.rarities.includes('epic') ? 'checked' : ''} class="mr-2 rounded bg-gray-700 border-gray-500 text-blue-500 focus:ring-blue-600"> Epic</label><label class="flex items-center"><input type="checkbox" value="legendary" ${state.filters.rarities.includes('legendary') ? 'checked' : ''} class="mr-2 rounded bg-gray-700 border-gray-500 text-blue-500 focus:ring-blue-600"> Legendary</label></div></div><div id="filterMapView"><h4 class="font-semibold text-sm mb-2">Widok mapy</h4><div class="space-y-1 text-sm"><label class="flex items-center"><input type="radio" name="mapView" value="all" ${state.filters.mapView === 'all' ? 'checked' : ''} class="mr-2 bg-gray-700 border-gray-500 text-blue-500 focus:ring-blue-600"> Wszystkie</label><label class="flex items-center"><input type="radio" name="mapView" value="fleet" ${state.filters.mapView === 'fleet' ? 'checked' : ''} class="mr-2 bg-gray-700 border-gray-500 text-blue-500 focus:ring-blue-600"> Moja flota</label></div></div>`;
        if (state.activeTab !== 'stations') { filterHtml += `<div id="filterType"><h4 class="font-semibold text-sm mb-2">Typ</h4><div class="space-y-1 text-sm"><label class="flex items-center"><input type="checkbox" value="plane" ${state.filters.types.includes('plane') ? 'checked' : ''} class="mr-2 rounded"> Samoloty</label><label class="flex items-center"><input type="checkbox" value="train" ${state.filters.types.includes('train') ? 'checked' : ''} class="mr-2 rounded"> Pociągi</label><label class="flex items-center"><input type="checkbox" value="tube" ${state.filters.types.includes('tube') ? 'checked' : ''} class="mr-2 rounded"> Metro</label><label class="flex items-center"><input type="checkbox" value="tram" ${state.filters.types.includes('tram') ? 'checked' : ''} class="mr-2 rounded"> Tramwaje</label><label class="flex items-center"><input type="checkbox" value="bus" ${state.filters.types.includes('bus') ? 'checked' : ''} class="mr-2 rounded"> Autobusy</label><label class="flex items-center"><input type="checkbox" value="bike" ${state.filters.types.includes('bike') ? 'checked' : ''} class="mr-2 rounded"> Sharing</label></div></div><div id="filterCountry"><h4 class="font-semibold text-sm mb-2">Kraj</h4><div class="space-y-1 text-sm"><label class="flex items-center"><input type="checkbox" value="USA" ${state.filters.countries.includes('USA') ? 'checked' : ''} class="mr-2 rounded"> USA</label><label class="flex items-center"><input type="checkbox" value="Poland" ${state.filters.countries.includes('Poland') ? 'checked' : ''} class="mr-2 rounded"> Polska</label><label class="flex items-center"><input type="checkbox" value="Finland" ${state.filters.countries.includes('Finland') ? 'checked' : ''} class="mr-2 rounded"> Finlandia</label><label class="flex items-center"><input type="checkbox" value="UK" ${state.filters.countries.includes('UK') ? 'checked' : ''} class="mr-2 rounded"> UK</label></div></div>`; }
        filtersContainer.innerHTML = filterHtml;
    }
    
    // ROUTER WIDOKÓW
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
    if (state.selectedVehicleKey) { renderVehicleCard(state.selectedVehicleKey); } else { const vc = $('vehicle-card'); if(vc) vc.classList.add('translate-y-full'); }
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