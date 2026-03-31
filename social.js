/* ============================================
   SOCIAL.JS
   Guests, Badges, Connections, Notifications,
   Achievements
   ============================================ */

// ============================================
// STATE
// ============================================
let guestsCache = [];
let pendingRequests = [];
let badgeNotifications = [];
let myConnections = {};
let myBadgesReceived = {};  // { odedUserId: { odedBadgeType: count } }
let myBadgesGiven = {};     // { odedUserId: { odedBadgeType: count } }
let unsubscribeListeners = [];

// ============================================
// BADGES & CONNECTIONS CONFIG
// ============================================
const USER_BADGES = {
  fire: { emoji: '🔥', name: 'Great Convo' },
  spark: { emoji: '💫', name: 'Connection' },
  laugh: { emoji: '😂', name: 'Hilarious' },
  welcome: { emoji: '🤝', name: 'Welcoming' },
  deep: { emoji: '💭', name: 'Deep Thinker' },
  energy: { emoji: '💃', name: 'Life of Party' },
  moment: { emoji: '✨', name: 'Memorable' },
  intriguing: { emoji: '🎭', name: 'Intriguing' }
};

const ACHIEVEMENTS = {
  early_bird: { emoji: '🎉', name: 'Early Bird', desc: 'First 10 to join' },
  picture_perfect: { emoji: '📸', name: 'Picture Perfect', desc: 'Has profile photo' },
  storyteller: { emoji: '✍️', name: 'Storyteller', desc: 'Has a bio' },
  game_master: { emoji: '🎲', name: 'Game Master', desc: 'Played all 4 games' },
  open_book: { emoji: '🗣️', name: 'Open Book', desc: 'Answered 5+ questions' },
  truth_seeker: { emoji: '🔮', name: 'Truth Seeker', desc: 'Chose truth 5+ times' },
  daredevil: { emoji: '⚡', name: 'Daredevil', desc: 'Completed 5+ dares' },
  honest_soul: { emoji: '🍷', name: 'Honest Soul', desc: 'Confessed 5+ times' },
  social_butterfly: { emoji: '🦋', name: 'Social Butterfly', desc: '5+ connections' },
  popular: { emoji: '⭐', name: 'Popular', desc: 'Received 10+ badges' }
};

const CONNECTION_TYPES = {
  partner: { emoji: '💕', name: 'Partner', desc: 'My partner', isPublic: true },
  bestie: { emoji: '👯', name: 'Bestie', desc: 'Best friend' },
  friend: { emoji: '🫂', name: 'Friend', desc: 'A good friend' },
  fwb: { emoji: '🔥', name: 'FWB', desc: 'Friends with benefits' },
  already_know: { emoji: '🔗', name: 'Already Know', desc: 'We know each other' },
  met_tonight: { emoji: '🤝', name: 'Met Tonight', desc: 'Just met at this party' },
  want_to_chat: { emoji: '💬', name: 'Want to Chat', desc: 'Would love to talk more' },
  sparked: { emoji: '✨', name: 'Sparked', desc: 'Feeling a connection' }
};

const MAX_BADGES_PER_DAY = 5;

// ============================================
// LOAD MY BADGE RELATIONSHIPS
// ============================================
async function loadMyBadgeRelationships() {
  if (!currentUser) return;
  
  try {
    // Badges I received (grouped by sender)
    const receivedSnap = await db.collection('badges')
      .where('to', '==', currentUser.uid)
      .get();
    
    myBadgesReceived = {};
    receivedSnap.forEach(doc => {
      const data = doc.data();
      if (!myBadgesReceived[data.from]) myBadgesReceived[data.from] = {};
      if (!myBadgesReceived[data.from][data.type]) myBadgesReceived[data.from][data.type] = 0;
      myBadgesReceived[data.from][data.type]++;
    });
    
    // Badges I gave (grouped by recipient)
    const givenSnap = await db.collection('badges')
      .where('from', '==', currentUser.uid)
      .get();
    
    myBadgesGiven = {};
    givenSnap.forEach(doc => {
      const data = doc.data();
      if (!myBadgesGiven[data.to]) myBadgesGiven[data.to] = {};
      if (!myBadgesGiven[data.to][data.type]) myBadgesGiven[data.to][data.type] = 0;
      myBadgesGiven[data.to][data.type]++;
    });
    
    debugLog(`Loaded badge relationships: ${Object.keys(myBadgesReceived).length} senders, ${Object.keys(myBadgesGiven).length} recipients`, 'info');
  } catch (err) {
    debugLog(`Error loading badge relationships: ${err.message}`, 'error');
  }
}

// ============================================
// GUESTS
// ============================================
async function setupGuests() {
  await loadGuests();
  renderGuests();
}

async function loadGuests() {
  try {
    const snapshot = await db.collection('users')
      .where('isVisible', '==', true)
      .where('hasConsented', '==', true)
      .get();
    guestsCache = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      if (data.displayName) guestsCache.push({ id: doc.id, ...data });
    });
    guestsCache.sort((a, b) => a.displayName.localeCompare(b.displayName));
  } catch (err) {
    guestsCache = [];
  }
}

