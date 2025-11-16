// js/supabase.js - WERSJA Z PEŁNĄ OBSŁUGĄ GILDII I OFFLINE
import { state, logTransaction } from './state.js';
import { updateUI, render } from './ui-core.js'; // Pamiętaj o ui-core!
import { map } from './state.js';
import { $, fmt, showNotification } from './utils.js';
import { config } from './config.js';
import { fetchGlobalTakenVehicles } from './api.js';

const SUPABASE_URL = 'https://xvbeklwkznsgckoozfgp.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh2YmVrbHdrem5zZ2Nrb296ZmdwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMyMDkzMTcsImV4cCI6MjA3ODc4NTMxN30.aVZ5zDxoCgG906jIHBMxDepdOYh8eO1o_tsGlkamOR4';

export const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const otherPlayersMarkers = {};
let myUserId = null;

export async function handleLogin() {
    const email = $('auth-email').value;
    const password = $('auth-password').value;
    const errorMsg = $('auth-error');
    if(!email || !password) { errorMsg.textContent = "Podaj email i hasło."; errorMsg.classList.remove('hidden'); return; }
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { errorMsg.textContent = "Błąd: " + error.message; errorMsg.classList.remove('hidden'); } else { $('auth-modal').style.display = 'none'; loadProfileFromSupabase(data.user.id); showNotification("Zalogowano!"); }
}

export async function handleRegister() {
    const email = $('auth-email').value;
    const password = $('auth-password').value;
    const errorMsg = $('auth-error');
    if(!email || !password) { errorMsg.textContent = "Podaj email i hasło."; errorMsg.classList.remove('hidden'); return; }
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) { errorMsg.textContent = "Błąd: " + error.message; errorMsg.classList.remove('hidden'); } else { errorMsg.textContent = "Konto założone! Sprawdź email."; errorMsg.classList.remove('hidden'); errorMsg.className = "text-green-500 text-sm text-center"; }
}

export async function loadProfileFromSupabase(userId) {
    console.log("Pobieranie danych...");
    
    // 1. Profil
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', userId).single();

    if (profile) {
        state.wallet = profile.wallet;
        state.profile.companyName = profile.company_name;
        state.profile.level = profile.level;
        state.profile.xp = profile.xp;
        if (profile.lat && profile.lon) map.setView([profile.lat, profile.lon], 13);

        // 2. Flota
        const { data: myVehicles } = await supabase.from('vehicles').select('*').eq('owner_id', userId);
        
        // Offline - Pojazdy
        let offlineEarningsTotal = 0;
        const lastSeenDate = profile.last_seen ? new Date(profile.last_seen) : new Date();
        const minutesOffline = Math.min(1440, Math.max(0, (new Date() - lastSeenDate) / (1000 * 60)));

        if (myVehicles) {
            state.owned = {}; 
            myVehicles.forEach(row => {
                const key = `${row.type}:${row.vehicle_api_id}`;
                let baseData = state.vehicles[row.type]?.get(row.vehicle_api_id) || {};
                const typeConfig = config.estimatedDailyKm[row.type] || 0; 
                const rateConfig = config.baseRate[row.type] || 0; 
                let vEarn = 0, vKm = 0;

                if (minutesOffline > 1) {
                    vKm = (typeConfig / (24 * 60)) * minutesOffline * 0.8;
                    vEarn = vKm * rateConfig;
                    row.wear = Math.min(100, row.wear + (vKm / 1000));
                }
                offlineEarningsTotal += vEarn;

                state.owned[key] = {
                    ...baseData, id: row.vehicle_api_id, type: row.type, customName: row.custom_name, purchaseDate: row.purchase_date, wear: row.wear, isMoving: row.is_moving,
                    odo_km: (row.odo_km || 0) + vKm, earned_vc: (row.earned_total || 0) + vEarn, totalEnergyCost: 0, earningsLog: []
                };
            });
        }

        // 3. Infrastruktura
        const { data: myStations } = await supabase.from('user_infrastructure').select('station_id').eq('owner_id', userId);
        if (myStations) {
            for (const cat in state.infrastructure) for (const sId in state.infrastructure[cat]) state.infrastructure[cat][sId].owned = false;
            myStations.forEach(row => {
                const sId = row.station_id;
                for(const cat in state.infrastructure) if(state.infrastructure[cat][sId]) state.infrastructure[cat][sId].owned = true;
            });
        }

        // 4. GILDIA - Wczytywanie i Offline Zarobek
        const { data: guildMember } = await supabase.from('guild_members').select('guild_id').eq('user_id', userId).single();
        
        if (guildMember) {
            const guildId = guildMember.guild_id;
            const { data: guildData } = await supabase.from('guilds').select('*').eq('id', guildId).single();
            const { data: chatData } = await supabase.from('guild_chat').select('*').eq('guild_id', guildId).order('created_at', { ascending: true }).limit(50);

            if (guildData) {
                state.guild.playerGuildId = guildId;
                state.guild.guilds[guildId] = {
                    name: guildData.name,
                    leader: 'Lider', // Uproszczenie, można pobrać nazwę lidera
                    description: guildData.description,
                    bank: guildData.bank,
                    ownedAssets: guildData.owned_assets || {},
                    members: [], // Można dociągnąć listę
                    chat: chatData || []
                };

                // --- GILDIA OFFLINE EARNINGS ---
                // Oblicz ile zarobiła gildia od ostatniego zapisu
                const guildLastTick = guildData.last_tick ? new Date(guildData.last_tick) : new Date();
                const guildMinutesOffline = Math.min(1440, Math.max(0, (new Date() - guildLastTick) / (1000 * 60)));
                
                let guildOfflineIncome = 0;
                if (guildMinutesOffline > 1) {
                    for (const assetKey in guildData.owned_assets) {
                        if (config.guildAssets[assetKey]) {
                            guildOfflineIncome += config.guildAssets[assetKey].incomePerTick * guildMinutesOffline;
                        }
                    }
                    
                    if (guildOfflineIncome > 0) {
                        state.guild.guilds[guildId].bank += guildOfflineIncome;
                        // Zapisz nowy stan banku i czas od razu
                        await supabase.from('guilds').update({ 
                            bank: state.guild.guilds[guildId].bank,
                            last_tick: new Date().toISOString()
                        }).eq('id', guildId);
                        
                        showNotification(`🏭 Gildia zarobiła offline: ${fmt(guildOfflineIncome)} VC`);
                    }
                }
            }
        }

        // 5. Zapisz zarobki gracza
        if (offlineEarningsTotal > 0) {
            state.wallet += Math.floor(offlineEarningsTotal);
            await supabase.from('profiles').update({ wallet: state.wallet, last_seen: new Date().toISOString() }).eq('id', userId);
            showNotification(`💰 Twoja flota zarobiła offline: ${fmt(offlineEarningsTotal)} VC`, false);
        }

        updateUI();
        startMultiplayer(userId); 
        startServerSync();
        await fetchGlobalTakenVehicles();

    } else { console.error("Błąd profilu."); }
}

