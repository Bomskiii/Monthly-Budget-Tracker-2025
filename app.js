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
// Vercel will replace these placeholders with your actual environment variables during the build process.
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

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
                <input type="password" name="password" placeholder="Password" class="w-full p-3 bg-gray-700 rounded-md text-white" required>
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
                <input type="password" name="password" placeholder="Password (min. 6 characters)" class="w-full p-3 bg-gray-700 rounded-md text-white" required>
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
    // This function will be filled with the main application UI logic
    // For now, it's a placeholder to show the structure
    return `<div class="app-main-container">
                <header>
                    <h1>Monthly Budget Tracker</h1>
                    <div>
                        ${state.isEditor ? `<button id="share-btn" class="btn-share">Share</button>` : ''}
                        ${state.user ? `<button id="logout-btn" class="btn-danger">Logout</button>` : ''}
                    </div>
                </header>
                <main id="app-content"></main>
            </div>`;
}

function renderChartJS(budget, spent) {
    // Chart rendering logic
}

// --- EVENT HANDLERS & LOGIC ---

function setupEventListeners() {
    const appContainer = document.getElementById('app-container');
    
    appContainer.addEventListener('click', (e) => {
        // ... Event handling logic
    });

    appContainer.addEventListener('submit', (e) => {
        // ... Form submission logic
    });
}

// --- FIREBASE LOGIC ---

async function initialize() {
    try {
        const app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        storage = getStorage(app);
        auth = getAuth(app);

        onAuthStateChanged(auth, (user) => {
            // ... Auth state change logic
        });
    } catch (e) {
        console.error("Firebase initialization error:", e);
        state.error = "Failed to initialize the application.";
        state.currentView = 'auth';
        render();
    }
}

// --- Start the app ---
document.addEventListener('DOMContentLoaded', () => {
    initialize();
    setupEventListeners();
    render();
});
