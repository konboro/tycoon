// 1. BEZPIECZNE KUPOWANIE (Server-Side RPC)
      const buyTarget = e.target.closest('[data-buy]');
      if (buyTarget) { 
          e.stopPropagation(); 
          (async () => {
              const [key, priceStr] = buyTarget.dataset.buy.split('|'); 
              const [type, ...idParts] = key.split(':'); 
              const id = idParts.join(':'); 
              const price = parseInt(priceStr); 
              const vehicleData = state.vehicles[type]?.get(id); 
              
              if (!vehicleData) { showNotification('Błąd danych pojazdu.', true); return; }

              // Wywołujemy funkcję SQL "buy_vehicle_secure"
              const { data, error } = await supabase.rpc('buy_vehicle_secure', {
                  p_vehicle_api_id: id,
                  p_vehicle_type: type,
                  p_price: price,
                  p_custom_name: vehicleData.title
              });

              if (error) {
                  showNotification('Błąd połączenia: ' + error.message, true);
                  return;
              }

              // Sprawdzamy co odpowiedziała baza danych
              if (data.success) {
                  // Sukces! Baza już zabrała kasę i dodała pojazd.
                  // My tylko aktualizujemy widok u gracza.
                  state.wallet = data.new_wallet; // Aktualizujemy portfel z odpowiedzi serwera
                  logTransaction(-price, `Zakup: ${vehicleData.title}`); 
                  
                  state.owned[key] = { 
                      ...vehicleData, 
                      odo_km: 0, earned_vc: 0, wear: 0, 
                      purchaseDate: new Date().toISOString(), 
                      customName: null, level: 1, 
                      totalEnergyCost: 0, earningsLog: [], serviceHistory: [] 
                  }; 
                  
                  // Dodaj do listy zajętych, żeby zniknął ze sklepu
                  state.globalTaken.add(key);

                  updateUI(); 
                  render(); 
                  showNotification(`Zakupiono ${vehicleData.title}!`);
              } else {
                  // Baza odmówiła (np. brak środków lub ktoś nas ubiegł)
                  showNotification(data.message, true);
                  // Jeśli pojazd zajęty, odświeżamy listę zajętych
                  if (data.message.includes('zajęty')) {
                      state.globalTaken.add(key);
                      render();
                  }
              }
          })(); 
          return; 
      }