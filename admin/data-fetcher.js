/**
 * SECURE DATA FETCHER
 * Fetches data via Cloudflare Worker (not direct from Sheet)
 */

// ✅ WORKER URL FINAL
// REQ 3: Share API_BASE_URL across all admin scripts (avoid redeclaration error)
if (typeof window.API_BASE_URL === 'undefined') {
    window.API_BASE_URL = 'https://popsorte-api.danilla-vargas1923.workers.dev';
}
// REQ 3: Use var to allow redeclaration across multiple script files
var API_BASE_URL = window.API_BASE_URL;

// Session token (set after login)
// REQ 3: Share authToken across all admin scripts (avoid redeclaration error)
if (typeof window.authToken === 'undefined') {
    window.authToken = null;
}
// REQ 3: Use var to allow redeclaration across multiple script files
var authToken = window.authToken;

class DataFetcher {
    constructor() {
        this.entries = [];
        this.lastFetchTime = null;
    }

    // REQ 2: Initialize token from session storage on load
    initializeTokenFromSession() {
        try {
            if (typeof getSession === 'function') {
                const session = getSession();
                if (session && session.token) {
                    // REQ 3: Update both local and window authToken
                    window.authToken = session.token;
                    authToken = session.token;
                }
            }
        } catch (error) {
            // REQ 2: Don't let initialization errors prevent dataFetcher from being created
            console.warn('Could not initialize token from session:', error);
        }
    }

    setAuthToken(token) {
        // REQ 3: Update both local and window authToken
        window.authToken = token;
        authToken = token;
    }

