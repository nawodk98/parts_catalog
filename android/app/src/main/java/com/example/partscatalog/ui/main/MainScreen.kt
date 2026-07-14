package com.example.partscatalog.ui.main

import android.widget.Toast
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation3.runtime.NavKey
import com.example.partscatalog.data.Part
import com.example.partscatalog.data.PartsRepository
import com.example.partscatalog.theme.*
import com.google.mlkit.vision.codescanner.GmsBarcodeScannerOptions
import com.google.mlkit.vision.codescanner.GmsBarcodeScanning
import com.google.mlkit.vision.barcode.common.Barcode

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MainScreen(
    onItemClick: (NavKey) -> Unit,
    modifier: Modifier = Modifier,
) {
    val context = LocalContext.current
    val viewModel: MainScreenViewModel = viewModel {
        MainScreenViewModel(PartsRepository(context))
    }
    val isPaired by viewModel.isPaired.collectAsState()

    // Configure the Google Play Services Code Scanner
    val scannerOptions = remember {
        GmsBarcodeScannerOptions.Builder()
            .setBarcodeFormats(Barcode.FORMAT_QR_CODE)
            .enableAutoZoom()
            .build()
    }
    val scanner = remember {
        GmsBarcodeScanning.getClient(context, scannerOptions)
    }

    val triggerScanner = { onScanned: (String) -> Unit ->
        scanner.startScan()
            .addOnSuccessListener { barcode ->
                barcode.rawValue?.let { onScanned(it) }
            }
            .addOnFailureListener { e ->
                Toast.makeText(context, "Scan failed: ${e.localizedMessage}", Toast.LENGTH_SHORT).show()
            }
        Unit
    }

    Box(
        modifier = modifier
            .fillMaxSize()
            .background(
                brush = Brush.verticalGradient(
                    colors = listOf(DeepNavy, Color(0xFF0F1B2F))
                )
            )
    ) {
        if (!isPaired) {
            PairingView(viewModel = viewModel, triggerScanner = triggerScanner)
        } else {
            CatalogView(viewModel = viewModel, triggerScanner = triggerScanner)
        }
    }
}

