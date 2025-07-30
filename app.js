import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { 
    getAuth, 
    onAuthStateChanged, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    sendPasswordResetEmail,
    signOut
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, doc, addDoc, deleteDoc, updateDoc, onSnapshot, query, where, Timestamp, arrayUnion, arrayRemove, orderBy } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-storage.js";

// --- GLOBAL STATE & CONFIG ---
let db, auth, storage;
let monthlyChartInstance = null;
let expenseChartInstance = null;
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
    selectedCategoryId: null, // For detail view
    isLoading: true,
    editingItem: null, // { type, id, ... }
    sortConfig: { key: 'name', direction: 'asc' },
    isUploading: false
};

const CHART_COLORS = ['#58a6ff', '#9333ea', '#db2777', '#d29922', '#3fb950', '#f85149', '#8b949e'];

// --- ICONS ---
const ICONS = {
    eye: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M10.5 8a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z"/><path d="M0 8s3-5.5 8-5.5S16 8 16 8s-3 5.5-8 5.5S0 8 0 8zm8 3.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z"/></svg>`,
    eyeSlash: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="m10.79 12.912-1.614-1.615a3.5 3.5 0 0 1-4.474-4.474l-2.06-2.06C.938 6.278 0 8 0 8s3 5.5 8 5.5a7.029 7.029 0 0 0 2.79-.588zM5.21 3.088A7.028 7.028 0 0 1 8 2.5c5 0 8 5.5 8 5.5s-.939 1.721-2.641 3.238l-2.062-2.062a3.5 3.5 0 0 0-4.474-4.474L5.21 3.089z"/><path d="M5.525 7.646a2.5 2.5 0 0 0 2.829 2.829l-2.83-2.829zm4.95.708-2.829-2.83a2.5 2.5 0 0 1 2.829 2.829zm3.171 6-12-12 .708-.708 12 12-.708.708z"/></svg>`,
    edit: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M15.502 1.94a.5.5 0 0 1 0 .706L14.459 3.69l-2-2L13.502.646a.5.5 0 0 1 .707 0l1.293 1.293zm-1.75 2.456-2-2L4.939 9.21a.5.5 0 0 0-.121.196l-.805 2.414a.25.25 0 0 0 .316.316l2.414-.805a.5.5 0 0 0 .196-.12l6.813-6.814z"/><path fill-rule="evenodd" d="M1 13.5A1.5 1.5 0 0 0 2.5 15h11a1.5 1.5 0 0 0 1.5-1.5v-6a.5.5 0 0 0-1 0v6a.5.5 0 0 1-.5.5h-11a.5.5 0 0 1-.5-.5v-11a.5.5 0 0 1 .5-.5H9a.5.5 0 0 0 0-1H2.5A1.5 1.5 0 0 0 1 2.5v11z"/></svg>`,
    trash: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/><path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/></svg>`,
    share: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M13.5 1a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zM11 2.5a2.5 2.5 0 1 1 .603 1.628l-6.718 3.12a2.499 2.499 0 0 1 0 1.504l6.718 3.12a2.5 2.5 0 1 1-.488.876l-6.718-3.12a2.5 2.5 0 1 1 0-3.256l6.718-3.12A2.5 2.5 0 0 1 11 2.5zm-8.5 4a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm11 5.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z"/></svg>`,
    download: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z"/><path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708l3 3z"/></svg>`,
    plus: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4z"/></svg>`,
    receipt: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M1.5 0A1.5 1.5 0 0 0 0 1.5v13A1.5 1.5 0 0 0 1.5 16h13a1.5 1.5 0 0 0 1.5-1.5v-13A1.5 1.5 0 0 0 14.5 0h-13zM8 13a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H8z"/></svg>`,
    sortUp: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path fill-rule="evenodd" d="M8 15a.5.5 0 0 0 .5-.5V2.707l3.146 3.147a.5.5 0 0 0 .708-.708l-4-4a.5.5 0 0 0-.708 0l-4 4a.5.5 0 1 0 .708.708L7.5 2.707V14.5a.5.5 0 0 0 .5.5z"/></svg>`,
    sortDown: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path fill-rule="evenodd" d="M8 1a.5.5 0 0 1 .5.5v11.793l3.146-3.147a.5.5 0 0 1 .708.708l-4 4a.5.5 0 0 1-.708 0l-4-4a.5.5 0 0 1 .708-.708L7.5 13.293V1.5A.5.5 0 0 1 8 1z"/></svg>`,
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
    const scrollPosition = { x: window.scrollX, y: window.scrollY };
    
    appContainer.innerHTML = ''; // Clear previous content

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
            renderMonthlyChart(selectedMonthlyBudget);
            if (state.selectedCategoryId) {
                const category = state.categories.find(c => c.id === state.selectedCategoryId);
                if (category) renderExpenseChart(category);
            }
        }
    }
    window.scrollTo(scrollPosition.x, scrollPosition.y);
}

