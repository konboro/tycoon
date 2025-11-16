import { state } from './state.js';
import { config } from './config.js';
import { map } from './state.js';
import { $, fmt, getProximityBonus, createIcon, getIconHtml, ICONS, getWeatherIcon } from './utils.js';

// Importujemy "Malarzy"
import { 
    renderVehicleList, renderInfrastructure, renderLootboxTab, renderMarket, 
    renderRankings, renderCharts, renderAchievements, renderEnergyPrices, 
    renderTransactionHistory, renderGuildTab, renderCompanyTab, renderFriendsTab, 
    renderStationDetails, renderVehicleCard, renderEmptyState, renderSectionTitle
} from './renderers.js';

// ===== 1. FUNKCJE HELPERY UI =====

export function calculateAssetValue() {
    const fleetValue = Object.values(state.owned).reduce((sum, v) => sum + (config.basePrice[v.type] || 0), 0);
    const infraValue = Object.values(state.infrastructure).reduce((sum, category) => { return sum + Object.keys(category).reduce((catSum, key) => { return catSum + (category[key].owned ? config.infrastructure[key].price : 0); }, 0); }, 0);
    return state.wallet + fleetValue + infraValue;
}

export function toggleContentPanel(forceVisible) {
    const panel = $('content-panel');
    if (!panel) return;
    const isHidden = panel.classList.contains('-translate-x-full');
    const shouldShow = typeof forceVisible === 'boolean' ? forceVisible : isHidden;

    panel.classList.toggle('-translate-x-full', !shouldShow);
    panel.classList.toggle('translate-x-0', shouldShow);

    if (!shouldShow) {
        state.activeTab = null;
        document.querySelectorAll('.nav-item.bg-gray-800').forEach(el => el.classList.remove('bg-gray-800', 'text-white'));
    }
}

// ===== 2. GEOLOKALIZACJA I MAPA (BRAKOWAŁO TEGO!) =====

function getCompanyInfoPopupContent() {
    const companyName = state.profile.companyName || 'Moja Firma';
    const vehicleCount = Object.keys(state.owned).length;
    let buildingCount = 0;
    Object.values(state.infrastructure).forEach(category => {
        Object.values(category).forEach(item => { if (item.owned) buildingCount++; });
    });
    const companyValue = calculateAssetValue();
    return `<div style="font-family: 'Inter', sans-serif;"><h3 style="margin: 0; font-size: 16px; font-weight: bold;">${companyName}</h3><ul style="list-style: none; padding: 0; margin: 8px 0 0 0; font-size: 14px;"><li style="margin-bottom: 4px;"><strong>Pojazdy:</strong> ${vehicleCount}</li><li style="margin-bottom: 4px;"><strong>Budynki:</strong> ${buildingCount}</li><li><strong>Wartość firmy:</strong> ${fmt(companyValue)} VC</li></ul></div>`;
}

export function showPlayerLocation() {
    if ('geolocation' in navigator) {
        navigator.geolocation.watchPosition(position => {
            const { latitude, longitude } = position.coords;
            state.playerLocation = { lat: latitude, lon: longitude }; // Zapisz w stanie
            
            const playerIcon = L.divIcon({
                className: 'player-location-icon',
                html: `<div class="text-3xl">${state.profile.logo || '🏢'}</div>`,
                iconSize: [32, 32],
                iconAnchor: [16, 32]
            });

            if (state.playerMarker) {
                state.playerMarker.setLatLng([latitude, longitude]);
            } else {
                state.playerMarker = L.marker([latitude, longitude], { icon: playerIcon }).addTo(map);
                state.playerMarker.bindPopup(getCompanyInfoPopupContent);
                map.setView([latitude, longitude], 13);
            }

            // Kółko zasięgu (100km)
            if (state.proximityCircle) {
                state.proximityCircle.setLatLng([latitude, longitude]);
            } else {
                state.proximityCircle = L.circle([latitude, longitude], {
                    radius: 100000, // 100km
                    color: 'green',
                    fillColor: '#22c55e',
                    fillOpacity: 0.15,
                    weight: 1
                }).addTo(map);
            }

        }, (error) => {
            console.warn("Nie można uzyskać lokalizacji:", error.message);
        }, {
            enableHighAccuracy: true,
            timeout: 5000,
            maximumAge: 0
        });
    } else {
        console.warn("Geolokalizacja nie jest wspierana przez tę przeglądarkę.");
    }
}

