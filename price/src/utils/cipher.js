const CIPHER_MAP = {
  'E': '1',
  'N': '2',
  'G': '3',
  'L': '4',
  'I': '5',
  'S': '6',
  'H': '7',
  'B': '8',
  'O': '9',
  'Y': '0',
  'X': '0'
};

const REVERSE_MAP = {
  '1': 'E',
  '2': 'N',
  '3': 'G',
  '4': 'L',
  '5': 'I',
  '6': 'S',
  '7': 'H',
  '8': 'B',
  '9': 'O'
};

/**
 * Encodes an integer price into the ENGLISH BOY cipher string.
 * Zeros alternate between Y (odd zero index from right) and X (even zero index from right).
 * 
 * @param {number|string} price - The integer price to encode
 * @returns {string} The encoded cipher string
 */
export function encodePrice(price) {
  if (price === null || price === undefined || price === '') return '';
  
  // Clean input to get integer string
  const priceStr = Math.round(Number(price)).toString();
  if (isNaN(priceStr)) return '';

  const digits = priceStr.split('');
  const encodedDigits = [];
  let zeroCount = 0;

  // Process right-to-left to alternate zeros correctly
  for (let i = digits.length - 1; i >= 0; i--) {
    const digit = digits[i];
    if (digit === '0') {
      zeroCount++;
      // First zero from right -> Y, second -> X, third -> Y, etc.
      encodedDigits.unshift(zeroCount % 2 === 1 ? 'Y' : 'X');
    } else if (REVERSE_MAP[digit]) {
      encodedDigits.unshift(REVERSE_MAP[digit]);
    } else {
      // Keep other characters (like decimals, signs if any, though not expected)
      encodedDigits.unshift(digit);
    }
  }

  return encodedDigits.join('');
}

/**
 * Decodes an ENGLISH BOY cipher string back into an integer price.
 * 
 * @param {string} cipher - The cipher string to decode
 * @returns {number|null} The decoded integer price or null if invalid
 */
export function decodePrice(cipher) {
  if (!cipher) return null;
  
  const cleaned = cipher.toUpperCase().trim();
  const decodedDigits = [];

  for (let i = 0; i < cleaned.length; i++) {
    const char = cleaned[i];
    if (CIPHER_MAP[char] !== undefined) {
      decodedDigits.push(CIPHER_MAP[char]);
    } else if (!isNaN(Number(char)) || char === '.') {
      // Keep numbers and decimals if they were entered directly
      decodedDigits.push(char);
    }
    // Ignore invalid cipher characters
  }

  const decodedNum = Number(decodedDigits.join(''));
  return isNaN(decodedNum) ? null : decodedNum;
}
