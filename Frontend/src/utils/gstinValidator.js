/**
 * ArthaGST — Centralized Indian GSTIN Validation & Checksum Utility
 * Strictly enforces official Indian GSTIN structure and Mod-36 checksum algorithm.
 */

export const GST_STATE_CODES = {
  '01': 'Jammu and Kashmir',
  '02': 'Himachal Pradesh',
  '03': 'Punjab',
  '04': 'Chandigarh',
  '05': 'Uttarakhand',
  '06': 'Haryana',
  '07': 'Delhi',
  '08': 'Rajasthan',
  '09': 'Uttar Pradesh',
  '10': 'Bihar',
  '11': 'Sikkim',
  '12': 'Arunachal Pradesh',
  '13': 'Nagaland',
  '14': 'Manipur',
  '15': 'Mizoram',
  '16': 'Tripura',
  '17': 'Meghalaya',
  '18': 'Assam',
  '19': 'West Bengal',
  '20': 'Jharkhand',
  '21': 'Odisha',
  '22': 'Chhattisgarh',
  '23': 'Madhya Pradesh',
  '24': 'Gujarat',
  '25': 'Daman and Diu',
  '26': 'Dadra and Nagar Haveli and Daman and Diu',
  '27': 'Maharashtra',
  '28': 'Andhra Pradesh (Old)',
  '29': 'Karnataka',
  '30': 'Goa',
  '31': 'Lakshadweep',
  '32': 'Kerala',
  '33': 'Tamil Nadu',
  '34': 'Puducherry',
  '35': 'Andaman and Nicobar Islands',
  '36': 'Telangana',
  '37': 'Andhra Pradesh (New)',
  '38': 'Ladakh',
  '97': 'Other Territory',
  '99': 'Centre Jurisdiction',
};

export const VALID_STATE_CODES_SET = new Set(Object.keys(GST_STATE_CODES));

export const CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/**
 * Calculates official Mod-36 checksum character for first 14 chars of GSTIN
 * @param {string} gstin14 - The first 14 alphanumeric characters of a GSTIN
 * @returns {string|null} - 15th checksum character (0-9, A-Z) or null if invalid
 */
export const calculateGSTINChecksum = (gstin14) => {
  if (!gstin14 || gstin14.length !== 14) return null;
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const val = CHARS.indexOf(gstin14[i]);
    if (val === -1) return null;
    const factor = i % 2 === 0 ? 1 : 2;
    const prod = val * factor;
    sum += Math.floor(prod / 36) + (prod % 36);
  }
  const rem = sum % 36;
  const checkCodeIndex = (36 - rem) % 36;
  return CHARS[checkCodeIndex];
};

/**
 * Validates a GSTIN string with detailed error breakdown.
 * @param {string|null|undefined} input - The GSTIN string to validate
 * @param {object} [options]
 * @param {boolean} [options.required=false] - Whether GSTIN is mandatory
 * @returns {{
 *   isValid: boolean,
 *   error: string|null,
 *   sanitizedValue: string,
 *   stateCode?: string,
 *   stateName?: string,
 *   pan?: string,
 *   expectedChecksum?: string,
 *   actualChecksum?: string
 * }}
 */
export const validateGSTIN = (input, { required = false } = {}) => {
  if (input === null || input === undefined || String(input).trim() === '') {
    if (required) {
      return { isValid: false, error: 'GSTIN is required.', sanitizedValue: '' };
    }
    return { isValid: true, error: null, sanitizedValue: '' };
  }

  const raw = String(input).trim();

  // 1. Disallow spaces
  if (/\s/.test(raw)) {
    return {
      isValid: false,
      error: 'GSTIN cannot contain spaces.',
      sanitizedValue: raw.toUpperCase().replace(/\s+/g, ''),
    };
  }

  // 2. Disallow symbols or special characters
  if (/[^0-9A-Za-z]/.test(raw)) {
    return {
      isValid: false,
      error: 'GSTIN must contain only alphanumeric characters without spaces or symbols.',
      sanitizedValue: raw.toUpperCase().replace(/[^0-9A-Z]/g, ''),
    };
  }

  const sanitized = raw.toUpperCase();

  // 3. Length check: exactly 15 characters
  if (sanitized.length < 15) {
    return {
      isValid: false,
      error: `GSTIN must be exactly 15 characters (currently ${sanitized.length}/15).`,
      sanitizedValue: sanitized,
    };
  }
  if (sanitized.length > 15) {
    return {
      isValid: false,
      error: `GSTIN cannot exceed 15 characters (currently ${sanitized.length}).`,
      sanitizedValue: sanitized,
    };
  }

  // 3. State Code Check (Characters 1-2)
  const stateCode = sanitized.substring(0, 2);
  if (!VALID_STATE_CODES_SET.has(stateCode)) {
    return {
      isValid: false,
      error: `Invalid GST state code '${stateCode}'. Must be a recognized 2-digit Indian State/UT code (01-38, 97, 99).`,
      sanitizedValue: sanitized,
      stateCode,
    };
  }

  // 4. PAN Format Check (Characters 3-12)
  const pan = sanitized.substring(2, 12);
  const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
  if (!panRegex.test(pan)) {
    return {
      isValid: false,
      error: `Invalid PAN structure '${pan}' in GSTIN (characters 3-12 must be 5 letters, 4 digits, 1 letter, e.g. AAAAA9999A).`,
      sanitizedValue: sanitized,
      pan,
    };
  }

  // 5. Entity Code Check (Character 13)
  const entityChar = sanitized[12];
  if (!/^[0-9A-Z]$/.test(entityChar)) {
    return {
      isValid: false,
      error: `Invalid 13th character '${entityChar}'. Must be an alphanumeric entity number (1-9 or A-Z).`,
      sanitizedValue: sanitized,
    };
  }

  // 6. 14th Character Check (Must always be 'Z')
  const char14 = sanitized[13];
  if (char14 !== 'Z') {
    return {
      isValid: false,
      error: `14th character of GSTIN must always be 'Z' (found '${char14}').`,
      sanitizedValue: sanitized,
    };
  }

  // 7. Mod-36 Checksum Check (Character 15)
  const expectedChecksum = calculateGSTINChecksum(sanitized.substring(0, 14));
  const actualChecksum = sanitized[14];
  if (actualChecksum !== expectedChecksum) {
    return {
      isValid: false,
      error: `Invalid GSTIN checksum. 15th character is '${actualChecksum}', expected '${expectedChecksum}'.`,
      sanitizedValue: sanitized,
      expectedChecksum,
      actualChecksum,
    };
  }

  return {
    isValid: true,
    error: null,
    sanitizedValue: sanitized,
    stateCode,
    stateName: GST_STATE_CODES[stateCode],
    pan,
    details: {
      stateCode,
      stateName: GST_STATE_CODES[stateCode],
      pan,
      normalized: sanitized,
    },
  };
};

/**
 * Convenience helper returning boolean
 */
export const isValidGSTIN = (input, options) => validateGSTIN(input, options).isValid;

/**
 * Sanitizes input string as user types: uppercase, strips non-alphanumeric, max 15 chars
 */
export const formatGSTINInput = (input) => {
  if (!input) return '';
  return String(input)
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, '')
    .slice(0, 15);
};

export default {
  GST_STATE_CODES,
  VALID_STATE_CODES_SET,
  calculateGSTINChecksum,
  validateGSTIN,
  isValidGSTIN,
  formatGSTINInput,
};
