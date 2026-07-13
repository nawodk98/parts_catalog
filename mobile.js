// mobile.js - Mobile PWA application controller with offline sync and QR scanning

// --- Cipher Mappings (ENGLISHBOY + X) ---
const CIPHER_MAP = { 'E':'1', 'N':'2', 'G':'3', 'L':'4', 'I':'5', 'S':'6', 'H':'7', 'B':'8', 'O':'9', 'Y':'0', 'X':'0' };
const REVERSE_MAP = { '1':'E', '2':'N', '3':'G', '4':'L', '5':'I', '6':'S', '7':'H', '8':'B', '9':'O' };

function encodePrice(price) {
    if (price === null || price === undefined || price === '') return '';
    const priceStr = Math.round(Number(price)).toString();
    if (isNaN(priceStr)) return '';
    const digits = priceStr.split('');
    const encodedDigits = [];
    let zeroCount = 0;
    for (let i = digits.length - 1; i >= 0; i--) {
        const digit = digits[i];
        if (digit === '0') {
            zeroCount++;
            encodedDigits.unshift(zeroCount % 2 === 1 ? 'Y' : 'X');
        } else if (REVERSE_MAP[digit]) {
            encodedDigits.unshift(REVERSE_MAP[digit]);
        } else {
            encodedDigits.unshift(digit);
        }
    }
    return encodedDigits.join('');
}

function decodePrice(cipher) {
    if (!cipher) return null;
    const cleaned = cipher.toUpperCase().trim();
    const decodedDigits = [];
    for (let i = 0; i < cleaned.length; i++) {
        const char = cleaned[i];
        if (CIPHER_MAP[char] !== undefined) {
            decodedDigits.push(CIPHER_MAP[char]);
        } else if (!isNaN(Number(char)) || char === '.') {
            decodedDigits.push(char);
        }
    }
    const decodedNum = Number(decodedDigits.join(''));
    return isNaN(decodedNum) ? null : decodedNum;
}

// --- IndexedDB Offline Storage Wrapper ---
const dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open('mahesh_mobile_db', 1);
    request.onupgradeneeded = (e) => {
        const db = e.target.result;
        db.createObjectStore('parts', { keyPath: 'id' });
        db.createObjectStore('sync_queue', { keyPath: 'id', autoIncrement: true });
        db.createObjectStore('settings');
    };
    request.onsuccess = (e) => resolve(e.target.result);
    request.onerror = (e) => reject(e.target.error);
});

// Settings Helpers
async function getSetting(key) {
    const db = await dbPromise;
    return new Promise((resolve) => {
        const tx = db.transaction('settings', 'readonly');
        const store = tx.objectStore('settings');
        const req = store.get(key);
        req.onsuccess = () => resolve(req.result);
    });
}

async function setSetting(key, val) {
    const db = await dbPromise;
    return new Promise((resolve) => {
        const tx = db.transaction('settings', 'readwrite');
        const store = tx.objectStore('settings');
        store.put(val, key);
        tx.oncomplete = () => resolve();
    });
}

// Sync Queue Helpers
async function getSyncQueue() {
    const db = await dbPromise;
    return new Promise((resolve) => {
        const tx = db.transaction('sync_queue', 'readonly');
        const store = tx.objectStore('sync_queue');
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
    });
}

async function addToSyncQueue(partId, pricingData) {
    const db = await dbPromise;
    return new Promise((resolve) => {
        const tx = db.transaction('sync_queue', 'readwrite');
        const store = tx.objectStore('sync_queue');
        store.add({ part_id: partId, data: pricingData, timestamp: Date.now() });
        tx.oncomplete = () => {
            updateSyncBanner();
            resolve();
        };
    });
}

async function clearQueueItem(id) {
    const db = await dbPromise;
    return new Promise((resolve) => {
        const tx = db.transaction('sync_queue', 'readwrite');
        const store = tx.objectStore('sync_queue');
        store.delete(id);
        tx.oncomplete = () => resolve();
    });
}

// Parts Storage Helpers
async function saveLocalParts(partsList) {
    const db = await dbPromise;
    return new Promise((resolve) => {
        const tx = db.transaction('parts', 'readwrite');
        const store = tx.objectStore('parts');
        store.clear();
        partsList.forEach(p => store.put(p));
        tx.oncomplete = () => resolve();
    });
}

async function getLocalParts() {
    const db = await dbPromise;
    return new Promise((resolve) => {
        const tx = db.transaction('parts', 'readonly');
        const store = tx.objectStore('parts');
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
    });
}

