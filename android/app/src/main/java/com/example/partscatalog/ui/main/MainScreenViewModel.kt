package com.example.partscatalog.ui.main

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.partscatalog.data.Part
import com.example.partscatalog.data.PartsRepository
import com.example.partscatalog.data.PriceHistoryEntry
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
    private val _isPaired = MutableStateFlow(false)
    val isPaired: StateFlow<Boolean> = _isPaired.asStateFlow()

    private val _pairingUrl = MutableStateFlow("")
    val pairingUrl: StateFlow<String> = _pairingUrl.asStateFlow()

    private val _username = MutableStateFlow("")
    val username: StateFlow<String> = _username.asStateFlow()

    private val _password = MutableStateFlow("")
    val password: StateFlow<String> = _password.asStateFlow()

    private val _isConnecting = MutableStateFlow(false)
    val isConnecting: StateFlow<Boolean> = _isConnecting.asStateFlow()

    private val _pairingError = MutableStateFlow<String?>(null)
    val pairingError: StateFlow<String?> = _pairingError.asStateFlow()

    // --- Catalog and Search States ---
    private val _allParts = MutableStateFlow<List<Part>>(emptyList())
    val allParts: StateFlow<List<Part>> = _allParts.asStateFlow()

    private val _searchQuery = MutableStateFlow("")
    val searchQuery: StateFlow<String> = _searchQuery.asStateFlow()

    // Desktop search superpower inputs
    private val _searchType = MutableStateFlow("universal") // "universal" or "specs"
    val searchType: StateFlow<String> = _searchType.asStateFlow()

    private val _specNameQuery = MutableStateFlow("")
    val specNameQuery: StateFlow<String> = _specNameQuery.asStateFlow()

    private val _specValueQuery = MutableStateFlow("")
    val specValueQuery: StateFlow<String> = _specValueQuery.asStateFlow()

    // --- Connection and Sync States ---
    private val _isOnline = MutableStateFlow(false)
    val isOnline: StateFlow<Boolean> = _isOnline.asStateFlow()

    private val _isSyncing = MutableStateFlow(false)
    val isSyncing: StateFlow<Boolean> = _isSyncing.asStateFlow()

    private val _syncMessage = MutableStateFlow<String?>(null)
    val syncMessage: StateFlow<String?> = _syncMessage.asStateFlow()

    private val _syncQueueSize = MutableStateFlow(0)
    val syncQueueSize: StateFlow<Int> = _syncQueueSize.asStateFlow()

    // --- Details Overlay State ---
    private val _selectedPart = MutableStateFlow<Part?>(null)
    val selectedPart: StateFlow<Part?> = _selectedPart.asStateFlow()

    private val _priceHistory = MutableStateFlow<List<PriceHistoryEntry>>(emptyList())
    val priceHistory: StateFlow<List<PriceHistoryEntry>> = _priceHistory.asStateFlow()

    private var connectionJob: Job? = null

    init {
        viewModelScope.launch(Dispatchers.IO) {
            val paired = repository.isPaired()
            val url = repository.getServerUrl() ?: ""
            val user = repository.getUsername() ?: ""
            
            kotlinx.coroutines.withContext(Dispatchers.Main) {
                _isPaired.value = paired
                _pairingUrl.value = url
                _username.value = user
                
                if (paired) {
                    loadLocalCatalog()
                    startConnectionPolling()
                }
            }
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
            val result = kotlinx.coroutines.withContext(Dispatchers.IO) {
                repository.connectAndPair(_pairingUrl.value, _username.value, _password.value)
            }
            if (result.isSuccess) {
                _isPaired.value = true
                _password.value = ""
                loadLocalCatalog()
                startConnectionPolling()
                triggerBackgroundSync()
            } else {
                _pairingError.value = result.exceptionOrNull()?.message ?: "Connection failed"
            }
            _isConnecting.value = false
        }
    }

    fun pairViaQrLogin(serverUrl: String, qrToken: String) {
        viewModelScope.launch {
            _isConnecting.value = true
            _pairingError.value = null
            val result = kotlinx.coroutines.withContext(Dispatchers.IO) {
                repository.connectAndPairViaQrLogin(serverUrl, qrToken)
            }
            if (result.isSuccess) {
                _isPaired.value = true
                _password.value = ""
                loadLocalCatalog()
                startConnectionPolling()
                triggerBackgroundSync()
            } else {
                _pairingError.value = result.exceptionOrNull()?.message ?: "QR login failed. Token may have expired."
            }
            _isConnecting.value = false
        }
    }

    fun unpairDevice() {
        connectionJob?.cancel()
        viewModelScope.launch(Dispatchers.IO) {
            repository.clearPairing()
            kotlinx.coroutines.withContext(Dispatchers.Main) {
                _isPaired.value = false
                _allParts.value = emptyList()
                _password.value = ""
                _pairingError.value = null
                _selectedPart.value = null
                _priceHistory.value = emptyList()
            }
        }
    }

    fun loadLocalCatalog() {
        viewModelScope.launch(Dispatchers.IO) {
            val parts = repository.getLocalParts()
            kotlinx.coroutines.withContext(Dispatchers.Main) {
                _allParts.value = parts
            }
        }
        _syncQueueSize.value = 0
    }

    // --- Search Logic Mimicking Desktop ---
    fun performLocalSearch() {
        viewModelScope.launch(Dispatchers.IO) {
            val results = if (_searchType.value == "universal") {
                repository.searchPartsLocal(_searchQuery.value)
            } else {
                repository.searchPartsBySpecsLocal(_specNameQuery.value, _specValueQuery.value)
            }
            _allParts.value = results
        }
    }

    fun onSearchQueryChanged(query: String) {
        _searchQuery.value = query
        performLocalSearch()
    }

    fun onSpecNameQueryChanged(name: String) {
        _specNameQuery.value = name
        performLocalSearch()
    }

    fun onSpecValueQueryChanged(value: String) {
        _specValueQuery.value = value
        performLocalSearch()
    }

    fun onSearchTypeChanged(type: String) {
        _searchType.value = type
        performLocalSearch()
    }

    // --- Details Overlay Actions ---
    fun showPartDetails(part: Part) {
        _selectedPart.value = part
        viewModelScope.launch(Dispatchers.IO) {
            _priceHistory.value = repository.getPriceHistoryLocal(part.id)
        }
    }

    fun closePartDetails() {
        _selectedPart.value = null
        _priceHistory.value = emptyList()
    }

    fun decodePrice(cipher: String?): Double? {
        return repository.decodePrice(cipher)
    }

    fun encodePrice(price: Double?): String {
        return repository.encodePrice(price)
    }

    // --- Sync Operations (Download-Only) ---
    fun triggerBackgroundSync() {
        android.util.Log.d("MainScreenViewModel", "triggerBackgroundSync called. isSyncing: ${_isSyncing.value}, isOnline: ${_isOnline.value}")
        if (_isSyncing.value || !_isOnline.value) return
        viewModelScope.launch {
            _isSyncing.value = true
            _syncMessage.value = "Downloading latest catalog database..."
            android.util.Log.d("MainScreenViewModel", "Starting database sync download...")
            val result = repository.downloadAndSaveCatalog()
            if (result.isSuccess) {
                android.util.Log.d("MainScreenViewModel", "Database sync download succeeded! Reloading catalog...")
                _syncMessage.value = "Catalog database synced successfully!"
                loadLocalCatalog()
            } else {
                val err = result.exceptionOrNull()
                android.util.Log.e("MainScreenViewModel", "Database sync download failed!", err)
                _syncMessage.value = "Sync failed: " + err?.message
            }
            _isSyncing.value = false
            delay(3000)
            _syncMessage.value = null
        }
    }

    private fun startConnectionPolling() {
        android.util.Log.d("MainScreenViewModel", "startConnectionPolling called")
        connectionJob?.cancel()
        connectionJob = viewModelScope.launch {
            while (true) {
                checkConnectionState()
                delay(10000) // Poll connection every 10 seconds
            }
        }
    }

    private suspend fun checkConnectionState() {
        val (serverUrl, token) = kotlinx.coroutines.withContext(Dispatchers.IO) {
            Pair(repository.getServerUrl(), repository.getAuthToken())
        }
        android.util.Log.d("MainScreenViewModel", "checkConnectionState: serverUrl=$serverUrl, hasToken=${token != null}")
        if (serverUrl == null || token == null) return
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
            android.util.Log.d("MainScreenViewModel", "Ping status=$status, isOnline=${_isOnline.value}, wasOnline=$wasOnline")
            
            // If connection is recovered, trigger auto-sync (download database)
            if (_isOnline.value && !wasOnline) {
                android.util.Log.d("MainScreenViewModel", "Connection transitioned from offline to online. Triggering sync.")
                triggerBackgroundSync()
            }
        } catch (e: Exception) {
            android.util.Log.e("MainScreenViewModel", "Ping failed", e)
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
