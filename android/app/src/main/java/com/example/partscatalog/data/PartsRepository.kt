package com.example.partscatalog.data

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.flowOn
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

data class Part(
    val id: Int,
    val partNumber: String,
    val name: String,
    val description: String?,
    val category: String?,
    val partType: String,
    val brand: String?,
    val price: String?,
    val pricingType: String,
    val costPrice: String?,
    val sellingPrice: String?,
    val discount: String?,
    val foreignPrice: String?,
    val exchangeRate: String?
)

class PartsRepository(context: Context) : DataRepository {

    private val dbHelper = DatabaseHelper(context)

    companion object {
        const val KEY_SERVER_URL = "server_url"
        const val KEY_AUTH_TOKEN = "auth_token"
        const val KEY_USERNAME = "username"
    }

    // From DataRepository interface: provides a list of part SKU/names for backward compatibility
    override val data: Flow<List<String>> = flow {
        emit(getLocalParts().map { "${it.name} (${it.partNumber})" })
    }.flowOn(Dispatchers.IO)

    // --- Cipher Logic (ENGLISHBOY + X) ---
    fun encodePrice(price: Double?): String {
        if (price == null) return ""
        val priceStr = Math.round(price).toString()
        val digits = priceStr.toCharArray()
        val encodedDigits = mutableListOf<Char>()
        var zeroCount = 0
        for (i in digits.indices.reversed()) {
            val digit = digits[i]
            if (digit == '0') {
                zeroCount++
                encodedDigits.add(0, if (zeroCount % 2 == 1) 'Y' else 'X')
            } else {
                val mapped = when (digit) {
                    '1' -> 'E'
                    '2' -> 'N'
                    '3' -> 'G'
                    '4' -> 'L'
                    '5' -> 'I'
                    '6' -> 'S'
                    '7' -> 'H'
                    '8' -> 'B'
                    '9' -> 'O'
                    else -> digit
                }
                encodedDigits.add(0, mapped)
            }
        }
        return String(encodedDigits.toCharArray())
    }

    fun decodePrice(cipher: String?): Double? {
        if (cipher.isNullOrBlank()) return null
        val cleaned = cipher.uppercase().trim()
        val decodedDigits = StringBuilder()
        val cipherMap = mapOf(
            'E' to '1', 'N' to '2', 'G' to '3', 'L' to '4', 'I' to '5',
            'S' to '6', 'H' to '7', 'B' to '8', 'O' to '9', 'Y' to '0', 'X' to '0'
        )
        for (char in cleaned) {
            val mapped = cipherMap[char]
            if (mapped != null) {
                decodedDigits.append(mapped)
            } else if (char.isDigit() || char == '.') {
                decodedDigits.append(char)
            }
        }
        return decodedDigits.toString().toDoubleOrNull()
    }

    // --- Pair / Connection Helpers ---
    fun isPaired(): Boolean = getServerUrl() != null && getAuthToken() != null

    fun getServerUrl(): String? = dbHelper.getSetting(KEY_SERVER_URL)
    fun getAuthToken(): String? = dbHelper.getSetting(KEY_AUTH_TOKEN)
    fun getUsername(): String? = dbHelper.getSetting(KEY_USERNAME)

    fun clearPairing() {
        dbHelper.clearAllSettings()
        val db = dbHelper.writableDatabase
        db.delete(DatabaseHelper.TABLE_PARTS, null, null)
        db.delete(DatabaseHelper.TABLE_SYNC_QUEUE, null, null)
    }

