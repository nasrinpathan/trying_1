/* ============================================
   GAMES.JS
   Games Hub, All 4 Games, Data Loading
   ============================================ */

// ============================================
// STATE
// ============================================
let questions = [];
let challenges = [];
let wouldYouRatherData = [];
let neverHaveIEverData = [];
let truthsData = [];
let currentGame = null;
let wyrIndex = 0;
let nhieIndex = 0;
let tqIndex = 0;
let wyrLocked = false;
let wyrUserResponse = null;
let nhieLocked = false;
let nhieUserResponse = null;

// ============================================
// DEFAULT DATA
// ============================================
const DEFAULT_QUESTIONS = [
  "What's something you've always wanted to try but never had the courage to?",
  "Describe your perfect romantic evening in three words.",
  "What's the most spontaneous thing you've ever done?",
  "If you could have dinner with anyone, who would make you nervous?",
  "What's a secret talent that might surprise people here?",
];

const DEFAULT_CHALLENGES = [
  "Give a genuine compliment to someone you haven't spoken to yet tonight.",
  "Share a 30-second story about your most embarrassing moment.",
  "Ask someone about their favorite childhood memory.",
  "Find someone with the same birth month and learn three things about them.",
  "Teach someone a simple dance move.",
];

const DEFAULT_WYR = [
  { optionA: "Have the ability to read minds but never turn it off", optionB: "Have everyone be able to read YOUR mind" },
  { optionA: "Always have to say what's on your mind", optionB: "Never be able to speak again" },
  { optionA: "Relive the best day of your life once a year", optionB: "Forget your worst memory forever" },
  { optionA: "Know when you're going to die", optionB: "Know how you're going to die" },
  { optionA: "Have a rewind button for your life", optionB: "Have a pause button for your life" },
];

const DEFAULT_NHIE = [
  "sent a risky text to the wrong person",
  "pretended to be someone else online",
  "had a crush on a friend's partner",
  "ghosted someone I was dating",
  "had a secret relationship",
];

const DEFAULT_TRUTHS = [
  "What's the most rebellious thing you've ever done?",
  "What's a secret you've never told anyone at this party?",
  "Who in this room would you most want to be stuck in an elevator with?",
  "What's your biggest turn-on that might surprise people?",
  "What's the most spontaneous thing you've done for love?",
];

// ============================================
// GAMES HUB & NAVIGATION
// ============================================
function setupGames() {
  currentGame = null;
  document.querySelectorAll('.game-view').forEach(v => v.classList.remove('active'));
  document.getElementById('gamesHub').style.display = 'grid';
}

function openGame(gameType) {
  currentGame = gameType;
  document.getElementById('gamesHub').style.display = 'none';
  document.querySelectorAll('.game-view').forEach(v => v.classList.remove('active'));
  const gameView = document.getElementById(`game-${gameType}`);
  if (gameView) {
    gameView.classList.add('active');
    initGame(gameType);
  }
}

function closeGame() {
  currentGame = null;
  document.querySelectorAll('.game-view').forEach(v => v.classList.remove('active'));
  document.getElementById('gamesHub').style.display = 'grid';
}

function initGame(type) {
  switch (type) {
    case 'question': displayTQQuestion(); loadTQSavedAnswer(); break;
    case 'wyr': displayWYR(); break;
    case 'nhie': displayNHIE(); break;
    case 'tod': resetTOD(); loadTODStats(); break;
  }
}

// ============================================
// TONIGHT'S QUESTION
// ============================================
function displayTQQuestion() {
  if (questions.length === 0) return;
  document.getElementById('tqQuestionText').textContent = questions[tqIndex].text;
}

function nextTQQuestion() {
  tqIndex = (tqIndex + 1) % questions.length;
  displayTQQuestion();
  document.getElementById('tqAnswerInput').value = '';
  loadTQSavedAnswer();
}

