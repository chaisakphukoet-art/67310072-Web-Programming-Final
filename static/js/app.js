const API_BASE = '/api';

const state = {
    user: null,
    accessToken: null,
    refreshToken: null,
    cart: [],
    products: [],
    categories: [],
    currentView: 'home',
    activeCategory: null,
    searchQuery: '',
    sortOrder: 'newest',
    pendingVerificationEmail: null
};

document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

async function initApp() {
    loadStoredSession();
    loadStoredCart();
    setupEventListeners();
    await loadCategories();
    await loadProducts();
    handleHashNavigation();
    updateUIForAuthState();
    updateCartBadge();
}

function loadStoredSession() {
    const token = localStorage.getItem('tn_access_token');
    const refresh = localStorage.getItem('tn_refresh_token');
    const userStr = localStorage.getItem('tn_user');

    if (token && userStr) {
        try {
            state.accessToken = token;
            state.refreshToken = refresh;
            state.user = JSON.parse(userStr);
        } catch (e) {
            clearSession();
        }
    }
}

function saveSession(accessToken, refreshToken, user) {
    state.accessToken = accessToken;
    state.refreshToken = refreshToken;
    state.user = user;
    localStorage.setItem('tn_access_token', accessToken);
    if (refreshToken) localStorage.setItem('tn_refresh_token', refreshToken);
    localStorage.setItem('tn_user', JSON.stringify(user));
    updateUIForAuthState();
}

function clearSession() {
    state.accessToken = null;
    state.refreshToken = null;
    state.user = null;
    localStorage.removeItem('tn_access_token');
    localStorage.removeItem('tn_refresh_token');
    localStorage.removeItem('tn_user');
    updateUIForAuthState();
}

function loadStoredCart() {
    const cartStr = localStorage.getItem('tn_cart');
    if (cartStr) {
        try {
            state.cart = JSON.parse(cartStr);
        } catch (e) {
            state.cart = [];
        }
    }
}

function saveCart() {
    localStorage.setItem('tn_cart', JSON.stringify(state.cart));
    updateCartBadge();
    renderCartDrawer();
}

function setupEventListeners() {
    window.addEventListener('hashchange', handleHashNavigation);

    const searchInput = document.getElementById('navbarSearchInput');
    if (searchInput) {
        let debounceTimer;
        searchInput.addEventListener('input', (e) => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                state.searchQuery = e.target.value.trim();
                if (state.currentView !== 'products') {
                    navigateTo('products');
                } else {
                    loadProducts();
                }
            }, 300);
        });
    }

    const sortSelect = document.getElementById('productSortSelect');
    if (sortSelect) {
        sortSelect.addEventListener('change', (e) => {
            state.sortOrder = e.target.value;
            loadProducts();
        });
    }

    const sidebarToggle = document.getElementById('sidebarToggleBtn');
    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', () => {
            const sidebar = document.getElementById('mainSidebar');
            if (sidebar) sidebar.classList.toggle('show');
        });
    }
}

function handleHashNavigation() {
    const hash = window.location.hash.replace('#', '') || 'home';
    navigateTo(hash, false);
}

function navigateTo(viewName, updateHash = true) {
    const validViews = ['home', 'products', 'orders', 'admin-products', 'admin-dashboard', 'about'];
    if (!validViews.includes(viewName)) viewName = 'home';

    if ((viewName === 'admin-products' || viewName === 'admin-dashboard') && (!state.user || state.user.role !== 'admin')) {
        showToast('Admin privileges required to access this section.', 'warning');
        openAuthModal('login');
        return;
    }

    if (viewName === 'orders' && !state.user) {
        showToast('Please sign in to view your orders.', 'info');
        openAuthModal('login');
        return;
    }

    state.currentView = viewName;
    if (updateHash) {
        window.location.hash = viewName;
    }

    document.querySelectorAll('.app-view').forEach(view => {
        view.classList.add('d-none');
    });

    const targetView = document.getElementById(`view-${viewName}`);
    if (targetView) {
        targetView.classList.remove('d-none');
    }

    document.querySelectorAll('.nav-link-custom').forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('data-view') === viewName) {
            link.classList.add('active');
        }
    });

    const sidebar = document.getElementById('mainSidebar');
    if (sidebar && window.innerWidth < 992) {
        sidebar.classList.remove('show');
    }

    if (viewName === 'products') loadProducts();
    if (viewName === 'orders') loadMyOrders();
    if (viewName === 'admin-products') loadAdminProducts();
    if (viewName === 'admin-dashboard') loadAdminDashboard();
}