    // Network request executor
    private fun executeHttp(
        urlString: String,
        method: String,
        body: String? = null,
        authToken: String? = null
    ): String {
        val url = URL(urlString)
        val conn = url.openConnection() as HttpURLConnection
        conn.requestMethod = method
        conn.connectTimeout = 8000
        conn.readTimeout = 8000
        conn.setRequestProperty("Content-Type", "application/json")
        conn.setRequestProperty("Accept", "application/json")
        if (authToken != null) {
            conn.setRequestProperty("Authorization", "Bearer $authToken")
        }

        if (body != null) {
            conn.doOutput = true
            conn.outputStream.use { os ->
                os.write(body.toByteArray(Charsets.UTF_8))
            }
        }

        val status = conn.responseCode
        val stream = if (status in 200..299) conn.inputStream else conn.errorStream
        val response = stream?.bufferedReader()?.use { it.readText() } ?: ""
        if (status !in 200..299) {
            val errorMsg = try {
                JSONObject(response).optString("error", "Server returned status $status")
            } catch (e: Exception) {
                "Server returned status $status"
            }
            throw Exception(errorMsg)
        }
        return response
    }

    suspend fun connectAndPair(url: String, user: String, pass: String): Result<Unit> {
        return withContextIO {
            try {
                var cleanUrl = url.trim()
                if (!cleanUrl.startsWith("http://") && !cleanUrl.startsWith("https://")) {
                    cleanUrl = "http://$cleanUrl"
                }
                while (cleanUrl.endsWith("/")) {
                    cleanUrl = cleanUrl.substring(0, cleanUrl.length - 1)
                }

                // 1. Perform Authentication Login
                val loginBody = JSONObject().apply {
                    put("username", user)
                    put("password", pass)
                }.toString()

                val loginResponse = executeHttp("$cleanUrl/api/login", "POST", loginBody)
                val loginJson = JSONObject(loginResponse)
                val token = loginJson.getString("token")
                val username = loginJson.getString("username")

                // 2. Save settings
                dbHelper.saveSetting(KEY_SERVER_URL, cleanUrl)
                dbHelper.saveSetting(KEY_AUTH_TOKEN, token)
                dbHelper.saveSetting(KEY_USERNAME, username)

                // 3. Trigger immediate download to verify connection and populate local DB
                downloadAndSaveCatalogInternal(cleanUrl, token)

                Result.success(Unit)
            } catch (e: Exception) {
                // If failed, make sure to revert configuration changes
                clearPairing()
                Result.failure(e)
            }
        }
    }

    // --- Offline database query operations ---
    fun getLocalParts(): List<Part> {
        val list = mutableListOf<Part>()
        val db = dbHelper.readableDatabase
        val cursor = db.query(DatabaseHelper.TABLE_PARTS, null, null, null, null, null, "${DatabaseHelper.COL_PART_ID} DESC")
        while (cursor.moveToNext()) {
            list.add(cursorToPart(cursor))
        }
        cursor.close()
        return list
    }

    fun getPartById(id: Int): Part? {
        val db = dbHelper.readableDatabase
        val cursor = db.query(
            DatabaseHelper.TABLE_PARTS,
            null,
            "${DatabaseHelper.COL_PART_ID} = ?",
            arrayOf(id.toString()),
            null, null, null
        )
        var part: Part? = null
        if (cursor.moveToFirst()) {
            part = cursorToPart(cursor)
        }
        cursor.close()
        return part
    }

    fun getPartByNumber(partNumber: String): Part? {
        val db = dbHelper.readableDatabase
        val cursor = db.query(
            DatabaseHelper.TABLE_PARTS,
            null,
            "UPPER(${DatabaseHelper.COL_PART_NUMBER}) = ?",
            arrayOf(partNumber.uppercase().trim()),
            null, null, null
        )
        var part: Part? = null
        if (cursor.moveToFirst()) {
            part = cursorToPart(cursor)
        }
        cursor.close()
        return part
    }

