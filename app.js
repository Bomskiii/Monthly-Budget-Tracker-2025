import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { 
    getAuth, 
    onAuthStateChanged, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    sendPasswordResetEmail,
    signOut
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, doc, addDoc, deleteDoc, updateDoc, onSnapshot, query, where, Timestamp, arrayUnion, arrayRemove } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- GLOBAL STATE & CONFIG ---
let db, auth;
let chartInstance = null;
let isFirebaseInitialized = false;

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
    editingItem: null, // { type: 'budget'/'category'/'expense', id: '...' }
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
    if (!dateString) return new Date().toISOString().split('T')[0];
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
            html = `<div class="loader-container"><div class="loader"></div><p class="loader-text">Loading Application...</p></div>`;
            break;
        case 'auth':
            html = renderAuthView();
            break;
        case 'app':
            html = renderAppView();
            break;
    }
    appContainer.innerHTML = html;
    attachEventListeners(); // Re-attach listeners after every render

    if (state.currentView === 'app' && state.selectedMonthId) {
        const selectedMonthlyBudget = state.monthlyBudgets.find(b => b.id === state.selectedMonthId);
        if (selectedMonthlyBudget) {
            const totalSpent = state.categories.reduce((total, category) => total + (category.expenses ? category.expenses.reduce((sum, exp) => sum + exp.amount, 0) : 0), 0);
            renderChartJS(selectedMonthlyBudget, totalSpent);
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
                <div class="relative"><input type="password" name="password" placeholder="Password" class="w-full p-3 bg-gray-700 rounded-md text-white pr-10" required><button type="button" class="absolute inset-y-0 right-0 px-3 text-gray-400" data-action="toggle-password">👁️</button></div>
                <button type="submit" class="w-full p-3 bg-indigo-600 rounded-md font-semibold hover:bg-indigo-700">Login</button>
            </form>
            <div class="text-center mt-4"><a href="#" data-view="forgotPassword" class="text-sm text-indigo-400 hover:underline">Forgot Password?</a><p class="text-gray-400 mt-2">Don't have an account? <a href="#" data-view="register" class="text-indigo-400 hover:underline">Register</a></p></div>`;
    } else if (state.authView === 'register') {
         formHtml = `
            <h2 class="text-3xl font-bold text-center text-white mb-6">Register</h2>
            <form id="register-form" class="space-y-4">
                <input type="email" name="email" placeholder="Email" class="w-full p-3 bg-gray-700 rounded-md text-white" required>
                <div class="relative"><input type="password" name="password" placeholder="Password (min. 6 characters)" class="w-full p-3 bg-gray-700 rounded-md text-white pr-10" required><button type="button" class="absolute inset-y-0 right-0 px-3 text-gray-400" data-action="toggle-password">👁️</button></div>
                <div class="relative"><input type="password" name="confirmPassword" placeholder="Confirm Password" class="w-full p-3 bg-gray-700 rounded-md text-white pr-10" required><button type="button" class="absolute inset-y-0 right-0 px-3 text-gray-400" data-action="toggle-password">👁️</button></div>
                <button type="submit" class="w-full p-3 bg-indigo-600 rounded-md font-semibold hover:bg-indigo-700">Register</button>
            </form>
            <p class="text-center text-gray-400 mt-4">Already have an account? <a href="#" data-view="login" class="text-indigo-400 hover:underline">Login</a></p>`;
    } else { // forgotPassword
         formHtml = `
            <h2 class="text-3xl font-bold text-center text-white mb-6">Reset Password</h2>
            <form id="forgot-password-form" class="space-y-4">
                <input type="email" name="email" placeholder="Enter your email" class="w-full p-3 bg-gray-700 rounded-md text-white" required>
                <button type="submit" class="w-full p-3 bg-indigo-600 rounded-md font-semibold hover:bg-indigo-700">Send Reset Link</button>
            </form>
            <p class="text-center text-gray-400 mt-4"><a href="#" data-view="login" class="text-indigo-400 hover:underline">Back to Login</a></p>`;
    }
    return `<div class="min-h-screen flex items-center justify-center"><div class="max-w-md w-full bg-gray-800 p-8 rounded-lg shadow-lg">${state.error ? `<div class="bg-red-500 p-3 rounded-md mb-4">${state.error}</div>` : ''}${state.notification ? `<div class="bg-green-500 p-3 rounded-md mb-4">${state.notification}</div>` : ''}${formHtml}</div></div>`;
}

