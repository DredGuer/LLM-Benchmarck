/**
 * LLM Benchmarker - Storage Utilities
 * Handles localStorage operations with error handling
 */

function saveToLocalStorage(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
    return true;
  } catch (e) {
    console.error('Error saving to localStorage:', e);
    return false;
  }
}

function loadFromLocalStorage(key, defaultValue) {
  if (defaultValue === undefined) defaultValue = null;
  try {
    var data = localStorage.getItem(key);
    return data ? JSON.parse(data) : defaultValue;
  } catch (e) {
    console.error('Error loading from localStorage:', e);
    return defaultValue;
  }
}

function removeFromLocalStorage(key) {
  try {
    localStorage.removeItem(key);
    return true;
  } catch (e) {
    console.error('Error removing from localStorage:', e);
    return false;
  }
}
