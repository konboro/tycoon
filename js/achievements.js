// js/achievements.js - Achievement System Configuration
// This file contains all achievement definitions for easy editing and expansion

// Achievement categories for organization
export const ACHIEVEMENT_CATEGORIES = {
    FLEET: 'fleet',
    EARNINGS: 'earnings', 
    INFRASTRUCTURE: 'infrastructure',
    PROGRESSION: 'progression',
    OPERATIONS: 'operations',
    SOCIAL: 'social',
    SPECIAL: 'special'
};

// Main achievements registry
export const ACHIEVEMENTS = {
    // ===== FLEET ACHIEVEMENTS =====
    FIRST_PURCHASE: {
        id: 'FIRST_PURCHASE',
        category: ACHIEVEMENT_CATEGORIES.FLEET,
        title: "Pierwszy zakup",
        description: "Kup swój pierwszy pojazd.",
        icon: '🚗',
        reward: { vc: 1000, xp: 50 },
        check: (state) => Object.keys(state.owned).length >= 1,
        progress: (state) => ({ current: Object.keys(state.owned).length, target: 1 }),
        hidden: false,
        oneTime: true
    },
    
    SMALL_FLEET: {
        id: 'TEN_VEHICLES',
        category: ACHIEVEMENT_CATEGORIES.FLEET,
        title: "Mała flota",
        description: "Posiadaj 10 pojazdów.",
        icon: '🚙',
        reward: { vc: 5000, xp: 200 },
        check: (state) => Object.keys(state.owned).length >= 10,
        progress: (state) => ({ current: Object.keys(state.owned).length, target: 10 }),
        hidden: false,
        oneTime: true
    },
    
    MEDIUM_FLEET: {
        id: 'TWENTY_FIVE_VEHICLES',
        category: ACHIEVEMENT_CATEGORIES.FLEET,
        title: "Rosnąca flota",
        description: "Posiadaj 25 pojazdów.",
        icon: '🚛',
        reward: { vc: 15000, xp: 500 },
        check: (state) => Object.keys(state.owned).length >= 25,
        progress: (state) => ({ current: Object.keys(state.owned).length, target: 25 }),
        hidden: false,
        oneTime: true
    },
    
    TRANSPORT_TYCOON: {
        id: 'FIFTY_VEHICLES',
        category: ACHIEVEMENT_CATEGORIES.FLEET,
        title: "Prawdziwy Magnat",
        description: "Posiadaj 50 pojazdów.",
        icon: '🏆',
        reward: { vc: 25000, xp: 1000 },
        check: (state) => Object.keys(state.owned).length >= 50,
        progress: (state) => ({ current: Object.keys(state.owned).length, target: 50 }),
        hidden: false,
        oneTime: true
    },
    
    TRANSPORT_EMPIRE: {
        id: 'HUNDRED_VEHICLES',
        category: ACHIEVEMENT_CATEGORIES.FLEET,
        title: "Imperium Transportowe",
        description: "Posiadaj 100 pojazdów.",
        icon: '👑',
        reward: { vc: 100000, xp: 5000 },
        check: (state) => Object.keys(state.owned).length >= 100,
        progress: (state) => ({ current: Object.keys(state.owned).length, target: 100 }),
        hidden: false,
        oneTime: true
    },

    // ===== EARNINGS ACHIEVEMENTS =====
    FIRST_HUNDRED_K: {
        id: 'EARN_100K',
        category: ACHIEVEMENT_CATEGORIES.EARNINGS,
        title: "Pierwsze 100 tysięcy",
        description: "Zarób łącznie 100,000 VC.",
        icon: '💰',
        reward: { vc: 10000, xp: 500 },
        check: (state) => state.profile.total_earned >= 100000,
        progress: (state) => ({ current: state.profile.total_earned, target: 100000 }),
        hidden: false,
        oneTime: true
    },
    
    FIRST_MILLION: {
        id: 'FIRST_MILLION',
        category: ACHIEVEMENT_CATEGORIES.EARNINGS,
        title: "Pierwszy Milion",
        description: "Zarób łącznie 1,000,000 VC.",
        icon: '💎',
        reward: { vc: 100000, xp: 2500 },
        check: (state) => state.profile.total_earned >= 1000000,
        progress: (state) => ({ current: state.profile.total_earned, target: 1000000 }),
        hidden: false,
        oneTime: true
    },
    
    TEN_MILLION_CLUB: {
        id: 'TEN_MILLION',
        category: ACHIEVEMENT_CATEGORIES.EARNINGS,
        title: "Klub 10 Milionów",
        description: "Zarób łącznie 10,000,000 VC.",
        icon: '🌟',
        reward: { vc: 1000000, xp: 10000 },
        check: (state) => state.profile.total_earned >= 10000000,
        progress: (state) => ({ current: state.profile.total_earned, target: 10000000 }),
        hidden: false,
        oneTime: true
    },

    // ===== INFRASTRUCTURE ACHIEVEMENTS =====
    STATION_OWNER: {
        id: 'STATION_OWNER',
        category: ACHIEVEMENT_CATEGORIES.INFRASTRUCTURE,
        title: "Baron Kolejowy",
        description: "Kup swój pierwszy dworzec.",
        icon: '🏛️',
        reward: { vc: 750000, xp: 7500 },
        check: (state) => {
            return Object.values(state.infrastructure.trainStations).some(station => station.owned) ||
                   Object.values(state.infrastructure.tubeStations).some(station => station.owned) ||
                   Object.values(state.infrastructure.busTerminals).some(station => station.owned);
        },
        progress: (state) => {
            const ownedStations = [
                ...Object.values(state.infrastructure.trainStations).filter(s => s.owned),
                ...Object.values(state.infrastructure.tubeStations).filter(s => s.owned),
                ...Object.values(state.infrastructure.busTerminals).filter(s => s.owned)
            ].length;
            return { current: ownedStations, target: 1 };
        },
        hidden: false,
        oneTime: true
    },
    
    FINNISH_RAIL_LORD: {
        id: 'FINNISH_RAIL_LORD',
        category: ACHIEVEMENT_CATEGORIES.INFRASTRUCTURE,
        title: "Władca Finlandii",
        description: "Posiadaj oba dworce w Finlandii.",
        icon: '🇫🇮',
        reward: { vc: 2500000, xp: 10000 },
        check: (state) => {
            return state.infrastructure.trainStations.HKI?.owned && 
                   state.infrastructure.trainStations.TPE?.owned;
        },
        progress: (state) => {
            const finnishStations = [
                state.infrastructure.trainStations.HKI?.owned,
                state.infrastructure.trainStations.TPE?.owned
            ].filter(Boolean).length;
            return { current: finnishStations, target: 2 };
        },
        hidden: false,
        oneTime: true
    },
    
    INFRASTRUCTURE_MOGUL: {
        id: 'INFRASTRUCTURE_MOGUL',
        category: ACHIEVEMENT_CATEGORIES.INFRASTRUCTURE,
        title: "Potentat Infrastruktury",
        description: "Posiadaj 5 różnych stacji/budynków.",
        icon: '🏗️',
        reward: { vc: 5000000, xp: 15000 },
        check: (state) => {
            const totalOwned = Object.values(state.infrastructure).reduce((sum, category) => {
                return sum + Object.values(category).filter(item => item.owned).length;
            }, 0);
            return totalOwned >= 5;
        },
        progress: (state) => {
            const totalOwned = Object.values(state.infrastructure).reduce((sum, category) => {
                return sum + Object.values(category).filter(item => item.owned).length;
            }, 0);
            return { current: totalOwned, target: 5 };
        },
        hidden: false,
        oneTime: true
    },

    // ===== PROGRESSION ACHIEVEMENTS =====
    LEVEL_UP: {
        id: 'LEVEL_5',
        category: ACHIEVEMENT_CATEGORIES.PROGRESSION,
        title: "Weteran",
        description: "Osiągnij 5 poziom.",
        icon: '⭐',
        reward: { vc: 10000, xp: 0 },
        check: (state) => state.profile.level >= 5,
        progress: (state) => ({ current: state.profile.level, target: 5 }),
        hidden: false,
        oneTime: true
    },
    
    EXPERIENCED_MANAGER: {
        id: 'LEVEL_10',
        category: ACHIEVEMENT_CATEGORIES.PROGRESSION,
        title: "Doświadczony Menedżer",
        description: "Osiągnij 10 poziom.",
        icon: '🌟',
        reward: { vc: 50000, xp: 0 },
        check: (state) => state.profile.level >= 10,
        progress: (state) => ({ current: state.profile.level, target: 10 }),
        hidden: false,
        oneTime: true
    },
    
    MASTER_EXECUTIVE: {
        id: 'LEVEL_20',
        category: ACHIEVEMENT_CATEGORIES.PROGRESSION,
        title: "Mistrz Wykonawczy",
        description: "Osiągnij 20 poziom.",
        icon: '💼',
        reward: { vc: 200000, xp: 0 },
        check: (state) => state.profile.level >= 20,
        progress: (state) => ({ current: state.profile.level, target: 20 }),
        hidden: false,
        oneTime: true
    },

    // ===== OPERATIONS ACHIEVEMENTS =====
    TRAVELER: {
        id: 'ONE_THOUSAND_KM',
        category: ACHIEVEMENT_CATEGORIES.OPERATIONS,
        title: "Tysiąc kilometrów",
        description: "Przejedź łącznie 1000 km.",
        icon: '🛣️',
        reward: { vc: 10000, xp: 250 },
        check: (state) => state.profile.km_total >= 1000,
        progress: (state) => ({ current: state.profile.km_total, target: 1000 }),
        hidden: false,
        oneTime: true
    },
    
    LONG_HAULER: {
        id: 'TEN_THOUSAND_KM',
        category: ACHIEVEMENT_CATEGORIES.OPERATIONS,
        title: "Dalekobieżny",
        description: "Przejedź łącznie 10,000 km.",
        icon: '🌍',
        reward: { vc: 50000, xp: 1000 },
        check: (state) => state.profile.km_total >= 10000,
        progress: (state) => ({ current: state.profile.km_total, target: 10000 }),
        hidden: false,
        oneTime: true
    },
    
    MECHANIC_APPRENTICE: {
        id: 'MECHANIC_1',
        category: ACHIEVEMENT_CATEGORIES.OPERATIONS,
        title: "Mechanik I",
        description: "Serwisuj pojazdy 10 razy.",
        icon: '🔧',
        reward: { vc: 5000, xp: 100 },
        check: (state) => state.profile.services_done >= 10,
        progress: (state) => ({ current: state.profile.services_done, target: 10 }),
        hidden: false,
        oneTime: true
    },
    
    MASTER_MECHANIC: {
        id: 'MECHANIC_5',
        category: ACHIEVEMENT_CATEGORIES.OPERATIONS,
        title: "Mistrz Mechanik",
        description: "Serwisuj pojazdy 50 razy.",
        icon: '⚙️',
        reward: { vc: 25000, xp: 500 },
        check: (state) => state.profile.services_done >= 50,
        progress: (state) => ({ current: state.profile.services_done, target: 50 }),
        hidden: false,
        oneTime: true
    },
    
    FIRST_UPGRADE: {
        id: 'FIRST_UPGRADE',
        category: ACHIEVEMENT_CATEGORIES.OPERATIONS,
        title: "Pierwsze ulepszenie",
        description: "Ulepsz dowolny pojazd.",
        icon: '⬆️',
        reward: { vc: 10000, xp: 200 },
        check: (state) => state.profile.upgrades_done >= 1,
        progress: (state) => ({ current: state.profile.upgrades_done, target: 1 }),
        hidden: false,
        oneTime: true
    },
    
    MAXED_OUT: {
        id: 'MAX_OUT_VEHICLE',
        category: ACHIEVEMENT_CATEGORIES.OPERATIONS,
        title: "Maksymalna moc",
        description: "Ulepsz dowolny pojazd do maksymalnego poziomu.",
        icon: '🚀',
        reward: { vc: 100000, xp: 2000 },
        check: (state) => Object.values(state.owned).some(v => (v.level || 1) >= 5),
        progress: (state) => {
            const maxLevel = Math.max(0, ...Object.values(state.owned).map(v => v.level || 1));
            return { current: maxLevel, target: 5 };
        },
        hidden: false,
        oneTime: true
    },

    // ===== SOCIAL ACHIEVEMENTS =====
    GUILD_FOUNDER: {
        id: 'GUILD_FOUNDER',
        category: ACHIEVEMENT_CATEGORIES.SOCIAL,
        title: "Założyciel Gildii",
        description: "Załóż własną gildię.",
        icon: '🏛️',
        reward: { vc: 500000, xp: 5000 },
        check: (state) => {
            const guild = state.guild.guilds[state.guild.playerGuildId];
            return guild && guild.leader === state.profile.companyName;
        },
        progress: (state) => {
            const isLeader = state.guild.guilds[state.guild.playerGuildId]?.leader === state.profile.companyName;
            return { current: isLeader ? 1 : 0, target: 1 };
        },
        hidden: false,
        oneTime: true
    },
    
    SOCIAL_BUTTERFLY: {
        id: 'SOCIAL_BUTTERFLY',
        category: ACHIEVEMENT_CATEGORIES.SOCIAL,
        title: "Towarzyski Motyl",
        description: "Dodaj 10 znajomych.",
        icon: '👥',
        reward: { vc: 25000, xp: 500 },
        check: (state) => (state.profile.friends || []).length >= 10,
        progress: (state) => ({ current: (state.profile.friends || []).length, target: 10 }),
        hidden: false,
        oneTime: true
    },

    // ===== SPECIAL/HIDDEN ACHIEVEMENTS =====
    EARLY_BIRD: {
        id: 'EARLY_BIRD',
        category: ACHIEVEMENT_CATEGORIES.SPECIAL,
        title: "Wczesny Ptak",
        description: "Zagraj o 5:00 rano.",
        icon: '🌅',
        reward: { vc: 50000, xp: 1000 },
        check: (state) => {
            const hour = new Date().getHours();
            return hour === 5;
        },
        progress: (state) => ({ current: new Date().getHours() === 5 ? 1 : 0, target: 1 }),
        hidden: true,
        oneTime: true
    },
    
    NIGHT_OWL: {
        id: 'NIGHT_OWL',
        category: ACHIEVEMENT_CATEGORIES.SPECIAL,
        title: "Nocny Marek",
        description: "Zagraj o 2:00 w nocy.",
        icon: '🦉',
        reward: { vc: 50000, xp: 1000 },
        check: (state) => {
            const hour = new Date().getHours();
            return hour === 2;
        },
        progress: (state) => ({ current: new Date().getHours() === 2 ? 1 : 0, target: 1 }),
        hidden: true,
        oneTime: true
    },
    
    LUCKY_SEVEN: {
        id: 'LUCKY_SEVEN',
        category: ACHIEVEMENT_CATEGORIES.SPECIAL,
        title: "Szczęśliwa Siódemka",
        description: "Posiadaj dokładnie 7 pojazdów.",
        icon: '🍀',
        reward: { vc: 77777, xp: 777 },
        check: (state) => Object.keys(state.owned).length === 7,
        progress: (state) => ({ current: Object.keys(state.owned).length, target: 7 }),
        hidden: true,
        oneTime: true
    },
    
    PERFECTIONIST: {
        id: 'PERFECTIONIST',
        category: ACHIEVEMENT_CATEGORIES.SPECIAL,
        title: "Perfekcjonista",
        description: "Posiadaj pojazdy wszystkich typów.",
        icon: '✨',
        reward: { vc: 500000, xp: 5000 },
        check: (state) => {
            const requiredTypes = ['plane', 'train', 'tube', 'bus', 'bike', 'river-bus', 'tram'];
            const ownedTypes = new Set(Object.values(state.owned).map(v => v.type));
            return requiredTypes.every(type => ownedTypes.has(type));
        },
        progress: (state) => {
            const requiredTypes = ['plane', 'train', 'tube', 'bus', 'bike', 'river-bus', 'tram'];
            const ownedTypes = new Set(Object.values(state.owned).map(v => v.type));
            const current = requiredTypes.filter(type => ownedTypes.has(type)).length;
            return { current, target: requiredTypes.length };
        },
        hidden: false,
        oneTime: true
    }
};

