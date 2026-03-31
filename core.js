/* ============================================
   CORE.JS
   Firebase, State, Utils, Auth, Navigation,
   Profile, Consent, Landing, Particles
   ============================================ */

// ============================================
// FIREBASE CONFIG & INIT
// ============================================
var firebaseConfigToUse;
try {
  if (typeof firebaseConfig !== 'undefined' && firebaseConfig.projectId) {
    firebaseConfigToUse = firebaseConfig;
  } else {
    throw new Error('No valid config');
  }
} catch (e) {
  console.warn('Using fallback Firebase config');
  firebaseConfigToUse = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
  };
}

let app, auth, db, storage;
try {
  app = firebase.initializeApp(firebaseConfigToUse);
  auth = firebase.auth();
  db = firebase.firestore();
  storage = firebase.storage();
  debugLog('Firebase initialized successfully', 'success');
} catch (initError) {
  debugLog(`Firebase init error: ${initError.message}`, 'error');
}

// ============================================
// APP STATE
// ============================================
let currentUser = null;
let userProfile = null;
let isAdmin = false;
let appSettings = {};
let pendingAvatarFile = null;
let countdownInterval = null;

// ============================================
// UTILITIES
// ============================================
function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

function setLoading(show) {
  document.getElementById('loadingOverlay').classList.toggle('hidden', !show);
}

