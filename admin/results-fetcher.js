/**
 * SECURE RESULTS FETCHER
 * Fetches results via Cloudflare Worker (not direct from Sheet)
 */

// ✅ WORKER URL FINAL
const API_BASE_URL = 'https://popsorte-api.danilla-vargas1923.workers.dev';

class ResultsFetcher {
    constructor() {
        this.results = [];
        this.lastFetchTime = null;
    }

    async fetchResults() {
        try {
            const headers = {
                'Content-Type': 'application/json'
            };
            
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

class SorteFetcher {
    constructor() {
        this.rows = [];
        this.lastFetchTime = null;
    }

    async fetchSorte(format = 'json') {
        try {
            const headers = {
                'Content-Type': 'application/json'
            };
            if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

            const qs = format === 'csv' ? '?format=csv' : '';
            const response = await fetch(`${API_BASE_URL}/api/admin/sorte${qs}`, {
                method: 'GET',
                headers
            });

            if (!response.ok) {
                if (response.status === 401) throw new Error('Unauthorized - Please login again');
                throw new Error(`Failed to fetch SORTE: ${response.status}`);
            }

            if (format === 'csv') {
                const csvText = await response.text();
                this.rows = this.parseCSV(csvText);
            } else {
                const json = await response.json();
                this.rows = json.values || [];
            }

            this.lastFetchTime = new Date();
            return this.rows;
        } catch (err) {
            console.error('Error fetching SORTE:', err);
            throw err;
        }
    }

    parseCSV(csvText) {
        const lines = csvText.split('\n').filter(Boolean);
        const rows = [];
        for (const line of lines) {
            rows.push(this.parseCSVLine(line));
        }
        return rows;
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

    getAllRows() {
        return this.rows;
    }
}

const sorteFetcher = new SorteFetcher();
