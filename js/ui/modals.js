/**
 * LLM Benchmarker - Modal Management
 * Handles opening and closing of modal dialogs
 */

function openModal(id) {
  var modal = document.getElementById(id);
  if (modal) {
    modal.classList.add('open');
  }
}

function closeModal(id) {
  var modal = document.getElementById(id);
  if (modal) {
    modal.classList.remove('open');
  }
}

// Initialize modal close handlers
(function initModals() {
  var overlays = document.querySelectorAll('.modal-overlay');
  for (var i = 0; i < overlays.length; i++) {
    overlays[i].addEventListener('click', function(e) {
      if (e.target === this) {
        this.classList.remove('open');
      }
    });
  }
})();
