import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { 
    getAuth, 
    onAuthStateChanged, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    sendPasswordResetEmail,
    signOut
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, doc, addDoc, deleteDoc, updateDoc, onSnapshot, query, where, Timestamp, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-storage.js";

// --- GLOBAL STATE & CONFIG ---
let db, storage, auth;
let chartInstance = null;

const state = {
    currentView: 'loading', // loading, auth, app
    authView: 'login', // login, register, forgotPassword
    user: null,
    isEditor: false,
    viewOnlyUserId: null,
    monthlyBudgets: [],
    selectedMonthId: '',
    categories: [],
    isLoading: true,
    sortConfig: { key: 'name', direction: 'ascending' },
    editingItem: null,
    isAnalysisModalOpen: false,
    analysisResult: '',
    isAnalyzing: false,
    error: null,
    notification: null
};

// --- HELPER FUNCTIONS ---
const formatCurrency = (value) => `Rp ${new Intl.NumberFormat('id-ID').format(Math.round(value))}`;
const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = dateString.toDate ? dateString.toDate() : new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
};
const toInputDate = (dateString) => {
    if (!dateString) return '';
    const date = dateString.toDate ? dateString.toDate() : new Date(dateString);
    return date.toISOString().split('T')[0];
};

// --- RENDER FUNCTIONS ---

function render() {
    const appContainer = document.getElementById('app-container');
    if (!appContainer) return;

    let html = '';
    switch (state.currentView) {
        case 'loading':
            html = `<div class="loader-container">
                        <div class="loader"></div>
                        <p class="loader-text">Loading Application...</p>
                    </div>`;
            break;
        case 'auth':
            html = renderAuthView();
            break;
        case 'app':
            html = renderAppView();
            break;
    }
    appContainer.innerHTML = html;

    if (state.currentView === 'app' && state.selectedMonthId) {
        const selectedMonthlyBudget = state.monthlyBudgets.find(b => b.id === state.selectedMonthId);
        if (selectedMonthlyBudget) {
            const totalSpentForMonth = state.categories.reduce((total, category) => {
                return total + (category.expenses ? category.expenses.reduce((sum, exp) => sum + exp.amount, 0) : 0);
            }, 0);
            renderChartJS(selectedMonthlyBudget, totalSpentForMonth);
        }
    }
}

function renderAuthView() {
    let formHtml = '';
    if (state.authView === 'login') {
        formHtml = `
            <h2 class="text-3xl font-bold text-center text-white mb-6">Login</h2>
            <form id="login-form" class="space-y-4">
                <input type="email" name="email" placeholder="Email" class="w-full p-3 bg-gray-700 rounded-md text-white" required>
                <div class="relative">
                    <input type="password" name="password" placeholder="Password" class="w-full p-3 bg-gray-700 rounded-md text-white pr-10" required>
                    <button type="button" class="absolute inset-y-0 right-0 px-3 text-gray-400" data-action="toggle-password">👁️</button>
                </div>
                <button type="submit" class="w-full p-3 bg-indigo-600 rounded-md font-semibold hover:bg-indigo-700">Login</button>
            </form>
            <div class="text-center mt-4">
                <a href="#" data-view="forgotPassword" class="text-sm text-indigo-400 hover:underline">Forgot Password?</a>
                <p class="text-gray-400 mt-2">Don't have an account? <a href="#" data-view="register" class="text-indigo-400 hover:underline">Register</a></p>
            </div>
        `;
    } else if (state.authView === 'register') {
         formHtml = `
            <h2 class="text-3xl font-bold text-center text-white mb-6">Register</h2>
            <form id="register-form" class="space-y-4">
                <input type="email" name="email" placeholder="Email" class="w-full p-3 bg-gray-700 rounded-md text-white" required>
                <div class="relative">
                    <input type="password" name="password" placeholder="Password (min. 6 characters)" class="w-full p-3 bg-gray-700 rounded-md text-white pr-10" required>
                    <button type="button" class="absolute inset-y-0 right-0 px-3 text-gray-400" data-action="toggle-password">👁️</button>
                </div>
                <div class="relative">
                    <input type="password" name="confirmPassword" placeholder="Confirm Password" class="w-full p-3 bg-gray-700 rounded-md text-white pr-10" required>
                    <button type="button" class="absolute inset-y-0 right-0 px-3 text-gray-400" data-action="toggle-password">👁️</button>
                </div>
                <button type="submit" class="w-full p-3 bg-indigo-600 rounded-md font-semibold hover:bg-indigo-700">Register</button>
            </form>
            <p class="text-center text-gray-400 mt-4">Already have an account? <a href="#" data-view="login" class="text-indigo-400 hover:underline">Login</a></p>
        `;
    } else { // forgotPassword
         formHtml = `
            <h2 class="text-3xl font-bold text-center text-white mb-6">Reset Password</h2>
            <form id="forgot-password-form" class="space-y-4">
                <input type="email" name="email" placeholder="Enter your email" class="w-full p-3 bg-gray-700 rounded-md text-white" required>
                <button type="submit" class="w-full p-3 bg-indigo-600 rounded-md font-semibold hover:bg-indigo-700">Send Reset Link</button>
            </form>
            <p class="text-center text-gray-400 mt-4"><a href="#" data-view="login" class="text-indigo-400 hover:underline">Back to Login</a></p>
        `;
    }

    return `
        <div class="min-h-screen flex items-center justify-center">
            <div class="max-w-md w-full bg-gray-800 p-8 rounded-lg shadow-lg">
                ${state.error ? `<div class="bg-red-500 p-3 rounded-md mb-4">${state.error}</div>` : ''}
                ${state.notification ? `<div class="bg-green-500 p-3 rounded-md mb-4">${state.notification}</div>` : ''}
                ${formHtml}
            </div>
        </div>
    `;
}