function renderAddOrEditBudgetForm() {
    const isEditing = state.editingItem?.type === 'budget';
    const budget = isEditing ? state.monthlyBudgets.find(b => b.id === state.editingItem.id) : null;
    
    return `<form id="${isEditing ? 'edit-budget-form' : 'add-budget-form'}" class="mb-8 p-6 bg-gray-800 rounded-lg shadow-md">
        <h2 class="text-2xl font-bold text-white mb-4">${isEditing ? 'Edit Monthly Budget' : 'Create New Monthly Budget'}</h2>
        <div class="grid md:grid-cols-2 gap-4">
            <div><label for="budget-title" class="block text-sm font-medium text-gray-300 mb-1">Budget Title</label><input type="text" id="budget-title" name="title" value="${budget?.title || ''}" placeholder="e.g., July 2024 Budget" class="w-full p-2 bg-gray-700 rounded-md text-white" required></div>
            <div><label for="total-budget" class="block text-sm font-medium text-gray-300 mb-1">Total Budget Amount</label><input type="number" id="total-budget" name="totalBudget" value="${budget?.totalBudget || ''}" placeholder="e.g., 5000000" class="w-full p-2 bg-gray-700 rounded-md text-white" required></div>
        </div>
        <div class="flex gap-2 mt-4">
            <button type="submit" class="w-full p-3 bg-indigo-600 rounded-md font-semibold hover:bg-indigo-700">${isEditing ? 'Save Changes' : 'Create Budget'}</button>
            ${isEditing ? `<button type="button" data-action="cancel-edit" class="w-full p-3 bg-gray-600 rounded-md font-semibold hover:bg-gray-700">Cancel</button>` : ''}
        </div>
    </form>`;
}

function renderBudgetOverview(budget, spent) {
    const remaining = budget.totalBudget - spent;
    return `
        <div class="flex justify-between items-center mb-2">
            <h3 class="text-2xl font-bold">Budget Overview</h3>
            ${state.isEditor ? `<button class="text-indigo-400 hover:underline" data-action="edit-item" data-type="budget" data-id="${budget.id}">Edit Budget ✏️</button>` : ''}
        </div>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div class="bg-gray-800 p-4 rounded-lg text-center"><p class="text-sm text-gray-400">Total Budget</p><p class="text-2xl font-bold text-green-400">${formatCurrency(budget.totalBudget)}</p></div>
            <div class="bg-gray-800 p-4 rounded-lg text-center"><p class="text-sm text-gray-400">Spent</p><p class="text-2xl font-bold text-yellow-400">${formatCurrency(spent)}</p></div>
            <div class="bg-gray-800 p-4 rounded-lg text-center"><p class="text-sm text-gray-400">Remaining</p><p class="text-2xl font-bold ${remaining < 0 ? 'text-red-500' : 'text-blue-400'}">${formatCurrency(remaining)}</p></div>
        </div>`;
}

