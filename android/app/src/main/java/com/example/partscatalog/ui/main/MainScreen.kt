package com.example.partscatalog.ui.main

import android.widget.Toast
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation3.runtime.NavKey
import com.example.partscatalog.data.Part
import com.example.partscatalog.data.PartsRepository
import com.example.partscatalog.data.PriceHistoryEntry
import com.example.partscatalog.theme.*
import com.google.mlkit.vision.codescanner.GmsBarcodeScanning
import org.json.JSONObject

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

    // Barcode scanner trigger callback wrapper helper
    val triggerScanner: ((String) -> Unit) -> Unit = { callback ->
        val scanner = GmsBarcodeScanning.getClient(context)
        scanner.startScan()
            .addOnSuccessListener { barcode ->
                val raw = barcode.rawValue
                if (raw != null) {
                    callback(raw)
                }
            }
            .addOnFailureListener {
                Toast.makeText(context, "Scanning failed", Toast.LENGTH_SHORT).show()
            }
    }

    Box(
        modifier = modifier
            .fillMaxSize()
            .background(Color(0xFF070B12)) // Pure deep space dark mode background
    ) {
        if (!isPaired) {
            PairingView(viewModel = viewModel)
        } else {
            CatalogView(
                viewModel = viewModel,
                triggerScanner = triggerScanner
            )
        }
    }
}