// --- App State & Initialization ---
let serverUrl = '';
let isOnline = false;
let allParts = [];
let html5QrcodeScanner = null;
let activeScanMode = ''; // 'pairing' or 'search'
let selectedPart = null;

window.addEventListener('DOMContentLoaded', async () => {
    serverUrl = await getSetting('server_url') || '';
    
    if (serverUrl) {
        showScreen('screen-main');
        checkConnection();
        // Check connection periodically every 10 seconds
        setInterval(checkConnection, 10000);
    } else {
        showScreen('screen-pairing');
    }
    
    // Listen for browser online status
    window.addEventListener('online', checkConnection);
    window.addEventListener('offline', () => setOnlineState(false));
});

function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
}

function setOnlineState(state) {
    isOnline = state;
    const dot = document.getElementById('connection-dot');
    const text = document.getElementById('connection-text');
    
    if (isOnline) {
        dot.className = "status-dot online";
        text.textContent = "Online Mode";
        // Trigger auto-sync when recovering network connectivity
        triggerSync();
    } else {
        dot.className = "status-dot";
        text.textContent = "Offline Mode";
    }
}

async function checkConnection() {
    if (!serverUrl) {
        setOnlineState(false);
        return;
    }
    try {
        const res = await fetch(`${serverUrl}/api/parts/all`, {
            method: 'GET',
            headers: { 'Accept': 'application/json' }
        });
        if (res.ok) {
            setOnlineState(true);
        } else {
            setOnlineState(false);
        }
    } catch(e) {
        setOnlineState(false);
    }
}

// --- Sync Mechanism ---
let isSyncing = false;
async function triggerSync() {
    if (isSyncing || !isOnline || !serverUrl) return;
    isSyncing = true;
    
    try {
        const queue = await getSyncQueue();
        if (queue.length > 0) {
            for (const item of queue) {
                // Post local modifications back to main database
                const response = await fetch(`${serverUrl}/api/parts/${item.part_id}/price`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(item.data)
                });
                if (response.ok) {
                    await clearQueueItem(item.id);
                }
            }
        }
        
        // Fetch latest version of catalog to save locally
        const freshResponse = await fetch(`${serverUrl}/api/parts/all`);
        if (freshResponse.ok) {
            const data = await freshResponse.json();
            await saveLocalParts(data);
        }
        
        await loadCatalogList();
        updateSyncBanner();
    } catch (e) {
        console.error("Sync error occurred:", e);
    } finally {
        isSyncing = false;
    }
}

async function updateSyncBanner() {
    const queue = await getSyncQueue();
    const banner = document.getElementById('sync-banner');
    const text = document.getElementById('sync-banner-text');
    
    if (queue.length > 0) {
        banner.style.display = 'flex';
        text.textContent = `You have ${queue.length} pending offline price updates.`;
    } else {
        banner.style.display = 'none';
    }
}

// --- Load and Search Catalog List ---
async function loadCatalogList() {
    allParts = await getLocalParts();
    filterParts();
}

