package com.example.partscatalog.ui.main

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.partscatalog.data.Part
import com.example.partscatalog.data.PartsRepository
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.Dispatchers
import java.net.HttpURLConnection
import java.net.URL

class MainScreenViewModel(private val repository: PartsRepository) : ViewModel() {

    // --- Pairing State ---
    private val _isPaired = MutableStateFlow(repository.isPaired())
    val isPaired: StateFlow<Boolean> = _isPaired.asStateFlow()

    private val _pairingUrl = MutableStateFlow(repository.getServerUrl() ?: "")
    val pairingUrl: StateFlow<String> = _pairingUrl.asStateFlow()

    private val _username = MutableStateFlow(repository.getUsername() ?: "")
    val username: StateFlow<String> = _username.asStateFlow()

    private val _password = MutableStateFlow("")
    val password: StateFlow<String> = _password.asStateFlow()

    private val _isConnecting = MutableStateFlow(false)
    val isConnecting: StateFlow<Boolean> = _isConnecting.asStateFlow()

    private val _pairingError = MutableStateFlow<String?>(null)
    val pairingError: StateFlow<String?> = _pairingError.asStateFlow()

    // --- Catalog State ---
    private val _allParts = MutableStateFlow<List<Part>>(emptyList())
    val allParts: StateFlow<List<Part>> = _allParts.asStateFlow()

    private val _searchQuery = MutableStateFlow("")
    val searchQuery: StateFlow<String> = _searchQuery.asStateFlow()

    private val _isOnline = MutableStateFlow(false)
    val isOnline: StateFlow<Boolean> = _isOnline.asStateFlow()

    private val _syncQueueSize = MutableStateFlow(repository.getSyncQueueSize())
    val syncQueueSize: StateFlow<Int> = _syncQueueSize.asStateFlow()

    private val _isSyncing = MutableStateFlow(false)
    val isSyncing: StateFlow<Boolean> = _isSyncing.asStateFlow()

    private val _syncMessage = MutableStateFlow<String?>(null)
    val syncMessage: StateFlow<String?> = _syncMessage.asStateFlow()

    // --- Edit Sheet State ---
    private val _editingPart = MutableStateFlow<Part?>(null)
    val editingPart: StateFlow<Part?> = _editingPart.asStateFlow()

    private val _pricingType = MutableStateFlow("standard")
    val pricingType: StateFlow<String> = _pricingType.asStateFlow()

    private val _costPrice = MutableStateFlow("")
    val costPrice: StateFlow<String> = _costPrice.asStateFlow()

    private val _sellingPrice = MutableStateFlow("")
    val sellingPrice: StateFlow<String> = _sellingPrice.asStateFlow()

    private val _discount = MutableStateFlow("")
    val discount: StateFlow<String> = _discount.asStateFlow()

    private val _foreignPrice = MutableStateFlow("")
    val foreignPrice: StateFlow<String> = _foreignPrice.asStateFlow()

    private val _exchangeRate = MutableStateFlow("")
    val exchangeRate: StateFlow<String> = _exchangeRate.asStateFlow()

    private val _computedPreview = MutableStateFlow("")
    val computedPreview: StateFlow<String> = _computedPreview.asStateFlow()

    // Backward compatibility property for MainScreen UI compilation
    val uiState: StateFlow<MainScreenUiState> = MutableStateFlow(MainScreenUiState.Loading)

    private var connectionJob: Job? = null

    init {
        if (_isPaired.value) {
            loadLocalCatalog()
            startConnectionPolling()
        }
    }

    // --- Pairing Actions ---
    fun onPairingUrlChanged(url: String) {
        _pairingUrl.value = url
    }

    fun onUsernameChanged(user: String) {
        _username.value = user
    }

    fun onPasswordChanged(pass: String) {
        _password.value = pass
    }

    fun pairDevice() {
        viewModelScope.launch {
            _isConnecting.value = true
            _pairingError.value = null
            val result = repository.connectAndPair(_pairingUrl.value, _username.value, _password.value)
            if (result.isSuccess) {
                _isPaired.value = true
                _password.value = ""
                loadLocalCatalog()
                startConnectionPolling()
                // Sync any initial state
                triggerBackgroundSync()
            } else {
                _pairingError.value = result.exceptionOrNull()?.message ?: "Connection failed"
            }
            _isConnecting.value = false
        }
    }

    fun unpairDevice() {
        connectionJob?.cancel()
        repository.clearPairing()
        _isPaired.value = false
        _allParts.value = emptyList()
        _password.value = ""
        _pairingError.value = null
    }

    fun loadLocalCatalog() {
        _allParts.value = repository.getLocalParts()
        _syncQueueSize.value = repository.getSyncQueueSize()
    }

    // --- Catalog Actions ---
    fun onSearchQueryChanged(query: String) {
        _searchQuery.value = query
    }

    fun selectPartForEdit(part: Part) {
        _editingPart.value = part
        _pricingType.value = part.pricingType
        _costPrice.value = part.costPrice ?: ""
        _sellingPrice.value = part.sellingPrice ?: ""
        _discount.value = part.discount ?: ""
        _foreignPrice.value = part.foreignPrice ?: ""
        _exchangeRate.value = part.exchangeRate ?: ""
        updateComputedPreview()
    }

    fun closeEditDialog() {
        _editingPart.value = null
    }

    fun onPricingTypeChanged(type: String) {
        _pricingType.value = type
        updateComputedPreview()
    }

