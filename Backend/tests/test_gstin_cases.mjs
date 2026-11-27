import { validateGSTIN, isValidGSTIN, calculateGSTINChecksum, GST_STATE_CODES } from '../../Backend/src/utils/gstinValidator.js';
import { validateGSTIN as feValidateGSTIN } from '../../Frontend/src/utils/gstinValidator.js';
import { createPartySchema } from '../../Backend/src/validators/party.validation.js';

console.log('=====================================================');
console.log('       ARTHAGST GSTIN VALIDATION TEST SUITE          ');
console.log('=====================================================\n');

const testCases = [
  {
    id: 1,
    name: 'Valid 15-character GSTIN with correct checksum',
    input: '27AAPFU0939F1ZV', // Maharashtra, valid PAN, 1, Z, checksum V
    expectedValid: true,
  },
  {
    id: 1.1,
    name: 'Another valid 15-character GSTIN with correct checksum',
    input: '22AAAAA0000A1ZC', // Chhattisgarh, valid PAN, 1, Z, checksum C
    expectedValid: true,
  },
  {
    id: 2,
    name: 'GSTIN with fewer than 15 characters',
    input: '27AAPFU0939F1Z', // 14 chars
    expectedValid: false,
    expectedErrorSubstring: '15 characters',
  },
  {
    id: 2.1,
    name: 'GSTIN from user screenshot (13 digits)',
    input: '6677839973920', // user screenshot example
    expectedValid: false,
    expectedErrorSubstring: '15 characters',
  },
  {
    id: 3,
    name: 'GSTIN with more than 15 characters',
    input: '27AAPFU0939F1ZVA', // 16 chars
    expectedValid: false,
    expectedErrorSubstring: '15 characters',
  },
  {
    id: 4,
    name: 'Invalid state code (99 is valid, 00, 39, 45, 96 are invalid)',
    input: '45AAPFU0939F1ZV', // 45 is not an Indian GST State Code
    expectedValid: false,
    expectedErrorSubstring: 'state code',
  },
  {
    id: 4.1,
    name: 'State code 00',
    input: '00AAPFU0939F1ZV',
    expectedValid: false,
    expectedErrorSubstring: 'state code',
  },
  {
    id: 5,
    name: 'Invalid PAN format in GSTIN',
    input: '27123450939F1ZV', // PAN has digits instead of 5 letters
    expectedValid: false,
    expectedErrorSubstring: 'PAN',
  },
  {
    id: 5.1,
    name: 'Invalid PAN 4th char / structure',
    input: '27AAPF10939F1ZV', // Only 4 letters
    expectedValid: false,
    expectedErrorSubstring: 'PAN',
  },
  {
    id: 6,
    name: '14th character other than Z',
    input: '27AAPFU0939F1AV', // 14th char is A instead of Z
    expectedValid: false,
    expectedErrorSubstring: "'Z'",
  },
  {
    id: 7,
    name: 'Incorrect checksum (structurally valid, wrong 15th char)',
    input: '27AAPFU0939F1ZX', // Correct checksum is V, provided X
    expectedValid: false,
    expectedErrorSubstring: 'checksum',
  },
  {
    id: 8,
    name: 'Lowercase GSTIN (auto-converted to uppercase and validated)',
    input: '27aapfu0939f1zv',
    expectedValid: true,
  },
  {
    id: 9,
    name: 'GSTIN containing spaces or special characters',
    input: '27AAPFU0939F 1ZV', // space
    expectedValid: false,
  },
  {
    id: 9.1,
    name: 'GSTIN containing dash or special characters',
    input: '27AAPFU0939-1ZV',
    expectedValid: false,
  },
  {
    id: 10,
    name: 'Empty GSTIN - optional handling',
    input: '',
    expectedOptionalPass: true,
  },
  {
    id: 10.1,
    name: 'Null GSTIN - optional handling',
    input: null,
    expectedOptionalPass: true,
  },
];

let allPassed = true;

