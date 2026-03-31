/* ============================================
   DEBUG CONSOLE
   Logging utility - loads first so all scripts can use debugLog()
   ============================================ */

/**
 * Log a message to the debug console
 * @param {string|object} message - Message to log
 * @param {string} type - 'info', 'success', or 'error'
 */
function debugLog(message, type = 'info') {
  const logs = document.getElementById('debugLogs');
  if (!logs) {
    console.log(`[${type}]`, message);
    return;
  }
  
  const time = new Date().toLocaleTimeString();
  const entry = document.createElement('div');
  entry.className = `debug-log ${type}`;
  
  const msgStr = typeof message === 'object' 
    ? JSON.stringify(message, null, 2) 
    : String(message);
  
  entry.innerHTML = `<span class="time">[${time}]</span> ${msgStr}`;
  logs.appendChild(entry);
  logs.scrollTop = logs.scrollHeight;
  
  // Also log to browser console
  console.log(`[${type}]`, message);
}

/**
 * Toggle debug console visibility
 */
function toggleDebugConsole() {
  const console = document.getElementById('debugConsole');
  const showBtn = document.getElementById('showConsoleBtn');
  
  if (console.classList.contains('hidden')) {
    console.classList.remove('hidden');
    showBtn.classList.add('hidden');
  } else {
    console.classList.add('hidden');
    showBtn.classList.remove('hidden');
  }
}

/**
 * Clear all debug logs
 */
function clearDebugLogs() {
  const logs = document.getElementById('debugLogs');
  if (logs) logs.innerHTML = '';
}

/**
 * Copy all debug logs to clipboard
 */
function copyDebugLogs() {
  const logs = document.getElementById('debugLogs');
  if (!logs) return;
  
  // Extract text content from each log entry
  const entries = logs.querySelectorAll('.debug-log');
  const text = Array.from(entries).map(entry => entry.textContent).join('\n');
  
  if (!text) {
    if (typeof showToast === 'function') showToast('Console is empty', 'error');
    return;
  }
  
  navigator.clipboard.writeText(text).then(() => {
    if (typeof showToast === 'function') showToast('Console copied! 📋');
  }).catch(err => {
    // Fallback for older browsers
    const textarea = document.createElement('textarea');
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    if (typeof showToast === 'function') showToast('Console copied! 📋');
  });
}

// Global error handlers
window.onerror = (msg, url, line) => {
  debugLog(`ERROR: ${msg} at ${line}`, 'error');
  return false;
};

window.onunhandledrejection = (e) => {
  debugLog(`PROMISE: ${e.reason}`, 'error');
};