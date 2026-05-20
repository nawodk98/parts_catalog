// script.js - Application Logic Built for the Premium Parts Catalog connected to SQLite Backend

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
            // Fake slight network delay for premium feel
            await new Promise(r => setTimeout(r, 600));

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

                html += `
                    <div class="result-item" style="animation-delay: ${index * 0.1}s">
                        <div class="result-info">
                            <h3 style="display: flex; align-items: center; justify-content: space-between; gap: 10px;">
                                <span>${item.name} <span style="color: var(--secondary-text); font-size: 0.8em; font-weight: normal;">(${item.part_number})</span></span>
                            </h3>
                            <div style="margin-top: 5px; margin-bottom: 5px; display: flex; align-items: center;">
                                ${badge} <span style="color: var(--secondary-text); font-size: 0.9rem;">Category: ${item.category}</span>
                            </div>
                            ${item.description ? `<p style="color: var(--secondary-text); font-size: 0.9em; margin-top: 8px; line-height: 1.4;">${item.description}</p>` : ''}
                            ${specsHtml}
                            ${item.vehicle_fits ? `<p style="color: #4facfe; font-size: 0.85em; margin-top: 8px; font-weight: 500;">✓ Fits: ${item.vehicle_fits}</p>` : ''}
                            ${item.engine_fitment ? `<p style="color: #ff9ff3; font-size: 0.85em; margin-top: 4px; font-weight: 500;">⚙️ ${item.engine_fitment}</p>` : ''}
                        </div>
                        <button class="result-action" onclick="alert('Part Name: ${item.name.replace(/'/g, "\\'")}\\nPart Number: ${item.part_number}\\nType: ${item.part_type}\\nCategory: ${item.category}${alertSpecs}\\n\\nCompatible Vehicles:\\n${item.vehicle_fits ? item.vehicle_fits.replace(/'/g, "\\'") : 'Universal / Unknown'}\\n\\nFits Engine:\\n${item.engine_fitment ? item.engine_fitment.replace('Engine: ', '') : 'Universal'}')">
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
            }, index * 80);
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

});
