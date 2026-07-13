import React, { useState, useEffect, useRef } from 'react';
import { encodePrice, decodePrice } from './utils/cipher';
import './App.css';

// Initial inventory seed data matching the handwritten notebook exactly
const SEED_DATA = [
  {
    id: '1',
    itemCode: '04465-60100',
    description: 'Front Brake Pads (Toyota Land Cruiser / Prado)',
    pricingType: 'imported',
    foreignPrice: 'ES', // 16
    exchangeRate: 'OI', // 95
    costPrice: 'EINY', // 16 * 95 = 1520
    sellingPrice: 'EEIXY', // 11500
    discount: '',
    priceHistory: [
      {
        date: '2026-06-15, 09:30:00 AM',
        oldPricingType: 'standard',
        oldCost: 'EBIY',
        newCost: 'EINY',
        oldSelling: 'NNSY',
        newSelling: 'EEIXY',
        oldDiscount: '',
        newDiscount: '',
        oldForeignPrice: '',
        newForeignPrice: 'ES',
        oldExchangeRate: '',
        newExchangeRate: 'OI'
      }
    ]
  },
  {
    id: '2',
    itemCode: 'AN 714',
    description: 'Rear Brake Shoes (Akebono Aftermarket)',
    pricingType: 'standard',
    foreignPrice: '',
    exchangeRate: '',
    costPrice: 'ONLY', // 9240
    sellingPrice: 'EEIXY', // 11500
    discount: '',
    priceHistory: []
  },
  {
    id: '3',
    itemCode: 'C-110',
    description: 'Spin-on Oil Filter (Vic Aftermarket)',
    pricingType: 'discount',
    foreignPrice: '',
    exchangeRate: '',
    costPrice: 'EBIY', // 1850
    sellingPrice: 'NNSY', // 2200
    discount: 'NI', // 25
    priceHistory: []
  },
  {
    id: '4',
    itemCode: '90915-YZZE1',
    description: 'Genuine Toyota Oil Filter (Corolla / Yaris)',
    pricingType: 'standard',
    foreignPrice: '',
    exchangeRate: '',
    costPrice: 'LHY', // 470
    sellingPrice: 'SHY', // 670
    discount: '',
    priceHistory: []
  },
  {
    id: '5',
    itemCode: '13568-19195',
    description: 'Timing Belt (Toyota 3S-FE / 4S-FE)',
    pricingType: 'standard',
    foreignPrice: '',
    exchangeRate: '',
    costPrice: 'ENNY', // 1220
    sellingPrice: 'EGBY', // 1380
    discount: '',
    priceHistory: []
  }
];

