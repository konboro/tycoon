import { state } from './state.js';
import { PROXIES, countryCoords, genericWeather } from './config.js';
import { jitter } from './utils.js'; // <--- TU BYŁ BŁĄD (usunąłem getJSON z importu)
import { supabase } from './supabase.js';

// Helper dla API (Zostawiamy tę definicję tutaj)
async function getJSON(url) { 
    for (const p of PROXIES) { 
        try { 
            const r = await fetch(p + url); 
            if (!r.ok) throw new Error(`HTTP ${r.status}`); 
            return await r.json(); 
        } catch (e) {} 
    } 
    return null; 
}

export async function fetchGlobalTakenVehicles() {
    const { data } = await supabase.from('vehicles').select('vehicle_api_id, type');
    if (data) { 
        state.globalTaken.clear(); 
        data.forEach(row => state.globalTaken.add(`${row.type}:${row.vehicle_api_id}`)); 
    }
}

export async function fetchPlanes(){ const js=await getJSON('https://opensky-network.org/api/states/all'); (js?.states||[]).forEach(s=>{ const [icao,cs,o,t,la,lon,lat] = s; if(!cs||!cs.trim().toUpperCase().startsWith('UAE')||!isFinite(lat)||!isFinite(lon)) return; state.vehicles.plane.set(icao,{id:icao,type:'plane',title:cs.trim(),lat,lon,country:'Europe'}); }); }
export async function fetchBUS(){ const js=await getJSON('https://api-v3.mbta.com/vehicles?filter[route_type]=3'); (js?.data||[]).forEach(v=>{ const {latitude:lat,longitude:lon,label}=v.attributes; const id=v.id; if(!isFinite(lat)||!isFinite(lon)) return; state.vehicles.bus.set(id,{id,type:'bus',title:`MBTA Bus ${label}`,lat,lon,country:'USA'}); }); }
export async function fetchFI(){ const js=await getJSON('https://rata.digitraffic.fi/api/v1/train-locations.geojson/latest'); (js?.features||[]).forEach(f=>{ const [lon,lat]=f.geometry.coordinates; const id=String(f.properties.trainNumber); if(!isFinite(lat)||!isFinite(lon)) return; state.vehicles.train.set(id,{id,type:'train',title:`VR Train ${id}`,lat,lon,country:'Finland'}); }); }
export async function fetchTUBE(){ let tubeStations=null; const idx=await getJSON('https://api.tfl.gov.uk/StopPoint/Mode/tube'); tubeStations=new Map((idx?.stopPoints||[]).map(sp=>[sp.naptanId,{name:sp.commonName,lat:sp.lat,lon:sp.lon}])); const TUBE_LINES=['bakerloo','central','circle','district','hammersmith-city','jubilee','metropolitan','northern','piccadilly','victoria','waterloo-city']; let i=0; for(const line of TUBE_LINES){ try{ const arr=await getJSON(`https://api.tfl.gov.uk/Line/${line}/Arrivals`); (arr||[]).forEach(a=>{ const st=tubeStations.get(a.naptanId); if(!st) return; const jpos=jitter(st.lat,st.lon,i++); const id=a.vehicleId||`${line}_${a.naptanId}_${i}`; state.vehicles.tube.set(id,{id,type:'tube',title:`${a.lineName} → ${a.towards}`,lat:jpos.lat,lon:jpos.lon,country:'UK'}); }); }catch(e){} } }
export async function fetchTrams(){ let tramStops=null; const idx=await getJSON('https://api.tfl.gov.uk/StopPoint/Mode/tram'); tramStops=new Map((idx?.stopPoints||[]).map(sp=>[sp.naptanId,{name:sp.commonName,lat:sp.lat,lon:sp.lon}])); const TRAM_LINES=['tram']; let i=0; for(const line of TRAM_LINES){ try{ const arr=await getJSON(`https://api.tfl.gov.uk/Line/${line}/Arrivals`); (arr||[]).forEach(a=>{ const st=tramStops.get(a.naptanId); if(!st) return; const jpos=jitter(st.lat,st.lon,i++); const id=a.vehicleId||`${line}_${a.naptanId}_${i}`; state.vehicles.tram.set(id,{id,type:'tram',title:`TfL Tram → ${a.towards}`,lat:jpos.lat,lon:jpos.lon,country:'UK'}); }); }catch(e){} } }
export async function fetchMEVO(){ const idx=await getJSON('https://gbfs.urbansharing.com/rowermevo.pl/gbfs.json'); const urlFree=idx.data.pl.feeds.find(f=>f.name==='free_bike_status').url; const fb=await getJSON(urlFree); (fb?.data?.bikes||[]).forEach(b=>{ const {lat,lon,bike_id:id,name}=b; if(!id||!isFinite(lat)||!isFinite(lon)) return; state.vehicles.bike.set(id,{id,type:'bike',title:`MEVO ${name}`,lat,lon,country:'Poland'}); }); }
export async function fetchRiverBus() { try { const idx = await getJSON('https://api.tfl.gov.uk/StopPoint/Mode/river-bus'); const riverBusStations = new Map((idx?.stopPoints || []).map(sp => [sp.naptanId, { name: sp.commonName, lat: sp.lat, lon: sp.lon }])); const lines = await getJSON('https://api.tfl.gov.uk/Line/Mode/river-bus'); let i = 0; for (const line of (lines || [])) { try { const arr = await getJSON(`https://api.tfl.gov.uk/Line/${line.id}/Arrivals`); (arr || []).forEach(a => { const st = riverBusStations.get(a.naptanId); if (!st) return; const jpos = jitter(st.lat, st.lon, i++); const id = a.vehicleId || `${line.id}_${a.naptanId}_${i}`; state.vehicles['river-bus'].set(id, { id, type: 'river-bus', title: `${a.lineName} → ${a.destinationName || 'N/A'}`, lat: jpos.lat, lon: jpos.lon, country: 'UK' }); }); } catch (e) {} } } catch (e) {} }
export async function fetchEnergyPrices() { state.economy.energyPrices = { 'Poland': { 'Diesel': 1.55, 'Electricity': 0.18 }, 'Europe': { 'Diesel': 1.85, 'Electricity': 0.22 }, 'USA': { 'Diesel': 1.05, 'Electricity': 0.15 }, 'UK': { 'Diesel': 1.80, 'Electricity': 0.35 }, 'Finland': { 'Diesel': 1.95, 'Electricity': 0.12 } }; }