// --- pairing view layout ---
@Composable
fun PairingView(
    viewModel: MainScreenViewModel,
    triggerScanner: ((String) -> Unit) -> Unit
) {
    val pairingUrl by viewModel.pairingUrl.collectAsState()
    val username by viewModel.username.collectAsState()
    val password by viewModel.password.collectAsState()
    val isConnecting by viewModel.isConnecting.collectAsState()
    val error by viewModel.pairingError.collectAsState()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        // App Branding Header
        Icon(
            imageVector = Icons.Default.Settings,
            contentDescription = "Pairing Icon",
            tint = AccentPurpleLight,
            modifier = Modifier
                .size(72.dp)
                .padding(bottom = 16.dp)
        )

        Text(
            text = "Automotive Parts Catalog",
            color = PremiumWhite,
            fontSize = 24.sp,
            fontWeight = FontWeight.Bold,
            textAlign = TextAlign.Center
        )

        Text(
            text = "Pair device with desktop database server",
            color = TextSecondaryDark,
            fontSize = 14.sp,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = 4.dp, bottom = 32.dp)
        )

        // Pairing Form Card
        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(containerColor = CardBgDark),
            border = BorderStroke(1.dp, GlassBorder),
            shape = RoundedCornerShape(16.dp)
        ) {
            Column(modifier = Modifier.padding(20.dp)) {
                // Server URL input and Scan QR button
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    OutlinedTextField(
                        value = pairingUrl,
                        onValueChange = { viewModel.onPairingUrlChanged(it) },
                        label = { Text("Server URL", color = TextSecondaryDark) },
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedTextColor = PremiumWhite,
                            unfocusedTextColor = PremiumWhite,
                            focusedBorderColor = AccentPurple,
                            unfocusedBorderColor = GlassBorder
                        ),
                        modifier = Modifier.weight(1f),
                        singleLine = true,
                        placeholder = { Text("http://192.168.x.x:3000", color = TextSecondaryDark) }
                    )

                    Spacer(modifier = Modifier.width(8.dp))

                    IconButton(
                        onClick = {
                            triggerScanner { scanResult ->
                                val url = scanResult.replace("CONNECT:", "").trim()
                                viewModel.onPairingUrlChanged(url)
                            }
                        },
                        colors = IconButtonDefaults.iconButtonColors(containerColor = AccentPurple),
                        modifier = Modifier
                            .size(52.dp)
                            .clip(RoundedCornerShape(8.dp))
                    ) {
                        Icon(
                            imageVector = Icons.Default.QrCodeScanner,
                            contentDescription = "Scan pairing QR",
                            tint = Color.White
                        )
                    }
                }

                Spacer(modifier = Modifier.height(12.dp))

                // Username input
                OutlinedTextField(
                    value = username,
                    onValueChange = { viewModel.onUsernameChanged(it) },
                    label = { Text("Username", color = TextSecondaryDark) },
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedTextColor = PremiumWhite,
                        unfocusedTextColor = PremiumWhite,
                        focusedBorderColor = AccentPurple,
                        unfocusedBorderColor = GlassBorder
                    ),
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true
                )

                Spacer(modifier = Modifier.height(12.dp))

                // Password input
                OutlinedTextField(
                    value = password,
                    onValueChange = { viewModel.onPasswordChanged(it) },
                    label = { Text("Password", color = TextSecondaryDark) },
                    visualTransformation = PasswordVisualTransformation(),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedTextColor = PremiumWhite,
                        unfocusedTextColor = PremiumWhite,
                        focusedBorderColor = AccentPurple,
                        unfocusedBorderColor = GlassBorder
                    ),
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true
                )

                if (error != null) {
                    Spacer(modifier = Modifier.height(12.dp))
                    Text(
                        text = error!!,
                        color = ErrorRed,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.SemiBold
                    )
                }

                Spacer(modifier = Modifier.height(24.dp))

                // Action Connect Button
                Button(
                    onClick = { viewModel.pairDevice() },
                    colors = ButtonDefaults.buttonColors(containerColor = AccentPurple),
                    shape = RoundedCornerShape(30.dp),
                    modifier = Modifier.fillMaxWidth(),
                    enabled = !isConnecting
                ) {
                    if (isConnecting) {
                        CircularProgressIndicator(color = Color.White, modifier = Modifier.size(24.dp))
                    } else {
                        Text(
                            text = "Connect & Sync Database",
                            fontWeight = FontWeight.Bold,
                            fontSize = 16.sp,
                            color = Color.White
                        )
                    }
                }
            }
        }
    }
}

