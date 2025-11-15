export const $ = id => document.getElementById(id);
export const fmt = n => Math.round(n).toLocaleString('pl-PL');
export function hav(a,b,c,d){const R=6371,dLa=(c-a)*Math.PI/180,dLo=(d-b)*Math.PI/180,x=Math.sin(dLa/2)**2+Math.cos(a*Math.PI/180)*Math.cos(c*Math.PI/180)*Math.sin(dLo/2)**2;return 2*R*Math.asin(Math.sqrt(x));}
export function jitter(lat,lon,i=0){ const r=(i%5)*0.00015, ang=((i*137)%360)*Math.PI/180; return { lat: lat + Math.sin(ang)*r, lon: lon + Math.cos(ang)*r }; }
export function getWeatherIcon(code) { if ([0, 1].includes(code)) return 'ri-sun-line'; if ([2].includes(code)) return 'ri-cloudy-line'; if ([3].includes(code)) return 'ri-cloud-line'; if ([45, 48].includes(code)) return 'ri-foggy-line'; if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) return 'ri-drizzle-line'; if ([71, 73, 75, 85, 86].includes(code)) return 'ri-snowy-line'; if ([95, 96, 99].includes(code)) return 'ri-thunderstorms-line'; return 'ri-temp-hot-line'; }
export const ICONS = { plane: '✈️', bus: '🚌', train: '🚆', tube: '🚇', bike: '🚲', 'river-bus': '⛴️', tram: '🚋', station_train: '🏛️', station_tube: '🚇', station_bus: '🚏', station_cable: '🚠', 'station_river-bus': '⚓', 'asset_power-plant': '⚡️' };
export function createIcon(isOwnedAndMoving) { return L.divIcon({ className: `leaflet-marker-icon ${isOwnedAndMoving ? 'is-moving' : ''}`, iconSize: [30, 30], iconAnchor: [15, 15] }); }
export function showNotification(message, isError = false) { const container = $('notification-container'); if(!container) return; const notif = document.createElement('div'); const borderColor = isError ? 'border-red-500' : 'border-green-500'; notif.className = `bg-gray-800/80 backdrop-blur-sm border-l-4 ${borderColor} text-white p-3 rounded-md shadow-lg text-sm transition-all duration-300 transform translate-x-[120%] opacity-0`; notif.textContent = message; container.appendChild(notif); setTimeout(() => { notif.classList.remove('translate-x-[120%]', 'opacity-0'); notif.classList.add('translate-x-0', 'opacity-100'); }, 10); setTimeout(() => { notif.classList.remove('translate-x-0', 'opacity-100'); notif.classList.add('translate-x-[120%]', 'opacity-0'); setTimeout(() => notif.remove(), 300); }, 4500); }
export function showConfirm(message, onConfirm) { const modal = $('confirm-modal'); $('confirm-modal-text').textContent = message; const confirmBtn = $('confirm-ok-btn'); const cancelBtn = $('confirm-cancel-btn'); const newConfirmBtn = confirmBtn.cloneNode(true); confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn); newConfirmBtn.onclick = () => { onConfirm(); modal.style.display = 'none'; }; cancelBtn.onclick = () => { modal.style.display = 'none'; }; modal.style.display = 'flex'; }
// Bezpieczne sprawdzanie rzadkości
export function getVehicleRarity(vehicle) {
    if (!vehicle || !vehicle.type) return 'common';
    const nameToCheck = (vehicle.title || vehicle.customName || '').toLowerCase();
    switch (vehicle.type) {
        case 'bike': case 'bus': return 'common';
        case 'train': case 'tube': if (nameToCheck.includes('victoria')) return 'legendary'; if (nameToCheck.includes('jubilee') || nameToCheck.includes('piccadilly')) return 'epic'; return 'rare';
        case 'ship': return 'epic'; case 'plane': return 'legendary'; case 'river-bus': return 'rare'; case 'tram': return 'rare';
        default: return 'common';
    }
}
// Zwraca bonus bliskości na podstawie pozycji gracza
export function getProximityBonus(lat, lon, playerLocation) {
    if (!playerLocation || lat == null || lon == null || !isFinite(lat) || !isFinite(lon)) return 1.0;
    const distance = hav(playerLocation.lat, playerLocation.lon, lat, lon);
    return distance <= 100 ? 1.5 : 1.0;
}