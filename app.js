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
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-storage.js";

// --- GLOBAL STATE & CONFIG ---
let db, auth, storage;
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
    editingItem: null, // { type, id, ... }
    sortConfig: { key: 'name', direction: 'asc' },
    error: null,
    notification: null,
    isUploading: false
};

// --- ICONS ---
const ICONS = {
    eye: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>`,
    eyeSlash: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.243 4.243L6.228 6.228" /></svg>`,
    edit: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" /></svg>`,
    trash: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>`,
    share: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 100-2.186m0 2.186c-.18.324-.283.696-.283 1.093s.103.77.283 1.093m-7.5-12.96l7.5 4.167" /></svg>`,
    download: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>`,
    plus: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>`,
    receipt: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>`,
};

// --- HELPER FUNCTIONS ---
const formatCurrency = (value) => `Rp ${new Intl.NumberFormat('id-ID').format(Math.round(value))}`;
const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = dateString.toDate ? dateString.toDate() : new Date(dateString);
    return date.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' });
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
    appContainer.innerHTML = ''; // Clear previous content to prevent event listener duplication

    let html = '';
    switch (state.currentView) {
        case 'loading': html = `<div class="loader-container"><div class="loader"></div><p class="loader-text">Loading Application...</p></div>`; break;
        case 'auth': html = renderAuthView(); break;
        case 'app': html = renderAppView(); break;
    }
    appContainer.innerHTML = html;
    attachEventListeners();

    if (state.currentView === 'app' && state.selectedMonthId) {
        const selectedMonthlyBudget = state.monthlyBudgets.find(b => b.id === state.selectedMonthId);
        if (selectedMonthlyBudget) {
            renderChartJS(selectedMonthlyBudget);
        }
    }
}

function renderAuthView() {
    let formHtml = '';
    if (state.authView === 'login') {
        formHtml = `
            <h2>Login</h2>
            <form id="login-form">
                <div><label for="email">Email</label><input type="email" id="email" name="email" required></div>
                <div class="password-wrapper"><label for="password">Password</label><input type="password" id="password" name="password" required><button type="button" data-action="toggle-password">${ICONS.eye}</button></div>
                <button type="submit" class="btn btn-primary w-full">Login</button>
            </form>
            <div class="links"><a href="#" data-view="forgotPassword" class="btn-link">Forgot Password?</a><p>Don't have an account? <a href="#" data-view="register" class="btn-link">Register</a></p></div>`;
    } else if (state.authView === 'register') {
         formHtml = `
            <h2>Register</h2>
            <form id="register-form">
                <div><label for="email">Email</label><input type="email" id="email" name="email" required></div>
                <div class="password-wrapper"><label for="password">Password</label><input type="password" id="password" name="password" required><button type="button" data-action="toggle-password">${ICONS.eye}</button></div>
                <div class="password-wrapper"><label for="confirmPassword">Confirm Password</label><input type="password" id="confirmPassword" name="confirmPassword" required><button type="button" data-action="toggle-password">${ICONS.eye}</button></div>
                <button type="submit" class="btn btn-primary w-full">Register</button>
            </form>
            <div class="links"><p>Already have an account? <a href="#" data-view="login" class="btn-link">Login</a></p></div>`;
    } else { // forgotPassword
         formHtml = `
            <h2>Reset Password</h2>
            <form id="forgot-password-form">
                <div><label for="email">Enter your email</label><input type="email" id="email" name="email" required></div>
                <button type="submit" class="btn btn-primary w-full">Send Reset Link</button>
            </form>
            <div class="links"><a href="#" data-view="login" class="btn-link">Back to Login</a></div>`;
    }
    return `<div class="auth-container"><div class="auth-card">${state.error ? `<div class="notification error">${state.error}</div>` : ''}${state.notification ? `<div class="notification success">${state.notification}</div>` : ''}${formHtml}</div></div>`;
}