export default function App() {
  // Theme state: default to 'light' to address user discomfort with dark
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('theme');
    return saved ? saved : 'light';
  });

  // Apply theme class to document element on theme changes
  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Inventory state backed by localStorage
  const [inventory, setInventory] = useState(() => {
    const saved = localStorage.getItem('part_cipher_inventory_v2');
    return saved ? JSON.parse(saved) : SEED_DATA;
  });

  // Active Tab state: 'checker' or 'manager'
  const [activeTab, setActiveTab] = useState('checker');

  // Selected item state (defaults to first item)
  const [selectedItemId, setSelectedItemId] = useState(() => {
    const saved = localStorage.getItem('part_cipher_inventory_v2');
    const items = saved ? JSON.parse(saved) : SEED_DATA;
    return items.length > 0 ? items[0].id : '';
  });

  // Search input state
  const [searchTerm, setSearchTerm] = useState('');
  const searchInputRef = useRef(null);

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Create Form State - now takes directly raw cipher strings
  const [createForm, setCreateForm] = useState({
    itemCode: '',
    description: '',
    pricingType: 'standard',
    costPrice: '',
    sellingPrice: '',
    discount: '',
    foreignPrice: '',
    exchangeRate: ''
  });

  // Update Form State - now takes directly raw cipher strings
  const [updateForm, setUpdateForm] = useState({
    id: '',
    pricingType: 'standard',
    costPrice: '',
    sellingPrice: '',
    discount: '',
    foreignPrice: '',
    exchangeRate: ''
  });

  // Edit Basic Details Form State
  const [editForm, setEditForm] = useState({
    id: '',
    itemCode: '',
    description: ''
  });

  // Persist inventory state
  useEffect(() => {
    localStorage.setItem('part_cipher_inventory_v2', JSON.stringify(inventory));
  }, [inventory]);

  // Auto-focus search bar on checker tab load
  useEffect(() => {
    if (activeTab === 'checker' && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [activeTab]);

  // Filter inventory based on search term
  const filteredInventory = inventory.filter(item => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return true;
    return (
      item.itemCode.toLowerCase().includes(term) ||
      item.description.toLowerCase().includes(term) ||
      item.costPrice.toLowerCase().includes(term) ||
      item.sellingPrice.toLowerCase().includes(term)
    );
  });

  // Automatically select the first search result when search term changes
  useEffect(() => {
    if (filteredInventory.length > 0) {
      const matchExists = filteredInventory.some(item => item.id === selectedItemId);
      if (!matchExists) {
        setSelectedItemId(filteredInventory[0].id);
      }
    }
  }, [searchTerm, filteredInventory, selectedItemId]);

  const selectedItem = inventory.find(item => item.id === selectedItemId) || filteredInventory[0] || null;

  // Clean raw cipher inputs (keep letters only)
  const sanitizeCipher = (str) => {
    return str.toUpperCase().replace(/[^ENGLISHBOYX.]/g, '');
  };

  // Delete item
  const handleDeleteItem = (id, code) => {
    if (window.confirm(`Are you sure you want to delete spare part ${code}?`)) {
      const updated = inventory.filter(item => item.id !== id);
      setInventory(updated);
      if (selectedItemId === id && updated.length > 0) {
        setSelectedItemId(updated[0].id);
      }
    }
  };

  // Create new item
  const handleCreateSubmit = (e) => {
    e.preventDefault();
    const { itemCode, description, pricingType, costPrice, sellingPrice, discount, foreignPrice, exchangeRate } = createForm;

    if (!itemCode.trim() || !sellingPrice) {
      alert('Please fill in Item Code and Selling Price.');
      return;
    }

    let finalCostCode = '';
    let finalForeignPriceCode = '';
    let finalExchangeRateCode = '';
    let finalDiscountCode = '';

    if (pricingType === 'standard') {
      if (!costPrice) {
        alert('Please fill in Cost Price.');
        return;
      }
      finalCostCode = sanitizeCipher(costPrice);
    } else if (pricingType === 'imported') {
      if (!foreignPrice || !exchangeRate) {
        alert('Please fill in Foreign Price and Exchange Rate.');
        return;
      }
      finalForeignPriceCode = sanitizeCipher(foreignPrice);
      finalExchangeRateCode = sanitizeCipher(exchangeRate);
      
      // Auto-calculate the Cost Code by decoding and multiplying
      const decForeign = decodePrice(finalForeignPriceCode) || 0;
      const decRate = decodePrice(finalExchangeRateCode) || 0;
      finalCostCode = encodePrice(Math.round(decForeign * decRate));
    } else if (pricingType === 'discount') {
      if (!costPrice || !discount) {
        alert('Please fill in Cost Price and Discount.');
        return;
      }
      finalCostCode = sanitizeCipher(costPrice);
      finalDiscountCode = sanitizeCipher(discount);
    }

    const newItem = {
      id: Date.now().toString(),
      itemCode: itemCode.trim().toUpperCase(),
      description: description.trim(),
      pricingType,
      foreignPrice: finalForeignPriceCode,
      exchangeRate: finalExchangeRateCode,
      costPrice: finalCostCode,
      sellingPrice: sanitizeCipher(sellingPrice),
      discount: finalDiscountCode,
      priceHistory: []
    };

    setInventory([newItem, ...inventory]);
    setSelectedItemId(newItem.id);
    setIsCreateModalOpen(false);
    setCreateForm({
      itemCode: '',
      description: '',
      pricingType: 'standard',
      costPrice: '',
      sellingPrice: '',
      discount: '',
      foreignPrice: '',
      exchangeRate: ''
    });
  };

  // Open Update Price Modal
  const openUpdateModal = (item) => {
    setUpdateForm({
      id: item.id,
      pricingType: item.pricingType || 'standard',
      costPrice: item.costPrice,
      sellingPrice: item.sellingPrice,
      discount: item.discount,
      foreignPrice: item.foreignPrice,
      exchangeRate: item.exchangeRate
    });
    setIsUpdateModalOpen(true);
  };

  // Update prices
  const handleUpdateSubmit = (e) => {
    e.preventDefault();
    const itemToUpdate = inventory.find(item => item.id === updateForm.id);
    if (!itemToUpdate) return;

    let finalCostCode = '';
    let finalForeignPriceCode = '';
    let finalExchangeRateCode = '';
    let finalDiscountCode = '';

    if (updateForm.pricingType === 'standard') {
      finalCostCode = sanitizeCipher(updateForm.costPrice);
    } else if (updateForm.pricingType === 'imported') {
      finalForeignPriceCode = sanitizeCipher(updateForm.foreignPrice);
      finalExchangeRateCode = sanitizeCipher(updateForm.exchangeRate);
      
      const decForeign = decodePrice(finalForeignPriceCode) || 0;
      const decRate = decodePrice(finalExchangeRateCode) || 0;
      finalCostCode = encodePrice(Math.round(decForeign * decRate));
    } else if (updateForm.pricingType === 'discount') {
      finalCostCode = sanitizeCipher(updateForm.costPrice);
      finalDiscountCode = sanitizeCipher(updateForm.discount);
    }

    const newEncodedSelling = sanitizeCipher(updateForm.sellingPrice);

    // Check if something changed
    const priceChanged =
      itemToUpdate.costPrice !== finalCostCode ||
      itemToUpdate.sellingPrice !== newEncodedSelling ||
      itemToUpdate.discount !== finalDiscountCode ||
      itemToUpdate.foreignPrice !== finalForeignPriceCode ||
      itemToUpdate.exchangeRate !== finalExchangeRateCode ||
      itemToUpdate.pricingType !== updateForm.pricingType;

    const timestamp = new Date().toLocaleString();

    const updatedHistory = priceChanged
      ? [
          {
            date: timestamp,
            oldPricingType: itemToUpdate.pricingType || 'standard',
            oldCost: itemToUpdate.costPrice,
            newCost: finalCostCode,
            oldSelling: itemToUpdate.sellingPrice,
            newSelling: newEncodedSelling,
            oldDiscount: itemToUpdate.discount,
            newDiscount: finalDiscountCode,
            oldForeignPrice: itemToUpdate.foreignPrice,
            newForeignPrice: finalForeignPriceCode,
            oldExchangeRate: itemToUpdate.exchangeRate,
            newExchangeRate: finalExchangeRateCode
          },
          ...itemToUpdate.priceHistory
        ]
      : itemToUpdate.priceHistory;

    const updatedInventory = inventory.map(item => {
      if (item.id === updateForm.id) {
        return {
          ...item,
          pricingType: updateForm.pricingType,
          costPrice: finalCostCode,
          sellingPrice: newEncodedSelling,
          discount: finalDiscountCode,
          foreignPrice: finalForeignPriceCode,
          exchangeRate: finalExchangeRateCode,
          priceHistory: updatedHistory
        };
      }
      return item;
    });

    setInventory(updatedInventory);
    setIsUpdateModalOpen(false);
  };

  // Open Edit Details Modal
  const openEditModal = (item) => {
    setEditForm({
      id: item.id,
      itemCode: item.itemCode,
      description: item.description
    });
    setIsEditModalOpen(true);
  };

  // Save basic edit changes
  const handleEditSubmit = (e) => {
    e.preventDefault();
    if (!editForm.itemCode.trim()) return;

    setInventory(inventory.map(item => {
      if (item.id === editForm.id) {
        return {
          ...item,
          itemCode: editForm.itemCode.trim().toUpperCase(),
          description: editForm.description.trim()
        };
      }
      return item;
    }));
    setIsEditModalOpen(false);
  };

  // Get calculated net cost for discount model
  const getCalculatedNetCost = (cost, disc) => {
    const c = decodePrice(cost) || 0;
    const d = decodePrice(disc) || 0;
    const net = Math.round(c * (1 - d / 100));
    return encodePrice(net);
  };

  return (
    <div className="min-height-screen text-text-primary flex flex-col antialiased">
      {/* Top Header */}
      <header className="border-b border-border-base bg-bg-surface/80 backdrop-blur-md sticky top-0 z-40 px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
            <span className="font-bold text-lg tracking-wider text-white">⚙️</span>
          </div>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-text-primary via-text-secondary to-text-muted bg-clip-text text-transparent">
              Mahesh motor spares (pvt)ltd
            </h1>
            <p className="text-xs text-text-muted font-medium tracking-wide">Parts Inventory & Cost Controller</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Tab Controls to Separate Views */}
          <div className="flex bg-bg-inset border border-border-base rounded-xl p-1 shadow-inner">
            <button
              onClick={() => { setActiveTab('checker'); setSearchTerm(''); }}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-all duration-200 cursor-pointer ${
                activeTab === 'checker' 
                  ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/20' 
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              🔍 Price Checker
            </button>
            <button
              onClick={() => { setActiveTab('manager'); setSearchTerm(''); }}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-all duration-200 cursor-pointer ${
                activeTab === 'manager' 
                  ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/20' 
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              🛠️ Manager Panel
            </button>
          </div>

          {/* Theme Toggle Button */}
          <button
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            className="p-2 rounded-xl bg-bg-inset border border-border-base text-text-muted hover:text-text-primary transition-all shadow-inner flex items-center justify-center cursor-pointer h-9 w-9"
            title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
          >
            {theme === 'light' ? '🌙' : '☀️'}
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Side: Search & Inventory Listing */}
        <section className="lg:col-span-5 flex flex-col gap-4">
          <div className="bg-[#0f0e18]/60 backdrop-blur-md border border-[#1c1a29] rounded-2xl p-4 flex flex-col gap-4 shadow-xl">
            
            {/* Search Input (Always visible on Checker, filterable on Manager) */}
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500 group-focus-within:text-violet-500 transition-colors">
                🔍
              </div>
              <input
                ref={activeTab === 'checker' ? searchInputRef : null}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Type OEM Part Number or Description..."
                className="w-full pl-10 pr-4 py-3 bg-[#08070d] border border-[#1f1d2e] rounded-xl text-zinc-200 placeholder-zinc-650 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/20 transition-all font-sans text-base shadow-inner"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-zinc-500 hover:text-zinc-300"
                >
                  ✕
                </button>
              )}
            </div>

            {/* List Header */}
            <div className="flex justify-between items-center px-1">
              <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest">
                Parts Listed ({filteredInventory.length})
              </span>
              {activeTab === 'manager' && (
                <button
                  onClick={() => setIsCreateModalOpen(true)}
                  className="text-xs font-bold bg-violet-600 hover:bg-violet-550 text-white px-3 py-1.5 rounded-lg shadow-lg shadow-violet-650/20 flex items-center gap-1 transition-all"
                >
                  ＋ Create Item
                </button>
              )}
            </div>

            {/* Scrollable list of items */}
            <div className="max-h-[60vh] overflow-y-auto flex flex-col gap-2 pr-1">
              {filteredInventory.length === 0 ? (
                <div className="text-center py-10 bg-[#08070d]/40 border border-dashed border-[#1f1d2e] rounded-xl">
                  <span className="text-3xl block mb-2">📦</span>
                  <span className="text-zinc-500 text-sm">No spare parts match your query</span>
                </div>
              ) : (
                filteredInventory.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setSelectedItemId(item.id)}
                    className={`w-full text-left p-4 rounded-xl border flex items-center justify-between transition-all duration-200 group ${
                      selectedItemId === item.id
                        ? 'bg-violet-950/15 border-violet-800/60 shadow-md shadow-violet-950/10'
                        : 'bg-[#0b0a11]/40 border-[#151321] hover:bg-[#12111d]/40 hover:border-[#221f35]'
                    }`}
                  >
                    <div className="flex flex-col gap-1 min-w-0 pr-2">
                      <span className={`font-mono text-sm tracking-wider ${
                        selectedItemId === item.id ? 'text-violet-400 font-bold' : 'text-zinc-300'
                      }`}>
                        {item.itemCode}
                      </span>
                      <span className="text-xs text-zinc-500 truncate">{item.description || 'No description'}</span>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className="text-xs font-bold font-mono tracking-widest text-zinc-300 bg-[#08070d]/80 border border-[#201d30] px-2 py-0.5 rounded">
                        {item.sellingPrice}
                      </span>
                      <span className="text-[10px] text-zinc-600 font-semibold uppercase">
                        Selling
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </section>

        {/* Right Side: Details and Actions */}
        <section className="lg:col-span-7 flex flex-col gap-6">
          {selectedItem ? (
            <div className="bg-[#0f0e18]/60 backdrop-blur-md border border-[#1c1a29] rounded-3xl p-6 flex flex-col gap-6 shadow-xl">
              
              {/* Detail Header */}
              <div className="flex justify-between items-start gap-4 border-b border-[#171524] pb-5">
                <div className="min-w-0">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-extrabold tracking-wider bg-violet-950/40 border border-violet-850 text-violet-400 uppercase mb-2">
                    Spare Part Card
                  </span>
                  <h2 className="text-2xl font-extrabold font-mono tracking-wider text-zinc-100 uppercase truncate">
                    {selectedItem.itemCode}
                  </h2>
                  <p className="text-sm text-zinc-400 font-medium mt-1">
                    {selectedItem.description || 'No description provided'}
                  </p>
                  <div className="mt-2 text-xs font-semibold text-zinc-500">
                    Pricing Model: <span className="text-zinc-300 capitalize">{selectedItem.pricingType || 'Standard'}</span>
                  </div>
                </div>
                
                {/* Actions (Only visible in Manager Tab) */}
                {activeTab === 'manager' && (
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => openUpdateModal(selectedItem)}
                      className="p-2.5 rounded-xl bg-[#121118] hover:bg-[#1a1924] text-zinc-300 hover:text-white border border-[#232033] transition-all text-xs font-bold flex items-center gap-1.5 shadow-sm"
                      title="Update Pricing Details"
                    >
                      ✏️ Update Price
                    </button>
                    <button
                      onClick={() => openEditModal(selectedItem)}
                      className="p-2.5 rounded-xl bg-[#121118] hover:bg-[#1a1924] text-zinc-300 hover:text-white border border-[#232033] transition-all text-xs font-bold shadow-sm"
                      title="Edit basic info"
                    >
                      🛠️ Edit Info
                    </button>
                    <button
                      onClick={() => handleDeleteItem(selectedItem.id, selectedItem.itemCode)}
                      className="p-2.5 rounded-xl bg-red-950/10 hover:bg-red-950/30 text-red-400 border border-red-900/20 transition-all text-xs font-bold"
                      title="Delete item from inventory"
                    >
                      🗑️
                    </button>
                  </div>
                )}
              </div>

              {/* Price Details Grid - Display ciphers directly, NO currency symbols */}
              {selectedItem.pricingType === 'imported' ? (
                /* Layout for Imported Pricing Model */
                <div className="flex flex-col gap-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-[#121019] border border-[#201d2d] rounded-2xl p-4 flex flex-col relative overflow-hidden">
                      <span className="text-[10px] font-extrabold text-zinc-500 uppercase tracking-widest mb-2 block">
                        Foreign Cost Code
                      </span>
                      <div className="flex items-baseline gap-1 mt-auto">
                        <span className="text-2xl font-extrabold font-mono tracking-wider text-amber-400">
                          {selectedItem.foreignPrice}
                        </span>
                      </div>
                    </div>

                    <div className="bg-[#0f1519] border border-[#1b2d2f] rounded-2xl p-4 flex flex-col relative overflow-hidden">
                      <span className="text-[10px] font-extrabold text-zinc-500 uppercase tracking-widest mb-2 block">
                        Exchange Rate Code
                      </span>
                      <div className="flex items-baseline gap-1 mt-auto">
                        <span className="text-2xl font-extrabold font-mono tracking-wider text-cyan-400">
                          {selectedItem.exchangeRate}
                        </span>
                      </div>
                    </div>

                    <div className="bg-[#15101c] border border-[#271d31] rounded-2xl p-4 flex flex-col relative overflow-hidden">
                      <span className="text-[10px] font-extrabold text-zinc-500 uppercase tracking-widest mb-2 block">
                        Calculated Local Cost Code
                      </span>
                      <div className="flex items-baseline gap-1 mt-auto">
                        <span className="text-2xl font-extrabold font-mono tracking-wider text-violet-400">
                          {selectedItem.costPrice}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-[#0d0b13] border border-[#1d1a2b] rounded-2xl p-5 flex flex-col relative overflow-hidden shadow-inner">
                    <span className="text-[10px] font-extrabold text-zinc-500 uppercase tracking-widest mb-2 block">
                      Selling Price Code
                    </span>
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-extrabold font-mono tracking-wider text-indigo-400">
                        {selectedItem.sellingPrice}
                      </span>
                    </div>
                  </div>
                </div>
              ) : selectedItem.pricingType === 'discount' ? (
                /* Layout for Discount Pricing Model */
                <div className="flex flex-col gap-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-[#121019] border border-[#201d2d] rounded-2xl p-4 flex flex-col relative overflow-hidden">
                      <span className="text-[10px] font-extrabold text-zinc-500 uppercase tracking-widest mb-2 block">
                        List Cost Code
                      </span>
                      <div className="flex items-baseline gap-1 mt-auto">
                        <span className="text-2xl font-extrabold font-mono tracking-wider text-amber-400">
                          {selectedItem.costPrice}
                        </span>
                      </div>
                    </div>

                    <div className="bg-[#0a1510] border border-[#142d20] rounded-2xl p-4 flex flex-col relative overflow-hidden">
                      <span className="text-[10px] font-extrabold text-zinc-500 uppercase tracking-widest mb-2 block">
                        Discount Code
                      </span>
                      <div className="flex items-baseline gap-1 mt-auto">
                        <span className="text-2xl font-extrabold font-mono tracking-wider text-emerald-400">
                          {selectedItem.discount}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-[#0b0a11] border border-[#1d1b2a] rounded-2xl p-4 flex flex-col relative overflow-hidden shadow-inner">
                      <span className="text-[10px] font-extrabold text-zinc-500 uppercase tracking-widest mb-2 block">
                        Calculated Net Cost Code
                      </span>
                      <div className="flex items-baseline gap-1 mt-auto">
                        <span className="text-xl font-extrabold font-mono tracking-wider text-zinc-400">
                          {getCalculatedNetCost(selectedItem.costPrice, selectedItem.discount)}
                        </span>
                      </div>
                    </div>

                    <div className="bg-[#110e19] border border-[#221b33] rounded-2xl p-4 flex flex-col relative overflow-hidden">
                      <span className="text-[10px] font-extrabold text-zinc-500 uppercase tracking-widest mb-2 block">
                        Selling Price Code
                      </span>
                      <div className="flex items-baseline gap-1 mt-auto">
                        <span className="text-2xl font-extrabold font-mono tracking-wider text-indigo-400">
                          {selectedItem.sellingPrice}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* Layout for Standard Pricing Model */
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-[#121019] border border-[#201d2d] rounded-2xl p-4 flex flex-col relative overflow-hidden">
                    <span className="text-[10px] font-extrabold text-zinc-500 uppercase tracking-widest mb-2 block">
                      Cost Code
                    </span>
                    <div className="flex items-baseline gap-1 mt-auto">
                      <span className="text-2xl font-extrabold font-mono tracking-wider text-amber-400">
                        {selectedItem.costPrice}
                      </span>
                    </div>
                  </div>

                  <div className="bg-[#110e19] border border-[#221b33] rounded-2xl p-4 flex flex-col relative overflow-hidden">
                    <span className="text-[10px] font-extrabold text-zinc-500 uppercase tracking-widest mb-2 block">
                      Selling Price Code
                    </span>
                    <div className="flex items-baseline gap-1 mt-auto">
                      <span className="text-2xl font-extrabold font-mono tracking-wider text-indigo-400">
                        {selectedItem.sellingPrice}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Price History Timeline (Strings only) */}
              <div className="border-t border-[#171524] pt-6">
                <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-4 flex items-center gap-1.5">
                  🕒 Price Revision History
                </h3>
                
                {selectedItem.priceHistory.length === 0 ? (
                  <div className="text-center py-8 bg-[#090810]/40 border border-[#1a1827] rounded-2xl text-zinc-600 text-xs italic font-medium">
                    No pricing changes recorded. This item has maintained its original register prices.
                  </div>
                ) : (
                  <div className="relative pl-4 border-l border-[#1f1d2e] flex flex-col gap-4">
                    {selectedItem.priceHistory.map((history, idx) => (
                      <div key={idx} className="relative group">
                        {/* Timeline dot */}
                        <div className="absolute -left-[21px] top-1.5 w-2.5 h-2.5 rounded-full bg-[#181624] border-2 border-[#08070b] group-hover:bg-violet-500 transition-colors" />
                        
                        <div className="flex flex-col gap-1.5">
                          <span className="text-[10px] text-zinc-500 font-bold">{history.date}</span>
                          
                          <div className="grid grid-cols-2 gap-4 bg-[#090810]/40 border border-[#191726] rounded-xl p-3 text-xs shadow-inner">
                            <div>
                              <span className="text-zinc-500 block text-[9px] font-bold uppercase">Cost Price Code</span>
                              <span className="font-mono text-zinc-300">
                                {history.oldCost || '—'} → {history.newCost}
                              </span>
                            </div>
                            <div>
                              <span className="text-zinc-500 block text-[9px] font-bold uppercase">Selling Price Code</span>
                              <span className="font-mono text-zinc-300">
                                {history.oldSelling} → {history.newSelling}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          ) : (
            <div className="flex-1 border border-dashed border-[#1f1d2e] rounded-3xl flex flex-col items-center justify-center p-12 text-center bg-[#0d0b13]/10">
              <span className="text-5xl block mb-4">🔍</span>
              <h2 className="text-lg font-bold text-zinc-400">No Item Selected</h2>
              <p className="text-sm text-zinc-500 mt-2 max-w-sm">
                Type in the search box to find a spare part, or switch to the Manager Panel to register new ones.
              </p>
            </div>
          )}
        </section>
      </main>

      {/* --- CREATE NEW ITEM MODAL (Only cipher string inputs) --- */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-[#0f0e18] border border-[#211f32] rounded-2xl p-6 shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center border-b border-[#1f1d2e] pb-4 mb-4">
              <h3 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
                📋 Register New Spare Part
              </h3>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-zinc-550 hover:text-zinc-300 text-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-bold text-zinc-450 uppercase tracking-wide block mb-1">
                  OEM Part Code / SKU <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 04465-60100"
                  value={createForm.itemCode}
                  onChange={(e) => setCreateForm({ ...createForm, itemCode: e.target.value })}
                  className="w-full bg-[#08070d] border border-[#1f1d2e] rounded-lg py-2 px-3 text-sm text-zinc-100 focus:outline-none focus:border-violet-500 font-mono uppercase shadow-inner"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-zinc-455 uppercase tracking-wide block mb-1">
                  Description / Vehicle Compatibility
                </label>
                <input
                  type="text"
                  placeholder="e.g. Front Brake Pads (Toyota Corolla)"
                  value={createForm.description}
                  onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                  className="w-full bg-[#08070d] border border-[#1f1d2e] rounded-lg py-2 px-3 text-sm text-zinc-100 focus:outline-none focus:border-violet-500 shadow-inner"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-zinc-455 uppercase tracking-wide block mb-1">
                  Pricing Model
                </label>
                <select
                  value={createForm.pricingType}
                  onChange={(e) => setCreateForm({ ...createForm, pricingType: e.target.value })}
                  className="w-full bg-[#08070d] border border-[#1f1d2e] rounded-lg py-2 px-3 text-sm text-zinc-100 focus:outline-none focus:border-violet-500"
                >
                  <option value="standard">Standard (Direct Cost & Selling)</option>
                  <option value="imported">Imported (Price & Exchange Rate)</option>
                  <option value="discount">Discount (Cost & Discount Margin)</option>
                </select>
              </div>

              {/* Dynamic form fields depending on Pricing Model - raw text cipher inputs */}
              {createForm.pricingType === 'standard' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-zinc-455 uppercase tracking-wide block mb-1">
                      Cost Code <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. ONLY"
                      value={createForm.costPrice}
                      onChange={(e) => setCreateForm({ ...createForm, costPrice: sanitizeCipher(e.target.value) })}
                      className="w-full bg-[#08070d] border border-[#1f1d2e] rounded-lg py-2 px-3 text-sm text-zinc-100 focus:outline-none focus:border-violet-500 font-mono uppercase shadow-inner"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-zinc-455 uppercase tracking-wide block mb-1">
                      Selling Code <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. EEIXY"
                      value={createForm.sellingPrice}
                      onChange={(e) => setCreateForm({ ...createForm, sellingPrice: sanitizeCipher(e.target.value) })}
                      className="w-full bg-[#08070d] border border-[#1f1d2e] rounded-lg py-2 px-3 text-sm text-zinc-100 focus:outline-none focus:border-violet-500 font-mono uppercase shadow-inner"
                    />
                  </div>
                </div>
              )}

              {createForm.pricingType === 'imported' && (
                <div className="flex flex-col gap-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold text-zinc-455 uppercase tracking-wide block mb-1">
                        Foreign Cost Code <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. ES"
                        value={createForm.foreignPrice}
                        onChange={(e) => setCreateForm({ ...createForm, foreignPrice: sanitizeCipher(e.target.value) })}
                        className="w-full bg-[#08070d] border border-[#1f1d2e] rounded-lg py-2 px-3 text-sm text-zinc-100 focus:outline-none focus:border-violet-500 font-mono uppercase shadow-inner"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-zinc-455 uppercase tracking-wide block mb-1">
                        Exchange Rate Code <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. OI"
                        value={createForm.exchangeRate}
                        onChange={(e) => setCreateForm({ ...createForm, exchangeRate: sanitizeCipher(e.target.value) })}
                        className="w-full bg-[#08070d] border border-[#1f1d2e] rounded-lg py-2 px-3 text-sm text-zinc-100 focus:outline-none focus:border-violet-500 font-mono uppercase shadow-inner"
                      />
                    </div>
                  </div>

                  <div className="bg-[#08070d]/80 border border-[#1f1d2e] rounded-xl p-3 text-xs">
                    <span className="text-zinc-550 block text-[9px] font-bold uppercase">Calculated Local Cost Code Preview</span>
                    <span className="font-mono text-zinc-300 font-bold">
                      {createForm.foreignPrice && createForm.exchangeRate ? (
                        encodePrice(Math.round((decodePrice(createForm.foreignPrice) || 0) * (decodePrice(createForm.exchangeRate) || 0)))
                      ) : (
                        '—'
                      )}
                    </span>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-zinc-455 uppercase tracking-wide block mb-1">
                      Selling Code <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. EEIXY"
                      value={createForm.sellingPrice}
                      onChange={(e) => setCreateForm({ ...createForm, sellingPrice: sanitizeCipher(e.target.value) })}
                      className="w-full bg-[#08070d] border border-[#1f1d2e] rounded-lg py-2 px-3 text-sm text-zinc-100 focus:outline-none focus:border-violet-500 font-mono uppercase shadow-inner"
                    />
                  </div>
                </div>
              )}

              {createForm.pricingType === 'discount' && (
                <div className="flex flex-col gap-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold text-zinc-455 uppercase tracking-wide block mb-1">
                        Cost Code <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. EBIY"
                        value={createForm.costPrice}
                        onChange={(e) => setCreateForm({ ...createForm, costPrice: sanitizeCipher(e.target.value) })}
                        className="w-full bg-[#08070d] border border-[#1f1d2e] rounded-lg py-2 px-3 text-sm text-zinc-100 focus:outline-none focus:border-violet-500 font-mono uppercase shadow-inner"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-zinc-455 uppercase tracking-wide block mb-1">
                        Discount Code <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. NI"
                        value={createForm.discount}
                        onChange={(e) => setCreateForm({ ...createForm, discount: sanitizeCipher(e.target.value) })}
                        className="w-full bg-[#08070d] border border-[#1f1d2e] rounded-lg py-2 px-3 text-sm text-zinc-100 focus:outline-none focus:border-violet-500 font-mono uppercase shadow-inner"
                      />
                    </div>
                  </div>

                  <div className="bg-[#08070d]/80 border border-[#1f1d2e] rounded-xl p-3 text-xs">
                    <span className="text-zinc-550 block text-[9px] font-bold uppercase">Calculated Net Cost Code Preview</span>
                    <span className="font-mono text-zinc-300 font-bold">
                      {createForm.costPrice && createForm.discount ? (
                        getCalculatedNetCost(createForm.costPrice, createForm.discount)
                      ) : (
                        '—'
                      )}
                    </span>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-zinc-455 uppercase tracking-wide block mb-1">
                      Selling Code <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. NNSY"
                      value={createForm.sellingPrice}
                      onChange={(e) => setCreateForm({ ...createForm, sellingPrice: sanitizeCipher(e.target.value) })}
                      className="w-full bg-[#08070d] border border-[#1f1d2e] rounded-lg py-2 px-3 text-sm text-zinc-100 focus:outline-none focus:border-violet-500 font-mono uppercase shadow-inner"
                    />
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3 mt-4 border-t border-[#1f1d2e] pt-4">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-[#121118] hover:bg-[#1a1924] text-xs font-bold border border-[#232033] transition-all text-zinc-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-xs font-bold text-white shadow-lg shadow-violet-600/20 transition-all"
                >
                  Save Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- UPDATE PRICES MODAL (Only cipher string inputs) --- */}
      {isUpdateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-[#0f0e18] border border-[#211f32] rounded-2xl p-6 shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center border-b border-[#1f1d2e] pb-4 mb-4">
              <h3 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
                ✏️ Update Pricing Sheets
              </h3>
              <button
                onClick={() => setIsUpdateModalOpen(false)}
                className="text-zinc-550 hover:text-zinc-300 text-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateSubmit} className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-bold text-zinc-455 uppercase tracking-wide block mb-1">
                  Pricing Model
                </label>
                <select
                  value={updateForm.pricingType}
                  onChange={(e) => setUpdateForm({ ...updateForm, pricingType: e.target.value })}
                  className="w-full bg-[#08070d] border border-[#1f1d2e] rounded-lg py-2 px-3 text-sm text-zinc-100 focus:outline-none focus:border-violet-500 shadow-inner"
                >
                  <option value="standard">Standard (Direct Cost & Selling)</option>
                  <option value="imported">Imported (Price & Exchange Rate)</option>
                  <option value="discount">Discount (Cost & Discount Margin)</option>
                </select>
              </div>

              {/* Dynamic update fields depending on Pricing Model */}
              {updateForm.pricingType === 'standard' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-zinc-455 uppercase tracking-wide block mb-1">
                      New Cost Code <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. ONLY"
                      value={updateForm.costPrice}
                      onChange={(e) => setUpdateForm({ ...updateForm, costPrice: sanitizeCipher(e.target.value) })}
                      className="w-full bg-[#08070d] border border-[#1f1d2e] rounded-lg py-2 px-3 text-sm text-zinc-100 focus:outline-none focus:border-violet-500 font-mono uppercase shadow-inner"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-zinc-455 uppercase tracking-wide block mb-1">
                      New Selling Code <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. EEIXY"
                      value={updateForm.sellingPrice}
                      onChange={(e) => setUpdateForm({ ...updateForm, sellingPrice: sanitizeCipher(e.target.value) })}
                      className="w-full bg-[#08070d] border border-[#1f1d2e] rounded-lg py-2 px-3 text-sm text-zinc-100 focus:outline-none focus:border-violet-500 font-mono uppercase shadow-inner"
                    />
                  </div>
                </div>
              )}

              {updateForm.pricingType === 'imported' && (
                <div className="flex flex-col gap-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold text-zinc-455 uppercase tracking-wide block mb-1">
                        New Foreign Cost Code <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. ES"
                        value={updateForm.foreignPrice}
                        onChange={(e) => setUpdateForm({ ...updateForm, foreignPrice: sanitizeCipher(e.target.value) })}
                        className="w-full bg-[#08070d] border border-[#1f1d2e] rounded-lg py-2 px-3 text-sm text-zinc-100 focus:outline-none focus:border-violet-500 font-mono uppercase shadow-inner"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-zinc-455 uppercase tracking-wide block mb-1">
                        New Exchange Rate Code <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. OI"
                        value={updateForm.exchangeRate}
                        onChange={(e) => setUpdateForm({ ...updateForm, exchangeRate: sanitizeCipher(e.target.value) })}
                        className="w-full bg-[#08070d] border border-[#1f1d2e] rounded-lg py-2 px-3 text-sm text-zinc-100 focus:outline-none focus:border-violet-500 font-mono uppercase shadow-inner"
                      />
                    </div>
                  </div>

                  <div className="bg-[#08070d]/80 border border-[#1f1d2e] rounded-xl p-3 text-xs">
                    <span className="text-zinc-550 block text-[9px] font-bold uppercase">Calculated Local Cost Code Preview</span>
                    <span className="font-mono text-zinc-300 font-bold">
                      {updateForm.foreignPrice && updateForm.exchangeRate ? (
                        encodePrice(Math.round((decodePrice(updateForm.foreignPrice) || 0) * (decodePrice(updateForm.exchangeRate) || 0)))
                      ) : (
                        '—'
                      )}
                    </span>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-zinc-455 uppercase tracking-wide block mb-1">
                      New Selling Code <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. EEIXY"
                      value={updateForm.sellingPrice}
                      onChange={(e) => setUpdateForm({ ...updateForm, sellingPrice: sanitizeCipher(e.target.value) })}
                      className="w-full bg-[#08070d] border border-[#1f1d2e] rounded-lg py-2 px-3 text-sm text-zinc-100 focus:outline-none focus:border-violet-500 font-mono uppercase shadow-inner"
                    />
                  </div>
                </div>
              )}

              {updateForm.pricingType === 'discount' && (
                <div className="flex flex-col gap-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold text-zinc-455 uppercase tracking-wide block mb-1">
                        New Cost Code <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. EBIY"
                        value={updateForm.costPrice}
                        onChange={(e) => setUpdateForm({ ...updateForm, costPrice: sanitizeCipher(e.target.value) })}
                        className="w-full bg-[#08070d] border border-[#1f1d2e] rounded-lg py-2 px-3 text-sm text-zinc-100 focus:outline-none focus:border-violet-500 font-mono uppercase shadow-inner"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-zinc-455 uppercase tracking-wide block mb-1">
                        New Discount Code <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. NI"
                        value={updateForm.discount}
                        onChange={(e) => setUpdateForm({ ...updateForm, discount: sanitizeCipher(e.target.value) })}
                        className="w-full bg-[#08070d] border border-[#1f1d2e] rounded-lg py-2 px-3 text-sm text-zinc-100 focus:outline-none focus:border-violet-500 font-mono uppercase shadow-inner"
                      />
                    </div>
                  </div>

                  <div className="bg-[#08070d]/80 border border-[#1f1d2e] rounded-xl p-3 text-xs">
                    <span className="text-zinc-550 block text-[9px] font-bold uppercase">Calculated Net Cost Code Preview</span>
                    <span className="font-mono text-zinc-300 font-bold">
                      {updateForm.costPrice && updateForm.discount ? (
                        getCalculatedNetCost(updateForm.costPrice, updateForm.discount)
                      ) : (
                        '—'
                      )}
                    </span>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-zinc-455 uppercase tracking-wide block mb-1">
                      New Selling Code <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. NNSY"
                      value={updateForm.sellingPrice}
                      onChange={(e) => setUpdateForm({ ...updateForm, sellingPrice: sanitizeCipher(e.target.value) })}
                      className="w-full bg-[#08070d] border border-[#1f1d2e] rounded-lg py-2 px-3 text-sm text-zinc-100 focus:outline-none focus:border-violet-500 font-mono uppercase shadow-inner"
                    />
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3 mt-4 border-t border-[#1f1d2e] pt-4">
                <button
                  type="button"
                  onClick={() => setIsUpdateModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-[#121118] hover:bg-[#1a1924] text-xs font-bold border border-[#232033] transition-all text-zinc-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-550 text-xs font-bold text-white shadow-lg shadow-violet-600/20 transition-all"
                >
                  Commit Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- EDIT BASIC DETAILS MODAL --- */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-[#0f0e18] border border-[#211f32] rounded-2xl p-6 shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center border-b border-[#1f1d2e] pb-4 mb-4">
              <h3 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
                ⚙️ Edit Spare Part Details
              </h3>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="text-zinc-550 hover:text-zinc-300 text-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-bold text-zinc-455 uppercase tracking-wide block mb-1">
                  OEM Part Code / SKU <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editForm.itemCode}
                  onChange={(e) => setEditForm({ ...editForm, itemCode: e.target.value })}
                  className="w-full bg-[#08070d] border border-[#1f1d2e] rounded-lg py-2 px-3 text-sm text-zinc-100 focus:outline-none focus:border-violet-500 font-mono uppercase shadow-inner"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-zinc-455 uppercase tracking-wide block mb-1">
                  Description / Vehicle Compatibility
                </label>
                <input
                  type="text"
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  className="w-full bg-[#08070d] border border-[#1f1d2e] rounded-lg py-2 px-3 text-sm text-zinc-100 focus:outline-none focus:border-violet-500 shadow-inner"
                />
              </div>

              <div className="flex justify-end gap-3 mt-4 border-t border-[#1f1d2e] pt-4">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-[#121118] hover:bg-[#1a1924] text-xs font-bold border border-[#232033] transition-all text-zinc-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-550 text-xs font-bold text-white shadow-lg shadow-violet-600/20 transition-all"
                >
                  Apply Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