async function fetchWeather(lat, lon) { if (lat == null || lon == null) return null; const key = `${lat.toFixed(1)}_${lon.toFixed(1)}`; if (state.weatherCache.has(key)) return state.weatherCache.get(key); try { const data = await getJSON(`https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(2)}&longitude=${lon.toFixed(2)}&current_weather=true`); state.weatherCache.set(key, data.current_weather); return data.current_weather; } catch (e) { return null; } }
export async function updateVehiclesWithWeather(vehicleMap) { const vehicles = Array.from(vehicleMap.values()).slice(0, 15); for (const v of vehicles) { v.weather = await fetchWeather(v.lat, v.lon) || genericWeather; } }

export async function fetchTrainStationData(stationShortCode) { try { const url = `https://rata.digitraffic.fi/api/v1/live-trains/station/${stationShortCode}?minutes_before_departure=120&minutes_after_departure=15&minutes_before_arrival=120&minutes_after_arrival=15`; const data = await getJSON(url); return data || []; } catch (e) { return []; } }
export async function fetchTfLArrivals(naptanId) { try { const url = `https://api.tfl.gov.uk/StopPoint/${naptanId}/Arrivals`; const data = await getJSON(url); return data || []; } catch (e) { return []; } }
export async function fetchMbtaBusTerminalData(stopId) { try { const url = `https://api-v3.mbta.com/predictions?filter[stop]=${stopId}&include=trip,route`; const data = await getJSON(url); return data || []; } catch (e) { return []; } }
export async function fetchCableCarStatus(lineId) { try { const url = `https://api.tfl.gov.uk/Line/${lineId}/Status`; const data = await getJSON(url); if (!data) return null; return data[0] || null; } catch (e) { return null; } }