// --- catalog view layout ---
@Composable
fun CatalogView(
    viewModel: MainScreenViewModel,
    triggerScanner: ((String) -> Unit) -> Unit
) {
    val context = LocalContext.current
    val allParts by viewModel.allParts.collectAsState()
    val searchQuery by viewModel.searchQuery.collectAsState()
    val isOnline by viewModel.isOnline.collectAsState()
    val syncQueueSize by viewModel.syncQueueSize.collectAsState()
    val isSyncing by viewModel.isSyncing.collectAsState()
    val syncMessage by viewModel.syncMessage.collectAsState()
    val editingPart by viewModel.editingPart.collectAsState()

    // Filter parts locally based on search keywords
    val filteredParts = remember(allParts, searchQuery) {
        if (searchQuery.isBlank()) {
            allParts
        } else {
            val q = searchQuery.lowercase().trim()
            allParts.filter { p ->
                p.partNumber.lowercase().contains(q) ||
                        p.name.lowercase().contains(q) ||
                        p.category?.lowercase()?.contains(q) == true ||
                        p.description?.lowercase()?.contains(q) == true
            }
        }
    }

    Column(modifier = Modifier.fillMaxSize()) {
        // Header Bar
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .background(CardBgDark)
                .padding(horizontal = 20.dp, vertical = 16.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        imageVector = Icons.Default.DirectionsCar,
                        contentDescription = "App Logo",
                        tint = AccentPurpleLight,
                        modifier = Modifier.size(28.dp)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = "Mahesh Catalog",
                        color = PremiumWhite,
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold
                    )
                }

                // Connection indicator
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier
                        .background(Color(0x1AFFFFFF), RoundedCornerShape(12.dp))
                        .padding(horizontal = 8.dp, vertical = 4.dp)
                        .clickable { viewModel.triggerBackgroundSync() }
                ) {
                    Box(
                        modifier = Modifier
                            .size(8.dp)
                            .background(
                                color = if (isOnline) SuccessGreen else ErrorRed,
                                shape = RoundedCornerShape(50)
                            )
                    )
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(
                        text = if (isOnline) "Online" else "Offline",
                        color = PremiumWhite,
                        fontSize = 11.sp
                    )
                }
            }
        }

        // Search Section and QR Search trigger button
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            OutlinedTextField(
                value = searchQuery,
                onValueChange = { viewModel.onSearchQueryChanged(it) },
                leadingIcon = { Icon(imageVector = Icons.Default.Search, contentDescription = "Search Icon", tint = TextSecondaryDark) },
                placeholder = { Text("Search by SKU, Description...", color = TextSecondaryDark) },
                colors = OutlinedTextFieldDefaults.colors(
                    focusedTextColor = PremiumWhite,
                    unfocusedTextColor = PremiumWhite,
                    focusedBorderColor = AccentPurple,
                    unfocusedBorderColor = GlassBorder,
                    focusedContainerColor = CardBgDark,
                    unfocusedContainerColor = CardBgDark
                ),
                modifier = Modifier.weight(1f),
                singleLine = true,
                shape = RoundedCornerShape(12.dp)
            )

            Spacer(modifier = Modifier.width(8.dp))

            IconButton(
                onClick = {
                    triggerScanner { sku ->
                        viewModel.onSearchQueryChanged(sku)
                        // If exact match found, automatically open the edit screen!
                        val match = allParts.find { it.partNumber.equals(sku, ignoreCase = true) }
                        if (match != null) {
                            viewModel.selectPartForEdit(match)
                        } else {
                            Toast.makeText(context, "Scanned SKU: $sku", Toast.LENGTH_SHORT).show()
                        }
                    }
                },
                colors = IconButtonDefaults.iconButtonColors(containerColor = AccentPurple),
                modifier = Modifier
                    .size(54.dp)
                    .clip(RoundedCornerShape(12.dp))
            ) {
                Icon(
                    imageVector = Icons.Default.QrCodeScanner,
                    contentDescription = "Scan QR SKU",
                    tint = Color.White
                )
            }
        }

        // Sync Warning Banner or Progress indicator
        if (syncMessage != null) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Color(0xFF2E634A))
                    .padding(vertical = 8.dp, horizontal = 16.dp)
            ) {
                Text(
                    text = syncMessage!!,
                    color = PremiumWhite,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.SemiBold
                )
            }
        } else if (syncQueueSize > 0) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Color(0xFF4C3029))
                    .padding(vertical = 8.dp, horizontal = 16.dp)
                    .clickable { viewModel.triggerBackgroundSync() }
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "Pending modifications queue: $syncQueueSize. Tap to sync.",
                        color = PremiumWhite,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.SemiBold
                    )
                    if (isSyncing) {
                        CircularProgressIndicator(color = Color.White, modifier = Modifier.size(16.dp))
                    } else {
                        Icon(imageVector = Icons.Default.Sync, contentDescription = "Sync icon", tint = Color.White, modifier = Modifier.size(16.dp))
                    }
                }
            }
        }

        // Parts Lazy List
        LazyColumn(
            modifier = Modifier.weight(1f),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            if (filteredParts.isEmpty()) {
                item {
                    Text(
                        text = "No matching parts found",
                        color = TextSecondaryDark,
                        fontSize = 14.sp,
                        textAlign = TextAlign.Center,
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(top = 40.dp)
                    )
                }
            } else {
                items(filteredParts, key = { it.id }) { part ->
                    PartCard(part = part, onClick = { viewModel.selectPartForEdit(part) }, encodeFunc = { viewModel.encodePrice(it) })
                }
            }
        }

        // Disconnect Bottom action bar
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            contentAlignment = Alignment.Center
        ) {
            TextButton(
                onClick = { viewModel.unpairDevice() },
                colors = ButtonDefaults.textButtonColors(contentColor = ErrorRed)
            ) {
                Icon(imageVector = Icons.Default.ExitToApp, contentDescription = "Disconnect")
                Spacer(modifier = Modifier.width(6.dp))
                Text(text = "Disconnect and Unpair Device", fontWeight = FontWeight.Bold)
            }
        }
    }

    // Modal Edit Sheet Dialog
    if (editingPart != null) {
        EditPricingDialog(viewModel = viewModel, part = editingPart!!)
    }
}

