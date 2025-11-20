// js/notifications.js - Notification system to avoid circular imports
export const $ = id => document.getElementById(id);

export function showNotification(message, isError = false) { 
    const container = $('notification-container'); 
    if(!container) return; 
    const notif = document.createElement('div'); 
    const borderColor = isError ? 'border-red-500' : 'border-green-500'; 
    notif.className = `bg-gray-800/90 backdrop-blur-md border-l-4 ${borderColor} text-white p-3 rounded-md shadow-lg text-sm transition-all duration-300 transform translate-x-[120%] opacity-0 z-50`; 
    notif.textContent = message; 
    container.appendChild(notif); 
    setTimeout(() => { 
        notif.classList.remove('translate-x-[120%]', 'opacity-0'); 
        notif.classList.add('translate-x-0', 'opacity-100'); 
    }, 10); 
    setTimeout(() => { 
        notif.classList.remove('translate-x-0', 'opacity-100'); 
        notif.classList.add('translate-x-[120%]', 'opacity-0'); 
        setTimeout(() => notif.remove(), 300); 
    }, 4500); 
}

export function showConfirm(message, onConfirm) { 
    const modal = $('confirm-modal'); 
    $('confirm-modal-text').textContent = message; 
    const confirmBtn = $('confirm-ok-btn'); 
    const cancelBtn = $('confirm-cancel-btn'); 
    const newConfirmBtn = confirmBtn.cloneNode(true); 
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn); 
    newConfirmBtn.onclick = () => { onConfirm(); modal.style.display = 'none'; }; 
    cancelBtn.onclick = () => { modal.style.display = 'none'; }; 
    modal.style.display = 'flex'; 
}