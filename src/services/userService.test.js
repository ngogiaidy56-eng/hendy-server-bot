import test from 'node:test';
import assert from 'node:assert/strict';
import { userService } from './userService.js';

test('userService: getOrCreateUser initializes new profile with bonus', () => {
  const telegramData = {
    id: 11223344,
    first_name: 'TestUser',
    username: 'test_tele_user',
  };

  const user = userService.getOrCreateUser(telegramData);
  assert.equal(user.id, 11223344);
  assert.equal(user.firstName, 'TestUser');
  assert.equal(user.coins, 1000); // Welcome bonus
  assert.equal(user.level, 1);
  assert.equal(user.streak, 0);
});

test('userService: tap consumes energy and increases coins & xp', () => {
  const telegramData = { id: 22334455, first_name: 'Miner' };
  const user = userService.getOrCreateUser(telegramData);
  const initialCoins = user.coins;
  const initialEnergy = user.energy;

  const result = userService.tap(user.id, 5);
  assert.equal(result.success, true);
  assert.equal(result.coins, initialCoins + 5 * user.tapPower);
  assert.equal(result.energy, initialEnergy - 5 * user.tapPower);
});

test('userService: claimDailyReward increments streak and awards tokens', () => {
  const telegramData = { id: 33445566, first_name: 'DailyClaimer' };
  const user = userService.getOrCreateUser(telegramData);
  const initialCoins = user.coins;

  const result = userService.claimDailyReward(user.id);
  assert.equal(result.success, true);
  assert.equal(result.streak, 1);
  assert.equal(result.reward, 500);
  assert.equal(user.coins, initialCoins + 500);

  // Claiming again immediately should throw
  assert.throws(() => {
    userService.claimDailyReward(user.id);
  }, /already claimed today/i);
});
