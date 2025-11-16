import { state, achievementsList, logTransaction } from './state.js';
import { config, lootboxConfig } from './config.js';
import { supabase } from './supabase.js';
import { $, fmt, showNotification, showConfirm, getProximityBonus, getWeatherIcon, ICONS, createIcon, getVehicleRarity, getIconHtml } from './utils.js';
import { fetchGlobalTakenVehicles } from './api.js';
import { map } from './state.js';

// ... (Funkcje pomocnicze: openLootbox, quickSellVehicle itp. pozostają bez zmian - skopiuj je sobie z poprzedniego pliku lub zostaw jeśli masz) ...
// DLA PEWNOŚCI WKLEJAM TU SKRÓCONE WERSJE FUNKCJI AKCJI - UPEWNIJ SIĘ ŻE MASZ PEŁNE
function openLootbox(boxType) { /* ... kod openLootbox ... */ }
function quickSellVehicle(key) { /* ... kod quickSellVehicle ... */ }
function openSellModal(key) { /* ... kod openSellModal ... */ }
function upgradeVehicle(key) { /* ... kod upgradeVehicle ... */ }
function editVehicleName(key) { /* ... kod editVehicleName ... */ }
function calculateStatsFromLog(log, key, h) { return 0; }
export function openAssetDetailsModal(key) { /* ... kod ... */ }

// ===== GŁÓWNE RENDERERY =====

export function renderEmptyState(container, msg) { container.innerHTML = `<div class="text-center p-8 text-gray-500">${msg}</div>`; }
export function renderSectionTitle(container, title) { container.innerHTML += `<div class="px-4 py-2 bg-gray-800 text-sm font-bold sticky top-0">${title}</div>`; }

// ... (Funkcje: renderVehicleList, renderVehicleCard, renderInfrastructure, renderStationDetails - BEZ ZMIAN, skopiuj je) ...

// !!! TUTAJ JEST ZMIANA - FUNKCJA GILDII !!!
export function renderGuildTab(container) {
    const { playerGuildId, guilds } = state.guild;
    
    if (!playerGuildId) {
        // Brak gildii - formularz
        container.innerHTML = `
            <div class="p-4 space-y-6">
                <div class="bg-gray-800/50 p-4 rounded-lg border border-gray-700/50">
                    <h3 class="text-lg font-bold mb-2 text-white">Załóż Gildię</h3>
                    <input type="text" id="guild-name-input" placeholder="Nazwa..." class="w-full bg-gray-900 border border-gray-600 rounded p-2 mb-2 text-white">
                    <button id="create-guild-btn" class="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-2 rounded">Koszt: ${fmt(config.guilds.creationCost)} VC</button>
                </div>
                <div>
                    <h3 class="text-lg font-bold mb-2 text-white">Dostępne Gildie</h3>
                    <div id="guild-list" class="space-y-2"></div>
                </div>
            </div>`;
        const list = $('guild-list');
        for (const gid in guilds) {
            const g = guilds[gid];
            list.innerHTML += `<div class="flex justify-between bg-gray-800 p-3 rounded border border-gray-700 items-center"><span class="text-white">${g.name}</span><button class="bg-blue-600 px-3 py-1 rounded text-white text-sm" data-join-guild="${gid}">Dołącz</button></div>`;
        }
    } else {
        // Widok członka gildii
        const myGuild = guilds[playerGuildId];
        if(!myGuild) return; // Safety check

        // Obliczamy dochód pasywny
        let totalIncome = 0;
        for(const k in myGuild.ownedAssets) if(config.guildAssets[k]) totalIncome += config.guildAssets[k].incomePerTick;

        container.innerHTML = `
            <div class="p-4 space-y-4 h-full flex flex-col">
                <div class="bg-gray-800/90 p-4 rounded-xl border border-indigo-500/30 shadow-lg">
                    <div class="flex justify-between items-start">
                        <div>
                            <h2 class="text-2xl font-bold text-white">${myGuild.name}</h2>
                            <p class="text-xs text-gray-400">Lider: ${myGuild.leader}</p>
                        </div>
                        <div class="text-right">
                            <div class="text-xs text-gray-400">Skarbiec</div>
                            <div class="text-xl font-mono font-bold text-yellow-400">${fmt(myGuild.bank)} VC</div>
                            <div class="text-xs text-green-400">+${fmt(totalIncome)} VC/min</div>
                        </div>
                    </div>
                    
                    <div class="flex gap-2 mt-3 border-t border-gray-700 pt-3">
                        <input type="number" id="treasury-amount" placeholder="Kwota" class="w-24 bg-gray-900 text-white text-xs p-1 rounded border border-gray-600">
                        <button id="deposit-treasury-btn" class="bg-green-700 hover:bg-green-600 text-white text-xs px-3 py-1 rounded">Wpłać</button>
                        <button id="withdraw-treasury-btn" class="bg-orange-700 hover:bg-orange-600 text-white text-xs px-3 py-1 rounded">Wypłać</button>
                        <button class="ml-auto bg-red-900/50 hover:bg-red-900 text-red-200 text-xs px-3 py-1 rounded" data-leave-guild>Opuść</button>
                    </div>
                </div>

                <div class="flex-grow overflow-y-auto space-y-4">
                    <div>
                        <h3 class="font-bold text-white mb-2">Posiadane Elektrownie</h3>
                        <div id="guild-owned-list" class="space-y-2"></div>
                    </div>
                    <div>
                        <h3 class="font-bold text-white mb-2">Rynek Inwestycyjny</h3>
                        <div id="guild-shop-list" class="space-y-2"></div>
                    </div>
                </div>

                <div class="h-32 bg-gray-900/50 rounded-lg border border-gray-700 flex flex-col">
                    <div id="guild-chat-messages" class="flex-grow overflow-y-auto p-2 text-xs"></div>
                    <div class="flex p-1 border-t border-gray-700">
                        <input id="chat-message-input" class="flex-grow bg-transparent text-white px-2 outline-none" placeholder="Czat...">
                        <button id="send-chat-msg-btn" class="text-blue-400 px-2">></button>
                    </div>
                </div>
            </div>`;

        // Render list
        const ownedDiv = $('guild-owned-list');
        const shopDiv = $('guild-shop-list');
        const allOwned = Object.values(guilds).flatMap(g => Object.keys(g.ownedAssets || {}));

        // Posiadane
        for(const k in myGuild.ownedAssets) {
            const a = config.guildAssets[k];
            ownedDiv.innerHTML += `<div class="bg-green-900/20 border border-green-700/50 p-2 rounded flex justify-between items-center"><div class="flex items-center gap-2"><div class="text-xl">${ICONS['asset_power-plant']}</div><div><div class="font-bold text-white text-sm">${a.name}</div><div class="text-xs text-gray-400">Zysk: ${fmt(a.incomePerTick)}/min</div></div></div></div>`;
        }
        if(Object.keys(myGuild.ownedAssets).length === 0) ownedDiv.innerHTML = '<div class="text-xs text-gray-500">Brak aktywów. Kup coś!</div>';

        // Sklep
        for(const k in config.guildAssets) {
            if(allOwned.includes(k)) continue; // Już zajęte
            const a = config.guildAssets[k];
            shopDiv.innerHTML += `
                <div class="bg-gray-800 border border-gray-700 p-2 rounded flex justify-between items-center">
                    <div class="flex items-center gap-2">
                        <div class="text-xl grayscale opacity-50">${ICONS['asset_power-plant']}</div>
                        <div><div class="font-bold text-white text-sm">${a.name}</div><div class="text-xs text-gray-400">${a.country} • ${a.realProduction}</div></div>
                    </div>
                    <button class="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-3 py-1 rounded" data-buy-guild-asset="${k}">Kup ${fmt(a.price)}</button>
                </div>`;
        }

        // Czat
        const chatBox = $('guild-chat-messages');
        (myGuild.chat || []).forEach(m => {
            chatBox.innerHTML += `<div><span class="text-blue-400 font-bold">${m.sender}:</span> <span class="text-gray-300">${m.message}</span></div>`;
        });
        chatBox.scrollTop = chatBox.scrollHeight;
    }
}