function hideAllPages() {
  document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function timeAgo(date) {
  if (!date) return '';
  const seconds = Math.floor((new Date() - date) / 1000);
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

// ============================================
// AUTHENTICATION
// ============================================
function switchAuthTab(tab) {
  document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
  document.querySelector(`.auth-tab:${tab === 'login' ? 'first' : 'last'}-child`).classList.add('active');
  document.getElementById('loginForm').classList.toggle('hidden', tab !== 'login');
  document.getElementById('signupForm').classList.toggle('hidden', tab !== 'signup');
  document.getElementById('authError').classList.add('hidden');
}

function showAuthError(message) {
  const el = document.getElementById('authError');
  el.textContent = message;
  el.classList.remove('hidden');
}

async function handleSignup(e) {
  e.preventDefault();
  const name = document.getElementById('signupName').value.trim();
  const email = document.getElementById('signupEmail').value.trim();
  const password = document.getElementById('signupPassword').value;
  const btn = document.getElementById('signupBtn');
  btn.disabled = true;
  btn.textContent = 'Creating account...';
  try {
    const cred = await auth.createUserWithEmailAndPassword(email, password);
    await db.collection('users').doc(cred.user.uid).set({
      displayName: name,
      email: email,
      hasConsented: false,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    showToast('Account created! Welcome 🎉');
    await handleAuthenticatedUser(cred.user);
  } catch (err) {
    showAuthError(err.message);
    btn.disabled = false;
    btn.textContent = 'Create Account';
  }
}

async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  const btn = document.getElementById('loginBtn');
  btn.disabled = true;
  btn.textContent = 'Signing in...';
  try {
    const cred = await auth.signInWithEmailAndPassword(email, password);
    showToast('Welcome back! ✨');
    await handleAuthenticatedUser(cred.user);
  } catch (err) {
    showAuthError(err.message);
    btn.disabled = false;
    btn.textContent = 'Sign In';
  }
}

async function handleGuestLogin() {
  const btn = document.getElementById('guestBtn');
  btn.disabled = true;
  btn.textContent = 'Joining...';
  try {
    const cred = await auth.signInAnonymously();
    await db.collection('users').doc(cred.user.uid).set({
      displayName: '',
      isGuest: true,
      hasConsented: false,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    showToast('Welcome, mysterious guest! 🎭');
    await handleAuthenticatedUser(cred.user);
  } catch (err) {
    showAuthError(err.message);
    btn.disabled = false;
    btn.textContent = 'Continue as Guest';
  }
}

function resetGoogleButtonState() {
  debugLog('🔵 resetGoogleButtonState() called', 'info');
  const googleBtn = document.getElementById('googleBtn');
  if (googleBtn) {
    googleBtn.disabled = false;
    googleBtn.textContent = 'Sign in with Google';
    debugLog('✅ Google button reset to enabled state', 'success');
  } else {
    debugLog('⚠️ Google button element not found', 'warn');
  }
}

async function handleGoogleLogin() {
  const btn = document.getElementById('googleBtn');

  // Detect if mobile device
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

  // On mobile, show a message instead of attempting login
  if (isMobile) {
    showToast('Google sign-in is only supported on desktop. Please use email/password on mobile.', 'info');
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Opening Google...';

  const provider = new firebase.auth.GoogleAuthProvider();

  try {
    const result = await auth.signInWithPopup(provider);
    await createOrUpdateUserProfile(result.user);
    await handleAuthenticatedUser(result.user);
  } catch (error) {
    let errorMsg = 'Sign in failed. Please try again.';

    if (error.code === 'auth/popup-blocked') {
      errorMsg = 'Popup was blocked. Please allow popups for this site.';
    } else if (error.code === 'auth/popup-closed-by-user') {
      errorMsg = 'Sign in was cancelled.';
    } else if (error.code === 'auth/unauthorized-domain') {
      errorMsg = 'This domain is not authorized. Please contact the administrator.';
    }

    showAuthError(errorMsg);
    btn.disabled = false;
    btn.textContent = 'Sign in with Google';
  }
}

async function createOrUpdateUserProfile(user) {
  debugLog(`🔵 createOrUpdateUserProfile() called for user ${user.uid}`, 'info');
  const userDoc = await db.collection('users').doc(user.uid).get();

  if (!userDoc.exists) {
    // New user - create profile
    debugLog('🔵 New user detected - creating profile', 'info');
    const profileData = {
      displayName: user.displayName || '',
      email: user.email,
      photoURL: user.photoURL || '',
      avatarURL: '',
      hasConsented: false,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    // Try to download and re-upload Google avatar to avoid CORS issues
    if (user.photoURL) {
      debugLog('🔵 Attempting to download and upload Google avatar', 'info');
      try {
        const downloadedAvatarURL = await downloadAndUploadGoogleAvatar(user.uid, user.photoURL);
        if (downloadedAvatarURL) {
          profileData.avatarURL = downloadedAvatarURL;
          profileData.photoURL = ''; // Clear the problematic Google URL
          debugLog('✅ Successfully uploaded Google avatar to Firebase Storage', 'success');
        }
      } catch (err) {
        debugLog(`⚠️ Failed to download Google avatar: ${err.message}`, 'warn');
        // Keep the photoURL anyway, but it might not load
      }
    }

    await db.collection('users').doc(user.uid).set(profileData);
    debugLog('✅ New user profile created in Firestore', 'success');
    showToast('Welcome to the party! 🎉');
  } else {
    // Existing user - update last login
    debugLog('🔵 Existing user detected - updating last login', 'info');
    const existingData = userDoc.data();
    const updateData = { lastLogin: firebase.firestore.FieldValue.serverTimestamp() };

    // If user has no custom avatar but has a Google photo, try to download it
    if (!existingData.avatarURL && user.photoURL && user.photoURL !== existingData.photoURL) {
      debugLog('🔵 Attempting to download and upload Google avatar', 'info');
      try {
        const downloadedAvatarURL = await downloadAndUploadGoogleAvatar(user.uid, user.photoURL);
        if (downloadedAvatarURL) {
          updateData.avatarURL = downloadedAvatarURL;
          updateData.photoURL = '';
          debugLog('✅ Successfully uploaded Google avatar to Firebase Storage', 'success');
        }
      } catch (err) {
        debugLog(`⚠️ Failed to download Google avatar: ${err.message}`, 'warn');
        updateData.photoURL = user.photoURL;
      }
    }

    await db.collection('users').doc(user.uid).update(updateData);
    debugLog('✅ User profile updated in Firestore', 'success');
    showToast('Welcome back! ✨');
  }
  debugLog('✅ createOrUpdateUserProfile() completed', 'success');
}

async function downloadAndUploadGoogleAvatar(uid, photoURL) {
  if (!photoURL || !storage) return null;

  try {
    // Fetch the image as a blob
    const response = await fetch(photoURL);
    if (!response.ok) throw new Error('Failed to fetch avatar');

    const blob = await response.blob();

    // Upload to Firebase Storage
    const userIdEncoded = `firebase_${uid}`;
    const storagePath = `avatars/${userIdEncoded}/public/google_avatar.jpg`;
    const storageRef = storage.ref(storagePath);

    await storageRef.put(blob, {
      contentType: 'image/jpeg',
      customMetadata: {
        source: 'google_oauth'
      }
    });

    return await storageRef.getDownloadURL();
  } catch (err) {
    debugLog(`Avatar download error: ${err.message}`, 'error');
    return null;
  }
}

async function handleLogout() {
  await auth.signOut();
  showToast('See you next time! 👋');
}

async function handleAuthenticatedUser(user) {
  debugLog(`🔵 handleAuthenticatedUser() called for user ${user.uid}`, 'info');
  currentUser = user;
  setLoading(true);
  debugLog('🔵 Loading screen shown, loading user data...', 'info');
  try {
    await loadUserProfile(user.uid);
    debugLog(`🔵 User profile loaded: ${userProfile ? 'success' : 'null'}`, userProfile ? 'success' : 'warn');
    await checkAdminStatus();
    debugLog(`🔵 Admin status checked: isAdmin=${isAdmin}`, 'info');
    await loadAllGameData();
    debugLog('🔵 Game data loaded', 'info');
    await loadUserBadgesAndConnections();
    debugLog('🔵 Badges and connections loaded', 'info');
    checkProfileAchievements();
    debugLog('🔵 Profile achievements checked', 'info');
  } catch (err) {
    debugLog(`❌ Error loading data: ${err.message}`, 'error');
  }
  setLoading(false);
  debugLog('🔵 Loading screen hidden, navigating to landing page', 'info');
  showPage('landing');
  debugLog('✅ handleAuthenticatedUser() completed - user should see landing page', 'success');
}

// ============================================
// USER PROFILE
// ============================================
async function loadUserProfile(uid) {
  try {
    const doc = await db.collection('users').doc(uid).get();
    userProfile = doc.exists ? { id: doc.id, ...doc.data() } : null;
  } catch (err) {
    userProfile = null;
  }
}

function handleAvatarSelect(event) {
  const file = event.target.files[0];
  if (!file || !file.type.startsWith('image/') || file.size > 5 * 1024 * 1024) {
    showToast('Invalid image', 'error');
    return;
  }
  pendingAvatarFile = file;
  const reader = new FileReader();
  reader.onload = (e) => {
    document.getElementById('avatarPreview').src = e.target.result;
    document.getElementById('avatarPreview').classList.remove('hidden');
    document.getElementById('avatarPlaceholder').classList.add('hidden');
  };
  reader.readAsDataURL(file);
}

async function uploadAvatar(file) {
  if (!currentUser || !file || !storage) return null;
  const userDidEncoded = `firebase_${currentUser.uid}`;
  const fileExt = file.name.split('.').pop() || 'jpg';
  const storagePath = `avatars/${userDidEncoded}/public/avatar.${fileExt}`;
  const storageRef = storage.ref(storagePath);
  const progressBar = document.getElementById('avatarProgressBar');
  document.getElementById('avatarProgress').classList.remove('hidden');
  document.getElementById('avatarUploadBtn').classList.add('uploading');
  try {
    const uploadTask = storageRef.put(file);
    uploadTask.on('state_changed', (snapshot) => {
      progressBar.style.width = `${(snapshot.bytesTransferred / snapshot.totalBytes) * 100}%`;
    });
    await uploadTask;
    const downloadURL = await storageRef.getDownloadURL();
    document.getElementById('avatarProgress').classList.add('hidden');
    document.getElementById('avatarUploadBtn').classList.remove('uploading');
    return downloadURL;
  } catch (err) {
    document.getElementById('avatarProgress').classList.add('hidden');
    document.getElementById('avatarUploadBtn').classList.remove('uploading');
    showToast('Upload failed', 'error');
    return null;
  }
}

async function saveProfile() {
  const name = document.getElementById('displayNameInput').value.trim();
  const bio = document.getElementById('bioInput').value.trim();
  const isVisible = document.getElementById('isVisibleInput').checked;
  if (!currentUser || !name) {
    showToast('Please enter a name', 'error');
    return;
  }
  try {
    let avatarURL = userProfile?.avatarURL || null;
    if (pendingAvatarFile) {
      avatarURL = await uploadAvatar(pendingAvatarFile);
      pendingAvatarFile = null;
    }
    const updateData = {
      displayName: name,
      bio,
      isVisible,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    if (avatarURL) updateData.avatarURL = avatarURL;
    const userRef = db.collection('users').doc(currentUser.uid);
    const userDoc = await userRef.get();
    if (userDoc.exists) {
      await userRef.update(updateData);
    } else {
      await userRef.set({
        email: currentUser.email || '',
        hasConsented: userProfile?.hasConsented || false,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        ...updateData
      });
    }
    userProfile = { ...userProfile, displayName: name, bio, isVisible, avatarURL: avatarURL || userProfile?.avatarURL };
    showToast('Profile updated! ✨');
    setupLounge();
    updateNavAvatar();
    checkProfileAchievements();
  } catch (err) {
    showToast('Error saving profile', 'error');
  }
}

function updateNavAvatar() {
  const navAvatar = document.getElementById('navAvatar');
  const navAvatarMobile = document.getElementById('navAvatarMobile');
  const avatarURL = userProfile?.avatarURL || userProfile?.photoURL;

  if (avatarURL) {
    // Set up error handlers before setting src
    navAvatar.onerror = handleAvatarError;
    navAvatar.src = avatarURL;
    navAvatar.classList.remove('hidden');

    if (navAvatarMobile) {
      navAvatarMobile.onerror = handleAvatarError;
      navAvatarMobile.src = avatarURL;
      navAvatarMobile.classList.remove('hidden');
    }
  } else {
    navAvatar.classList.add('hidden');
    if (navAvatarMobile) navAvatarMobile.classList.add('hidden');
  }
}

function handleAvatarError(event) {
  debugLog('Avatar failed to load, hiding image', 'warn');
  event.target.classList.add('hidden');
  // If this was a Google photoURL that failed, clear it from the profile
  if (userProfile?.photoURL && !userProfile?.avatarURL) {
    debugLog('Google avatar failed to load. Please upload a custom avatar.', 'warn');
  }
}

// ============================================
// CONSENT
// ============================================
function enterParty() {
  debugLog('enterParty() called', 'info');
  if (!userProfile?.hasConsented) {
    debugLog('Showing consent modal', 'info');
    document.getElementById('consentModal').classList.remove('hidden');
  } else {
    debugLog('Navigating to lounge', 'info');
    showPage('lounge');
  }
}

async function acceptConsent() {
  if (!currentUser) return;
  try {
    const userRef = db.collection('users').doc(currentUser.uid);
    const userDoc = await userRef.get();
    if (userDoc.exists) {
      await userRef.update({ hasConsented: true });
    } else {
      await userRef.set({
        displayName: currentUser.displayName || '',
        email: currentUser.email || '',
        hasConsented: true,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    }
    if (userProfile) userProfile.hasConsented = true;
    else userProfile = { id: currentUser.uid, hasConsented: true };
    document.getElementById('consentModal').classList.add('hidden');
    showPage('lounge');
  } catch (err) {
    showToast('Error saving consent', 'error');
  }
}

// ============================================
// PAGE NAVIGATION
// ============================================
function showPage(pageName) {
  debugLog(`🔵 showPage('${pageName}') called`, 'info');
  hideAllPages();
  if (pageName !== 'landing') stopCountdown();
  const page = document.getElementById(`page-${pageName}`);
  if (page) {
    page.classList.remove('hidden');
    debugLog(`✅ Page '${pageName}' is now visible`, 'success');
  } else {
    debugLog(`⚠️ Page element 'page-${pageName}' not found`, 'warn');
  }
  const navbar = document.getElementById('navbar');
  navbar.classList.toggle('hidden', pageName === 'landing' || pageName === 'auth');
  if (userProfile?.displayName) document.getElementById('navUserName').textContent = userProfile.displayName;
  updateNavAvatar();
  if (pageName === 'landing') updateLandingPage();
  if (pageName === 'lounge') setupLounge();
  if (pageName === 'guests') setupGuests();
  if (pageName === 'games') setupGames();
  if (pageName === 'admin') setupAdmin();
  window.scrollTo(0, 0);
}

// ============================================
// LOUNGE
// ============================================
function setupLounge() {
  const profileCard = document.getElementById('profile-card');
  const activityCards = document.getElementById('activity-cards');
  const greeting = document.getElementById('greeting');
  const loungeAvatar = document.getElementById('loungeAvatar');
  const editProfileBtn = document.getElementById('editProfileBtn');
  const displayName = userProfile?.displayName || '';
  const avatarURL = userProfile?.avatarURL || userProfile?.photoURL;

  if (avatarURL) {
    loungeAvatar.onerror = handleAvatarError;
    loungeAvatar.src = avatarURL;
    loungeAvatar.classList.remove('hidden');
  } else {
    loungeAvatar.classList.add('hidden');
  }

  if (displayName) {
    profileCard.classList.add('hidden');
    activityCards.classList.remove('hidden');
    greeting.textContent = `Good evening, ${displayName} ✧`;
    editProfileBtn.classList.remove('hidden');
  } else {
    profileCard.classList.remove('hidden');
    activityCards.classList.add('hidden');
    greeting.textContent = '';
    editProfileBtn.classList.add('hidden');
    document.getElementById('bioInput').value = userProfile?.bio || '';
    document.getElementById('isVisibleInput').checked = userProfile?.isVisible !== false;
    if (avatarURL) {
      const avatarPreview = document.getElementById('avatarPreview');
      avatarPreview.onerror = handleAvatarError;
      avatarPreview.src = avatarURL;
      avatarPreview.classList.remove('hidden');
      document.getElementById('avatarPlaceholder').classList.add('hidden');
    }
  }
}

function showEditProfile() {
  const avatarURL = userProfile?.avatarURL || userProfile?.photoURL;
  document.getElementById('displayNameInput').value = userProfile?.displayName || '';
  document.getElementById('bioInput').value = userProfile?.bio || '';
  document.getElementById('isVisibleInput').checked = userProfile?.isVisible !== false;
  if (avatarURL) {
    const avatarPreview = document.getElementById('avatarPreview');
    avatarPreview.onerror = handleAvatarError;
    avatarPreview.src = avatarURL;
    avatarPreview.classList.remove('hidden');
    document.getElementById('avatarPlaceholder').classList.add('hidden');
  } else {
    document.getElementById('avatarPreview').classList.add('hidden');
    document.getElementById('avatarPlaceholder').classList.remove('hidden');
  }
  document.getElementById('profile-card').classList.remove('hidden');
  document.getElementById('activity-cards').classList.add('hidden');
  document.getElementById('editProfileBtn').classList.add('hidden');
}

// ============================================
// LANDING PAGE & COUNTDOWN
// ============================================
function updateLandingPage() {
  const titleEl = document.getElementById('landingTitle');
  if (appSettings.eventName) {
    const words = appSettings.eventName.split(' ');
    if (words.length > 2) {
      titleEl.innerHTML = `${escapeHtml(words.slice(0, Math.ceil(words.length / 2)).join(' '))}<br><span>${escapeHtml(words.slice(Math.ceil(words.length / 2)).join(' '))}</span>`;
    } else {
      titleEl.innerHTML = `<span>${escapeHtml(appSettings.eventName)}</span>`;
    }
  }
  if (appSettings.eventTagline) document.getElementById('landingTagline').textContent = appSettings.eventTagline;
  
  const countdownContainer = document.getElementById('countdownContainer');
  const dateEl = document.getElementById('landingDate');
  if (appSettings.eventDate) {
    const eventDate = new Date(appSettings.eventDate);
    dateEl.textContent = `${eventDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })} · ${eventDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
    countdownContainer.style.display = 'block';
    startCountdown(eventDate);
  } else {
    countdownContainer.style.display = 'none';
    dateEl.textContent = 'Date TBA';
  }
}

function startCountdown(eventDate) {
  if (countdownInterval) clearInterval(countdownInterval);
  const updateCountdown = () => {
    const now = new Date();
    const diff = eventDate - now;
    const container = document.getElementById('countdownDisplay');
    if (diff > 0) {
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      container.innerHTML = `<div class="countdown-label">The party begins in</div><div class="countdown">${days > 0 ? `<div class="countdown-item"><div class="countdown-value">${days}</div><div class="countdown-unit">Day${days !== 1 ? 's' : ''}</div></div>` : ''}<div class="countdown-item"><div class="countdown-value">${String(hours).padStart(2, '0')}</div><div class="countdown-unit">Hours</div></div><div class="countdown-item"><div class="countdown-value">${String(minutes).padStart(2, '0')}</div><div class="countdown-unit">Min</div></div><div class="countdown-item"><div class="countdown-value">${String(seconds).padStart(2, '0')}</div><div class="countdown-unit">Sec</div></div></div>`;
    } else if (diff > -6 * 60 * 60 * 1000) {
      container.innerHTML = `<div class="countdown-live"><span class="countdown-live-dot"></span>The party is happening now!</div>`;
    } else {
      container.innerHTML = `<div class="countdown-ended">Thank you for joining us ✨</div>`;
      clearInterval(countdownInterval);
    }
  };
  updateCountdown();
  countdownInterval = setInterval(updateCountdown, 1000);
}

function stopCountdown() {
  if (countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }
}

// ============================================
// ADMIN STATUS & SETTINGS
// ============================================
async function checkAdminStatus() {
  if (!currentUser || !currentUser.email) {
    isAdmin = false;
    return;
  }
  try {
    await loadSettings();
    const adminEmails = appSettings.adminEmails || [];
    isAdmin = adminEmails.some(email => email.toLowerCase().trim() === currentUser.email.toLowerCase());
    document.getElementById('adminNavLink').style.display = isAdmin ? 'inline' : 'none';
  } catch (err) {
    isAdmin = false;
  }
}

async function loadSettings() {
  try {
    const doc = await db.collection('config').doc('settings').get();
    appSettings = doc.exists ? doc.data() : {
      eventName: 'The Velvet Winter Lounge',
      eventTagline: 'An evening of warmth, connection & playful elegance',
      eventDate: null,
      adminEmails: [currentUser?.email || '']
    };
  } catch (err) {
    appSettings = {};
  }
}

// ============================================
// PARTICLES
// ============================================
function createParticles() {
  const container = document.getElementById('particles');
  for (let i = 0; i < 25; i++) {
    const particle = document.createElement('div');
    particle.className = 'particle';
    particle.style.left = `${Math.random() * 100}%`;
    particle.style.animationDelay = `${Math.random() * 15}s`;
    particle.style.animationDuration = `${15 + Math.random() * 10}s`;
    container.appendChild(particle);
  }
}

// ============================================
// INIT & AUTH STATE
// ============================================
let authStateReceived = false;

// Initialize authentication
setLoading(true);

// Set up auth state listener
auth.onAuthStateChanged(async (user) => {
  authStateReceived = true;

  if (user) {
    await handleAuthenticatedUser(user);
  } else {
    currentUser = null;
    userProfile = null;
    setLoading(false);
    showPage('auth');
  }
});

// Initialize particles
createParticles();

// Event listeners
document.getElementById('displayNameInput')?.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') saveProfile();
});


// ============================================
// MOBILE NAVIGATION
// Add these functions to core.js
// ============================================

function toggleMobileMenu() {
  const drawer = document.getElementById('navDrawer');
  const overlay = document.getElementById('navDrawerOverlay');
  
  drawer.classList.toggle('active');
  overlay.classList.toggle('active');
  
  // Prevent body scroll when menu is open
  document.body.style.overflow = drawer.classList.contains('active') ? 'hidden' : '';
}

function closeMobileMenu() {
  const drawer = document.getElementById('navDrawer');
  const overlay = document.getElementById('navDrawerOverlay');
  
  drawer.classList.remove('active');
  overlay.classList.remove('active');
  document.body.style.overflow = '';
}

function navigateFromDrawer(page) {
  closeMobileMenu();
  showPage(page);
}

// ============================================
// UPDATE: Sync mobile notification badge
// Add this to your updateNotificationBadge function in social.js
// or call it from there
// ============================================

function syncMobileNotificationBadge() {
  const desktopBadge = document.getElementById('notifBadge');
  const mobileBadge = document.getElementById('notifBadgeMobile');
  
  if (desktopBadge && mobileBadge) {
    mobileBadge.textContent = desktopBadge.textContent;
    mobileBadge.className = desktopBadge.className;
  }
}

// ============================================
// UPDATE: Sync mobile avatar
// Call this wherever you update navAvatar
// ============================================

function syncMobileAvatar() {
  const desktopAvatar = document.getElementById('navAvatar');
  const mobileAvatar = document.getElementById('navAvatarMobile');
  
  if (desktopAvatar && mobileAvatar) {
    mobileAvatar.src = desktopAvatar.src;
    mobileAvatar.className = desktopAvatar.className.replace('nav-avatar', 'nav-avatar-mobile');
  }
}

// ============================================
// UPDATE: Show admin link in drawer too
// Add this to wherever you show/hide adminNavLink
// ============================================

function updateAdminVisibility(isAdmin) {
  const desktopLink = document.getElementById('adminNavLink');
  const drawerLink = document.getElementById('adminDrawerLink');
  
  if (desktopLink) desktopLink.style.display = isAdmin ? 'block' : 'none';
  if (drawerLink) drawerLink.style.display = isAdmin ? 'block' : 'none';
}

// ============================================
// Close menu on escape key
// ============================================

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeMobileMenu();
  }
});

// ============================================
// Close menu on window resize to desktop
// ============================================

window.addEventListener('resize', () => {
  if (window.innerWidth > 768) {
    closeMobileMenu();
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeGuestModal();
    closeEditModal();
    document.getElementById('consentModal').classList.add('hidden');
    document.getElementById('notificationsPanel').classList.add('hidden');
  }
});

// Close notifications when clicking outside
document.addEventListener('click', (e) => {
  const panel = document.getElementById('notificationsPanel');
  const btn = document.querySelector('.notifications-btn');
  if (!panel.classList.contains('hidden') && !panel.contains(e.target) && !btn.contains(e.target)) {
    panel.classList.add('hidden');
  }
});

// Fallback timeout - only as a safety net for edge cases
setTimeout(() => {
  if (!authStateReceived) {
    debugLog('⚠️ TIMEOUT: No auth state received after 5s, showing auth page', 'warn');
    setLoading(false);
    showPage('auth');
  }
}, 5000);