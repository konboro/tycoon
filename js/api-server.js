// js/api-server.js - Server-side API calls via Supabase Edge Functions
// Integrated with existing Transport Tycoon database schema
import { state } from './state.js';
import { supabase } from './supabase.js';

// Get the Supabase URL for edge functions
const SUPABASE_URL = 'https://xvbeklwkznsgckoozfgp.supabase.co';
const EDGE_FUNCTION_URL = `${SUPABASE_URL}/functions/v1/fetch-vehicles-v2`;

// Cache for API status to avoid excessive calls
let lastVehicleFetch = 0;
const CACHE_DURATION = 60000; // 1 minute cache

async function callEdgeFunction(action, params = {}) {
    try {
        const url = new URL(EDGE_FUNCTION_URL);
        url.searchParams.set('action', action);
        
        Object.entries(params).forEach(([key, value]) => {
            url.searchParams.set(key, value);
        });

        const { data: { session } } = await supabase.auth.getSession();
        const headers = {
            'Content-Type': 'application/json',
        };

        if (session) {
            headers['Authorization'] = `Bearer ${session.access_token}`;
        }

        const response = await fetch(url.toString(), { headers });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return await response.json();
    } catch (error) {
        console.error('Edge function call failed:', error);
        throw error;
    }
}

// Get cached vehicle data from database (fast)
// Integrates with your existing vehicle ownership system
export async function getCachedVehicles(type = 'all') {
    try {
        const result = await callEdgeFunction('get', { type });
        
        if (result.success && result.vehicles) {
            return result.vehicles;
        }
        
        return [];
    } catch (error) {
        console.error('Failed to get cached vehicles:', error);
        return [];
    }
}

// Get available vehicles (not owned by any player)
// This uses your existing 'vehicles' table to filter out owned vehicles
export async function getAvailableVehicles(type = 'all') {
    try {
        const result = await callEdgeFunction('get', { type, available_only: 'true' });
        
        if (result.success && result.vehicles) {
            return result.vehicles.filter(vehicle => vehicle.is_available);
        }
        
        return [];
    } catch (error) {
        console.error('Failed to get available vehicles:', error);
        return [];
    }
}

// Trigger server-side fetch (slower, updates cache)
export async function forceRefreshVehicles() {
    try {
        console.log('🔄 Triggering server-side vehicle fetch...');
        const result = await callEdgeFunction('fetch');
        
        if (result.success) {
            console.log(`✅ Server fetched ${result.vehicles} vehicles`, result.results);
            return true;
        } else {
            console.warn('⚠️ Server fetch failed:', result.error);
            return false;
        }
    } catch (error) {
        console.error('Failed to trigger vehicle fetch:', error);
        return false;
    }
}

// Get API status
export async function getApiStatus() {
    try {
        const result = await callEdgeFunction('status');
        
        if (result.success) {
            return result.status;
        }
        
        return [];
    } catch (error) {
        console.error('Failed to get API status:', error);
        return [];
    }
}

// Main function to fetch all vehicle data
export async function fetchAllVehicles() {
    const now = Date.now();
    
    try {
        // First, get cached data immediately
        console.log('📡 Loading cached vehicle data...');
        const vehicles = await getCachedVehicles('all');
        
        if (vehicles && vehicles.length > 0) {
            // Update state with cached data
            updateStateWithVehicles(vehicles);
            console.log(`✅ Loaded ${vehicles.length} cached vehicles`);
            
            // Optionally trigger a background refresh if cache is old
            if (now - lastVehicleFetch > CACHE_DURATION) {
                console.log('🔄 Triggering background refresh...');
                forceRefreshVehicles().then(() => {
                    console.log('🔄 Background refresh completed');
                });
                lastVehicleFetch = now;
            }
            
            return vehicles;
        } else {
            // No cached data, force a server fetch
            console.log('❗ No cached data, forcing server fetch...');
            await forceRefreshVehicles();
            
            // Wait a bit and try to get the data again
            await new Promise(resolve => setTimeout(resolve, 2000));
            const freshVehicles = await getCachedVehicles('all');
            updateStateWithVehicles(freshVehicles);
            
            return freshVehicles;
        }
        
    } catch (error) {
        console.error('Failed to fetch vehicles:', error);
        return [];
    }
}

// Update game state with vehicle data
function updateStateWithVehicles(vehicles) {
    // Clear existing vehicles
    Object.keys(state.vehicles).forEach(type => {
        state.vehicles[type].clear();
    });
    
    // Add new vehicles
    vehicles.forEach(vehicle => {
        if (!state.vehicles[vehicle.type]) {
            console.warn(`Unknown vehicle type: ${vehicle.type}`);
            return;
        }
        
        state.vehicles[vehicle.type].set(vehicle.id, {
            id: vehicle.id,
            type: vehicle.type,
            title: vehicle.title,
            lat: vehicle.lat,
            lon: vehicle.lon,
            country: vehicle.country || 'Unknown'
        });
    });
    
    console.log('🎯 Vehicle state updated:', {
        planes: state.vehicles.plane.size,
        trains: state.vehicles.train.size,
        tubes: state.vehicles.tube.size,
        buses: state.vehicles.bus.size,
        riverBuses: state.vehicles['river-bus'].size
    });
}