async function saveTQAnswer() {
  const answer = document.getElementById('tqAnswerInput').value.trim();
  if (!answer || !currentUser || questions.length === 0) return;
  const q = questions[tqIndex];
  try {
    await db.collection('answers').doc(`${currentUser.uid}_${q.id}`).set({
      oderId: currentUser.uid,
      questionId: q.id,
      questionText: q.text,
      answer,
      displayName: userProfile?.displayName || 'Anonymous',
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    showToast('Answer saved! 💭');
    document.getElementById('tqAnswerInput').value = '';
    loadTQSavedAnswer();
  } catch (err) {
    showToast('Error saving answer', 'error');
  }
}

async function loadTQSavedAnswer() {
  if (!currentUser || questions.length === 0) return;
  const q = questions[tqIndex];
  const savedDiv = document.getElementById('tqPreviousAnswer');
  try {
    const doc = await db.collection('answers').doc(`${currentUser.uid}_${q.id}`).get();
    if (doc.exists) {
      savedDiv.classList.remove('hidden');
      document.getElementById('tqSavedAnswer').textContent = doc.data().answer;
    } else {
      savedDiv.classList.add('hidden');
    }
  } catch (err) {
    savedDiv.classList.add('hidden');
  }
}

// ============================================
// WOULD YOU RATHER
// ============================================
function displayWYR() {
  if (wouldYouRatherData.length === 0) return;
  const wyr = wouldYouRatherData[wyrIndex];
  document.getElementById('wyrTextA').textContent = wyr.optionA;
  document.getElementById('wyrTextB').textContent = wyr.optionB;
  
  // Reset state
  wyrLocked = false;
  wyrUserResponse = null;
  const optA = document.getElementById('wyrOptionA');
  const optB = document.getElementById('wyrOptionB');
  optA.classList.remove('selected', 'locked', 'show-stats');
  optB.classList.remove('selected', 'locked', 'show-stats');
  document.getElementById('wyrBarA').style.width = '0';
  document.getElementById('wyrBarB').style.width = '0';
  
  // Check if user already responded
  checkWYRUserResponse(wyr.id);
}

async function checkWYRUserResponse(itemId) {
  if (!currentUser) return;
  try {
    const doc = await db.collection('gameResponses').doc(`${currentUser.uid}_wyr_${itemId}`).get();
    if (doc.exists) {
      wyrUserResponse = doc.data().response;
      wyrLocked = true;
      showWYRStats(itemId, wyrUserResponse);
    }
  } catch (err) { /* ignore */ }
}

async function selectWYR(option) {
  if (wyrLocked || !currentUser) return;
  
  const wyr = wouldYouRatherData[wyrIndex];
  wyrLocked = true;
  wyrUserResponse = option;
  
  try {
    await db.collection('gameResponses').doc(`${currentUser.uid}_wyr_${wyr.id}`).set({
      oderId: currentUser.uid,
      gameType: 'wyr',
      itemId: wyr.id,
      response: option,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    // Ensure stats object exists, then increment
    const wyrRef = db.collection('wouldYouRather').doc(wyr.id);
    const wyrDoc = await wyrRef.get();
    const currentStats = wyrDoc.data()?.stats || { A: 0, B: 0 };
    
    if (option === 'A') currentStats.A = (currentStats.A || 0) + 1;
    else currentStats.B = (currentStats.B || 0) + 1;
    
    await wyrRef.update({ stats: currentStats });
    
    showWYRStats(wyr.id, option);
    showToast('Vote recorded! 🗳️');
  } catch (err) {
    debugLog(`Error saving WYR response: ${err.message}`, 'error');
    showToast('Error saving vote', 'error');
    wyrLocked = false;
  }
}

async function showWYRStats(itemId, userChoice) {
  const optA = document.getElementById('wyrOptionA');
  const optB = document.getElementById('wyrOptionB');
  
  optA.classList.add('locked');
  optB.classList.add('locked');
  optA.classList.toggle('selected', userChoice === 'A');
  optB.classList.toggle('selected', userChoice === 'B');
  
  try {
    const doc = await db.collection('wouldYouRather').doc(itemId).get();
    const data = doc.data() || {};
    const statsA = data.stats?.A || 0;
    const statsB = data.stats?.B || 0;
    const total = statsA + statsB;
    
    const pctA = total > 0 ? Math.round((statsA / total) * 100) : 50;
    const pctB = total > 0 ? Math.round((statsB / total) * 100) : 50;
    
    document.getElementById('wyrStatsA').textContent = `${pctA}%`;
    document.getElementById('wyrStatsB').textContent = `${pctB}%`;
    document.getElementById('wyrCountA').textContent = `${statsA} vote${statsA !== 1 ? 's' : ''}`;
    document.getElementById('wyrCountB').textContent = `${statsB} vote${statsB !== 1 ? 's' : ''}`;
    
    setTimeout(() => {
      document.getElementById('wyrBarA').style.width = `${pctA}%`;
      document.getElementById('wyrBarB').style.width = `${pctB}%`;
      optA.classList.add('show-stats');
      optB.classList.add('show-stats');
    }, 100);
    
  } catch (err) {
    debugLog(`Error loading WYR stats: ${err.message}`, 'error');
    optA.classList.add('show-stats');
    optB.classList.add('show-stats');
  }
}

function nextWYR() {
  wyrIndex = (wyrIndex + 1) % wouldYouRatherData.length;
  displayWYR();
}

// ============================================
// NEVER HAVE I EVER
// ============================================
function displayNHIE() {
  if (neverHaveIEverData.length === 0) return;
  document.getElementById('nhieStatement').textContent = neverHaveIEverData[nhieIndex].statement;
  
  // Reset state
  nhieLocked = false;
  nhieUserResponse = null;
  const guiltyBtn = document.getElementById('nhieGuiltyBtn');
  const innocentBtn = document.getElementById('nhieInnocentBtn');
  guiltyBtn.classList.remove('selected', 'locked', 'show-stats');
  innocentBtn.classList.remove('selected', 'locked', 'show-stats');
  document.getElementById('nhieStatsSummary').classList.remove('show');
  document.getElementById('nhieStatsFill').style.width = '0%';
  
  // Check if user already responded
  checkNHIEUserResponse(neverHaveIEverData[nhieIndex].id);
}

async function checkNHIEUserResponse(itemId) {
  if (!currentUser) return;
  try {
    const doc = await db.collection('gameResponses').doc(`${currentUser.uid}_nhie_${itemId}`).get();
    if (doc.exists) {
      nhieUserResponse = doc.data().response;
      nhieLocked = true;
      showNHIEStats(itemId, nhieUserResponse);
    }
  } catch (err) { /* ignore */ }
}

async function respondNHIE(response) {
  if (nhieLocked || !currentUser) return;
  
  const nhie = neverHaveIEverData[nhieIndex];
  nhieLocked = true;
  nhieUserResponse = response;
  
  try {
    await db.collection('gameResponses').doc(`${currentUser.uid}_nhie_${nhie.id}`).set({
      oderId: currentUser.uid,
      gameType: 'nhie',
      itemId: nhie.id,
      response: response,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    // Ensure stats object exists, then increment
    const nhieRef = db.collection('neverHaveIEver').doc(nhie.id);
    const nhieDoc = await nhieRef.get();
    const currentStats = nhieDoc.data()?.stats || { guilty: 0, innocent: 0 };
    
    if (response === 'guilty') currentStats.guilty = (currentStats.guilty || 0) + 1;
    else currentStats.innocent = (currentStats.innocent || 0) + 1;
    
    await nhieRef.update({ stats: currentStats });
    
    showNHIEStats(nhie.id, response);
    showToast(response === 'guilty' ? 'Confession noted! 🍷' : 'Innocent! 😇');
  } catch (err) {
    debugLog(`Error saving NHIE response: ${err.message}`, 'error');
    showToast('Error saving response', 'error');
    nhieLocked = false;
  }
}

async function showNHIEStats(itemId, userChoice) {
  const guiltyBtn = document.getElementById('nhieGuiltyBtn');
  const innocentBtn = document.getElementById('nhieInnocentBtn');
  
  guiltyBtn.classList.add('locked');
  innocentBtn.classList.add('locked');
  guiltyBtn.classList.toggle('selected', userChoice === 'guilty');
  innocentBtn.classList.toggle('selected', userChoice === 'innocent');
  
  try {
    const doc = await db.collection('neverHaveIEver').doc(itemId).get();
    const data = doc.data();
    const guilty = data.stats?.guilty || 0;
    const innocent = data.stats?.innocent || 0;
    const total = guilty + innocent;
    
    const guiltyPct = total > 0 ? Math.round((guilty / total) * 100) : 0;
    
    document.getElementById('nhieGuiltyStats').textContent = `${guilty} ${guilty === 1 ? 'person' : 'people'}`;
    document.getElementById('nhieInnocentStats').textContent = `${innocent} ${innocent === 1 ? 'person' : 'people'}`;
    
    setTimeout(() => {
      guiltyBtn.classList.add('show-stats');
      innocentBtn.classList.add('show-stats');
      document.getElementById('nhieStatsSummary').classList.add('show');
      document.getElementById('nhieStatsFill').style.width = `${guiltyPct}%`;
      document.getElementById('nhieStatsText').textContent = `${guiltyPct}% of guests have done this`;
    }, 100);
    
  } catch (err) {
    debugLog(`Error loading NHIE stats: ${err.message}`, 'error');
  }
}

function nextNHIE() {
  nhieIndex = (nhieIndex + 1) % neverHaveIEverData.length;
  displayNHIE();
}

// ============================================
// TRUTH OR DARE
// ============================================
function chooseTOD(type) {
  document.querySelectorAll('.tod-choice-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelector(`.tod-choice-btn.${type}`).classList.add('active');
  const resultBox = document.getElementById('todResultBox');
  resultBox.classList.remove('empty');
  
  let content, items;
  if (type === 'truth') {
    items = truthsData.length > 0 ? truthsData : DEFAULT_TRUTHS.map(t => ({ text: t }));
    const truth = items[Math.floor(Math.random() * items.length)];
    content = `<span class="type-badge truth">Truth</span><p class="result">${truth.text}</p>`;
  } else {
    items = challenges.length > 0 ? challenges : DEFAULT_CHALLENGES.map(t => ({ text: t }));
    const dare = items[Math.floor(Math.random() * items.length)];
    content = `<span class="type-badge dare">Dare</span><p class="result">${dare.text}</p>`;
  }
  resultBox.innerHTML = content;
}

function resetTOD() {
  document.querySelectorAll('.tod-choice-btn').forEach(btn => btn.classList.remove('active'));
  const resultBox = document.getElementById('todResultBox');
  resultBox.classList.add('empty');
  resultBox.innerHTML = '<p class="prompt">Choose Truth or Dare above</p>';
}

function loadTODStats() {
  // Placeholder for future stats implementation
}

// ============================================
// DATA LOADING
// ============================================
async function loadQuestions() {
  try {
    const snapshot = await db.collection('questions').orderBy('order').get();
    if (!snapshot.empty) {
      questions = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    } else {
      questions = [];
      for (let i = 0; i < DEFAULT_QUESTIONS.length; i++) {
        const docRef = await db.collection('questions').add({
          text: DEFAULT_QUESTIONS[i],
          order: i,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        questions.push({ id: docRef.id, text: DEFAULT_QUESTIONS[i], order: i });
      }
    }
  } catch (err) {
    questions = DEFAULT_QUESTIONS.map((text, i) => ({ id: `q${i}`, text, order: i }));
  }
}

async function loadChallenges() {
  try {
    const snapshot = await db.collection('challenges').get();
    if (!snapshot.empty) {
      challenges = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    } else {
      challenges = [];
      for (let i = 0; i < DEFAULT_CHALLENGES.length; i++) {
        const docRef = await db.collection('challenges').add({
          text: DEFAULT_CHALLENGES[i],
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        challenges.push({ id: docRef.id, text: DEFAULT_CHALLENGES[i] });
      }
    }
  } catch (err) {
    challenges = DEFAULT_CHALLENGES.map((text, i) => ({ id: `c${i}`, text }));
  }
}

async function loadWouldYouRather() {
  try {
    const snapshot = await db.collection('wouldYouRather').orderBy('order').get();
    if (!snapshot.empty) {
      wouldYouRatherData = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    } else {
      wouldYouRatherData = [];
      for (let i = 0; i < DEFAULT_WYR.length; i++) {
        const docRef = await db.collection('wouldYouRather').add({
          ...DEFAULT_WYR[i],
          order: i,
          stats: { A: 0, B: 0 },
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        wouldYouRatherData.push({ id: docRef.id, ...DEFAULT_WYR[i], order: i, stats: { A: 0, B: 0 } });
      }
    }
  } catch (err) {
    wouldYouRatherData = DEFAULT_WYR.map((item, i) => ({ id: `wyr${i}`, ...item, order: i, stats: { A: 0, B: 0 } }));
  }
}

async function loadNeverHaveIEver() {
  try {
    const snapshot = await db.collection('neverHaveIEver').orderBy('order').get();
    if (!snapshot.empty) {
      neverHaveIEverData = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    } else {
      neverHaveIEverData = [];
      for (let i = 0; i < DEFAULT_NHIE.length; i++) {
        const docRef = await db.collection('neverHaveIEver').add({
          statement: DEFAULT_NHIE[i],
          order: i,
          stats: { guilty: 0, innocent: 0 },
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        neverHaveIEverData.push({ id: docRef.id, statement: DEFAULT_NHIE[i], order: i, stats: { guilty: 0, innocent: 0 } });
      }
    }
  } catch (err) {
    neverHaveIEverData = DEFAULT_NHIE.map((s, i) => ({ id: `nhie${i}`, statement: s, order: i, stats: { guilty: 0, innocent: 0 } }));
  }
}

async function loadTruths() {
  try {
    const snapshot = await db.collection('truths').orderBy('order').get();
    if (!snapshot.empty) {
      truthsData = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    } else {
      truthsData = [];
      for (let i = 0; i < DEFAULT_TRUTHS.length; i++) {
        const docRef = await db.collection('truths').add({
          text: DEFAULT_TRUTHS[i],
          order: i,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        truthsData.push({ id: docRef.id, text: DEFAULT_TRUTHS[i], order: i });
      }
    }
  } catch (err) {
    truthsData = DEFAULT_TRUTHS.map((t, i) => ({ id: `truth${i}`, text: t, order: i }));
  }
}

async function loadAllGameData() {
  await Promise.all([
    loadQuestions(),
    loadChallenges(),
    loadWouldYouRather(),
    loadNeverHaveIEver(),
    loadTruths()
  ]);
  shuffleArray(wouldYouRatherData);
  shuffleArray(neverHaveIEverData);
}

/* ============================================
   GAMES.JS - UPDATED WITH ACHIEVEMENT TRACKING
   
   Replace or merge these functions into your
   existing games.js file
   ============================================ */

// ============================================
// GAME STATE - Add these variables at the top
// ============================================
let currentTODType = null; // Track if current ToD is 'truth' or 'dare'

// ============================================
// GAME STATS FUNCTIONS - Add these
// ============================================

async function trackGamePlayed(gameType) {
  if (!currentUser) return;
  
  try {
    const userRef = db.collection('users').doc(currentUser.uid);
    await userRef.set({
      gameStats: {
        gamesPlayed: firebase.firestore.FieldValue.arrayUnion(gameType)
      }
    }, { merge: true });
    
    await checkGameMasterAchievement();
    debugLog(`Tracked game played: ${gameType}`, 'info');
  } catch (err) {
    debugLog(`Error tracking game: ${err.message}`, 'error');
  }
}

async function incrementGameStat(statName, amount = 1) {
  if (!currentUser) return;
  
  try {
    await db.collection('users').doc(currentUser.uid).set({
      gameStats: {
        [statName]: firebase.firestore.FieldValue.increment(amount)
      }
    }, { merge: true });
  } catch (err) {
    debugLog(`Error incrementing stat: ${err.message}`, 'error');
  }
}

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
    return null;
  }
}

async function checkGameMasterAchievement() {
  if (!currentUser) return;
  try {
    const stats = await getGameStats();
    const allGames = ['question', 'wyr', 'nhie', 'tod'];
    if (allGames.every(g => stats?.gamesPlayed?.includes(g))) {
      await checkAndAwardAchievement(currentUser.uid, 'game_master');
    }
  } catch (err) {}
}

async function checkOpenBookAchievement() {
  if (!currentUser) return;
  try {
    const stats = await getGameStats();
    if (stats?.questionsAnswered >= 5) {
      await checkAndAwardAchievement(currentUser.uid, 'open_book');
    }
  } catch (err) {}
}

async function checkTruthSeekerAchievement() {
  if (!currentUser) return;
  try {
    const stats = await getGameStats();
    if (stats?.truthsChosen >= 5) {
      await checkAndAwardAchievement(currentUser.uid, 'truth_seeker');
    }
  } catch (err) {}
}

async function checkDaredevilAchievement() {
  if (!currentUser) return;
  try {
    const stats = await getGameStats();
    if (stats?.daresCompleted >= 5) {
      await checkAndAwardAchievement(currentUser.uid, 'daredevil');
    }
  } catch (err) {}
}

async function checkHonestSoulAchievement() {
  if (!currentUser) return;
  try {
    const stats = await getGameStats();
    if (stats?.nhieConfessions >= 5) {
      await checkAndAwardAchievement(currentUser.uid, 'honest_soul');
    }
  } catch (err) {}
}

// ============================================
// TONIGHT'S QUESTION - Update saveTQAnswer()
// ============================================
async function saveTQAnswer() {
  const answer = document.getElementById('tqAnswerInput').value.trim();
  if (!answer) {
    showToast('Please write something first!', 'error');
    return;
  }
  
  if (!currentUser) {
    showToast('Please sign in to save answers', 'error');
    return;
  }
  
  try {
    // Save the answer (existing logic)
    await db.collection('users').doc(currentUser.uid).collection('tqAnswers').add({
      questionId: currentTQQuestion?.id || 'unknown',
      question: currentTQQuestion?.text || document.getElementById('tqQuestionText').textContent,
      answer: answer,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    // ✨ Achievement tracking
    await trackGamePlayed('question');
    await incrementGameStat('questionsAnswered');
    await checkOpenBookAchievement();
    
    // Show saved answer
    document.getElementById('tqPreviousAnswer').classList.remove('hidden');
    document.getElementById('tqSavedAnswer').textContent = answer;
    document.getElementById('tqAnswerInput').value = '';
    
    showToast('Answer saved! ✨');
  } catch (err) {
    debugLog(`Error saving answer: ${err.message}`, 'error');
    showToast('Error saving answer', 'error');
  }
}

// ============================================
// WOULD YOU RATHER - Update selectWYR()
// ============================================
async function selectWYR(choice) {
  if (!currentWYR) return;
  
  // Prevent double-voting
  const optionA = document.getElementById('wyrOptionA');
  const optionB = document.getElementById('wyrOptionB');
  if (optionA.classList.contains('selected') || optionB.classList.contains('selected')) {
    return; // Already voted
  }
  
  // Visual feedback
  const selected = choice === 'A' ? optionA : optionB;
  selected.classList.add('selected');
  
  try {
    // Record vote in Firestore
    const wyrRef = db.collection('wouldYouRather').doc(currentWYR.id);
    const field = choice === 'A' ? 'votesA' : 'votesB';
    
    await wyrRef.update({
      [field]: firebase.firestore.FieldValue.increment(1)
    });
    
    // ✨ Achievement tracking
    await trackGamePlayed('wyr');
    await incrementGameStat('wyrVotes');
    
    // Fetch updated stats and display
    const updatedDoc = await wyrRef.get();
    const data = updatedDoc.data();
    displayWYRStats(data.votesA || 0, data.votesB || 0);
    
  } catch (err) {
    debugLog(`Error voting: ${err.message}`, 'error');
  }
}

// ============================================
// NEVER HAVE I EVER - Update respondNHIE()
// ============================================
async function respondNHIE(response) {
  if (!currentNHIE) return;
  
  // Prevent double-responding
  const guiltyBtn = document.getElementById('nhieGuiltyBtn');
  const innocentBtn = document.getElementById('nhieInnocentBtn');
  if (guiltyBtn.classList.contains('selected') || innocentBtn.classList.contains('selected')) {
    return;
  }
  
  // Visual feedback
  const selectedBtn = response === 'guilty' ? guiltyBtn : innocentBtn;
  selectedBtn.classList.add('selected');
  
  try {
    // Record response in Firestore
    const nhieRef = db.collection('neverHaveIEver').doc(currentNHIE.id);
    const field = response === 'guilty' ? 'guiltyCount' : 'innocentCount';
    
    await nhieRef.update({
      [field]: firebase.firestore.FieldValue.increment(1)
    });
    
    // ✨ Achievement tracking
    await trackGamePlayed('nhie');
    
    // Only track confessions for "guilty" responses
    if (response === 'guilty') {
      await incrementGameStat('nhieConfessions');
      await checkHonestSoulAchievement();
    }
    
    // Fetch updated stats and display
    const updatedDoc = await nhieRef.get();
    const data = updatedDoc.data();
    displayNHIEStats(data.guiltyCount || 0, data.innocentCount || 0);
    
  } catch (err) {
    debugLog(`Error responding: ${err.message}`, 'error');
  }
}

// ============================================
// TRUTH OR DARE - Update chooseTOD()
// ============================================
async function chooseTOD(choice) {
  currentTODType = choice; // Track the choice type
  
  const resultBox = document.getElementById('todResultBox');
  const completion = document.getElementById('todCompletion');
  
  resultBox.classList.remove('empty');
  resultBox.innerHTML = '<div class="spinner"></div>';
  
  try {
    // ✨ Achievement tracking - track game played
    await trackGamePlayed('tod');
    
    // Update global stats
    const statsRef = db.collection('config').doc('todStats');
    const statsField = choice === 'truth' ? 'truthCount' : 'dareCount';
    
    await statsRef.set({
      [statsField]: firebase.firestore.FieldValue.increment(1)
    }, { merge: true });
    
    // ✨ Track truth selections for achievement
    if (choice === 'truth') {
      await incrementGameStat('truthsChosen');
      await checkTruthSeekerAchievement();
    }
    
    // Fetch content based on choice
    let content;
    if (choice === 'truth') {
      content = await getRandomTruth();
    } else {
      content = await getRandomChallenge();
    }
    
    // Display the truth/dare
    resultBox.innerHTML = `
      <div class="tod-type ${choice}">${choice === 'truth' ? '🔮 Truth' : '⚡ Dare'}</div>
      <p class="tod-content">${escapeHtml(content?.text || 'No content available')}</p>
    `;
    
    // Show completion buttons for dares
    if (choice === 'dare') {
      completion.classList.remove('hidden');
    } else {
      completion.classList.add('hidden');
    }
    
    // Update displayed stats
    await updateTODStats();
    
  } catch (err) {
    debugLog(`Error in TOD: ${err.message}`, 'error');
    resultBox.innerHTML = '<p class="prompt">Error loading content. Try again!</p>';
  }
}

// ============================================
// TRUTH OR DARE - Update completeTOD()
// ============================================
async function completeTOD(status) {
  const completion = document.getElementById('todCompletion');
  completion.classList.add('hidden');
  
  try {
    // Update completion stats
    const statsRef = db.collection('config').doc('todStats');
    const field = status === 'completed' ? 'completedCount' : 'skippedCount';
    
    await statsRef.set({
      [field]: firebase.firestore.FieldValue.increment(1)
    }, { merge: true });
    
    // ✨ Track dare completions for achievement
    if (currentTODType === 'dare' && status === 'completed') {
      await incrementGameStat('daresCompleted');
      await checkDaredevilAchievement();
    }
    
    // Visual feedback
    const resultBox = document.getElementById('todResultBox');
    if (status === 'completed') {
      resultBox.innerHTML += '<div class="tod-result-badge success">✓ Completed!</div>';
      showToast('Well done! 🎉');
    } else {
      resultBox.innerHTML += '<div class="tod-result-badge skipped">Skipped</div>';
    }
    
    // Update stats display
    await updateTODStats();
    
  } catch (err) {
    debugLog(`Error completing TOD: ${err.message}`, 'error');
  }
}

// ============================================
// HELPER: Update TOD Stats Display
// ============================================
async function updateTODStats() {
  try {
    const statsDoc = await db.collection('config').doc('todStats').get();
    const stats = statsDoc.data() || {};
    
    const truthCount = stats.truthCount || 0;
    const dareCount = stats.dareCount || 0;
    const completed = stats.completedCount || 0;
    const skipped = stats.skippedCount || 0;
    
    document.getElementById('todTruthStats').textContent = `${truthCount} chosen`;
    document.getElementById('todDareStats').textContent = `${dareCount} chosen`;
    document.getElementById('todCompletedCount').textContent = completed;
    document.getElementById('todSkippedCount').textContent = skipped;
    
    const total = completed + skipped;
    const rate = total > 0 ? Math.round((completed / total) * 100) : 0;
    document.getElementById('todCompletionRate').textContent = `${rate}%`;
    
  } catch (err) {
    debugLog(`Error updating TOD stats: ${err.message}`, 'error');
  }
}

// ============================================
// HELPER: Display WYR Stats
// ============================================
function displayWYRStats(votesA, votesB) {
  const total = votesA + votesB;
  const pctA = total > 0 ? Math.round((votesA / total) * 100) : 50;
  const pctB = total > 0 ? Math.round((votesB / total) * 100) : 50;
  
  document.getElementById('wyrStatsA').textContent = `${pctA}%`;
  document.getElementById('wyrStatsB').textContent = `${pctB}%`;
  document.getElementById('wyrCountA').textContent = `${votesA} vote${votesA !== 1 ? 's' : ''}`;
  document.getElementById('wyrCountB').textContent = `${votesB} vote${votesB !== 1 ? 's' : ''}`;
  
  // Animate the stat bars
  document.getElementById('wyrBarA').style.width = `${pctA}%`;
  document.getElementById('wyrBarB').style.width = `${pctB}%`;
  
  // Show stats
  document.getElementById('wyrOptionA').classList.add('show-stats');
  document.getElementById('wyrOptionB').classList.add('show-stats');
}

// ============================================
// HELPER: Display NHIE Stats
// ============================================
function displayNHIEStats(guilty, innocent) {
  const total = guilty + innocent;
  const pct = total > 0 ? Math.round((guilty / total) * 100) : 0;
  
  document.getElementById('nhieGuiltyStats').textContent = `${guilty} ${guilty === 1 ? 'person' : 'people'}`;
  document.getElementById('nhieInnocentStats').textContent = `${innocent} ${innocent === 1 ? 'person' : 'people'}`;
  document.getElementById('nhieStatsFill').style.width = `${pct}%`;
  document.getElementById('nhieStatsText').textContent = `${pct}% of guests have done this`;
  
  // Show stats
  document.getElementById('nhieStatsSummary').classList.add('visible');
}