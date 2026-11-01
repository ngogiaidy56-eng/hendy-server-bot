/**
 * User Service
 * Manages Telegram user profile, balances, levels, daily streaks, mining energy, and referral network.
 */

// In-memory data store with simulated persistence
const usersStore = new Map();

/**
 * @typedef {Object} UserProfile
 * @property {number|string} id - Telegram User ID
 * @property {string} firstName - First name
 * @property {string} [lastName] - Last name
 * @property {string} [username] - Telegram @handle
 * @property {string} [languageCode] - Language code (e.g. 'en', 'vi')
 * @property {number} coins - Hendy Coins ($HNDY)
 * @property {number} level - User Level
 * @property {number} xp - Experience Points
 * @property {number} energy - Current mining energy
 * @property {number} maxEnergy - Maximum energy capacity
 * @property {number} tapPower - Coins earned per tap
 * @property {number} streak - Daily login streak count
 * @property {string|null} lastDailyClaim - ISO date string of last claim
 * @property {string|null} referredBy - Referral inviter ID
 * @property {number} referralsCount - Number of invited users
 * @property {Array<string>} completedTasks - IDs of completed tasks
 * @property {number} createdAt - Timestamp
 * @property {number} lastActiveAt - Timestamp
 */

/**
 * Initializes a new user default record
 */
function createDefaultUser(telegramData, referrerId = null) {
  const now = Date.now();
  return {
    id: telegramData.id,
    firstName: telegramData.first_name || 'Hendy Explorer',
    lastName: telegramData.last_name || '',
    username: telegramData.username || `user_${telegramData.id}`,
    languageCode: telegramData.language_code || 'en',
    coins: 1000, // Welcome bonus
    level: 1,
    xp: 50,
    energy: 1000,
    maxEnergy: 1000,
    tapPower: 2,
    streak: 0,
    lastDailyClaim: null,
    referredBy: referrerId,
    referralsCount: 0,
    completedTasks: [],
    createdAt: now,
    lastActiveAt: now,
  };
}

// Seed demo user for testing/preview
const demoUser = createDefaultUser({
  id: 777888999,
  first_name: 'Alex Hendy',
  last_name: 'Dev',
  username: 'alex_hendy_vip',
  language_code: 'en'
});
demoUser.coins = 5250;
demoUser.level = 3;
demoUser.streak = 2;
demoUser.completedTasks = ['welcome_bonus', 'telegram_group'];
usersStore.set(String(demoUser.id), demoUser);

