// js/admin.js
import { supabase } from './supabase.js'; // Używamy gotowej konfiguracji

// Sprawdź czy zalogowany przy starcie
async function init() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        window.location.href = 'index.html'; // Wyrzuć do gry jak niezalogowany
        return;
    }
    loadPlayers();
}

// Pobieranie listy graczy (używając funkcji RPC z bazy)
window.loadPlayers = async function() {
    const tbody = document.getElementById('players-table-body');
    tbody.innerHTML = '<tr><td colspan="6" class="p-4 text-center">Ładowanie...</td></tr>';

    const { data, error } = await supabase.rpc('admin_get_players');

    if (error) {
        alert("Błąd: " + error.message);
        if (error.message.includes("Brak uprawnień")) window.location.href = 'index.html';
        return;
    }

    tbody.innerHTML = '';
    
    // Statystyki
    document.getElementById('stat-users').innerText = data.length;
    const activeCount = data.filter(p => (new Date() - new Date(p.last_seen)) < 24*60*60*1000).length;
    document.getElementById('stat-active').innerText = activeCount;

    data.forEach(p => {
        const lastSeen = new Date(p.last_seen).toLocaleString();
        const roleColor = p.role === 'admin' ? 'text-red-400 font-bold' : (p.role === 'banned' ? 'text-gray-500 line-through' : 'text-slate-200');
        
        const tr = document.createElement('tr');
        tr.className = "hover:bg-slate-700/50 transition";
        tr.innerHTML = `
            <td class="p-3">
                <div class="font-bold">${p.company_name || 'Bez nazwy'}</div>
                <div class="text-xs text-slate-500">${p.email}</div>
            </td>
            <td class="p-3 font-mono text-green-400">${p.wallet.toLocaleString()}</td>
            <td class="p-3">${p.level}</td>
            <td class="p-3 text-xs text-slate-400">${lastSeen}</td>
            <td class="p-3 ${roleColor}">${p.role}</td>
            <td class="p-3 text-right">
                <button class="bg-blue-900 text-blue-200 px-3 py-1 rounded text-xs hover:bg-blue-800" 
                    onclick="openEdit('${p.id}', '${p.wallet}', '${p.level}', '${p.role}')">
                    Edytuj
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Otwieranie modala
window.openEdit = function(id, wallet, level, role) {
    document.getElementById('edit-id').value = id;
    document.getElementById('edit-wallet').value = wallet;
    document.getElementById('edit-level').value = level;
    document.getElementById('edit-role').value = role;
    document.getElementById('edit-modal').style.display = 'flex';
}

window.closeModal = function() {
    document.getElementById('edit-modal').style.display = 'none';
}

// Zapisywanie zmian (RPC)
window.savePlayer = async function() {
    const id = document.getElementById('edit-id').value;
    const wallet = document.getElementById('edit-wallet').value;
    const level = document.getElementById('edit-level').value;
    const role = document.getElementById('edit-role').value;

    const { error } = await supabase.rpc('admin_update_player', {
        target_id: id,
        new_wallet: parseInt(wallet),
        new_level: parseInt(level),
        new_role: role
    });

    if (error) {
        alert("Błąd zapisu: " + error.message);
    } else {
        closeModal();
        loadPlayers(); // Odśwież listę
    }
}

document.getElementById('logout-btn').addEventListener('click', async () => {
    await supabase.auth.signOut();
    window.location.href = 'index.html';
});

init();