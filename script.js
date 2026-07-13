// script.js - Application Logic Built for the Premium Parts Catalog connected to SQLite Backend

// --- Global Cipher Mappings (ENGLISHBOY + X) ---
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

document.addEventListener('DOMContentLoaded', () => {

    // --- Selectors ---
    const inputPartNumber = document.getElementById('part-number-input');
    const inputSpecName = document.getElementById('spec-name-input');
    const inputSpecValue = document.getElementById('spec-value-input');

    const searchRadios = document.querySelectorAll('input[name="search-type"]');
    const searchPanels = document.querySelectorAll('.search-panel');

    // Action and Result Tracking
    const btnFind = document.getElementById('btn-find');
    const resultsArea = document.getElementById('results-area');
    const emptyState = document.querySelector('.empty-state');
    const loadingState = document.querySelector('.loading-state');
    const resultsContent = document.querySelector('.results-content');




    // --- Find Action Logic ---

    btnFind.addEventListener('click', performSearch);

    // Allow 'Enter' key in input to trigger search
    inputPartNumber.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') performSearch();
    });
    inputSpecName.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') performSearch();
    });
    inputSpecValue.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') performSearch();
    });

    // --- Toggle Logic ---
    if (searchRadios) {
        searchRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                searchPanels.forEach(p => p.classList.remove('active'));
                document.getElementById(`panel-${e.target.value}`).classList.add('active');
            });
        });
    }

    async function performSearch() {
        let queryDesc = '';
        let url = '';

        const activeMode = document.querySelector('input[name="search-type"]:checked').value;

        if (activeMode === 'part') {
            const val = inputPartNumber.value.trim();
            if (!val) {
                alert('Please enter a search query.');
                inputPartNumber.focus();
                return;
            }
            queryDesc = `Universal: ${val.toUpperCase()}`;
            url = `/api/parts/search?q=${encodeURIComponent(val)}`;
        } else if (activeMode === 'specs') {
            const name = inputSpecName.value.trim();
            const val = inputSpecValue.value.trim();

            if (!name && !val) {
                alert('Please enter at least one specification criteria.');
                inputSpecName.focus();
                return;
            }

            let params = new URLSearchParams();
            if (name) params.append('partName', name);
            if (val) params.append('specValue', val);

            queryDesc = `Specs (${[name, val].filter(Boolean).join(' / ')})`;
            url = `/api/parts/specs?${params.toString()}`;
        }

        // Simulate API call and loading state UI
        resultsArea.classList.add('has-content');
        emptyState.classList.add('hidden');
        resultsContent.classList.add('hidden');
        loadingState.classList.remove('hidden');

        try {
            const res = await fetch(url);
            const data = await res.json();

            renderResults(queryDesc, data);
        } catch (err) {
            console.error('Error fetching search results:', err);
            renderResults(queryDesc, []); // Fail gracefully
        }
    }

    function renderResults(queryContext, results) {
        loadingState.classList.add('hidden');
        resultsContent.classList.remove('hidden');

        let html = `<h2 style="color: var(--primary-text); margin-bottom: 20px; font-weight: 500;">Results for <span style="color: var(--accent-glow);">${queryContext}</span></h2>`;

        if (!results || results.length === 0) {
            html += `<p style="color: var(--secondary-text); text-align: left;">No parts found matching your criteria. Try adjusting your search.</p>`;
        } else {
            results.forEach((item, index) => {
                const badge = item.part_type === 'OEM' 
                    ? `<span style="background: rgba(255, 165, 2, 0.2); color: #ffa502; padding: 3px 8px; border-radius: 12px; font-size: 0.8rem; margin-right: 10px;">OEM - ${item.brand}</span>`
                    : `<span style="background: rgba(46, 213, 115, 0.2); color: #2ed573; padding: 3px 8px; border-radius: 12px; font-size: 0.8rem; margin-right: 10px;">Genuine</span>`;

                let specsHtml = '';
                let alertSpecs = '';
                if (item.specifications) {
                    try {
                        const specs = JSON.parse(item.specifications);
                        if (Object.keys(specs).length > 0) {
                            specsHtml = '<div style="margin-top: 10px; display: flex; flex-wrap: wrap; gap: 8px;">';
                            alertSpecs = '\\n\\nSpecifications:\\n';
                            for (const [key, val] of Object.entries(specs)) {
                                specsHtml += `<span style="background: var(--glass-bg); border: 1px solid var(--card-border); padding: 4px 10px; border-radius: 20px; font-size: 0.85rem; color: var(--secondary-text);"><strong style="color: var(--accent-glow); margin-right: 4px;">${key}:</strong> ${val}</span>`;
                                alertSpecs += `${key.replace(/'/g, "\\'")}: ${val.replace(/'/g, "\\'")}\\n`;
                            }
                            specsHtml += '</div>';
                        }
                    } catch (e) {}
                }

                let priceLabel = '';
                let detailPrices = '';
                if (item.pricing_type === 'standard') {
                    const cost = item.cost_price || '';
                    const sell = item.selling_price || '';
                    if (cost || sell) {
                        priceLabel = `Price Code: ${cost} / ${sell}`;
                        detailPrices = `\\nCost Code: ${cost}\\nSelling Code: ${sell}`;
                    }
                } else if (item.pricing_type === 'imported') {
                    const foreign = item.foreign_price || '';
                    const rate = item.exchange_rate || '';
                    if (foreign || rate) {
                        priceLabel = `Price Code: ${foreign} / ${rate}`;
                        detailPrices = `\\nForeign Cost Code: ${foreign}\\nExchange Rate Code: ${rate}\\nCalculated Cost Code: ${item.cost_price || ''}`;
                    }
                } else if (item.pricing_type === 'discount') {
                    const cost = item.cost_price || '';
                    const disc = item.discount || '';
                    if (cost || disc) {
                        priceLabel = `Price Code: ${cost} / ${disc}`;
                        const listVal = decodePrice(cost);
                        const discVal = decodePrice(disc);
                        const netVal = (listVal && discVal) ? Math.round(listVal - (listVal * (discVal / 100))) : null;
                        const netCode = netVal ? encodePrice(netVal) : '';
                        detailPrices = `\\nList Cost Code: ${cost}\\nDiscount Code (%): ${disc}\\nCalculated Net Cost: ${netCode}`;
                    }
                } else if (item.price) {
                    const encoded = encodePrice(item.price);
                    priceLabel = `Price Code: ${encoded}`;
                    detailPrices = `\\nPrice Code: ${encoded}`;
                }

                html += `
                    <div class="result-item" style="animation-delay: ${Math.min(index * 0.04, 0.8)}s">
                        <div class="result-info">
                            <h3 style="display: flex; align-items: center; justify-content: space-between; gap: 10px;">
                                <span>${item.name} <span style="color: var(--secondary-text); font-size: 0.8em; font-weight: normal;">(${item.part_number})</span></span>
                            </h3>
                            <div style="margin-top: 5px; margin-bottom: 5px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px;">
                                <div>
                                    ${badge} <span style="color: var(--secondary-text); font-size: 0.9rem;">Category: ${item.category}</span>
                                </div>
                                ${priceLabel ? `<span onclick="showPartDetails(${item.id})" style="cursor: pointer; font-weight: 700; color: var(--accent-primary); font-size: 0.95rem; background: var(--input-focus); padding: 3px 10px; border-radius: 6px; border: 1px solid var(--card-border); transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">${priceLabel}</span>` : ''}
                            </div>
                            ${item.description ? `<p style="color: var(--secondary-text); font-size: 0.9em; margin-top: 8px; line-height: 1.4;">${item.description}</p>` : ''}
                            ${specsHtml}
                            ${item.vehicle_fits ? `<p style="color: #4facfe; font-size: 0.85em; margin-top: 8px; font-weight: 500;">✓ Fits: ${item.vehicle_fits}</p>` : ''}
                            ${item.engine_fitment ? `<p style="color: #ff9ff3; font-size: 0.85em; margin-top: 4px; font-weight: 500;">⚙️ ${item.engine_fitment}</p>` : ''}
                        </div>
                        <button class="result-action" onclick="showPartDetails(${item.id})">
                            View Details
                        </button>
                    </div>
                `;
            });
        }

        resultsContent.innerHTML = html;

        // Animate them slightly
        const items = resultsContent.querySelectorAll('.result-item');
        items.forEach((item, index) => {
            item.style.opacity = '0';
            item.style.transform = 'translateY(10px)';
            item.style.transition = 'all 0.3s ease forwards';

            setTimeout(() => {
                item.style.opacity = '1';
                item.style.transform = 'translateY(0)';
            }, Math.min(index * 40, 800));
        });
    }

    // --- Theme Toggle Logic ---
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
        const themeIcon = themeToggle.querySelector('i');
        
        if (document.documentElement.getAttribute('data-theme') === 'light') {
            themeIcon.classList.remove('fa-moon');
            themeIcon.classList.add('fa-sun');
        }

        themeToggle.addEventListener('click', () => {
            let theme = document.documentElement.getAttribute('data-theme');
            theme = theme === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', theme);
            localStorage.setItem('theme', theme);
            
            if (theme === 'light') {
                themeIcon.classList.remove('fa-moon');
                themeIcon.classList.add('fa-sun');
            } else {
                themeIcon.classList.remove('fa-sun');
                themeIcon.classList.add('fa-moon');
            }
        });
    }

    // --- Shop Help Toggle Logic ---
    const helpToggle = document.getElementById('help-toggle');
    const helpPanel = document.getElementById('help-panel');
    if (helpToggle && helpPanel) {
        helpToggle.addEventListener('click', () => {
            if (helpPanel.style.display === 'none') {
                helpPanel.style.display = 'block';
            } else {
                helpPanel.style.display = 'none';
            }
        });
    }

    // --- Full Screen Toggle Logic ---
    const fullscreenToggle = document.getElementById('fullscreen-toggle');
    if (fullscreenToggle) {
        fullscreenToggle.addEventListener('click', () => {
            if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen().catch(err => {
                    console.error(`Error attempting to enable full-screen mode: ${err.message}`);
                });
            } else {
                if (document.exitFullscreen) {
                    document.exitFullscreen();
                }
            }
        });

        document.addEventListener('fullscreenchange', () => {
            if (!document.fullscreenElement) {
                fullscreenToggle.innerHTML = '<i class="fa-solid fa-expand"></i>';
            } else {
                fullscreenToggle.innerHTML = '<i class="fa-solid fa-compress"></i>';
            }
        });
    }

    // --- Price Details Modal & History Timeline Logic ---
    async function showPartDetails(id) {
        const modal = document.getElementById('details-modal');
        const modalBody = document.getElementById('modal-part-body');
        const modalName = document.getElementById('modal-part-name');
        
        if (!modal || !modalBody || !modalName) return;

        modalName.textContent = "Loading Part Details...";
        modalBody.innerHTML = `
            <div style="display:flex; justify-content:center; padding: 30px;">
                <div class="spinner"></div>
            </div>
        `;
        modal.style.display = 'flex';

        try {
            // Fetch Details
            const resPart = await fetch(`/api/parts/${id}`);
            const part = await resPart.json();
            
            // Fetch History
            const resHistory = await fetch(`/api/parts/${id}/price-history`);
            const history = await resHistory.json();

            modalName.textContent = `${part.name} (${part.part_number})`;

            // Specifications listing
            let specsListHtml = '';
            if (part.specifications) {
                try {
                    const specs = JSON.parse(part.specifications);
                    if (Object.keys(specs).length > 0) {
                        specsListHtml = '<div style="margin-top: 10px; display:flex; flex-wrap:wrap; gap:8px;">';
                        for (const [key, val] of Object.entries(specs)) {
                            specsListHtml += `<span style="background: var(--glass-bg); border: 1px solid var(--card-border); padding: 5px 12px; border-radius:20px; font-size:0.9rem; color:var(--secondary-text);"><strong style="color:var(--accent-glow-secondary);">${key}:</strong> ${val}</span>`;
                        }
                        specsListHtml += '</div>';
                    }
                } catch(e) {}
            }

            // Current pricing format code blocks
            let currentPriceDetails = '';
            if (part.pricing_type === 'standard') {
                currentPriceDetails = `
                    <div style="background: var(--glass-bg); border: 1px solid var(--card-border); padding:15px; border-radius:8px; margin-bottom:15px;">
                        <span style="font-weight:600; font-size: 0.9rem; color: var(--secondary-text); display:block; margin-bottom:5px;">Standard Price Structure</span>
                        <strong>Cost Code:</strong> <span style="font-family:monospace; color:var(--accent-glow-secondary); font-size:1.1rem; font-weight:700;">${part.cost_price || '-'}</span><br>
                        <strong>Selling Code:</strong> <span style="font-family:monospace; color:var(--accent-glow-secondary); font-size:1.1rem; font-weight:700;">${part.selling_price || '-'}</span>
                    </div>
                `;
            } else if (part.pricing_type === 'imported') {
                currentPriceDetails = `
                    <div style="background: var(--glass-bg); border: 1px solid var(--card-border); padding:15px; border-radius:8px; margin-bottom:15px;">
                        <span style="font-weight:600; font-size: 0.9rem; color: var(--secondary-text); display:block; margin-bottom:5px;">Imported Price Structure</span>
                        <strong>Foreign Cost Code:</strong> <span style="font-family:monospace; color:var(--accent-glow-secondary); font-size:1.1rem; font-weight:700;">${part.foreign_price || '-'}</span><br>
                        <strong>Exchange Rate Code:</strong> <span style="font-family:monospace; color:var(--accent-glow-secondary); font-size:1.1rem; font-weight:700;">${part.exchange_rate || '-'}</span><br>
                        <span style="font-size:0.85rem; color:var(--secondary-text); margin-top:5px; display:block;">Calculated Cost Code: <strong style="font-family:monospace; color:var(--accent-glow-secondary);">${part.cost_price || '-'}</strong></span>
                    </div>
                `;
            } else if (part.pricing_type === 'discount') {
                // Calculate net cost code
                const listVal = decodePrice(part.cost_price);
                const discVal = decodePrice(part.discount);
                const netVal = (listVal && discVal) ? Math.round(listVal - (listVal * (discVal / 100))) : null;
                const netCode = netVal ? encodePrice(netVal) : '';

                currentPriceDetails = `
                    <div style="background: var(--glass-bg); border: 1px solid var(--card-border); padding:15px; border-radius:8px; margin-bottom:15px;">
                        <span style="font-weight:600; font-size: 0.9rem; color: var(--secondary-text); display:block; margin-bottom:5px;">Discount Price Structure</span>
                        <strong>List Cost Code:</strong> <span style="font-family:monospace; color:var(--accent-glow-secondary); font-size:1.1rem; font-weight:700;">${part.cost_price || '-'}</span><br>
                        <strong>Discount Code (%):</strong> <span style="font-family:monospace; color:var(--accent-glow-secondary); font-size:1.1rem; font-weight:700;">${part.discount || '-'}</span><br>
                        <span style="font-size:0.85rem; color:var(--secondary-text); margin-top:5px; display:block;">Calculated Net Cost Code: <strong style="font-family:monospace; color:var(--accent-glow-secondary);">${netCode || '-'}</strong></span>
                    </div>
                `;
            } else if (part.price) {
                // Fallback for older prices
                const encoded = encodePrice(part.price);
                currentPriceDetails = `
                    <div style="background: var(--glass-bg); border: 1px solid var(--card-border); padding:15px; border-radius:8px; margin-bottom:15px;">
                        <strong>Price Code:</strong> <span style="font-family:monospace; color:var(--accent-glow-secondary); font-size:1.1rem; font-weight:700;">${encoded}</span>
                    </div>
                `;
            } else {
                currentPriceDetails = `<p style="color:var(--secondary-text); margin-bottom:15px;">No pricing details configured.</p>`;
            }

            // History Timeline Construction
            let historyHtml = '<h4 style="margin-top:25px; margin-bottom:15px; color: var(--primary-text); display:flex; align-items:center; gap:8px;"><i class="fa-solid fa-clock-rotate-left" style="color:var(--accent-glow-secondary);"></i> Price Revision History</h4>';
            if (history.length === 0) {
                historyHtml += '<p style="color:var(--secondary-text); font-size:0.9rem;">No price revisions logged yet.</p>';
            } else {
                historyHtml += '<div class="timeline">';
                history.forEach(h => {
                    let text = '';
                    if (h.pricing_type === 'standard') {
                        text = `${h.cost_price || ''} / ${h.selling_price || ''}`;
                    } else if (h.pricing_type === 'imported') {
                        text = `${h.foreign_price || ''} / ${h.exchange_rate || ''}`;
                    } else if (h.pricing_type === 'discount') {
                        text = `${h.cost_price || ''} / ${h.discount || ''}`;
                    } else {
                        text = 'Standard update';
                    }
                    historyHtml += `
                        <div class="timeline-item">
                            <div class="timeline-date">${h.changed_at}</div>
                            <div class="timeline-label">Price Code: <span class="timeline-code">${text}</span></div>
                        </div>
                    `;
                });
                historyHtml += '</div>';
            }

            modalBody.innerHTML = `
                <div style="margin-bottom:20px; font-size:0.95rem; color:var(--secondary-text);">
                    <p><strong>Category:</strong> ${part.category}</p>
                    <p style="margin-top:5px;"><strong>Fitment/Description:</strong> ${part.description || 'Universal / Unknown'}</p>
                    ${part.vehicle_fits ? `<p style="color:#4facfe; margin-top:5px; font-weight:500;">✓ Fits: ${part.vehicle_fits}</p>` : ''}
                    ${part.engine_fitment ? `<p style="color:#ff9ff3; margin-top:3px; font-weight:500;">⚙️ ${part.engine_fitment}</p>` : ''}
                </div>
                ${specsListHtml ? `<div style="margin-bottom:20px;"><strong>Sizes/Specifications:</strong> ${specsListHtml}</div>` : ''}
                ${currentPriceDetails}
                ${historyHtml}
            `;
        } catch(e) {
            console.error("Failed to render modal details", e);
            modalName.textContent = "Error Loading Details";
            modalBody.innerHTML = `<p style="color:#ff4757; text-align:center; padding:20px;">Could not load details from database.</p>`;
        }
    }

    function closeDetailsModal() {
        const modal = document.getElementById('details-modal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    // Expose functions globally for click triggers
    window.showPartDetails = showPartDetails;
    window.closeDetailsModal = closeDetailsModal;

});
