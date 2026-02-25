/**
 * Mapping Store - Manages mapping profiles in localStorage.
 * Provides save, load, delete, import/export, and auto-detection.
 */

const STORAGE_KEY = 'dcc-mapping-profiles';

/**
 * Get all saved mapping profiles.
 * @returns {object[]} Array of mapping profiles
 */
export function getAllProfiles() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

/**
 * Save a mapping profile (insert or update by id).
 * @param {object} profile - The mapping profile to save
 */
export function saveProfile(profile) {
    if (!profile.id) {
        profile.id = generateId();
    }
    profile.updatedAt = new Date().toISOString();
    if (!profile.createdAt) {
        profile.createdAt = profile.updatedAt;
    }

    const profiles = getAllProfiles();
    const idx = profiles.findIndex(p => p.id === profile.id);
    if (idx >= 0) {
        profiles[idx] = profile;
    } else {
        profiles.push(profile);
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
    return profile;
}

/**
 * Get a single profile by ID.
 * @param {string} id
 * @returns {object|null}
 */
export function getProfile(id) {
    return getAllProfiles().find(p => p.id === id) || null;
}

/**
 * Delete a profile by ID.
 * @param {string} id
 */
export function deleteProfile(id) {
    const profiles = getAllProfiles().filter(p => p.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
}

/**
 * Detect which profile matches a given XML by namespace and root element.
 * @param {string} xmlString
 * @returns {object|null} matching profile or null
 */
export function detectProfileForXml(xmlString) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlString, 'text/xml');
    if (doc.querySelector('parsererror')) return null;

    const root = doc.documentElement;
    const ns = root.namespaceURI || '';
    const localName = root.localName;

    const profiles = getAllProfiles();

    // First try exact namespace match
    for (const p of profiles) {
        if (p.schemaNamespace && p.schemaNamespace === ns) {
            return p;
        }
    }

    // Then try root element match
    for (const p of profiles) {
        if (p.rootElement && p.rootElement === localName) {
            return p;
        }
    }

    return null;
}

/**
 * Export a profile as a downloadable JSON file.
 * @param {object} profile
 */
export function exportProfile(profile) {
    const json = JSON.stringify(profile, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const safeName = (profile.name || 'mapping-profile')
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .substring(0, 50);

    const a = document.createElement('a');
    a.href = url;
    a.download = `${safeName}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/**
 * Import a profile from a JSON file.
 * @param {File} file
 * @returns {Promise<object>} The imported profile
 */
export function importProfile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const profile = JSON.parse(e.target.result);
                if (!profile.mappings || !Array.isArray(profile.mappings)) {
                    reject(new Error('Invalid profile: missing mappings array.'));
                    return;
                }
                // Assign a new ID to avoid conflicts
                profile.id = generateId();
                profile.createdAt = new Date().toISOString();
                profile.updatedAt = profile.createdAt;
                const saved = saveProfile(profile);
                resolve(saved);
            } catch (err) {
                reject(new Error('Failed to parse profile JSON: ' + err.message));
            }
        };
        reader.onerror = () => reject(new Error('Failed to read file.'));
        reader.readAsText(file);
    });
}

function generateId() {
    return 'mp-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 8);
}
