const axios = require("axios");

async function getBaseUrl(providerValue) {
    try {
        const res = await axios.get(
            "https://himanshu8443.github.io/providers/modflix.json",
            { timeout: 10000 }
        );
        const baseUrlData = res.data;

        const providerKey = Object.keys(baseUrlData).find(
            key => key.toLowerCase() === providerValue.toLowerCase()
        );

        if (providerKey && baseUrlData[providerKey]) {
            return baseUrlData[providerKey].url;
        } else {
            console.warn(`Provider not found in config: ${providerValue}`);
            return "";
        }
    } catch (error) {
        console.error(`Error fetching baseUrl: ${providerValue}`, error.message);
        return "";
    }
}

module.exports = { getBaseUrl };