export function startServerSync() {
    setInterval(async () => {
        const user = (await supabase.auth.getUser()).data.user;
        if (!user) return;

        // Zapisz profil
        await supabase.from('profiles').update({
            wallet: state.wallet, xp: state.profile.xp, level: state.profile.level,
            lat: state.playerLocation?.lat || 0, lon: state.playerLocation?.lon || 0,
            last_seen: new Date().toISOString()
        }).eq('id', user.id);

        // Zapisz pojazdy
        for (const key in state.owned) {
            const v = state.owned[key];
            if (v.earned_vc > 0 || v.odo_km > 0) {
                await supabase.from('vehicles').update({ odo_km: v.odo_km, earned_total: v.earned_vc, wear: v.wear, is_moving: v.isMoving }).eq('vehicle_api_id', v.id).eq('owner_id', user.id);
            }
        }
        
        // Zapisz Gildię (tylko jeśli jesteśmy liderem lub dla uproszczenia każdy wysyła stan banku co jakiś czas)
        // W idealnym świecie to serwer robi ticki, tutaj robimy to "przy okazji" z klienta
        if (state.guild.playerGuildId) {
            const g = state.guild.guilds[state.guild.playerGuildId];
            // Aktualizujemy tylko bank i czas ticka
            await supabase.from('guilds').update({ 
                bank: g.bank, 
                last_tick: new Date().toISOString() 
            }).eq('id', state.guild.playerGuildId);
        }

        console.log(" [SYNC] Zapisano stan.");
    }, 30000);
}

async function startMultiplayer(userId) {
    myUserId = userId;
    setInterval(async () => {
        if (state.playerLocation && myUserId) {
            await supabase.from('profiles').update({ lat: state.playerLocation.lat, lon: state.playerLocation.lon, last_seen: new Date().toISOString() }).eq('id', myUserId);
        }
    }, 5000);
    supabase.channel('public:profiles').on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, payload => updateOtherPlayerOnMap(payload.new)).subscribe();
    fetchAllPlayersOnce();
}

function updateOtherPlayerOnMap(playerData) {
    if (playerData.id === myUserId || !playerData.lat || !playerData.lon) return;
    if ((new Date() - new Date(playerData.last_seen)) > 5 * 60 * 1000) return;
    if (otherPlayersMarkers[playerData.id]) { otherPlayersMarkers[playerData.id].setLatLng([playerData.lat, playerData.lon]).setPopupContent(`<b>${playerData.company_name}</b><br>Lvl: ${playerData.level}`); } 
    else { const icon = L.divIcon({ className: 'player-location-icon', html: `<div class="text-3xl text-blue-400">🚚</div>`, iconSize: [32, 32], iconAnchor: [16, 32] }); const marker = L.marker([playerData.lat, playerData.lon], { icon: icon }).addTo(map); marker.bindPopup(`<b>${playerData.company_name}</b>`); otherPlayersMarkers[playerData.id] = marker; }
}
async function fetchAllPlayersOnce() { const { data: players } = await supabase.from('profiles').select('*'); if (players) players.forEach(p => updateOtherPlayerOnMap(p)); }