function renderCategorySection() {
    const categoryListHtml = state.categories.map(cat => {
        const isEditingCat = state.editingItem?.type === 'category' && state.editingItem.id === cat.id;
        if (isEditingCat) {
            return `<form class="edit-category-form bg-gray-800 p-4 rounded-lg" data-id="${cat.id}"><h4 class="text-lg font-bold mb-2">Edit Category</h4><input type="text" name="name" value="${cat.name}" class="w-full p-2 bg-gray-700 rounded-md text-white mb-2" required><div class="flex gap-2"><button type="submit" class="w-full p-2 bg-indigo-500 text-sm rounded-md hover:bg-indigo-600">Save</button><button type="button" data-action="cancel-edit" class="w-full p-2 bg-gray-600 text-sm rounded-md hover:bg-gray-700">Cancel</button></div></form>`;
        }

        const totalExpenses = cat.expenses ? cat.expenses.reduce((sum, exp) => sum + exp.amount, 0) : 0;
        return `
            <div class="bg-gray-800 p-4 rounded-lg">
                <div class="flex justify-between items-center mb-3">
                    <h4 class="text-lg font-bold">${cat.name} ${state.isEditor ? `<button class="text-indigo-400 text-sm ml-2" data-action="edit-item" data-type="category" data-id="${cat.id}">✏️</button>` : ''}</h4>
                    <div><span class="font-semibold text-indigo-400">${formatCurrency(totalExpenses)}</span>${state.isEditor ? `<button class="btn-danger text-xs ml-2 px-2 py-1" data-action="delete-category" data-id="${cat.id}">X</button>` : ''}</div>
                </div>
                <ul class="space-y-2 mb-3">
                    ${cat.expenses && cat.expenses.map(exp => {
                        const isEditingExp = state.editingItem?.type === 'expense' && state.editingItem.id === exp.id;
                        if (isEditingExp) {
                            return `<li class="p-2 bg-gray-700 rounded-md"><form class="edit-expense-form space-y-2" data-category-id="${cat.id}" data-expense-id="${exp.id}"><input type="text" name="description" value="${exp.description}" class="w-full p-2 bg-gray-600 rounded-md text-white text-sm" required><div class="flex gap-2"><input type="number" name="amount" value="${exp.amount}" class="w-full p-2 bg-gray-600 rounded-md text-white text-sm" required><input type="date" name="date" value="${toInputDate(exp.date)}" class="w-full p-2 bg-gray-600 rounded-md text-white text-sm" required></div><div class="flex gap-2"><button type="submit" class="w-full p-2 bg-indigo-500 text-sm rounded-md hover:bg-indigo-600">Save</button><button type="button" data-action="cancel-edit" class="w-full p-2 bg-gray-600 text-sm rounded-md hover:bg-gray-700">Cancel</button></div></form></li>`;
                        }
                        return `<li class="flex justify-between items-center text-sm"><div><span>${exp.description}</span><span class="text-xs text-gray-400 ml-2">${formatDate(exp.date)}</span></div><div><span>${formatCurrency(exp.amount)}</span>${state.isEditor ? `<button class="text-indigo-400 text-sm ml-2" data-action="edit-item" data-type="expense" data-category-id="${cat.id}" data-id="${exp.id}">✏️</button><button class="text-red-500 ml-2" data-action="delete-expense" data-category-id="${cat.id}" data-expense-id="${exp.id}">🗑️</button>` : ''}</div></li>`;
                    }).join('')}
                </ul>
                ${state.isEditor ? `<form class="add-expense-form space-y-2" data-category-id="${cat.id}"><input type="text" name="description" placeholder="Expense description" class="w-full p-2 bg-gray-700 rounded-md text-white text-sm" required><div class="flex gap-2"><input type="number" name="amount" placeholder="Amount" class="w-full p-2 bg-gray-700 rounded-md text-white text-sm" required><input type="date" name="date" value="${toInputDate(null)}" class="w-full p-2 bg-gray-700 rounded-md text-white text-sm" required></div><button type="submit" class="w-full p-2 bg-indigo-500 text-sm rounded-md hover:bg-indigo-600">Add Expense</button></form>` : ''}
            </div>`;
    }).join('');

    return `<div class="grid lg:grid-cols-2 gap-8"><div><h3 class="text-2xl font-bold mb-4">Spending Chart</h3><div class="bg-gray-800 p-4 rounded-lg"><canvas id="budget-chart"></canvas></div></div><div><h3 class="text-2xl font-bold mb-4">Categories</h3>${state.isEditor ? `<form id="add-category-form" class="flex gap-2 mb-4"><input type="text" name="name" placeholder="New category name" class="w-full p-2 bg-gray-700 rounded-md text-white" required><button type="submit" class="p-2 bg-purple-600 rounded-md hover:bg-purple-700 font-semibold">Add</button></form>` : ''}<div class="space-y-4">${categoryListHtml || '<p class="text-gray-400">No categories added yet.</p>'}</div></div></div>`;
}

