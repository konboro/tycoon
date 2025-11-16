// js/ui.js - KONTROLER AKCJI
import { state, achievementsList, logTransaction } from './state.js';
import { config, lootboxConfig } from './config.js';
import { supabase } from './supabase.js';
import { $, fmt, showNotification, showConfirm, getVehicleRarity, getIconHtml, ICONS } from './utils.js';
import { map } from './state.js';
import { render, updateUI, toggleContentPanel, openAssetDetailsModal, calculateAssetValue } from './ui-core.js'; // Importujemy z CORE

// ===== FUNKCJE AKCJI =====

export function openLootbox(boxType) {
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

// ===== EVENT LISTENERS =====

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
                const { data, error } = await supabase.rpc('buy_vehicle_secure', { p_vehicle_api_id: id, p_vehicle_type: type, p_price: price, p_custom_name: vehicleData.title });
                if (error) { showNotification(error.message, true); return; }
                if (data.success) {
                    state.wallet = data.new_wallet; logTransaction(-price, `Zakup: ${vehicleData.title}`); 
                    state.owned[key] = { ...vehicleData, odo_km: 0, earned_vc: 0, wear: 0, purchaseDate: new Date().toISOString(), customName: null, level: 1, totalEnergyCost: 0, earningsLog: [], serviceHistory: [] }; 
                    state.globalTaken.add(key); updateUI(); render(); showNotification(`Zakupiono ${vehicleData.title}!`);
                } else { showNotification(data.message, true); if(data.message.includes('zajęty')) { state.globalTaken.add(key); render(); } }
            })(); 
            return; 
        }
        const buyStationTarget = e.target.closest('[data-buy-station]');
        if (buyStationTarget) { 
            e.stopPropagation(); 
            (async () => {
                const [id, priceStr] = buyStationTarget.dataset.buyStation.split('|'); 
                const price = parseInt(priceStr); 
                if (state.wallet >= price) { 
                    const { data, error } = await supabase.rpc('buy_station_secure', { p_station_id: id, p_price: price });
                    if (error) { showNotification(error.message, true); return; }
                    if (data.success) {
                        state.wallet = data.new_wallet;
                        for (const cat in state.infrastructure) { if(state.infrastructure[cat][id]) state.infrastructure[cat][id].owned = true; }
                        updateUI(); render(); showNotification("Zakupiono stację!");
                    } else { showNotification(data.message, true); }
                } else { showNotification('Za mało środków!', true); } 
            })();
            return; 
        }

        // GILDIE
        if (e.target.id === 'create-guild-btn') {
            const name = $('guild-name-input').value;
            if(name && state.wallet >= config.guilds.creationCost) {
                state.wallet -= config.guilds.creationCost;
                const gid = 'g' + Date.now();
                state.guild.guilds[gid] = { name, leader: state.profile.companyName, bank: 0, members: [state.profile.companyName], ownedAssets: {}, chat: [], description: "Nowa gildia" };
                state.guild.playerGuildId = gid;
                render(); showNotification("Gildia założona!");
            }
        }
        const joinBtn = e.target.closest('[data-join-guild]');
        if (joinBtn) { const gid = joinBtn.dataset.joinGuild; state.guild.playerGuildId = gid; state.guild.guilds[gid].members.push(state.profile.companyName); render(); showNotification("Dołączono!"); }
        
        const buyAssetBtn = e.target.closest('[data-buy-guild-asset]');
        if (buyAssetBtn) {
            const key = buyAssetBtn.dataset.buyGuildAsset;
            const asset = config.guildAssets[key];
            const myGuild = state.guild.guilds[state.guild.playerGuildId];
            if (myGuild.bank >= asset.price) {
                myGuild.bank -= asset.price;
                if (!myGuild.ownedAssets) myGuild.ownedAssets = {};
                myGuild.ownedAssets[key] = true;
                render(); showNotification(`Gildia kupiła ${asset.name}!`);
            } else { showNotification("Za mało środków w skarbcu!", true); }
        }
        if (e.target.id === 'deposit-treasury-btn') {
            const inputEl = document.getElementById('treasury-amount');
            if(inputEl) {
                const amount = parseInt(inputEl.value);
                if (amount > 0 && state.wallet >= amount) { state.wallet -= amount; state.guild.guilds[state.guild.playerGuildId].bank += amount; render(); showNotification(`Wpłacono ${fmt(amount)} VC.`); }
            }
        }
        if (e.target.id === 'withdraw-treasury-btn') {
            const inputEl = document.getElementById('treasury-amount');
            if(inputEl) {
                const amount = parseInt(inputEl.value);
                const myGuild = state.guild.guilds[state.guild.playerGuildId];
                if (amount > 0 && myGuild.bank >= amount) { myGuild.bank -= amount; state.wallet += amount; render(); showNotification(`Wypłacono ${fmt(amount)} VC.`); }
            }
        }
        if (e.target.id === 'send-chat-msg-btn') {
            const input = $('chat-message-input');
            if(input.value) { state.guild.guilds[state.guild.playerGuildId].chat.push({ sender: state.profile.companyName, message: input.value, timestamp: new Date().toISOString() }); input.value = ''; render(); }
        }
        if (e.target.closest('[data-leave-guild]')) {
            showConfirm("Opuścić gildię?", () => { const gid = state.guild.playerGuildId; state.guild.guilds[gid].members = state.guild.guilds[gid].members.filter(m => m !== state.profile.companyName); state.guild.playerGuildId = null; render(); });
        }

        const claimTarget = e.target.closest('[data-claim]'); if (claimTarget) { e.stopPropagation(); const key = claimTarget.dataset.claim; const ach = achievementsList[key]; state.wallet += ach.reward.vc; state.profile.xp += ach.reward.xp; state.achievements[key].claimed = true; render(); return; }
        const openBoxTarget = e.target.closest('[data-open-box]'); if (openBoxTarget) { e.stopPropagation(); openLootbox(openBoxTarget.dataset.openBox); return; }
        const vehicleItem = e.target.closest('[data-key]'); if (vehicleItem && !e.target.closest('button')) { state.selectedVehicleKey = vehicleItem.dataset.key; render(); }
        const centerTarget = e.target.closest('[data-center]'); if (centerTarget) { e.stopPropagation(); const key = centerTarget.dataset.center; const [type, ...idParts] = key.split(':'); const id = idParts.join(':'); const vehicle = state.vehicles[type]?.get(id) || state.owned[key]; if (vehicle && vehicle.lat != null && isFinite(vehicle.lat)) { map.setView([vehicle.lat, vehicle.lon], 14); toggleContentPanel(false); } return; }
        const infoTarget = e.target.closest('[data-info-key]'); if (infoTarget) { e.stopPropagation(); openAssetDetailsModal(infoTarget.dataset.infoKey); return; }
        const stationItem = e.target.closest('[data-station-id]'); if (stationItem && !e.target.closest('button')) { const stationId = stationItem.dataset.stationId; state.selectedStationId = state.selectedStationId === stationId ? null : stationId; render(); }
        const addFriendTarget = e.target.closest('#add-friend-btn'); if (addFriendTarget) { const input = $('friend-name-input'); const friendName = input.value.trim(); if (friendName && !state.profile.friends.includes(friendName)) { state.profile.friends.push(friendName); render(); input.value = ''; } return; }
        const removeFriendTarget = e.target.closest('[data-remove-friend]'); if (removeFriendTarget) { const index = parseInt(removeFriendTarget.dataset.removeFriend, 10); state.profile.friends.splice(index, 1); render(); return; }
        const saveCompanyTarget = e.target.closest('#save-company-btn'); if(saveCompanyTarget) { const newName = $('company-name-input').value.trim(); if(newName) { state.profile.companyName = newName; updateUI(); showNotification("Zapisano."); } }
        const logoTarget = e.target.closest('[data-logo]'); if(logoTarget) { state.profile.logo = logoTarget.dataset.logo; updatePlayerMarkerIcon(); render(); }
        const colorTarget = e.target.closest('[data-color]'); if(colorTarget) { state.profile.color = colorTarget.dataset.color; updateUI(); render(); }
        
        const buyMarketTarget = e.target.closest('[data-buy-market]');
        if (buyMarketTarget) { 
            e.stopPropagation(); 
            const index = parseInt(buyMarketTarget.dataset.buyMarket, 10); 
            const listing = state.marketListings[index]; 
            if (!listing) { showNotification('Oferta nieaktualna!', true); state.marketListings.splice(index, 1); render(); return; } 
            if (state.wallet >= listing.price) { 
                state.wallet -= listing.price; 
                logTransaction(-listing.price, `Zakup z giełdy: ${listing.vehicle.title || listing.vehicle.customName}`); 
                const key = `${listing.vehicle.type}:${listing.vehicle.id}`; 
                state.owned[key] = { ...listing.vehicle }; 
                state.marketListings.splice(index, 1); 
                showNotification(`Kupiono z giełdy!`); 
                render(); 
            } else { showNotification('Za mało środków!', true); } 
        }
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