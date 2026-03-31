/* ============================================
   ADMIN.JS
   Admin Panel, CRUD Operations, Settings,
   Edit Modal
   ============================================ */

// ============================================
// STATE
// ============================================
let editingItem = null;

// ============================================
// ADMIN SETUP
// ============================================
function setupAdmin() {
  if (!isAdmin) {
    showPage('lounge');
    showToast('Admin required', 'error');
    return;
  }
  renderAdminQuestions();
  renderAdminWYR();
  renderAdminNHIE();
  renderAdminTruths();
  renderAdminChallenges();
  populateSettingsForm();
}

function switchAdminTab(tab) {
  document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
  document.querySelector(`.admin-tab[onclick*="${tab}"]`).classList.add('active');
  document.querySelectorAll('.admin-panel').forEach(p => p.classList.remove('active'));
  document.getElementById(`admin-${tab}`).classList.add('active');
}

// ============================================
// SETTINGS
// ============================================
function populateSettingsForm() {
  document.getElementById('settingsEventName').value = appSettings.eventName || '';
  document.getElementById('settingsEventTagline').value = appSettings.eventTagline || '';
  if (appSettings.eventDate) {
    document.getElementById('settingsEventDate').value = new Date(appSettings.eventDate).toISOString().slice(0, 16);
  }
  document.getElementById('settingsAdminEmails').value = (appSettings.adminEmails || []).join(', ');
}