// --- part card item layout ---
@Composable
fun PartCard(
    part: Part,
    onClick: () -> Unit,
    encodeFunc: (Double) -> String
) {
    // Generate pricing labels matching pricing model configurations
    val displayPrice = remember(part) {
        when (part.pricingType) {
            "standard" -> {
                val cost = part.costPrice ?: ""
                val sell = part.sellingPrice ?: ""
                if (cost.isNotBlank() || sell.isNotBlank()) "$cost / $sell" else ""
            }
            "imported" -> {
                val fCost = part.foreignPrice ?: ""
                val rate = part.exchangeRate ?: ""
                if (fCost.isNotBlank() || rate.isNotBlank()) "$fCost / $rate" else ""
            }
            "discount" -> {
                val list = part.costPrice ?: ""
                val disc = part.discount ?: ""
                if (list.isNotBlank() || disc.isNotBlank()) "$list / $disc" else ""
            }
            else -> {
                part.price?.toDoubleOrNull()?.let { encodeFunc(it) } ?: ""
            }
        }
    }

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onClick() },
        colors = CardDefaults.cardColors(containerColor = CardBgDark),
        border = BorderStroke(1.dp, GlassBorder),
        shape = RoundedCornerShape(12.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            // Header Row
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.Top
            ) {
                Text(
                    text = part.name,
                    color = PremiumWhite,
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.weight(1f)
                )

                if (displayPrice.isNotBlank()) {
                    Box(
                        modifier = Modifier
                            .background(Color(0xFF2C194D), RoundedCornerShape(6.dp))
                            .padding(horizontal = 8.dp, vertical = 4.dp)
                    ) {
                        Text(
                            text = displayPrice,
                            color = AccentPurpleLight,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                            fontFamily = FontFamily.Monospace
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            // Meta SKU & brand badges row
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "SKU: ${part.partNumber}",
                    color = TextSecondaryDark,
                    fontSize = 13.sp,
                    fontFamily = FontFamily.Monospace
                )

                // Type badge
                val isOEM = part.partType.equals("OEM", ignoreCase = true)
                Box(
                    modifier = Modifier
                        .background(
                            color = if (isOEM) Color(0x228B5CF6) else Color(0x2210B981),
                            shape = RoundedCornerShape(4.dp)
                        )
                        .padding(horizontal = 6.dp, vertical = 2.dp)
                ) {
                    Text(
                        text = if (isOEM) "OEM - ${part.brand ?: ""}" else "Genuine",
                        color = if (isOEM) AccentPurpleLight else Color(0xFF34D399),
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
            }

            if (!part.description.isNullOrBlank()) {
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = part.description,
                    color = TextSecondaryDark,
                    fontSize = 12.sp,
                    maxLines = 2
                )
            }
        }
    }
}