function renderAddOrEditBudgetForm() {
    const isEditing = state.editingItem?.type === 'budget' && state.editingItem.id;
    const budget = isEditing ? state.monthlyBudgets.find(b => b.id === state.editingItem.id) : null;
    
    return `<form id="${isEditing ? 'edit-budget-form' : 'add-budget-form'}" class="card">
        <h2 style="font-size: 1.5rem; font-weight: 700; margin: 0 0 1rem 0;">${isEditing ? 'Edit Monthly Budget' : 'Create New Monthly Budget'}</h2>
        <div class="form-grid">
            <div class="col-span-2"><label for="budget-title">Budget Title</label><input type="text" id="budget-title" name="title" value="${budget?.title || ''}" placeholder="e.g., Q3 Marketing" required></div>
            <div><label for="nomer-pengajuan">Nomer Pengajuan</label><input type="text" id="nomer-pengajuan" name="nomerPengajuan" value="${budget?.nomerPengajuan || ''}" placeholder="e.g., NP-001" required></div>
            <div><label for="creation-date">Creation Date</label><input type="date" id="creation-date" name="creationDate" value="${toInputDate(budget?.creationDate)}" required></div>
            <div><label for="total-budget">Total Budget Amount</label><input type="number" id="total-budget" name="totalBudget" value="${budget?.totalBudget || ''}" placeholder="e.g., 5000000" required></div>
            <div class="col-span-2"><label for="approval-doc">Proof of Approval (PDF/Image)</label><input type="file" id="approval-doc" name="approvalDoc">
             ${budget?.approvalDocUrl ? `<div style="margin-top: 0.5rem; font-size: 0.75rem;">Current: <a href="${budget.approvalDocUrl}" target="_blank" class="btn-link">${budget.approvalDocName || 'View File'}</a></div>` : ''}
            </div>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; margin-top: 1rem;">
            <div>
                <button type="submit" class="btn btn-primary" ${state.isUploading ? 'disabled' : ''}>${state.isUploading ? 'Uploading...' : (isEditing ? 'Save Changes' : 'Create Budget')}</button>
                <button type="button" data-action="cancel-edit" class="btn">Cancel</button>
            </div>
            ${isEditing ? `<button type="button" data-action="delete-budget" data-id="${budget.id}" class="btn btn-danger">Delete Budget</button>` : ''}
        </div>
    </form>`;
}

function renderProgressBar(current, total) {
    const percentage = total > 0 ? (current / total) * 100 : 0;
    const displayPercentage = Math.min(percentage, 100);
    let barClass = '';
    if (percentage > 100) barClass = 'danger';
    else if (percentage > 85) barClass = 'warning';
    
    return `<div class="progress-bar-container"><div class="progress-bar ${barClass}" style="width: ${displayPercentage}%"></div></div>`;
}

function renderDashboard(budget) {
    const totalSpent = state.categories.reduce((total, category) => total + (category.expenses ? category.expenses.reduce((sum, exp) => sum + exp.amount, 0) : 0), 0);
    const remaining = budget.totalBudget - totalSpent;
    return `
        <div class="dashboard-grid">
            <div class="card">
                <h3 style="font-size: 1.25rem; font-weight: 600; margin:0 0 1rem 0;">Overview</h3>
                <div class="stats-grid">
                    <div class="stat-card"><div class="label">Total Budget</div><div class="value positive">${formatCurrency(budget.totalBudget)}</div></div>
                    <div class="stat-card"><div class="label">Spent</div><div class="value neutral">${formatCurrency(totalSpent)}</div></div>
                    <div class="stat-card"><div class="label">Remaining</div><div class="value ${remaining < 0 ? 'negative' : 'positive'}">${formatCurrency(remaining)}</div></div>
                </div>
                ${renderProgressBar(totalSpent, budget.totalBudget)}
            </div>
            <div class="card">
                 <h3 style="font-size: 1.25rem; font-weight: 600; margin:0 0 1rem 0;">Spending Chart</h3>
                <canvas id="budget-chart" style="max-height: 200px;"></canvas>
            </div>
        </div>`;
}

