import test from 'node:test';
import assert from 'node:assert/strict';
import { storeService } from './storeService.js';
import { userService } from './userService.js';

test('storeService: products catalog listing and creation', () => {
  const products = storeService.getAllProducts();
  assert.ok(Array.isArray(products));
  assert.ok(products.length >= 4);

  const newProd = storeService.createProduct({
    title: 'Test Telegram Automation Plugin',
    category: 'apps',
    priceHndy: 1500,
    developer: 'TestLab',
  });

  assert.ok(newProd.id);
  assert.equal(newProd.priceHndy, 1500);

  const found = storeService.getProductById(newProd.id);
  assert.equal(found.title, 'Test Telegram Automation Plugin');
});

test('storeService: order placement deducts coins and issues digital key', () => {
  const user = userService.getOrCreateUser({ id: 88112233, first_name: 'StoreShopper' });
  user.coins = 5000;

  const product = storeService.getAllProducts()[0];
  const { order, remainingCoins } = storeService.createOrder(user.id, product.id);

  assert.equal(order.status, 'completed');
  assert.ok(order.issuedCode);
  assert.equal(remainingCoins, 5000 - product.priceHndy);
  assert.equal(user.coins, 5000 - product.priceHndy);
});

test('storeService: deposit submission and admin approval credits user balance', () => {
  const user = userService.getOrCreateUser({ id: 99223344, first_name: 'Depositor' });
  const initialCoins = user.coins;

  // Submit 10 TON deposit
  const deposit = storeService.submitDeposit(user.id, 'TON', 10);
  assert.equal(deposit.status, 'pending');
  assert.equal(deposit.creditedHndy, 10000);

  // Approve deposit
  const approved = storeService.reviewDeposit(deposit.id, 'approve', 'SuperAdmin', 'Approved on-chain');
  assert.equal(approved.status, 'approved');
  assert.equal(user.coins, initialCoins + 10000);
});

test('storeService: cryptographic gift code generation and redemption', () => {
  const user = userService.getOrCreateUser({ id: 77334455, first_name: 'Redeemer' });
  const initialCoins = user.coins;

  const giftCode = storeService.generateGiftCode(3000, 200, 1, 'UNIT_TEST_BATCH');
  assert.ok(giftCode.code.startsWith('HNDY-'));
  assert.equal(giftCode.codeHash.length, 64); // SHA-256 hash
  assert.equal(giftCode.status, 'active');

  const result = storeService.redeemGiftCode(giftCode.code, user.id);
  assert.equal(result.success, true);
  assert.equal(result.creditedHndy, 3000);
  assert.equal(user.coins, initialCoins + 3000);

  // Second redemption must fail
  assert.throws(() => {
    storeService.redeemGiftCode(giftCode.code, user.id);
  }, /redeemed/i);
});

test('storeService: customer timeline consolidates orders, deposits, and redemptions', () => {
  const user = userService.getOrCreateUser({ id: 66445566, first_name: 'SupportUser' });
  const timelineData = storeService.getCustomerTimeline(user.id);

  assert.ok(timelineData.user);
  assert.ok(Array.isArray(timelineData.timeline));
  assert.ok(timelineData.stats);
});