    async fetchData() {
        try {
            const headers = {
                'Content-Type': 'application/json'
            };
            
            // REQ 3: Add auth token for admin requests (check both local and window)
            const token = authToken || window.authToken;
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }
            
            // REQ 3: Use dynamic timestamp for cache-busting
            const url = `${API_BASE_URL}/api/admin/entries?t=${Date.now()}`;
            const response = await fetch(url, {
                method: 'GET',
                headers: headers,
                cache: 'no-store' // REQ 3: Ensure fresh data
            });
            
            if (!response.ok) {
                if (response.status === 401) {
                    throw new Error('Unauthorized - Please login again');
                }
                throw new Error(`Failed to fetch data: ${response.status}`);
            }
            
            const csvText = await response.text();
            
            // REQ 3: Remove BOM (Byte Order Mark) if present and trim
            const cleanedCsv = csvText.replace(/^\uFEFF/, '').trim();
            
            // REQ 3: Debug - log first 500 chars to verify format
            if (cleanedCsv.length > 0) {
                console.log('REQ 3: CSV preview (first 500 chars):', cleanedCsv.substring(0, 500));
            } else {
                console.error('REQ 3: CSV response is empty!');
                throw new Error('Empty CSV response from API');
            }
            
            this.entries = this.parseCSV(cleanedCsv);
            this.lastFetchTime = new Date();
            
            if (this.entries.length === 0) {
                console.warn('REQ 3: No entries parsed from CSV. Check parsing logic.');
            }
            
            return this.entries;
        } catch (error) {
            console.error('Error fetching data:', error);
            throw error;
        }
    }

    parseCSV(csvText) {
        // REQ 3: Handle both Unix and Windows line endings
        const lines = csvText.split(/\r?\n/).filter(line => line.trim().length > 0);
        const entries = [];
        
        if (lines.length === 0) {
            console.warn('REQ 3: CSV is empty or has no valid lines');
            return entries;
        }
        
        // REQ 3: Skip header row
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            
            const values = this.parseCSVLine(line);
            
            // REQ 3: Debug first few rows to identify parsing issues
            if (i <= 3) {
                console.log(`REQ 3: Row ${i} parsed ${values.length} columns:`, values.slice(0, 5));
            }
            
            // REQ 3: Require at least 9 columns (the essential data columns)
            if (values.length < 9) {
                console.warn(`REQ 3: Skipping row ${i} - only ${values.length} columns found`);
                continue;
            }
            
            const entry = {
                registrationDateTime: values[0] || '',
                platform: (values[1] || 'POPN1').toUpperCase(),
                gameId: values[2] || '',
                whatsapp: values[3] || '',
                chosenNumbers: this.parseNumbers(values[4] || ''),
                drawDate: values[5] || '',
                contest: values[6] || '',
                ticketNumber: values[7] || '',
                status: values[8] || ''
            };
            
            // REQ 3: Validate essential fields before adding
            if (entry.gameId && entry.chosenNumbers && entry.chosenNumbers.length > 0) {
                entries.push(entry);
            } else {
                console.warn(`REQ 3: Skipping invalid entry at row ${i}:`, entry);
            }
        }
        
        console.log(`REQ 3: Successfully parsed ${entries.length} valid entries from ${lines.length - 1} data rows`);
        return entries;
    }

    parseCSVLine(line) {
        // REQ 3: Fixed CSV parser to properly handle quoted values and remove quotes
        const values = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            
            if (char === '"') {
                // REQ 3: Skip quote characters - they're just delimiters, not part of the value
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                // REQ 3: Push value when we hit a comma outside quotes
                values.push(current.trim());
                current = '';
            } else {
                // REQ 3: Add character to current value (quotes already skipped above)
                current += char;
            }
        }
        
        // REQ 3: Push the last value
        values.push(current.trim());
        return values;
    }

    parseNumbers(numberString) {
        // REQ 3: Handle numbers that may have spaces after commas (e.g., "01, 12, 22, 25, 44")
        if (!numberString || typeof numberString !== 'string') return [];
        
        // REQ 3: Remove any remaining quotes, split by comma, trim each, and parse
        const cleaned = numberString.replace(/^["']|["']$/g, ''); // Remove surrounding quotes if any
        const numbers = cleaned.split(',').map(n => parseInt(n.trim(), 10)).filter(n => !isNaN(n) && n > 0);
        return numbers;
    }

    getAllEntries() {
        return this.entries;
    }

    getEntryById(gameId) {
        return this.entries.find(entry => entry.gameId === gameId);
    }

    getEntriesByContest(contest) {
        return this.entries.filter(entry => entry.contest === contest);
    }

    getEntriesByDrawDate(drawDate) {
        return this.entries.filter(entry => entry.drawDate === drawDate);
    }

    getUniqueContests() {
        const contests = [...new Set(this.entries.map(entry => entry.contest))];
        return contests.sort();
    }

    getUniqueDrawDates() {
        const dates = [...new Set(this.entries.map(entry => entry.drawDate))];
        return dates.sort();
    }

    getStatistics() {
        const contestCounts = {};
        const dateCounts = {};
        
        this.entries.forEach(entry => {
            contestCounts[entry.contest] = (contestCounts[entry.contest] || 0) + 1;
            dateCounts[entry.drawDate] = (dateCounts[entry.drawDate] || 0) + 1;
        });
        
        return {
            totalEntries: this.entries.length,
            uniqueContests: this.getUniqueContests().length,
            uniqueDrawDates: this.getUniqueDrawDates().length,
            pendingEntries: this.entries.filter(e => e.status === 'PENDENTE').length,
            contestBreakdown: contestCounts,
            dateBreakdown: dateCounts
        };
    }
}

// REQ 2: Global instance - ensure it's accessible globally
const dataFetcher = new DataFetcher();

// REQ 2: Initialize token after instance creation (prevents constructor errors)
try {
    dataFetcher.initializeTokenFromSession();
} catch (error) {
    console.warn('REQ 2: Token initialization failed:', error);
}

// REQ 2: Explicitly expose to window for compatibility
if (typeof window !== 'undefined') {
    window.dataFetcher = dataFetcher;
}