export function updatePlayerMarkerIcon() {
    if (state.playerMarker) {
        const playerIcon = L.divIcon({
            className: 'player-location-icon',
            html: `<div class="text-3xl">${state.profile.logo || '🏢'}</div>`,
            iconSize: [32, 32],
            iconAnchor: [16, 32]
        });
        state.playerMarker.setIcon(playerIcon);
    }
}

export function redrawMap() {
    const visibleKeys = new Set();
    
    // 1. Rysowanie pojazdów
    Object.values(state.vehicles).forEach(vehicleMap => {
        for (const v of vehicleMap.values()) {
            const key = `${v.type}:${v.id}`;
            const isOwned = !!state.owned[key];
            
            // Filtr widoku "Tylko moje"
            if (state.filters.mapView === 'fleet' && !isOwned) continue;
            
            const typeMatch = state.filters.types.includes(v.type);
            const countryMatch = !v.country || state.filters.countries.includes(v.country);
            
            if (typeMatch && countryMatch && v.lat != null && isFinite(v.lat) && v.lon != null && isFinite(v.lon)) {
                visibleKeys.add(key);
                let entry = state.markers.get(key);
                
                // Używamy getIconHtml dla obrazków
                const iconHtml = `<div class="w-full h-full flex items-center justify-center transition-transform duration-500">${getIconHtml(v.type, "w-8 h-8")}</div>`;
                
                if (!entry) {
                    const marker = L.marker([v.lat, v.lon], { icon: createIcon(isOwned && v.isMoving) }).addTo(map);
                    marker.getElement().innerHTML = iconHtml;
                    
                    marker.on('click', () => { 
                        // Pobierz dane pojazdu (live lub owned)
                        const vData = state.vehicles[v.type]?.get(v.id);
                        if (!vData) return;
                        state.selectedVehicleKey = key;
                        render(); // Odśwież UI, żeby pokazać kartę
                    });
                    
                    entry = { marker, trail: null };
                    state.markers.set(key, entry);
                } else {
                    // Płynne przesuwanie (jeśli obiekt już jest)
                    entry.marker.setLatLng([v.lat, v.lon]);
                    entry.marker.getElement().innerHTML = iconHtml;
                    
                    // Aktualizacja klasy CSS dla animacji pulsowania
                    const iconEl = entry.marker.getElement();
                    if (iconEl) {
                        if (isOwned && v.isMoving) iconEl.classList.add('is-moving');
                        else iconEl.classList.remove('is-moving');
                    }
                }
                
                // Ślad trasy (Trail)
                if (isOwned && v.history && v.history.length > 1) {
                    const latlngs = v.history.map(p => [p.lat, p.lon]);
                    if (entry.trail) { entry.trail.setLatLngs(latlngs); } 
                    else { entry.trail = L.polyline(latlngs, { color: 'rgba(59, 130, 246, 0.5)', weight: 3 }).addTo(map); }
                } else if (entry.trail) { 
                    entry.trail.remove(); entry.trail = null; 
                }
            }
        }
    });

    // Czyszczenie starych markerów (pojazdów, które zniknęły)
    for (const [key, entry] of state.markers.entries()) {
        if (!visibleKeys.has(key) && !key.startsWith('station:') && !key.startsWith('guildasset:')) {
            if(entry.marker) entry.marker.remove();
            if(entry.trail) entry.trail.remove();
            state.markers.delete(key);
        }
    }
    
    // 2. Rysowanie Stacji (Infrastruktury)
    for (const stationCode in config.infrastructure) {
        const station = config.infrastructure[stationCode];
        const key = `station:${stationCode}`;
        if (station && !state.markers.has(key)) {
            const marker = L.marker([station.lat, station.lon], { 
                icon: L.divIcon({ 
                    className: 'leaflet-marker-icon', 
                    html: `<div class="w-10 h-10 drop-shadow-lg">${getIconHtml('station_' + station.type)}</div>`, 
                    iconSize: [40, 40], 
                    iconAnchor: [20, 20] 
                }) 
            }).addTo(map);
            marker.bindPopup(`<b>${station.name}</b>`).on('click', () => { 
                state.activeTab = 'stations';
                state.selectedStationId = stationCode;
                render();
                toggleContentPanel(true);
            });
            state.markers.set(key, { marker });
        }
    }

    // 3. Rysowanie Aktywów Gildii (Elektrownie)
    for (const assetKey in config.guildAssets) {
        const asset = config.guildAssets[assetKey];
        const key = `guildasset:${assetKey}`;
        
        // Sprawdź właściciela
        let ownerGuildName = null;
        for (const guildId in state.guild.guilds) {
            if (state.guild.guilds[guildId].ownedAssets && state.guild.guilds[guildId].ownedAssets[assetKey]) {
                ownerGuildName = state.guild.guilds[guildId].name;
                break;
            }
        }
        
        let popupContent = `<b>${asset.name}</b><br>${asset.realProduction}`;
        if (ownerGuildName) popupContent += `<br><span class="text-blue-400">Właściciel: ${ownerGuildName}</span>`;
        else popupContent += `<br><span class="text-green-400">Na sprzedaż</span>`;

        if (!state.markers.has(key)) {
             const marker = L.marker([asset.lat, asset.lon], {
                 icon: L.divIcon({ 
                     className: 'leaflet-marker-icon', 
                     html: `<div class="w-12 h-12 drop-shadow-xl">${getIconHtml('asset_power-plant')}</div>`, 
                     iconSize: [48, 48], 
                     iconAnchor: [24, 24] 
                 })
            }).addTo(map);
            marker.bindPopup(popupContent).on('click', () => { 
                state.activeTab = 'guild';
                render();
                toggleContentPanel(true);
            });
            state.markers.set(key, { marker });
        } else {
            state.markers.get(key).marker.getPopup().setContent(popupContent);
        }
    }
}

