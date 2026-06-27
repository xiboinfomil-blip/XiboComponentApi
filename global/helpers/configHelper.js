/**
 * Configuration Helper
 * Parses URL parameters based on a defined schema.
 */

// 1. DEFINE YOUR SCHEMA HERE
// To add a new param, just add a line here.
// Types: 'number', 'boolean', 'string'
const CONFIG_SCHEMA = {
    speed: {
        type: 'number',
        default: 5
    },
    refetch: {
        type: 'boolean',
        default: false
    },
    dummy: {
        type: 'boolean',
        default: false
    }
    // Example of adding a new param later:
    // theme: {
    //     type: 'string',
    //     default: 'light'
    // }
};

/**
 * Retrieves configuration from URL parameters.
 * @returns {Object} The configuration object
 */
function getConfig() {
    const params = new URLSearchParams(window.location.search);
    const config = {};

    // Loop through the schema to build the config object
    for (const [key, definition] of Object.entries(CONFIG_SCHEMA)) {
        const urlValue = params.get(key);

        if (urlValue !== null) {
            // Parse based on type defined in schema
            switch (definition.type) {
                case 'number':
                    const num = parseFloat(urlValue);
                    config[key] = isNaN(num) ? definition.default : num;
                    break;
                
                case 'boolean':
                    config[key] = urlValue.toLowerCase() === 'true';
                    break;
                
                case 'string':
                default:
                    config[key] = urlValue;
                    break;
            }
        } else {
            // Use default if not in URL
            config[key] = definition.default;
        }
    }

    return config;
}

// Export for module systems if needed
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { getConfig };
}