    private fun cursorToPart(cursor: android.database.Cursor): Part {
        return Part(
            id = cursor.getInt(cursor.getColumnIndexOrThrow(DatabaseHelper.COL_PART_ID)),
            partNumber = cursor.getString(cursor.getColumnIndexOrThrow(DatabaseHelper.COL_PART_NUMBER)),
            name = cursor.getString(cursor.getColumnIndexOrThrow(DatabaseHelper.COL_PART_NAME)),
            description = cursor.getString(cursor.getColumnIndexOrThrow(DatabaseHelper.COL_PART_DESCRIPTION)),
            category = cursor.getString(cursor.getColumnIndexOrThrow(DatabaseHelper.COL_PART_CATEGORY)),
            partType = cursor.getString(cursor.getColumnIndexOrThrow(DatabaseHelper.COL_PART_TYPE)) ?: "Genuine",
            brand = cursor.getString(cursor.getColumnIndexOrThrow(DatabaseHelper.COL_PART_BRAND)),
            price = cursor.getString(cursor.getColumnIndexOrThrow(DatabaseHelper.COL_PART_PRICE)),
            pricingType = cursor.getString(cursor.getColumnIndexOrThrow(DatabaseHelper.COL_PART_PRICING_TYPE)) ?: "standard",
            costPrice = cursor.getString(cursor.getColumnIndexOrThrow(DatabaseHelper.COL_PART_COST_PRICE)),
            sellingPrice = cursor.getString(cursor.getColumnIndexOrThrow(DatabaseHelper.COL_PART_SELLING_PRICE)),
            discount = cursor.getString(cursor.getColumnIndexOrThrow(DatabaseHelper.COL_PART_DISCOUNT)),
            foreignPrice = cursor.getString(cursor.getColumnIndexOrThrow(DatabaseHelper.COL_PART_FOREIGN_PRICE)),
            exchangeRate = cursor.getString(cursor.getColumnIndexOrThrow(DatabaseHelper.COL_PART_EXCHANGE_RATE))
        )
    }

    // --- Save Local & Add to Offline Queue ---
    fun savePartPricingLocal(partId: Int, pricingData: Map<String, String>): Boolean {
        val part = getPartById(partId) ?: return false

        // 1. Queue to local sync queue (JSON encoded)
        val json = JSONObject().apply {
            pricingData.forEach { (key, value) -> put(key, value) }
        }
        dbHelper.addToSyncQueue(partId, json.toString())

        // 2. Modify in local SQLite immediately for instant offline feedback
        val db = dbHelper.writableDatabase
        val values = ContentValues().apply {
            valuesOfPricing(this, pricingData)
        }
        db.update(DatabaseHelper.TABLE_PARTS, values, "${DatabaseHelper.COL_PART_ID} = ?", arrayOf(partId.toString()))
        return true
    }

    private fun valuesOfPricing(cv: ContentValues, pricingData: Map<String, String>) {
        cv.put(DatabaseHelper.COL_PART_PRICING_TYPE, pricingData["pricing_type"] ?: "standard")
        cv.put(DatabaseHelper.COL_PART_COST_PRICE, pricingData["cost_price"] ?: "")
        cv.put(DatabaseHelper.COL_PART_SELLING_PRICE, pricingData["selling_price"] ?: "")
        cv.put(DatabaseHelper.COL_PART_DISCOUNT, pricingData["discount"] ?: "")
        cv.put(DatabaseHelper.COL_PART_FOREIGN_PRICE, pricingData["foreign_price"] ?: "")
        cv.put(DatabaseHelper.COL_PART_EXCHANGE_RATE, pricingData["exchange_rate"] ?: "")
    }

    // --- Sync Engine Execution Helpers ---
    fun getSyncQueueSize(): Int = dbHelper.getSyncQueue().size