// ===== 3. GŁÓWNA AKTUALIZACJA UI =====

export function updateUI(inM, outM) {
    const setTxt = (id, val) => { const el = $(id); if (el) el.textContent = val; };
    setTxt('wallet', fmt(state.wallet));
    setTxt('company-name', state.profile.companyName);
    setTxt('level', state.profile.level);
    setTxt('xp', Math.round(state.profile.xp));
    setTxt('xpNext', 100 + (state.profile.level-1)*50);
    const xpBar = $('xpProgressBar'); if(xpBar) xpBar.style.width = `${(state.profile.xp / (100+(state.profile.level-1)*50))*100}%`;
    
    setTxt('owned-vehicles-count', Object.keys(state.owned).length);
    const buildingCount = Object.values(state.infrastructure).reduce((sum, category) => sum + Object.values(category).filter(item => item.owned).length, 0);
    setTxt('owned-buildings-count', buildingCount);
    const estimatedAssets = Math.max(0, calculateAssetValue() - state.wallet);
    setTxt('estimated-assets', fmt(estimatedAssets));
    
    // Odometer
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
    setTxt('company-logo', state.profile.logo || '🏢');
    
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
    const filtersContainer = $('filters-container');
    const showControls = ['store', 'fleet', 'stations', 'market'].includes(state.activeTab);
    if(controls) controls.style.display = showControls ? 'block' : 'none';

    // Filtry
    if (showControls && filtersContainer) {
        filtersContainer.innerHTML = '';
        let filterHtml = `<div id="filterRarity"><h4 class="font-semibold text-sm mb-2">Rzadkość</h4><div class="space-y-1 text-sm"><label class="flex items-center"><input type="checkbox" value="common" ${state.filters.rarities.includes('common') ? 'checked' : ''} class="mr-2 rounded bg-gray-700 border-gray-500 text-blue-500 focus:ring-blue-600"> Common</label><label class="flex items-center"><input type="checkbox" value="rare" ${state.filters.rarities.includes('rare') ? 'checked' : ''} class="mr-2 rounded bg-gray-700 border-gray-500 text-blue-500 focus:ring-blue-600"> Rare</label><label class="flex items-center"><input type="checkbox" value="epic" ${state.filters.rarities.includes('epic') ? 'checked' : ''} class="mr-2 rounded bg-gray-700 border-gray-500 text-blue-500 focus:ring-blue-600"> Epic</label><label class="flex items-center"><input type="checkbox" value="legendary" ${state.filters.rarities.includes('legendary') ? 'checked' : ''} class="mr-2 rounded bg-gray-700 border-gray-500 text-blue-500 focus:ring-blue-600"> Legendary</label></div></div><div id="filterMapView"><h4 class="font-semibold text-sm mb-2">Widok mapy</h4><div class="space-y-1 text-sm"><label class="flex items-center"><input type="radio" name="mapView" value="all" ${state.filters.mapView === 'all' ? 'checked' : ''} class="mr-2 bg-gray-700 border-gray-500 text-blue-500 focus:ring-blue-600"> Wszystkie</label><label class="flex items-center"><input type="radio" name="mapView" value="fleet" ${state.filters.mapView === 'fleet' ? 'checked' : ''} class="mr-2 bg-gray-700 border-gray-500 text-blue-500 focus:ring-blue-600"> Moja flota</label></div></div>`;
        if (state.activeTab !== 'stations') { filterHtml += `<div id="filterType"><h4 class="font-semibold text-sm mb-2">Typ</h4><div class="space-y-1 text-sm"><label class="flex items-center"><input type="checkbox" value="plane" ${state.filters.types.includes('plane') ? 'checked' : ''} class="mr-2 rounded"> Samoloty</label><label class="flex items-center"><input type="checkbox" value="train" ${state.filters.types.includes('train') ? 'checked' : ''} class="mr-2 rounded"> Pociągi</label><label class="flex items-center"><input type="checkbox" value="tube" ${state.filters.types.includes('tube') ? 'checked' : ''} class="mr-2 rounded"> Metro</label><label class="flex items-center"><input type="checkbox" value="tram" ${state.filters.types.includes('tram') ? 'checked' : ''} class="mr-2 rounded"> Tramwaje</label><label class="flex items-center"><input type="checkbox" value="bus" ${state.filters.types.includes('bus') ? 'checked' : ''} class="mr-2 rounded"> Autobusy</label><label class="flex items-center"><input type="checkbox" value="bike" ${state.filters.types.includes('bike') ? 'checked' : ''} class="mr-2 rounded"> Sharing</label></div></div><div id="filterCountry"><h4 class="font-semibold text-sm mb-2">Kraj</h4><div class="space-y-1 text-sm"><label class="flex items-center"><input type="checkbox" value="USA" ${state.filters.countries.includes('USA') ? 'checked' : ''} class="mr-2 rounded"> USA</label><label class="flex items-center"><input type="checkbox" value="Poland" ${state.filters.countries.includes('Poland') ? 'checked' : ''} class="mr-2 rounded"> Polska</label><label class="flex items-center"><input type="checkbox" value="Finland" ${state.filters.countries.includes('Finland') ? 'checked' : ''} class="mr-2 rounded"> Finlandia</label><label class="flex items-center"><input type="checkbox" value="UK" ${state.filters.countries.includes('UK') ? 'checked' : ''} class="mr-2 rounded"> UK</label></div></div>`; }
        filtersContainer.innerHTML = filterHtml;
    }
    
    // Router widoków
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
    
    // Pokaż/Ukryj kartę pojazdu
    const vehicleCard = $('vehicle-card');
    if (vehicleCard) {
        if (state.selectedVehicleKey) { renderVehicleCard(state.selectedVehicleKey); } 
        else { vehicleCard.classList.add('translate-y-full'); }
    }
    
    redrawMap();
}