// --- Device connection & pairing screen ---
@Composable
fun PairingView(viewModel: MainScreenViewModel) {
    val pairingUrl by viewModel.pairingUrl.collectAsState()
    val username by viewModel.username.collectAsState()
    val password by viewModel.password.collectAsState()
    val isConnecting by viewModel.isConnecting.collectAsState()
    val error by viewModel.pairingError.collectAsState()

    Box(
        modifier = Modifier.fillMaxSize(),
        contentAlignment = Alignment.Center
    ) {
        Card(
            modifier = Modifier
                .fillMaxWidth(0.9f)
                .padding(vertical = 20.dp),
            shape = RoundedCornerShape(24.dp),
            colors = CardDefaults.cardColors(containerColor = CardBgDark),
            border = BorderStroke(1.dp, GlassBorder)
        ) {
            Column(
                modifier = Modifier
                    .padding(28.dp)
                    .fillMaxWidth(),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Icon(
                    imageVector = Icons.Default.Link,
                    contentDescription = "Pairing Icon",
                    tint = AccentPurple,
                    modifier = Modifier.size(56.dp)
                )

                Spacer(modifier = Modifier.height(16.dp))

                Text(
                    text = "Pair Catalog Device",
                    color = PremiumWhite,
                    fontSize = 22.sp,
                    fontWeight = FontWeight.Bold
                )

                Text(
                    text = "Enter details to pair with the desktop catalog server",
                    color = TextSecondaryDark,
                    fontSize = 12.sp,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.padding(vertical = 8.dp)
                )

                Spacer(modifier = Modifier.height(20.dp))

                // Server URL input
                OutlinedTextField(
                    value = pairingUrl,
                    onValueChange = { viewModel.onPairingUrlChanged(it) },
                    label = { Text("Server Address", color = TextSecondaryDark) },
                    placeholder = { Text("e.g. 10.0.2.2:61700", color = TextSecondaryDark) },
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
    val searchType by viewModel.searchType.collectAsState()
    val specNameQuery by viewModel.specNameQuery.collectAsState()
    val specValueQuery by viewModel.specValueQuery.collectAsState()

    val isOnline by viewModel.isOnline.collectAsState()
    val isSyncing by viewModel.isSyncing.collectAsState()
    val syncMessage by viewModel.syncMessage.collectAsState()
    val selectedPart by viewModel.selectedPart.collectAsState()
    val priceHistory by viewModel.priceHistory.collectAsState()

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

                // Connection indicator / Force sync
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

        // Desktop Search Superpowers Selection Tabs
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 8.dp)
                .background(Color(0xFF0C1320), RoundedCornerShape(8.dp))
                .padding(4.dp)
        ) {
            val tabs = listOf("universal", "specs")
            val labels = listOf("Universal Search", "Specs Search")
            tabs.forEachIndexed { i, t ->
                val selected = searchType == t
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .clip(RoundedCornerShape(6.dp))
                        .background(if (selected) AccentPurple else Color.Transparent)
                        .clickable { viewModel.onSearchTypeChanged(t) }
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

        // Search Input Fields according to active tab
        if (searchType == "universal") {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                OutlinedTextField(
                    value = searchQuery,
                    onValueChange = { viewModel.onSearchQueryChanged(it) },
                    leadingIcon = { Icon(imageVector = Icons.Default.Search, contentDescription = "Search Icon", tint = TextSecondaryDark) },
                    placeholder = { Text("Search by SKU, Fits, Desc, Engine...", color = TextSecondaryDark) },
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
                            val match = allParts.find { it.partNumber.equals(sku, ignoreCase = true) }
                            if (match != null) {
                                viewModel.showPartDetails(match)
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
        } else {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 8.dp)
            ) {
                OutlinedTextField(
                    value = specNameQuery,
                    onValueChange = { viewModel.onSpecNameQueryChanged(it) },
                    label = { Text("Part Name / Category", color = TextSecondaryDark) },
                    placeholder = { Text("e.g. FILTER, CLUTCH", color = TextSecondaryDark) },
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedTextColor = PremiumWhite,
                        unfocusedTextColor = PremiumWhite,
                        focusedBorderColor = AccentPurple,
                        unfocusedBorderColor = GlassBorder,
                        focusedContainerColor = CardBgDark,
                        unfocusedContainerColor = CardBgDark
                    ),
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                    shape = RoundedCornerShape(12.dp)
                )

                Spacer(modifier = Modifier.height(8.dp))

                OutlinedTextField(
                    value = specValueQuery,
                    onValueChange = { viewModel.onSpecValueQueryChanged(it) },
                    label = { Text("Size Spec / Value", color = TextSecondaryDark) },
                    placeholder = { Text("e.g. 190, M20", color = TextSecondaryDark) },
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedTextColor = PremiumWhite,
                        unfocusedTextColor = PremiumWhite,
                        focusedBorderColor = AccentPurple,
                        unfocusedBorderColor = GlassBorder,
                        focusedContainerColor = CardBgDark,
                        unfocusedContainerColor = CardBgDark
                    ),
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                    shape = RoundedCornerShape(12.dp)
                )
            }
        }

        // Sync Message Banner
        if (syncMessage != null) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Color(0xFF2E634A))
                    .padding(vertical = 8.dp, horizontal = 16.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = syncMessage!!,
                        color = PremiumWhite,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.SemiBold
                    )
                    if (isSyncing) {
                        CircularProgressIndicator(color = Color.White, modifier = Modifier.size(16.dp))
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
            if (allParts.isEmpty()) {
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
                items(allParts, key = { it.id }) { part ->
                    PartCard(
                        part = part,
                        onClick = { viewModel.showPartDetails(part) },
                        encodeFunc = { viewModel.encodePrice(it) }
                    )
                }
            }
        }

        // Disconnect Bottom action bar
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
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

    // Modal Read-Only Details Dialog
    if (selectedPart != null) {
        PartDetailsDialog(
            viewModel = viewModel,
            part = selectedPart!!,
            history = priceHistory
        )
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

            Spacer(modifier = Modifier.height(8.dp))

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

            // Specs, engine fitments or descriptions preview on card
            if (!part.description.isNullOrBlank()) {
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = part.description,
                    color = TextSecondaryDark,
                    fontSize = 12.sp,
                    maxLines = 1
                )
            }
            if (!part.vehicleFits.isNullOrBlank()) {
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = "Fits: ${part.vehicleFits}",
                    color = Color(0xFF60A5FA),
                    fontSize = 12.sp,
                    maxLines = 1
                )
            }
        }
    }
}

