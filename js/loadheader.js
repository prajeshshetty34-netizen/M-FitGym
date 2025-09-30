document.addEventListener('DOMContentLoaded', function() {
    // 1. Fetch and inject the header HTML
    fetch('header.html')
        .then(response => {
            if (response.ok) {
                return response.text();
            } else {
                return fetch('components/header.html').then(altResponse => {
                    if (altResponse.ok) return altResponse.text();
                    throw new Error('Header file not found in either path.');
                });
            }
        })
        .then(data => {
            document.getElementById('header-placeholder').innerHTML = data;

            // Elements
            const loginLink = document.getElementById('loginLink');
            const logoutLink = document.getElementById('logoutLink');
            const profileLink = document.getElementById('profileLink');

            // Update links based on user object (event or direct)
            function updateLinksForUser(user) {
                const isLoggedIn = !!user;
                if (loginLink) loginLink.style.display = isLoggedIn ? 'none' : 'inline-block';
                if (logoutLink) logoutLink.style.display = isLoggedIn ? 'inline-block' : 'none';
                if (profileLink) profileLink.style.display = isLoggedIn ? 'inline-block' : 'none';
            }

            // Generic handler accepting event or being called directly
            function updateAuthLinks(event) {
                const user = event && event.detail ? event.detail.user || (event.detail.auth && event.detail.auth.currentUser) : null;
                // If no event detail, try firebaseAuth getter
                if (!user && window.firebaseAuth && typeof window.firebaseAuth.getCurrentUser === 'function') {
                    try { updateLinksForUser(window.firebaseAuth.getCurrentUser()); return; } catch (e) { /* ignore */ }
                }
                updateLinksForUser(user);
            }

            // Listen for firebase auth events dispatched by js/auth.js
            window.addEventListener('authReady', updateAuthLinks);
            window.addEventListener('authStateChanged', updateAuthLinks);

            // Immediate check in case auth was already initialized
            if (window.firebaseAuth && typeof window.firebaseAuth.getCurrentUser === 'function') {
                try { updateLinksForUser(window.firebaseAuth.getCurrentUser()); } catch (e) { /* ignore */ }
            }

            // Logout action (js/auth.js exposes logout)
            window.logout = async function() {
                try {
                    if (window.firebaseAuth && window.firebaseAuth.logout) await window.firebaseAuth.logout();
                } catch (err) { console.warn('Logout failed', err); }
                window.location.href = 'login.html';
            };
        })
        .catch(error => {
            console.error('Error loading header:', error);
            const ph = document.getElementById('header-placeholder');
            if (ph) ph.innerHTML = '<p>Error loading navigation. Please try again later.</p>';
        });
});