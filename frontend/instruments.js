/* =============================================
   JAMSYNC — Instruments Dashboard JavaScript
   Handles: Profile dropdown, logout modal,
   instrument card click, username display
============================================= */


// ─── ON PAGE LOAD ─────────────────────────────
// Read username from localStorage (set during login)
// and display it in the navbar and dropdown

window.addEventListener('DOMContentLoaded', () => {
  // Get saved username — fallback to "Musician" if not found
  const username = localStorage.getItem('jamsync_user') || 'Musician';

  // Get first letter for avatar
  const initial = username.charAt(0).toUpperCase();

  // Update all username displays
  document.getElementById('profile-name').textContent    = username;
  document.getElementById('avatar-circle').textContent   = initial;
  document.getElementById('avatar-lg').textContent       = initial;
  document.getElementById('dropdown-username').textContent = username;
});


// ─── PROFILE DROPDOWN TOGGLE ─────────────────
// Opens and closes the dropdown menu under profile icon

function toggleDropdown() {
  const dropdown = document.getElementById('dropdown');
  const chevron  = document.getElementById('chevron');

  const isOpen = dropdown.classList.contains('open');

  if (isOpen) {
    dropdown.classList.remove('open');
    chevron.classList.remove('open');
  } else {
    dropdown.classList.add('open');
    chevron.classList.add('open');
  }
}

// Close dropdown if user clicks anywhere else on the page
document.addEventListener('click', (e) => {
  const wrapper = document.getElementById('profile-wrapper');

  // If click was outside the profile wrapper — close dropdown
  if (!wrapper.contains(e.target)) {
    document.getElementById('dropdown').classList.remove('open');
    document.getElementById('chevron').classList.remove('open');
  }
});


// ─── DROPDOWN MENU ACTIONS ───────────────────
// These show "coming soon" toasts for now
// Will navigate to real pages when built

function goToProfile() {
  closeDropdown();
  showToast('👤 Profile page coming soon!');
}

function goToSettings() {
  closeDropdown();
  showToast('⚙️ Settings page coming soon!');
}

function goToRooms() {
  closeDropdown();
  showToast('🌐 Live Rooms coming soon!');
}

function closeDropdown() {
  document.getElementById('dropdown').classList.remove('open');
  document.getElementById('chevron').classList.remove('open');
}


// ─── LOGOUT FLOW ─────────────────────────────
// Step 1: User clicks "Log Out" in dropdown
// Step 2: Confirmation modal appears
// Step 3: User confirms → clear data → back to login

function logout() {
  closeDropdown();
  // Show the confirmation modal
  document.getElementById('logout-modal').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('logout-modal').classList.add('hidden');
}

function confirmLogout() {
  // Clear saved login data
  localStorage.removeItem('jamsync_user');
  localStorage.removeItem('jamsync_token');

  // Close modal
  closeModal();

  // Show toast briefly then redirect to login
  showToast('👋 Logged out. See you soon!');

  setTimeout(() => {
    window.location.href = 'index.html';  // back to login page
  }, 1200);
}

// Close modal if overlay (background) is clicked
document.getElementById('logout-modal').addEventListener('click', function(e) {
  if (e.target === this) closeModal();
});


// ─── INSTRUMENT CARD CLICK ───────────────────
// When a card is clicked, open that instrument's page
// For now: Piano navigates to piano.html
// Others show "coming soon" toast

function openInstrument(name) {
  // Add a click "press" animation to the card
  const card = document.getElementById(`card-${name}`);
  card.style.transform = 'scale(0.97)';
  setTimeout(() => card.style.transform = '', 200);

  // Decide what to do
  if (name === 'piano') {
    setTimeout(() => {
      window.location.href = 'piano.html';   // we build this next!
    }, 250);

  } else {
    // Other instruments → coming soon
    const labels = {
      violin: '🎻 Violin',
      drums:  '🥁 Drums',
      guitar: '🎸 Guitar',
    };
    showToast(`${labels[name]} studio coming soon!`);
  }
}


// ─── TOAST NOTIFICATION ──────────────────────
// Small popup message at the bottom of the screen
// Appears for 2.5 seconds then disappears

let toastTimer = null;

function showToast(message) {
  const toast   = document.getElementById('toast');
  const toastMsg = document.getElementById('toast-msg');

  // Set message
  toastMsg.textContent = message;

  // Show toast
  toast.classList.remove('hidden');

  // Clear any existing timer
  clearTimeout(toastTimer);

  // Auto-hide after 2.5 seconds
  toastTimer = setTimeout(() => {
    toast.classList.add('hidden');
  }, 2500);
}