function renderGuests() {
  const grid = document.getElementById('guestsGrid');
  const empty = document.getElementById('guestsEmpty');
  const count = document.getElementById('guestsCount');
  
  if (guestsCache.length === 0) {
    grid.innerHTML = '';
    empty.classList.remove('hidden');
    count.textContent = '0 guests';
    return;
  }
  
  empty.classList.add('hidden');
  count.textContent = `${guestsCache.length} guest${guestsCache.length !== 1 ? 's' : ''}`;
  
  grid.innerHTML = guestsCache.map(guest => {
    const isMe = currentUser && guest.id === currentUser.uid;
    const avatarURL = guest.avatarURL || guest.photoURL;
    const avatarHtml = avatarURL
      ? `<img src="${avatarURL}" class="guest-card-avatar" alt="${guest.displayName}" onerror="this.style.display='none'; this.insertAdjacentHTML('afterend', '<div class=\\'guest-card-placeholder\\'>👤</div>'); this.onerror=null;">`
      : `<div class="guest-card-placeholder">👤</div>`;
    
    // Determine card type for styling
    const connection = myConnections[guest.id];
    const theyGaveMe = myBadgesReceived[guest.id];
    const iGaveThem = myBadgesGiven[guest.id];
    
    // Check if this guest has a public partner connection
    const guestConnections = guest.connections || {};
    let partnerBadge = '';
    for (const [connectedId, connData] of Object.entries(guestConnections)) {
      if (connData.type === 'partner') {
        const partnerGuest = guestsCache.find(g => g.id === connectedId);
        if (partnerGuest) {
          partnerBadge = `<span class="guest-card-partner" title="Partner: ${escapeHtml(partnerGuest.displayName)}">💕</span>`;
        }
        break;
      }
    }
    
    let cardClass = 'glass-card guest-card';
    let indicators = '';
    
    if (isMe) {
      cardClass += ' guest-card-me';
      indicators = '<span class="guest-card-you-badge">You</span>';
    } else {
      if (connection) {
        cardClass += ' guest-card-connected';
        const connType = CONNECTION_TYPES[connection.type] || CONNECTION_TYPES.met_tonight;
        indicators += `<span class="guest-card-connection" title="Connected: ${connType.name}">${connType.emoji}</span>`;
      }
      
      if (theyGaveMe || iGaveThem) {
        indicators += '<div class="guest-card-vibes">';
        if (theyGaveMe) {
          const badges = Object.keys(theyGaveMe).slice(0, 3).map(type => USER_BADGES[type]?.emoji || '✨').join('');
          indicators += `<span class="vibes-from" title="Vibes from them">${badges}</span>`;
        }
        if (iGaveThem) {
          const badges = Object.keys(iGaveThem).slice(0, 3).map(type => USER_BADGES[type]?.emoji || '✨').join('');
          indicators += `<span class="vibes-to" title="Vibes you sent">→${badges}</span>`;
        }
        indicators += '</div>';
      }
    }
    
    return `
      <div class="${cardClass}" onclick="showGuestProfile('${guest.id}')">
        ${indicators}
        ${partnerBadge}
        ${avatarHtml}
        <div class="guest-card-name">${escapeHtml(guest.displayName)}</div>
        ${guest.bio ? `<div class="guest-card-bio">${escapeHtml(guest.bio)}</div>` : ''}
      </div>
    `;
  }).join('');
}

