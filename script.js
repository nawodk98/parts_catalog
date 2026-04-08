// script.js - Application Logic Built for the Premium Parts Catalog connected to SQLite Backend

document.addEventListener('DOMContentLoaded', () => {

    // --- Selectors ---
    const tabPart = document.getElementById('tab-part');
    const tabVehicle = document.getElementById('tab-vehicle');
    const panelPart = document.getElementById('panel-part');
    const panelVehicle = document.getElementById('panel-vehicle');

    // Form Inputs
    const inputPartNumber = document.getElementById('part-number-input');

    // Vehicle Selects
    const selBrand = document.getElementById('vehicle-brand');
    const selModel = document.getElementById('vehicle-model');
    const selSubmodel = document.getElementById('vehicle-submodel');
    const selEngine = document.getElementById('vehicle-engine');
    const selPart = document.getElementById('vehicle-part');

    // Action and Result Tracking
    const btnFind = document.getElementById('btn-find');
    const resultsArea = document.getElementById('results-area');
    const emptyState = document.querySelector('.empty-state');
    const loadingState = document.querySelector('.loading-state');
    const resultsContent = document.querySelector('.results-content');

    // State
    let currentMode = 'part'; // 'part' | 'vehicle'
    let vehicleData = {};     // Will hold data from API

    // --- Initialize Data ---
    fetchVehicles();

    async function fetchVehicles() {
        try {
            const res = await fetch('/api/vehicles');
            vehicleData = await res.json();

            // Populate initial Brand dropdown from database
            populateDropdown(selBrand, Object.values(vehicleData).map(v => ({ value: v.name.toLowerCase(), text: v.name })), 'Brand');
        } catch (e) {
            console.error('Error fetching backend data:', e);
            // Fallback gracefully (show error or empty)
        }
    }

    // --- Tab Switching Logic ---
    function switchTab(mode) {
        currentMode = mode;
        if (mode === 'part') {
            panelPart.classList.add('active');
            panelVehicle.classList.remove('active');
            inputPartNumber.focus();
        } else {
            panelVehicle.classList.add('active');
            panelPart.classList.remove('active');
        }

        // Reset Search Results
        resetResults();
    }

    tabPart.addEventListener('change', () => switchTab('part'));
    tabVehicle.addEventListener('change', () => switchTab('vehicle'));

    function resetResults() {
        resultsArea.classList.remove('has-content');
        emptyState.classList.remove('hidden');
        loadingState.classList.add('hidden');
        resultsContent.classList.add('hidden');
        resultsContent.innerHTML = '';
    }

    // --- Vehicle Dropdown Logic ---

    function populateDropdown(selectElement, items, defaultText) {
        selectElement.innerHTML = `<option value="" disabled selected>${defaultText}</option>`;

        // Handle case where items could be an array of objects or strings or empty
        const keys = Object.keys(items);
        keys.forEach(key => {
            const item = items[key];
            const option = document.createElement('option');

            if (typeof item === 'object') {
                option.value = item.value;
                option.textContent = item.text;
            } else {
                option.value = typeof item === 'string' ? item.toLowerCase() : item;
                option.textContent = item;
            }
            selectElement.appendChild(option);
        });
        selectElement.disabled = false;
    }

    selBrand.addEventListener('change', (e) => {
        const brand = e.target.value;
        if (brand && vehicleData[brand]) {
            // Models are keys in the vehicleData[brand].models object
            const models = Object.keys(vehicleData[brand].models);
            populateDropdown(selModel, models.map(m => ({ value: m, text: m })), 'Model');

            // Disable downstream
            selSubmodel.innerHTML = `<option value="" disabled selected>Sub Model</option>`;
            selSubmodel.disabled = true;
            selEngine.innerHTML = `<option value="" disabled selected>Engine (Optional)</option>`;
            selEngine.disabled = true;
            selPart.innerHTML = `<option value="" disabled selected>Part</option>`;
            selPart.disabled = true;
        }
    });

    selModel.addEventListener('change', (e) => {
        const brand = selBrand.value;
        const model = e.target.value;

        if (model && vehicleData[brand] && vehicleData[brand].models[model]) {
            const submodels = Object.keys(vehicleData[brand].models[model]);
            populateDropdown(selSubmodel, submodels.map(s => ({ value: s, text: s })), 'Sub Model');

            selEngine.innerHTML = `<option value="" disabled selected>Engine (Optional)</option>`;
            selEngine.disabled = true;
            selPart.innerHTML = `<option value="" disabled selected>Part Category</option>`;
            selPart.disabled = true;
        }
    });

    selSubmodel.addEventListener('change', (e) => {
        const submodel = e.target.value;
        const brand = selBrand.value;
        const model = selModel.value;

        if (submodel) {
            const engines = vehicleData[brand].models[model][submodel] || [];
            const validEngines = [...new Set(engines.filter(Boolean))];
            if (validEngines.length > 0) {
                populateDropdown(selEngine, validEngines.map(s => ({ value: s, text: s })), 'Engine (Optional)');
                selEngine.innerHTML += '<option value="">Any Engine</option>';
            } else {
                selEngine.innerHTML = `<option value="">Any Engine</option>`;
                selEngine.disabled = false;
            }

            // Hardcode common part categories for the dropdown, or fetch dynamic categories.
            // For now, let's offer "All" or some standard items to search the DB.
            const partCategories = [
                { value: 'All', text: 'All Parts for this Vehicle' },
                { value: 'Brake Pads', text: 'Brake Pads' },
                { value: 'Oil Filter', text: 'Oil Filters' },
                { value: 'Spark Plugs', text: 'Spark Plugs' },
                { value: 'Air Filter', text: 'Air Filters' },
                { value: 'Alternator', text: 'Alternators' },
                { value: 'Battery', text: 'Batteries' }
            ];
            populateDropdown(selPart, partCategories, 'Category');
        }
    });


    // --- Find Action Logic ---

    btnFind.addEventListener('click', performSearch);

    // Allow 'Enter' key in input to trigger search
    inputPartNumber.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') performSearch();
    });

    async function performSearch() {
        let queryDesc = '';
        let url = '';

        // Validation & URL mapping
        if (currentMode === 'part') {
            const val = inputPartNumber.value.trim();
            if (!val) {
                alert('Please enter a part number.');
                inputPartNumber.focus();
                return;
            }
            queryDesc = `Part #${val.toUpperCase()}`;
            url = `/api/parts/search?q=${encodeURIComponent(val)}`;
        } else {
            // Vehicle validation
            if (!selBrand.value || !selModel.value || !selSubmodel.value || !selPart.value) {
                alert('Please select all vehicle details.');
                return;
            }

            const category = selPart.value === 'All' ? '' : selPart.value;
            const engine = selEngine.value && selEngine.value !== 'Any Engine' ? selEngine.value : '';
            queryDesc = `${selBrand.options[selBrand.selectedIndex].text} ${selModel.options[selModel.selectedIndex].text} - ${selPart.options[selPart.selectedIndex].text}`;
            if (engine) queryDesc += ` (${engine})`;
            url = `/api/parts/vehicle?brand=${encodeURIComponent(selBrand.value)}&model=${encodeURIComponent(selModel.value)}&submodel=${encodeURIComponent(selSubmodel.value)}&engine_type=${encodeURIComponent(engine)}&category=${encodeURIComponent(category)}`;
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

});
