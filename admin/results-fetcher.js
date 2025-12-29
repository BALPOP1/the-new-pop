/**
 * SECURE RESULTS FETCHER
 * Fetches results via Cloudflare Worker (not direct from Sheet)
 */

// ✅ WORKER URL FINAL
// REQ 3: Share API_BASE_URL across all admin scripts (avoid redeclaration error)
if (typeof window.API_BASE_URL === 'undefined') {
    window.API_BASE_URL = 'https://popsorte-api.danilla-vargas1923.workers.dev';
}
// REQ 3: Use var to allow redeclaration across multiple script files
var API_BASE_URL = window.API_BASE_URL;

class ResultsFetcher {
    constructor() {
        this.results = [];
        this.lastFetchTime = null;
        
        // REQ 2: Ensure authToken is initialized from session if available
        this.ensureAuthTokenInitialized();
    }

    // REQ 2: Initialize token from session storage on load (fixes race condition)
    ensureAuthTokenInitialized() {
        if (typeof getSession === 'function') {
            const session = getSession();
            if (session && session.token && typeof authToken === 'undefined') {
                // Set global authToken if not already set
                window.authToken = session.token;
            }
        }
    }

    async fetchResults() {
        try {
            const headers = {
                'Content-Type': 'application/json'
            };
            
            // REQ 2: Ensure token is initialized before use
            this.ensureAuthTokenInitialized();
            
            // Add auth token if available
            if (authToken) {
                headers['Authorization'] = `Bearer ${authToken}`;
            }
            
            const response = await fetch(`${API_BASE_URL}/api/admin/results`, {
                method: 'GET',
                headers: headers
            });
            
            if (!response.ok) {
                if (response.status === 401) {
                    throw new Error('Unauthorized - Please login again');
                }
                throw new Error(`Failed to fetch results: ${response.status}`);
            }
            
            const csvText = await response.text();
            this.results = this.parseCSV(csvText);
            this.lastFetchTime = new Date();
            return this.results;
        } catch (error) {
            console.error('Error fetching results:', error);
            throw error;
        }
    }

    parseCSV(csvText) {
        const lines = csvText.split('\n').filter(Boolean);
        const parsed = [];

        // Skip header
        for (let i = 1; i < lines.length; i++) {
            const row = this.parseCSVLine(lines[i]);
            if (row.length < 6) continue;

            const contestRaw = row[0].trim();
            const drawDateRaw = row[1].trim();
            const nums = row.slice(2, 7).map(v => parseInt(v, 10)).filter(n => !Number.isNaN(n));

            if (!contestRaw || !drawDateRaw || nums.length !== 5) continue;

            parsed.push({
                contest: contestRaw,
                drawDate: this.normalizeDate(drawDateRaw),
                winningNumbers: nums
            });
        }

        return parsed;
    }

    parseCSVLine(line) {
        const values = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (ch === '"') {
                inQuotes = !inQuotes;
            } else if (ch === ',' && !inQuotes) {
                values.push(current.trim());
                current = '';
            } else {
                current += ch;
            }
        }
        values.push(current.trim());
        return values;
    }

    normalizeDate(dateStr) {
        // Accept dd/mm/yyyy or yyyy-mm-dd
        if (dateStr.includes('/')) {
            const [d, m, y] = dateStr.split('/');
            if (d && m && y) {
                return `${y.padStart(4, '0')}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
            }
        }
        return dateStr;
    }

    getAllResults() {
        return this.results;
    }

    getResult(contest, drawDate) {
        return this.results.find(r => r.contest === contest && r.drawDate === drawDate) || null;
    }
}

// Global instance
const resultsFetcher = new ResultsFetcher();
