import assert from 'assert';
import { sendSMS } from '../src/sms.js';

// Test 1: Mock dispatch
process.env.SMS_PROVIDER = 'mock';
const mockResult = await sendSMS('09171234567', 'Test assertion message');
assert.strictEqual(mockResult.success, true);
assert.strictEqual(mockResult.mode, 'mock');

// Test 2: Invalid number check
const invalidResult = await sendSMS('123', 'Test message');
assert.strictEqual(invalidResult.success, false);
assert.strictEqual(invalidResult.reason, 'invalid_number');

console.log('✓ All SMS self-checks passed successfully.');
