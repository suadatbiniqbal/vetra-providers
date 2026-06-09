const crypto = require('crypto');
const axios = require('axios');

/**
 * Utility to solve Altcha (Proof-of-Work) challenges.
 */
class AltchaSolver {
    /**
     * Solves an Altcha challenge.
     * @param {Object} challengeData - The challenge object from /altcha/challenge
     * @returns {Promise<Object>} - The solution object to be base64 encoded
     */
    async solve(challengeData) {
        const { algorithm, challenge, salt, maxnumber, signature } = challengeData;
        console.log(`[AltchaSolver] Solving ${algorithm} challenge...`);
        console.log(`[AltchaSolver] Salt: ${salt}`);
        console.log(`[AltchaSolver] Target: ${challenge}`);

        const startTime = Date.now();
        // Brute force the number
        for (let n = 0; n <= (maxnumber || 100000); n++) {
            const hash = crypto.createHash('sha256').update(salt + n).digest('hex');
            
            if (hash === challenge) {
                const took = Date.now() - startTime;
                console.log(`[AltchaSolver] Found solution: ${n} in ${took}ms`);
                return {
                    algorithm,
                    challenge,
                    number: n,
                    salt,
                    signature,
                    took
                };
            }

            if (n % 20000 === 0 && n > 0) {
                console.log(`[AltchaSolver] Processed ${n} numbers...`);
            }
        }

        console.error(`[AltchaSolver] Failed to solve challenge within maxnumber (${maxnumber})`);
        return null;
    }

    /**
     * Fetches a challenge from the endpoint and solves it.
     * @param {string} challengeUrl - The URL to fetch the challenge from
     * @returns {Promise<string>} - Base64 encoded solution
     */
    async getPayload(challengeUrl) {
        try {
            const response = await axios.get(challengeUrl);
            const challengeData = response.data;
            const solution = await this.solve(challengeData);
            
            if (solution) {
                return Buffer.from(JSON.stringify(solution)).toString('base64');
            }
            return null;
        } catch (error) {
            console.error(`[AltchaSolver] Error fetching/solving challenge:`, error.message);
            return null;
        }
    }
}

module.exports = new AltchaSolver();