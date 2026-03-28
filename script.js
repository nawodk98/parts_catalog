// script.js - Application Logic Built for the Premium Parts Catalog

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

    // --- Mock Data for Vehicle Selection ---
    const vehicleData = {
        bmw: { name: 'BMW', models: ['3 Series', '5 Series', 'X5'] },
        toyota: { name: 'Toyota', models: ['Camry', 'Corolla', 'Tacoma'] },
        honda: { name: 'Honda', models: ['Civic', 'Accord', 'CR-V'] },
        ford: { name: 'Ford', models: ['F-150', 'Mustang', 'Explorer'] },
        chevrolet: { name: 'Chevrolet', models: ['Silverado', 'Equinox', 'Tahoe'] },
        acura: { name: 'Acura', models: ['MDX', 'TLX', 'RDX'] }
    };
    
    const mockSubmodels = ['Base', 'Sport', 'Touring', 'Premium'];
    const mockParts = ['Brake Pads', 'Oil Filter', 'Spark Plugs', 'Air Filter', 'Alternator', 'Battery'];

    // --- Vehicle Dropdown Logic ---
    
    function populateDropdown(selectElement, items, defaultText) {
        selectElement.innerHTML = `<option value="" disabled selected>${defaultText}</option>`;
        items.forEach(item => {
            const option = document.createElement('option');
            // Check if item is an object with value/text or just a string
            if(typeof item === 'object') {
                 option.value = item.value;
                 option.textContent = item.text;
            } else {
                 option.value = item.toLowerCase().replace(/\s+/g, '-');
                 option.textContent = item;
            }
            selectElement.appendChild(option);
        });
        selectElement.disabled = false;
    }

    selBrand.addEventListener('change', (e) => {
        const brand = e.target.value;
        if (brand && vehicleData[brand]) {
            populateDropdown(selModel, vehicleData[brand].models, 'Model');
            
            // Disable downstream
            selSubmodel.innerHTML = `<option value="" disabled selected>Sub Model</option>`;
            selSubmodel.disabled = true;
            selPart.innerHTML = `<option value="" disabled selected>Part</option>`;
            selPart.disabled = true;
        }
    });

    selModel.addEventListener('change', (e) => {
        if(e.target.value) {
            populateDropdown(selSubmodel, mockSubmodels, 'Sub Model');
            selPart.innerHTML = `<option value="" disabled selected>Part</option>`;
            selPart.disabled = true;
        }
    });

    selSubmodel.addEventListener('change', (e) => {
        if(e.target.value) {
            populateDropdown(selPart, mockParts, 'Part');
        }
    });


    // --- Find Action Logic ---
    
    btnFind.addEventListener('click', performSearch);
    
    // Allow 'Enter' key in input to trigger search
    inputPartNumber.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') performSearch();
    });

    function performSearch() {
        let queryDesc = '';
        
        // Validation
        if (currentMode === 'part') {
            const val = inputPartNumber.value.trim();
            if (!val) {
                alert('Please enter a part number.');
                inputPartNumber.focus();
                return;
            }
            queryDesc = `Part #${val.toUpperCase()}`;
        } else {
            // Vehicle validation
            if (!selBrand.value || !selModel.value || !selSubmodel.value || !selPart.value) {
                alert('Please select all vehicle details.');
                return;
            }
            queryDesc = `${selBrand.options[selBrand.selectedIndex].text} ${selModel.options[selModel.selectedIndex].text} - ${selPart.options[selPart.selectedIndex].text}`;
        }

        // Simulate API call and loading state
        resultsArea.classList.add('has-content');
        emptyState.classList.add('hidden');
        resultsContent.classList.add('hidden');
        loadingState.classList.remove('hidden');

        // Fake network delay (1.5 seconds)
        setTimeout(() => {
            renderResults(queryDesc);
        }, 1500);
    }
    
    function renderResults(queryContext) {
        loadingState.classList.add('hidden');
        resultsContent.classList.remove('hidden');
        
        // Create mock results based on query
        let html = `<h2 style="color: white; margin-bottom: 20px; font-weight: 500;">Results for <span style="color: var(--accent-glow);">${queryContext}</span></h2>`;
        
        // Generate 3 mock items
        for(let i=1; i<=3; i++) {
            const price = (Math.random() * 100 + 10).toFixed(2);
            const stockStatus = i === 3 ? '<span style="color: #ff4757;">Out of Stock</span>' : '<span style="color: #2ed573;">In Stock</span>';
            const btnState = i === 3 ? 'disabled style="background: rgba(255,255,255,0.05); color: #888; cursor: not-allowed;"' : '';
            
            html += `
                <div class="result-item">
                    <div class="result-info">
                        <h3>Premium Aftermarket Part v${i}.0</h3>
                        <p>OEM Compatible • Warranty Included • ${stockStatus}</p>
                        <p style="margin-top: 5px; font-size: 1.1rem; color: white;">$${price}</p>
                    </div>
                    <button class="result-action" ${btnState}>
                        ${i === 3 ? 'Notify Me' : 'Add to Cart'}
                    </button>
                </div>
            `;
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
            }, index * 100);
        });
    }

});