function renderAppView() {
    if (state.isLoading) {
        return `<div class="loader-container"><div class="loader"></div><p class="loader-text">Loading Data...</p></div>`;
    }

    let mainContent = '';
    const selectedMonthlyBudget = state.monthlyBudgets.find(b => b.id === state.selectedMonthId);

    if (state.monthlyBudgets.length > 0 && selectedMonthlyBudget) {
        const totalSpent = state.categories.reduce((total, category) => total + (category.expenses ? category.expenses.reduce((sum, exp) => sum + exp.amount, 0) : 0), 0);
        mainContent = `<div class="mb-6"><label for="month-select" class="block text-sm font-medium text-gray-300 mb-1">Select Budget Month:</label><select id="month-select" class="w-full p-3 bg-gray-700 text-white rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500">${state.monthlyBudgets.map(b => `<option value="${b.id}" ${b.id === state.selectedMonthId ? 'selected' : ''}>${b.title} (${b.code})</option>`).join('')}</select></div>
            ${state.editingItem?.type === 'budget' ? '' : renderBudgetOverview(selectedMonthlyBudget, totalSpent)}
            ${renderCategorySection()}`;
    } else {
        mainContent = `<div class="text-center p-10 bg-gray-800 rounded-lg"><h3 class="text-xl text-white">No monthly budgets created yet.</h3>${state.isEditor ? '<p class="text-gray-400 mt-2">Use the form above to create your first one.</p>' : ''}</div>`;
    }

    const showAddBudgetForm = state.isEditor && (state.editingItem?.type === 'budget' || state.monthlyBudgets.length === 0);

    return `<div class="app-main-container"><header class="flex justify-between items-center mb-6"><h1 class="text-4xl font-extrabold">Monthly Budget Tracker</h1><div>${state.isEditor ? `<button id="share-btn" class="btn-share mr-2">Share</button>` : ''}${state.user ? `<button id="logout-btn" class="btn-danger">Logout</button>` : ''}</div></header>
                ${showAddBudgetForm ? renderAddOrEditBudgetForm() : ''}
                <main id="app-content">${mainContent}</main>
            </div>`;
}

function renderChartJS(budget, spent) {
    const ctx = document.getElementById('budget-chart');
    if (!ctx) return;
    if (chartInstance) chartInstance.destroy();
    const categoryLabels = state.categories.map(c => c.name);
    const categoryTotals = state.categories.map(c => c.expenses ? c.expenses.reduce((sum, exp) => sum + exp.amount, 0) : 0);
    chartInstance = new Chart(ctx, { type: 'pie', data: { labels: categoryLabels.length > 0 ? categoryLabels : ['No Spending Yet'], datasets: [{ label: 'Spent', data: categoryLabels.length > 0 ? categoryTotals : [1], backgroundColor: ['#4f46e5', '#9333ea', '#db2777', '#f59e0b', '#10b981', '#3b82f6', '#ef4444'], borderColor: '#1f2937', borderWidth: 2 }] }, options: { responsive: true, plugins: { legend: { position: 'top', labels: { color: '#f3f4f6' } }, tooltip: { callbacks: { label: (context) => `${context.label || ''}: ${formatCurrency(context.parsed)}` } } } } });
}

// --- EVENT HANDLERS & LOGIC ---
function attachEventListeners() {
    const appContainer = document.getElementById('app-container');
    if (!appContainer) return;

    appContainer.onclick = function(e) {
        const target = e.target;
        const action = target.dataset.action;

        if (target.matches('a[data-view]')) { e.preventDefault(); state.authView = target.dataset.view; state.error = null; state.notification = null; render(); }
        else if (target.id === 'logout-btn') { handleLogout(); }
        else if (target.id === 'share-btn') { handleShare(); }
        else if (action === 'toggle-password') { togglePasswordVisibility(target); }
        else if (action === 'delete-category') { handleDeleteCategory(target.dataset.id); }
        else if (action === 'delete-expense') { handleDeleteExpense(target.dataset.categoryId, target.dataset.expenseId); }
        else if (action === 'edit-item') { state.editingItem = { type: target.dataset.type, id: target.dataset.id, categoryId: target.dataset.categoryId }; render(); }
        else if (action === 'cancel-edit') { state.editingItem = null; render(); }
    };
    appContainer.onsubmit = function(e) { e.preventDefault(); handleFormSubmit(e.target); };
    appContainer.onchange = function(e) { if (e.target.id === 'month-select') { state.selectedMonthId = e.target.value; setupCategorySnapshot(); } };
}

