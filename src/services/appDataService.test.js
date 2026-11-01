import test from 'node:test';
import assert from 'node:assert/strict';
import { appDataService } from './appDataService.js';
import { userService } from './userService.js';

test('appDataService: getTasksForUser returns list of tasks with completion flags', () => {
  const user = userService.getOrCreateUser({ id: 55667788, first_name: 'TaskTester' });
  const tasks = appDataService.getTasksForUser(user.id);

  assert.ok(Array.isArray(tasks));
  assert.ok(tasks.length >= 3);
  assert.equal(tasks[0].id, 'welcome_bonus');
  assert.equal(typeof tasks[0].isCompleted, 'boolean');
});

test('appDataService: getLeaderboard returns ranked users', () => {
  const leaderboard = appDataService.getLeaderboard(5);
  assert.ok(Array.isArray(leaderboard));
  assert.ok(leaderboard.length > 0);
  assert.equal(leaderboard[0].rank, 1);
  assert.ok(leaderboard[0].coins >= 0);
});

test('appDataService: generateHendyAiResponse handles prompt gracefully', async () => {
  const reply = await appDataService.generateHendyAiResponse('Hendy là ai?', { firstName: 'Tester' });
  assert.ok(typeof reply === 'string');
  assert.ok(reply.length > 10);
});