// Achievement checking and management functions
export class AchievementManager {
    constructor(gameState) {
        this.state = gameState;
        this.notifications = [];
    }

    // Check all achievements and return newly unlocked ones
    checkAchievements() {
        const newlyUnlocked = [];

        for (const [id, achievement] of Object.entries(ACHIEVEMENTS)) {
            const currentStatus = this.state.achievements[id] || { unlocked: false, claimed: false };
            
            // Skip if already unlocked (for one-time achievements) or if it's a repeatable achievement that's been claimed
            if (achievement.oneTime && currentStatus.unlocked) continue;
            
            // Check if achievement condition is met
            if (achievement.check(this.state) && !currentStatus.unlocked) {
                // Mark as unlocked
                this.state.achievements[id] = { 
                    unlocked: true, 
                    claimed: false,
                    unlockedAt: new Date().toISOString()
                };
                
                newlyUnlocked.push(achievement);
            }
        }

        return newlyUnlocked;
    }

    // Get achievements by category
    getAchievementsByCategory(category) {
        return Object.values(ACHIEVEMENTS).filter(ach => ach.category === category);
    }

    // Get achievement progress for display
    getAchievementProgress(achievementId) {
        const achievement = ACHIEVEMENTS[achievementId];
        if (!achievement) return null;

        const status = this.state.achievements[achievementId] || { unlocked: false, claimed: false };
        const progress = achievement.progress(this.state);

        return {
            ...achievement,
            ...status,
            ...progress,
            progressPercent: Math.min(100, (progress.current / progress.target) * 100)
        };
    }

