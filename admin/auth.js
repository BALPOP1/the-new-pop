/**
 * SECURE AUTHENTICATION
 * Login via Cloudflare Worker (credentials hidden)
 */

// ✅ WORKER URL FINAL
// REQ 3: Share API_BASE_URL across all admin scripts (auth.js loads first, so it sets the global)
if (typeof window.API_BASE_URL === 'undefined') {
    window.API_BASE_URL = 'https://popsorte-api.danilla-vargas1923.workers.dev';
}
// REQ 3: Use var to allow redeclaration across multiple script files
var API_BASE_URL = window.API_BASE_URL;

const AUTH_SESSION_KEY = 'ps_admin_session';
const AUTH_SESSION_TTL_HOURS = 12;

/**
 * Login via Worker API
 */
async function loginAdmin(account, password) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ account, password })
        });
        
        const data = await response.json();
        
        if (!response.ok || !data.success) {
            throw new Error(data.error || 'Login failed');
        }
        
        // Save session
        setSession(data.account, data.token);
        
        // REQ 3: Set auth token for data fetchers and validators
        if (typeof dataFetcher !== 'undefined') {
            dataFetcher.setAuthToken(data.token);
        }
        if (typeof rechargeValidator !== 'undefined') {
            rechargeValidator.setAuthToken(data.token);
        }
        
        return data;
    } catch (error) {
        console.error('Login error:', error);
        throw error;
    }
}

/**
 * Save session to sessionStorage
 */
function setSession(account, token) {
    const expiresAt = Date.now() + AUTH_SESSION_TTL_HOURS * 60 * 60 * 1000;
    const payload = { 
        account, 
        token,
        expiresAt 
    };
    sessionStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(payload));
}

/**
 * Get current session
 */
function getSession() {
    const raw = sessionStorage.getItem(AUTH_SESSION_KEY);
    if (!raw) return null;
    
    try {
        const data = JSON.parse(raw);
        if (!data.expiresAt || Date.now() > data.expiresAt) {
            sessionStorage.removeItem(AUTH_SESSION_KEY);
            return null;
        }
        
        // REQ 3: Set auth token for data fetchers and validators
        if (data.token) {
            // REQ 3: Update both local and window authToken
            window.authToken = data.token;
            authToken = data.token;
            if (typeof dataFetcher !== 'undefined') {
                dataFetcher.setAuthToken(data.token);
            }
            if (typeof rechargeValidator !== 'undefined') {
                rechargeValidator.setAuthToken(data.token);
            }
        }
        
        return data;
    } catch (e) {
        sessionStorage.removeItem(AUTH_SESSION_KEY);
        return null;
    }
}

/**
 * Clear session
 */
function clearSession() {
    sessionStorage.removeItem(AUTH_SESSION_KEY);
    // REQ 3: Clear both local and window authToken
    window.authToken = null;
    authToken = null;
}

/**
 * Ensure user is authenticated
 */
function ensureAuthenticated() {
    const session = getSession();
    if (!session) {
        const isNested = window.location.pathname.includes('/admin/pages/');
        const target = isNested ? '../login.html' : '/admin/login.html';
        window.location.replace(target);
    }
}

/**
 * Logout
 */
function logout() {
    clearSession();
    const isNested = window.location.pathname.includes('/admin/pages/');
    const target = isNested ? '../login.html' : '/admin/login.html';
    window.location.replace(target);
}

/**
 * DEPRECATED: Old fetchAccounts function (removed for security)
 * Now handled by Worker API
 */
async function fetchAccounts() {
    throw new Error('Direct credential access removed for security. Use loginAdmin() instead.');
}
