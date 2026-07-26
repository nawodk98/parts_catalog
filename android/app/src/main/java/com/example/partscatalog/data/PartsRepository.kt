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
import javax.crypto.Cipher
import javax.crypto.spec.IvParameterSpec
import javax.crypto.spec.SecretKeySpec

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
    val exchangeRate: String?,
    val specifications: String? = null,
    val vehicleFits: String? = null,
    val engineFitment: String? = null
)

data class PriceHistoryEntry(
    val changedAt: String,
    val pricingType: String,
    val costPrice: String?,
    val sellingPrice: String?,
    val discount: String?,
    val foreignPrice: String?,
    val exchangeRate: String?
)

class PartsRepository(private val context: Context) : DataRepository {

    private val dbHelper = DatabaseHelper(context)

    companion object {
        const val KEY_SERVER_URL = "server_url"
        const val KEY_AUTH_TOKEN = "auth_token"
        const val KEY_USERNAME = "username"
        private const val ENCRYPTION_KEY = "my_super_secret_key_for_pricing_"
    }

    override val data: Flow<List<String>> = flow {
        emit(getLocalParts().map { "${it.name} (${it.partNumber})" })
    }.flowOn(Dispatchers.IO)

    // --- Pricing Decryption Logic (AES-256-CBC) ---
    private fun decryptAES(encryptedText: String?): String? {
        if (encryptedText.isNullOrBlank()) return null
        try {
            val parts = encryptedText.split(":")
            if (parts.size != 2) return encryptedText // Return as-is if not in standard iv:cipher format
            val ivHex = parts[0]
            val dataHex = parts[1]

            val iv = hexToBytes(ivHex)
            val dataBytes = hexToBytes(dataHex)

            val keyBytes = ENCRYPTION_KEY.toByteArray(Charsets.UTF_8)
            val secretKey = SecretKeySpec(keyBytes, "AES")
            val ivSpec = IvParameterSpec(iv)

            val cipher = Cipher.getInstance("AES/CBC/PKCS5Padding")
            cipher.init(Cipher.DECRYPT_MODE, secretKey, ivSpec)
            val decryptedBytes = cipher.doFinal(dataBytes)
            return String(decryptedBytes, Charsets.UTF_8)
        } catch (e: Exception) {
            return encryptedText
        }
    }

    private fun hexToBytes(hex: String): ByteArray {
        val len = hex.length
        val data = ByteArray(len / 2)
        var i = 0
        while (i < len) {
            val h1 = Character.digit(hex[i], 16)
            val h2 = Character.digit(hex[i + 1], 16)
            if (h1 == -1 || h2 == -1) return ByteArray(0)
            data[i / 2] = ((h1 shl 4) + h2).toByte()
            i += 2
        }
        return data
    }