async function showGuestProfile(guestId) {
  let guest = guestsCache.find(g => g.id === guestId);
  
  // If not in cache, fetch directly from Firestore
  if (!guest) {
    try {
      const userDoc = await db.collection('users').doc(guestId).get();
      if (userDoc.exists) {
        guest = { id: guestId, ...userDoc.data() };
      } else {
        showToast('User not found', 'error');
        return;
      }
    } catch (err) {
      debugLog(`Error fetching user: ${err.message}`, 'error');
      showToast('Error loading profile', 'error');
      return;
    }
  }
  
  const isOwnProfile = currentUser && guestId === currentUser.uid;
  const avatarURL = guest.avatarURL || guest.photoURL;
  
  document.getElementById('guestModal').classList.remove('hidden');
  document.getElementById('guestModalContent').innerHTML = `
    <div class="profile-loading"><div class="spinner"></div></div>
  `;
  
  // Fetch data based on profile type
  let badges, achievements, pendingRequest, badgesGivenToday, totalBadgesReceived, connectionsCount, badgeDetails;
  
  if (isOwnProfile) {
    [badges, badgeDetails, achievements, badgesGivenToday] = await Promise.all([
      getReceivedBadges(guestId),
      getReceivedBadgesWithSenders(guestId), // New: get sender details
      getUserAchievements(guestId),
      getMyBadgesGivenToday()
    ]);
    totalBadgesReceived = Object.values(badges).reduce((sum, b) => sum + b.count, 0);
    connectionsCount = Object.keys(myConnections).length;
  } else {
    [badges, achievements, pendingRequest, badgesGivenToday] = await Promise.all([
      getReceivedBadges(guestId),
      getUserAchievements(guestId),
      getPendingRequestTo(guestId),
      getMyBadgesGivenToday()
    ]);
  }
  
  const connection = myConnections[guestId];
  const badgesRemaining = MAX_BADGES_PER_DAY - badgesGivenToday;
  
  // Get mutual badge data for non-own profiles
  const theyGaveMe = myBadgesReceived[guestId] || {};
  const iGaveThem = myBadgesGiven[guestId] || {};
  
  // Check for partner (public connection)
  const guestConnections = guest.connections || {};
  let partnerInfo = null;
  for (const [connectedId, connData] of Object.entries(guestConnections)) {
    if (connData.type === 'partner') {
      const partnerGuest = guestsCache.find(g => g.id === connectedId);
      if (partnerGuest) {
        partnerInfo = { id: connectedId, name: partnerGuest.displayName, avatar: partnerGuest.avatarURL || partnerGuest.photoURL };
      }
      break;
    }
  }
  
  let html = '';
  
  // Hero section
  html += `
    <div class="profile-hero">
      ${avatarURL
        ? `<img src="${avatarURL}" class="profile-avatar" alt="${guest.displayName}" onerror="this.style.display='none'; this.insertAdjacentHTML('afterend', '<div class=\\'profile-avatar-placeholder\\'>👤</div>'); this.onerror=null;">`
        : `<div class="profile-avatar-placeholder">👤</div>`
      }
      <div class="profile-name">${escapeHtml(guest.displayName)}${isOwnProfile ? ' <span class="profile-you-tag">You</span>' : ''}</div>
      ${guest.bio 
        ? `<div class="profile-bio">${escapeHtml(guest.bio)}</div>`
        : `<div class="profile-bio empty">No bio yet</div>`
      }
      ${partnerInfo ? `
        <div class="profile-partner-badge" onclick="event.stopPropagation(); showGuestProfile('${partnerInfo.id}')">
          💕 with <strong>${escapeHtml(partnerInfo.name)}</strong>
        </div>
      ` : ''}
    </div>
  `;
  
  // OWN PROFILE: Show stats dashboard
  if (isOwnProfile) {
    html += `
      <div class="profile-section">
        <div class="profile-stats-grid">
          <div class="profile-stat">
            <span class="stat-value">${totalBadgesReceived}</span>
            <span class="stat-label">Vibes Received</span>
          </div>
          <div class="profile-stat">
            <span class="stat-value">${connectionsCount}</span>
            <span class="stat-label">Connections</span>
          </div>
          <div class="profile-stat">
            <span class="stat-value">${badgesRemaining}/${MAX_BADGES_PER_DAY}</span>
            <span class="stat-label">Vibes Left Today</span>
          </div>
        </div>
      </div>
    `;
    
    // Show all badges received (clickable to see senders)
    const allBadges = Object.entries(badges);
    if (allBadges.length > 0) {
      html += `
        <div class="profile-section">
          <div class="profile-section-title">Your Vibes</div>
          <p class="profile-section-subtitle">Tap to see who sent each vibe</p>
          <div class="profile-badges">
            ${allBadges.map(([type, data]) => `
              <div class="profile-badge profile-badge-clickable" 
                   title="${USER_BADGES[type]?.name || type}" 
                   onclick="showBadgeSenders('${type}')">
                <span class="badge-emoji">${USER_BADGES[type]?.emoji || '✨'}</span>
                <span class="badge-count">×${data.count}</span>
              </div>
            `).join('')}
          </div>
          <div id="badgeSendersPanel" class="badge-senders-panel hidden"></div>
        </div>
      `;
      
      // Store badge details for the click handler
      window._badgeDetails = badgeDetails;
    }
    
    // Show achievements
    if (achievements.length > 0) {
      html += `
        <div class="profile-section">
          <div class="profile-section-title">Achievements</div>
          <div class="profile-achievements">
            ${achievements.map(key => {
              const ach = ACHIEVEMENTS[key];
              return ach ? `
                <div class="profile-achievement" title="${ach.desc}">
                  <span>${ach.emoji}</span>
                  <span>${ach.name}</span>
                </div>
              ` : '';
            }).join('')}
          </div>
        </div>
      `;
    }
    
    // Edit profile button
    html += `
      <div class="profile-section">
        <button class="btn-outline profile-edit-btn" onclick="closeGuestModal(); showPage('lounge'); showEditProfile();">
          ✏️ Edit Profile
        </button>
      </div>
    `;
    
  } else {
    // OTHER'S PROFILE
    
    // Mutual vibes section (if any exchange exists)
    const hasTheirVibes = Object.keys(theyGaveMe).length > 0;
    const hasMyVibes = Object.keys(iGaveThem).length > 0;
    
    if (hasTheirVibes || hasMyVibes) {
      html += `<div class="profile-section">`;
      html += `<div class="profile-section-title">Your Vibe Exchange</div>`;
      html += `<div class="profile-vibe-exchange">`;
      
      if (hasTheirVibes) {
        html += `
          <div class="vibe-exchange-row received">
            <span class="exchange-label">From them:</span>
            <div class="exchange-badges">
              ${Object.entries(theyGaveMe).map(([type, count]) => `
                <span class="exchange-badge" title="${USER_BADGES[type]?.name || type}">
                  ${USER_BADGES[type]?.emoji || '✨'}${count > 1 ? `×${count}` : ''}
                </span>
              `).join('')}
            </div>
          </div>
        `;
      }
      
      if (hasMyVibes) {
        html += `
          <div class="vibe-exchange-row sent">
            <span class="exchange-label">From you:</span>
            <div class="exchange-badges">
              ${Object.entries(iGaveThem).map(([type, count]) => `
                <span class="exchange-badge" title="${USER_BADGES[type]?.name || type}">
                  ${USER_BADGES[type]?.emoji || '✨'}${count > 1 ? `×${count}` : ''}
                </span>
              `).join('')}
            </div>
          </div>
        `;
      }
      
      html += `</div></div>`;
    }
    
    // Public badges section (badges from everyone)
    const publicBadges = Object.entries(badges).filter(([_, b]) => b.isPublic);
    if (publicBadges.length > 0) {
      html += `
        <div class="profile-section">
          <div class="profile-section-title">All Vibes Received</div>
          <div class="profile-badges">
            ${publicBadges.map(([type, data]) => `
              <div class="profile-badge" title="${USER_BADGES[type]?.name || type}">
                <span class="badge-emoji">${USER_BADGES[type]?.emoji || '✨'}</span>
                <span class="badge-count">×${data.count}</span>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }
    
    // Achievements section
    if (achievements.length > 0) {
      html += `
        <div class="profile-section">
          <div class="profile-section-title">Achievements</div>
          <div class="profile-achievements">
            ${achievements.map(key => {
              const ach = ACHIEVEMENTS[key];
              return ach ? `
                <div class="profile-achievement" title="${ach.desc}">
                  <span>${ach.emoji}</span>
                  <span>${ach.name}</span>
                </div>
              ` : '';
            }).join('')}
          </div>
        </div>
      `;
    }
    
    // Connection section
    html += `<div class="profile-section">`;
    
    if (connection) {
      const connType = CONNECTION_TYPES[connection.type] || CONNECTION_TYPES.met_tonight;
      html += `
        <div class="profile-connected">
          <span class="connected-icon">${connType.emoji}</span>
          <span class="connected-text">You're connected</span>
          <span class="connected-type">${connType.name}</span>
        </div>
        <button class="btn-text change-connection-btn" onclick="showChangeConnectionUI('${guestId}', '${connection.type}')">
          Change connection type
        </button>
        <div id="changeConnectionPanel" class="change-connection-panel hidden"></div>
      `;
    } else if (pendingRequest) {
      html += `
        <div class="profile-pending">
          <span>⏳</span>
          <span>Connection request sent</span>
        </div>
      `;
    } else {
      html += `
        <div class="profile-section-title">Connect</div>
        <div class="profile-connect-grid">
          ${Object.entries(CONNECTION_TYPES).map(([key, type]) => `
            <button class="connect-btn" onclick="sendConnectionRequest('${guestId}', '${key}')">
              <span class="connect-emoji">${type.emoji}</span>
              <span class="connect-label">${type.name}</span>
            </button>
          `).join('')}
        </div>
      `;
    }
    
    html += `</div>`;
    
    // Give badge section
    html += `
      <div class="profile-section">
        <div class="profile-section-title">Send a Vibe</div>
        <p class="profile-section-subtitle">Let them know how they made you feel</p>
        <div class="profile-badge-grid">
          ${Object.entries(USER_BADGES).map(([key, badge]) => {
            const alreadyGiven = iGaveThem[key];
            return `
              <button 
                class="give-badge-btn ${alreadyGiven ? 'given' : ''}" 
                onclick="${alreadyGiven ? '' : `sendBadgeFromModal('${guestId}', '${key}')`}"
                ${alreadyGiven || badgesRemaining <= 0 ? 'disabled' : ''}
                title="${badge.name}"
              >
                <span class="give-badge-emoji">${badge.emoji}</span>
                <span class="give-badge-name">${badge.name}</span>
                ${alreadyGiven ? '<span class="give-badge-check">✓</span>' : ''}
              </button>
            `;
          }).join('')}
        </div>
        <div class="profile-badge-footer">
          <label class="badge-public-toggle">
            <input type="checkbox" id="badgePublicCheckbox" checked>
            <span>Show on their profile</span>
          </label>
          <div class="badges-remaining">
            <strong>${badgesRemaining}</strong> of ${MAX_BADGES_PER_DAY} vibes left today
          </div>
        </div>
      </div>
    `;
  }
  
  document.getElementById('guestModalContent').innerHTML = html;
}

