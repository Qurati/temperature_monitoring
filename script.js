// Глобальные переменные для хранения состояния
let healthData = {
    savedData: JSON.parse(localStorage.getItem('healthData')) || {},
    syncId: localStorage.getItem('healthSyncId') || '',
    database: null,
    syncTimeout: null
};

// Основная функция инициализации
function initializeApp() {
    console.log('Инициализация приложения...');
    
    // Инициализация Firebase с проверкой на существующее приложение
    try {
        // Проверяем, не инициализирован ли Firebase уже
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
            console.log('Firebase успешно инициализирован');
        } else {
            console.log('Firebase уже был инициализирован, используем существующее приложение');
        }
        healthData.database = firebase.database();
    } catch (error) {
        if (error.code === 'app/duplicate-app') {
            console.log('Firebase приложение уже существует, используем его');
            healthData.database = firebase.database();
        } else {
            console.error('Ошибка инициализации Firebase:', error);
            showSyncStatus('Ошибка подключения к облаку', 'error');
        }
    }

    // Инициализация интерфейса
    initializeTable();
    initializeEventListeners();
    
    // Запуск синхронизации если есть ID
    if (healthData.syncId) {
        document.getElementById('syncIdInput').value = healthData.syncId;
        if (healthData.database) {
            startFirebaseSync();
        }
    }
    
    console.log('Приложение инициализировано');
}

// Инициализация таблицы
function initializeTable() {
    const tableBody = document.querySelector('#health-table tbody');
    if (!tableBody) {
        console.error('Не найден tbody таблицы');
        return;
    }

    // Даты с 04.10 по 14.10
    const dates = [];
    for (let i = 4; i <= 14; i++) {
        dates.push(`${i.toString().padStart(2, '0')}.10`);
    }

    // Создание строк таблицы
    tableBody.innerHTML = '';
    dates.forEach(date => {
        const row = document.createElement('tr');
        const dayData = healthData.savedData[date] || {};

        row.innerHTML = `
            <td>${date}</td>
            <td>
                <input type="number" 
                       value="${dayData.morningTemp || ''}" 
                       step="0.1" min="35" max="42" 
                       placeholder="36.6"
                       data-date="${date}" data-type="morningTemp">
            </td>
            <td>
                <input type="number" 
                       value="${dayData.eveningTemp || ''}" 
                       step="0.1" min="35" max="42" 
                       placeholder="36.6"
                       data-date="${date}" data-type="eveningTemp">
            </td>
            <td>
                <input type="checkbox" 
                       ${dayData.pain ? 'checked' : ''}
                       data-date="${date}" data-type="pain">
            </td>
        `;

        tableBody.appendChild(row);
    });

    // Добавляем обработчики событий для inputs
    const inputs = tableBody.querySelectorAll('input');
    inputs.forEach(input => {
        input.addEventListener('change', saveData);
        input.addEventListener('input', debounce(saveData, 500));
    });
}

// Инициализация обработчиков событий
function initializeEventListeners() {
    // Синхронизация
    const setSyncIdBtn = document.getElementById('setSyncId');
    const generateSyncIdBtn = document.getElementById('generateSyncId');
    const savePdfBtn = document.getElementById('savePdfBtn');

    if (setSyncIdBtn) {
        setSyncIdBtn.addEventListener('click', setSyncId);
    } else {
        console.error('Кнопка setSyncId не найдена');
    }

    if (generateSyncIdBtn) {
        generateSyncIdBtn.addEventListener('click', generateSyncId);
    } else {
        console.error('Кнопка generateSyncId не найдена');
    }

    if (savePdfBtn) {
        savePdfBtn.addEventListener('click', saveAsPdf);
        console.log('Обработчик PDF кнопки установлен');
    } else {
        console.error('Кнопка savePdfBtn не найдена');
    }
}

// Функция для отложенного сохранения
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Сохранение данных
function saveData() {
    const data = {};
    const rows = document.querySelectorAll('#health-table tbody tr');

    rows.forEach(row => {
        const date = row.cells[0].textContent;
        const morningTemp = row.cells[1].querySelector('input').value;
        const eveningTemp = row.cells[2].querySelector('input').value;
        const pain = row.cells[3].querySelector('input').checked;

        data[date] = { morningTemp, eveningTemp, pain };
    });

    healthData.savedData = data;
    localStorage.setItem('healthData', JSON.stringify(healthData.savedData));

    showSaveNotice('Данные сохранены!');

    // Синхронизация с Firebase
    if (healthData.syncId && healthData.database) {
        syncDataToFirebase();
    }
}