// --- Read-Only Part Details Dialog overlay ---
@Composable
fun PartDetailsDialog(
    viewModel: MainScreenViewModel,
    part: Part,
    history: List<PriceHistoryEntry>
) {
    Dialog(onDismissRequest = { viewModel.closePartDetails() }) {
        Card(
            modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = 10.dp)
                .fillMaxHeight(0.85f),
            shape = RoundedCornerShape(16.dp),
            colors = CardDefaults.cardColors(containerColor = Color(0xFF131D2D)),
            border = BorderStroke(1.dp, GlassBorder)
        ) {
            Column(
                modifier = Modifier
                    .padding(20.dp)
                    .fillMaxSize()
            ) {
                // Header
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = part.name,
                            color = PremiumWhite,
                            fontSize = 18.sp,
                            fontWeight = FontWeight.Bold
                        )
                        Text(
                            text = "SKU: ${part.partNumber} • ${part.category ?: "General"}",
                            color = TextSecondaryDark,
                            fontSize = 12.sp
                        )
                    }
                    IconButton(onClick = { viewModel.closePartDetails() }) {
                        Icon(imageVector = Icons.Default.Close, contentDescription = "Close", tint = PremiumWhite)
                    }
                }

                Spacer(modifier = Modifier.height(12.dp))

                LazyColumn(
                    modifier = Modifier.weight(1f),
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    // Type Badge & Brand
                    item {
                        val isOEM = part.partType.equals("OEM", ignoreCase = true)
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Box(
                                modifier = Modifier
                                    .background(
                                        color = if (isOEM) Color(0x228B5CF6) else Color(0x2210B981),
                                        shape = RoundedCornerShape(4.dp)
                                    )
                                    .padding(horizontal = 8.dp, vertical = 4.dp)
                            ) {
                                Text(
                                    text = if (isOEM) "OEM - ${part.brand ?: ""}" else "Genuine",
                                    color = if (isOEM) AccentPurpleLight else Color(0xFF34D399),
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Bold
                                )
                            }
                        }
                    }

                    // Fitments section
                    if (!part.description.isNullOrBlank() || !part.vehicleFits.isNullOrBlank() || !part.engineFitment.isNullOrBlank()) {
                        item {
                            Column {
                                Text("FITMENT & DESCRIPTION", color = PremiumWhite, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                                Spacer(modifier = Modifier.height(6.dp))
                                if (!part.description.isNullOrBlank()) {
                                    Text("Description: ${part.description}", color = TextSecondaryDark, fontSize = 13.sp)
                                }
                                if (!part.vehicleFits.isNullOrBlank()) {
                                    Spacer(modifier = Modifier.height(4.dp))
                                    Text("Fits: ${part.vehicleFits}", color = Color(0xFF60A5FA), fontSize = 13.sp, fontWeight = FontWeight.Medium)
                                }
                                if (!part.engineFitment.isNullOrBlank()) {
                                    Spacer(modifier = Modifier.height(4.dp))
                                    Text(part.engineFitment, color = Color(0xFFF472B6), fontSize = 13.sp, fontWeight = FontWeight.Medium)
                                }
                            }
                        }
                    }

                    // Specifications Tags
                    val specs = try {
                        if (!part.specifications.isNullOrBlank()) {
                            val json = JSONObject(part.specifications)
                            val map = mutableMapOf<String, String>()
                            json.keys().forEach { map[it] = json.getString(it) }
                            map
                        } else null
                    } catch (e: Exception) { null }

                    if (!specs.isNullOrEmpty()) {
                        item {
                            Column {
                                Text("SPECIFICATIONS & SIZES", color = PremiumWhite, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                                Spacer(modifier = Modifier.height(8.dp))
                                LazyRow(
                                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                                    modifier = Modifier.fillMaxWidth()
                                ) {
                                    items(specs.toList()) { (key, value) ->
                                        Box(
                                            modifier = Modifier
                                                .background(Color(0x1AFFFFFF), RoundedCornerShape(16.dp))
                                                .border(BorderStroke(1.dp, GlassBorder), RoundedCornerShape(16.dp))
                                                .padding(horizontal = 12.dp, vertical = 6.dp)
                                        ) {
                                            Text(
                                                text = "$key: $value",
                                                color = TextSecondaryDark,
                                                fontSize = 12.sp
                                            )
                                        }
                                    }
                                }
                            }
                        }
                    }

                    // Pricing Details
                    item {
                        Column {
                            Text("PRICING INFORMATION", color = PremiumWhite, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                            Spacer(modifier = Modifier.height(8.dp))
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .background(Color(0x0DFFFFFF), RoundedCornerShape(8.dp))
                                    .border(BorderStroke(1.dp, GlassBorder), RoundedCornerShape(8.dp))
                                    .padding(12.dp)
                            ) {
                                Column {
                                    when (part.pricingType) {
                                        "standard" -> {
                                            Text("Pricing Model: Standard Structure", color = TextSecondaryDark, fontSize = 12.sp)
                                            Spacer(modifier = Modifier.height(6.dp))
                                            Text("Cost Code: ${part.costPrice ?: "-"}", color = PremiumWhite, fontSize = 14.sp, fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Bold)
                                            Text("Selling Code: ${part.sellingPrice ?: "-"}", color = PremiumWhite, fontSize = 14.sp, fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Bold)
                                        }
                                        "imported" -> {
                                            Text("Pricing Model: Imported Structure", color = TextSecondaryDark, fontSize = 12.sp)
                                            Spacer(modifier = Modifier.height(6.dp))
                                            Text("Foreign Cost Code: ${part.foreignPrice ?: "-"}", color = PremiumWhite, fontSize = 14.sp, fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Bold)
                                            Text("Exchange Rate Code: ${part.exchangeRate ?: "-"}", color = PremiumWhite, fontSize = 14.sp, fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Bold)
                                            Spacer(modifier = Modifier.height(4.dp))
                                            Text("Calculated Cost Code: ${part.costPrice ?: "-"}", color = AccentPurpleLight, fontSize = 13.sp, fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Bold)
                                        }
                                        "discount" -> {
                                            Text("Pricing Model: Discount Structure", color = TextSecondaryDark, fontSize = 12.sp)
                                            Spacer(modifier = Modifier.height(6.dp))
                                            Text("List Cost Code: ${part.costPrice ?: "-"}", color = PremiumWhite, fontSize = 14.sp, fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Bold)
                                            Text("Discount Code: ${part.discount ?: "-"}", color = PremiumWhite, fontSize = 14.sp, fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Bold)
                                            
                                            val listVal = viewModel.decodePrice(part.costPrice)
                                            val discVal = viewModel.decodePrice(part.discount)
                                            val netVal = if (listVal != null && discVal != null) {
                                                Math.round(listVal - (listVal * (discVal / 100.0))).toDouble()
                                            } else null
                                            val netCode = if (netVal != null) viewModel.encodePrice(netVal) else ""
                                            
                                            Spacer(modifier = Modifier.height(4.dp))
                                            Text("Calculated Net Cost: $netCode", color = AccentPurpleLight, fontSize = 13.sp, fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Bold)
                                        }
                                        else -> {
                                            Text("Pricing Model: Flat Price", color = TextSecondaryDark, fontSize = 12.sp)
                                            Spacer(modifier = Modifier.height(6.dp))
                                            Text("Price Code: ${part.price ?: "-"}", color = PremiumWhite, fontSize = 14.sp, fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Bold)
                                        }
                                    }
                                }
                            }
                        }
                    }

                    // Revision History Timeline
                    item {
                        Column {
                            Text("REVISION HISTORY", color = PremiumWhite, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                            Spacer(modifier = Modifier.height(8.dp))
                            if (history.isEmpty()) {
                                Text("No revisions recorded", color = TextSecondaryDark, fontSize = 13.sp)
                            } else {
                                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                                    history.forEach { entry ->
                                        Row(
                                            modifier = Modifier.fillMaxWidth(),
                                            horizontalArrangement = Arrangement.SpaceBetween,
                                            verticalAlignment = Alignment.CenterVertically
                                        ) {
                                            Column {
                                                Text(entry.changedAt, color = TextSecondaryDark, fontSize = 11.sp)
                                                val descText = when (entry.pricingType) {
                                                    "standard" -> "${entry.costPrice ?: ""} / ${entry.sellingPrice ?: ""}"
                                                    "imported" -> "${entry.foreignPrice ?: ""} / ${entry.exchangeRate ?: ""}"
                                                    "discount" -> "${entry.costPrice ?: ""} / ${entry.discount ?: ""}"
                                                    else -> "Price updated"
                                                }
                                                Text(
                                                    text = "Code: $descText",
                                                    color = PremiumWhite,
                                                    fontSize = 13.sp,
                                                    fontFamily = FontFamily.Monospace,
                                                    fontWeight = FontWeight.SemiBold
                                                )
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))

                Button(
                    onClick = { viewModel.closePartDetails() },
                    colors = ButtonDefaults.buttonColors(containerColor = AccentPurple),
                    shape = RoundedCornerShape(20.dp),
                    modifier = Modifier.align(Alignment.End)
                ) {
                    Text("Close", color = Color.White, fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}