function filterParts() {
    const searchVal = document.getElementById('mobile-search-input').value.toLowerCase().trim();
    const container = document.getElementById('mobile-parts-list');
    container.innerHTML = '';
    
    const filtered = allParts.filter(p => {
        return p.part_number.toLowerCase().includes(searchVal) ||
               p.name.toLowerCase().includes(searchVal) ||
               (p.category && p.category.toLowerCase().includes(searchVal)) ||
               (p.description && p.description.toLowerCase().includes(searchVal));
    });
    
    if (filtered.length === 0) {
        container.innerHTML = '<p style="text-align:center; color:var(--text-secondary); padding:30px;">No matching parts found</p>';
        return;
    }
    
    filtered.forEach(p => {
        let displayPrice = '';
        if (p.pricing_type === 'standard') {
            displayPrice = `${p.cost_price || ''} / ${p.selling_price || ''}`;
        } else if (p.pricing_type === 'imported') {
            displayPrice = `${p.foreign_price || ''} / ${p.exchange_rate || ''}`;
        } else if (p.pricing_type === 'discount') {
            displayPrice = `${p.cost_price || ''} / ${p.discount || ''}`;
        } else if (p.price) {
            displayPrice = encodePrice(p.price);
        }

        const priceBadge = displayPrice.trim() && displayPrice !== '/' ? `<span class="price-badge">${displayPrice}</span>` : '';
        const badge = p.part_type === 'OEM' 
            ? `<span class="badge-brand">OEM - ${p.brand}</span>`
            : `<span class="badge-brand">Genuine</span>`;
            
        const card = document.createElement('div');
        card.className = 'part-card';
        card.onclick = () => openEditModal(p);
        card.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                <h3>${p.name}</h3>
                ${priceBadge}
            </div>
            <div class="part-meta">
                <span>SKU: <strong style="font-family:monospace;">${p.part_number}</strong></span>
                ${badge}
            </div>
            ${p.description ? `<p style="font-size:0.85rem; color:var(--text-secondary); line-height:1.4;">${p.description}</p>` : ''}
        `;
        container.appendChild(card);
    });
}

// --- Server Connection Pairing ---
function saveManualPairing() {
    let url = document.getElementById('manual-url-input').value.trim();
    if (!url) return alert('Please enter a server URL');
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'http://' + url;
    }
    connectAndInit(url);
}

async function connectAndInit(url) {
    try {
        const response = await fetch(`${url}/api/parts/all`);
        if (response.ok) {
            await setSetting('server_url', url);
            serverUrl = url;
            setOnlineState(true);
            showScreen('screen-main');
            
            // Perform initial download sync
            const data = await response.json();
            await saveLocalParts(data);
            await loadCatalogList();
            alert('Successfully paired and catalog updated!');
        } else {
            alert('Connected but server returned an error. Make sure it is running.');
        }
    } catch(e) {
        alert('Could not connect to desktop server. Please ensure you are on the same Wi-Fi network.');
    }
}

// --- QR Camera Scan Core Controller ---
function startScanner(mode) {
    activeScanMode = mode;
    const overlay = document.getElementById('scanner-overlay');
    overlay.style.display = 'flex';
    document.querySelector('.scanner-header span').textContent = "Point camera at QR Code";
    
    // Start html5-qrcode scanner
    html5QrcodeScanner = new Html5Qrcode("scanner-reader");
    const config = { fps: 15, qrbox: { width: 250, height: 250 } };
    
    html5QrcodeScanner.start(
        { facingMode: "environment" },
        config,
        onScanSuccess,
        onScanFailure
    ).catch(err => {
        console.warn("Live camera start failed (probably secure context issue):", err);
        document.querySelector('.scanner-header span').textContent = "Camera disabled. Use Photo Mode below:";
    });
}

function stopScanner() {
    const overlay = document.getElementById('scanner-overlay');
    overlay.style.display = 'none';
    if (html5QrcodeScanner) {
        html5QrcodeScanner.stop().then(() => {
            html5QrcodeScanner = null;
        }).catch(err => {
            console.log('Error stopping scanner:', err);
            html5QrcodeScanner = null;
        });
    }
}

function triggerFileScanner() {
    document.getElementById('qr-file-input').value = '';
    document.getElementById('qr-file-input').click();
}

async function handleFileScan(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const tempScanner = new Html5Qrcode("scanner-reader");
    try {
        const decodedText = await tempScanner.scanFile(file, true);
        onScanSuccess(decodedText);
    } catch(err) {
        alert("Could not read QR code from photo. Please make sure the QR code is clear, well-lit, and centered in the picture!");
    }
}

function onScanSuccess(decodedText, decodedResult) {
    stopScanner();
    
    if (activeScanMode === 'pairing') {
        let cleanUrl = decodedText.replace('CONNECT:', '').trim();
        connectAndInit(cleanUrl);
    } else if (activeScanMode === 'search') {
        const parsedText = decodedText.toLowerCase().trim();
        document.getElementById('mobile-search-input').value = parsedText;
        filterParts();
        
        // If there's an exact part match, automatically open its edit sheet!
        const match = allParts.find(p => p.part_number.toLowerCase() === parsedText);
        if (match) {
            openEditModal(match);
        }
    }
}

function onScanFailure(error) {
    // Suppress console spam for scan seek frames
}

// Expose scanner fallbacks globally
window.triggerFileScanner = triggerFileScanner;
window.handleFileScan = handleFileScan;

// --- Parts Details Bottom Sheet Form Editor ---
function openEditModal(part) {
    selectedPart = part;
    
    document.getElementById('edit-part-title').textContent = part.name;
    document.getElementById('edit-part-sku').textContent = `SKU: ${part.part_number}`;
    document.getElementById('edit-part-category').textContent = `Category: ${part.category || 'General'}`;
    
    // Map initial inputs
    const pType = part.pricing_type || 'standard';
    document.getElementById('edit-pricing-type').value = pType;
    
    // Pre-populate input configurations
    document.getElementById('edit-cost-price').value = part.cost_price || '';
    document.getElementById('edit-selling-price').value = part.selling_price || '';
    document.getElementById('edit-foreign-price').value = part.foreign_price || '';
    document.getElementById('edit-exchange-rate').value = part.exchange_rate || '';
    document.getElementById('edit-discount-cost').value = part.cost_price || '';
    document.getElementById('edit-discount').value = part.discount || '';
    
    togglePricingTypeFields();
    updateRealtimePreviews();
    
    document.getElementById('edit-modal').style.display = 'flex';
}

function closeEditModal() {
    document.getElementById('edit-modal').style.display = 'none';
    selectedPart = null;
}

function togglePricingTypeFields() {
    const val = document.getElementById('edit-pricing-type').value;
    document.querySelectorAll('.pricing-fields').forEach(f => f.style.display = 'none');
    
    if (val === 'standard') {
        document.getElementById('group-standard').style.display = 'block';
    } else if (val === 'imported') {
        document.getElementById('group-imported').style.display = 'block';
    } else if (val === 'discount') {
        document.getElementById('group-discount').style.display = 'block';
    }
    updateRealtimePreviews();
}

function validateCipherInput(input) {
    input.value = input.value.toUpperCase().replace(/[^ENGLIHSBYX0-9]/g, '');
}

function updateRealtimePreviews() {
    const type = document.getElementById('edit-pricing-type').value;
    
    if (type === 'imported') {
        const foreign = decodePrice(document.getElementById('edit-foreign-price').value);
        const rate = decodePrice(document.getElementById('edit-exchange-rate').value);
        const previewEl = document.getElementById('preview-imported-cost');
        if (foreign && rate) {
            const computedVal = Math.round(foreign * rate);
            previewEl.textContent = `Calculated Cost Preview: ${encodePrice(computedVal)}`;
        } else {
            previewEl.textContent = 'Calculated Cost Preview: -';
        }
    } else if (type === 'discount') {
        const list = decodePrice(document.getElementById('edit-discount-cost').value);
        const disc = decodePrice(document.getElementById('edit-discount').value);
        const previewEl = document.getElementById('preview-discount-cost');
        if (list && disc) {
            const computedVal = Math.round(list - (list * (disc / 100)));
            previewEl.textContent = `Calculated Net Cost Preview: ${encodePrice(computedVal)}`;
        } else {
            previewEl.textContent = 'Calculated Net Cost Preview: -';
        }
    }
}

async function savePartData(event) {
    event.preventDefault();
    if (!selectedPart) return;
    
    const type = document.getElementById('edit-pricing-type').value;
    let data = { pricing_type: type };
    
    if (type === 'standard') {
        data.cost_price = document.getElementById('edit-cost-price').value.toUpperCase().trim();
        data.selling_price = document.getElementById('edit-selling-price').value.toUpperCase().trim();
    } else if (type === 'imported') {
        data.foreign_price = document.getElementById('edit-foreign-price').value.toUpperCase().trim();
        data.exchange_rate = document.getElementById('edit-exchange-rate').value.toUpperCase().trim();
        
        // Auto compute standard cost preview code
        const foreign = decodePrice(data.foreign_price);
        const rate = decodePrice(data.exchange_rate);
        data.cost_price = (foreign && rate) ? encodePrice(Math.round(foreign * rate)) : '';
    } else if (type === 'discount') {
        data.cost_price = document.getElementById('edit-discount-cost').value.toUpperCase().trim();
        data.discount = document.getElementById('edit-discount').value.toUpperCase().trim();
    }
    
    // Save to the sync queue for background execution
    await addToSyncQueue(selectedPart.id, data);
    
    // Modify in the local offline database copy immediately
    const db = await dbPromise;
    const tx = db.transaction('parts', 'readwrite');
    const store = tx.objectStore('parts');
    
    const updatedPart = { ...selectedPart, ...data };
    store.put(updatedPart);
    
    tx.oncomplete = async () => {
        closeEditModal();
        await loadCatalogList();
        
        // If we are online, trigger immediate sync!
        if (isOnline) {
            triggerSync();
        } else {
            alert('Saved locally. Changes will sync automatically when on Wi-Fi!');
        }
    };
}