// Преобразование ключей для Firebase
function convertToFirebaseKey(date) {
    return date.replace(/\./g, '_');
}

function convertFromFirebaseKey(firebaseKey) {
    return firebaseKey.replace(/_/g, '.');
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

// Синхронизация с Firebase
function syncDataToFirebase() {
    if (!healthData.syncId || !healthData.database) return;

    showSyncStatus('Синхронизация...', 'syncing');

    clearTimeout(healthData.syncTimeout);
    healthData.syncTimeout = setTimeout(() => {
        const timestamp = new Date().toISOString();
        const firebaseData = convertDataForFirebase(healthData.savedData);

        const syncData = {
            data: firebaseData,
            timestamp: timestamp,
            syncId: healthData.syncId
        };

        healthData.database.ref('healthData/' + healthData.syncId).set(syncData)
            .then(() => {
                showSyncStatus('Данные синхронизированы', 'success');
            })
            .catch((error) => {
                console.error('Ошибка синхронизации:', error);
                showSyncStatus('Ошибка синхронизации', 'error');
            });
    }, 1000);
}

// Запуск синхронизации с Firebase
function startFirebaseSync() {
    if (!healthData.syncId || !healthData.database) return;

    healthData.database.ref('healthData/' + healthData.syncId).on('value', (snapshot) => {
        const data = snapshot.val();
        if (data && data.data) {
            const localTimestamp = localStorage.getItem(`healthSyncTimestamp_${healthData.syncId}`);
            const remoteTimestamp = data.timestamp;

            if (!localTimestamp || new Date(remoteTimestamp) > new Date(localTimestamp)) {
                const convertedData = convertDataFromFirebase(data.data);
                healthData.savedData = convertedData;
                localStorage.setItem('healthData', JSON.stringify(healthData.savedData));
                localStorage.setItem(`healthSyncTimestamp_${healthData.syncId}`, remoteTimestamp);

                updateTableWithData();
                showSyncStatus('Данные обновлены из облака', 'success');
            }
        }
    }, (error) => {
        console.error('Ошибка при получении данных:', error);
        showSyncStatus('Ошибка получения данных', 'error');
    });
}

// Обновление таблицы данными
function updateTableWithData() {
    const rows = document.querySelectorAll('#health-table tbody tr');

    rows.forEach(row => {
        const date = row.cells[0].textContent;
        const morningInput = row.cells[1].querySelector('input');
        const eveningInput = row.cells[2].querySelector('input');
        const painCheckbox = row.cells[3].querySelector('input');

        if (morningInput) morningInput.value = healthData.savedData[date]?.morningTemp || '';
        if (eveningInput) eveningInput.value = healthData.savedData[date]?.eveningTemp || '';
        if (painCheckbox) painCheckbox.checked = healthData.savedData[date]?.pain || false;
    });
}

// Установка ID синхронизации
function setSyncId() {
    const syncIdInput = document.getElementById('syncIdInput');
    const newSyncId = syncIdInput.value.trim();

    if (newSyncId) {
        if (healthData.syncId && healthData.database) {
            healthData.database.ref('healthData/' + healthData.syncId).off();
        }

        healthData.syncId = newSyncId;
        localStorage.setItem('healthSyncId', healthData.syncId);
        showSyncStatus('ID синхронизации установлен', 'success');

        if (healthData.database) {
            startFirebaseSync();
        }
    }
}

// Генерация нового ID синхронизации
function generateSyncId() {
    if (healthData.syncId && healthData.database) {
        healthData.database.ref('healthData/' + healthData.syncId).off();
    }

    const newSyncId = Math.random().toString(36).substring(2, 10);
    document.getElementById('syncIdInput').value = newSyncId;
    healthData.syncId = newSyncId;
    localStorage.setItem('healthSyncId', healthData.syncId);
    showSyncStatus('Новый ID создан', 'success');

    if (healthData.database) {
        startFirebaseSync();
    }
}

// Создание PDF
function saveAsPdf() {
    console.log('Начало создания PDF...');
    
    // Проверяем наличие библиотек
    if (typeof window.jspdf === 'undefined') {
        console.error('Библиотека jsPDF не загружена');
        showSaveNotice('Ошибка: Библиотека PDF не загружена', true);
        return;
    }

    if (typeof html2canvas === 'undefined') {
        console.error('Библиотека html2canvas не загружена');
        showSaveNotice('Ошибка: Библиотека canvas не загружена', true);
        return;
    }

    try {
        const { jsPDF } = window.jspdf;
        
        // Создаем контейнер для PDF
        const pdfContainer = document.createElement('div');
        pdfContainer.style.position = 'fixed';
        pdfContainer.style.left = '-10000px';
        pdfContainer.style.top = '0';
        pdfContainer.style.width = '800px';
        pdfContainer.style.padding = '20px';
        pdfContainer.style.backgroundColor = 'white';
        pdfContainer.style.fontFamily = 'Arial, sans-serif';
        pdfContainer.style.zIndex = '10000';

        // Заголовок
        const title = document.createElement('h1');
        title.textContent = 'Мониторинг температуры';
        title.style.textAlign = 'center';
        title.style.marginBottom = '10px';
        title.style.color = '#333';
        pdfContainer.appendChild(title);

        const subtitle = document.createElement('p');
        subtitle.textContent = 'Период: 04.10 - 14.10';
        subtitle.style.textAlign = 'center';
        subtitle.style.marginBottom = '20px';
        subtitle.style.color = '#666';
        pdfContainer.appendChild(subtitle);

        // Таблица для PDF
        const pdfTable = document.createElement('table');
        pdfTable.style.width = '100%';
        pdfTable.style.borderCollapse = 'collapse';
        pdfTable.style.border = '1px solid #000';
        pdfTable.style.fontSize = '14px';

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
            th.style.fontWeight = 'bold';
            headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);
        pdfTable.appendChild(thead);

        // Тело таблицы
        const tbody = document.createElement('tbody');
        const tableRows = document.querySelectorAll('#health-table tbody tr');
        
        tableRows.forEach((row, index) => {
            const pdfRow = document.createElement('tr');
            
            const date = row.cells[0].textContent;
            const morningInput = row.cells[1].querySelector('input');
            const eveningInput = row.cells[2].querySelector('input');
            const painCheckbox = row.cells[3].querySelector('input');
            
            const morningTemp = morningInput ? morningInput.value || '-' : '-';
            const eveningTemp = eveningInput ? eveningInput.value || '-' : '-';
            const pain = painCheckbox ? (painCheckbox.checked ? 'Да' : 'Нет') : 'Нет';
            
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
            useCORS: true,
            logging: false
        }).then(canvas => {
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const imgWidth = 190;
            const imgHeight = canvas.height * imgWidth / canvas.width;
            
            pdf.addImage(imgData, 'PNG', 10, 10, imgWidth, imgHeight);
            pdf.save('мониторинг_температуры.pdf');
            
            // Удаляем временный контейнер
            document.body.removeChild(pdfContainer);
            
            showSaveNotice('PDF успешно сохранен!');
            console.log('PDF успешно создан');
        }).catch(error => {
            console.error('Ошибка при создании PDF:', error);
            showSaveNotice('Ошибка при создании PDF!', true);
            
            // Удаляем временный контейнер в случае ошибки
            if (document.body.contains(pdfContainer)) {
                document.body.removeChild(pdfContainer);
            }
        });

    } catch (error) {
        console.error('Критическая ошибка при создании PDF:', error);
        showSaveNotice('Критическая ошибка при создании PDF!', true);
    }
}

// Вспомогательные функции для уведомлений
function showSaveNotice(message, isError = false) {
    const saveNotice = document.getElementById('save-notice');
    const saveMessage = document.getElementById('save-message');
    
    if (saveNotice && saveMessage) {
        saveMessage.textContent = message;
        saveNotice.style.backgroundColor = isError ? '#dc3545' : '#4CAF50';
        saveNotice.classList.add('show');
        setTimeout(() => {
            saveNotice.classList.remove('show');
        }, 3000);
    }
}

function showSyncStatus(message, type = '') {
    const syncStatus = document.getElementById('sync-status');
    if (syncStatus) {
        syncStatus.textContent = message;
        syncStatus.className = `sync-status ${type}`;
        
        if (type === 'success') {
            setTimeout(() => {
                syncStatus.textContent = '';
                syncStatus.className = 'sync-status';
            }, 3000);
        }
    }
}

// Запуск приложения после загрузки DOM
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM загружен, запуск инициализации...');
    initializeApp();
});

// Резервная инициализация если DOM уже загружен
if (document.readyState === 'interactive' || document.readyState === 'complete') {
    console.log('DOM уже готов, запуск инициализации...');
    initializeApp();

}