    // --- Cipher Conversion (ENGLISHBOY + X) ---
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
        try {
            db.delete(DatabaseHelper.TABLE_PARTS, null, null)
            db.delete(DatabaseHelper.TABLE_SYNC_QUEUE, null, null)
        } catch (e: Exception) {}
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
        return kotlinx.coroutines.withContext(Dispatchers.IO) {
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

                // 3. Trigger immediate DB file download to verify connection and populate local DB
                val downloadRes = downloadAndSaveCatalog()
                if (downloadRes.isFailure) {
                    throw downloadRes.exceptionOrNull() ?: Exception("Failed to download catalog database")
                }

                Result.success(Unit)
            } catch (e: Exception) {
                clearPairing()
                Result.failure(e)
            }
        }
    }

    /**
     * Pair device using a one-time QR login token scanned from the admin dashboard.
     * The QR code encodes "QRLOGIN:<token>" and includes the server URL separately.
     */
    suspend fun connectAndPairViaQrLogin(serverUrl: String, qrToken: String): Result<Unit> {
        return kotlinx.coroutines.withContext(Dispatchers.IO) {
            try {
                var cleanUrl = serverUrl.trim()
                if (!cleanUrl.startsWith("http://") && !cleanUrl.startsWith("https://")) {
                    cleanUrl = "http://$cleanUrl"
                }
                while (cleanUrl.endsWith("/")) {
                    cleanUrl = cleanUrl.substring(0, cleanUrl.length - 1)
                }

                // Redeem the one-time QR token for a session auth token
                val loginResponse = executeHttp(
                    "$cleanUrl/api/qr-login?token=${java.net.URLEncoder.encode(qrToken, "UTF-8")}",
                    "GET"
                )
                val loginJson = JSONObject(loginResponse)
                val token = loginJson.getString("token")
                val username = loginJson.optString("username", "admin")

                // Save credentials
                dbHelper.saveSetting(KEY_SERVER_URL, cleanUrl)
                dbHelper.saveSetting(KEY_AUTH_TOKEN, token)
                dbHelper.saveSetting(KEY_USERNAME, username)

                // Download the catalog
                val downloadRes = downloadAndSaveCatalog()
                if (downloadRes.isFailure) {
                    throw downloadRes.exceptionOrNull() ?: Exception("Failed to download catalog database")
                }

                Result.success(Unit)
            } catch (e: Exception) {
                clearPairing()
                Result.failure(e)
            }
        }
    }


    // --- Offline database query operations ---
    fun getLocalParts(): List<Part> {
        val list = mutableListOf<Part>()
        val db = dbHelper.readableDatabase

        val sb = StringBuilder()
        sb.append("SELECT p.*, ")
        sb.append("(CASE WHEN p.engine_type IS NOT NULL AND p.engine_type != '' THEN 'Engine: ' || p.engine_type ELSE '' END) as engine_fitment, ")
        sb.append("GROUP_CONCAT(DISTINCT COALESCE(UPPER(v.brand) || ' ' || v.model || ' ' || COALESCE(v.submodel, '') || COALESCE(' ' || NULLIF(v.engine_type, ''), ''), NULLIF(TRIM(COALESCE(UPPER(p.vehicle_brand), '') || ' ' || COALESCE(p.vehicle_model, '')), ''))) as vehicle_fits ")
        sb.append("FROM parts p ")
        sb.append("LEFT JOIN part_compatibility pc ON p.id = pc.oem_part_id ")
        sb.append("LEFT JOIN parts gp ON pc.genuine_part_number = gp.part_number ")
        sb.append("LEFT JOIN ( ")
        sb.append("    SELECT id as p_id, vehicle_id FROM parts WHERE vehicle_id IS NOT NULL ")
        sb.append("    UNION ")
        sb.append("    SELECT pc.oem_part_id as p_id, gp.vehicle_id ")
        sb.append("    FROM part_compatibility pc ")
        sb.append("    JOIN parts gp ON pc.genuine_part_number = gp.part_number ")
        sb.append("    WHERE gp.vehicle_id IS NOT NULL ")
        sb.append(") pv ON p.id = pv.p_id ")
        sb.append("LEFT JOIN vehicles v ON pv.vehicle_id = v.id ")
        sb.append("GROUP BY p.id ORDER BY p.id DESC LIMIT 100")

        try {
            val cursor = db.rawQuery(sb.toString(), null)
            while (cursor.moveToNext()) {
                list.add(cursorToPart(cursor))
            }
            cursor.close()
        } catch (e: Exception) {
            android.util.Log.e("PartsRepository", "Error in getLocalParts", e)
            return emptyList()
        }
        return list
    }

    fun getPartById(id: Int): Part? {
        val db = dbHelper.readableDatabase
        val cursor = db.query(
            "parts",
            null,
            "id = ?",
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
            "parts",
            null,
            "UPPER(part_number) = ?",
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

    // Advanced search mimicking express server's multi-word matching
    fun searchPartsLocal(query: String): List<Part> {
        val list = mutableListOf<Part>()
        val db = dbHelper.readableDatabase

        val words = query.trim().split(Regex("\\s+")).filter { it.isNotBlank() }

        val sb = StringBuilder()
        sb.append("SELECT p.*, ")
        sb.append("(CASE WHEN p.engine_type IS NOT NULL AND p.engine_type != '' THEN 'Engine: ' || p.engine_type ELSE '' END) as engine_fitment, ")
        sb.append("GROUP_CONCAT(DISTINCT COALESCE(UPPER(v.brand) || ' ' || v.model || ' ' || COALESCE(v.submodel, '') || COALESCE(' ' || NULLIF(v.engine_type, ''), ''), NULLIF(TRIM(COALESCE(UPPER(p.vehicle_brand), '') || ' ' || COALESCE(p.vehicle_model, '')), ''))) as vehicle_fits ")
        sb.append("FROM parts p ")
        sb.append("LEFT JOIN part_compatibility pc ON p.id = pc.oem_part_id ")
        sb.append("LEFT JOIN parts gp ON pc.genuine_part_number = gp.part_number ")
        sb.append("LEFT JOIN ( ")
        sb.append("    SELECT id as p_id, vehicle_id FROM parts WHERE vehicle_id IS NOT NULL ")
        sb.append("    UNION ")
        sb.append("    SELECT pc.oem_part_id as p_id, gp.vehicle_id ")
        sb.append("    FROM part_compatibility pc ")
        sb.append("    JOIN parts gp ON pc.genuine_part_number = gp.part_number ")
        sb.append("    WHERE gp.vehicle_id IS NOT NULL ")
        sb.append(") pv ON p.id = pv.p_id ")
        sb.append("LEFT JOIN vehicles v ON pv.vehicle_id = v.id ")

        val args = mutableListOf<String>()
        if (words.isNotEmpty()) {
            sb.append("WHERE (")
            for (i in words.indices) {
                if (i > 0) sb.append(" AND ")
                sb.append("(")
                sb.append("p.part_number LIKE ? OR ")
                sb.append("p.name LIKE ? OR ")
                sb.append("p.description LIKE ? OR ")
                sb.append("p.brand LIKE ? OR ")
                sb.append("p.engine_type LIKE ? OR ")
                sb.append("p.vehicle_brand LIKE ? OR ")
                sb.append("p.vehicle_model LIKE ? OR ")
                sb.append("p.specifications LIKE ? OR ")
                sb.append("v.brand LIKE ? OR ")
                sb.append("v.model LIKE ? OR ")
                sb.append("v.submodel LIKE ? OR ")
                sb.append("v.engine_type LIKE ? OR ")
                sb.append("gp.part_number LIKE ?")
                sb.append(")")
                val pattern = "%${words[i]}%"
                for (j in 0 until 13) {
                    args.add(pattern)
                }
            }
            sb.append(") ")
        }

        sb.append("GROUP BY p.id ORDER BY p.id DESC LIMIT 100")

        try {
            val cursor = db.rawQuery(sb.toString(), args.toTypedArray())
            while (cursor.moveToNext()) {
                list.add(cursorToPart(cursor))
            }
            cursor.close()
        } catch (e: Exception) {
            android.util.Log.e("PartsRepository", "Error in searchPartsLocal", e)
            return emptyList()
        }
        return list
    }

    // Specification search matching category/names and spec attributes
    fun searchPartsBySpecsLocal(partName: String, specValue: String): List<Part> {
        val list = mutableListOf<Part>()
        val db = dbHelper.readableDatabase

        val sb = StringBuilder()
        sb.append("SELECT p.*, ")
        sb.append("(CASE WHEN p.engine_type IS NOT NULL AND p.engine_type != '' THEN 'Engine: ' || p.engine_type ELSE '' END) as engine_fitment, ")
        sb.append("GROUP_CONCAT(DISTINCT COALESCE(UPPER(v.brand) || ' ' || v.model || ' ' || COALESCE(v.submodel, '') || COALESCE(' ' || NULLIF(v.engine_type, ''), ''), NULLIF(TRIM(COALESCE(UPPER(p.vehicle_brand), '') || ' ' || COALESCE(p.vehicle_model, '')), ''))) as vehicle_fits ")
        sb.append("FROM parts p ")
        sb.append("LEFT JOIN part_compatibility pc ON p.id = pc.oem_part_id ")
        sb.append("LEFT JOIN parts gp ON pc.genuine_part_number = gp.part_number ")
        sb.append("LEFT JOIN ( ")
        sb.append("    SELECT id as p_id, vehicle_id FROM parts WHERE vehicle_id IS NOT NULL ")
        sb.append("    UNION ")
        sb.append("    SELECT pc.oem_part_id as p_id, gp.vehicle_id ")
        sb.append("    FROM part_compatibility pc ")
        sb.append("    JOIN parts gp ON pc.genuine_part_number = gp.part_number ")
        sb.append("    WHERE gp.vehicle_id IS NOT NULL ")
        sb.append(") pv ON p.id = pv.p_id ")
        sb.append("LEFT JOIN vehicles v ON pv.vehicle_id = v.id ")

        val args = mutableListOf<String>()
        var hasWhere = false

        if (partName.isNotBlank()) {
            sb.append("WHERE (p.name LIKE ? OR p.category LIKE ?) ")
            args.add("%$partName%")
            args.add("%$partName%")
            hasWhere = true
        }

        if (specValue.isNotBlank()) {
            if (hasWhere) {
                sb.append("AND ")
            } else {
                sb.append("WHERE ")
            }
            sb.append("(p.specifications LIKE ? OR p.description LIKE ? OR p.name LIKE ? OR p.part_number LIKE ?) ")
            args.add("%$specValue%")
            args.add("%$specValue%")
            args.add("%$specValue%")
            args.add("%$specValue%")
        }

        sb.append("GROUP BY p.id ORDER BY p.id DESC LIMIT 100")

        try {
            val cursor = db.rawQuery(sb.toString(), args.toTypedArray())
            while (cursor.moveToNext()) {
                list.add(cursorToPart(cursor))
            }
            cursor.close()
        } catch (e: Exception) {
            android.util.Log.e("PartsRepository", "Error in searchPartsBySpecsLocal", e)
            return emptyList()
        }
        return list
    }

    // Historical revisions retrieval
    fun getPriceHistoryLocal(partId: Int): List<PriceHistoryEntry> {
        val list = mutableListOf<PriceHistoryEntry>()
        val db = dbHelper.readableDatabase
        try {
            val cursor = db.query(
                "price_history",
                null,
                "part_id = ?",
                arrayOf(partId.toString()),
                null, null, "id DESC"
            )
            while (cursor.moveToNext()) {
                list.add(
                    PriceHistoryEntry(
                        changedAt = cursor.getString(cursor.getColumnIndexOrThrow("changed_at")),
                        pricingType = cursor.getString(cursor.getColumnIndexOrThrow("pricing_type")) ?: "standard",
                        costPrice = decryptAES(cursor.getString(cursor.getColumnIndexOrThrow("cost_price"))),
                        sellingPrice = decryptAES(cursor.getString(cursor.getColumnIndexOrThrow("selling_price"))),
                        discount = decryptAES(cursor.getString(cursor.getColumnIndexOrThrow("discount"))),
                        foreignPrice = decryptAES(cursor.getString(cursor.getColumnIndexOrThrow("foreign_price"))),
                        exchangeRate = decryptAES(cursor.getString(cursor.getColumnIndexOrThrow("exchange_rate")))
                    )
                )
            }
            cursor.close()
        } catch (e: Exception) {
            // Table doesn't exist yet or other query error
            return emptyList()
        }
        return list
    }

    private fun cursorToPart(cursor: android.database.Cursor): Part {
        val specIdx = cursor.getColumnIndex("specifications")
        val fitsIdx = cursor.getColumnIndex("vehicle_fits")
        val engIdx = cursor.getColumnIndex("engine_fitment")

        return Part(
            id = cursor.getInt(cursor.getColumnIndexOrThrow("id")),
            partNumber = cursor.getString(cursor.getColumnIndexOrThrow("part_number")),
            name = cursor.getString(cursor.getColumnIndexOrThrow("name")),
            description = cursor.getString(cursor.getColumnIndexOrThrow("description")),
            category = cursor.getString(cursor.getColumnIndexOrThrow("category")),
            partType = cursor.getString(cursor.getColumnIndexOrThrow("part_type")) ?: "Genuine",
            brand = cursor.getString(cursor.getColumnIndexOrThrow("brand")),
            price = decryptAES(cursor.getString(cursor.getColumnIndexOrThrow("price"))),
            pricingType = cursor.getString(cursor.getColumnIndexOrThrow("pricing_type")) ?: "standard",
            costPrice = decryptAES(cursor.getString(cursor.getColumnIndexOrThrow("cost_price"))),
            sellingPrice = decryptAES(cursor.getString(cursor.getColumnIndexOrThrow("selling_price"))),
            discount = decryptAES(cursor.getString(cursor.getColumnIndexOrThrow("discount"))),
            foreignPrice = decryptAES(cursor.getString(cursor.getColumnIndexOrThrow("foreign_price"))),
            exchangeRate = decryptAES(cursor.getString(cursor.getColumnIndexOrThrow("exchange_rate"))),
            specifications = if (specIdx >= 0) cursor.getString(specIdx) else null,
            vehicleFits = if (fitsIdx >= 0) cursor.getString(fitsIdx) else null,
            engineFitment = if (engIdx >= 0) cursor.getString(engIdx) else null
        )
    }

    // --- Save Local (Deprecated for View-Only) ---
    fun savePartPricingLocal(partId: Int, pricingData: Map<String, String>): Boolean {
        return false
    }

    fun getSyncQueueSize(): Int = 0

    suspend fun syncPendingPriceUpdates(): Result<Int> {
        return Result.success(0)
    }

    // --- One-Way Full Database Sync ---
    suspend fun downloadAndSaveCatalog(): Result<List<Part>> {
        val serverUrl = getServerUrl() ?: return Result.failure(Exception("Not paired"))
        val token = getAuthToken() ?: return Result.failure(Exception("Unauthorized"))
        val username = getUsername() ?: return Result.failure(Exception("No username"))

        return kotlinx.coroutines.withContext(Dispatchers.IO) {
            try {
                // 1. Close current helper connection
                dbHelper.close()

                val dbFile = context.getDatabasePath("parts_catalog_offline.db")
                
                // Delete WAL, SHM, and journal files to prevent SQLite version recovery/locks
                java.io.File(dbFile.path + "-wal").delete()
                java.io.File(dbFile.path + "-shm").delete()
                java.io.File(dbFile.path + "-journal").delete()
                dbFile.delete()

                // 2. Download sqlite database file
                val url = URL("$serverUrl/api/database/download")
                val conn = url.openConnection() as HttpURLConnection
                conn.requestMethod = "GET"
                conn.setRequestProperty("Authorization", "Bearer $token")
                conn.connectTimeout = 15000
                conn.readTimeout = 15000

                val status = conn.responseCode
                if (status !in 200..299) {
                    throw Exception("Server returned code $status")
                }

                dbFile.parentFile?.mkdirs()

                conn.inputStream.use { input ->
                    java.io.FileOutputStream(dbFile).use { output ->
                        input.copyTo(output)
                    }
                }

                // 3. Restore user pairing settings inside the newly replaced database file
                dbHelper.saveSetting(KEY_SERVER_URL, serverUrl)
                dbHelper.saveSetting(KEY_AUTH_TOKEN, token)
                dbHelper.saveSetting(KEY_USERNAME, username)

                // 4. Return parts list
                Result.success(getLocalParts())
            } catch (e: Exception) {
                Result.failure(e)
            }
        }
    }


    // Helper for running operations in IO thread pool safely
    private suspend inline fun <T> withContextIO(crossinline block: () -> T): T {
        return kotlinx.coroutines.withContext(Dispatchers.IO) {
            block()
        }
    }
}
