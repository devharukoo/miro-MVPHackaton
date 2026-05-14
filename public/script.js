const socket = io();
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const CURRENT_BOARD_ID = '64f1a2b3c4d5e6f7a8b9c0d1'; 
socket.emit('joinBoard', CURRENT_BOARD_ID);

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// --- СОСТОЯНИЕ ---
let elements = [];
let selectedElement = null;
let isDragging = false;
let isResizing = false;
let draggedElement = null;
let offsetX = 0;
let offsetY = 0;

let cameraX = 0;
let cameraY = 0;
let zoom = 1;
let isPanning = false;
let startPanX = 0;
let startPanY = 0;

canvas.addEventListener('contextmenu', e => e.preventDefault());

function wrapText(context, text, x, y, maxWidth, lineHeight) {
    const words = text.split(' ');
    let line = '';
    let currentY = y;
    for (let n = 0; n < words.length; n++) {
        const testLine = line + words[n] + ' ';
        const metrics = context.measureText(testLine);
        const testWidth = metrics.width;
        if (testWidth > maxWidth && n > 0) {
            context.fillText(line, x, currentY);
            line = words[n] + ' ';
            currentY += lineHeight;
        } else { line = testLine; }
    }
    context.fillText(line, x, currentY);
}

// --- РЕНДЕР ---
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(cameraX, cameraY);
    ctx.scale(zoom, zoom);
    
    // 1. Отрисовка референсной сетки (Звездочки/Крестики)
    const gridSize = 40;
    const crossSize = 3;
    
    // Считаем видимую область с запасом
    const startX = Math.floor((-cameraX / zoom) / gridSize) * gridSize;
    const endX = Math.ceil((canvas.width - cameraX) / zoom / gridSize) * gridSize;
    const startY = Math.floor((-cameraY / zoom) / gridSize) * gridSize;
    const endY = Math.ceil((canvas.height - cameraY) / zoom / gridSize) * gridSize;

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = startX; x <= endX; x += gridSize) {
        for (let y = startY; y <= endY; y += gridSize) {
            ctx.moveTo(x - crossSize, y);
            ctx.lineTo(x + crossSize, y);
            ctx.moveTo(x, y - crossSize);
            ctx.lineTo(x, y + crossSize);
        }
    }
    ctx.stroke();

    // 2. Отрисовка Канбан-карточек
    elements.forEach(el => {
        const w = el.width || 220;
        const h = el.height || 160;

        // Тень для объема (Glassmorphism effect)
        ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
        ctx.shadowBlur = 25;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 12;

        // Основной фон карточки
        ctx.fillStyle = '#222333'; 
        ctx.beginPath();
        ctx.roundRect(el.x, el.y, w, h, 14);
        ctx.fill();

        // Верхний цветовой акцент
        ctx.fillStyle = el.color || '#e14eca';
        ctx.beginPath();
        ctx.roundRect(el.x, el.y, w, 6, {tl: 14, tr: 14, bl: 0, br: 0});
        ctx.fill();

        // Выключаем тень для текста и внутренностей
        ctx.shadowColor = 'transparent';

        // Имитация UI-элементов: Тег снизу
        ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.beginPath();
        ctx.roundRect(el.x + 15, el.y + h - 35, 60, 22, 6);
        ctx.fill();
        ctx.fillStyle = '#a1a1aa';
        ctx.font = '500 11px Segoe UI';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Design', el.x + 45, el.y + h - 24);

        // Имитация "Аватарки" пользователя
        ctx.fillStyle = '#3f3f46';
        ctx.beginPath();
        ctx.arc(el.x + w - 26, el.y + h - 24, 11, 0, Math.PI * 2);
        ctx.fill();

        // Текст задачи (Левое выравнивание)
        ctx.fillStyle = '#ffffff';
        ctx.font = '500 15px Segoe UI, sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        wrapText(ctx, el.text || 'Новая задача...', el.x + 20, el.y + 25, w - 40, 22);

        // Рамка выделения и маркер ресайза
        if (el === selectedElement) {
            // Используем динамический цвет из настроек (или индиго по умолчанию)
            const themeColor = window.canvasAccentColor || '#6366f1';

            ctx.strokeStyle = themeColor; // Цвет индиго для выделения
            ctx.lineWidth = 2;
            ctx.strokeRect(el.x - 2, el.y - 2, w + 4, h + 4);

            ctx.fillStyle = themeColor;
            ctx.fillRect(el.x + w - 10, el.y + h - 10, 12, 12);
        }
    });
    
    ctx.restore();
    requestAnimationFrame(draw);
}
requestAnimationFrame(draw);

function getWorldPos(evt) {
    const rect = canvas.getBoundingClientRect();
    return {
        x: (evt.clientX - rect.left - cameraX) / zoom,
        y: (evt.clientY - rect.top - cameraY) / zoom
    };
}

