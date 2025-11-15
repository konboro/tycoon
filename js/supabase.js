import { state, logTransaction } from './state.js';
import { updateUI, render } from './ui.js';
import { map } from './main.js';
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
    if (error) { errorMsg.textContent = "Błąd: " + error.message; errorMsg.classList.remove('hidden'); } else { $('auth-modal').style.display = 'none'; loadProfileFromSupabase(data.user.id); showNotification("Zalogowano pomyślnie! Witaj w grze."); }
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
    console.log("Pobieranie profilu i floty z serwera...");
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (profile) {
        state.wallet = profile.wallet; state.profile.companyName = profile.company_name; state.profile.level = profile.level; state.profile.xp = profile.xp;
        if (profile.lat && profile.lon) map.setView([profile.lat, profile.lon], 13);
        const { data: myVehicles } = await supabase.from('vehicles').select('*').eq('owner_id', userId);
        
        let offlineEarningsTotal = 0;
        let offlineKmTotal = 0;
        const lastSeenDate = profile.last_seen ? new Date(profile.last_seen) : new Date();
        const minutesOffline = Math.min(1440, Math.max(0, (new Date() - lastSeenDate) / (1000 * 60)));

        if (myVehicles) {
            state.owned = {}; 
            myVehicles.forEach(row => {
                const key = `${row.type}:${row.vehicle_api_id}`;
                let baseData = state.vehicles[row.type]?.get(row.vehicle_api_id) || {};
                // Kalkulacja offline
                const typeConfig = config.estimatedDailyKm[row.type] || 0; 
                const rateConfig = config.baseRate[row.type] || 0; 
                let vehicleOfflineEarnings = 0;
                let vehicleOfflineKm = 0;
                if (minutesOffline > 1) {
                    const kmPerMinute = typeConfig / (24 * 60);
                    vehicleOfflineKm = kmPerMinute * minutesOffline * 0.8;
                    vehicleOfflineEarnings = vehicleOfflineKm * rateConfig;
                    row.wear = Math.min(100, row.wear + (vehicleOfflineKm / 1000));
                }
                offlineEarningsTotal += vehicleOfflineEarnings;
                offlineKmTotal += vehicleOfflineKm;

                state.owned[key] = {
                    ...baseData, id: row.vehicle_api_id, type: row.type, customName: row.custom_name, purchaseDate: row.purchase_date, wear: row.wear, isMoving: row.is_moving,
                    odo_km: (row.odo_km || 0) + vehicleOfflineKm, 
                    earned_vc: (row.earned_total || 0) + vehicleOfflineEarnings,
                    totalEnergyCost: 0, earningsLog: []
                };
            });
        }
        if (offlineEarningsTotal > 0) {
            const earnedInt = Math.floor(offlineEarningsTotal);
            state.wallet += earnedInt;
            state.profile.km_total += Math.floor(offlineKmTotal);
            setTimeout(() => showNotification(`💰 Witaj ponownie! Twoja flota zarobiła offline: ${fmt(earnedInt)} VC`, false), 2000);
            await supabase.from('profiles').update({ wallet: state.wallet, lat: state.playerLocation?.lat, lon: state.playerLocation?.lon, last_seen: new Date().toISOString() }).eq('id', userId);
        }
        updateUI(); startMultiplayer(userId); startServerSync(); await fetchGlobalTakenVehicles();
    } else { console.error("Nie znaleziono profilu gracza."); }
}

export function startServerSync() {
    console.log("Uruchomiono system zapisu danych rzeczywistych.");
    setInterval(async () => {
        const user = (await supabase.auth.getUser()).data.user;
        if (!user) return;
        await supabase.from('profiles').update({ wallet: state.wallet, xp: state.profile.xp, level: state.profile.level, lat: state.playerLocation?.lat, lon: state.playerLocation?.lon, last_seen: new Date().toISOString() }).eq('id', user.id);
        for (const key in state.owned) {
            const v = state.owned[key];
            if (v.earned_vc > 0 || v.odo_km > 0) {
                await supabase.from('vehicles').update({ odo_km: v.odo_km, earned_total: v.earned_vc, wear: v.wear, is_moving: v.isMoving }).eq('vehicle_api_id', v.id).eq('owner_id', user.id);
            }
        }
        console.log(" [SYNC] Dane floty zapisane na serwerze.");
    }, 30000);
}

async function startMultiplayer(userId) {
    myUserId = userId;
    console.log("Uruchamianie radaru multiplayer...");
    setInterval(async () => { if (state.playerLocation && myUserId) { await supabase.from('profiles').update({ lat: state.playerLocation.lat, lon: state.playerLocation.lon, last_seen: new Date().toISOString() }).eq('id', myUserId); } }, 5000);
    supabase.channel('public:profiles').on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, payload => { updateOtherPlayerOnMap(payload.new); }).subscribe();
    fetchAllPlayersOnce();
}

function updateOtherPlayerOnMap(playerData) {
    if (playerData.id === myUserId || !playerData.lat || !playerData.lon) return;
    if ((new Date() - new Date(playerData.last_seen)) > 5 * 60 * 1000) return;
    if (otherPlayersMarkers[playerData.id]) { otherPlayersMarkers[playerData.id].setLatLng([playerData.lat, playerData.lon]).setPopupContent(`<b>${playerData.company_name}</b><br>Lvl: ${playerData.level}`); } 
    else { const icon = L.divIcon({ className: 'player-location-icon', html: `<div class="text-3xl text-blue-400" style="text-shadow: 0 0 5px black;">🚚</div>`, iconSize: [32, 32], iconAnchor: [16, 32] }); const marker = L.marker([playerData.lat, playerData.lon], { icon: icon }).addTo(map); marker.bindPopup(`<b>${playerData.company_name}</b><br>Lvl: ${playerData.level}`); otherPlayersMarkers[playerData.id] = marker; }
}

async function fetchAllPlayersOnce() { const { data: players } = await supabase.from('profiles').select('*'); if (players) players.forEach(p => updateOtherPlayerOnMap(p)); }