async function saveSettings() {
  if (!isAdmin) {
    showToast('Admin required', 'error');
    return;
  }
  try {
    const eventName = document.getElementById('settingsEventName').value.trim();
    const eventTagline = document.getElementById('settingsEventTagline').value.trim();
    const eventDateInput = document.getElementById('settingsEventDate').value;
    const adminEmailsInput = document.getElementById('settingsAdminEmails').value;
    const adminEmails = adminEmailsInput.split(',').map(e => e.trim().toLowerCase()).filter(e => e.length > 0);
    
    const settings = {
      eventName: eventName || 'The Velvet Winter Lounge',
      eventTagline: eventTagline || 'An evening of warmth, connection & playful elegance',
      eventDate: eventDateInput ? new Date(eventDateInput).toISOString() : null,
      adminEmails,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    await db.collection('config').doc('settings').set(settings, { merge: true });
    appSettings = settings;
    showToast('Settings saved! ✨');
    updateLandingPage();
  } catch (err) {
    showToast('Error saving settings', 'error');
  }
}

// ============================================
// RENDER ADMIN LISTS
// ============================================
function renderAdminQuestions() {
  const list = document.getElementById('questionsAdminList');
  if (questions.length === 0) {
    list.innerHTML = '<div class="admin-empty">No questions yet. Add one below!</div>';
    return;
  }
  list.innerHTML = questions.map((q, i) => `
    <div class="admin-item">
      <span class="admin-item-order">${i + 1}</span>
      <span class="admin-item-text">${escapeHtml(q.text)}</span>
      <div class="admin-item-actions">
        <button class="admin-item-btn" onclick="editItem('question', '${q.id}')">✎</button>
        <button class="admin-item-btn delete" onclick="deleteQuestion('${q.id}')">×</button>
      </div>
    </div>
  `).join('');
}

function renderAdminWYR() {
  const list = document.getElementById('wyrAdminList');
  if (wouldYouRatherData.length === 0) {
    list.innerHTML = '<div class="admin-empty">No dilemmas yet. Add one below!</div>';
    return;
  }
  list.innerHTML = wouldYouRatherData.map((item, i) => `
    <div class="admin-item">
      <span class="admin-item-order">${i + 1}</span>
      <span class="admin-item-text">
        <strong style="color:var(--champagne)">A:</strong> ${escapeHtml(item.optionA)}<br>
        <strong style="color:var(--rose)">B:</strong> ${escapeHtml(item.optionB)}
      </span>
      <div class="admin-item-actions">
        <button class="admin-item-btn" onclick="editWYR('${item.id}')">✎</button>
        <button class="admin-item-btn delete" onclick="deleteWYR('${item.id}')">×</button>
      </div>
    </div>
  `).join('');
}

function renderAdminNHIE() {
  const list = document.getElementById('nhieAdminList');
  if (neverHaveIEverData.length === 0) {
    list.innerHTML = '<div class="admin-empty">No statements yet. Add one below!</div>';
    return;
  }
  list.innerHTML = neverHaveIEverData.map((item, i) => `
    <div class="admin-item">
      <span class="admin-item-order">${i + 1}</span>
      <span class="admin-item-text">Never have I ever <em>${escapeHtml(item.statement)}</em></span>
      <div class="admin-item-actions">
        <button class="admin-item-btn" onclick="editItem('nhie', '${item.id}')">✎</button>
        <button class="admin-item-btn delete" onclick="deleteNHIE('${item.id}')">×</button>
      </div>
    </div>
  `).join('');
}

function renderAdminTruths() {
  const list = document.getElementById('truthsAdminList');
  if (truthsData.length === 0) {
    list.innerHTML = '<div class="admin-empty">No truths yet. Add one below!</div>';
    return;
  }
  list.innerHTML = truthsData.map((item, i) => `
    <div class="admin-item">
      <span class="admin-item-order">${i + 1}</span>
      <span class="admin-item-text">${escapeHtml(item.text)}</span>
      <div class="admin-item-actions">
        <button class="admin-item-btn" onclick="editItem('truth', '${item.id}')">✎</button>
        <button class="admin-item-btn delete" onclick="deleteTruth('${item.id}')">×</button>
      </div>
    </div>
  `).join('');
}

function renderAdminChallenges() {
  const list = document.getElementById('challengesAdminList');
  if (challenges.length === 0) {
    list.innerHTML = '<div class="admin-empty">No dares yet. Add one below!</div>';
    return;
  }
  list.innerHTML = challenges.map((c, i) => `
    <div class="admin-item">
      <span class="admin-item-order">${i + 1}</span>
      <span class="admin-item-text">${escapeHtml(c.text)}</span>
      <div class="admin-item-actions">
        <button class="admin-item-btn" onclick="editItem('challenge', '${c.id}')">✎</button>
        <button class="admin-item-btn delete" onclick="deleteChallenge('${c.id}')">×</button>
      </div>
    </div>
  `).join('');
}

// ============================================
// ADD ITEMS
// ============================================
async function addQuestion() {
  const text = document.getElementById('newQuestionInput').value.trim();
  if (!text) {
    showToast('Please enter a question', 'error');
    return;
  }
  try {
    const docRef = await db.collection('questions').add({
      text,
      order: questions.length,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    questions.push({ id: docRef.id, text, order: questions.length });
    document.getElementById('newQuestionInput').value = '';
    renderAdminQuestions();
    showToast('Question added! 💭');
  } catch (err) {
    showToast('Error adding question', 'error');
  }
}

async function addWYR() {
  const optionA = document.getElementById('newWyrOptionA').value.trim();
  const optionB = document.getElementById('newWyrOptionB').value.trim();
  if (!optionA || !optionB) {
    showToast('Please fill both options', 'error');
    return;
  }
  try {
    const docRef = await db.collection('wouldYouRather').add({
      optionA,
      optionB,
      order: wouldYouRatherData.length,
      stats: { A: 0, B: 0 },
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    wouldYouRatherData.push({ id: docRef.id, optionA, optionB, order: wouldYouRatherData.length, stats: { A: 0, B: 0 } });
    document.getElementById('newWyrOptionA').value = '';
    document.getElementById('newWyrOptionB').value = '';
    renderAdminWYR();
    showToast('Dilemma added! ⚖️');
  } catch (err) {
    showToast('Error adding', 'error');
  }
}

async function addNHIE() {
  const statement = document.getElementById('newNhieStatement').value.trim();
  if (!statement) {
    showToast('Please enter a statement', 'error');
    return;
  }
  try {
    const docRef = await db.collection('neverHaveIEver').add({
      statement,
      order: neverHaveIEverData.length,
      stats: { guilty: 0, innocent: 0 },
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    neverHaveIEverData.push({ id: docRef.id, statement, order: neverHaveIEverData.length, stats: { guilty: 0, innocent: 0 } });
    document.getElementById('newNhieStatement').value = '';
    renderAdminNHIE();
    showToast('Statement added! 🙈');
  } catch (err) {
    showToast('Error adding', 'error');
  }
}

async function addTruth() {
  const text = document.getElementById('newTruthInput').value.trim();
  if (!text) {
    showToast('Please enter a truth', 'error');
    return;
  }
  try {
    const docRef = await db.collection('truths').add({
      text,
      order: truthsData.length,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    truthsData.push({ id: docRef.id, text, order: truthsData.length });
    document.getElementById('newTruthInput').value = '';
    renderAdminTruths();
    showToast('Truth added! 🔮');
  } catch (err) {
    showToast('Error adding', 'error');
  }
}

async function addChallenge() {
  const text = document.getElementById('newChallengeInput').value.trim();
  if (!text) {
    showToast('Please enter a dare', 'error');
    return;
  }
  try {
    const docRef = await db.collection('challenges').add({
      text,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    challenges.push({ id: docRef.id, text });
    document.getElementById('newChallengeInput').value = '';
    renderAdminChallenges();
    showToast('Dare added! ⚡');
  } catch (err) {
    showToast('Error adding', 'error');
  }
}

// ============================================
// DELETE ITEMS
// ============================================
async function deleteQuestion(id) {
  if (!confirm('Delete this question?')) return;
  try {
    await db.collection('questions').doc(id).delete();
    questions = questions.filter(q => q.id !== id);
    renderAdminQuestions();
    showToast('Deleted');
  } catch (err) {
    showToast('Error', 'error');
  }
}

async function deleteWYR(id) {
  if (!confirm('Delete this dilemma?')) return;
  try {
    await db.collection('wouldYouRather').doc(id).delete();
    wouldYouRatherData = wouldYouRatherData.filter(i => i.id !== id);
    renderAdminWYR();
    showToast('Deleted');
  } catch (err) {
    showToast('Error', 'error');
  }
}

async function deleteNHIE(id) {
  if (!confirm('Delete this statement?')) return;
  try {
    await db.collection('neverHaveIEver').doc(id).delete();
    neverHaveIEverData = neverHaveIEverData.filter(i => i.id !== id);
    renderAdminNHIE();
    showToast('Deleted');
  } catch (err) {
    showToast('Error', 'error');
  }
}

async function deleteTruth(id) {
  if (!confirm('Delete this truth?')) return;
  try {
    await db.collection('truths').doc(id).delete();
    truthsData = truthsData.filter(i => i.id !== id);
    renderAdminTruths();
    showToast('Deleted');
  } catch (err) {
    showToast('Error', 'error');
  }
}

async function deleteChallenge(id) {
  if (!confirm('Delete this dare?')) return;
  try {
    await db.collection('challenges').doc(id).delete();
    challenges = challenges.filter(c => c.id !== id);
    renderAdminChallenges();
    showToast('Deleted');
  } catch (err) {
    showToast('Error', 'error');
  }
}

// ============================================
// EDIT MODAL
// ============================================
function editItem(type, id) {
  let item, title, text;
  switch (type) {
    case 'question':
      item = questions.find(i => i.id === id);
      title = 'Edit Question';
      text = item?.text || '';
      break;
    case 'challenge':
      item = challenges.find(i => i.id === id);
      title = 'Edit Dare';
      text = item?.text || '';
      break;
    case 'nhie':
      item = neverHaveIEverData.find(i => i.id === id);
      title = 'Edit Statement';
      text = item?.statement || '';
      break;
    case 'truth':
      item = truthsData.find(i => i.id === id);
      title = 'Edit Truth';
      text = item?.text || '';
      break;
    default:
      return;
  }
  if (!item) return;
  editingItem = { type, id };
  document.getElementById('editModalTitle').textContent = title;
  document.getElementById('editModalInput').value = text;
  document.getElementById('editModal').classList.remove('hidden');
}

function editWYR(id) {
  const item = wouldYouRatherData.find(i => i.id === id);
  if (!item) return;
  editingItem = { type: 'wyr', id };
  document.getElementById('editModalTitle').textContent = 'Edit Would You Rather';
  document.getElementById('editModalInput').value = `A: ${item.optionA}\nB: ${item.optionB}`;
  document.getElementById('editModal').classList.remove('hidden');
}

function closeEditModal(event) {
  if (!event || event.target === event.currentTarget) {
    document.getElementById('editModal').classList.add('hidden');
    editingItem = null;
  }
}

async function saveEditModal() {
  if (!editingItem) return;
  const text = document.getElementById('editModalInput').value.trim();
  if (!text) {
    showToast('Please enter text', 'error');
    return;
  }
  
  const { type, id } = editingItem;
  
  try {
    if (type === 'wyr') {
      const lines = text.split('\n');
      const optionA = lines[0]?.replace(/^A:\s*/i, '').trim() || '';
      const optionB = lines[1]?.replace(/^B:\s*/i, '').trim() || '';
      if (!optionA || !optionB) {
        showToast('Include both options', 'error');
        return;
      }
      await db.collection('wouldYouRather').doc(id).update({
        optionA,
        optionB,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      const item = wouldYouRatherData.find(i => i.id === id);
      if (item) {
        item.optionA = optionA;
        item.optionB = optionB;
      }
      renderAdminWYR();
    } else if (type === 'nhie') {
      await db.collection('neverHaveIEver').doc(id).update({
        statement: text,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      const item = neverHaveIEverData.find(i => i.id === id);
      if (item) item.statement = text;
      renderAdminNHIE();
    } else if (type === 'truth') {
      await db.collection('truths').doc(id).update({
        text,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      const item = truthsData.find(i => i.id === id);
      if (item) item.text = text;
      renderAdminTruths();
    } else if (type === 'question') {
      await db.collection('questions').doc(id).update({
        text,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      const item = questions.find(i => i.id === id);
      if (item) item.text = text;
      renderAdminQuestions();
    } else if (type === 'challenge') {
      await db.collection('challenges').doc(id).update({
        text,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      const item = challenges.find(i => i.id === id);
      if (item) item.text = text;
      renderAdminChallenges();
    }
    
    closeEditModal();
    showToast('Saved! ✨');
  } catch (err) {
    showToast('Error saving', 'error');
  }
}
  