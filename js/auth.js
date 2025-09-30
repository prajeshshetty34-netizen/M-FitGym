/*
    Firebase auth.js
    - Initializes Firebase from global __firebase_config (or uses provided globals)
    - Exposes signup, login, logout flows using Firebase Authentication
    - Dispatches custom events: 'authReady' when Firebase initialized, and 'authStateChanged' on changes
    - Hooks signup/login forms (if present) to the Firebase flows
*/

(function () {
    // Helper to load a script dynamically
    function loadScript(src) {
        return new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = src;
            s.onload = resolve;
            s.onerror = reject;
            document.head.appendChild(s);
        });
    }

    async function ensureFirebase() {
        // If firebase already present, use it
        if (window.firebase && window.firebase.auth) return;

        // Load compat SDKs dynamically (use a stable version)
        const base = 'https://www.gstatic.com/firebasejs/9.22.2';
        await loadScript(base + '/firebase-app-compat.js');
        await loadScript(base + '/firebase-auth-compat.js');
    }

    async function initFirebase() {
        try {
            await ensureFirebase();
        } catch (err) {
            console.error('Failed to load Firebase SDK:', err);
            dispatchAuthReady(null, err);
            return;
        }

        const cfg = window.__firebase_config || window.firebaseConfig || null;
        if (!cfg) {
            console.warn('No Firebase config found on window. Skipping Firebase init.');
            dispatchAuthReady(null, new Error('No Firebase config'));
            return;
        }

        try {
            // Initialize app if not already
            if (!window.firebase.apps || window.firebase.apps.length === 0) {
                window.firebase.initializeApp(cfg);
            }

            const auth = window.firebase.auth();

            // If an initial auth token is available (server-side injected), sign in
            if (window.__initial_auth_token) {
                try {
                    await auth.signInWithCustomToken(window.__initial_auth_token);
                } catch (e) {
                    console.warn('Initial auth token sign-in failed', e);
                }
            }

            // Listen for auth state changes
            auth.onAuthStateChanged((user) => {
                const event = new CustomEvent('authStateChanged', { detail: { user } });
                window.dispatchEvent(event);
            });

            dispatchAuthReady(auth, null);
        } catch (err) {
            console.error('Firebase initialization error:', err);
            dispatchAuthReady(null, err);
        }
    }

    function dispatchAuthReady(auth, error) {
        const evt = new CustomEvent('authReady', { detail: { auth, error } });
        window.dispatchEvent(evt);
    }

    // Public flows
    async function signup(email, password, displayName) {
        const auth = window.firebase.auth();
        const res = await auth.createUserWithEmailAndPassword(email, password);
        if (displayName) {
            await res.user.updateProfile({ displayName });
        }
        return res.user;
    }

    async function login(email, password) {
        const auth = window.firebase.auth();
        const res = await auth.signInWithEmailAndPassword(email, password);
        return res.user;
    }

    async function logout() {
        const auth = window.firebase.auth();
        await auth.signOut();
    }

    function getCurrentUser() {
        if (!window.firebase || !window.firebase.auth) return null;
        return window.firebase.auth().currentUser;
    }

    // Hook up forms if present
    document.addEventListener('DOMContentLoaded', () => {
        initFirebase();

        const signupForm = document.getElementById('signupForm');
        if (signupForm) {
            signupForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const name = document.getElementById('signupName').value.trim();
                const email = document.getElementById('signupEmail').value.trim();
                const password = document.getElementById('signupPass').value;
                const signupMsg = document.getElementById('signupMsg');
                signupMsg.textContent = 'Processing...';
                try {
                    await signup(email, password, name);
                    signupMsg.textContent = '✅ Signup successful. Redirecting to login...';
                    signupMsg.className = 'success-message';
                    setTimeout(() => window.location.href = 'login.html', 1200);
                } catch (err) {
                    console.error(err);
                    signupMsg.textContent = err.message || 'Signup failed.';
                    signupMsg.className = 'error-message';
                }
            });
        }

        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            loginForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const email = document.getElementById('loginEmail').value.trim();
                const password = document.getElementById('loginPass').value;
                const loginMsg = document.getElementById('loginMsg');
                loginMsg.textContent = 'Processing...';
                try {
                    await login(email, password);
                    loginMsg.textContent = '✅ Login successful. Redirecting...';
                    loginMsg.className = 'success-message';
                    setTimeout(() => window.location.href = 'index.html', 800);
                } catch (err) {
                    console.error(err);
                    loginMsg.textContent = err.message || 'Login failed.';
                    loginMsg.className = 'error-message';
                }
            });
        }
    });

    // Expose for other scripts
    window.firebaseAuth = {
        initFirebase,
        signup,
        login,
        logout,
        getCurrentUser
    };

})();