// --- УПРАВЛЕНИЕ ---
canvas.addEventListener('mousedown', (e) => {
    if (e.button === 2) { 
        isPanning = true; startPanX = e.clientX - cameraX; startPanY = e.clientY - cameraY;
        canvas.style.cursor = 'grabbing'; return;
    }

    const mousePos = getWorldPos(e);
    let clickedElement = null;

    if (selectedElement) {
        const w = selectedElement.width || 220;
        const h = selectedElement.height || 160;
        if (Math.abs(mousePos.x - (selectedElement.x + w)) <= 15 && Math.abs(mousePos.y - (selectedElement.y + h)) <= 15) {
            isResizing = true; draggedElement = selectedElement; return;
        }
    }

    for (let i = elements.length - 1; i >= 0; i--) {
        const el = elements[i];
        const w = el.width || 220;
        const h = el.height || 160;
        if (mousePos.x >= el.x && mousePos.x <= el.x + w && mousePos.y >= el.y && mousePos.y <= el.y + h) {
            clickedElement = el; break;
        }
    }

    selectedElement = clickedElement;
    if (clickedElement) {
        isDragging = true; draggedElement = clickedElement;
        offsetX = mousePos.x - clickedElement.x; offsetY = mousePos.y - clickedElement.y;
    }
});

canvas.addEventListener('mousemove', (e) => {
    if (isPanning) { cameraX = e.clientX - startPanX; cameraY = e.clientY - startPanY; return; }

    const mousePos = getWorldPos(e);

    if (selectedElement && !isDragging && !isResizing) {
        const w = selectedElement.width || 220;
        const h = selectedElement.height || 160;
        canvas.style.cursor = (Math.abs(mousePos.x - (selectedElement.x + w)) <= 15 && Math.abs(mousePos.y - (selectedElement.y + h)) <= 15) ? 'nwse-resize' : 'crosshair';
    } else if (!isDragging && !isResizing) {
        canvas.style.cursor = 'crosshair';
    }

    if (isResizing && draggedElement) {
        const newWidth = Math.max(180, mousePos.x - draggedElement.x);
        const newHeight = Math.max(100, mousePos.y - draggedElement.y);
        draggedElement.width = newWidth; draggedElement.height = newHeight;
        socket.emit('updateElement', {
            boardId: CURRENT_BOARD_ID, id: draggedElement.id || draggedElement._id,
            x: draggedElement.x, y: draggedElement.y, width: newWidth, height: newHeight
        });
        return;
    }

    if (isDragging && draggedElement) {
        draggedElement.x = mousePos.x - offsetX; draggedElement.y = mousePos.y - offsetY;
        socket.emit('updateElement', {
            boardId: CURRENT_BOARD_ID, id: draggedElement.id || draggedElement._id,
            x: draggedElement.x, y: draggedElement.y, width: draggedElement.width, height: draggedElement.height
        });
    }
});

canvas.addEventListener('mouseup', (e) => {
    if (e.button === 2) { isPanning = false; canvas.style.cursor = 'crosshair'; return; }
    if ((isDragging || isResizing) && draggedElement) {
        socket.emit('saveElement', {
            id: draggedElement.id || draggedElement._id, x: draggedElement.x, y: draggedElement.y,
            width: draggedElement.width || 220, height: draggedElement.height || 160
        });
    }
    isDragging = false; isResizing = false; draggedElement = null;
});

window.addEventListener('keydown', (e) => {
    if (document.activeElement.tagName === 'TEXTAREA') return;
    if ((e.key === 'Delete' || e.key === 'Backspace') && selectedElement) {
        const idToDelete = selectedElement.id || selectedElement._id;
        elements = elements.filter(el => (el.id || el._id) !== idToDelete);
        socket.emit('deleteElement', { boardId: CURRENT_BOARD_ID, id: idToDelete });
        selectedElement = null;
    }
});

canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left; const mouseY = e.clientY - rect.top;
    const wheel = e.deltaY < 0 ? 1 : -1;
    const zoomFactor = Math.exp(wheel * 0.1);
    const newZoom = Math.min(Math.max(0.15, zoom * zoomFactor), 4);
    cameraX = mouseX - (mouseX - cameraX) * (newZoom / zoom);
    cameraY = mouseY - (mouseY - cameraY) * (newZoom / zoom);
    zoom = newZoom;
});