async function sendBadgeFromModal(recipientId, badgeType) {
  const isPublic = document.getElementById('badgePublicCheckbox')?.checked ?? true;
  await giveBadge(recipientId, badgeType, isPublic);
}

function closeGuestModal(event) {
  if (!event || event.target === event.currentTarget) {
    document.getElementById('guestModal').classList.add('hidden');
  }
}

// ============================================
// REAL-TIME LISTENERS
// ============================================
function setupRealtimeListeners() {
  if (!currentUser) return;
  
  // Clean up existing listeners
  unsubscribeListeners.forEach(unsub => unsub());
  unsubscribeListeners = [];
  
  // Listen for connection requests TO me
  const unsubConnections = db.collection('connectionRequests')
    .where('to', '==', currentUser.uid)
    .where('status', '==', 'pending')
    .onSnapshot(snapshot => {
      pendingRequests = [];
      snapshot.forEach(doc => pendingRequests.push({ id: doc.id, ...doc.data() }));
      updateNotificationBadge();
      
      // Check for new requests (added)
      snapshot.docChanges().forEach(change => {
        if (change.type === 'added') {
          const data = change.doc.data();
          // Only show toast if this is truly new (not initial load)
          if (data.timestamp && isRecent(data.timestamp.toDate(), 5000)) {
            showToast('New connection request! 🤝');
          }
        }
      });
    }, err => {
      debugLog(`Connection listener error: ${err.message}`, 'error');
    });
  
  unsubscribeListeners.push(unsubConnections);
  
  // Listen for badges given TO me (last 24 hours, unread)
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  
  const unsubBadges = db.collection('badges')
    .where('to', '==', currentUser.uid)
    .where('timestamp', '>', yesterday)
    .orderBy('timestamp', 'desc')
    .onSnapshot(snapshot => {
      badgeNotifications = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        if (!data.readBy || !data.readBy.includes(currentUser.uid)) {
          badgeNotifications.push({ id: doc.id, ...data });
        }
      });
      updateNotificationBadge();
      
      // Check for new badges
      snapshot.docChanges().forEach(change => {
        if (change.type === 'added') {
          const data = change.doc.data();
          if (data.timestamp && isRecent(data.timestamp.toDate(), 5000)) {
            const badge = USER_BADGES[data.type] || { emoji: '✨', name: 'Vibe' };
            showToast(`You received a ${badge.emoji} vibe!`);
          }
        }
      });
    }, err => {
      debugLog(`Badge listener error: ${err.message}`, 'error');
    });
  
  unsubscribeListeners.push(unsubBadges);
  
  // Listen for my connections (to keep myConnections updated)
  const unsubMyProfile = db.collection('users').doc(currentUser.uid)
    .onSnapshot(doc => {
      if (doc.exists) {
        const data = doc.data();
        myConnections = data.connections || {};
        // Re-render guests if on that page to show connection indicators
        if (!document.getElementById('page-guests').classList.contains('hidden')) {
          renderGuests();
        }
      }
    }, err => {
      debugLog(`Profile listener error: ${err.message}`, 'error');
    });
  
  unsubscribeListeners.push(unsubMyProfile);
  
  debugLog('Real-time listeners set up', 'info');
}

function cleanupRealtimeListeners() {
  unsubscribeListeners.forEach(unsub => unsub());
  unsubscribeListeners = [];
  debugLog('Real-time listeners cleaned up', 'info');
}

// Helper: check if a date is within the last N milliseconds
function isRecent(date, ms) {
  return date && (Date.now() - date.getTime()) < ms;
}

// ============================================
// BADGES SYSTEM
// ============================================
async function loadUserBadgesAndConnections() {
  if (!currentUser) return;
  try {
    const userDoc = await db.collection('users').doc(currentUser.uid).get();
    if (userDoc.exists) {
      const data = userDoc.data();
      myConnections = data.connections || {};
      
      // Check badge reset (daily)
      const lastReset = data.lastBadgeReset?.toDate();
      const now = new Date();
      if (!lastReset || lastReset.toDateString() !== now.toDateString()) {
        await db.collection('users').doc(currentUser.uid).update({
          badgesGivenToday: 0,
          lastBadgeReset: firebase.firestore.FieldValue.serverTimestamp()
        });
      }
    }
    
    // Load badge relationships for guest cards
    await loadMyBadgeRelationships();
    
    // Set up real-time listeners
    setupRealtimeListeners();
    
  } catch (err) {
    debugLog(`Error loading badges/connections: ${err.message}`, 'error');
  }
}

function updateNotificationBadge() {
  const badge = document.getElementById('notifBadge');
  const totalCount = pendingRequests.length + badgeNotifications.length;
  
  if (totalCount > 0) {
    badge.textContent = totalCount > 9 ? '9+' : totalCount;
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }
}

