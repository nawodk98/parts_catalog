# Developer Documentation - Mahesh Motor Spares (Pvt) Ltd
## Technical Specifications & Architecture Guide

This document covers the technical architecture, design patterns, cipher algorithms, and testing procedures for the **Mahesh Motor Spares Parts Inventory & Cost Controller** React application.

---

## 1. Technical Stack

* **Build Tool**: Vite 8+
* **Frontend Library**: React 19 (Hooks state architecture)
* **Styling**: Tailwind CSS v4 (Using `@import "tailwindcss"` in `index.css`)
* **Persistence**: LocalStorage API (`part_cipher_inventory_v2`)
* **Environment**: Node.js LTS (v20+)

---

## 2. File Directory Structure

```
price/
├── docs/
│   └── images/              # Client Guide screenshot assets
│       ├── manager_panel.png
│       ├── price_checker.png
│       └── new_item.png
├── src/
│   ├── utils/
│   │   └── cipher.js        # Core cipher encoding/decoding functions
│   ├── App.css              # Custom layout adjustments
│   ├── App.jsx              # Main App layout, tab views, and modals
│   ├── index.css            # Global styling, scrollbars, fonts, and Tailwind v4
│   └── main.jsx             # React DOM entry point
├── CLIENT_USER_GUIDE.md     # Installation & User Manual for client
├── DEVELOPER_GUIDE.md       # Technical Guide for developers (This file)
├── package.json             # Scripts & dependency definitions
├── start_app.bat            # Double-click script for client deployment
└── vite.config.js           # Build settings & plugins
```

---

## 3. Cipher Algorithm (`src/utils/cipher.js`)

The application's cipher key is `ENGLISHBOY` + `X` (E=1, N=2, G=3, L=4, I=5, S=6, H=7, B=8, O=9, Y=0, X=0). Zeros alternate between `Y` and `X` to match manual handwritten notation.

### Decoder Details (`decodePrice`)
Transcribes cipher strings back to integers. Ignores spaces and symbols, but honors decimals.
```javascript
export function decodePrice(cipher) {
  if (!cipher) return null;
  const MAP = {
    'E': 1, 'N': 2, 'G': 3, 'L': 4, 'I': 5,
    'S': 6, 'H': 7, 'B': 8, 'O': 9, 'Y': 0, 'X': 0
  };
  let decodedDigits = [];
  for (let char of cipher.toUpperCase()) {
    if (MAP[char] !== undefined) {
      decodedDigits.push(MAP[char]);
    } else if (!isNaN(Number(char)) || char === '.') {
      decodedDigits.push(char);
    }
  }
  const result = parseFloat(decodedDigits.join(''));
  return isNaN(result) ? null : result;
}
```

### Encoder Details (`encodePrice`)
Converts numbers to cipher strings. Zeros alternate `Y` (odd counts from the right) and `X` (even counts from the right).
```javascript
export function encodePrice(price) {
  if (price === null || price === undefined || price === '') return '';
  const REVERSE_MAP = {
    '1': 'E', '2': 'N', '3': 'G', '4': 'L', '5': 'I',
    '6': 'S', '7': 'H', '8': 'B', '9': 'O'
  };
  const priceStr = Math.round(Number(price)).toString();
  let encodedDigits = [];
  let zeroCount = 0;
  for (let i = priceStr.length - 1; i >= 0; i--) {
    const digit = priceStr[i];
    if (digit === '0') {
      zeroCount++;
      encodedDigits.unshift(zeroCount % 2 === 1 ? 'Y' : 'X');
    } else if (REVERSE_MAP[digit]) {
      encodedDigits.unshift(REVERSE_MAP[digit]);
    }
  }
  return encodedDigits.join('');
}
```

---

## 4. State Architecture & Operations

### LocalStorage Sync
All inventory items and history records are synced via `useEffect` tracking the React `inventory` array state:
```javascript
const [inventory, setInventory] = useState(() => {
  const saved = localStorage.getItem('part_cipher_inventory_v2');
  return saved ? JSON.parse(saved) : SEED_DATA;
});

useEffect(() => {
  localStorage.setItem('part_cipher_inventory_v2', JSON.stringify(inventory));
}, [inventory]);
```

### Character Sanity Rules (`sanitizeCipher`)
To guarantee only correct letters can be typed into the Cost/Selling inputs in the forms:
```javascript
const sanitizeCipher = (str) => {
  return str.toUpperCase().replace(/[^ENGLISHBOYX.]/g, '');
};
```

---

## 5. Pricing Models Calculations

### Imported Price Code
In the background, calculations decode price (`ES` = 16) and rate (`OI` = 95), compute the value (`16 * 95 = 1520`), encode the result (`1520` = `EINY`), and store it in `costPrice`.
```javascript
const decForeign = decodePrice(foreignPrice) || 0;
const decRate = decodePrice(exchangeRate) || 0;
const finalCostCode = encodePrice(Math.round(decForeign * decRate));
```

### Discount Price Code
Uses `decodePrice(listCost) * (1 - decodePrice(discount) / 100)` to get net cost:
```javascript
const getCalculatedNetCost = (cost, disc) => {
  const c = decodePrice(cost) || 0;
  const d = decodePrice(disc) || 0;
  return encodePrice(Math.round(c * (1 - d / 100)));
};
```

---

## 6. Testing Procedures

Ensure all parts of the application function correctly using these developer verification checks:

1. **Build Verification**:
   ```bash
   npm run build
   ```
   Ensures there are no syntax, typescript, or CSS configuration errors during asset bundling.

2. **Regex Input Testing**:
   * Open the **Manager Panel** -> **Create Item** form.
   * Verify typing keys like `B`, `O`, `Y` works correctly.
   * Verify typing keys like `A`, `Z`, `F`, `K` are intercepted and blocked.

3. **Cipher Logic Verification**:
   * Add a new imported item with price code `ES` and exchange rate `OI`.
   * Check that calculated cost code displays as `EINY`.
   * Add a new discount item with cost `EBIY` and discount code `NI`.
   * Check that net cost code preview displays as `EGBB`.
