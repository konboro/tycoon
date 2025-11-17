// js/achievements.js
import { state } from './state.js';
import { showNotification } from './utils.js';
import { updateUI } from './ui-core.js';

// Lista osiągnięć
export const achievementsList = {
    FIRST_PURCHASE: { title: "Pierwszy zakup", description: "Kup swój pierwszy pojazd.", reward: { vc: 1000, xp: 50 }, check: () => Object.keys(state.owned).length >= 1 },
    TEN_VEHICLES: { title: "Mała flota", description: "Posiadaj 10 pojazdów.", reward: { vc: 5000, xp: 200 }, check: () => Object.keys(state.owned).length >= 10 },
    FIFTY_VEHICLES: { title: "Prawdziwy Magnat", description: "Posiadaj 50 pojazdów.", reward: { vc: 25000, xp: 1000 }, check: () => Object.keys(state.owned).length >= 50 },
    EARN_100K: { title: "Pierwsze 100 tysięcy", description: "Zarób łącznie 100,000 VC.", reward: { vc: 10000, xp: 500 }, check: () => state.profile.total_earned >= 100000 },
    FIRST_MILLION: { title: "Pierwszy Milion", description: "Zarób łącznie 1,000,000 VC.", reward: { vc: 100000, xp: 2500 }, check: () => state.profile.total_earned >= 1000000 },
    LEVEL_5: { title: "Weteran", description: "Osiągnij 5 poziom.", reward: { vc: 10000, xp: 0 }, check: () => state.profile.level >= 5 },
    STATION_OWNER: { title: "Baron Kolejowy", description: "Kup swój pierwszy dworzec.", reward: { vc: 750000, xp: 7500 }, check: () => Object.values(state.infrastructure.trainStations).some(a => a.owned) },
    FINNISH_RAIL_LORD: { title: "Władca Finlandii", description: "Posiadaj oba dworce w Finlandii.", reward: { vc: 2500000, xp: 10000 }, check: () => state.infrastructure.trainStations.HKI.owned && state.infrastructure.trainStations.TPE.owned },
    ONE_THOUSAND_KM: { title: "Tysiąc kilometrów", description: "Przejedź łącznie 1000 km.", reward: { vc: 10000, xp: 250 }, check: () => state.profile.km_total >= 1000 },
    MECHANIC_1: { title: "Mechanik I", description: "Serwisuj pojazdy 10 razy.", reward: { vc: 5000, xp: 100 }, check: () => state.profile.services_done >= 10 },
    FIRST_UPGRADE: { title: "Pierwsze ulepszenie", description: "Ulepsz dowolny pojazd.", reward: { vc: 10000, xp: 200 }, check: () => state.profile.upgrades_done >= 1 },
    MAX_OUT_VEHICLE: { title: "Maksymalna moc", description: "Ulepsz dowolny pojazd do maks. poziomu.", reward: { vc: 100000, xp: 2000 }, check: () => Object.values(state.owned).some(v => v.level >= 5) },
};

// Logika sprawdzania (przeniesiona z logic.js)
export function checkAchievements() { 
    for (const key in achievementsList) { 
        if (!state.achievements[key] && achievementsList[key].check()) { 
            state.achievements[key] = { unlocked: true, claimed: false, date: new Date().toISOString() }; 
            showNotification(`🏆 Osiągnięcie: ${achievementsList[key].title}`);
        } 
    } 
    updateUI(); 
}

// Logika levelowania (przeniesiona z logic.js)
export function checkLevelUp() { 
    function xpNeededForLevel(level) { return 100 + (level - 1) * 50; } 
    while (state.profile.xp >= xpNeededForLevel(state.profile.level)) { 
        state.profile.xp -= xpNeededForLevel(state.profile.level); 
        state.profile.level++; 
        showNotification(`⭐ Awans na poziom ${state.profile.level}!`);
    } 
}