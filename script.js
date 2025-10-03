document.addEventListener('DOMContentLoaded', function() {
    const tableBody = document.querySelector('#health-table tbody');
    const saveNotice = document.getElementById('save-notice');
    const savePdfBtn = document.getElementById('savePdfBtn');
    const syncIdInput = document.getElementById('syncIdInput');
    const setSyncIdBtn = document.getElementById('setSyncId');
    const generateSyncIdBtn = document.getElementById('generateSyncId');
    const syncStatus = document.getElementById('sync-status');
    
    let savedData = JSON.parse(localStorage.getItem('healthData')) || {};
    let syncId = localStorage.getItem('healthSyncId') || '';
    let syncTimeout = null;
    
    // Инициализация Firebase
    let database;
    try {
        database = firebase.database();
    } catch (error) {
        console.error('Ошибка Firebase:', error);
        syncStatus.textContent = 'Ошибка подключения к облаку';
        syncStatus.className = 'sync-status error';
    }
    
    // Установка syncId если он есть
    if (syncId) {
        syncIdInput.value = syncId;
        if (database) {
            startFirebaseSync();
        }
    }
    
    // Даты с 04.10 по 13.10
    const dates = [];
    for (let i = 4; i <= 13; i++) {
        dates.push(`${i.toString().padStart(2, '0')}.10`);
    }
    
    // Создание таблицы
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
    
    // Функции для преобразования ключей (замена точек на дефисы для Firebase)
    function convertToFirebaseKey(date) {
        return date.replace(/\./g, '_'); // Заменяем точки на подчеркивания
    }
    
    function convertFromFirebaseKey(firebaseKey) {
        return firebaseKey.replace(/_/g, '.'); // Заменяем подчеркивания обратно на точки
    }
    
    function convertDataForFirebase(data) {
        const converted = {};
        for (const key in data) {
            const newKey = convertToFirebaseKey(key);
            converted[newKey] = data[key];
        }
        return converted;
    }
    
    function convertDataFromFirebase(data) {
        const converted = {};
        for (const key in data) {
            const newKey = convertFromFirebaseKey(key);
            converted[newKey] = data[key];
        }
        return converted;
    }
    
    // Сохранение данных
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
        
        // Синхронизация с Firebase
        if (syncId && database) {
            syncDataToFirebase();
        }
    }
    
    // Синхронизация с Firebase
    function syncDataToFirebase() {
        if (!syncId || !database) return;
        
        syncStatus.textContent = 'Синхронизация...';
        syncStatus.className = 'sync-status syncing';
        
        clearTimeout(syncTimeout);
        syncTimeout = setTimeout(() => {
            const timestamp = new Date().toISOString();
            
            // Конвертируем данные для Firebase
            const firebaseData = convertDataForFirebase(savedData);
            
            const syncData = {
                data: firebaseData,
                timestamp: timestamp,
                syncId: syncId
            };
            
            database.ref('healthData/' + syncId).set(syncData)
                .then(() => {
                    syncStatus.textContent = 'Данные синхронизированы';
                    syncStatus.className = 'sync-status success';
                    
                    setTimeout(() => {
                        syncStatus.textContent = '';
                        syncStatus.className = 'sync-status';
                    }, 3000);
                })
                .catch((error) => {
                    console.error('Ошибка синхронизации:', error);
                    syncStatus.textContent = 'Ошибка синхронизации';
                    syncStatus.className = 'sync-status error';
                });
        }, 1000);
    }
    
    // Запуск синхронизации с Firebase
    function startFirebaseSync() {
        if (!syncId || !database) return;
        
        database.ref('healthData/' + syncId).on('value', (snapshot) => {
            const data = snapshot.val();
            if (data && data.data) {
                const localTimestamp = localStorage.getItem(`healthSyncTimestamp_${syncId}`);
                const remoteTimestamp = data.timestamp;
                
                if (!localTimestamp || new Date(remoteTimestamp) > new Date(localTimestamp)) {
                    // Конвертируем данные из Firebase обратно
                    const convertedData = convertDataFromFirebase(data.data);
                    
                    savedData = convertedData;
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
        });
    }
    
    // Обновление таблицы данными
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
    
    // Установка ID синхронизации
    setSyncIdBtn.addEventListener('click', function() {
        const newSyncId = syncIdInput.value.trim();
        if (newSyncId) {
            // Останавливаем предыдущую синхронизацию
            if (syncId && database) {
                database.ref('healthData/' + syncId).off();
            }
            
            syncId = newSyncId;
            localStorage.setItem('healthSyncId', syncId);
            syncStatus.textContent = 'ID синхронизации установлен';
            syncStatus.className = 'sync-status success';
            
            setTimeout(() => {
                syncStatus.textContent = '';
                syncStatus.className = 'sync-status';
            }, 3000);
            
            if (database) {
                startFirebaseSync();
            }
        }
    });
    
    // Генерация нового ID синхронизации
    generateSyncIdBtn.addEventListener('click', function() {
        // Останавливаем предыдущую синхронизацию
        if (syncId && database) {
            database.ref('healthData/' + syncId).off();
        }
        
        const newSyncId = Math.random().toString(36).substring(2, 10);
        syncIdInput.value = newSyncId;
        syncId = newSyncId;
        localStorage.setItem('healthSyncId', syncId);
        syncStatus.textContent = 'Новый ID создан';
        syncStatus.className = 'sync-status success';
        
        setTimeout(() => {
            syncStatus.textContent = '';
            syncStatus.className = 'sync-status';
        }, 3000);
        
        if (database) {
            startFirebaseSync();
        }
    });
    
    // Создание PDF
    savePdfBtn.addEventListener('click', function() {
        const { jsPDF } = window.jspdf;
        
        // Создаем контейнер для PDF
        const pdfContainer = document.createElement('div');
        pdfContainer.style.position = 'absolute';
        pdfContainer.style.left = '-9999px';
        pdfContainer.style.width = '800px';
        pdfContainer.style.padding = '20px';
        pdfContainer.style.backgroundColor = 'white';
        pdfContainer.style.fontFamily = 'Arial, sans-serif';
        
        // Заголовок
        const title = document.createElement('h1');
        title.textContent = 'Мониторинг температуры';
        title.style.textAlign = 'center';
        title.style.marginBottom = '10px';
        title.style.color = '#333';
        pdfContainer.appendChild(title);
        
        const subtitle = document.createElement('p');
        subtitle.textContent = 'Период: 04.10 - 13.10';
        subtitle.style.textAlign = 'center';
        subtitle.style.marginBottom = '20px';
        subtitle.style.color = '#666';
        pdfContainer.appendChild(subtitle);
        
        // Таблица для PDF
        const pdfTable = document.createElement('table');
        pdfTable.style.width = '100%';
        pdfTable.style.borderCollapse = 'collapse';
        pdfTable.style.border = '1px solid #000';
        
        // Заголовок таблицы
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        ['Дата', 't утром (°C)', 't вечером (°C)', 'Боли в животе'].forEach(text => {
            const th = document.createElement('th');
            th.textContent = text;
            th.style.border = '1px solid #000';
            th.style.padding = '10px';
            th.style.backgroundColor = '#4a69bd';
            th.style.color = 'white';
            headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);
        pdfTable.appendChild(thead);
        
        // Тело таблицы
        const tbody = document.createElement('tbody');
        const tableRows = tableBody.querySelectorAll('tr');
        tableRows.forEach((row, index) => {
            const pdfRow = document.createElement('tr');
            
            const date = row.cells[0].textContent;
            const morningTemp = row.cells[1].querySelector('input').value || '-';
            const eveningTemp = row.cells[2].querySelector('input').value || '-';
            const pain = row.cells[3].querySelector('input').checked ? 'Да' : 'Нет';
            
            [date, morningTemp, eveningTemp, pain].forEach(text => {
                const td = document.createElement('td');
                td.textContent = text;
                td.style.border = '1px solid #000';
                td.style.padding = '8px';
                td.style.textAlign = 'center';
                if (index % 2 === 0) {
                    td.style.backgroundColor = '#f8f9fa';
                }
                pdfRow.appendChild(td);
            });
            
            tbody.appendChild(pdfRow);
        });
        pdfTable.appendChild(tbody);
        
        pdfContainer.appendChild(pdfTable);
        document.body.appendChild(pdfContainer);
        
        // Создаем PDF
        html2canvas(pdfContainer, {
            scale: 2,
            useCORS: true
        }).then(canvas => {
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const imgWidth = 190;
            const imgHeight = canvas.height * imgWidth / canvas.width;
            
            pdf.addImage(imgData, 'PNG', 10, 10, imgWidth, imgHeight);
            pdf.save('мониторинг_температуры.pdf');
            
            // Удаляем временный контейнер
            document.body.removeChild(pdfContainer);
            
            saveNotice.textContent = 'PDF сохранен!';
            saveNotice.style.backgroundColor = '#4CAF50';
            saveNotice.classList.add('show');
            setTimeout(() => {
                saveNotice.classList.remove('show');
            }, 3000);
        }).catch(error => {
            console.error('Ошибка создания PDF:', error);
            saveNotice.textContent = 'Ошибка создания PDF!';
            saveNotice.style.backgroundColor = '#dc3545';
            saveNotice.classList.add('show');
            setTimeout(() => {
                saveNotice.classList.remove('show');
            }, 3000);
            
            if (document.body.contains(pdfContainer)) {
                document.body.removeChild(pdfContainer);
            }
        });
    });
});