async function giveBadge(recipientId, badgeType, isPublic) {
  if (!currentUser || recipientId === currentUser.uid) return;
  
  try {
    const userDoc = await db.collection('users').doc(currentUser.uid).get();
    const userData = userDoc.data() || {};
    const givenToday = userData.badgesGivenToday || 0;
    
    if (givenToday >= MAX_BADGES_PER_DAY) {
      showToast(`You've given all ${MAX_BADGES_PER_DAY} vibes for today!`, 'error');
      return;
    }
    
    const existingBadge = await db.collection('badges')
      .where('from', '==', currentUser.uid)
      .where('to', '==', recipientId)
      .where('type', '==', badgeType)
      .get();
    
    if (!existingBadge.empty) {
      showToast('You already sent this vibe!', 'error');
      return;
    }
    
    // Save badge (the real-time listener on recipient will pick this up)
    await db.collection('badges').add({
      from: currentUser.uid,
      fromName: userProfile?.displayName || 'Someone',
      fromAvatar: userProfile?.avatarURL || userProfile?.photoURL || null,
      to: recipientId,
      type: badgeType,
      isPublic: isPublic,
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      readBy: [] // Track who has seen this notification
    });
    
    await db.collection('users').doc(currentUser.uid).update({
      badgesGivenToday: firebase.firestore.FieldValue.increment(1)
    });
    
    // Update local cache
    if (!myBadgesGiven[recipientId]) myBadgesGiven[recipientId] = {};
    if (!myBadgesGiven[recipientId][badgeType]) myBadgesGiven[recipientId][badgeType] = 0;
    myBadgesGiven[recipientId][badgeType]++;
    
    showToast(`${USER_BADGES[badgeType].emoji} Vibe sent!`);
    
    await showGuestProfile(recipientId);
    checkBadgeAchievements(recipientId);
    
  } catch (err) {
    debugLog(`Error giving badge: ${err.message}`, 'error');
    showToast('Error sending vibe', 'error');
  }
}

async function getReceivedBadges(userId) {
  try {
    const snapshot = await db.collection('badges').where('to', '==', userId).get();
    const badges = {};
    snapshot.forEach(doc => {
      const data = doc.data();
      if (!badges[data.type]) badges[data.type] = { count: 0, isPublic: data.isPublic, fromMe: false };
      badges[data.type].count++;
      if (data.from === currentUser?.uid) badges[data.type].fromMe = true;
      if (data.isPublic) badges[data.type].isPublic = true;
    });
    return badges;
  } catch (err) {
    return {};
  }
}

async function getMyBadgesGivenToday() {
  if (!currentUser) return 0;
  try {
    const userDoc = await db.collection('users').doc(currentUser.uid).get();
    return userDoc.data()?.badgesGivenToday || 0;
  } catch (err) {
    return 0;
  }
}

async function getUserAchievements(userId) {
  try {
    const userDoc = await db.collection('users').doc(userId).get();
    return userDoc.data()?.achievements || [];
  } catch (err) {
    return [];
  }
}

// Get badges with sender details (for "who sent this" feature)
async function getReceivedBadgesWithSenders(userId) {
  try {
    const snapshot = await db.collection('badges').where('to', '==', userId).get();
    const badgesByType = {};
    
    snapshot.forEach(doc => {
      const data = doc.data();
      if (!badgesByType[data.type]) badgesByType[data.type] = [];
      badgesByType[data.type].push({
        from: data.from,
        fromName: data.fromName || 'Someone',
        fromAvatar: data.fromAvatar,
        timestamp: data.timestamp
      });
    });
    
    return badgesByType;
  } catch (err) {
    return {};
  }
}

// Show who sent a specific badge type
function showBadgeSenders(badgeType) {
  const panel = document.getElementById('badgeSendersPanel');
  const badgeDetails = window._badgeDetails || {};
  const senders = badgeDetails[badgeType] || [];
  const badge = USER_BADGES[badgeType];
  
  if (senders.length === 0) {
    panel.classList.add('hidden');
    return;
  }
  
  panel.innerHTML = `
    <div class="badge-senders-header">
      <span>${badge?.emoji || '✨'} ${badge?.name || badgeType}</span>
      <button onclick="document.getElementById('badgeSendersPanel').classList.add('hidden')">&times;</button>
    </div>
    <div class="badge-senders-list">
      ${senders.map(s => {
        const guest = guestsCache.find(g => g.id === s.from);
        const name = guest?.displayName || s.fromName || 'Someone';
        const avatar = guest?.avatarURL || guest?.photoURL || s.fromAvatar;
        return `
          <div class="badge-sender-item" onclick="closeGuestModal(); setTimeout(() => showGuestProfile('${s.from}'), 100)">
            ${avatar
              ? `<img src="${avatar}" class="badge-sender-avatar" onerror="this.style.display='none'; this.insertAdjacentHTML('afterend', '<div class=\\'badge-sender-avatar-placeholder\\'>👤</div>'); this.onerror=null;">`
              : `<div class="badge-sender-avatar-placeholder">👤</div>`
            }
            <span class="badge-sender-name">${escapeHtml(name)}</span>
          </div>
        `;
      }).join('')}
    </div>
  `;
  
  panel.classList.remove('hidden');
}

// Show UI to change connection type
function showChangeConnectionUI(userId, currentType) {
  const panel = document.getElementById('changeConnectionPanel');
  
  panel.innerHTML = `
    <div class="change-connection-header">
      <span>Change connection to:</span>
    </div>
    <div class="change-connection-options">
      ${Object.entries(CONNECTION_TYPES).map(([key, type]) => `
        <button 
          class="change-conn-btn ${key === currentType ? 'current' : ''}" 
          onclick="changeConnectionType('${userId}', '${key}')"
          ${key === currentType ? 'disabled' : ''}
        >
          <span>${type.emoji}</span>
          <span>${type.name}</span>
          ${key === currentType ? '<span class="current-tag">Current</span>' : ''}
        </button>
      `).join('')}
    </div>
    <button class="btn-text" onclick="document.getElementById('changeConnectionPanel').classList.add('hidden')">Cancel</button>
  `;
  
  panel.classList.remove('hidden');
}

