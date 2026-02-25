/**
 * Mapping Trainer - Uses Claude API to generate a mapping profile
 * from an XSD schema and a sample XML document (one-time training).
 */

const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-20250514';

/**
 * Train a mapping profile from XSD + sample XML using Claude.
 * @param {string} apiKey - Anthropic API key
 * @param {string} xsdContent - The XSD schema content
 * @param {string} xmlContent - A sample XML document
 * @param {string} profileName - User-given name for this profile
 * @returns {Promise<object>} A mapping profile object
 */
export async function trainMappingProfile(apiKey, xsdContent, xmlContent, profileName) {
    const systemPrompt = buildTrainingSystemPrompt();
    const userPrompt = buildTrainingUserPrompt(xsdContent, xmlContent, profileName);

    const response = await fetch(CLAUDE_API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
            model: MODEL,
            max_tokens: 16384,
            system: systemPrompt,
            messages: [{ role: 'user', content: userPrompt }],
        }),
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(
            `API error (${response.status}): ${error.error?.message || response.statusText}`
        );
    }

    const result = await response.json();
    const content = result.content?.[0]?.text;

    if (!content) {
        throw new Error('No response received from Claude API.');
    }

    return parseTrainingResponse(content, xsdContent, profileName);
}

function buildTrainingSystemPrompt() {
    return `You are an expert in XML schema mapping and the DCC standard (Digital Calibration Certificate, PTB).

Your task is to analyze an XSD schema and a sample XML document, then generate a MAPPING PROFILE that maps paths in the source XML to the DCC-JSON intermediate format.

The DCC-JSON intermediate format has this structure:

{
  "coreData": {
    "countryCodeISO3166_1": "string",
    "languageCode": "string",
    "uniqueIdentifier": "string (certificate number)",
    "calibrationMark": "string",
    "beginPerformanceDate": "YYYY-MM-DD",
    "endPerformanceDate": "YYYY-MM-DD",
    "performanceLocation": "laboratory|customer",
    "orderNumber": "string",
    "previousReport": "string"
  },
  "calibrationLaboratory": {
    "name": "string",
    "calibrationLaboratoryCode": "string",
    "street": "string",
    "postCode": "string",
    "city": "string",
    "country": "string",
    "eMail": "string",
    "phone": "string",
    "fax": "string",
    "website": "string"
  },
  "customer": {
    "name": "string",
    "street": "string",
    "postCode": "string",
    "city": "string",
    "country": "string",
    "eMail": "string",
    "phone": "string",
    "contactPerson": "string"
  },
  "respPersons": [
    { "name": "string", "role": "string", "isMainSigner": boolean }
  ],
  "items": [
    {
      "name": "string",
      "manufacturer": "string",
      "model": "string",
      "serialNumber": "string",
      "inventoryNumber": "string",
      "equipmentNumber": "string",
      "testEquipmentNumber": "string",
      "tagNumber": "string",
      "description": "string",
      "parameter": "string",
      "measuringRange": "string",
      "signalOutput": "string",
      "calibrationRange": "string",
      "medium": "string"
    }
  ],
  "accessories": [
    { "type": "string", "description": "string", "serialNumber": "string" }
  ],
  "measurementResults": [
    {
      "name": "string",
      "description": "string",
      "category": "asFound|asLeft|corrected|null",
      "calibrationProcedure": "string",
      "method": "string",
      "usedMethods": [ { "name": "string", "description": "string" } ],
      "decisionRule": "string",
      "influenceConditions": [
        { "name": "string", "value": number, "unit": "string", "min": number, "max": number }
      ],
      "results": [
        {
          "name": "string",
          "setPoint": number, "setPointUnit": "string",
          "nominalValue": number, "nominalUnit": "string",
          "referenceValue": number, "referenceUnit": "string",
          "measuredValue": number, "measuredUnit": "string",
          "deviation": number, "deviationUnit": "string",
          "allowedDeviation": number, "allowedDeviationUnit": "string",
          "uncertainty": number, "uncertaintyUnit": "string",
          "coverageFactor": number, "coverageProbability": number,
          "mpe": number, "mpeUnit": "string",
          "conformity": "pass|fail|null"
        }
      ]
    }
  ],
  "measuringEquipments": [
    {
      "name": "string",
      "manufacturer": "string",
      "model": "string",
      "serialNumber": "string",
      "equipmentNumber": "string",
      "certificateNumber": "string",
      "calibrationMark": "string",
      "calibrationDate": "YYYY-MM-DD",
      "nextCalibrationDate": "YYYY-MM-DD",
      "traceability": "string"
    }
  ],
  "calibrationSOPs": [
    { "sopNumber": "string", "description": "string" }
  ],
  "statements": [
    {
      "name": "string",
      "description": "string",
      "conformity": "pass|fail|null",
      "decisionRule": "string",
      "norm": "string"
    }
  ],
  "remarks": "string"
}

OUTPUT FORMAT: You must output a JSON mapping profile with this exact structure:

{
  "name": "Profile name",
  "schemaNamespace": "the target namespace from the XSD",
  "rootElement": "the root element local name",
  "description": "Brief description of this schema",
  "mappings": [
    {
      "target": "coreData.uniqueIdentifier",
      "source": "XPath-like path from root to the data element",
      "type": "string|number|integer|boolean|date"
    },
    {
      "target": "measurementResults[]",
      "source": "path to repeating element",
      "type": "array",
      "fields": [
        { "target": "name", "source": "child-path", "type": "string" },
        {
          "target": "results[]",
          "source": "child-path-to-result-elements",
          "type": "array",
          "fields": [
            { "target": "nominalValue", "source": "child-path", "type": "number" }
          ]
        }
      ]
    }
  ]
}

PATH RULES:
- Paths use element local names (no namespace prefixes needed)
- Use "/" to separate path steps: "CertificateData/HeaderData/CertificateNumber"
- Use "/@attr" for attributes: "Device/@serialNumber" or "@role"
- Use "." for current element text content
- First path step is searched from the document root using descendant-or-self
- Subsequent steps are direct children
- For array mappings: "source" points to the repeating container, "fields" use paths relative to each element
- For nested arrays within arrays: use type "array" in fields with sub-fields
- Special types: "asFoundAsLeft" reads isAsFound/isAsLeft attributes, "conformity" reads isConform attribute
- Predicates are supported: "BusinessPartner[@role='SoldTo']"

IMPORTANT RULES:
- Map ALL data fields you can find in the XSD/XML to the DCC-JSON format
- For arrays (measurementResults, measuringEquipments, items, etc.), use type "array"
- For dates, use type "date" to auto-convert to YYYY-MM-DD
- For numeric values, use type "number" or "integer"
- Include mappings for nested structures (results within measurementResults, etc.)
- If the source XML uses attributes for data (like isAsFound, isConform), use the appropriate special type
- Only output the JSON mapping profile, no other text`;
}