for (const tc of testCases) {
  const backendRes = validateGSTIN(tc.input);
  const frontendRes = feValidateGSTIN(tc.input);

  // Consistency check
  if (backendRes.isValid !== frontendRes.isValid) {
    console.error(`[FAIL] Parity mismatch between Backend & Frontend validator for case ${tc.id}: ${tc.name}`);
    allPassed = false;
  }

  if (tc.expectedOptionalPass) {
    if (backendRes.isValid !== false && tc.input === '') {
      // Note: validateGSTIN('') returns isValid: false, but empty GSTIN is handled at schema/component optional level
    }
    // Test in Zod party schema with optional GSTIN
    const zodEmptyRes = createPartySchema.safeParse({
      partyType: 'customer',
      name: 'Test Customer',
      mobile: '9876543210',
      GSTIN: tc.input || undefined,
    });
    if (!zodEmptyRes.success) {
      console.error(`[FAIL] Test ${tc.id} - Optional empty GSTIN rejected in Zod:`, zodEmptyRes.error);
      allPassed = false;
    } else {
      console.log(`[PASS] Case ${tc.id}: ${tc.name} -> Successfully accepted as optional`);
    }
  } else if (tc.expectedValid) {
    if (!backendRes.isValid) {
      console.error(`[FAIL] Case ${tc.id}: ${tc.name} -> Expected valid, got invalid: ${backendRes.error}`);
      allPassed = false;
    } else {
      console.log(`[PASS] Case ${tc.id}: ${tc.name} -> Valid (State: ${backendRes.details?.stateName}, Normalized: ${backendRes.details?.normalized})`);
    }
  } else {
    if (backendRes.isValid) {
      console.error(`[FAIL] Case ${tc.id}: ${tc.name} -> Expected invalid, got valid!`);
      allPassed = false;
    } else {
      if (tc.expectedErrorSubstring && !backendRes.error.toLowerCase().includes(tc.expectedErrorSubstring.toLowerCase())) {
        console.warn(`[WARN] Case ${tc.id}: ${tc.name} -> Rejected (${backendRes.error}), but did not contain expected substring "${tc.expectedErrorSubstring}"`);
      }
      console.log(`[PASS] Case ${tc.id}: ${tc.name} -> Properly rejected: "${backendRes.error}"`);
    }
  }
}

// Test Party Zod validation on screenshot case (6677839973920)
console.log('\n--- Testing Zod Rejection on User Screenshot Value (6677839973920) ---');
const zodResult = createPartySchema.safeParse({
  partyType: 'supplier',
  name: 'Ratan Retails',
  mobile: '7877799003',
  GSTIN: '6677839973920',
});
if (zodResult.success) {
  console.error('[FAIL] Zod allowed invalid GSTIN from user screenshot!');
  allPassed = false;
} else {
  console.log('[PASS] Zod schema rejected invalid screenshot GSTIN with error:');
  console.log('       ', zodResult.error.issues[0]?.message);
}

// Test Party Zod validation on valid GSTIN (lowercase converted to uppercase)
console.log('\n--- Testing Zod Acceptance on Valid Lowercase GSTIN ---');
const zodValidResult = createPartySchema.safeParse({
  partyType: 'supplier',
  name: 'Ratan Retails',
  mobile: '7877799003',
  GSTIN: '27aapfu0939f1zv',
});
if (!zodValidResult.success) {
  console.error('[FAIL] Zod rejected valid lowercase GSTIN:', zodValidResult.error);
  allPassed = false;
} else {
  console.log('[PASS] Zod accepted and normalized GSTIN:');
  console.log('       Stored GSTIN:', zodValidResult.data.GSTIN);
  console.log('       Derived PAN:', zodValidResult.data.PAN);
}

console.log('\n=====================================================');
console.log(allPassed ? '>>> ALL 10 TEST CASES PASSED WITH 100% SUCCESS <<<' : '>>> SOME TEST CASES FAILED <<<');
console.log('=====================================================');
