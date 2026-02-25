/**
 * Mapping Engine - Converts source XML to DCC-JSON using a mapping profile.
 * Pure client-side, no API calls needed. Uses XPath for namespace-agnostic resolution.
 *
 * Supported mapping types:
 *   string, number, integer, boolean, date       — basic scalars
 *   array                                        — repeating elements (recursive nesting)
 *   asFoundAsLeft                                — reads isAsFound/isAsLeft attributes
 *   conformity                                   — reads isConform attribute → "pass"/"fail"
 *   concat                                       — combine multiple source fields
 *   static                                       — fixed value (no source needed)
 *   template                                     — string template with source references
 *   lookup                                       — value mapping via lookup table
 *   firstOf                                      — first non-null from multiple sources
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

/**
 * Parse an XML string into a tree structure for UI display.
 * @param {string} xmlString
 * @returns {object|null} Tree structure with paths
 */
export function parseXmlToTree(xmlString) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlString, 'text/xml');
    if (doc.querySelector('parsererror')) return null;
    return buildTreeNode(doc.documentElement, '');
}

/**
 * Flatten a tree into a list of all unique paths (elements + attributes).
 * @param {object} tree - from parseXmlToTree
 * @returns {string[]} Sorted list of XPath-like paths
 */
export function flattenXmlPaths(tree) {
    const paths = new Set();
    collectPaths(tree, paths);
    return Array.from(paths).sort();
}

// ============================================================
// Internal: Tree building
// ============================================================

function buildTreeNode(el, parentPath) {
    const name = el.localName;
    const path = parentPath ? `${parentPath}/${name}` : name;
    const node = {
        name,
        path,
        attributes: [],
        children: [],
        hasText: false,
        value: null,
        count: 1,
    };

    // Attributes (skip xmlns)
    for (const attr of el.attributes) {
        if (attr.name.startsWith('xmlns')) continue;
        node.attributes.push({
            name: attr.name,
            path: `${path}/@${attr.name}`,
            value: attr.value,
        });
    }

    // Text content (only if no child elements)
    const childElements = Array.from(el.children);
    if (childElements.length === 0) {
        const text = el.textContent?.trim();
        if (text) {
            node.hasText = true;
            node.value = text.length > 60 ? text.substring(0, 57) + '...' : text;
        }
    }

    // Group child elements by local name to detect repeating elements
    const childMap = new Map();
    for (const child of childElements) {
        const childNode = buildTreeNode(child, path);
        const existing = childMap.get(child.localName);
        if (existing) {
            existing.count++;
            // Merge attributes and children we haven't seen
            for (const attr of childNode.attributes) {
                if (!existing.attributes.some(a => a.name === attr.name)) {
                    existing.attributes.push(attr);
                }
            }
            for (const sub of childNode.children) {
                if (!existing.children.some(c => c.name === sub.name)) {
                    existing.children.push(sub);
                }
            }
        } else {
            childMap.set(child.localName, childNode);
        }
    }

    node.children = Array.from(childMap.values());
    return node;
}

function collectPaths(node, paths) {
    // Element path (text content)
    if (node.hasText) {
        paths.add(node.path);
    }
    // Attribute paths
    for (const attr of node.attributes) {
        paths.add(attr.path);
    }
    // Recurse children
    for (const child of node.children) {
        collectPaths(child, paths);
    }
    // Also add the element path even if it has children (for array sources)
    paths.add(node.path);
}

// ============================================================
// Internal: Rule application
// ============================================================

function applyRule(doc, context, rule, target) {
    if (rule.type === 'array') {
        const elements = findElements(doc, context, rule.source);
        const arr = [];

        for (const el of elements) {
            const item = processArrayFields(doc, el, rule.fields);
            arr.push(item);
        }

        setNested(target, rule.target.replace('[]', ''), arr);
    } else {
        const val = extractValue(doc, context, rule);
        if (val != null) setNested(target, rule.target, val);
    }
}

/**
 * Recursively process fields within an array element.
 * Supports unlimited nesting depth.
 */
