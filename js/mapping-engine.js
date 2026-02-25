/**
 * Mapping Engine - Converts source XML to DCC-JSON using a mapping profile.
 * Pure client-side, no API calls needed. Uses XPath for namespace-agnostic resolution.
 */

/**
 * Convert an XML string to DCC-JSON using a mapping profile.
 * @param {string} xmlString - The source XML content
 * @param {object} profile - The mapping profile
 * @returns {object} DCC-JSON structure
 */
export function convertXmlToDccJson(xmlString, profile) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlString, 'text/xml');

    const parseError = doc.querySelector('parsererror');
    if (parseError) {
        throw new Error('XML parse error: ' + parseError.textContent.substring(0, 200));
    }

    const result = {};

    for (const rule of profile.mappings) {
        try {
            applyRule(doc, doc.documentElement, rule, result);
        } catch (e) {
            console.warn(`Mapping rule failed for "${rule.target}":`, e.message);
        }
    }

    return result;
}

/**
 * Detect which saved profile matches a given XML by namespace and root element.
 * @param {string} xmlString
 * @param {object[]} profiles
 * @returns {object|null} matching profile or null
 */
export function detectProfile(xmlString, profiles) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlString, 'text/xml');
    if (doc.querySelector('parsererror')) return null;

    const root = doc.documentElement;
    const ns = root.namespaceURI || '';
    const localName = root.localName;

    for (const p of profiles) {
        if (p.schemaNamespace === ns || p.rootElement === localName) {
            return p;
        }
    }
    return null;
}

// ============================================================
// Internal helpers
// ============================================================

function applyRule(doc, context, rule, target) {
    if (rule.type === 'array') {
        const elements = findElements(doc, context, rule.source);
        const arr = [];

        for (const el of elements) {
            const item = {};
            for (const field of (rule.fields || [])) {
                if (field.type === 'array') {
                    // Nested array (e.g., results inside measurementResults)
                    const subElements = findElements(doc, el, field.source);
                    const subArr = [];
                    for (const subEl of subElements) {
                        const subItem = {};
                        for (const sf of (field.fields || [])) {
                            const val = extractValue(doc, subEl, sf);
                            if (val != null) subItem[sf.target] = val;
                        }
                        subArr.push(subItem);
                    }
                    item[field.target.replace('[]', '')] = subArr;
                } else {
                    const val = extractValue(doc, el, field);
                    if (val != null) item[field.target] = val;
                }
            }
            arr.push(item);
        }

        setNested(target, rule.target.replace('[]', ''), arr);
    } else {
        const val = extractValue(doc, context, rule);
        if (val != null) setNested(target, rule.target, val);
    }
}

function extractValue(doc, context, field) {
    const { source, type } = field;
    if (!source) return null;

    // Handle special types
    if (type === 'asFoundAsLeft') {
        return extractAsFoundAsLeft(context);
    }
    if (type === 'conformity') {
        return extractConformity(doc, context, source);
    }

    // Resolve the path
    let raw = null;
    if (source.startsWith('@')) {
        // Attribute on current element
        raw = context.getAttribute(source.substring(1));
    } else if (source.includes('@')) {
        // Path ending with attribute
        const parts = source.split('/@');
        const el = findFirst(doc, context, parts[0]);
        raw = el ? el.getAttribute(parts[1]) : null;
    } else {
        const el = findFirst(doc, context, source);
        raw = el ? textContent(el) : null;
    }

    if (raw == null || raw === '') return null;

    // Apply type conversion
    switch (type) {
        case 'number': return parseFloat(raw);
        case 'integer': return parseInt(raw, 10);
        case 'boolean': return raw === 'true';
        case 'date': return dateTimeToDate(raw);
        default: return raw;
    }
}

function extractAsFoundAsLeft(el) {
    const isAsFound = el.getAttribute('isAsFound');
    const isAsLeft = el.getAttribute('isAsLeft');
    if (isAsFound === 'true') return 'asFound';
    if (isAsLeft === 'true') return 'asLeft';
    return null;
}

function extractConformity(doc, context, source) {
    const el = source === '.' ? context : findFirst(doc, context, source);
    if (!el) return null;
    const val = el.getAttribute('isConform');
    if (val === 'true') return 'pass';
    if (val === 'false') return 'fail';
    return null;
}

function dateTimeToDate(val) {
    if (!val) return null;
    // Handle "2024-08-09T14:35:13.094+02:00" → "2024-08-09"
    const match = val.match(/^(\d{4}-\d{2}-\d{2})/);
    return match ? match[1] : val;
}

function textContent(el) {
    return el.textContent?.trim() || null;
}

// ============================================================
// Namespace-agnostic path resolution
// ============================================================

/**
 * Convert a simple path to a namespace-agnostic XPath using local-name().
 * Examples:
 *   "CertificateData/HeaderData" → "descendant-or-self::*[local-name()='CertificateData']/*[local-name()='HeaderData']"
 *   "BusinessPartner[@role='SoldTo']" → "*[local-name()='BusinessPartner'][@role='SoldTo']"
 *   ".." → ".."
 */
function toXPath(path, fromRoot) {
    if (!path || path === '.') return '.';

    const steps = path.split('/');
    const xpathSteps = [];

    for (let i = 0; i < steps.length; i++) {
        const step = steps[i];

        if (step === '' && i === 0) {
            // Absolute path starting with /
            continue;
        }
        if (step === '..') {
            xpathSteps.push('..');
            continue;
        }
        if (step === '.') {
            xpathSteps.push('.');
            continue;
        }
        if (step.startsWith('@')) {
            xpathSteps.push(step);
            continue;
        }

        // Parse element name and optional predicate
        const match = step.match(/^([^[]+)(.*)$/);
        if (!match) {
            xpathSteps.push(step);
            continue;
        }

        const name = match[1];
        const predicate = match[2] || '';

        if (i === 0 && fromRoot) {
            // First step: search descendants from root
            xpathSteps.push(`descendant-or-self::*[local-name()='${name}']${predicate}`);
        } else {
            xpathSteps.push(`*[local-name()='${name}']${predicate}`);
        }
    }

    return xpathSteps.join('/');
}

function findElements(doc, context, path) {
    const xpath = toXPath(path, context === doc.documentElement);
    const result = [];
    try {
        const xpathResult = doc.evaluate(xpath, context, null, XPathResult.ORDERED_NODE_ITERATOR_TYPE, null);
        let node;
        while ((node = xpathResult.iterateNext())) {
            result.push(node);
        }
    } catch (e) {
        console.warn(`XPath evaluation failed for "${xpath}":`, e.message);
    }
    return result;
}

function findFirst(doc, context, path) {
    const xpath = toXPath(path, context === doc.documentElement);
    try {
        const xpathResult = doc.evaluate(xpath, context, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
        return xpathResult.singleNodeValue;
    } catch (e) {
        console.warn(`XPath evaluation failed for "${xpath}":`, e.message);
        return null;
    }
}

// ============================================================
// Nested object setter
// ============================================================

function setNested(obj, path, value) {
    const keys = path.split('.');
    let current = obj;
    for (let i = 0; i < keys.length - 1; i++) {
        const key = keys[i];
        if (!(key in current) || typeof current[key] !== 'object') {
            current[key] = {};
        }
        current = current[key];
    }
    current[keys[keys.length - 1]] = value;
}
