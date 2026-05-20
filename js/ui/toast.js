/**
 * LLM Benchmarker - Toast Notifications
 * Displays temporary notification messages
 */

function showToast(message, type) {
  if (type === undefined) type = 'info';
  var container = document.getElementById('toastContainer');
  if (!container) return;

  var toast = document.createElement('div');
  var icons = { success: '✅', error: '❌', info: 'ℹ️' };
  toast.className = 'toast ' + type;
  toast.innerHTML = '<span>' + (icons[type] || '•') + '</span><span>' + escapeHtml(message) + '</span>';
  container.appendChild(toast);

  setTimeout(function() {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s';
    setTimeout(function() { toast.remove(); }, 300);
  }, 3500);
}