function updateUIForAuthState() {
    const unauthNav = document.getElementById('unauthenticatedNav');
    const authNav = document.getElementById('authenticatedNav');
    const adminLinks = document.querySelectorAll('.admin-only-link');
    const memberLinks = document.querySelectorAll('.member-only-link');
    const userNameDisplay = document.getElementById('navUserDisplayName');
    const userRoleBadge = document.getElementById('navUserRoleBadge');

    if (state.user && state.accessToken) {
        if (unauthNav) unauthNav.classList.add('d-none');
        if (authNav) authNav.classList.remove('d-none');

        if (userNameDisplay) userNameDisplay.textContent = state.user.username;
        if (userRoleBadge) {
            userRoleBadge.textContent = state.user.role.toUpperCase();
            userRoleBadge.className = state.user.role === 'admin'
                ? 'badge bg-danger ms-2'
                : 'badge bg-primary ms-2';
        }

        const isAdmin = state.user.role === 'admin';
        adminLinks.forEach(el => el.classList.toggle('d-none', !isAdmin));
        memberLinks.forEach(el => el.classList.remove('d-none'));
    } else {
        if (unauthNav) unauthNav.classList.remove('d-none');
        if (authNav) authNav.classList.add('d-none');
        adminLinks.forEach(el => el.classList.add('d-none'));
        memberLinks.forEach(el => el.classList.add('d-none'));
    }

    renderFeaturedProducts();
    renderProductsGrid();
}

async function apiRequest(endpoint, method = 'GET', body = null, requireAuth = false) {
    const headers = {
        'Content-Type': 'application/json'
    };

    if (requireAuth && state.accessToken) {
        headers['Authorization'] = `Bearer ${state.accessToken}`;
    }

    const options = {
        method,
        headers
    };

    if (body) {
        options.body = JSON.stringify(body);
    }

    try {
        const response = await fetch(`${API_BASE}${endpoint}`, options);
        const data = await response.json().catch(() => ({}));

        if (response.status === 401 && requireAuth && state.refreshToken) {
            const refreshed = await tryRefreshToken();
            if (refreshed) {
                headers['Authorization'] = `Bearer ${state.accessToken}`;
                const retryResponse = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });
                return {
                    status: retryResponse.status,
                    ok: retryResponse.ok,
                    data: await retryResponse.json().catch(() => ({}))
                };
            }
        }

        return {
            status: response.status,
            ok: response.ok,
            data
        };
    } catch (error) {
        return {
            status: 500,
            ok: false,
            data: { error: 'Unable to connect to the server. Please check your connection.' }
        };
    }
}