function renderAppView() {
    let mainContent = '';

    if (state.isLoading) {
        mainContent = `<div class="loader-container"><div class="loader"></div><p class="loader-text">Loading Data...</p></div>`;
    } else if (state.monthlyBudgets.length > 0) {
        // Full app content will be built here
    } else {
        mainContent = `
            <div class="text-center p-10 bg-gray-800 rounded-lg">
                <h3 class="text-xl text-white">No monthly budgets created yet.</h3>
                ${state.isEditor ? '<p class="text-gray-400">Use the form above to create your first one.</p>' : ''}
            </div>
        `;
    }

    return `<div class="app-main-container">
                <header>
                    <h1>Monthly Budget Tracker</h1>
                    <div>
                        ${state.isEditor ? `<button id="share-btn" class="btn-share">Share</button>` : ''}
                        ${state.user ? `<button id="logout-btn" class="btn-danger">Logout</button>` : ''}
                    </div>
                </header>
                ${state.isEditor ? `<!-- Add Monthly Budget Form will be rendered here -->` : ''}
                <main id="app-content">${mainContent}</main>
            </div>`;
}

function renderChartJS(budget, spent) {
    // Chart rendering logic
}

// --- EVENT HANDLERS & LOGIC ---

function setupEventListeners() {
    const appContainer = document.getElementById('app-container');
    
    appContainer.addEventListener('click', (e) => {
        const target = e.target;
        
        if (target.matches('a[data-view]')) {
            e.preventDefault();
            state.authView = target.dataset.view;
            state.error = null;
            state.notification = null;
            render();
            return;
        }

        if (target.id === 'logout-btn') {
            signOut(auth).catch(err => console.error("Logout Error:", err));
        }

        if (target.id === 'share-btn') {
            if (state.selectedMonthId) {
                const shareUrl = `${window.location.origin}${window.location.pathname}?userId=${state.user.uid}&monthId=${state.selectedMonthId}`;
                navigator.clipboard.writeText(shareUrl).then(() => {
                    alert('View-only link copied to clipboard!');
                }).catch(err => {
                    console.error('Failed to copy: ', err);
                    prompt("Copy this link:", shareUrl);
                });
            } else {
                alert('Please select a month to share.');
            }
        }

        if (target.dataset.action === 'toggle-password') {
            const input = target.previousElementSibling;
            if (input.type === 'password') {
                input.type = 'text';
                target.textContent = '🙈';
            } else {
                input.type = 'password';
                target.textContent = '👁️';
            }
        }
    });

    appContainer.addEventListener('submit', (e) => {
        e.preventDefault();
        const formId = e.target.id;
        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData.entries());

        state.error = null;
        state.notification = null;

        if (formId === 'login-form') {
            signInWithEmailAndPassword(auth, data.email, data.password)
                .catch(err => {
                    state.error = err.message;
                    render();
                });
        } else if (formId === 'register-form') {
            if (data.password !== data.confirmPassword) {
                state.error = "Passwords do not match.";
                render();
                return;
            }
            createUserWithEmailAndPassword(auth, data.email, data.password)
                .catch(err => {
                    state.error = err.message;
                    render();
                });
        } else if (formId === 'forgot-password-form') {
            sendPasswordResetEmail(auth, data.email)
                .then(() => {
                    state.notification = 'Password reset email sent!';
                    render();
                })
                .catch(err => {
                    state.error = err.message;
                    render();
                });
        }
    });
}