function renderCategorySection(monthlyBudget) {
    const sortedCategories = [...state.categories].sort((a, b) => {
        const key = state.sortConfig.key;
        const dir = state.sortConfig.direction === 'asc' ? 1 : -1;
        if (a[key] < b[key]) return -1 * dir;
        if (a[key] > b[key]) return 1 * dir;
        return 0;
    });

    const categoryListHtml = sortedCategories.map(cat => {
        const isEditingCat = state.editingItem?.type === 'category' && state.editingItem.id === cat.id;
        if (isEditingCat) {
            return `<form class="edit-category-form card" data-id="${cat.id}"><h4 style="font-size: 1.125rem; font-weight: 700; margin:0 0 1rem 0;">Edit Category</h4><div class="form-grid"><input type="text" name="name" value="${cat.name}" required><input type="number" name="budget" value="${cat.budget || ''}" placeholder="Category Budget" required></div><div style="display: flex; gap: 0.5rem; margin-top: 1rem;"><button type="submit" class="btn btn-primary btn-sm">Save</button><button type="button" data-action="cancel-edit" class="btn btn-sm">Cancel</button></div></form>`;
        }

        const totalExpenses = cat.expenses ? cat.expenses.reduce((sum, exp) => sum + exp.amount, 0) : 0;
        return `
            <div class="category-card">
                <div class="category-card-header">
                    <div><h4>${cat.name}</h4></div>
                    <div class="actions">
                        ${state.isEditor ? `<button class="btn btn-icon" data-action="edit-item" data-type="category" data-id="${cat.id}" title="Edit Category">${ICONS.edit}</button><button class="btn btn-icon" style="color: var(--danger);" data-action="delete-category" data-id="${cat.id}" title="Delete Category">${ICONS.trash}</button>` : ''}
                    </div>
                </div>
                <div class="category-budget-info">Used ${formatCurrency(totalExpenses)} of ${formatCurrency(cat.budget)}</div>
                ${renderProgressBar(totalExpenses, cat.budget)}
                <ul class="expense-list">
                    ${cat.expenses && cat.expenses.map(exp => {
                        const isEditingExp = state.editingItem?.type === 'expense' && state.editingItem.id === exp.id;
                        if (isEditingExp) {
                            return `<li style="padding: 1rem; background-color: var(--bg-med); border-radius: var(--border-radius); border: 1px solid var(--border-color);"><form class="edit-expense-form" data-category-id="${cat.id}" data-expense-id="${exp.id}"><input type="text" name="description" value="${exp.description}" required><div class="form-grid"><input type="number" name="amount" value="${exp.amount}" required><input type="date" name="date" value="${toInputDate(exp.date)}" required></div><input type="file" name="receipt">${exp.receiptUrl ? `<div style="margin-top: 0.25rem; font-size: 0.75rem;">Current: <a href="${exp.receiptUrl}" target="_blank" class="btn-link">${exp.receiptName || 'View Receipt'}</a></div>` : ''}<div style="display: flex; gap: 0.5rem; margin-top: 1rem;"><button type="submit" class="btn btn-primary btn-sm" ${state.isUploading ? 'disabled' : ''}>${state.isUploading ? '...' : 'Save'}</button><button type="button" data-action="cancel-edit" class="btn btn-sm">Cancel</button></div></form></li>`;
                        }
                        return `<li class="expense-item"><div class="details"><span>${exp.description}</span><span class="date">${formatDate(exp.date)}</span></div><div class="actions"><span>${formatCurrency(exp.amount)}</span>${exp.receiptUrl ? `<a href="${exp.receiptUrl}" target="_blank" class="btn btn-icon" title="View Receipt">${ICONS.receipt}</a>` : ''}${state.isEditor ? `<button class="btn btn-icon" data-action="edit-item" data-type="expense" data-category-id="${cat.id}" data-id="${exp.id}" title="Edit Expense">${ICONS.edit}</button><button class="btn btn-icon" style="color: var(--danger);" data-action="delete-expense" data-category-id="${cat.id}" data-expense-id="${exp.id}" title="Delete Expense">${ICONS.trash}</button>` : ''}</div></li>`;
                    }).join('') || `<li class="text-sm text-gray-400">No expenses added yet.</li>`}
                </ul>
                ${state.isEditor ? `<form class="add-expense-form" data-category-id="${cat.id}"><input type="text" name="description" placeholder="New expense..." required><div class="form-grid"><input type="number" name="amount" placeholder="Amount" required><input type="date" name="date" value="${toInputDate(null)}" required></div><input type="file" name="receipt"><button type="submit" class="btn btn-sm" ${state.isUploading ? 'disabled' : ''}>${ICONS.plus} ${state.isUploading ? '...' : 'Add Expense'}</button></form>` : ''}
            </div>`;
    }).join('');

    const totalCategoryBudget = state.categories.reduce((sum, cat) => sum + (Number(cat.budget) || 0), 0);
    const budgetExceeded = totalCategoryBudget > monthlyBudget.totalBudget;

    return `
        <div>
            <div class="category-header">
                <h3 style="font-size: 1.5rem; font-weight: 700; margin:0;">Categories</h3>
                <div style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.875rem;">
                    <label for="sort-key">Sort by:</label>
                    <select id="sort-key"><option value="name" ${state.sortConfig.key === 'name' ? 'selected' : ''}>Name</option><option value="budget" ${state.sortConfig.key === 'budget' ? 'selected' : ''}>Budget</option></select>
                    <select id="sort-dir"><option value="asc" ${state.sortConfig.direction === 'asc' ? 'selected' : ''}>Asc</option><option value="desc" ${state.sortConfig.direction === 'desc' ? 'selected' : ''}>Desc</option></select>
                </div>
            </div>
            ${state.isEditor ? `<form id="add-category-form" class="card" style="margin-bottom: 1.5rem;"><div class="form-grid"><input type="text" name="name" placeholder="New category name" required><input type="number" name="budget" placeholder="Budget" required></div><button type="submit" class="btn btn-primary" style="margin-top: 1rem;">${ICONS.plus} Add Category</button></form>` : ''}
            ${budgetExceeded ? `<div class="notification warning">Warning: Sum of category budgets (${formatCurrency(totalCategoryBudget)}) exceeds the total monthly budget.</div>` : ''}
            <div class="category-list">${categoryListHtml || '<p style="color: var(--text-med);">No categories added yet.</p>'}</div>
        </div>`;
}

