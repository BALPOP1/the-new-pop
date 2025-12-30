/**
 * SECURE DATA FETCHER
 * Fetches data via Cloudflare Worker (not direct from Sheet)
 */

// ✅ WORKER URL FINAL
const API_BASE_URL = 'https://popsorte-api.danilla-vargas1923.workers.dev';

// Note: authToken is declared globally in auth.js (which loads first)

class DataFetcher {
    constructor() {
        this.entries = [];
        this.lastFetchTime = null;
    }

    setAuthToken(token) {
        authToken = token;
    }

    async fetchData() {
        try {
            const headers = {
                'Content-Type': 'application/json'
            };
            
            // Add auth token for admin requests
            if (authToken) {
                headers['Authorization'] = `Bearer ${authToken}`;
            }
            
            const response = await fetch(`${API_BASE_URL}/api/admin/entries`, {
                method: 'GET',
                headers: headers
            });
            
            if (!response.ok) {
                if (response.status === 401) {
                    throw new Error('Unauthorized - Please login again');
                }
                throw new Error(`Failed to fetch data: ${response.status}`);
            }
            
            const csvText = await response.text();
            this.entries = this.parseCSV(csvText);
            this.lastFetchTime = new Date();
            return this.entries;
        } catch (error) {
            console.error('Error fetching data:', error);
            throw error;
        }
    }

    parseCSV(csvText) {
        const lines = csvText.split('\n');
        const entries = [];
        
        // Skip header row
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            
            const values = this.parseCSVLine(line);
            if (values.length < 9) continue;
            
            const entry = {
                registrationDateTime: values[0],
                platform: (values[1] || 'POPN1').toUpperCase(),
                gameId: values[2],
                whatsapp: values[3],
                chosenNumbers: this.parseNumbers(values[4]),
                drawDate: values[5],
                contest: values[6],
                ticketNumber: values[7],
                status: values[8]
            };
            
            entries.push(entry);
        }
        
        return entries;
    }

    parseCSVLine(line) {
        const values = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                values.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        
        values.push(current.trim());
        return values;
    }

    parseNumbers(numberString) {
        const numbers = numberString.split(',').map(n => parseInt(n.trim())).filter(n => !isNaN(n));
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

// Global instance
const dataFetcher = new DataFetcher();