// --- FIREBASE LOGIC ---

function initializeFirebase() {
    try {
        const app = initializeApp(window.firebaseConfig);
        db = getFirestore(app);
        storage = getStorage(app);
        auth = getAuth(app);

        onAuthStateChanged(auth, (user) => {
            const urlParams = new URLSearchParams(window.location.search);
            const viewOnlyUserId = urlParams.get('userId');
            const viewOnlyMonthId = urlParams.get('monthId');

            state.user = user;
            if (user) {
                if (viewOnlyUserId && user.uid !== viewOnlyUserId) {
                    state.isEditor = false;
                    state.viewOnlyUserId = viewOnlyUserId;
                    state.selectedMonthId = viewOnlyMonthId;
                } else {
                    state.isEditor = true;
                    state.viewOnlyUserId = null;
                }
                state.currentView = 'app';
                setupSnapshots();
            } else {
                if (viewOnlyUserId) {
                    state.isEditor = false;
                    state.viewOnlyUserId = viewOnlyUserId;
                    state.selectedMonthId = viewOnlyMonthId;
                    state.currentView = 'app';
                    setupSnapshots();
                } else {
                    state.currentView = 'auth';
                    state.isLoading = false;
                    render();
                }
            }
        });
    } catch (e) {
        console.error("Firebase initialization error:", e);
        state.error = "Failed to initialize the application. Check your environment variables.";
        state.currentView = 'auth';
        render();
    }
}

let monthlyUnsubscribe = null;
let categoryUnsubscribe = null;

function setupSnapshots() {
    const userIdToFetch = state.viewOnlyUserId || state.user?.uid;
    if (!db || !userIdToFetch) {
        state.isLoading = false;
        render();
        return;
    }

    if (monthlyUnsubscribe) monthlyUnsubscribe();
    const monthlyCollectionPath = `users/${userIdToFetch}/monthlyBudgets`;
    monthlyUnsubscribe = onSnapshot(query(collection(db, monthlyCollectionPath)), (snapshot) => {
        state.monthlyBudgets = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        if (!state.selectedMonthId && state.monthlyBudgets.length > 0) {
            state.selectedMonthId = state.monthlyBudgets[0].id;
        } else if (state.monthlyBudgets.length === 0) {
            state.selectedMonthId = '';
        }
        state.isLoading = false;
        setupCategorySnapshot();
    }, err => {
        console.error("Error fetching monthly budgets:", err);
        state.isLoading = false;
        render();
    });
}

function setupCategorySnapshot() {
    const userIdToFetch = state.viewOnlyUserId || state.user?.uid;
    if (categoryUnsubscribe) categoryUnsubscribe();
    
    if (!db || !userIdToFetch || !state.selectedMonthId) {
        state.categories = [];
        render();
        return;
    }
    
    const categoriesCollectionPath = `users/${userIdToFetch}/categories`;
    const q = query(collection(db, categoriesCollectionPath), where("monthlyBudgetId", "==", state.selectedMonthId));

    categoryUnsubscribe = onSnapshot(q, (snapshot) => {
        state.categories = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            expenses: doc.data().expenses || []
        }));
        render();
    }, err => {
        console.error("Error fetching categories:", err);
        render();
    });
}


// --- Start the app ---
function startApp() {
    let attempts = 0;
    const maxAttempts = 50; // Wait for 5 seconds

    const interval = setInterval(() => {
        if (typeof window.firebaseConfig !== 'undefined' && window.firebaseConfig.apiKey) {
            clearInterval(interval);
            initializeFirebase();
        } else {
            attempts++;
            if (attempts > maxAttempts) {
                clearInterval(interval);
                console.error("Firebase config failed to load after 5 seconds.");
                const appContainer = document.getElementById('app-container');
                appContainer.innerHTML = `
                    <div class="loader-container">
                        <p class="text-red-500 text-lg font-semibold">Error: Application configuration failed to load.</p>
                        <p class="text-gray-300 mt-4">This can happen due to a caching issue.</p>
                        <p class="text-gray-300">Please try a hard refresh (Ctrl+Shift+R or Cmd+Shift+R) or clear your browser's cache for this site.</p>
                    </div>`;
            }
        }
    }, 100);
}

document.addEventListener('DOMContentLoaded', () => {
    render(); // Initial render of the loading screen
    setupEventListeners();
    startApp();
});