    suspend fun syncPendingPriceUpdates(): Result<Int> {
        val serverUrl = getServerUrl() ?: return Result.failure(Exception("Not paired"))
        val token = getAuthToken() ?: return Result.failure(Exception("Unauthorized"))

        return withContextIO {
            try {
                val queue = dbHelper.getSyncQueue()
                var syncCount = 0
                for (item in queue) {
                    // Send PATCH api update request to Express
                    executeHttp(
                        "$serverUrl/api/parts/${item.partId}/price",
                        "PATCH",
                        item.data,
                        token
                    )
                    // Successfully synced, remove from queue
                    dbHelper.deleteSyncItem(item.id)
                    syncCount++
                }

                // Download fresh catalog to ensure correct states and synced prices are matching
                downloadAndSaveCatalogInternal(serverUrl, token)

                Result.success(syncCount)
            } catch (e: Exception) {
                Result.failure(e)
            }
        }
    }

    suspend fun downloadAndSaveCatalog(): Result<List<Part>> {
        val serverUrl = getServerUrl() ?: return Result.failure(Exception("Not paired"))
        val token = getAuthToken() ?: return Result.failure(Exception("Unauthorized"))
        return withContextIO {
            try {
                val list = downloadAndSaveCatalogInternal(serverUrl, token)
                Result.success(list)
            } catch (e: Exception) {
                Result.failure(e)
            }
        }
    }

    private fun downloadAndSaveCatalogInternal(serverUrl: String, token: String): List<Part> {
        val response = executeHttp("$serverUrl/api/parts/all", "GET", null, token)
        val array = JSONArray(response)
        val partsList = mutableListOf<Part>()

        val db = dbHelper.writableDatabase
        db.beginTransaction()
        try {
            // Overwrite old database cache
            db.delete(DatabaseHelper.TABLE_PARTS, null, null)

            for (i in 0 until array.length()) {
                val obj = array.getJSONObject(i)
                val id = obj.getInt("id")
                val partNumber = obj.getString("part_number")
                val name = obj.getString("name")
                val description = obj.optString("description", "")
                val category = obj.optString("category", "")
                val partType = obj.optString("part_type", "Genuine")
                val brand = obj.optString("brand", "")
                val price = obj.optString("price", "")
                val pricingType = obj.optString("pricing_type", "standard")
                val costPrice = obj.optString("cost_price", "")
                val sellingPrice = obj.optString("selling_price", "")
                val discount = obj.optString("discount", "")
                val foreignPrice = obj.optString("foreign_price", "")
                val exchangeRate = obj.optString("exchange_rate", "")

                val values = ContentValues().apply {
                    put(DatabaseHelper.COL_PART_ID, id)
                    put(DatabaseHelper.COL_PART_NUMBER, partNumber)
                    put(DatabaseHelper.COL_PART_NAME, name)
                    put(DatabaseHelper.COL_PART_DESCRIPTION, description)
                    put(DatabaseHelper.COL_PART_CATEGORY, category)
                    put(DatabaseHelper.COL_PART_TYPE, partType)
                    put(DatabaseHelper.COL_PART_BRAND, brand)
                    put(DatabaseHelper.COL_PART_PRICE, price)
                    put(DatabaseHelper.COL_PART_PRICING_TYPE, pricingType)
                    put(DatabaseHelper.COL_PART_COST_PRICE, costPrice)
                    put(DatabaseHelper.COL_PART_SELLING_PRICE, sellingPrice)
                    put(DatabaseHelper.COL_PART_DISCOUNT, discount)
                    put(DatabaseHelper.COL_PART_FOREIGN_PRICE, foreignPrice)
                    put(DatabaseHelper.COL_PART_EXCHANGE_RATE, exchangeRate)
                }
                db.insert(DatabaseHelper.TABLE_PARTS, null, values)

                partsList.add(
                    Part(id, partNumber, name, description, category, partType, brand, price,
                        pricingType, costPrice, sellingPrice, discount, foreignPrice, exchangeRate)
                )
            }
            db.setTransactionSuccessful()
        } finally {
            db.endTransaction()
        }
        return partsList
    }

    // Helper for running operations in IO thread pool safely
    private suspend inline fun <T> withContextIO(crossinline block: () -> T): T {
        return kotlinx.coroutines.withContext(Dispatchers.IO) {
            block()
        }
    }
}