export const userService = {
  /**
   * Retrieves or creates a user based on Telegram user data
   * @param {object} telegramUser
   * @param {string|null} [referrerId]
   * @returns {UserProfile}
   */
  getOrCreateUser(telegramUser, referrerId = null) {
    if (!telegramUser || !telegramUser.id) {
      throw new Error('Valid Telegram user with id is required');
    }

    const userId = String(telegramUser.id);
    let user = usersStore.get(userId);

    if (!user) {
      user = createDefaultUser(telegramUser, referrerId);
      usersStore.set(userId, user);

      // Award referrer bonus if applicable
      if (referrerId && usersStore.has(String(referrerId))) {
        const referrer = usersStore.get(String(referrerId));
        referrer.referralsCount += 1;
        referrer.coins += 2500; // 2500 Hendy bonus for referral
        referrer.xp += 100;
        this.recalculateLevel(referrer);
      }
    } else {
      // Refresh dynamic fields
      user.firstName = telegramUser.first_name || user.firstName;
      user.username = telegramUser.username || user.username;
      user.lastActiveAt = Date.now();
      this.regenerateEnergy(user);
    }

    return user;
  },

  /**
   * Gets user by ID
   * @param {string|number} id
   * @returns {UserProfile|null}
   */
  getUserById(id) {
    const user = usersStore.get(String(id));
    if (user) {
      this.regenerateEnergy(user);
    }
    return user || null;
  },

  /**
   * Passive energy regeneration (3 energy per second)
   * @param {UserProfile} user
   */
  regenerateEnergy(user) {
    const now = Date.now();
    const elapsedSeconds = Math.floor((now - (user.lastActiveAt || now)) / 1000);
    if (elapsedSeconds > 0 && user.energy < user.maxEnergy) {
      const recovered = elapsedSeconds * 3;
      user.energy = Math.min(user.maxEnergy, user.energy + recovered);
    }
    user.lastActiveAt = now;
  },

  /**
   * Perform tap action to mine coins
   * @param {string|number} userId
   * @param {number} tapCount
   * @returns {{ success: boolean, coins: number, energy: number, earned: number }}
   */
  tap(userId, tapCount = 1) {
    const user = this.getUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const safeTaps = Math.max(1, Math.min(100, Math.floor(tapCount)));
    const energyRequired = safeTaps * user.tapPower;

    if (user.energy < energyRequired) {
      throw new Error('Not enough energy to tap');
    }

    const earned = safeTaps * user.tapPower;
    user.energy -= energyRequired;
    user.coins += earned;
    user.xp += safeTaps;
    this.recalculateLevel(user);

    return {
      success: true,
      coins: user.coins,
      energy: user.energy,
      earned,
      level: user.level,
      xp: user.xp,
    };
  },

  /**
   * Claims daily streak reward
   * @param {string|number} userId
   * @returns {{ success: boolean, reward: number, streak: number, nextClaimAt: string }}
   */
  claimDailyReward(userId) {
    const user = this.getUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    if (user.lastDailyClaim) {
      const lastClaimDate = new Date(user.lastDailyClaim);
      const lastClaimStr = lastClaimDate.toISOString().split('T')[0];

      if (lastClaimStr === todayStr) {
        throw new Error('Daily reward already claimed today. Come back tomorrow!');
      }

      // Check if streak was broken (more than 48 hours)
      const diffMs = now.getTime() - lastClaimDate.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);

      if (diffHours > 48) {
        user.streak = 1;
      } else {
        user.streak += 1;
      }
    } else {
      user.streak = 1;
    }

    // Reward scales with streak: Day 1: 500, Day 2: 1000, Day 7+: 5000
    const baseReward = 500;
    const streakMultiplier = Math.min(user.streak, 7);
    const reward = baseReward * streakMultiplier;

    user.coins += reward;
    user.xp += 50 * streakMultiplier;
    user.lastDailyClaim = now.toISOString();
    this.recalculateLevel(user);

    const nextClaim = new Date(now);
    nextClaim.setDate(nextClaim.getDate() + 1);
    nextClaim.setHours(0, 0, 0, 0);

    return {
      success: true,
      reward,
      streak: user.streak,
      coins: user.coins,
      nextClaimAt: nextClaim.toISOString(),
    };
  },

  /**
   * Complete a task
   * @param {string|number} userId
   * @param {string} taskId
   * @param {number} rewardCoins
   */
  completeTask(userId, taskId, rewardCoins = 1000) {
    const user = this.getUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    if (user.completedTasks.includes(taskId)) {
      throw new Error('Task already completed');
    }

    user.completedTasks.push(taskId);
    user.coins += rewardCoins;
    user.xp += 100;
    this.recalculateLevel(user);

    return {
      success: true,
      coins: user.coins,
      taskId,
      rewardCoins,
    };
  },

  /**
   * Recalculates level based on XP
   */
  recalculateLevel(user) {
    // Level formula: Level = floor(sqrt(XP / 50)) + 1
    const newLevel = Math.floor(Math.sqrt(user.xp / 50)) + 1;
    if (newLevel > user.level) {
      user.level = newLevel;
      user.maxEnergy = 1000 + (newLevel - 1) * 200;
      user.tapPower = 2 + Math.floor((newLevel - 1) / 2);
    }
  },

  /**
   * Get all users (for admin / bot status)
   */
  getAllUsers() {
    return Array.from(usersStore.values());
  },
};