// Change the connection type with someone
async function changeConnectionType(userId, newType) {
  if (!currentUser) return;
  
  try {
    const connectionData = {
      type: newType,
      since: myConnections[userId]?.since || firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    // Update both users
    await db.collection('users').doc(currentUser.uid).update({
      [`connections.${userId}`]: connectionData
    });
    
    await db.collection('users').doc(userId).update({
      [`connections.${currentUser.uid}`]: connectionData
    });
    
    // Update local state
    myConnections[userId] = { type: newType, since: myConnections[userId]?.since || new Date() };
    
    const connType = CONNECTION_TYPES[newType];
    showToast(`${connType.emoji} Connection updated to ${connType.name}!`);
    
    // Refresh the profile modal
    await showGuestProfile(userId);
    
  } catch (err) {
    debugLog(`Error changing connection: ${err.message}`, 'error');
    showToast('Error updating connection', 'error');
  }
}

async function markBadgeAsRead(badgeId) {
  if (!currentUser) return;
  try {
    await db.collection('badges').doc(badgeId).update({
      readBy: firebase.firestore.FieldValue.arrayUnion(currentUser.uid)
    });
  } catch (err) {
    debugLog(`Error marking badge read: ${err.message}`, 'error');
  }
}

// ============================================
// CONNECTIONS SYSTEM
// ============================================
async function sendConnectionRequest(toUserId, connectionType) {
  if (!currentUser || toUserId === currentUser.uid) return;
  
  try {
    if (myConnections[toUserId]) {
      showToast('Already connected!', 'error');
      return;
    }
    
    const existingReq = await db.collection('connectionRequests')
      .where('from', '==', currentUser.uid)
      .where('to', '==', toUserId)
      .where('status', '==', 'pending')
      .get();
    
    if (!existingReq.empty) {
      showToast('Request already sent!', 'error');
      return;
    }
    
    // Check for mutual request (auto-accept)
    const theirRequest = await db.collection('connectionRequests')
      .where('from', '==', toUserId)
      .where('to', '==', currentUser.uid)
      .where('status', '==', 'pending')
      .get();
    
    if (!theirRequest.empty) {
      const reqDoc = theirRequest.docs[0];
      await acceptConnection(reqDoc.id, toUserId, reqDoc.data().type);
      showToast('You both wanted to connect! 🎉');
      await showGuestProfile(toUserId);
      return;
    }
    
    await db.collection('connectionRequests').add({
      from: currentUser.uid,
      fromName: userProfile?.displayName || 'Someone',
      fromAvatar: userProfile?.avatarURL || userProfile?.photoURL || null,
      to: toUserId,
      type: connectionType,
      status: 'pending',
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    showToast(`${CONNECTION_TYPES[connectionType].emoji} Connection request sent!`);
    await showGuestProfile(toUserId);
    
  } catch (err) {
    debugLog(`Error sending request: ${err.message}`, 'error');
    showToast('Error sending request', 'error');
  }
}

async function acceptConnection(requestId, fromUserId, connectionType) {
  if (!currentUser) return;
  
  try {
    await db.collection('connectionRequests').doc(requestId).update({
      status: 'accepted',
      acceptedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    const connectionData = {
      type: connectionType,
      since: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    await db.collection('users').doc(currentUser.uid).update({
      [`connections.${fromUserId}`]: connectionData
    });
    
    await db.collection('users').doc(fromUserId).update({
      [`connections.${currentUser.uid}`]: connectionData
    });
    
    myConnections[fromUserId] = { type: connectionType, since: new Date() };
    pendingRequests = pendingRequests.filter(r => r.id !== requestId);
    
    updateNotificationBadge();
    renderNotifications();
    showToast('Connected! 🤝');
    
    checkConnectionAchievements();
    
  } catch (err) {
    debugLog(`Error accepting: ${err.message}`, 'error');
    showToast('Error accepting request', 'error');
  }
}

async function declineConnection(requestId) {
  try {
    await db.collection('connectionRequests').doc(requestId).update({
      status: 'declined'
    });
    
    pendingRequests = pendingRequests.filter(r => r.id !== requestId);
    updateNotificationBadge();
    renderNotifications();
    
  } catch (err) {
    showToast('Error', 'error');
  }
}

async function getPendingRequestTo(userId) {
  if (!currentUser) return null;
  try {
    const snapshot = await db.collection('connectionRequests')
      .where('from', '==', currentUser.uid)
      .where('to', '==', userId)
      .where('status', '==', 'pending')
      .get();
    return snapshot.empty ? null : snapshot.docs[0].data();
  } catch (err) {
    return null;
  }
}

// ============================================
// NOTIFICATIONS
// ============================================
function toggleNotifications() {
  const panel = document.getElementById('notificationsPanel');
  panel.classList.toggle('hidden');
  if (!panel.classList.contains('hidden')) {
    renderNotifications();
  }
}

async function renderNotifications() {
  const list = document.getElementById('notificationsList');
  
  // Combine and sort all notifications
  const allNotifications = [
    ...pendingRequests.map(r => ({ ...r, notifType: 'connection' })),
    ...badgeNotifications.map(b => ({ ...b, notifType: 'badge' }))
  ].sort((a, b) => {
    const timeA = a.timestamp?.toDate?.() || new Date(0);
    const timeB = b.timestamp?.toDate?.() || new Date(0);
    return timeB - timeA; // Most recent first
  });
  
  if (allNotifications.length === 0) {
    list.innerHTML = '<div class="notifications-empty"><div class="icon">🔔</div><p>No notifications yet</p></div>';
    return;
  }
  
  const html = await Promise.all(allNotifications.map(async (notif) => {
    if (notif.notifType === 'connection') {
      return renderConnectionNotification(notif);
    } else {
      return renderBadgeNotification(notif);
    }
  }));
  
  list.innerHTML = html.join('');
}

async function renderConnectionNotification(req) {
  // Use cached data from request, or fetch if needed
  let fromName = req.fromName || 'Someone';
  let fromAvatar = req.fromAvatar;
  
  // If no cached data, fetch user
  if (!req.fromName) {
    try {
      const userDoc = await db.collection('users').doc(req.from).get();
      if (userDoc.exists) {
        const userData = userDoc.data();
        fromName = userData.displayName || 'Someone';
        fromAvatar = userData.avatarURL || userData.photoURL;
      }
    } catch (e) {}
  }
  
  const connType = CONNECTION_TYPES[req.type] || { emoji: '🤝', name: 'Connect' };
  const avatarHtml = fromAvatar
    ? `<img src="${fromAvatar}" class="notification-avatar">`
    : `<div class="notification-avatar-placeholder">👤</div>`;
  
  return `
    <div class="notification-item" data-id="${req.id}">
      <div class="notification-clickable" onclick="viewProfileFromNotification('${req.from}')">
        ${avatarHtml}
        <div class="notification-content">
          <div class="notification-text">
            <strong>${escapeHtml(fromName)}</strong> wants to connect
            <br>${connType.emoji} ${connType.name}
          </div>
          <div class="notification-time">${timeAgo(req.timestamp?.toDate?.())}</div>
        </div>
      </div>
      <div class="notification-actions">
        <button class="accept" onclick="event.stopPropagation(); acceptConnection('${req.id}', '${req.from}', '${req.type}')">Accept</button>
        <button class="decline" onclick="event.stopPropagation(); declineConnection('${req.id}')">✗</button>
      </div>
    </div>
  `;
}

async function renderBadgeNotification(badge) {
  let fromName = badge.fromName || 'Someone';
  let fromAvatar = badge.fromAvatar;
  
  if (!badge.fromName) {
    try {
      const userDoc = await db.collection('users').doc(badge.from).get();
      if (userDoc.exists) {
        const userData = userDoc.data();
        fromName = userData.displayName || 'Someone';
        fromAvatar = userData.avatarURL || userData.photoURL;
      }
    } catch (e) {}
  }
  
  const badgeType = USER_BADGES[badge.type] || { emoji: '✨', name: 'Vibe' };
  const avatarHtml = fromAvatar
    ? `<img src="${fromAvatar}" class="notification-avatar">`
    : `<div class="notification-avatar-placeholder">👤</div>`;
  
  return `
    <div class="notification-item notification-badge" data-id="${badge.id}" onclick="handleBadgeNotificationClick('${badge.id}', '${badge.from}')">
      ${avatarHtml}
      <div class="notification-content">
        <div class="notification-text">
          <strong>${escapeHtml(fromName)}</strong> sent you a vibe
          <br><span class="badge-received">${badgeType.emoji} ${badgeType.name}</span>
        </div>
        <div class="notification-time">${timeAgo(badge.timestamp?.toDate?.())}</div>
      </div>
      <div class="notification-badge-icon">${badgeType.emoji}</div>
    </div>
  `;
}

async function handleBadgeNotificationClick(badgeId, fromUserId) {
  // Mark as read
  await markBadgeAsRead(badgeId);
  
  // Remove from local array
  badgeNotifications = badgeNotifications.filter(b => b.id !== badgeId);
  updateNotificationBadge();
  
  // Close notifications and open their profile
  toggleNotifications();
  await showGuestProfile(fromUserId);
}

function viewProfileFromNotification(userId) {
  // Close notifications and open their profile
  toggleNotifications();
  showGuestProfile(userId);
}

// ============================================
// ACHIEVEMENTS
// ============================================
async function checkAndAwardAchievement(userId, achievementKey) {
  try {
    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();
    const achievements = userDoc.data()?.achievements || [];
    
    if (!achievements.includes(achievementKey)) {
      achievements.push(achievementKey);
      await userRef.update({ achievements });
      
      if (userId === currentUser?.uid) {
        showToast(`Achievement unlocked: ${ACHIEVEMENTS[achievementKey].emoji} ${ACHIEVEMENTS[achievementKey].name}!`);
      }
    }
  } catch (err) {
    debugLog(`Error awarding achievement: ${err.message}`, 'error');
  }
}

async function checkProfileAchievements() {
  if (!currentUser || !userProfile) return;
  
  if (userProfile.avatarURL || userProfile.photoURL) {
    await checkAndAwardAchievement(currentUser.uid, 'picture_perfect');
  }
  if (userProfile.bio && userProfile.bio.length > 0) {
    await checkAndAwardAchievement(currentUser.uid, 'storyteller');
  }
}

async function checkConnectionAchievements() {
  if (!currentUser) return;
  const connectionCount = Object.keys(myConnections).length;
  if (connectionCount >= 5) {
    await checkAndAwardAchievement(currentUser.uid, 'social_butterfly');
  }
}

async function checkBadgeAchievements(userId) {
  try {
    const badges = await getReceivedBadges(userId);
    const totalBadges = Object.values(badges).reduce((sum, b) => sum + b.count, 0);
    if (totalBadges >= 10) {
      await checkAndAwardAchievement(userId, 'popular');
    }
  } catch (err) {}
}

// ============================================
// CLEANUP (call on logout)
// ============================================
function cleanupSocialState() {
  cleanupRealtimeListeners();
  guestsCache = [];
  pendingRequests = [];
  badgeNotifications = [];
  myConnections = {};
  myBadgesReceived = {};
  myBadgesGiven = {};
}


/* ============================================
   ACHIEVEMENT PROGRESS DISPLAY
   Add this to social.js to show users their
   progress toward unlocking achievements
   ============================================ */

/**
 * Get achievement progress data for display
 */
async function getAchievementProgress(userId) {
  const userDoc = await db.collection('users').doc(userId).get();
  const userData = userDoc.data() || {};
  const achievements = userData.achievements || [];
  const gameStats = userData.gameStats || {};
  const connections = userData.connections || {};
  
  // Calculate progress for each achievement
  const progress = {
    // Profile achievements
    picture_perfect: {
      ...ACHIEVEMENTS.picture_perfect,
      unlocked: achievements.includes('picture_perfect'),
      current: userData.avatarURL || userData.photoURL ? 1 : 0,
      target: 1,
      display: userData.avatarURL || userData.photoURL ? 'Done!' : 'Add photo'
    },
    storyteller: {
      ...ACHIEVEMENTS.storyteller,
      unlocked: achievements.includes('storyteller'),
      current: userData.bio?.length > 0 ? 1 : 0,
      target: 1,
      display: userData.bio?.length > 0 ? 'Done!' : 'Add bio'
    },
    
    // Social achievements
    social_butterfly: {
      ...ACHIEVEMENTS.social_butterfly,
      unlocked: achievements.includes('social_butterfly'),
      current: Object.keys(connections).length,
      target: 5,
      display: `${Object.keys(connections).length}/5 connections`
    },
    popular: {
      ...ACHIEVEMENTS.popular,
      unlocked: achievements.includes('popular'),
      current: await getTotalBadgesReceived(userId),
      target: 10,
      display: `${await getTotalBadgesReceived(userId)}/10 vibes`
    },
    
    // Game achievements
    game_master: {
      ...ACHIEVEMENTS.game_master,
      unlocked: achievements.includes('game_master'),
      current: (gameStats.gamesPlayed || []).length,
      target: 4,
      display: `${(gameStats.gamesPlayed || []).length}/4 games`
    },
    open_book: {
      ...ACHIEVEMENTS.open_book,
      unlocked: achievements.includes('open_book'),
      current: gameStats.questionsAnswered || 0,
      target: 5,
      display: `${gameStats.questionsAnswered || 0}/5 answers`
    },
    truth_seeker: {
      ...ACHIEVEMENTS.truth_seeker,
      unlocked: achievements.includes('truth_seeker'),
      current: gameStats.truthsChosen || 0,
      target: 5,
      display: `${gameStats.truthsChosen || 0}/5 truths`
    },
    daredevil: {
      ...ACHIEVEMENTS.daredevil,
      unlocked: achievements.includes('daredevil'),
      current: gameStats.daresCompleted || 0,
      target: 5,
      display: `${gameStats.daresCompleted || 0}/5 dares`
    },
    honest_soul: {
      ...ACHIEVEMENTS.honest_soul,
      unlocked: achievements.includes('honest_soul'),
      current: gameStats.nhieConfessions || 0,
      target: 5,
      display: `${gameStats.nhieConfessions || 0}/5 confessions`
    }
  };
  
  return progress;
}

async function getTotalBadgesReceived(userId) {
  try {
    const snapshot = await db.collection('badges').where('to', '==', userId).get();
    return snapshot.size;
  } catch (err) {
    return 0;
  }
}

/**
 * Render achievement progress HTML
 */
function renderAchievementProgress(progress) {
  const items = Object.entries(progress).map(([key, ach]) => {
    const pct = Math.min(100, Math.round((ach.current / ach.target) * 100));
    return `
      <div class="achievement-progress-item ${ach.unlocked ? 'unlocked' : ''}">
        <span class="progress-icon">${ach.emoji}</span>
        <div class="progress-info">
          <div class="progress-name">${ach.name}</div>
          <div class="progress-bar-container">
            <div class="progress-bar" style="width: ${pct}%"></div>
          </div>
        </div>
        <span class="progress-text">${ach.unlocked ? '✓' : ach.display}</span>
      </div>
    `;
  }).join('');
  
  return `
    <div class="achievement-progress">
      <div class="achievement-progress-title">Achievement Progress</div>
      ${items}
    </div>
  `;
}

/* ============================================
   UPDATE showGuestProfile() FOR OWN PROFILE
   
   In the isOwnProfile section, after the
   achievements display, add:
   ============================================ */

// Add this code in showGuestProfile() after the achievements section
// for the user's own profile:

/*
// Show achievement progress (own profile only)
if (isOwnProfile) {
  const progress = await getAchievementProgress(guestId);
  html += `
    <div class="profile-section">
      ${renderAchievementProgress(progress)}
    </div>
  `;
}
*/

/* ============================================
   ENHANCED ACHIEVEMENT TOAST
   
   Update checkAndAwardAchievement() to show
   a special toast for achievements
   ============================================ */

async function checkAndAwardAchievement(userId, achievementKey) {
  try {
    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();
    const achievements = userDoc.data()?.achievements || [];
    
    if (!achievements.includes(achievementKey)) {
      achievements.push(achievementKey);
      await userRef.update({ achievements });
      
      if (userId === currentUser?.uid) {
        const ach = ACHIEVEMENTS[achievementKey];
        // Show enhanced achievement toast
        showAchievementToast(ach);
      }
    }
  } catch (err) {
    debugLog(`Error awarding achievement: ${err.message}`, 'error');
  }
}

function showAchievementToast(achievement) {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = 'toast achievement';
  toast.innerHTML = `
    <span style="font-size: 1.5rem; margin-right: 0.5rem;">${achievement.emoji}</span>
    <div>
      <div style="font-weight: 700;">Achievement Unlocked!</div>
      <div style="font-size: 0.85rem; opacity: 0.9;">${achievement.name}</div>
    </div>
  `;
  
  container.appendChild(toast);
  
  // Play a subtle animation
  toast.style.animation = 'slideIn 0.3s ease, pulse 0.5s ease 0.3s';
  
  setTimeout(() => {
    toast.style.animation = 'slideOut 0.3s ease forwards';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

/* ============================================
   OPTIONAL: Game Stats Quick View
   
   Add this to show game stats on own profile
   ============================================ */

function renderGameStatsQuickView(gameStats) {
  const stats = [
    { icon: '💭', value: gameStats.questionsAnswered || 0, label: 'Answers' },
    { icon: '⚖️', value: gameStats.wyrVotes || 0, label: 'WYR Votes' },
    { icon: '🍷', value: gameStats.nhieConfessions || 0, label: 'Confessions' },
    { icon: '🔮', value: gameStats.truthsChosen || 0, label: 'Truths' },
    { icon: '⚡', value: gameStats.daresCompleted || 0, label: 'Dares Done' }
  ];
  
  return `
    <div class="profile-section">
      <div class="profile-section-title">Your Game Stats</div>
      <div class="profile-game-stats">
        ${stats.map(s => `
          <div class="profile-game-stat">
            <span class="stat-icon">${s.icon}</span>
            <div class="stat-info">
              <span class="stat-value">${s.value}</span>
              <span class="stat-label">${s.label}</span>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}