function processArrayFields(doc, parentEl, fields) {
    const item = {};
    for (const field of (fields || [])) {
        if (field.type === 'array') {
            // Nested array — recurse
            const elements = findElements(doc, parentEl, field.source);
            const arr = [];
            for (const el of elements) {
                arr.push(processArrayFields(doc, el, field.fields));
            }
            item[field.target.replace('[]', '')] = arr;
        } else {
            const val = extractValue(doc, parentEl, field);
            if (val != null) item[field.target] = val;
        }
    }
    return item;
}

function extractValue(doc, context, field) {
    const { source, type } = field;

    // --- Advanced types (no source needed) ---
    if (type === 'static') {
        return field.value;
    }
    if (type === 'concat') {
        return extractConcat(doc, context, field);
    }
    if (type === 'template') {
        return extractTemplate(doc, context, field);
    }
    if (type === 'lookup') {
        return extractLookup(doc, context, field);
    }
    if (type === 'firstOf') {
        return extractFirstOf(doc, context, field);
    }

    // --- Special DCC types ---
    if (type === 'asFoundAsLeft') {
        return extractAsFoundAsLeft(context);
    }
    if (type === 'conformity') {
        return extractConformity(doc, context, source);
    }

    if (!source) return null;

    // --- Resolve path to raw value ---
    const raw = resolveRawValue(doc, context, source);
    if (raw == null || raw === '') return null;

    // --- Apply type conversion ---
    switch (type) {
        case 'number': return parseFloat(raw);
        case 'integer': return parseInt(raw, 10);
        case 'boolean': return raw === 'true' || raw === '1';
        case 'date': return dateTimeToDate(raw);
        default: return raw; // string
    }
}

/**
 * Resolve a path to its raw string value.
 */
function resolveRawValue(doc, context, source) {
    if (!source) return null;

    if (source === '.') {
        return textContent(context);
    }

    if (source.startsWith('@')) {
        // Attribute on current element
        return context.getAttribute(source.substring(1));
    }

    if (source.includes('/@')) {
        // Path ending with attribute
        const parts = source.split('/@');
        const el = parts[0] === '.' ? context : findFirst(doc, context, parts[0]);
        return el ? el.getAttribute(parts[1]) : null;
    }

    const el = findFirst(doc, context, source);
    return el ? textContent(el) : null;
}

// --- Advanced type extractors ---

function extractConcat(doc, context, field) {
    const sources = field.sources || [];
    const separator = field.separator ?? ' ';
    const parts = [];

    for (const src of sources) {
        const raw = resolveRawValue(doc, context, src);
        if (raw) parts.push(raw);
    }

    return parts.length > 0 ? parts.join(separator) : null;
}

function extractTemplate(doc, context, field) {
    let result = field.template || '';
    const sources = field.sources || [];
    let hasValue = false;

    for (let i = 0; i < sources.length; i++) {
        const raw = resolveRawValue(doc, context, sources[i]) || '';
        if (raw) hasValue = true;
        result = result.replace(new RegExp(`\\{${i}\\}`, 'g'), raw);
    }

    return hasValue ? result.trim() : null;
}

function extractLookup(doc, context, field) {
    const raw = resolveRawValue(doc, context, field.source);
    if (raw == null) return null;
    const map = field.map || {};
    return map[raw] ?? map[raw.toLowerCase()] ?? map['*'] ?? raw;
}

function extractFirstOf(doc, context, field) {
    for (const src of (field.sources || [])) {
        const raw = resolveRawValue(doc, context, src);
        if (raw) return raw;
    }
    return null;
}

// --- Special DCC type extractors ---

function extractAsFoundAsLeft(el) {
    const isAsFound = el.getAttribute('isAsFound');
    const isAsLeft = el.getAttribute('isAsLeft');
    if (isAsFound === 'true') return 'asFound';
    if (isAsLeft === 'true') return 'asLeft';
    return null;
}

function extractConformity(doc, context, source) {
    const el = (!source || source === '.') ? context : findFirst(doc, context, source);
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
