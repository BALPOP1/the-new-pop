/**
 * SECURE AUTHENTICATION
 * Login via Cloudflare Worker (credentials hidden)
 */

// ✅ WORKER URL FINAL
const API_BASE_URL = 'https://popsorte-api.danilla-vargas1923.workers.dev';

const AUTH_SESSION_KEY = 'ps_admin_session';
const AUTH_SESSION_TTL_HOURS = 12;

// Global auth token (used by fetchers)
let authToken = null;

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
        
        let data;
        try {
            data = await response.json();
        } catch (e) {
            // If response is not JSON, create error from status
            if (response.status === 401) {
                throw new Error('Invalid credentials');
            }
            throw new Error(`Login failed: ${response.status} ${response.statusText}`);
        }
        
        if (!response.ok || !data.success) {
            throw new Error(data.error || 'Login failed');
        }
        
        // Save session
        setSession(data.account, data.token);
        
        // Set auth token for data fetchers
        if (typeof dataFetcher !== 'undefined') {
            dataFetcher.setAuthToken(data.token);
        }
        
        // Set auth token for results fetcher
        if (typeof resultsFetcher !== 'undefined' && resultsFetcher.setAuthToken) {
            resultsFetcher.setAuthToken(data.token);
        }
        
        // Set auth token for recharge validator
        if (typeof rechargeValidator !== 'undefined' && rechargeValidator.setAuthToken) {
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
        
        // Set auth token for data fetchers
        if (data.token) {
            authToken = data.token;
            if (typeof dataFetcher !== 'undefined') {
                dataFetcher.setAuthToken(data.token);
            }
            // Set auth token for results fetcher
            if (typeof resultsFetcher !== 'undefined' && resultsFetcher.setAuthToken) {
                resultsFetcher.setAuthToken(data.token);
            }
            // Set auth token for recharge validator
            if (typeof rechargeValidator !== 'undefined' && rechargeValidator.setAuthToken) {
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
 * Initialize auth tokens for all fetchers after page load
 * Call this after all scripts are loaded
 */
function initializeAuthTokens() {
    const session = getSession();
    if (session && session.token) {
        authToken = session.token;
        
        // Set tokens for all fetchers
        if (typeof dataFetcher !== 'undefined' && dataFetcher.setAuthToken) {
            dataFetcher.setAuthToken(session.token);
        }
        if (typeof resultsFetcher !== 'undefined' && resultsFetcher.setAuthToken) {
            resultsFetcher.setAuthToken(session.token);
        }
        if (typeof rechargeValidator !== 'undefined' && rechargeValidator.setAuthToken) {
            rechargeValidator.setAuthToken(session.token);
        }
    }
}

/**
 * DEPRECATED: Old fetchAccounts function (removed for security)
 * Now handled by Worker API
 */
async function fetchAccounts() {
    throw new Error('Direct credential access removed for security. Use loginAdmin() instead.');
}
