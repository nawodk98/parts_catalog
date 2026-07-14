package com.example.partscatalog.theme

import android.os.Build
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.dynamicDarkColorScheme
import androidx.compose.material3.dynamicLightColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext

private val PremiumColorScheme = darkColorScheme(
    primary = AccentPurple,
    onPrimary = Color.White,
    secondary = AccentPurpleLight,
    onSecondary = Color.Black,
    background = DeepNavy,
    onBackground = TextPrimaryDark,
    surface = CardBgDark,
    onSurface = TextPrimaryDark,
    error = ErrorRed,
    onError = Color.White
)

@Composable
fun PartsCatalogTheme(
  darkTheme: Boolean = isSystemInDarkTheme(),
  dynamicColor: Boolean = false,
  content: @Composable () -> Unit,
) {
  // Always use our premium custom theme to maintain consistent brand styling
  val colorScheme = PremiumColorScheme

  MaterialTheme(colorScheme = colorScheme, typography = Typography, content = content)
}
