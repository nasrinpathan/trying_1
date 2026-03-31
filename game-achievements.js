/* ============================================
   GAME ACHIEVEMENTS TRACKING
   Add this to games.js or as a separate file
   ============================================ */

// ============================================
// GAME STATS TRACKING
// ============================================

/**
 * Track that a user played a specific game
 * Call this when a user first interacts with each game
 */
async function trackGamePlayed(gameType) {
  if (!currentUser) return;
  
  try {
    const userRef = db.collection('users').doc(currentUser.uid);
    
    // Add to gamesPlayed array (won't duplicate due to arrayUnion)
    await userRef.update({
      'gameStats.gamesPlayed': firebase.firestore.FieldValue.arrayUnion(gameType)
    });
    
    // Check for Game Master achievement
    await checkGameMasterAchievement();
    
    debugLog(`Tracked game played: ${gameType}`, 'info');
  } catch (err) {
    // If gameStats doesn't exist yet, create it
    if (err.code === 'not-found' || err.message.includes('No document')) {
      try {
        await db.collection('users').doc(currentUser.uid).set({
          gameStats: { gamesPlayed: [gameType] }
        }, { merge: true });
      } catch (e) {
        debugLog(`Error initializing game stats: ${e.message}`, 'error');
      }
    }
  }
}

/**
 * Increment a game stat counter
 */
async function incrementGameStat(statName, amount = 1) {
  if (!currentUser) return;
  
  try {
    await db.collection('users').doc(currentUser.uid).update({
      [`gameStats.${statName}`]: firebase.firestore.FieldValue.increment(amount)
    });
    
    debugLog(`Incremented ${statName} by ${amount}`, 'info');
  } catch (err) {
    // Initialize if doesn't exist
    try {
      await db.collection('users').doc(currentUser.uid).set({
        gameStats: { [statName]: amount }
      }, { merge: true });
    } catch (e) {
      debugLog(`Error incrementing stat: ${e.message}`, 'error');
    }
  }
}

/**
 * Get current game stats for the user
 */
async function getGameStats() {
  if (!currentUser) return null;
  
  try {
    const userDoc = await db.collection('users').doc(currentUser.uid).get();
    return userDoc.data()?.gameStats || {
      gamesPlayed: [],
      questionsAnswered: 0,
      wyrVotes: 0,
      nhieConfessions: 0,
      truthsChosen: 0,
      daresCompleted: 0
    };
  } catch (err) {
    debugLog(`Error getting game stats: ${err.message}`, 'error');
    return null;
  }
}

// ============================================
// ACHIEVEMENT CHECKS
// ============================================

/**
 * Check if user has played all 4 games (Game Master)
 */
async function checkGameMasterAchievement() {
  if (!currentUser) return;
  
  try {
    const stats = await getGameStats();
    const allGames = ['question', 'wyr', 'nhie', 'tod'];
    const playedAll = allGames.every(game => stats.gamesPlayed?.includes(game));
    
    if (playedAll) {
      await checkAndAwardAchievement(currentUser.uid, 'game_master');
    }
  } catch (err) {
    debugLog(`Error checking game master: ${err.message}`, 'error');
  }
}

/**
 * Check Open Book achievement (5+ questions answered)
 */
async function checkOpenBookAchievement() {
  if (!currentUser) return;
  
  try {
    const stats = await getGameStats();
    if (stats.questionsAnswered >= 5) {
      await checkAndAwardAchievement(currentUser.uid, 'open_book');
    }
  } catch (err) {
    debugLog(`Error checking open book: ${err.message}`, 'error');
  }
}

/**
 * Check Truth Seeker achievement (5+ truths chosen)
 */
async function checkTruthSeekerAchievement() {
  if (!currentUser) return;
  
  try {
    const stats = await getGameStats();
    if (stats.truthsChosen >= 5) {
      await checkAndAwardAchievement(currentUser.uid, 'truth_seeker');
    }
  } catch (err) {
    debugLog(`Error checking truth seeker: ${err.message}`, 'error');
  }
}

/**
 * Check Daredevil achievement (5+ dares completed)
 */
async function checkDaredevilAchievement() {
  if (!currentUser) return;
  
  try {
    const stats = await getGameStats();
    if (stats.daresCompleted >= 5) {
      await checkAndAwardAchievement(currentUser.uid, 'daredevil');
    }
  } catch (err) {
    debugLog(`Error checking daredevil: ${err.message}`, 'error');
  }
}

/**
 * Check Honest Soul achievement (5+ NHIE confessions)
 */
async function checkHonestSoulAchievement() {
  if (!currentUser) return;
  
  try {
    const stats = await getGameStats();
    if (stats.nhieConfessions >= 5) {
      await checkAndAwardAchievement(currentUser.uid, 'honest_soul');
    }
  } catch (err) {
    debugLog(`Error checking honest soul: ${err.message}`, 'error');
  }
}

// ============================================
// INTEGRATION POINTS
// These show where to add tracking calls
// in your existing games.js functions
// ============================================

/*
 * TONIGHT'S QUESTION - Add to saveTQAnswer():
 * 
 * async function saveTQAnswer() {
 *   // ... existing save logic ...
 *   
 *   // Track game played and increment counter
 *   await trackGamePlayed('question');
 *   await incrementGameStat('questionsAnswered');
 *   await checkOpenBookAchievement();
 *   
 *   showToast('Answer saved! ✨');
 * }
 */

/*
 * WOULD YOU RATHER - Add to selectWYR():
 * 
 * async function selectWYR(choice) {
 *   // ... existing vote logic ...
 *   
 *   // Track game played and increment counter
 *   await trackGamePlayed('wyr');
 *   await incrementGameStat('wyrVotes');
 *   
 *   // WYR doesn't have a specific achievement, 
 *   // but counts toward Game Master
 * }
 */

/*
 * NEVER HAVE I EVER - Add to respondNHIE():
 * 
 * async function respondNHIE(response) {
 *   // ... existing response logic ...
 *   
 *   // Track game played
 *   await trackGamePlayed('nhie');
 *   
 *   // Only increment confessions if they chose "guilty"
 *   if (response === 'guilty') {
 *     await incrementGameStat('nhieConfessions');
 *     await checkHonestSoulAchievement();
 *   }
 * }
 */

/*
 * TRUTH OR DARE - Add to chooseTOD() and completeTOD():
 * 
 * async function chooseTOD(choice) {
 *   // ... existing choice logic ...
 *   
 *   // Track game played
 *   await trackGamePlayed('tod');
 *   
 *   // Track truth selections
 *   if (choice === 'truth') {
 *     await incrementGameStat('truthsChosen');
 *     await checkTruthSeekerAchievement();
 *   }
 * }
 * 
 * async function completeTOD(status) {
 *   // ... existing completion logic ...
 *   
 *   // Track dare completions (only if it was a dare and completed)
 *   if (currentTODType === 'dare' && status === 'completed') {
 *     await incrementGameStat('daresCompleted');
 *     await checkDaredevilAchievement();
 *   }
 * }
 */