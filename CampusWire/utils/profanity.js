// utils/profanity.js
const profaneWords = [
    'idiot', 'stupid', 'fuck', 'shit', 'bitch', 'asshole', 'bastard',
    'damn', 'crap', 'dick', 'piss', 'cock', 'pussy', 'whore', 'slut',
    'retard', 'moron', 'nigga', 'nigger', 'faggot', 'douche', 'wanker',
    'bollocks', 'arsehole', 'bloody', 'bugger', 'cunt', 'darn', 'dickhead',
    'feck', 'minge', 'munter', 'prick', 'shitbag', 'shitface', 'twat',
    'wank', 'fucker', 'motherfucker', 'bullshit', 'dipshit', 'shithead',
    'ass', 'arse', 'bitchy', 'fucking', 'fucked', 'shitty', 'pissed'
];

// More comprehensive profanity detection
function containsBadWord(text = '') {
    if (!text || typeof text !== 'string') return false;
    
    const normalizedText = text.toLowerCase()
        .replace(/[^a-z0-9]/g, ' ') // Replace non-alphanumeric with spaces
        .replace(/\s+/g, ' ')       // Collapse multiple spaces
        .trim();
    
    const words = normalizedText.split(' ');
    
    // Check for exact matches
    for (const word of words) {
        if (profaneWords.includes(word)) {
            return true;
        }
    }
    
    // Check for partial matches (avoiding false positives)
    for (const badWord of profaneWords) {
        if (badWord.length > 3 && normalizedText.includes(badWord)) {
            return true;
        }
    }
    
    // Check for common evasions (leetspeak, etc.)
    const leetPatterns = [
        /f[u*]ck/, /sh[i*]t/, /b[i*]tch/, /[a@]ss/, /d[i*]ck/, /p[i*]ss/,
        /[s5]h[i*]t/, /f[u*]c[kq]/, /b[i*]t[c*]h/, /[a@][s5][s5]/
    ];
    
    for (const pattern of leetPatterns) {
        if (pattern.test(text.toLowerCase())) {
            return true;
        }
    }
    
    return false;
}

// Alternative: More strict checking for specific contexts
function containsExplicitContent(text = '') {
    if (!text) return false;
    
    const explicitPatterns = [
        /\bfuck\w*\b/i,
        /\bshit\w*\b/i,
        /\bbitch\w*\b/i,
        /\basshole\b/i,
        /\bdick\w*\b/i,
        /\bpussy\w*\b/i,
        /\bwhore\w*\b/i,
        /\bslut\w*\b/i,
        /\bnigger\w*\b/i,
        /\bfaggot\w*\b/i
    ];
    
    return explicitPatterns.some(pattern => pattern.test(text));
}

// Get a cleaned version of the text (for moderation)
function filterProfanity(text = '') {
    if (!text) return text;
    
    let filtered = text;
    profaneWords.forEach(badWord => {
        const regex = new RegExp(`\\b${badWord}\\b`, 'gi');
        filtered = filtered.replace(regex, '*'.repeat(badWord.length));
    });
    
    return filtered;
}

// Check if text needs moderation
function needsModeration(text = '') {
    return containsBadWord(text) || containsExplicitContent(text);
}

module.exports = { 
    containsBadWord, 
    containsExplicitContent, 
    filterProfanity, 
    needsModeration,
    profaneWords 
};