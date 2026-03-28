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
            selPart.innerHTML = `<option value="" disabled selected>Part</option>`;
            selPart.disabled = true;
        }
    });

    selModel.addEventListener('change', (e) => {
        const brand = selBrand.value;
        const model = e.target.value;

        if (model && vehicleData[brand] && vehicleData[brand].models[model]) {
            const submodels = vehicleData[brand].models[model];
            populateDropdown(selSubmodel, submodels.map(s => ({ value: s, text: s })), 'Sub Model');

            selPart.innerHTML = `<option value="" disabled selected>Part Category</option>`;
            selPart.disabled = true;
        }
    });

    selSubmodel.addEventListener('change', (e) => {
        const submodel = e.target.value;
        if (submodel) {
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
            queryDesc = `${selBrand.options[selBrand.selectedIndex].text} ${selModel.options[selModel.selectedIndex].text} - ${selPart.options[selPart.selectedIndex].text}`;
            url = `/api/parts/vehicle?brand=${encodeURIComponent(selBrand.value)}&model=${encodeURIComponent(selModel.value)}&submodel=${encodeURIComponent(selSubmodel.value)}&category=${encodeURIComponent(category)}`;
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

        let html = `<h2 style="color: white; margin-bottom: 20px; font-weight: 500;">Results for <span style="color: var(--accent-glow);">${queryContext}</span></h2>`;

        if (!results || results.length === 0) {
            html += `<p style="color: var(--secondary-text); text-align: left;">No parts found matching your criteria. Try adjusting your search.</p>`;
        } else {
            results.forEach((item, index) => {
                const stockStatus = item.stock <= 0
                    ? '<span style="color: #ff4757;">Out of Stock</span>'
                    : (item.stock < 5 ? `<span style="color: #ffa502;">Low Stock (${item.stock})</span>` : '<span style="color: #2ed573;">In Stock</span>');

                const btnState = item.stock <= 0 ? 'disabled style="background: rgba(255,255,255,0.05); color: #888; cursor: not-allowed;"' : '';

                html += `
                    <div class="result-item" style="animation-delay: ${index * 0.1}s">
                        <div class="result-info">
                            <h3>${item.name} (${item.part_number})</h3>
                            <p>Category: ${item.category} • ${stockStatus}</p>
                            <p style="margin-top: 5px; font-size: 1.1rem; color: white;">$${item.price.toFixed(2)}</p>
                        </div>
                        <button class="result-action" ${btnState}>
                            ${item.stock <= 0 ? 'Notify Me' : 'Add to Cart'}
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

});
