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

// --- RENDER FUNCTIONS (omitted for brevity, they are unchanged) ---
function render() {
    // ... same as before
}
function renderAuthView() {
    // ... same as before
}
function renderAppView() {
    // ... same as before
}
function renderChartJS(budget, spent) {
    // ... same as before
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

function waitForConfigAndInitialize() {
    if (window.firebaseConfig) {
        initializeFirebase();
    } else {
        console.log("Waiting for Firebase config...");
        setTimeout(waitForConfigAndInitialize, 100);
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
document.addEventListener('DOMContentLoaded', () => {
    waitForConfigAndInitialize();
    setupEventListeners();
    render();
});
