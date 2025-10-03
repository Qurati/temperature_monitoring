document.addEventListener('DOMContentLoaded', function() {
    const tableBody = document.querySelector('#health-table tbody');
    const saveNotice = document.getElementById('save-notice');
    const exportBtn = document.getElementById('exportBtn');
    const importFile = document.getElementById('importFile');
    const printBtn = document.getElementById('printBtn');
    const syncIdInput = document.getElementById('syncIdInput');
    const setSyncIdBtn = document.getElementById('setSyncId');
    const generateSyncIdBtn = document.getElementById('generateSyncId');
    const syncStatus = document.getElementById('sync-status');
    
    let savedData = JSON.parse(localStorage.getItem('healthData')) || {};
    let syncId = localStorage.getItem('healthSyncId') || '';
    let syncTimeout = null;
    
    if (syncId) {
        syncIdInput.value = syncId;
    }
    
    const dates = [];
    for (let i = 4; i <= 13; i++) {
        dates.push(`${i.toString().padStart(2, '0')}.10`);
    }
    
    dates.forEach(date => {
        const row = document.createElement('tr');
        
        const dateCell = document.createElement('td');
        dateCell.textContent = date;
        row.appendChild(dateCell);
        
        const morningTempCell = document.createElement('td');
        const morningInput = document.createElement('input');
        morningInput.type = 'number';
        morningInput.step = '0.1';
        morningInput.min = '35';
        morningInput.max = '42';
        morningInput.placeholder = '36.6';
        morningInput.value = savedData[date]?.morningTemp || '';
        morningInput.addEventListener('change', saveData);
        morningInput.addEventListener('input', saveData);
        morningTempCell.appendChild(morningInput);
        row.appendChild(morningTempCell);
        
        const eveningTempCell = document.createElement('td');
        const eveningInput = document.createElement('input');
        eveningInput.type = 'number';
        eveningInput.step = '0.1';
        eveningInput.min = '35';
        eveningInput.max = '42';
        eveningInput.placeholder = '36.6';
        eveningInput.value = savedData[date]?.eveningTemp || '';
        eveningInput.addEventListener('change', saveData);
        eveningInput.addEventListener('input', saveData);
        eveningTempCell.appendChild(eveningInput);
        row.appendChild(eveningTempCell);
        
        const painCell = document.createElement('td');
        const painCheckbox = document.createElement('input');
        painCheckbox.type = 'checkbox';
        painCheckbox.checked = savedData[date]?.pain || false;
        painCheckbox.addEventListener('change', saveData);
        painCell.appendChild(painCheckbox);
        row.appendChild(painCell);
        
        tableBody.appendChild(row);
    });
    
    function saveData() {
        const data = {};
        const rows = tableBody.querySelectorAll('tr');
        
        rows.forEach(row => {
            const date = row.cells[0].textContent;
            const morningTemp = row.cells[1].querySelector('input').value;
            const eveningTemp = row.cells[2].querySelector('input').value;
            const pain = row.cells[3].querySelector('input').checked;
            
            data[date] = {
                morningTemp,
                eveningTemp,
                pain
            };
        });
        
        savedData = data;
        localStorage.setItem('healthData', JSON.stringify(savedData));
        
        saveNotice.classList.add('show');
        setTimeout(() => {
            saveNotice.classList.remove('show');
        }, 2000);
        
        if (syncId) {
            syncData();
        }
    }
    
    function syncData() {
        if (!syncId) return;
        
        syncStatus.textContent = 'Синхронизация...';
        syncStatus.className = 'sync-status syncing';
        
        clearTimeout(syncTimeout);
        syncTimeout = setTimeout(() => {
            const timestamp = new Date().toISOString();
            const syncData = {
                data: savedData,
                timestamp: timestamp,
                syncId: syncId
            };
            
            localStorage.setItem(`healthSync_${syncId}`, JSON.stringify(syncData));
            
            syncStatus.textContent = 'Данные синхронизированы';
            syncStatus.className = 'sync-status success';
            
            setTimeout(() => {
                syncStatus.textContent = '';
                syncStatus.className = 'sync-status';
            }, 3000);
        }, 1000);
    }
    
    function checkForSyncData() {
        if (!syncId) return;
        
        const storedSyncData = localStorage.getItem(`healthSync_${syncId}`);
        if (storedSyncData) {
            try {
                const parsedData = JSON.parse(storedSyncData);
                if (parsedData.syncId === syncId && parsedData.data) {
                    const localTimestamp = localStorage.getItem(`healthSyncTimestamp_${syncId}`);
                    const remoteTimestamp = parsedData.timestamp;
                    
                    if (!localTimestamp || new Date(remoteTimestamp) > new Date(localTimestamp)) {
                        savedData = parsedData.data;
                        localStorage.setItem('healthData', JSON.stringify(savedData));
                        localStorage.setItem(`healthSyncTimestamp_${syncId}`, remoteTimestamp);
                        
                        updateTableWithData();
                        
                        syncStatus.textContent = 'Данные обновлены из облака';
                        syncStatus.className = 'sync-status success';
                        
                        setTimeout(() => {
                            syncStatus.textContent = '';
                            syncStatus.className = 'sync-status';
                        }, 3000);
                    }
                }
            } catch (e) {
                console.error('Ошибка синхронизации:', e);
            }
        }
    }
    
    setSyncIdBtn.addEventListener('click', function() {
        const newSyncId = syncIdInput.value.trim();
        if (newSyncId) {
            syncId = newSyncId;
            localStorage.setItem('healthSyncId', syncId);
            syncStatus.textContent = 'ID синхронизации установлен';
            syncStatus.className = 'sync-status success';
            
            setTimeout(() => {
                syncStatus.textContent = '';
                syncStatus.className = 'sync-status';
            }, 3000);
            
            checkForSyncData();
        }
    });
    
    generateSyncIdBtn.addEventListener('click', function() {
        const newSyncId = Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10);
        syncIdInput.value = newSyncId;
        syncId = newSyncId;
        localStorage.setItem('healthSyncId', syncId);
        syncStatus.textContent = 'Новый ID сгенерирован и установлен';
        syncStatus.className = 'sync-status success';
        
        setTimeout(() => {
            syncStatus.textContent = '';
            syncStatus.className = 'sync-status';
        }, 3000);
    });
    
    setInterval(checkForSyncData, 5000);
    
    exportBtn.addEventListener('click', function() {
        const dataStr = JSON.stringify(savedData, null, 2);
        const dataBlob = new Blob([dataStr], {type: 'application/json'});
        
        const link = document.createElement('a');
        link.href = URL.createObjectURL(dataBlob);
        link.download = 'health-data.json';
        link.click();
        
        showNotice('Данные экспортированы!');
    });
    
    importFile.addEventListener('change', function(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const importedData = JSON.parse(e.target.result);
                savedData = importedData;
                localStorage.setItem('healthData', JSON.stringify(savedData));
                
                updateTableWithData();
                
                showNotice('Данные импортированы!');
                
                if (syncId) {
                    syncData();
                }
            } catch (error) {
                showNotice('Ошибка при импорте данных!', true);
                console.error('Ошибка импорта:', error);
            }
        };
        reader.readAsText(file);
        
        event.target.value = '';
    });
    
    printBtn.addEventListener('click', function() {
        window.print();
    });
    
    function updateTableWithData() {
        const rows = tableBody.querySelectorAll('tr');
        
        rows.forEach(row => {
            const date = row.cells[0].textContent;
            const morningInput = row.cells[1].querySelector('input');
            const eveningInput = row.cells[2].querySelector('input');
            const painCheckbox = row.cells[3].querySelector('input');
            
            morningInput.value = savedData[date]?.morningTemp || '';
            eveningInput.value = savedData[date]?.eveningTemp || '';
            painCheckbox.checked = savedData[date]?.pain || false;
        });
    }
    
    function showNotice(message, isError = false) {
        saveNotice.textContent = message;
        saveNotice.style.backgroundColor = isError ? '#dc3545' : '#4CAF50';
        saveNotice.classList.add('show');
        setTimeout(() => {
            saveNotice.classList.remove('show');
        }, 3000);
    }
    
    if (syncId) {
        checkForSyncData();
    }
});