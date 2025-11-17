import { state, logTransaction } from './state.js';
import { updateUI, render } from './ui-core.js';
import { map } from './state.js';
import { $, fmt, showNotification } from './utils.js';
import { config } from './config.js';
import { fetchGlobalTakenVehicles } from './api.js';

const SUPABASE_URL = 'https://xvbeklwkznsgckoozfgp.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh2YmVrbHdrem5zZ2Nrb296ZmdwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMyMDkzMTcsImV4cCI6MjA3ODc4NTMxN30.aVZ5zDxoCgG906jIHBMxDepdOYh8eO1o_tsGlkamOR4';

export const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const otherPlayersMarkers = {};
let myUserId = null;

export async function handleLogin() { /* ... (bez zmian) ... */ }
export async function handleRegister() { /* ... (bez zmian) ... */ }

export async function loadProfileFromSupabase(userId) {
    console.log("Pobieranie danych...");
    
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', userId).single();

    if (profile) {
        state.wallet = profile.wallet;
        state.profile.companyName = profile.company_name;
        state.profile.level = profile.level;
        state.profile.xp = profile.xp;
        
        // --- NOWOŚĆ: ŁADOWANIE OSIĄGNIĘĆ Z BAZY ---
        state.achievements = profile.achievements || {};
        
        if (profile.lat && profile.lon) map.setView([profile.lat, profile.lon], 13);
        
        // ... (reszta kodu ładowania floty, stacji i gildii bez zmian) ...
        const { data: myVehicles } = await supabase.from('vehicles').select('*').eq('owner_id', userId);
        let offlineEarningsTotal = 0;
        const lastSeenDate = profile.last_seen ? new Date(profile.last_seen) : new Date();
        const minutesOffline = Math.min(1440, Math.max(0, (new Date() - lastSeenDate) / (1000 * 60)));
        if (myVehicles) { /* ... (cała logika offline pojazdów) ... */ }
        const { data: myStations } = await supabase.from('user_infrastructure').select('station_id').eq('owner_id', userId);
        if (myStations) { /* ... (cała logika ładowania stacji) ... */ }
        const { data: guildMember } = await supabase.from('guild_members').select('guild_id').eq('user_id', userId).single();
        if (guildMember) { /* ... (cała logika ładowania gildii i offline gildii) ... */ }
        if (offlineEarningsTotal > 0) { /* ... (logika zapisu offline) ... */ }

        updateUI();
        startMultiplayer(userId); 
        startServerSync();
        await fetchGlobalTakenVehicles();

    } else { console.error("Błąd profilu."); }
}

export function startServerSync() {
    console.log("Uruchomiono system zapisu danych rzeczywistych.");
    
    setInterval(async () => {
        const user = (await supabase.auth.getUser()).data.user;
        if (!user) return;

        await supabase.from('profiles').update({
            wallet: state.wallet,
            xp: state.profile.xp,
            level: state.profile.level,
            // --- NOWOŚĆ: ZAPIS OSIĄGNIĘĆ DO BAZY ---
            achievements: state.achievements,
            lat: state.playerLocation?.lat || 0,
            lon: state.playerLocation?.lon || 0,
            last_seen: new Date().toISOString()
        }).eq('id', user.id);

        // ... (reszta kodu sync bez zmian: pojazdy, gildie) ...
        for (const key in state.owned) { /* ... */ }
        if (state.guild.playerGuildId) { /* ... */ }

        console.log(" [SYNC] Zapisano stan.");
    }, 30000);
}

// ... (reszta pliku: startMultiplayer, updateOtherPlayerOnMap, fetchAllPlayersOnce - bez zmian) ...