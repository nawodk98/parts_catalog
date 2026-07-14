package com.example.partscatalog.data

import android.content.ContentValues
import android.content.Context
import android.database.Cursor
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import org.json.JSONObject

class DatabaseHelper(context: Context) : SQLiteOpenHelper(context, DATABASE_NAME, null, DATABASE_VERSION) {

    companion object {
        private const val DATABASE_NAME = "parts_catalog_offline.db"
        private const val DATABASE_VERSION = 1

        // Tables
        const val TABLE_SETTINGS = "settings"
        const val TABLE_PARTS = "parts"
        const val TABLE_SYNC_QUEUE = "sync_queue"

        // Settings Columns
        const val COL_SETTING_KEY = "key"
        const val COL_SETTING_VALUE = "value"

        // Parts Columns
        const val COL_PART_ID = "id"
        const val COL_PART_NUMBER = "part_number"
        const val COL_PART_NAME = "name"
        const val COL_PART_DESCRIPTION = "description"
        const val COL_PART_CATEGORY = "category"
        const val COL_PART_TYPE = "part_type"
        const val COL_PART_BRAND = "brand"
        const val COL_PART_PRICE = "price"
        const val COL_PART_PRICING_TYPE = "pricing_type"
        const val COL_PART_COST_PRICE = "cost_price"
        const val COL_PART_SELLING_PRICE = "selling_price"
        const val COL_PART_DISCOUNT = "discount"
        const val COL_PART_FOREIGN_PRICE = "foreign_price"
        const val COL_PART_EXCHANGE_RATE = "exchange_rate"

        // Sync Queue Columns
        const val COL_SYNC_ID = "id"
        const val COL_SYNC_PART_ID = "part_id"
        const val COL_SYNC_DATA = "data"
        const val COL_SYNC_TIMESTAMP = "timestamp"
    }

    override fun onCreate(db: SQLiteDatabase) {
        // Create settings table
        db.execSQL(
            "CREATE TABLE $TABLE_SETTINGS (" +
                    "$COL_SETTING_KEY TEXT PRIMARY KEY, " +
                    "$COL_SETTING_VALUE TEXT)"
        )

        // Create parts table
        db.execSQL(
            "CREATE TABLE $TABLE_PARTS (" +
                    "$COL_PART_ID INTEGER PRIMARY KEY, " +
                    "$COL_PART_NUMBER TEXT, " +
                    "$COL_PART_NAME TEXT, " +
                    "$COL_PART_DESCRIPTION TEXT, " +
                    "$COL_PART_CATEGORY TEXT, " +
                    "$COL_PART_TYPE TEXT, " +
                    "$COL_PART_BRAND TEXT, " +
                    "$COL_PART_PRICE TEXT, " +
                    "$COL_PART_PRICING_TYPE TEXT, " +
                    "$COL_PART_COST_PRICE TEXT, " +
                    "$COL_PART_SELLING_PRICE TEXT, " +
                    "$COL_PART_DISCOUNT TEXT, " +
                    "$COL_PART_FOREIGN_PRICE TEXT, " +
                    "$COL_PART_EXCHANGE_RATE TEXT)"
        )

        // Create sync queue table
        db.execSQL(
            "CREATE TABLE $TABLE_SYNC_QUEUE (" +
                    "$COL_SYNC_ID INTEGER PRIMARY KEY AUTOINCREMENT, " +
                    "$COL_SYNC_PART_ID INTEGER, " +
                    "$COL_SYNC_DATA TEXT, " +
                    "$COL_SYNC_TIMESTAMP INTEGER)"
        )
    }

    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
        db.execSQL("DROP TABLE IF EXISTS $TABLE_SETTINGS")
        db.execSQL("DROP TABLE IF EXISTS $TABLE_PARTS")
        db.execSQL("DROP TABLE IF EXISTS $TABLE_SYNC_QUEUE")
        onCreate(db)
    }

    // --- Settings Helpers ---
    fun saveSetting(key: String, value: String?) {
        val db = writableDatabase
        if (value == null) {
            db.delete(TABLE_SETTINGS, "$COL_SETTING_KEY = ?", arrayOf(key))
            return
        }
        val values = ContentValues().apply {
            put(COL_SETTING_KEY, key)
            put(COL_SETTING_VALUE, value)
        }
        db.insertWithOnConflict(TABLE_SETTINGS, null, values, SQLiteDatabase.CONFLICT_REPLACE)
    }

    fun getSetting(key: String): String? {
        val db = readableDatabase
        val cursor = db.query(
            TABLE_SETTINGS,
            arrayOf(COL_SETTING_VALUE),
            "$COL_SETTING_KEY = ?",
            arrayOf(key),
            null, null, null
        )
        var result: String? = null
        if (cursor.moveToFirst()) {
            result = cursor.getString(cursor.getColumnIndexOrThrow(COL_SETTING_VALUE))
        }
        cursor.close()
        return result
    }

    fun clearAllSettings() {
        val db = writableDatabase
        db.delete(TABLE_SETTINGS, null, null)
    }

    // --- Sync Queue Helpers ---
    fun addToSyncQueue(partId: Int, data: String) {
        val db = writableDatabase
        val values = ContentValues().apply {
            put(COL_SYNC_PART_ID, partId)
            put(COL_SYNC_DATA, data)
            put(COL_SYNC_TIMESTAMP, System.currentTimeMillis())
        }
        db.insert(TABLE_SYNC_QUEUE, null, values)
    }

    fun getSyncQueue(): List<SyncItem> {
        val list = mutableListOf<SyncItem>()
        val db = readableDatabase
        val cursor = db.query(TABLE_SYNC_QUEUE, null, null, null, null, null, "$COL_SYNC_TIMESTAMP ASC")
        while (cursor.moveToNext()) {
            val id = cursor.getInt(cursor.getColumnIndexOrThrow(COL_SYNC_ID))
            val partId = cursor.getInt(cursor.getColumnIndexOrThrow(COL_SYNC_PART_ID))
            val data = cursor.getString(cursor.getColumnIndexOrThrow(COL_SYNC_DATA))
            val timestamp = cursor.getLong(cursor.getColumnIndexOrThrow(COL_SYNC_TIMESTAMP))
            list.add(SyncItem(id, partId, data, timestamp))
        }
        cursor.close()
        return list
    }

    fun deleteSyncItem(id: Int) {
        val db = writableDatabase
        db.delete(TABLE_SYNC_QUEUE, "$COL_SYNC_ID = ?", arrayOf(id.toString()))
    }
}

data class SyncItem(
    val id: Int,
    val partId: Int,
    val data: String,
    val timestamp: Long
)