function handleLogout() { cleanupListeners(); signOut(auth).catch(err => console.error("Logout Error:", err)); }
function handleShare() {
    if (state.selectedMonthId) {
        const shareUrl = `${window.location.origin}${window.location.pathname}?userId=${state.user.uid}&monthId=${state.selectedMonthId}`;
        navigator.clipboard.writeText(shareUrl).then(() => alert('View-only link copied to clipboard!')).catch(err => { console.error('Failed to copy: ', err); prompt("Copy this link:", shareUrl); });
    } else { alert('Please select a month to share.'); }
}
function togglePasswordVisibility(button) { const input = button.previousElementSibling; if (input.type === 'password') { input.type = 'text'; button.textContent = '🙈'; } else { input.type = 'password'; button.textContent = '👁️'; } }

async function handleDeleteCategory(categoryId) {
    if (confirm('Are you sure you want to delete this category and all its expenses?')) {
        const docRef = doc(db, `users/${state.user.uid}/categories`, categoryId);
        await deleteDoc(docRef);
    }
}
async function handleDeleteExpense(categoryId, expenseId) {
    if (confirm('Are you sure you want to delete this expense?')) {
        const category = state.categories.find(c => c.id === categoryId);
        if (category) {
            const expenseToDelete = category.expenses.find(e => e.id === expenseId);
            if (expenseToDelete) {
                const docRef = doc(db, `users/${state.user.uid}/categories`, categoryId);
                await updateDoc(docRef, { expenses: arrayRemove(expenseToDelete) });
            }
        }
    }
}

async function handleFormSubmit(form) {
    if (!isFirebaseInitialized) { state.error = "Application is still initializing..."; render(); return; }
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());
    state.error = null;
    state.notification = null;

    try {
        switch (form.id) {
            case 'login-form': await signInWithEmailAndPassword(auth, data.email, data.password); break;
            case 'register-form': if (data.password !== data.confirmPassword) throw new Error("Passwords do not match."); await createUserWithEmailAndPassword(auth, data.email, data.password); break;
            case 'forgot-password-form': await sendPasswordResetEmail(auth, data.email); state.notification = 'Password reset email sent!'; render(); break;
            case 'add-budget-form':
                if (!state.user) throw new Error("You must be logged in.");
                const budgetCode = Math.random().toString(36).substring(2, 8).toUpperCase();
                await addDoc(collection(db, `users/${state.user.uid}/monthlyBudgets`), { title: data.title, totalBudget: Number(data.totalBudget), owner: state.user.uid, code: budgetCode, createdAt: Timestamp.now() });
                break;
            case 'edit-budget-form':
                if (!state.user || !state.editingItem) throw new Error("Editing error.");
                await updateDoc(doc(db, `users/${state.user.uid}/monthlyBudgets`, state.editingItem.id), { title: data.title, totalBudget: Number(data.totalBudget) });
                state.editingItem = null;
                render();
                break;
            case 'add-category-form':
                if (!state.user || !state.selectedMonthId) return;
                await addDoc(collection(db, `users/${state.user.uid}/categories`), { name: data.name, monthlyBudgetId: state.selectedMonthId, owner: state.user.uid, expenses: [] });
                form.reset();
                break;
            default:
                if (form.classList.contains('add-expense-form')) {
                    const categoryId = form.dataset.categoryId;
                    if (!state.user || !categoryId) return;
                    const newExpense = { id: Math.random().toString(36).substring(2), description: data.description, amount: Number(data.amount), date: Timestamp.fromDate(new Date(data.date)) };
                    await updateDoc(doc(db, `users/${state.user.uid}/categories`, categoryId), { expenses: arrayUnion(newExpense) });
                    form.reset();
                } else if (form.classList.contains('edit-category-form')) {
                    await updateDoc(doc(db, `users/${state.user.uid}/categories`, form.dataset.id), { name: data.name });
                    state.editingItem = null;
                    render();
                } else if (form.classList.contains('edit-expense-form')) {
                    const { categoryId, expenseId } = form.dataset;
                    const category = state.categories.find(c => c.id === categoryId);
                    const newExpenses = category.expenses.map(exp => exp.id === expenseId ? { ...exp, description: data.description, amount: Number(data.amount), date: Timestamp.fromDate(new Date(data.date)) } : exp);
                    await updateDoc(doc(db, `users/${state.user.uid}/categories`, categoryId), { expenses: newExpenses });
                    state.editingItem = null;
                    render();
                }
        }
    } catch (err) { state.error = err.message; render(); }
}