// ... (Pozostałe funkcje renderujące - Company, Friends, Stats... - BEZ ZMIAN) ...

// ===== EVENT LISTENERS (AKTUALIZACJA DLA SKARBCA I ZAKUPÓW) =====
export function setupEventListeners() {
    // ... (standardowe listenery tabów i modali - BEZ ZMIAN) ...
    document.querySelectorAll('[data-nav-tab]').forEach(btn => { btn.addEventListener('click', () => { const tab = btn.dataset.navTab; if (tab === 'profile') return; state.activeTab = tab; render(); toggleContentPanel(true); }); });
    $('close-content-panel').addEventListener('click', () => toggleContentPanel(false));

    $('mainList').addEventListener('click', e => {
        // ... (tutaj wklej listenery kupowania pojazdów, stacji, giełdy z poprzedniego pliku) ...

        // --- OBSŁUGA GILDII (NOWE) ---
        
        // 1. Tworzenie
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
        // 2. Dołączanie
        const joinBtn = e.target.closest('[data-join-guild]');
        if (joinBtn) {
            const gid = joinBtn.dataset.joinGuild;
            state.guild.playerGuildId = gid;
            state.guild.guilds[gid].members.push(state.profile.companyName);
            render(); showNotification("Dołączono!");
        }
        // 3. Kupno Aktywa (Elektrowni)
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
            } else {
                showNotification("Za mało środków w skarbcu gildii!", true);
            }
        }
        // 4. Wpłata do skarbca
        if (e.target.id === 'deposit-treasury-btn') {
            const amount = parseInt($('treasury-amount').value);
            if (amount > 0 && state.wallet >= amount) {
                state.wallet -= amount;
                state.guild.guilds[state.guild.playerGuildId].bank += amount;
                render(); showNotification(`Wpłacono ${fmt(amount)} VC.`);
            }
        }
        // 5. Wypłata ze skarbca
        if (e.target.id === 'withdraw-treasury-btn') {
            const amount = parseInt($('treasury-amount').value);
            const myGuild = state.guild.guilds[state.guild.playerGuildId];
            if (amount > 0 && myGuild.bank >= amount) {
                myGuild.bank -= amount;
                state.wallet += amount;
                render(); showNotification(`Wypłacono ${fmt(amount)} VC.`);
            }
        }
        // 6. Czat
        if (e.target.id === 'send-chat-msg-btn') {
            const input = $('chat-message-input');
            if(input.value) {
                state.guild.guilds[state.guild.playerGuildId].chat.push({
                    sender: state.profile.companyName, 
                    message: input.value, 
                    timestamp: new Date().toISOString()
                });
                input.value = ''; render();
            }
        }
        // 7. Opuszczenie
        if (e.target.closest('[data-leave-guild]')) {
            showConfirm("Opuścić gildię?", () => {
                // Prosta logika usuwania (dla MVP)
                const gid = state.guild.playerGuildId;
                state.guild.guilds[gid].members = state.guild.guilds[gid].members.filter(m => m !== state.profile.companyName);
                state.guild.playerGuildId = null;
                render();
            });
        }
    });
}