async function tryRefreshToken() {
    if (!state.refreshToken) return false;
    try {
        const res = await fetch(`${API_BASE}/token/refresh/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh: state.refreshToken })
        });
        if (res.ok) {
            const data = await res.json();
            state.accessToken = data.access;
            localStorage.setItem('tn_access_token', data.access);
            return true;
        }
    } catch (e) {
        clearSession();
    }
    return false;
}

async function handleLoginSubmit(event) {
    event.preventDefault();
    const form = event.target;
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Signing in...';

    const payload = {
        username: form.username.value.trim(),
        password: form.password.value
    };

    const res = await apiRequest('/token/', 'POST', payload);
    submitBtn.disabled = false;
    submitBtn.innerHTML = 'Sign In';

    if (res.ok) {
        saveSession(res.data.access, res.data.refresh, res.data.user);
        bootstrap.Modal.getInstance(document.getElementById('authModal')).hide();
        form.reset();
        showToast(`Welcome back, ${res.data.user.username}!`, 'success');
        if (res.data.user.role === 'admin') {
            navigateTo('admin-dashboard');
        }
    } else {
        if (res.data.is_unverified) {
            state.pendingVerificationEmail = res.data.email;
            bootstrap.Modal.getInstance(document.getElementById('authModal')).hide();
            openOtpModal(res.data.email);
            showToast('Please check your email for the OTP verification code.', 'warning');
        } else {
            const errorMsg = res.data.detail || res.data.error || 'Invalid username or password.';
            showToast(errorMsg, 'danger');
        }
    }
}

async function handleRegisterSubmit(event) {
    event.preventDefault();
    const form = event.target;
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Creating Account...';

    const payload = {
        username: form.reg_username.value.trim(),
        email: form.reg_email.value.trim().toLowerCase(),
        password: form.reg_password.value,
        first_name: form.reg_first_name.value.trim(),
        last_name: form.reg_last_name.value.trim(),
        phone: form.reg_phone.value.trim(),
        role: form.reg_role.value
    };

    const res = await apiRequest('/register/', 'POST', payload);
    submitBtn.disabled = false;
    submitBtn.innerHTML = 'Create Account';

    if (res.ok) {
        state.pendingVerificationEmail = res.data.email;
        bootstrap.Modal.getInstance(document.getElementById('authModal')).hide();
        form.reset();
        openOtpModal(res.data.email);
        showToast('Registration successful! Please check your email for the OTP code.', 'success');
    } else {
        let errorMsg = 'Registration failed. ';
        for (const [key, val] of Object.entries(res.data)) {
            errorMsg += `${key}: ${Array.isArray(val) ? val.join(' ') : val} `;
        }
        showToast(errorMsg, 'danger');
    }
}

function openOtpModal(email) {
    document.getElementById('otpModalEmailDisplay').textContent = email;
    const input = document.getElementById('otpCodeInput');
    if (input) {
        input.value = '';
        setTimeout(() => input.focus(), 400);
    }
    const modal = new bootstrap.Modal(document.getElementById('otpVerificationModal'));
    modal.show();
}

async function handleOtpSubmit(event) {
    event.preventDefault();
    const form = event.target;
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Verifying...';

    const payload = {
        email: state.pendingVerificationEmail,
        code: form.otpCode.value.trim()
    };

    const res = await apiRequest('/verify-email/', 'POST', payload);
    submitBtn.disabled = false;
    submitBtn.innerHTML = 'Verify Account';

    if (res.ok) {
        saveSession(res.data.access, res.data.refresh, res.data.user);
        bootstrap.Modal.getInstance(document.getElementById('otpVerificationModal')).hide();
        form.reset();
        showToast('Email verified successfully! You are now signed in.', 'success');
    } else {
        showToast(res.data.error || 'Invalid OTP code. Please try again.', 'danger');
    }
}

async function resendOtpCode() {
    if (!state.pendingVerificationEmail) return;
    const res = await apiRequest('/resend-code/', 'POST', { email: state.pendingVerificationEmail });
    if (res.ok) {
        const input = document.getElementById('otpCodeInput');
        if (input) input.value = '';
        showToast('A new OTP code has been sent to your email.', 'info');
    } else {
        showToast(res.data.error || 'Failed to resend verification code.', 'danger');
    }
}

function handleLogout() {
    clearSession();
    navigateTo('home');
    showToast('You have been signed out.', 'info');
}

async function loadCategories() {
    const res = await apiRequest('/categories/');
    if (res.ok) {
        state.categories = res.data;
        renderCategoryFilters();
        populateCategorySelectOptions();
    }
}

function renderCategoryFilters() {
    const container = document.getElementById('categoryFiltersContainer');
    if (!container) return;

    let html = `
        <button class="btn ${state.activeCategory === null ? 'btn-brand-primary' : 'btn-brand-outline'} btn-sm me-2 mb-2" onclick="filterByCategory(null)">
            <i class="bi bi-grid-fill me-1"></i> All Products
        </button>
    `;

    state.categories.forEach(cat => {
        const isActive = state.activeCategory === cat.id;
        html += `
            <button class="btn ${isActive ? 'btn-brand-primary' : 'btn-brand-outline'} btn-sm me-2 mb-2" onclick="filterByCategory(${cat.id})">
                <i class="bi ${cat.icon || 'bi-tag'} me-1"></i> ${cat.name} (${cat.product_count || 0})
            </button>
        `;
    });

    container.innerHTML = html;
}

function filterByCategory(categoryId) {
    state.activeCategory = categoryId;
    renderCategoryFilters();
    loadProducts();
}

async function loadProducts() {
    let endpoint = '/products/?';
    const params = new URLSearchParams();

    if (state.activeCategory) params.append('category', state.activeCategory);
    if (state.searchQuery) params.append('search', state.searchQuery);
    if (state.sortOrder) params.append('ordering', state.sortOrder);

    endpoint += params.toString();
    const res = await apiRequest(endpoint);
    if (res.ok) {
        state.products = res.data;
        renderProductsGrid();
        renderFeaturedProducts();
    }
}

function renderFeaturedProducts() {
    const container = document.getElementById('homeFeaturedProductsContainer');
    if (!container) return;

    const featured = state.products.filter(p => p.is_featured).slice(0, 4);
    if (featured.length === 0) {
        container.innerHTML = '<div class="col-12 text-center text-muted py-4">No featured items available.</div>';
        return;
    }

    container.innerHTML = featured.map(p => createProductCardHTML(p)).join('');
}

function renderProductsGrid() {
    const container = document.getElementById('productsCatalogGrid');
    const countDisplay = document.getElementById('productResultsCount');
    if (!container) return;

    if (countDisplay) {
        countDisplay.textContent = `Showing ${state.products.length} products`;
    }

    if (state.products.length === 0) {
        container.innerHTML = `
            <div class="col-12 text-center py-5">
                <i class="bi bi-inbox fs-1 text-muted d-block mb-3"></i>
                <h5 class="fw-semibold">No products found</h5>
                <p class="text-secondary small">Try adjusting your search terms or category filters.</p>
                <button class="btn btn-brand-outline btn-sm" onclick="filterByCategory(null)">Clear Filters</button>
            </div>
        `;
        return;
    }

    container.innerHTML = state.products.map(p => createProductCardHTML(p)).join('');
}

function createProductCardHTML(product) {
    const isAdmin = state.user && state.user.role === 'admin';
    const outOfStock = product.stock <= 0;
    const priceFormatted = Number(product.price).toLocaleString();

    return `
        <div class="col-12 col-sm-6 col-lg-4 col-xl-3 mb-4">
            <div class="product-card">
                <div class="product-img-wrapper">
                    ${product.is_featured ? '<span class="badge-featured">Featured</span>' : ''}
                    <span class="badge-stock ${outOfStock ? 'bg-danger' : ''}">${outOfStock ? 'Out of Stock' : product.stock + ' In Stock'}</span>
                    <img src="${product.image_url || 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=600'}" alt="${product.name}" loading="lazy">
                </div>
                <div class="p-3 d-flex flex-column flex-grow-1">
                    <div class="d-flex justify-content-between align-items-center mb-2">
                        <span class="badge" style="background: rgba(2, 132, 199, 0.1); color: #7dd3fc; border: 1px solid rgba(2, 132, 199, 0.25); font-weight: 500; font-size: 0.75rem; padding: 0.2rem 0.5rem; border-radius: 4px;">
                            ${product.category_name || 'Hardware'}
                        </span>
                        <span class="badge" style="background: rgba(148, 163, 184, 0.1); color: #cbd5e1; border: 1px solid rgba(148, 163, 184, 0.2); font-weight: 500; font-size: 0.75rem; padding: 0.2rem 0.5rem; border-radius: 4px;">
                            ${product.brand || 'TechNova'}
                        </span>
                    </div>
                    <h6 class="fw-bold text-white mb-2 text-truncate" title="${product.name}" style="font-size: 0.95rem;">${product.name}</h6>
                    <p class="text-secondary small mb-3 flex-grow-1" style="display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; line-height: 1.5; color: #94a3b8 !important; font-size: 0.85rem;">
                        ${product.description || 'Enterprise grade IT hardware solution.'}
                    </p>
                    <div class="d-flex justify-content-between align-items-baseline mb-3 p-2 rounded-2" style="background: #0b0f17; border: 1px solid rgba(255, 255, 255, 0.05);">
                        <span class="small" style="color: #64748b; font-size: 0.8rem;">Unit Price</span>
                        <span class="fs-5 fw-bold" style="color: #38bdf8; font-variant-numeric: tabular-nums;">฿${priceFormatted}</span>
                    </div>
                    <div class="d-flex gap-2">
                        <button class="btn btn-brand-outline btn-sm flex-grow-1 py-1" onclick="openProductDetailModal(${product.id})">
                            Details
                        </button>
                        <button class="btn btn-brand-primary btn-sm flex-grow-1 py-1" onclick="addToCart(${product.id})" ${outOfStock ? 'disabled' : ''}>
                            Add to Cart
                        </button>
                    </div>
                    ${isAdmin ? `
                        <div class="d-flex gap-2 border-top border-subtle pt-2 mt-2">
                            <button class="btn btn-action-edit w-50 py-1" onclick="openProductCrudModal(${product.id})">
                                Edit
                            </button>
                            <button class="btn btn-action-delete w-50 py-1" onclick="confirmDeleteProduct(${product.id})">
                                Delete
                            </button>
                        </div>
                    ` : ''}
                </div>
            </div>
        </div>
    `;
}

function openProductDetailModal(productId) {
    const product = state.products.find(p => p.id === productId);
    if (!product) return;

    document.getElementById('modalDetailImg').src = product.image_url || 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=600';
    document.getElementById('modalDetailCategory').textContent = product.category_name || 'Hardware';
    document.getElementById('modalDetailBrand').textContent = product.brand || 'TechNova';
    document.getElementById('modalDetailName').textContent = product.name;
    document.getElementById('modalDetailPrice').textContent = `฿${Number(product.price).toLocaleString()}`;
    document.getElementById('modalDetailStock').textContent = `${product.stock} Units`;
    document.getElementById('modalDetailDesc').textContent = product.description || 'No description provided.';
    document.getElementById('modalDetailSpecs').textContent = product.specs || 'Standard manufacturer specifications apply.';

    const addBtn = document.getElementById('modalDetailAddToCartBtn');
    addBtn.onclick = () => {
        const qty = parseInt(document.getElementById('modalDetailQtyInput').value) || 1;
        addToCart(product.id, qty);
        bootstrap.Modal.getInstance(document.getElementById('productDetailModal')).hide();
    };

    new bootstrap.Modal(document.getElementById('productDetailModal')).show();
}

function addToCart(productId, quantity = 1) {
    const product = state.products.find(p => p.id === productId);
    if (!product) return;

    if (product.stock <= 0) {
        showToast('Sorry, this product is currently out of stock.', 'warning');
        return;
    }

    const existingIndex = state.cart.findIndex(item => item.id === productId);
    if (existingIndex > -1) {
        const newQty = state.cart[existingIndex].quantity + quantity;
        if (newQty > product.stock) {
            showToast(`Cannot add more. Only ${product.stock} units available in stock.`, 'warning');
            return;
        }
        state.cart[existingIndex].quantity = newQty;
    } else {
        state.cart.push({
            id: product.id,
            name: product.name,
            price: Number(product.price),
            image_url: product.image_url,
            stock: product.stock,
            quantity: Math.min(quantity, product.stock)
        });
    }

    saveCart();
    showToast(`Added ${product.name} to cart.`, 'success');
}

function updateCartQty(productId, delta) {
    const item = state.cart.find(i => i.id === productId);
    if (!item) return;

    const newQty = item.quantity + delta;
    if (newQty <= 0) {
        removeFromCart(productId);
        return;
    }

    if (newQty > item.stock) {
        showToast(`Stock limit reached (${item.stock} available).`, 'warning');
        return;
    }

    item.quantity = newQty;
    saveCart();
}

function removeFromCart(productId) {
    state.cart = state.cart.filter(i => i.id !== productId);
    saveCart();
}

function updateCartBadge() {
    const count = state.cart.reduce((sum, item) => sum + item.quantity, 0);
    const badge = document.getElementById('navbarCartBadge');
    if (badge) {
        badge.textContent = count;
        badge.classList.toggle('d-none', count === 0);
    }
}

function renderCartDrawer() {
    const container = document.getElementById('cartDrawerItemsList');
    const totalDisplay = document.getElementById('cartDrawerTotalAmount');
    const checkoutBtn = document.getElementById('cartDrawerCheckoutBtn');
    if (!container) return;

    if (state.cart.length === 0) {
        container.innerHTML = `
            <div class="text-center py-5">
                <i class="bi bi-cart-x fs-1 text-muted d-block mb-3"></i>
                <h6 class="fw-semibold text-light">Your cart is empty</h6>
                <p class="text-secondary small">Explore our hardware catalog to add items.</p>
                <button class="btn btn-brand-primary btn-sm mt-2" onclick="bootstrap.Offcanvas.getInstance(document.getElementById('cartOffcanvas')).hide(); navigateTo('products');">
                    Browse Catalog
                </button>
            </div>
        `;
        if (totalDisplay) totalDisplay.textContent = '฿0';
        if (checkoutBtn) checkoutBtn.disabled = true;
        return;
    }

    let total = 0;
    container.innerHTML = state.cart.map(item => {
        const subtotal = item.price * item.quantity;
        total += subtotal;
        return `
            <div class="cart-item-card mb-3">
                <div class="d-flex align-items-center gap-3">
                    <img src="${item.image_url || 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=200'}" alt="${item.name}" style="width: 56px; height: 56px; object-fit: cover; border-radius: 0.5rem;">
                    <div class="flex-grow-1 min-w-0">
                        <div class="fw-semibold text-truncate small text-light">${item.name}</div>
                        <div class="text-cyan fw-bold small">฿${item.price.toLocaleString()}</div>
                    </div>
                    <button class="btn btn-link text-danger p-0" onclick="removeFromCart(${item.id})">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>
                <div class="d-flex justify-content-between align-items-center mt-2 pt-2 border-top border-subtle">
                    <div class="d-flex align-items-center gap-2">
                        <button class="btn btn-sm btn-outline-secondary py-0 px-2" onclick="updateCartQty(${item.id}, -1)">-</button>
                        <span class="fw-bold small px-1">${item.quantity}</span>
                        <button class="btn btn-sm btn-outline-secondary py-0 px-2" onclick="updateCartQty(${item.id}, 1)">+</button>
                    </div>
                    <div class="text-light fw-bold small">฿${subtotal.toLocaleString()}</div>
                </div>
            </div>
        `;
    }).join('');

    if (totalDisplay) totalDisplay.textContent = `฿${total.toLocaleString()}`;
    if (checkoutBtn) checkoutBtn.disabled = false;
}

function openCheckoutModal() {
    if (!state.user) {
        showToast('Please sign in or create an account to complete checkout.', 'warning');
        bootstrap.Offcanvas.getInstance(document.getElementById('cartOffcanvas')).hide();
        openAuthModal('login');
        return;
    }

    const offcanvasEl = document.getElementById('cartOffcanvas');
    if (offcanvasEl) {
        const offcanvas = bootstrap.Offcanvas.getInstance(offcanvasEl);
        if (offcanvas) offcanvas.hide();
    }

    const form = document.getElementById('checkoutOrderForm');
    if (form) {
        form.shipping_name.value = `${state.user.first_name || ''} ${state.user.last_name || ''}`.trim() || state.user.username;
        form.shipping_phone.value = state.user.phone || '';
    }

    renderCheckoutSummary();
    new bootstrap.Modal(document.getElementById('checkoutModal')).show();
}

function renderCheckoutSummary() {
    const listEl = document.getElementById('checkoutItemsSummaryList');
    const totalEl = document.getElementById('checkoutTotalDisplay');
    if (!listEl) return;

    let total = 0;
    listEl.innerHTML = state.cart.map(item => {
        const sub = item.price * item.quantity;
        total += sub;
        return `
            <div class="d-flex justify-content-between small py-1 text-secondary">
                <span class="text-truncate" style="max-width: 220px;">${item.name} x ${item.quantity}</span>
                <span class="text-light fw-semibold">฿${sub.toLocaleString()}</span>
            </div>
        `;
    }).join('');

    if (totalEl) totalEl.textContent = `฿${total.toLocaleString()}`;
}

async function handleCheckoutSubmit(event) {
    event.preventDefault();
    if (state.cart.length === 0) return;

    const form = event.target;
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Placing Order...';

    const payload = {
        items: state.cart.map(i => ({ product_id: i.id, quantity: i.quantity })),
        shipping_name: form.shipping_name.value.trim(),
        shipping_address: form.shipping_address.value.trim(),
        shipping_phone: form.shipping_phone.value.trim(),
        payment_method: form.payment_method.value
    };

    const res = await apiRequest('/orders/', 'POST', payload, true);
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<i class="bi bi-shield-check me-2"></i>Confirm & Complete Order';

    if (res.ok) {
        state.cart = [];
        saveCart();
        bootstrap.Modal.getInstance(document.getElementById('checkoutModal')).hide();
        showToast(`Order #${res.data.order_number} confirmed successfully!`, 'success');
        navigateTo('orders');
        loadProducts();
    } else {
        const errorMsg = res.data.error || 'Failed to place order. Please check item stock.';
        showToast(errorMsg, 'danger');
    }
}

async function loadMyOrders() {
    const container = document.getElementById('ordersListContainer');
    if (!container) return;

    container.innerHTML = '<div class="text-center py-5"><span class="spinner-border text-info"></span></div>';
    const res = await apiRequest('/orders/', 'GET', null, true);

    if (res.ok) {
        renderOrdersList(res.data);
    } else {
        container.innerHTML = `<div class="alert alert-danger">${res.data.error || 'Failed to load order history.'}</div>`;
    }
}

function renderOrdersList(orders) {
    const container = document.getElementById('ordersListContainer');
    if (!container) return;

    if (orders.length === 0) {
        container.innerHTML = `
            <div class="text-center py-5">
                <i class="bi bi-receipt fs-1 text-muted d-block mb-3"></i>
                <h5 class="fw-semibold">No order history found</h5>
                <p class="text-secondary small">You have not placed any orders yet.</p>
                <button class="btn btn-brand-primary btn-sm mt-2" onclick="navigateTo('products')">
                    Start Shopping
                </button>
            </div>
        `;
        return;
    }

    container.innerHTML = orders.map(order => {
        const statusBadges = {
            'pending': 'bg-warning text-dark',
            'processing': 'bg-info text-dark',
            'shipped': 'bg-primary text-white',
            'delivered': 'bg-success text-white',
            'cancelled': 'bg-danger text-white'
        };
        const badgeClass = statusBadges[order.status] || 'bg-secondary';

        return `
            <div class="card bg-surface border-subtle mb-3">
                <div class="card-header bg-surface-elevated border-subtle d-flex flex-wrap justify-content-between align-items-center py-3">
                    <div>
                        <span class="fw-bold text-light me-2">${order.order_number}</span>
                        <span class="text-muted small">${new Date(order.created_at).toLocaleString()}</span>
                    </div>
                    <div class="d-flex align-items-center gap-3">
                        <span class="badge ${badgeClass} text-uppercase">${order.status}</span>
                        <span class="fw-bold text-cyan fs-5">฿${Number(order.total_amount).toLocaleString()}</span>
                    </div>
                </div>
                <div class="card-body">
                    <div class="row">
                        <div class="col-md-7 mb-3 mb-md-0">
                            <h6 class="text-muted small text-uppercase fw-bold mb-2">Purchased Items</h6>
                            <div class="list-group list-group-flush bg-transparent">
                                ${order.items.map(item => `
                                    <div class="list-group-item bg-transparent border-subtle px-0 py-2 d-flex justify-content-between align-items-center">
                                        <span class="text-light">${item.product_name} <span class="text-muted">x${item.quantity}</span></span>
                                        <span class="text-secondary small">฿${Number(item.subtotal).toLocaleString()}</span>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                        <div class="col-md-5 border-start-md border-subtle">
                            <h6 class="text-muted small text-uppercase fw-bold mb-2">Delivery & Payment</h6>
                            <p class="text-light small mb-1"><strong>Recipient:</strong> ${order.shipping_name}</p>
                            <p class="text-secondary small mb-1"><strong>Phone:</strong> ${order.shipping_phone}</p>
                            <p class="text-secondary small mb-1"><strong>Address:</strong> ${order.shipping_address}</p>
                            <p class="text-info small mb-0"><strong>Payment:</strong> ${order.payment_method}</p>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

async function loadAdminProducts() {
    const tableBody = document.getElementById('adminProductsTableBody');
    if (!tableBody) return;

    tableBody.innerHTML = '<tr><td colspan="7" class="text-center py-4"><span class="spinner-border spinner-border-sm text-info me-2"></span>Loading inventory...</td></tr>';
    const res = await apiRequest('/products/');

    if (res.ok) {
        if (res.data.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="7" class="text-center py-4 text-muted">No products available.</td></tr>';
            return;
        }

        tableBody.innerHTML = res.data.map(product => {
            const stockOk = product.stock > 5;
            const priceFormatted = Number(product.price).toLocaleString();
            return `
                <tr>
                    <td style="width: 60px;">
                        <img src="${product.image_url || 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=100'}" alt="${product.name}" style="width: 44px; height: 44px; object-fit: cover; border-radius: 6px; border: 1px solid rgba(255, 255, 255, 0.1); background: #0b0f17; display: block;">
                    </td>
                    <td>
                        <div class="fw-bold text-white fs-6 mb-1" style="max-width: 320px; line-height: 1.35;">${product.name}</div>
                        <span class="badge" style="background: rgba(148, 163, 184, 0.1); color: #cbd5e1; border: 1px solid rgba(148, 163, 184, 0.2); font-weight: 500; font-size: 0.75rem; padding: 0.2rem 0.5rem; border-radius: 4px;">
                            ${product.brand || 'TechNova'}
                        </span>
                    </td>
                    <td>
                        <span class="badge" style="background: rgba(2, 132, 199, 0.1); color: #7dd3fc; border: 1px solid rgba(2, 132, 199, 0.25); font-weight: 500; font-size: 0.78rem; padding: 0.25rem 0.55rem; border-radius: 4px;">
                            ${product.category_name || '-'}
                        </span>
                    </td>
                    <td>
                        <span class="fw-bold" style="color: #38bdf8; font-size: 1.05rem; font-variant-numeric: tabular-nums;">฿${priceFormatted}</span>
                    </td>
                    <td>
                        <span class="badge" style="background: ${stockOk ? 'rgba(16, 185, 129, 0.12)' : 'rgba(244, 63, 94, 0.12)'}; color: ${stockOk ? '#34d399' : '#fb7185'}; border: 1px solid ${stockOk ? 'rgba(16, 185, 129, 0.25)' : 'rgba(244, 63, 94, 0.25)'}; font-weight: 600; font-size: 0.78rem; padding: 0.25rem 0.55rem; border-radius: 4px;">
                            ${product.stock} units
                        </span>
                    </td>
                    <td>
                        ${product.is_featured
                            ? '<span class="badge" style="background: rgba(245, 158, 11, 0.12); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.25); font-weight: 600; font-size: 0.78rem; padding: 0.25rem 0.55rem; border-radius: 4px;">Featured</span>'
                            : '<span class="badge" style="background: rgba(100, 116, 139, 0.12); color: #94a3b8; border: 1px solid rgba(100, 116, 139, 0.2); font-weight: 500; font-size: 0.78rem; padding: 0.25rem 0.55rem; border-radius: 4px;">Standard</span>'
                        }
                    </td>
                    <td class="text-end" style="white-space: nowrap;">
                        <button class="btn btn-action-edit me-1" title="Edit Product" onclick="openProductCrudModal(${product.id})">
                            <i class="bi bi-pencil me-1"></i>Edit
                        </button>
                        <button class="btn btn-action-delete" title="Delete Product" onclick="confirmDeleteProduct(${product.id})">
                            <i class="bi bi-trash me-1"></i>Delete
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    }
}

function populateCategorySelectOptions() {
    const select = document.getElementById('productCrudCategory');
    if (!select) return;

    select.innerHTML = '<option value="">Select Category...</option>' + state.categories.map(c => `
        <option value="${c.id}">${c.name}</option>
    `).join('');
}

function openProductCrudModal(productId = null) {
    populateCategorySelectOptions();
    const form = document.getElementById('productCrudForm');
    form.reset();

    if (productId) {
        const product = state.products.find(p => p.id === productId);
        if (!product) return;
        document.getElementById('productCrudModalTitle').textContent = 'Edit IT Product';
        document.getElementById('productCrudId').value = product.id;
        form.name.value = product.name;
        form.category.value = product.category || '';
        form.brand.value = product.brand || '';
        form.price.value = product.price;
        form.stock.value = product.stock;
        form.image_url.value = product.image_url || '';
        form.description.value = product.description || '';
        form.specs.value = product.specs || '';
        form.is_featured.checked = Boolean(product.is_featured);
    } else {
        document.getElementById('productCrudModalTitle').textContent = 'Add New IT Product';
        document.getElementById('productCrudId').value = '';
    }

    new bootstrap.Modal(document.getElementById('productCrudModal')).show();
}

async function handleProductCrudSubmit(event) {
    event.preventDefault();
    const form = event.target;
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Saving...';

    const productId = document.getElementById('productCrudId').value;
    const isEdit = Boolean(productId);

    const payload = {
        name: form.name.value.trim(),
        category: form.category.value ? parseInt(form.category.value) : null,
        brand: form.brand.value.trim(),
        price: parseFloat(form.price.value),
        stock: parseInt(form.stock.value),
        image_url: form.image_url.value.trim(),
        description: form.description.value.trim(),
        specs: form.specs.value.trim(),
        is_featured: form.is_featured.checked
    };

    const endpoint = isEdit ? `/products/${productId}/` : '/products/';
    const method = isEdit ? 'PUT' : 'POST';

    const res = await apiRequest(endpoint, method, payload, true);
    submitBtn.disabled = false;
    submitBtn.innerHTML = 'Save Product';

    if (res.ok) {
        bootstrap.Modal.getInstance(document.getElementById('productCrudModal')).hide();
        showToast(isEdit ? 'Product updated successfully.' : 'New product created successfully.', 'success');
        await loadProducts();
        if (state.currentView === 'admin-products') {
            loadAdminProducts();
        }
    } else {
        let msg = 'Failed to save product. ';
        for (const [k, v] of Object.entries(res.data)) {
            msg += `${k}: ${Array.isArray(v) ? v.join(' ') : v} `;
        }
        showToast(msg, 'danger');
    }
}

async function confirmDeleteProduct(productId) {
    if (!confirm('Are you sure you want to delete this product? This action cannot be undone.')) {
        return;
    }

    const res = await apiRequest(`/products/${productId}/`, 'DELETE', null, true);
    if (res.status === 204 || res.ok) {
        showToast('Product deleted successfully.', 'success');
        await loadProducts();
        if (state.currentView === 'admin-products') {
            loadAdminProducts();
        }
    } else {
        showToast(res.data.error || 'Failed to delete product.', 'danger');
    }
}

async function loadAdminDashboard() {
    const res = await apiRequest('/stats/', 'GET', null, true);
    if (!res.ok) return;

    const data = res.data;
    document.getElementById('dashTotalProducts').textContent = data.total_products;
    document.getElementById('dashTotalStock').textContent = data.total_stock;
    document.getElementById('dashTotalOrders').textContent = data.total_orders;
    document.getElementById('dashTotalRevenue').textContent = `฿${Number(data.total_revenue).toLocaleString()}`;

    const ordersTable = document.getElementById('dashRecentOrdersTable');
    if (ordersTable) {
        if (!data.recent_orders || data.recent_orders.length === 0) {
            ordersTable.innerHTML = '<tr><td colspan="5" class="text-center py-3 text-muted">No orders placed yet.</td></tr>';
        } else {
            ordersTable.innerHTML = data.recent_orders.map(o => `
                <tr>
                    <td class="fw-bold text-light">${o.order_number}</td>
                    <td>${o.shipping_name} <br><span class="text-muted small">${o.user_username}</span></td>
                    <td class="text-cyan fw-bold">฿${Number(o.total_amount).toLocaleString()}</td>
                    <td>
                        <select class="form-select form-select-sm form-select-custom py-0" onchange="handleAdminOrderStatusChange(${o.id}, this.value)">
                            <option value="pending" ${o.status === 'pending' ? 'selected' : ''}>Pending</option>
                            <option value="processing" ${o.status === 'processing' ? 'selected' : ''}>Processing</option>
                            <option value="shipped" ${o.status === 'shipped' ? 'selected' : ''}>Shipped</option>
                            <option value="delivered" ${o.status === 'delivered' ? 'selected' : ''}>Delivered</option>
                            <option value="cancelled" ${o.status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
                        </select>
                    </td>
                    <td class="text-muted small">${new Date(o.created_at).toLocaleDateString()}</td>
                </tr>
            `).join('');
        }
    }

    const lowStockTable = document.getElementById('dashLowStockTable');
    if (lowStockTable) {
        if (!data.low_stock_products || data.low_stock_products.length === 0) {
            lowStockTable.innerHTML = '<tr><td colspan="3" class="text-center py-3 text-success">All product stocks are healthy.</td></tr>';
        } else {
            lowStockTable.innerHTML = data.low_stock_products.map(p => `
                <tr>
                    <td class="text-light fw-semibold">${p.name}</td>
                    <td><span class="badge bg-danger">${p.stock} units left</span></td>
                    <td class="text-end">
                        <button class="btn btn-sm btn-brand-outline py-0 px-2" onclick="openProductCrudModal(${p.id})">Restock</button>
                    </td>
                </tr>
            `).join('');
        }
    }
}

async function handleAdminOrderStatusChange(orderId, newStatus) {
    const res = await apiRequest(`/orders/${orderId}/`, 'PATCH', { status: newStatus }, true);
    if (res.ok) {
        showToast(`Order status updated to ${newStatus.toUpperCase()}.`, 'success');
    } else {
        showToast(res.data.error || 'Failed to update order status.', 'danger');
    }
}

function switchAuthTab(tabName) {
    const loginBtn = document.getElementById('authModalLoginTabBtn');
    const regBtn = document.getElementById('authModalRegTabBtn');
    const loginPane = document.getElementById('authLoginTab');
    const regPane = document.getElementById('authRegTab');

    if (!loginBtn || !regBtn || !loginPane || !regPane) return;

    if (tabName === 'register') {
        loginBtn.classList.remove('active');
        regBtn.classList.add('active');
        loginPane.classList.remove('show', 'active');
        loginPane.style.display = 'none';
        regPane.style.display = 'block';
        regPane.classList.add('show', 'active');
    } else {
        regBtn.classList.remove('active');
        loginBtn.classList.add('active');
        regPane.classList.remove('show', 'active');
        regPane.style.display = 'none';
        loginPane.style.display = 'block';
        loginPane.classList.add('show', 'active');
    }
}

function openAuthModal(mode = 'login') {
    switchAuthTab(mode);
    const modalEl = document.getElementById('authModal');
    if (modalEl) {
        bootstrap.Modal.getOrCreateInstance(modalEl).show();
    }
}

function openCartDrawer() {
    renderCartDrawer();
    new bootstrap.Offcanvas(document.getElementById('cartOffcanvas')).show();
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toastId = `toast-${Date.now()}`;
    const bgClasses = {
        'success': 'bg-success text-white',
        'danger': 'bg-danger text-white',
        'warning': 'bg-warning text-dark',
        'info': 'bg-info text-dark'
    };

    const bgClass = bgClasses[type] || 'bg-dark text-white';
    const toastHTML = `
        <div id="${toastId}" class="toast align-items-center ${bgClass} border-0 shadow" role="alert" aria-live="assertive" aria-atomic="true">
            <div class="d-flex">
                <div class="toast-body fw-semibold small">
                    ${message}
                </div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
            </div>
        </div>
    `;

    container.insertAdjacentHTML('beforeend', toastHTML);
    const toastEl = document.getElementById(toastId);
    const toast = new bootstrap.Toast(toastEl, { delay: 4000 });
    toast.show();
    toastEl.addEventListener('hidden.bs.toast', () => toastEl.remove());
}