// --- FIREBASE LOGIC ---
function initializeFirebase() {
    try {
        const app = initializeApp(window.firebaseConfig);
        db = getFirestore(app);
        auth = getAuth(app);
        isFirebaseInitialized = true;
        onAuthStateChanged(auth, (user) => {
            const urlParams = new URLSearchParams(window.location.search);
            const viewOnlyUserId = urlParams.get('userId');
            const viewOnlyMonthId = urlParams.get('monthId');
            state.user = user;
            if (user) {
                state.isEditor = !(viewOnlyUserId && user.uid !== viewOnlyUserId);
                state.viewOnlyUserId = viewOnlyUserId && !state.isEditor ? viewOnlyUserId : null;
                state.selectedMonthId = viewOnlyMonthId || state.selectedMonthId;
                state.currentView = 'app';
                setupSnapshots();
            } else {
                cleanupListeners();
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
    } catch (e) { console.error("Firebase initialization error:", e); state.error = "Failed to initialize the application."; state.currentView = 'auth'; render(); }
}

let monthlyUnsubscribe = null;
let categoryUnsubscribe = null;

function cleanupListeners() {
    if (monthlyUnsubscribe) monthlyUnsubscribe();
    if (categoryUnsubscribe) categoryUnsubscribe();
    monthlyUnsubscribe = null;
    categoryUnsubscribe = null;
}

function setupSnapshots() {
    const userIdToFetch = state.viewOnlyUserId || state.user?.uid;
    if (!db || !userIdToFetch) { state.isLoading = false; render(); return; }
    cleanupListeners();
    state.isLoading = true;
    const monthlyCollectionPath = `users/${userIdToFetch}/monthlyBudgets`;
    monthlyUnsubscribe = onSnapshot(query(collection(db, monthlyCollectionPath)), (snapshot) => {
        state.monthlyBudgets = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const selectedExists = state.monthlyBudgets.some(b => b.id === state.selectedMonthId);
        if (!state.selectedMonthId || !selectedExists) {
            state.selectedMonthId = state.monthlyBudgets.length > 0 ? state.monthlyBudgets[0].id : '';
        }
        state.isLoading = false;
        setupCategorySnapshot();
    }, err => { console.error("Error fetching monthly budgets:", err); state.isLoading = false; render(); });
}

function setupCategorySnapshot() {
    const userIdToFetch = state.viewOnlyUserId || state.user?.uid;
    if (categoryUnsubscribe) categoryUnsubscribe();
    if (!db || !userIdToFetch || !state.selectedMonthId) { state.categories = []; render(); return; }
    const categoriesCollectionPath = `users/${userIdToFetch}/categories`;
    const q = query(collection(db, categoriesCollectionPath), where("monthlyBudgetId", "==", state.selectedMonthId));
    categoryUnsubscribe = onSnapshot(q, (snapshot) => {
        state.categories = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), expenses: doc.data().expenses || [] }));
        render();
    }, err => { console.error("Error fetching categories:", err); render(); });
}

// --- Start the app ---
function startApp() {
    let attempts = 0; const maxAttempts = 50;
    const interval = setInterval(() => {
        if (typeof window.firebaseConfig !== 'undefined' && window.firebaseConfig.apiKey) {
            clearInterval(interval);
            initializeFirebase();
        } else if (++attempts > maxAttempts) {
            clearInterval(interval);
            console.error("Firebase config failed to load.");
            document.getElementById('app-container').innerHTML = `<div class="loader-container"><p class="text-red-500 text-lg font-semibold">Error: App config failed to load.</p><p class="text-gray-300 mt-2">Please try a hard refresh (Ctrl+Shift+R).</p></div>`;
        }
    }, 100);
}

// Initial Load
document.addEventListener('DOMContentLoaded', () => { render(); startApp(); });