    // Get all unclaimed achievements
    getUnclaimedAchievements() {
        return Object.keys(ACHIEVEMENTS).filter(id => {
            const status = this.state.achievements[id];
            return status && status.unlocked && !status.claimed;
        });
    }

    // Claim achievement reward
    claimAchievement(achievementId) {
        const achievement = ACHIEVEMENTS[achievementId];
        const status = this.state.achievements[achievementId];
        
        if (!achievement || !status || !status.unlocked || status.claimed) {
            return false;
        }

        // Grant rewards
        this.state.wallet += achievement.reward.vc;
        this.state.profile.xp += achievement.reward.xp;
        
        // Mark as claimed
        status.claimed = true;
        status.claimedAt = new Date().toISOString();

        return true;
    }

    // Get achievement statistics
    getAchievementStats() {
        const totalAchievements = Object.keys(ACHIEVEMENTS).length;
        const unlockedAchievements = Object.values(this.state.achievements).filter(a => a.unlocked).length;
        const claimedAchievements = Object.values(this.state.achievements).filter(a => a.claimed).length;

        return {
            total: totalAchievements,
            unlocked: unlockedAchievements,
            claimed: claimedAchievements,
            completionPercent: Math.round((unlockedAchievements / totalAchievements) * 100)
        };
    }
}

// Helper function to initialize achievement state if not present
export function initializeAchievements(gameState) {
    if (!gameState.achievements) {
        gameState.achievements = {};
    }

    // Ensure all achievements have a status entry
    for (const id of Object.keys(ACHIEVEMENTS)) {
        if (!gameState.achievements[id]) {
            gameState.achievements[id] = { unlocked: false, claimed: false };
        }
    }
}

// Export legacy achievements list for backward compatibility
export const achievementsList = ACHIEVEMENTS;