// ВВОД ТЕКСТА
canvas.addEventListener('dblclick', (e) => {
    const mousePos = getWorldPos(e);
    for (let i = elements.length - 1; i >= 0; i--) {
        const el = elements[i];
        const w = el.width || 220;
        const h = el.height || 160;
        
        if (mousePos.x >= el.x && mousePos.x <= el.x + w && mousePos.y >= el.y && mousePos.y <= el.y + h) {
            selectedElement = el;
            const input = document.createElement('textarea');
            input.value = el.text || '';
            
            const screenX = el.x * zoom + cameraX;
            const screenY = el.y * zoom + cameraY;
            const screenW = w * zoom;
            const screenH = h * zoom;

            input.style.position = 'absolute';
            input.style.left = `${screenX + 15 * zoom}px`; // Сдвинули для левого выравнивания
            input.style.top = `${screenY + 20 * zoom}px`; 
            input.style.width = `${screenW - 30 * zoom}px`;
            input.style.height = `${screenH - 60 * zoom}px`; // Оставили место для "тегов" внизу
            input.style.fontSize = `${15 * zoom}px`;
            input.style.background = '#222333'; // Под цвет карточки
            input.style.color = '#fff';
            input.style.border = '1px solid #6366f1';
            input.style.borderRadius = '6px';
            input.style.outline = 'none';
            input.style.resize = 'none';
            input.style.zIndex = '100';
            input.style.fontFamily = 'Segoe UI';
            input.style.padding = '4px';
            input.style.textAlign = 'left';
            
            document.body.appendChild(input);
            input.focus();

            const saveText = () => {
                const newText = input.value;
                el.text = newText;
                if (document.body.contains(input)) document.body.removeChild(input);
                socket.emit('updateText', { boardId: CURRENT_BOARD_ID, id: el.id || el._id, text: newText });
                socket.emit('saveText', { id: el.id || el._id, text: newText });
            };

            input.addEventListener('blur', saveText);
            input.addEventListener('keydown', (evt) => {
                if (evt.key === 'Enter' && !evt.shiftKey) { 
                    evt.preventDefault(); saveText();
                }
            });
            break; 
        }
    }
});

// СЕТЬ
const addCardBtn = document.getElementById('addCardBtn');
if (addCardBtn) {
    addCardBtn.addEventListener('click', async () => {
        try {
            const response = await fetch('/api/tasks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ boardId: CURRENT_BOARD_ID }) 
            });
            if (response.ok) {
                const newCard = await response.json();
                const formattedCard = {
                    id: newCard._id, type: newCard.type || 'rect',
                    x: newCard.x, y: newCard.y,
                    width: 220, height: 160,
                    color: newCard.color || '#e14eca', text: ''
                };
                elements.push(formattedCard);
                socket.emit('newElement', { boardId: CURRENT_BOARD_ID, card: formattedCard });
            }
        } catch (err) {}
    });
}

socket.on('updateElement', (data) => {
    const el = elements.find(e => e.id === data.id || e._id === data.id);
    if (el) { 
        el.x = data.x; el.y = data.y; 
        if (data.width) el.width = data.width; 
        if (data.height) el.height = data.height;
    }
});

socket.on('newElement', (newCard) => elements.push(newCard));
socket.on('updateText', (data) => {
    const el = elements.find(e => e.id === data.id || e._id === data.id);
    if (el) el.text = data.text;
});
socket.on('deleteElement', (idToDelete) => {
    elements = elements.filter(el => (el.id || el._id) !== idToDelete);
    if (selectedElement && (selectedElement.id || selectedElement._id) === idToDelete) {
        selectedElement = null;
    }
});

async function loadBoard() {
    try {
        const response = await fetch(`/api/tasks/${CURRENT_BOARD_ID}`);
        if (response.ok) {
            const tasksFromDB = await response.json();
            elements = tasksFromDB.map(task => ({
                id: task._id, type: task.type || 'rect',
                x: task.x, y: task.y,
                width: task.width || 220, height: task.height || 160,
                color: task.color || '#e14eca', text: task.text || ''
            }));
        }
    } catch (err) {}
}
loadBoard();
// ==========================================
// --- UI ИНТЕРФЕЙС И НАСТРОЙКИ (STABLE) ---
// ==========================================
const settingsModal = document.getElementById('settingsModal');
const btnCloseModal = document.getElementById('closeModal');
const boardTitle = document.getElementById('boardTitle');
const boardNameInput = document.getElementById('boardNameInput');
const colorSwatches = document.querySelectorAll('.color-swatch');

// Используем делегирование событий для меню
document.addEventListener('click', (e) => {
    const navItem = e.target.closest('.nav-item');
    if (!navItem) return;

    e.preventDefault();
    console.log("Клик по меню:", navItem.id); // Проверка в консоли

    // Переключаем активный класс
    document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
    navItem.classList.add('active');

    // Если нажали настройки — показываем модалку
    if (navItem.id === 'nav-settings') {
        console.log("Открываю настройки...");
        settingsModal.classList.remove('hidden');
    }
});

// Закрытие модалки
if (btnCloseModal) {
    btnCloseModal.onclick = () => {
        settingsModal.classList.add('hidden');
        document.getElementById('nav-boards').classList.add('active');
        document.getElementById('nav-settings').classList.remove('active');
    };
}

// Клик по оверлею (за пределами окна) тоже закрывает
settingsModal.addEventListener('click', (e) => {
    if (e.target === settingsModal) {
        btnCloseModal.onclick();
    }
});

// Смена названия
if (boardNameInput) {
    boardNameInput.oninput = (e) => {
        boardTitle.innerHTML = `${e.target.value} <span class="star">☆</span>`;
    };
}

// Смена темы
colorSwatches.forEach(swatch => {
    swatch.onclick = () => {
        colorSwatches.forEach(s => s.classList.remove('active'));
        swatch.classList.add('active');
        const newColor = swatch.getAttribute('data-color');
        document.documentElement.style.setProperty('--accent-color', newColor);
        window.canvasAccentColor = newColor;
    };
});