// Get list of vehicles already owned by players
// This integrates with your existing 'vehicles' table
export async function fetchGlobalTakenVehicles() {
    try {
        const { data: ownedVehicles, error } = await supabase
            .from('vehicles')
            .select('vehicle_api_id, type');
        
        if (error) {
            console.error('Failed to fetch owned vehicles:', error);
            return;
        }
        
        // Update global taken set
        state.globalTaken.clear();
        if (ownedVehicles) {
            ownedVehicles.forEach(vehicle => {
                const key = `${vehicle.type}:${vehicle.vehicle_api_id}`;
                state.globalTaken.add(key);
            });
        }
        
        console.log(`📊 ${ownedVehicles?.length || 0} vehicles currently owned by players`);
        
    } catch (error) {
        console.error('Error fetching global taken vehicles:', error);
    }
}

// Legacy API functions for backward compatibility
export async function fetchPlanes() {
    const vehicles = await getCachedVehicles('plane');
    const planes = vehicles.filter(v => v.type === 'plane');
    planes.forEach(plane => {
        state.vehicles.plane.set(plane.id, plane);
    });
}

export async function fetchBUS() {
    const vehicles = await getCachedVehicles('bus');
    const buses = vehicles.filter(v => v.type === 'bus');
    buses.forEach(bus => {
        state.vehicles.bus.set(bus.id, bus);
    });
}

export async function fetchTUBE() {
    const vehicles = await getCachedVehicles('tube');
    const tubes = vehicles.filter(v => v.type === 'tube');
    tubes.forEach(tube => {
        state.vehicles.tube.set(tube.id, tube);
    });
}

export async function fetchFI() {
    const vehicles = await getCachedVehicles('train');
    const trains = vehicles.filter(v => v.type === 'train');
    trains.forEach(train => {
        state.vehicles.train.set(train.id, train);
    });
}

export async function fetchTrams() {
    const vehicles = await getCachedVehicles('tram');
    const trams = vehicles.filter(v => v.type === 'tram');
    trams.forEach(tram => {
        state.vehicles.tram.set(tram.id, tram);
    });
}

export async function fetchRiverBus() {
    const vehicles = await getCachedVehicles('river-bus');
    const riverBuses = vehicles.filter(v => v.type === 'river-bus');
    riverBuses.forEach(bus => {
        state.vehicles['river-bus'].set(bus.id, bus);
    });
}

// Keep energy prices function - this doesn't need server-side caching
export async function fetchEnergyPrices() {
    // This can remain as static data since it doesn't change frequently
    state.economy.energyPrices = {
        'Poland': { 'Diesel': 1.55, 'Electricity': 0.18 },
        'Europe': { 'Diesel': 1.85, 'Electricity': 0.22 },
        'USA': { 'Diesel': 1.05, 'Electricity': 0.15 },
        'UK': { 'Diesel': 1.80, 'Electricity': 0.35 },
        'Finland': { 'Diesel': 1.95, 'Electricity': 0.12 }
    };
}

// Update vehicles with weather (keep this function)
export async function updateVehiclesWithWeather(vehicleMap) {
    // This function can remain as is since it's just adding weather data
    // to existing vehicles
    const vehicles = Array.from(vehicleMap.values()).slice(0, 15);
    for (const v of vehicles) {
        // You can implement weather API calls here if needed
        // For now, just set generic weather
        v.weather = { temperature: 15, weathercode: 3 };
    }
}

// Function to check if we need to refresh data
export function shouldRefreshVehicles() {
    return Date.now() - lastVehicleFetch > CACHE_DURATION;
}

// Auto-refresh function that can be called periodically
export async function autoRefreshIfNeeded() {
    if (shouldRefreshVehicles()) {
        try {
            const vehicles = await getCachedVehicles('all');
            
            // Check if cached data is stale (older than 10 minutes)
            const now = new Date();
            const hasStaleData = vehicles.some(v => {
                const vehicleAge = now - new Date(v.updated_at);
                return vehicleAge > 10 * 60 * 1000; // 10 minutes
            });
            
            if (hasStaleData) {
                console.log('🔄 Auto-refreshing stale vehicle data...');
                await forceRefreshVehicles();
            }
            
            lastVehicleFetch = Date.now();
        } catch (error) {
            console.error('Auto-refresh failed:', error);
        }
    }
}

// Helper function to check vehicle availability in real-time
export async function checkVehicleAvailability(vehicleId, vehicleType) {
    try {
        const { data, error } = await supabase
            .from('vehicles')
            .select('id')
            .eq('vehicle_api_id', vehicleId)
            .eq('type', vehicleType)
            .single();
        
        return !data; // If no data found, vehicle is available
    } catch (error) {
        console.error('Error checking vehicle availability:', error);
        return false; // Assume not available on error
    }
}