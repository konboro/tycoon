// js/lootbox-manager.js - Lootbox Management System
import { LOOTBOX_CONFIG } from './assets.js';
import { showNotification } from './notifications.js';

export class LootboxManager {
    constructor(gameState) {
        this.state = gameState;
        this.pendingLootboxes = [];
    }

    // Open a lootbox (from achievements or purchased)
    openLootbox(boxType, isFromAchievement = false) {
        const box = LOOTBOX_CONFIG[boxType];
        if (!box) {
            console.error(`Unknown lootbox type: ${boxType}`);
            return null;
        }

        // If not from achievement, charge the player
        if (!isFromAchievement) {
            if (this.state.wallet < box.cost) {
                showNotification("Nie masz wystarczająco VC!", true);
                return null;
            }
            this.state.wallet -= box.cost;
        }

        // Track lootbox opens
        if (!this.state.profile.lootboxes_opened) this.state.profile.lootboxes_opened = 0;
        this.state.profile.lootboxes_opened++;

        // Determine rarity based on drop rates
        const rand = Math.random();
        let cumulativeProb = 0;
        let prizeRarity = 'common';
        
        for (const rarity in box.drops) {
            cumulativeProb += box.drops[rarity];
            if (rand < cumulativeProb) {
                prizeRarity = rarity;
                break;
            }
        }

        // Find available vehicles of the determined rarity
        let unownedVehicles = [];
        Object.values(this.state.vehicles).forEach(vehicleMap => {
            for (const v of vehicleMap.values()) {
                if (!this.state.owned[`${v.type}:${v.id}`]) {
                    unownedVehicles.push(v);
                }
            }
        });

        // Filter by lootbox type if specified
        if (box.type) {
            unownedVehicles = unownedVehicles.filter(v => v.type === box.type);
        }

        // Filter by rarity
        let prizePool = unownedVehicles.filter(v => this.getVehicleRarity(v) === prizeRarity);

        // Fallback to lower rarity if no vehicles available
        if (prizePool.length === 0) {
            const rarities = ['legendary', 'epic', 'rare', 'common'];
            for (let i = rarities.indexOf(prizeRarity) + 1; i < rarities.length; i++) {
                prizePool = unownedVehicles.filter(v => this.getVehicleRarity(v) === rarities[i]);
                if (prizePool.length > 0) {
                    prizeRarity = rarities[i];
                    break;
                }
            }
        }

        let result = {
            success: true,
            type: 'vehicle',
            rarity: prizeRarity,
            lootboxType: boxType,
            fromAchievement: isFromAchievement,
            fallbackReward: null
        };

        if (prizePool.length > 0) {
            // Grant a vehicle
            const prize = prizePool[Math.floor(Math.random() * prizePool.length)];
            const key = `${prize.type}:${prize.id}`;

            this.state.owned[key] = {
                ...prize,
                odo_km: 0,
                earned_vc: 0,
                wear: 0,
                purchaseDate: new Date().toISOString(),
                customName: null,
                level: 1,
                totalEnergyCost: 0,
                earningsLog: [],
                serviceHistory: []
            };

            result.prize = prize;
            result.message = `Otrzymano: ${prize.title}!`;
            
            showNotification(`🎁 ${box.name}: ${prize.title}!`);
        } else {
            // Fallback: give VC compensation
            const fallbackVC = Math.round(box.cost * 0.75);
            this.state.wallet += fallbackVC;
            
            result.type = 'currency';
            result.fallbackReward = fallbackVC;
            result.message = `Brak dostępnych pojazdów. Otrzymano ${fallbackVC} VC.`;
            
            showNotification(`📦 ${box.name}: +${fallbackVC} VC (zwrot)`);
        }

        return result;
    }

    // Open achievement lootbox with special presentation
    openAchievementLootbox(achievementId, lootboxType) {
        const result = this.openLootbox(lootboxType, true);
        if (result) {
            result.achievementId = achievementId;
            this.showAchievementLootboxModal(result);
        }
        return result;
    }

    // Show special modal for achievement lootbox
    showAchievementLootboxModal(result) {
        // This would integrate with your existing modal system
        const modal = document.getElementById('achievement-lootbox-modal');
        if (modal) {
            // Update modal content based on result
            this.updateLootboxModal(modal, result);
            modal.style.display = 'flex';
        } else {
            // Fallback to regular notification
            showNotification(`🏆🎁 ${result.message}`);
        }
    }

    // Get all pending lootboxes from achievements
    getPendingAchievementLootboxes() {
        return this.state.pendingLootboxes || [];
    }

    // Process next pending lootbox
    processNextPendingLootbox() {
        const pending = this.getPendingAchievementLootboxes();
        if (pending.length === 0) return null;

        const lootbox = pending[0];
        const result = this.openAchievementLootbox(lootbox.fromAchievement, lootbox.type);
        
        // Remove from pending queue
        this.state.pendingLootboxes.shift();
        
        return result;
    }

    // Auto-open all pending lootboxes
    openAllPendingLootboxes() {
        const results = [];
        while (this.getPendingAchievementLootboxes().length > 0) {
            const result = this.processNextPendingLootbox();
            if (result) results.push(result);
        }
        return results;
    }

    // Helper method to get vehicle rarity (same logic as in assets.js)
    getVehicleRarity(vehicle) {
        if (!vehicle || !vehicle.type) return 'common';
        const nameToCheck = (vehicle.title || vehicle.customName || '').toLowerCase();
        
        switch (vehicle.type) {
            case 'bike': 
            case 'bus': 
                return 'common';
            case 'train': 
            case 'tube': 
                if (nameToCheck.includes('victoria')) return 'legendary';
                if (nameToCheck.includes('jubilee') || nameToCheck.includes('piccadilly')) return 'epic';
                return 'rare';
            case 'ship': 
            case 'river-bus':
                return 'epic';
            case 'plane': 
                return 'legendary';
            case 'tram': 
                return 'rare';
            default: 
                return 'common';
        }
    }

    // Get lootbox statistics
    getLootboxStats() {
        const opened = this.state.profile.lootboxes_opened || 0;
        const pending = this.getPendingAchievementLootboxes().length;
        
        return {
            totalOpened: opened,
            pendingFromAchievements: pending,
            favoriteRarity: this.getFavoriteRarity()
        };
    }

    // Get player's most obtained rarity (for stats)
    getFavoriteRarity() {
        const rarities = { common: 0, rare: 0, epic: 0, legendary: 0 };
        
        Object.values(this.state.owned).forEach(vehicle => {
            const rarity = this.getVehicleRarity(vehicle);
            if (rarities[rarity] !== undefined) {
                rarities[rarity]++;
            }
        });

        return Object.entries(rarities).reduce((a, b) => rarities[a[0]] > rarities[b[0]] ? a : b)[0];
    }

    // Initialize lootbox system
    static initializeLootboxSystem(gameState) {
        if (!gameState.pendingLootboxes) gameState.pendingLootboxes = [];
        if (!gameState.profile.lootboxes_opened) gameState.profile.lootboxes_opened = 0;
        
        return new LootboxManager(gameState);
    }
}

// Export for easy integration
export function createLootboxManager(gameState) {
    return LootboxManager.initializeLootboxSystem(gameState);
}