function buildTrainingUserPrompt(xsdContent, xmlContent, profileName) {
    let prompt = `Create a mapping profile named "${profileName}" for the following schema and sample XML.\n\n`;

    prompt += '--- XSD Schema ---\n';
    prompt += xsdContent;
    prompt += '\n\n--- Sample XML ---\n';
    prompt += xmlContent;

    return prompt;
}

function parseTrainingResponse(content, xsdContent, profileName) {
    let jsonStr = content.trim();

    // Remove markdown code block wrapper if present
    const codeBlockMatch = jsonStr.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
    if (codeBlockMatch) {
        jsonStr = codeBlockMatch[1].trim();
    }

    let profile;
    try {
        profile = JSON.parse(jsonStr);
    } catch (e) {
        throw new Error('Failed to parse training response as JSON: ' + e.message);
    }

    // Ensure required fields
    if (!profile.mappings || !Array.isArray(profile.mappings)) {
        throw new Error('Invalid profile: missing mappings array.');
    }

    // Fill in defaults
    if (!profile.name) profile.name = profileName;
    if (!profile.schemaNamespace) {
        const nsMatch = xsdContent.match(/targetNamespace="([^"]+)"/);
        if (nsMatch) profile.schemaNamespace = nsMatch[1];
    }
    if (!profile.rootElement) {
        const rootMatch = xsdContent.match(/<xs:element\s+name="([^"]+)"/);
        if (rootMatch) profile.rootElement = rootMatch[1];
    }

    return profile;
}
