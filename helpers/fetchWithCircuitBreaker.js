const axios = require('axios');

/**
 * Circuit Breaker to prevent repeated API calls when service is down
 */
const circuitBreaker = {
    failures: 0,
    lastFailureTime: null,
    threshold: 3,
    resetTimeout: 60000, // 1 minute
    
    isOpen() {
        if (this.failures >= this.threshold) {
            const timeSinceLastFailure = Date.now() - this.lastFailureTime;
            if (timeSinceLastFailure < this.resetTimeout) {
                console.log(`[CircuitBreaker] 🚫 Circuit OPEN (${this.failures} failures in last ${this.resetTimeout/1000}s)`);
                return true; // Circuit is open, don't call API
            } else {
                // Reset after timeout
                console.log('[CircuitBreaker] 🔄 Circuit resetting...');
                this.failures = 0;
                this.lastFailureTime = null;
                return false;
            }
        }
        return false;
    },
    
    recordSuccess() {
        if (this.failures > 0) {
            console.log(`[CircuitBreaker] ✅ Success recorded. Resetting failure count from ${this.failures}`);
        }
        this.failures = 0;
        this.lastFailureTime = null;
    },
    
    recordFailure() {
        this.failures++;
        this.lastFailureTime = Date.now();
        console.log(`[CircuitBreaker] ❌ Failure recorded. Count: ${this.failures}/${this.threshold}`);
    }
};

/**
 * Fetches data with circuit breaker protection and exponential backoff retry logic
 * 
 * @param {string} url - The URL to fetch
 * @param {object} options - Axios request options
 * @param {number} maxRetries - Maximum number of retry attempts (default: 3)
 * @returns {Promise<any>} The response data
 */
const fetchWithCircuitBreaker = async (url, options = {}, maxRetries = 3) => {
    // Check circuit breaker before making API call
    if (circuitBreaker.isOpen()) {
        console.log("[fetchWithCircuitBreaker] ⚡ Circuit breaker is OPEN. Skipping API call.");
        throw new Error('Circuit breaker open - API temporarily unavailable');
    }

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`[fetchWithCircuitBreaker] Attempt ${attempt}/${maxRetries} for ${url}`);
            
            const response = await axios.get(url, {
                ...options,
                timeout: 30000
            });

            console.log(`[fetchWithCircuitBreaker] ✅ Success on attempt ${attempt}`);
            
            // Record success in circuit breaker
            circuitBreaker.recordSuccess();
            
            return response.data;

        } catch (error) {
            let errorMessage = error.message;
            if (error.response) {
                errorMessage = `HTTP ${error.response.status}: ${JSON.stringify(error.response.data)}`;
            }
            
            console.warn(`[fetchWithCircuitBreaker] ⚠️ Attempt ${attempt} failed:`, errorMessage);
            
            // Record failure in circuit breaker
            circuitBreaker.recordFailure();
            
            // If this was the last attempt, rethrow the error
            if (attempt === maxRetries) {
                console.error(`[fetchWithCircuitBreaker] ❌ All ${maxRetries} attempts failed`);
                throw error;
            }
            
            // Exponential backoff: wait 2^attempt seconds (2s, 4s, 8s...)
            const waitTime = Math.min(Math.pow(2, attempt) * 1000, 30000);
            console.log(`[fetchWithCircuitBreaker] ⏳ Waiting ${waitTime}ms before next retry...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }
    }
};

module.exports = {
    fetchWithCircuitBreaker,
    circuitBreaker
};