function renderAuthView() {
    let formHtml = '';
    if (state.authView === 'login') {
        formHtml = `
            <h2>Login</h2>
            <form id="login-form">
                <div><label for="email">Email</label><input type="email" id="email" name="email" required></div>
                <div class="password-wrapper"><label for="password">Password</label><input type="password" id="password" name="password" required><button type="button" data-action="toggle-password">${ICONS.eye}</button></div>
                <button type="submit" class="btn btn-primary">Login</button>
            </form>
            <div class="links"><a href="#" data-view="forgotPassword" class="btn-link">Forgot Password?</a><p>Don't have an account? <a href="#" data-view="register" class="btn-link">Register</a></p></div>`;
    } else if (state.authView === 'register') {
         formHtml = `
            <h2>Register</h2>
            <form id="register-form">
                <div><label for="email">Email</label><input type="email" id="email" name="email" required></div>
                <div class="password-wrapper"><label for="password">Password</label><input type="password" id="password" name="password" required><button type="button" data-action="toggle-password">${ICONS.eye}</button></div>
                <div class="password-wrapper"><label for="confirmPassword">Confirm Password</label><input type="password" id="confirmPassword" name="confirmPassword" required><button type="button" data-action="toggle-password">${ICONS.eye}</button></div>
                <button type="submit" class="btn btn-primary">Register</button>
            </form>
            <div class="links"><p>Already have an account? <a href="#" data-view="login" class="btn-link">Login</a></p></div>`;
    } else { // forgotPassword
         formHtml = `
            <h2>Reset Password</h2>
            <form id="forgot-password-form">
                <div><label for="email">Enter your email</label><input type="email" id="email" name="email" required></div>
                <button type="submit" class="btn btn-primary">Send Reset Link</button>
            </form>
            <div class="links"><a href="#" data-view="login" class="btn-link">Back to Login</a></div>`;
    }
    return `<div class="auth-container"><div class="auth-card">${formHtml}</div></div>`;
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
            <div class="col-span-2">
                <label for="approval-doc">Proof of Approval (PDF, JPG, PNG - Max 5MB)</label>
                <div class="custom-file-input">
                    <input type="file" id="approval-doc" name="approvalDoc" accept=".pdf,.jpg,.jpeg,.png">
                    <label for="approval-doc" class="file-input-label">
                        <span class="file-input-text">Upload proof of receipt here...</span>
                        <span class="file-input-button">Choose File</span>
                    </label>
                </div>
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
                <canvas id="monthly-chart" style="max-height: 200px; cursor: pointer;"></canvas>
            </div>
        </div>`;
}

function renderCategorySection(monthlyBudget) {
    const sortedCategories = [...state.categories].sort((a, b) => {
        const key = state.sortConfig.key;
        const dir = state.sortConfig.direction === 'asc' ? 1 : -1;
        if (key === 'name') {
            return a.name.localeCompare(b.name) * dir;
        }
        if (key === 'used') {
             const usedA = a.expenses ? a.expenses.reduce((sum, exp) => sum + exp.amount, 0) : 0;
             const usedB = b.expenses ? b.expenses.reduce((sum, exp) => sum + exp.amount, 0) : 0;
             return (usedA - usedB) * dir;
        }
        return (a.budget - b.budget) * dir;
    });

    const categoryListHtml = sortedCategories.map((cat, index) => {
        const isEditingCat = state.editingItem?.type === 'category' && state.editingItem.id === cat.id;
        if (isEditingCat) {
            return `<form class="edit-category-form card" data-id="${cat.id}"><h4 style="font-size: 1.125rem; font-weight: 700; margin:0 0 1rem 0;">Edit Category</h4><div class="form-grid"><input type="text" name="name" value="${cat.name}" required><input type="number" name="budget" value="${cat.budget || ''}" placeholder="Category Budget" required></div><div style="display: flex; gap: 0.5rem; margin-top: 1rem;"><button type="submit" class="btn btn-primary btn-sm">Save</button><button type="button" data-action="cancel-edit" class="btn btn-sm">Cancel</button></div></form>`;
        }

        const totalExpenses = cat.expenses ? cat.expenses.reduce((sum, exp) => sum + exp.amount, 0) : 0;
        const remaining = cat.budget - totalExpenses;
        const overBudgetHtml = `<span class="value negative">Over Budget by ${formatCurrency(Math.abs(remaining))}</span>`;
        const color = CHART_COLORS[index % CHART_COLORS.length];

        return `
            <div class="category-card">
                <div class="category-color-bar" style="background-color: ${color};"></div>
                <div class="category-card-content">
                    <div class="category-card-header">
                        <h4>${cat.name}</h4>
                        <div class="actions">
                            ${state.isEditor ? `<button class="btn btn-icon" data-action="edit-item" data-type="category" data-id="${cat.id}" title="Edit Category">${ICONS.edit}</button><button class="btn btn-icon" style="color: var(--danger);" data-action="delete-category" data-id="${cat.id}" title="Delete Category">${ICONS.trash}</button>` : ''}
                        </div>
                    </div>
                    <div class="category-budget-info">
                        <div>Total Budget<span>${formatCurrency(cat.budget)}</span></div>
                        <div>Used<span>${formatCurrency(totalExpenses)}</span></div>
                        <div>${remaining < 0 ? overBudgetHtml : `Remaining<span class="value positive">${formatCurrency(remaining)}</span>`}</div>
                    </div>
                    ${renderProgressBar(totalExpenses, cat.budget)}
                    <ul class="expense-list">
                        ${cat.expenses && cat.expenses.map(exp => {
                            const isEditingExp = state.editingItem?.type === 'expense' && state.editingItem.id === exp.id;
                            if (isEditingExp) {
                                return `<li style="padding: 1rem; background-color: var(--bg-med); border-radius: var(--border-radius); border: 1px solid var(--border-color);"><form class="edit-expense-form" data-category-id="${cat.id}" data-expense-id="${exp.id}"><input type="text" name="description" value="${exp.description}" placeholder="Description" required><div class="form-grid"><input type="number" name="amount" value="${exp.amount}" placeholder="Amount" required><input type="date" name="date" value="${toInputDate(exp.date)}" min="${toInputDate(monthlyBudget.creationDate)}" required></div><input type="file" name="receipt">${exp.receiptUrl ? `<div style="margin-top: 0.25rem; font-size: 0.75rem;">Current: <a href="${exp.receiptUrl}" target="_blank" class="btn-link">${exp.receiptName || 'View Receipt'}</a></div>` : ''}<div style="display: flex; gap: 0.5rem; margin-top: 1rem;"><button type="submit" class="btn btn-primary btn-sm" ${state.isUploading ? 'disabled' : ''}>${state.isUploading ? '...' : 'Save'}</button><button type="button" data-action="cancel-edit" class="btn btn-sm">Cancel</button></div></form></li>`;
                            }
                            return `<li class="expense-item"><div class="details"><span>${exp.description}</span><span class="date">${formatDate(exp.date)}</span></div><div class="actions"><span>${formatCurrency(exp.amount)}</span>${exp.receiptUrl ? `<a href="${exp.receiptUrl}" target="_blank" class="btn btn-icon" title="View Receipt">${ICONS.receipt}</a>` : ''}${state.isEditor ? `<button class="btn btn-icon" data-action="edit-item" data-type="expense" data-category-id="${cat.id}" data-id="${exp.id}" title="Edit Expense">${ICONS.edit}</button><button class="btn btn-icon" style="color: var(--danger);" data-action="delete-expense" data-category-id="${cat.id}" data-expense-id="${exp.id}" title="Delete Expense">${ICONS.trash}</button>` : ''}</div></li>`;
                        }).join('') || `<li class="text-sm text-gray-400">No expenses added yet.</li>`}
                    </ul>
                    ${state.isEditor ? `<form class="add-expense-form" data-category-id="${cat.id}"><input type="text" name="description" placeholder="New expense..." required><div class="form-grid"><input type="number" name="amount" placeholder="Amount" required><input type="date" name="date" value="${toInputDate(null)}" min="${toInputDate(monthlyBudget.creationDate)}" required></div><div class="custom-file-input"><input type="file" name="receipt" accept=".pdf,.jpg,.jpeg,.png"><label class="file-input-label"><span class="file-input-text">Upload receipt...</span><span class="file-input-button">Choose File</span></label></div><button type="submit" class="btn btn-sm" ${state.isUploading ? 'disabled' : ''}>${ICONS.plus} ${state.isUploading ? '...' : 'Add Expense'}</button></form>` : ''}
                </div>
            </div>`;
    }).join('');

    return `
        <div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                <h3 style="font-size: 1.5rem; font-weight: 700; margin:0;">Categories</h3>
                <div style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.875rem;">
                    <span style="color: var(--text-med);">Sort by:</span>
                    <button class="btn btn-icon" data-action="sort" data-key="name" title="Sort by Name">${state.sortConfig.key === 'name' ? (state.sortConfig.direction === 'asc' ? ICONS.sortUp : ICONS.sortDown) : ICONS.sortUp}</button>
                    <button class="btn btn-icon" data-action="sort" data-key="budget" title="Sort by Budget">${state.sortConfig.key === 'budget' ? (state.sortConfig.direction === 'asc' ? ICONS.sortUp : ICONS.sortDown) : ICONS.sortUp}</button>
                    <button class="btn btn-icon" data-action="sort" data-key="used" title="Sort by Used Amount">${state.sortConfig.key === 'used' ? (state.sortConfig.direction === 'asc' ? ICONS.sortUp : ICONS.sortDown) : ICONS.sortUp}</button>
                </div>
            </div>
            ${state.isEditor ? `<form id="add-category-form" class="card" style="margin-bottom: 1.5rem;"><div class="form-grid"><input type="text" name="name" placeholder="New category name" required><input type="number" name="budget" placeholder="Budget" required></div><button type="submit" class="btn btn-primary" style="margin-top: 1rem;">${ICONS.plus} Add Category</button></form>` : ''}
            <div class="category-list">${categoryListHtml}</div>
        </div>`;
}

function renderCategoryDetailView(category, monthlyBudget) {
    const totalExpenses = category.expenses ? category.expenses.reduce((sum, exp) => sum + exp.amount, 0) : 0;
    const remaining = category.budget - totalExpenses;
    const overBudgetHtml = `<span class="value negative">Over Budget by ${formatCurrency(Math.abs(remaining))}</span>`;

    return `
        <div style="margin-bottom: 1.5rem;">
            <button class="btn" data-action="back-to-all-categories">&larr; Back to All Categories</button>
        </div>
        <div class="dashboard-grid">
            <div class="card">
                <h3 style="font-size: 1.25rem; font-weight: 600; margin:0 0 1rem 0;">${category.name} Details</h3>
                <div class="stats-grid">
                    <div class="stat-card"><div class="label">Category Budget</div><div class="value positive">${formatCurrency(category.budget)}</div></div>
                    <div class="stat-card"><div class="label">Spent</div><div class="value neutral">${formatCurrency(totalExpenses)}</div></div>
                    <div class="stat-card">${remaining < 0 ? overBudgetHtml : `Remaining<div class="value positive">${formatCurrency(remaining)}</div>`}</div>
                </div>
                ${renderProgressBar(totalExpenses, category.budget)}
            </div>
            <div class="card">
                 <h3 style="font-size: 1.25rem; font-weight: 600; margin:0 0 1rem 0;">Expense Breakdown</h3>
                <canvas id="expense-chart" style="max-height: 200px;"></canvas>
            </div>
        </div>
        <div class="card" style="margin-top: 1.5rem;">
            <h3 style="font-size: 1.5rem; font-weight: 700; margin:0 0 1.5rem 0;">Expenses</h3>
            <ul class="expense-list">
                ${category.expenses && category.expenses.length > 0 ? category.expenses.map(exp => {
                     return `<li class="expense-item"><div class="details"><span>${exp.description}</span><span class="date">${formatDate(exp.date)}</span></div><div class="actions"><span>${formatCurrency(exp.amount)}</span>${exp.receiptUrl ? `<a href="${exp.receiptUrl}" target="_blank" class="btn btn-icon" title="View Receipt">${ICONS.receipt}</a>` : ''}${state.isEditor ? `<button class="btn btn-icon" data-action="edit-item" data-type="expense" data-category-id="${category.id}" data-id="${exp.id}" title="Edit Expense">${ICONS.edit}</button><button class="btn btn-icon" style="color: var(--danger);" data-action="delete-expense" data-category-id="${category.id}" data-expense-id="${exp.id}" title="Delete Expense">${ICONS.trash}</button>` : ''}</div></li>`;
                }).join('') : `<li class="text-sm text-gray-400">No expenses added yet.</li>`}
            </ul>
        </div>
    `;
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
        if (state.selectedCategoryId) {
            const category = state.categories.find(c => c.id === state.selectedCategoryId);
            mainContent = category ? renderCategoryDetailView(category, selectedMonthlyBudget) : renderCategorySection(selectedMonthlyBudget);
        } else {
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
        }
    } else {
        mainContent = `<div class="text-center p-10 card"><h3 style="font-size: 1.25rem;">No monthly budgets found.</h3>${state.isEditor ? `<p style="color: var(--text-med); margin-top: 0.5rem;">Click "New Budget" to get started.</p>` : ''}</div>`;
    }

    return `<div class="app-main-container">${headerHtml}<main id="app-content">${mainContent}</main></div>`;
}

function renderMonthlyChart(budget) {
    const ctx = document.getElementById('monthly-chart');
    if (!ctx) return;
    if (monthlyChartInstance) monthlyChartInstance.destroy();
    
    const totalSpent = state.categories.reduce((total, category) => total + (category.expenses ? category.expenses.reduce((sum, exp) => sum + exp.amount, 0) : 0), 0);
    const remaining = budget.totalBudget - totalSpent;
    const labels = state.categories.map(c => c.name);
    const data = state.categories.map(c => c.expenses ? c.expenses.reduce((sum, exp) => sum + exp.amount, 0) : 0);
    
    if (remaining > 0) {
        labels.push('Remaining');
        data.push(remaining);
    }

    monthlyChartInstance = new Chart(ctx, { type: 'doughnut', data: { labels: labels, datasets: [{ label: 'Amount', data: data, backgroundColor: [...CHART_COLORS, '#30363d'], borderColor: '#161b22', borderWidth: 4 }] }, options: { responsive: true, maintainAspectRatio: false, onClick: (e, elements) => {
        if (elements.length > 0) {
            const clickedIndex = elements[0].index;
            const clickedLabel = labels[clickedIndex];
            const category = state.categories.find(c => c.name === clickedLabel);
            if (category) {
                state.selectedCategoryId = category.id;
                render();
            }
        }
    }, plugins: { legend: { display: false }, tooltip: { callbacks: { label: (context) => `${context.label || ''}: ${formatCurrency(context.parsed)}` } } } } });
}

function renderExpenseChart(category) {
    const ctx = document.getElementById('expense-chart');
    if (!ctx) return;
    if (expenseChartInstance) expenseChartInstance.destroy();

    const labels = category.expenses.map(e => e.description);
    const data = category.expenses.map(e => e.amount);

    expenseChartInstance = new Chart(ctx, { type: 'doughnut', data: { labels: labels, datasets: [{ label: 'Amount', data: data, backgroundColor: CHART_COLORS, borderColor: '#161b22', borderWidth: 4 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: (context) => `${context.label || ''}: ${formatCurrency(context.parsed)}` } } } } });
}

function showModal(title, message) {
    const existingModal = document.getElementById('error-modal');
    if (existingModal) existingModal.remove();

    const modalHtml = `
        <div class="modal-overlay visible" id="error-modal" data-action="close-modal">
            <div class="modal-content">
                <h3>${title}</h3>
                <p>${message}</p>
                <button class="btn btn-primary" data-action="close-modal">OK</button>
            </div>
        </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

// --- EVENT HANDLERS & LOGIC ---
function attachEventListeners() {
    const appContainer = document.getElementById('app-container');
    if (!appContainer) return;

    appContainer.onclick = function(e) {
        const target = e.target.closest('[data-action], button, a');
        if (!target) return;
        
        const action = target.dataset.action;

        if (target.matches('a[data-view]')) { e.preventDefault(); state.authView = target.dataset.view; render(); }
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
        else if (action === 'back-to-all-categories') { state.selectedCategoryId = null; render(); }
        else if (action === 'sort') {
            const key = target.dataset.key;
            if (state.sortConfig.key === key) {
                state.sortConfig.direction = state.sortConfig.direction === 'asc' ? 'desc' : 'asc';
            } else {
                state.sortConfig.key = key;
                state.sortConfig.direction = 'asc';
            }
            render();
        }
    };
    document.body.onclick = function(e) {
        if (e.target.closest('[data-action="close-modal"]')) {
            const modal = document.getElementById('error-modal');
            if (modal) modal.remove();
        }
    }
    appContainer.onsubmit = function(e) { e.preventDefault(); handleFormSubmit(e.target); };
    appContainer.onchange = function(e) {
        if (e.target.id === 'month-select') { state.selectedMonthId = e.target.value; state.selectedCategoryId = null; setupCategorySnapshot(); }
        if (e.target.matches('input[type="file"]')) {
            const file = e.target.files[0];
            const label = e.target.closest('.custom-file-input').querySelector('.file-input-text');
            if (file && label) {
                label.textContent = file.name;
            } else if (label) {
                label.textContent = 'Upload proof of receipt here...';
            }
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
    if (file.size > 5 * 1024 * 1024) throw new Error("File size cannot exceed 5MB.");
    const validTypes = ['application/pdf', 'image/jpeg', 'image/png'];
    if (!validTypes.includes(file.type)) throw new Error("Invalid file type. Please upload PDF, JPG, or PNG.");

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
            await deleteDoc(doc(db, `users/${state.user.uid}/monthlyBudgets`, budgetId));
            state.editingItem = null;
            // The onSnapshot listener will automatically handle re-rendering and selecting the new latest budget.
        } catch (err) {
            showModal("Error", "Failed to delete budget.");
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
    let error = null;

    try {
        switch (form.id) {
            case 'login-form': await signInWithEmailAndPassword(auth, data.email, data.password); break;
            case 'register-form': if (data.password !== data.confirmPassword) throw new Error("Passwords do not match."); await createUserWithEmailAndPassword(auth, data.email, data.password); break;
            case 'forgot-password-form': await sendPasswordResetEmail(auth, data.email); alert('Password reset email sent!'); break;
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
                const remainingBudget = monthlyBudget.totalBudget - currentCategoryBudgets;
                if (Number(data.budget) > remainingBudget) {
                    throw new Error(`Budget exceeds limit. You have ${formatCurrency(remainingBudget)} remaining to allocate.`);
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
                    if (new Date(data.date) < monthlyBudget.creationDate.toDate()) {
                        throw new Error("Expense date cannot be before the budget's creation date.");
                    }
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
                    const remainingBudget = monthlyBudget.totalBudget - otherCategoryBudgets;
                    if (Number(data.budget) > remainingBudget) {
                        throw new Error(`Budget exceeds limit. You have ${formatCurrency(remainingBudget)} remaining to allocate for this category.`);
                    }
                    await updateDoc(doc(db, `users/${state.user.uid}/categories`, categoryId), { name: data.name, budget: Number(data.budget) });
                    state.editingItem = null;
                } else if (form.classList.contains('edit-expense-form')) {
                    const { categoryId, expenseId } = form.dataset;
                    const monthlyBudget = state.monthlyBudgets.find(b => b.id === state.selectedMonthId);
                    if (new Date(data.date) < monthlyBudget.creationDate.toDate()) {
                        throw new Error("Expense date cannot be before the budget's creation date.");
                    }
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
    } catch (err) { error = err.message; }
    finally {
        state.isUploading = false;
        if (error) {
            showModal('Error', error);
        } else {
            render(); 
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
    } catch (e) { console.error("Firebase initialization error:", e); showModal("Initialization Error", "Failed to initialize the application."); }
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
    
    const budgetsQuery = query(collection(db, `users/${userIdToFetch}/monthlyBudgets`), orderBy("creationDate", "desc"));

    monthlyUnsubscribe = onSnapshot(budgetsQuery, (snapshot) => {
        const previousSelectedId = state.selectedMonthId;
        state.monthlyBudgets = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        const selectedExists = state.monthlyBudgets.some(b => b.id === state.selectedMonthId);
        
        if (!selectedExists) {
            state.selectedMonthId = state.monthlyBudgets.length > 0 ? state.monthlyBudgets[0].id : '';
        }
        
        state.isLoading = false;
        
        if (state.selectedMonthId !== previousSelectedId || !categoryUnsubscribe) {
             setupCategorySnapshot();
        } else {
            render();
        }
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
            showModal("Configuration Error", "Application configuration failed to load. Please try a hard refresh (Ctrl+Shift+R).");
        }
    }, 100);
}

// Initial Load
document.addEventListener('DOMContentLoaded', () => { render(); startApp(); });