    fun onCostPriceChanged(cost: String) {
        _costPrice.value = validateCipherString(cost)
    }

    fun onSellingPriceChanged(selling: String) {
        _sellingPrice.value = validateCipherString(selling)
    }

    fun onDiscountChanged(disc: String) {
        _discount.value = validateCipherString(disc)
        updateComputedPreview()
    }

    fun onForeignPriceChanged(foreign: String) {
        _foreignPrice.value = validateCipherString(foreign)
        updateComputedPreview()
    }

    fun onExchangeRateChanged(rate: String) {
        _exchangeRate.value = validateCipherString(rate)
        updateComputedPreview()
    }

    private fun validateCipherString(input: String): String {
        return input.uppercase().replace(Regex("[^ENGLIHSBYX0-9.]"), "")
    }

    fun encodePrice(price: Double?): String {
        return repository.encodePrice(price)
    }

    private fun updateComputedPreview() {
        viewModelScope.launch {
            val type = _pricingType.value
            if (type == "imported") {
                val foreign = repository.decodePrice(_foreignPrice.value)
                val rate = repository.decodePrice(_exchangeRate.value)
                if (foreign != null && rate != null) {
                    val computedVal = Math.round(foreign * rate).toDouble()
                    _computedPreview.value = "Calculated Cost Preview: " + repository.encodePrice(computedVal)
                } else {
                    _computedPreview.value = "Calculated Cost Preview: -"
                }
            } else if (type == "discount") {
                val list = repository.decodePrice(_costPrice.value)
                val disc = repository.decodePrice(_discount.value)
                if (list != null && disc != null) {
                    val computedVal = Math.round(list - (list * (disc / 100.0))).toDouble()
                    _computedPreview.value = "Calculated Net Cost Preview: " + repository.encodePrice(computedVal)
                } else {
                    _computedPreview.value = "Calculated Net Cost Preview: -"
                }
            } else {
                _computedPreview.value = ""
            }
        }
    }

    fun savePartPricing() {
        val part = _editingPart.value ?: return
        val type = _pricingType.value

        val pricingData = mutableMapOf<String, String>()
        pricingData["pricing_type"] = type

        if (type == "standard") {
            pricingData["cost_price"] = _costPrice.value
            pricingData["selling_price"] = _sellingPrice.value
        } else if (type == "imported") {
            pricingData["foreign_price"] = _foreignPrice.value
            pricingData["exchange_rate"] = _exchangeRate.value

            val foreign = repository.decodePrice(_foreignPrice.value)
            val rate = repository.decodePrice(_exchangeRate.value)
            if (foreign != null && rate != null) {
                pricingData["cost_price"] = repository.encodePrice(Math.round(foreign * rate).toDouble())
            } else {
                pricingData["cost_price"] = ""
            }
        } else if (type == "discount") {
            pricingData["cost_price"] = _costPrice.value
            pricingData["discount"] = _discount.value
        }

        // Save locally in SQLite & queue for sync
        repository.savePartPricingLocal(part.id, pricingData)
        loadLocalCatalog()
        closeEditDialog()

        // Sync immediately if online
        if (_isOnline.value) {
            triggerBackgroundSync()
        }
    }

    // --- Sync Operations ---
    fun triggerBackgroundSync() {
        if (_isSyncing.value || !_isOnline.value) return
        viewModelScope.launch {
            _isSyncing.value = true
            _syncMessage.value = "Syncing with desktop server..."
            val result = repository.syncPendingPriceUpdates()
            if (result.isSuccess) {
                val count = result.getOrThrow()
                _syncMessage.value = if (count > 0) "Successfully synced $count updates!" else "Catalog is up-to-date."
                loadLocalCatalog()
            } else {
                _syncMessage.value = "Sync failed: " + result.exceptionOrNull()?.message
            }
            _isSyncing.value = false
            delay(3000)
            _syncMessage.value = null
        }
    }

    private fun startConnectionPolling() {
        connectionJob?.cancel()
        connectionJob = viewModelScope.launch {
            while (true) {
                checkConnectionState()
                delay(10000) // Poll connection every 10 seconds
            }
        }
    }

    private suspend fun checkConnectionState() {
        val serverUrl = repository.getServerUrl() ?: return
        val token = repository.getAuthToken() ?: return
        try {
            // Check connection by pinging the backend server URL on IO dispatcher
            val status = kotlinx.coroutines.withContext(Dispatchers.IO) {
                val url = URL("$serverUrl/api/parts/all")
                val conn = url.openConnection() as HttpURLConnection
                conn.requestMethod = "GET"
                conn.connectTimeout = 3000
                conn.readTimeout = 3000
                conn.setRequestProperty("Authorization", "Bearer $token")
                conn.responseCode
            }
            val wasOnline = _isOnline.value
            _isOnline.value = status in 200..299
            
            // If connection is recovered, trigger auto-sync
            if (_isOnline.value && !wasOnline) {
                triggerBackgroundSync()
            }
        } catch (e: Exception) {
            _isOnline.value = false
        }
    }

    override fun onCleared() {
        connectionJob?.cancel()
        super.onCleared()
    }
}

// Backward compatibility interfaces
sealed interface MainScreenUiState {
    object Loading : MainScreenUiState
    data class Error(val throwable: Throwable) : MainScreenUiState
    data class Success(val data: List<String>) : MainScreenUiState
}