// --- edit price sheet dialog overlay ---
@Composable
fun EditPricingDialog(
    viewModel: MainScreenViewModel,
    part: Part
) {
    val pricingType by viewModel.pricingType.collectAsState()
    val costPrice by viewModel.costPrice.collectAsState()
    val sellingPrice by viewModel.sellingPrice.collectAsState()
    val discount by viewModel.discount.collectAsState()
    val foreignPrice by viewModel.foreignPrice.collectAsState()
    val exchangeRate by viewModel.exchangeRate.collectAsState()
    val computedPreview by viewModel.computedPreview.collectAsState()

    Dialog(onDismissRequest = { viewModel.closeEditDialog() }) {
        Card(
            modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = 20.dp),
            shape = RoundedCornerShape(16.dp),
            colors = CardDefaults.cardColors(containerColor = Color(0xFF131D2D)),
            border = BorderStroke(1.dp, GlassBorder)
        ) {
            Column(
                modifier = Modifier
                    .padding(20.dp)
                    .fillMaxWidth()
            ) {
                // Header
                Text(
                    text = part.name,
                    color = PremiumWhite,
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = "SKU: ${part.partNumber} • ${part.category ?: "General"}",
                    color = TextSecondaryDark,
                    fontSize = 12.sp,
                    modifier = Modifier.padding(bottom = 16.dp)
                )

                // Mode drop-down tab configuration selector
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(Color(0xFF0C1320), RoundedCornerShape(8.dp))
                        .padding(4.dp)
                ) {
                    val tabs = listOf("standard", "imported", "discount")
                    val labels = listOf("Standard", "Imported", "Discount")
                    tabs.forEachIndexed { i, t ->
                        val selected = pricingType == t
                        Box(
                            modifier = Modifier
                                .weight(1f)
                                .clip(RoundedCornerShape(6.dp))
                                .background(if (selected) AccentPurple else Color.Transparent)
                                .clickable { viewModel.onPricingTypeChanged(t) }
                                .padding(vertical = 8.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = labels[i],
                                color = if (selected) Color.White else TextSecondaryDark,
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))

                // Price Inputs Forms
                when (pricingType) {
                    "standard" -> {
                        OutlinedTextField(
                            value = costPrice,
                            onValueChange = { viewModel.onCostPriceChanged(it) },
                            label = { Text("Cost Price (Cipher)", color = TextSecondaryDark) },
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedTextColor = PremiumWhite,
                                unfocusedTextColor = PremiumWhite,
                                focusedBorderColor = AccentPurple,
                                unfocusedBorderColor = GlassBorder
                            ),
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth()
                        )

                        Spacer(modifier = Modifier.height(12.dp))

                        OutlinedTextField(
                            value = sellingPrice,
                            onValueChange = { viewModel.onSellingPriceChanged(it) },
                            label = { Text("Selling Price (Cipher)", color = TextSecondaryDark) },
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedTextColor = PremiumWhite,
                                unfocusedTextColor = PremiumWhite,
                                focusedBorderColor = AccentPurple,
                                unfocusedBorderColor = GlassBorder
                            ),
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth()
                        )
                    }
                    "imported" -> {
                        OutlinedTextField(
                            value = foreignPrice,
                            onValueChange = { viewModel.onForeignPriceChanged(it) },
                            label = { Text("Foreign Price (Cipher)", color = TextSecondaryDark) },
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedTextColor = PremiumWhite,
                                unfocusedTextColor = PremiumWhite,
                                focusedBorderColor = AccentPurple,
                                unfocusedBorderColor = GlassBorder
                            ),
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth()
                        )

                        Spacer(modifier = Modifier.height(12.dp))

                        OutlinedTextField(
                            value = exchangeRate,
                            onValueChange = { viewModel.onExchangeRateChanged(it) },
                            label = { Text("Exchange Rate (Cipher)", color = TextSecondaryDark) },
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedTextColor = PremiumWhite,
                                unfocusedTextColor = PremiumWhite,
                                focusedBorderColor = AccentPurple,
                                unfocusedBorderColor = GlassBorder
                            ),
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth()
                        )
                    }
                    "discount" -> {
                        OutlinedTextField(
                            value = costPrice,
                            onValueChange = { viewModel.onCostPriceChanged(it) },
                            label = { Text("List Cost Price (Cipher)", color = TextSecondaryDark) },
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedTextColor = PremiumWhite,
                                unfocusedTextColor = PremiumWhite,
                                focusedBorderColor = AccentPurple,
                                unfocusedBorderColor = GlassBorder
                            ),
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth()
                        )

                        Spacer(modifier = Modifier.height(12.dp))

                        OutlinedTextField(
                            value = discount,
                            onValueChange = { viewModel.onDiscountChanged(it) },
                            label = { Text("Discount % (Cipher or Num)", color = TextSecondaryDark) },
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedTextColor = PremiumWhite,
                                unfocusedTextColor = PremiumWhite,
                                focusedBorderColor = AccentPurple,
                                unfocusedBorderColor = GlassBorder
                            ),
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth()
                        )
                    }
                }

                // Live Preview Computations Code
                if (computedPreview.isNotBlank()) {
                    Spacer(modifier = Modifier.height(16.dp))
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(Color(0xFF0C1320), RoundedCornerShape(8.dp))
                            .padding(12.dp),
                        contentAlignment = Alignment.CenterStart
                    ) {
                        Text(
                            text = computedPreview,
                            color = AccentPurpleLight,
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Bold,
                            fontFamily = FontFamily.Monospace
                        )
                    }
                }

                Spacer(modifier = Modifier.height(24.dp))

                // Action controls Buttons
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.End
                ) {
                    TextButton(onClick = { viewModel.closeEditDialog() }) {
                        Text(text = "Cancel", color = TextSecondaryDark)
                    }

                    Spacer(modifier = Modifier.width(12.dp))

                    Button(
                        onClick = { viewModel.savePartPricing() },
                        colors = ButtonDefaults.buttonColors(containerColor = AccentPurple),
                        shape = RoundedCornerShape(20.dp)
                    ) {
                        Text(text = "Save Changes", color = Color.White, fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
    }
}