function renderAppView() {
    if (state.isLoading) {
        return `<div class="loader-container"><div class="loader"></div><p class="loader-text">Loading Application...</p></div>`;
    }

    const selectedMonthlyBudget = state.monthlyBudgets.find(b => b.id === state.selectedMonthId);

    const headerHtml = `
        <header>
            <div>
                <h1>${selectedMonthlyBudget ? selectedMonthlyBudget.title : 'Budget Tracker'}</h1>
                ${selectedMonthlyBudget ? `<p class="page-subtitle">Nomer Pengajuan: ${selectedMonthlyBudget.nomerPengajuan}</p>` : ''}
            </div>
            <div class="header-actions">
                ${state.isEditor ? `<button class="btn btn-primary" data-action="add-budget">${ICONS.plus} New Budget</button>` : ''}
                ${state.isEditor && selectedMonthlyBudget ? `<button id="share-btn" class="btn">${ICONS.share} Share</button>` : ''}
                ${state.user ? `<button id="logout-btn" class="btn btn-danger">Logout</button>` : ''}
            </div>
        </header>`;

    let mainContent = '';
    if (state.editingItem?.type === 'budget') {
        mainContent = renderAddOrEditBudgetForm();
    } else if (selectedMonthlyBudget) {
        mainContent = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;">
                <div style="flex-grow: 1;"><label for="month-select">Select Budget:</label><select id="month-select">${state.monthlyBudgets.map(b => `<option value="${b.id}" ${b.id === state.selectedMonthId ? 'selected' : ''}>${b.title} (${b.nomerPengajuan})</option>`).join('')}</select></div>
                <div style="display: flex; gap: 0.5rem;">
                    <button class="btn btn-icon" data-action="edit-item" data-type="budget" data-id="${selectedMonthlyBudget.id}" title="Edit Current Budget">${ICONS.edit}</button>
                    <button id="download-csv-btn" class="btn btn-icon" title="Download Report">${ICONS.download}</button>
                </div>
            </div>
            ${renderDashboard(selectedMonthlyBudget)}
            ${renderCategorySection(selectedMonthlyBudget)}`;
    } else {
        mainContent = `<div class="text-center p-10 card"><h3 style="font-size: 1.25rem;">No monthly budgets found.</h3>${state.isEditor ? `<p style="color: var(--text-med); margin-top: 0.5rem;">Click "New Budget" to get started.</p>` : ''}</div>`;
    }

    return `<div class="app-main-container">${headerHtml}<main id="app-content">${state.error ? `<div class="notification error">${state.error}</div>` : ''}${mainContent}</main></div>`;
}

function renderChartJS(budget) {
    const ctx = document.getElementById('budget-chart');
    if (!ctx) return;
    if (chartInstance) chartInstance.destroy();
    
    const totalSpent = state.categories.reduce((total, category) => total + (category.expenses ? category.expenses.reduce((sum, exp) => sum + exp.amount, 0) : 0), 0);
    const remaining = budget.totalBudget - totalSpent;
    const labels = state.categories.map(c => c.name);
    const data = state.categories.map(c => c.expenses ? c.expenses.reduce((sum, exp) => sum + exp.amount, 0) : 0);
    
    if (remaining > 0) {
        labels.push('Remaining');
        data.push(remaining);
    }

    chartInstance = new Chart(ctx, { type: 'doughnut', data: { labels: labels.length > 0 ? labels : ['No Data'], datasets: [{ label: 'Amount', data: data.length > 0 ? data : [1], backgroundColor: ['#58a6ff', '#9333ea', '#db2777', '#d29922', '#3fb950', '#f85149', '#6e7681'], borderColor: '#161b22', borderWidth: 4 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: (context) => `${context.label || ''}: ${formatCurrency(context.parsed)}` } } } } });
}

// --- EVENT HANDLERS & LOGIC ---
function attachEventListeners() {
    const appContainer = document.getElementById('app-container');
    if (!appContainer) return;

    appContainer.onclick = function(e) {
        const target = e.target.closest('[data-action], button, a');
        if (!target) return;
        
        const action = target.dataset.action;
        state.error = null; // Clear previous errors on any action

        if (target.matches('a[data-view]')) { e.preventDefault(); state.authView = target.dataset.view; state.notification = null; render(); }
        else if (target.id === 'logout-btn') { handleLogout(); }
        else if (target.id === 'share-btn') { handleShare(); }
        else if (target.id === 'download-csv-btn') { handleDownloadCSV(); }
        else if (action === 'toggle-password') { togglePasswordVisibility(target); }
        else if (action === 'delete-category') { handleDeleteCategory(target.closest('[data-id]').dataset.id); }
        else if (action === 'delete-expense') { handleDeleteExpense(target.closest('[data-category-id]').dataset.categoryId, target.closest('[data-expense-id]').dataset.expenseId); }
        else if (action === 'delete-budget') { handleDeleteBudget(target.dataset.id); }
        else if (action === 'edit-item') { state.editingItem = { type: target.dataset.type, id: target.dataset.id, categoryId: target.dataset.categoryId }; render(); }
        else if (action === 'add-budget') { state.editingItem = { type: 'budget', id: null }; render(); }
        else if (action === 'cancel-edit') { state.editingItem = null; render(); }
    };
    appContainer.onsubmit = function(e) { e.preventDefault(); handleFormSubmit(e.target); };
    appContainer.onchange = function(e) {
        if (e.target.id === 'month-select') { state.selectedMonthId = e.target.value; setupCategorySnapshot(); }
        if (e.target.id === 'sort-key' || e.target.id === 'sort-dir') {
            state.sortConfig.key = document.getElementById('sort-key').value;
            state.sortConfig.direction = document.getElementById('sort-dir').value;
            render();
        }
    };
}

function handleLogout() { cleanupListeners(); signOut(auth).catch(err => console.error("Logout Error:", err)); }
function handleShare() {
    if (state.selectedMonthId) {
        const shareUrl = `${window.location.origin}${window.location.pathname}?userId=${state.user.uid}&monthId=${state.selectedMonthId}`;
        navigator.clipboard.writeText(shareUrl).then(() => alert('View-only link copied to clipboard!')).catch(err => { console.error('Failed to copy: ', err); prompt("Copy this link:", shareUrl); });
    } else { alert('Please select a month to share.'); }
}
function togglePasswordVisibility(button) { 
    const wrapper = button.closest('.password-wrapper');
    const input = wrapper.querySelector('input');
    if (input.type === 'password') { 
        input.type = 'text'; 
        button.innerHTML = ICONS.eyeSlash;
    } else { 
        input.type = 'password'; 
        button.innerHTML = ICONS.eye;
    } 
}

async function handleFileUpload(file) {
    if (!file || file.size === 0) return null;
    state.isUploading = true;
    render();
    const storageRef = ref(storage, `uploads/${state.user.uid}/${Date.now()}-${file.name}`);
    const snapshot = await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(snapshot.ref);
    state.isUploading = false;
    return { url: downloadURL, name: file.name };
}

async function handleDeleteBudget(budgetId) {
    if (confirm('Are you sure you want to delete this entire budget, including all its categories and expenses? This action cannot be undone.')) {
        try {
            // In a real app, you'd want to delete all sub-collections and storage files. 
            // This is simplified for this example. A cloud function is better for this.
            await deleteDoc(doc(db, `users/${state.user.uid}/monthlyBudgets`, budgetId));
            state.editingItem = null;
            state.selectedMonthId = ''; // Reset selection
            // The onSnapshot will automatically re-render the list.
        } catch (err) {
            state.error = "Failed to delete budget.";
            render();
        }
    }
}

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
                if (expenseToDelete.receiptUrl) {
                    try { await deleteObject(ref(storage, expenseToDelete.receiptUrl)); } catch (e) { console.error("Could not delete old receipt from storage:", e); }
                }
                const docRef = doc(db, `users/${state.user.uid}/categories`, categoryId);
                await updateDoc(docRef, { expenses: arrayRemove(expenseToDelete) });
            }
        }
    }
}

async function handleFormSubmit(form) {
    if (!isFirebaseInitialized || state.isUploading) return;
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());
    state.error = null;
    state.notification = null;

    try {
        switch (form.id) {
            case 'login-form': await signInWithEmailAndPassword(auth, data.email, data.password); break;
            case 'register-form': if (data.password !== data.confirmPassword) throw new Error("Passwords do not match."); await createUserWithEmailAndPassword(auth, data.email, data.password); break;
            case 'forgot-password-form': await sendPasswordResetEmail(auth, data.email); state.notification = 'Password reset email sent!'; render(); break;
            case 'add-budget-form': {
                if (!state.user) throw new Error("You must be logged in.");
                const file = formData.get('approvalDoc');
                const uploadResult = await handleFileUpload(file);
                const newDocRef = await addDoc(collection(db, `users/${state.user.uid}/monthlyBudgets`), { title: data.title, nomerPengajuan: data.nomerPengajuan, totalBudget: Number(data.totalBudget), owner: state.user.uid, creationDate: Timestamp.fromDate(new Date(data.creationDate)), approvalDocUrl: uploadResult?.url || null, approvalDocName: uploadResult?.name || null });
                state.selectedMonthId = newDocRef.id;
                state.editingItem = null;
                break;
            }
            case 'edit-budget-form': {
                if (!state.user || !state.editingItem) throw new Error("Editing error.");
                const file = formData.get('approvalDoc');
                const uploadResult = await handleFileUpload(file);
                const docRef = doc(db, `users/${state.user.uid}/monthlyBudgets`, state.editingItem.id);
                const updateData = { title: data.title, nomerPengajuan: data.nomerPengajuan, totalBudget: Number(data.totalBudget), creationDate: Timestamp.fromDate(new Date(data.creationDate)) };
                if (uploadResult) { updateData.approvalDocUrl = uploadResult.url; updateData.approvalDocName = uploadResult.name; }
                await updateDoc(docRef, updateData);
                state.editingItem = null;
                break;
            }
            case 'add-category-form': {
                if (!state.user || !state.selectedMonthId) return;
                const monthlyBudget = state.monthlyBudgets.find(b => b.id === state.selectedMonthId);
                const currentCategoryBudgets = state.categories.reduce((sum, cat) => sum + Number(cat.budget), 0);
                if (currentCategoryBudgets + Number(data.budget) > monthlyBudget.totalBudget) {
                    throw new Error("Total category budgets cannot exceed the total monthly budget.");
                }
                await addDoc(collection(db, `users/${state.user.uid}/categories`), { name: data.name, budget: Number(data.budget), monthlyBudgetId: state.selectedMonthId, owner: state.user.uid, expenses: [] });
                form.reset();
                break;
            }
            default:
                if (form.classList.contains('add-expense-form')) {
                    const categoryId = form.dataset.categoryId;
                    if (!state.user || !categoryId) return;
                    const monthlyBudget = state.monthlyBudgets.find(b => b.id === state.selectedMonthId);
                    const totalSpent = state.categories.reduce((total, category) => total + (category.expenses ? category.expenses.reduce((sum, exp) => sum + exp.amount, 0) : 0), 0);
                    if (totalSpent + Number(data.amount) > monthlyBudget.totalBudget) {
                        throw new Error("This expense exceeds the total monthly budget.");
                    }
                    const file = formData.get('receipt');
                    const uploadResult = await handleFileUpload(file);
                    const newExpense = { id: Math.random().toString(36).substring(2), description: data.description, amount: Number(data.amount), date: Timestamp.fromDate(new Date(data.date)), receiptUrl: uploadResult?.url || null, receiptName: uploadResult?.name || null };
                    await updateDoc(doc(db, `users/${state.user.uid}/categories`, categoryId), { expenses: arrayUnion(newExpense) });
                    form.reset();
                } else if (form.classList.contains('edit-category-form')) {
                    const categoryId = form.dataset.id;
                    const monthlyBudget = state.monthlyBudgets.find(b => b.id === state.selectedMonthId);
                    const otherCategoryBudgets = state.categories.filter(c => c.id !== categoryId).reduce((sum, cat) => sum + Number(cat.budget), 0);
                    if (otherCategoryBudgets + Number(data.budget) > monthlyBudget.totalBudget) {
                        throw new Error("Total category budgets cannot exceed the total monthly budget.");
                    }
                    await updateDoc(doc(db, `users/${state.user.uid}/categories`, categoryId), { name: data.name, budget: Number(data.budget) });
                    state.editingItem = null;
                } else if (form.classList.contains('edit-expense-form')) {
                    const { categoryId, expenseId } = form.dataset;
                    const monthlyBudget = state.monthlyBudgets.find(b => b.id === state.selectedMonthId);
                    const currentExpense = state.categories.find(c => c.id === categoryId)?.expenses.find(e => e.id === expenseId);
                    const totalSpent = state.categories.reduce((total, category) => total + (category.expenses ? category.expenses.reduce((sum, exp) => sum + exp.amount, 0) : 0), 0);
                    const newTotalSpent = totalSpent - (currentExpense?.amount || 0) + Number(data.amount);
                    if (newTotalSpent > monthlyBudget.totalBudget) {
                        throw new Error("This expense edit exceeds the total monthly budget.");
                    }
                    const file = formData.get('receipt');
                    const uploadResult = await handleFileUpload(file);
                    const category = state.categories.find(c => c.id === categoryId);
                    const newExpenses = category.expenses.map(exp => {
                        if (exp.id === expenseId) {
                            const updatedExp = { ...exp, description: data.description, amount: Number(data.amount), date: Timestamp.fromDate(new Date(data.date)) };
                            if (uploadResult) { updatedExp.receiptUrl = uploadResult.url; updatedExp.receiptName = uploadResult.name; }
                            return updatedExp;
                        }
                        return exp;
                    });
                    await updateDoc(doc(db, `users/${state.user.uid}/categories`, categoryId), { expenses: newExpenses });
                    state.editingItem = null;
                }
        }
    } catch (err) { state.error = err.message; }
    finally {
        state.isUploading = false;
        if (!state.error) {
            render(); 
        } else {
            // If there's an error, we want to show it but not clear the editing state
            const currentEditingItem = state.editingItem;
            render();
            state.editingItem = currentEditingItem;
        }
    }
}

function handleDownloadCSV() {
    const budget = state.monthlyBudgets.find(b => b.id === state.selectedMonthId);
    if (!budget) return;

    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Monthly Budget Report\n";
    csvContent += `Title,"${budget.title}"\n`;
    csvContent += `Nomer Pengajuan,"${budget.nomerPengajuan}"\n`;
    csvContent += `Creation Date,"${formatDate(budget.creationDate)}"\n`;
    csvContent += `Total Budget,"${budget.totalBudget}"\n`;
    csvContent += `Approval Document,"${budget.approvalDocUrl || 'N/A'}"\n\n`;
    csvContent += "Category,Expense,Amount,Date,Receipt\n";

    state.categories.forEach(cat => {
        if (cat.expenses.length === 0) {
            csvContent += `"${cat.name}",(No expenses yet),0,,\n`;
        } else {
            cat.expenses.forEach(exp => {
                csvContent += `"${cat.name}","${exp.description}","${exp.amount}","${formatDate(exp.date)}","${exp.receiptUrl || 'N/A'}"\n`;
            });
        }
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `budget_report_${budget.nomerPengajuan}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// --- FIREBASE LOGIC ---
function initializeFirebase() {
    try {
        const app = initializeApp(window.firebaseConfig);
        db = getFirestore(app);
        auth = getAuth(app);
        storage = getStorage(app);
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
