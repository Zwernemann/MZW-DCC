/**
 * Mapping Trainer - Uses Claude API to generate a comprehensive mapping profile
 * from an XSD schema and a sample XML document (one-time training).
 *
 * The prompt is designed to be EXHAUSTIVE — it instructs Claude to map every
 * element and attribute from the source schema into the DCC-JSON format.
 */

const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-20250514';

/**
 * Train a mapping profile from XSD + sample XML using Claude.
 * @param {string} apiKey - Anthropic API key
 * @param {string} xsdContent - The XSD schema content
 * @param {string} xmlContent - A sample XML document
 * @param {string} profileName - User-given name for this profile
 * @param {function} [onProgress] - Optional progress callback (0-100)
 * @returns {Promise<object>} A mapping profile object
 */
export async function trainMappingProfile(apiKey, xsdContent, xmlContent, profileName, onProgress) {
    const systemPrompt = buildTrainingSystemPrompt();
    const userPrompt = buildTrainingUserPrompt(xsdContent, xmlContent, profileName);

    if (onProgress) onProgress(20, 'Sending schema to Claude API...');

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
            max_tokens: 64000,
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

    if (onProgress) onProgress(80, 'Parsing response...');

    const result = await response.json();
    const content = result.content?.[0]?.text;

    if (!content) {
        throw new Error('No response received from Claude API.');
    }

    const profile = parseTrainingResponse(content, xsdContent, profileName);

    if (onProgress) onProgress(100, 'Profile generated!');

    return profile;
}

// ============================================================
// System Prompt — comprehensive and exhaustive
// ============================================================

function buildTrainingSystemPrompt() {
    return `You are an expert in XML schema analysis, XPath, and calibration certificate standards.

YOUR TASK: Analyze an XSD schema and a sample XML document to generate a COMPLETE and EXHAUSTIVE mapping profile that transforms the source XML into the DCC-JSON intermediate format.

CRITICAL REQUIREMENTS:
1. You MUST map EVERY data element and attribute from the source schema. Analyze EVERY complexType, EVERY element, EVERY attribute in the XSD.
2. Cross-reference with the sample XML to verify paths and understand the actual data structure.
3. If a source field has no exact DCC-JSON match, use the CLOSEST container (description fields, remarks, identifications with custom names, etc.).
4. For repeating elements, ALWAYS use "array" type with complete field definitions.
5. For nested repeating elements (e.g., test points inside calibrations), use nested arrays.
6. Map BOTH element text content AND attributes — attributes often carry critical data (units, flags, IDs).
7. Pay special attention to: unit attributes (@unit), conformity flags (@isConform), role attributes (@role), date/time values, numeric values.
8. OUTPUT ONLY the JSON mapping profile. No other text, no explanations, no markdown.

=== COMPLETE DCC-JSON TARGET SCHEMA ===

The DCC-JSON format has the following sections. Map as many fields as possible.

{
  "coreData": {
    "countryCodeISO3166_1": "2-letter country code (DE, US, CH, etc.)",
    "languageCode": "2-letter language code (de, en, fr, etc.)",
    "uniqueIdentifier": "Certificate number / calibration certificate ID (REQUIRED)",
    "calibrationMark": "Calibration mark / seal number",
    "beginPerformanceDate": "Start date of calibration (YYYY-MM-DD)",
    "endPerformanceDate": "End date of calibration (YYYY-MM-DD)",
    "performanceLocation": "Where calibration was performed: 'laboratory' or 'customer'",
    "orderNumber": "Customer order number / purchase order / service order",
    "previousReport": "Previous calibration certificate number"
  },

  "calibrationLaboratory": {
    "name": "Full name of the calibration laboratory / company",
    "calibrationLaboratoryCode": "Accreditation code (e.g., D-K-12345-01-00)",
    "street": "Street address of the laboratory",
    "postCode": "Postal code / ZIP code",
    "city": "City name",
    "country": "Country name or code",
    "state": "State / province / region",
    "eMail": "Laboratory email address",
    "phone": "Laboratory phone number",
    "fax": "Laboratory fax number",
    "website": "Laboratory website URL"
  },

  "customer": {
    "name": "Customer / end user company name",
    "street": "Customer street address",
    "postCode": "Customer postal code",
    "city": "Customer city",
    "country": "Customer country",
    "state": "Customer state / province",
    "eMail": "Customer email",
    "phone": "Customer phone",
    "fax": "Customer fax",
    "contactPerson": "Contact person at the customer"
  },

  "respPersons": [
    {
      "name": "Full name of the responsible person (REQUIRED - combine first + last name if separate)",
      "role": "Role or function (e.g., 'Calibration technician', 'Reviewer', 'Signer')",
      "isMainSigner": "boolean - true if this person is the main signer"
    }
  ],

  "items": [
    {
      "name": "Name / designation of the calibration item",
      "manufacturer": "Manufacturer name",
      "model": "Model name / type designation / order code",
      "serialNumber": "Serial number (manufacturer-assigned)",
      "inventoryNumber": "Inventory number (customer-assigned)",
      "equipmentNumber": "Equipment number",
      "testEquipmentNumber": "Test equipment number (lab-assigned)",
      "tagNumber": "Tag number / plant ID",
      "description": "Detailed description of the item, including any info that doesn't fit other fields",
      "parameter": "Measured parameter (e.g., Temperature, Pressure, Flow, Volume)",
      "measuringRange": "Measuring range with units (e.g., '0...200 °C')",
      "signalOutput": "Signal output range (e.g., '4...20 mA')",
      "calibrationRange": "Calibration range with units",
      "medium": "Medium used (e.g., Water, Oil, Air, N2)"
    }
  ],

  "accessories": [
    {
      "type": "Type of accessory / component",
      "description": "Description",
      "serialNumber": "Accessory serial number",
      "manufacturer": "Accessory manufacturer",
      "model": "Accessory model"
    }
  ],

  "measurementResults": [
    {
      "name": "Name of this measurement result group (e.g., parameter name, 'Flow measurement')",
      "description": "Additional description, method details, or notes",
      "category": "'asFound' | 'asLeft' | 'corrected' | null — look for isAsFound/isAsLeft attributes",
      "calibrationProcedure": "Calibration procedure description or reference",
      "method": "Method name or identifier",
      "decisionRule": "Decision rule description (how pass/fail is determined)",
      "calibrationRange": "Range covered by this measurement",
      "measuringRange": "Measuring range for this result group",
      "signalOutput": "Signal output range",

      "usedMethods": [
        { "name": "Method name", "description": "Method description or reference" }
      ],

      "influenceConditions": [
        {
          "name": "Condition name (e.g., 'Temperature', 'Humidity', 'Barometric Pressure')",
          "value": "numeric value (single measurement)",
          "unit": "unit string (°C, %RH, hPa, etc.)",
          "min": "minimum value (for range)",
          "max": "maximum value (for range)",
          "uncertainty": "uncertainty of the condition measurement"
        }
      ],

      "conformity": "'pass' | 'fail' | null — overall conformity for this measurement group",

      "results": [
        {
          "name": "Point name or label",
          "setPoint": "numeric — the target/set point value",
          "setPointUnit": "unit of set point",
          "nominalValue": "numeric — nominal / reference standard value",
          "nominalUnit": "unit of nominal value",
          "referenceValue": "numeric — actual reference value read from standard",
          "referenceUnit": "unit of reference value",
          "measuredValue": "numeric — value measured on UUT (Unit Under Test)",
          "measuredUnit": "unit of measured value",
          "deviation": "numeric — measured - reference (or other error metric)",
          "deviationUnit": "unit of deviation",
          "allowedDeviation": "numeric — maximum permissible error / tolerance",
          "allowedDeviationUnit": "unit of allowed deviation",
          "uncertainty": "numeric — expanded measurement uncertainty (U)",
          "uncertaintyUnit": "unit of uncertainty",
          "coverageFactor": "numeric — k factor (typically 2)",
          "coverageProbability": "numeric — probability (typically 0.95)",
          "mpe": "numeric — Maximum Permissible Error",
          "mpeUnit": "unit of MPE",
          "conformity": "'pass' | 'fail' | null — per-point conformity assessment"
        }
      ]
    }
  ],

  "measuringEquipments": [
    {
      "name": "Name / description of the measuring equipment or reference standard",
      "manufacturer": "Equipment manufacturer",
      "model": "Equipment model",
      "serialNumber": "Equipment serial number",
      "equipmentNumber": "Equipment ID / inventory number",
      "certificateNumber": "Calibration certificate number of this equipment",
      "calibrationMark": "Calibration mark of this equipment",
      "calibrationDate": "Date when this equipment was last calibrated (YYYY-MM-DD)",
      "nextCalibrationDate": "Next calibration date / validity date (YYYY-MM-DD)",
      "traceability": "Traceability statement or chain"
    }
  ],

  "calibrationSOPs": [
    {
      "sopNumber": "SOP number or identifier",
      "description": "SOP description or title",
      "version": "SOP version",
      "norm": "Referenced norm or standard (e.g., ISO 17025, DIN EN...)"
    }
  ],

  "statements": [
    {
      "name": "Statement title or heading",
      "description": "Statement full text / content",
      "conformity": "'pass' | 'fail' | null — conformity assessment",
      "decisionRule": "Decision rule used for conformity assessment",
      "norm": "Referenced norm or standard",
      "conformityProbability": "Probability of conformity if stated"
    }
  ],

  "remarks": "Free-text remarks, comments, notes, footer text — catch-all for text that doesn't fit elsewhere"
}

=== MAPPING TYPES AND SYNTAX ===

BASIC TYPES (source path → single value):
  { "target": "...", "source": "XPath/to/element", "type": "string" }
  { "target": "...", "source": "XPath/to/element", "type": "number" }
  { "target": "...", "source": "XPath/to/element", "type": "integer" }
  { "target": "...", "source": "XPath/to/element", "type": "boolean" }
  { "target": "...", "source": "XPath/to/element", "type": "date" }

ARRAY TYPE (repeating elements with sub-fields, supports unlimited nesting):
  {
    "target": "measurementResults[]",
    "source": "CalibrationSettings/CalibrationSetting",
    "type": "array",
    "fields": [
      { "target": "name", "source": "ParameterName", "type": "string" },
      { "target": "category", "source": "Calibrations/Calibration", "type": "asFoundAsLeft" },
      {
        "target": "influenceConditions[]",
        "source": "Calibrations/Calibration/AmbientInformation",
        "type": "array",
        "fields": [
          { "target": "name", "source": ".", "type": "static", "value": "Temperature" },
          { "target": "value", "source": "Temperature", "type": "number" },
          { "target": "unit", "source": "Temperature/@unit", "type": "string" }
        ]
      },
      {
        "target": "results[]",
        "source": "Calibrations/Calibration/TestPoints/TestPoint",
        "type": "array",
        "fields": [
          { "target": "setPoint", "source": "SetPoint", "type": "number" },
          { "target": "setPointUnit", "source": "SetPoint/@unit", "type": "string" },
          { "target": "referenceValue", "source": "Reference", "type": "number" },
          { "target": "referenceUnit", "source": "Reference/@unit", "type": "string" },
          { "target": "measuredValue", "source": "UUTValue", "type": "number" },
          { "target": "measuredUnit", "source": "UUTValue/@unit", "type": "string" },
          { "target": "deviation", "source": "Deviations", "type": "number" },
          { "target": "deviationUnit", "source": "Deviations/@unit", "type": "string" },
          { "target": "uncertainty", "source": "Uncertainty", "type": "number" },
          { "target": "uncertaintyUnit", "source": "Uncertainty/@unit", "type": "string" },
          { "target": "mpe", "source": "MPE", "type": "number" },
          { "target": "mpeUnit", "source": "MPE/@unit", "type": "string" },
          { "target": "conformity", "source": "@isConform", "type": "conformity" }
        ]
      }
    ]
  }

SPECIAL DCC TYPES:
  "asFoundAsLeft"  — reads isAsFound/isAsLeft attribute on element → "asFound" or "asLeft"
  "conformity"     — reads @isConform → "pass" (true) or "fail" (false)

ADVANCED TYPES:

  "static" — fixed value, no source path needed:
    { "target": "...", "type": "static", "value": "laboratory" }

  "concat" — combine multiple source fields:
    { "target": "respPersons[].name", "type": "concat", "sources": ["FirstName", "LastName"], "separator": " " }

  "template" — string template with indexed source references:
    { "target": "customer.street", "type": "template", "template": "{0} {1}", "sources": ["StreetName", "HouseNumber"] }

  "lookup" — map source values to target values:
    { "target": "...", "type": "lookup", "source": "Status", "map": { "OK": "pass", "NOK": "fail", "PASS": "pass", "FAIL": "fail" } }

  "firstOf" — take the first non-empty value from multiple source paths:
    { "target": "customer.name", "type": "firstOf", "sources": ["CompanyName", "OrganizationName", "Name"] }

PATH RULES:
  - Paths use element LOCAL NAMES only (no namespace prefixes, they are stripped automatically)
  - "/" separates path steps: "CertificateData/HeaderData/CertificateNumber"
  - "/@attr" for attributes: "Device/@serialNumber" or just "@role" for current element
  - "." for current element text content
  - First path step is resolved with descendant-or-self from root
  - Subsequent steps are direct children
  - Predicates: "BusinessPartner[@role='SoldTo']" — use attribute predicates to select specific elements
  - For array fields: "source" is the path to the repeating container, "fields" paths are relative to each item

=== MAPPING STRATEGY CHECKLIST ===

Go through this checklist systematically and create mappings for EACH section:

□ CERTIFICATE METADATA → coreData
  - Certificate number, calibration mark, order/service number, dates
  - Language and country codes (from print settings, locale, or document attributes)
  - Performance location (lab vs customer site)
  - Previous report/certificate reference

□ LABORATORY/COMPANY → calibrationLaboratory
  - Company name (look for FirstLine, CompanyName, LabName, ServiceCenter)
  - Full address: street, post code, city, country, state
  - Contact: email, phone, fax, website
  - Accreditation code

□ CUSTOMER → customer
  - Look for BusinessPartner with role="SoldTo" or "Customer" or "EndUser"
  - Full name, complete address, contact person
  - Use predicates: BusinessPartner[@role='SoldTo']

□ RESPONSIBLE PERSONS → respPersons[]
  - ALL persons: technicians, reviewers, signers, approvers
  - Combine FirstName + LastName using "concat" type
  - Map their roles from the source

□ CALIBRATION ITEMS → items[]
  - ALL device information: name, manufacturer, model/order code, serial number
  - ALL identification numbers: equipment no., tag no., inventory no.
  - Measuring parameters, ranges, signal outputs, medium
  - Device firmware/software versions → put in description

□ ACCESSORIES → accessories[]
  - Sensors, probes, cables, adapters, fittings
  - Type, description, serial number

□ MEASUREMENT RESULTS → measurementResults[] (BE VERY THOROUGH!)
  - Create one measurementResult per calibration setting/parameter
  - Map EVERY field for each test point:
    * Set points with units
    * Reference values with units
    * Measured (UUT) values with units
    * Deviations/errors with units
    * Uncertainties with units, coverage factors, coverage probabilities
    * MPE / allowed deviations with units
    * Per-point conformity (isConform)
  - Map category (asFound/asLeft) from calibration attributes
  - Map influence conditions: temperature, humidity, pressure with min/max/values and units
  - Map decision rules
  - Map calibration range, measuring range, signal output range
  - If the source has multiple calibration types (e.g., As Found + As Left), map them all

□ MEASURING EQUIPMENT → measuringEquipments[]
  - ALL reference standards, tools, instruments used
  - Name/description, serial number, manufacturer, model
  - Certificate numbers, calibration dates, next calibration dates
  - Traceability information

□ PROCEDURES → calibrationSOPs[]
  - SOP numbers, procedure descriptions, versions
  - Referenced norms and standards

□ CONFORMITY STATEMENTS → statements[]
  - Overall conformity declaration
  - Certificate header/title text
  - Any statement about pass/fail or compliance

□ REMARKS → remarks
  - General remarks, notes, footer text, disclaimers
  - Any text content that doesn't fit other categories

=== OUTPUT FORMAT ===

{
  "name": "Profile name",
  "schemaNamespace": "target namespace from XSD (from targetNamespace attribute)",
  "rootElement": "root element local name",
  "description": "Brief description of what this schema covers",
  "mappings": [ ...mapping rules as described above... ]
}

Remember: Output ONLY the JSON. No other text.`;
}

// ============================================================
// User Prompt
// ============================================================

function buildTrainingUserPrompt(xsdContent, xmlContent, profileName) {
    let prompt = `Create an EXHAUSTIVE mapping profile named "${profileName}" for the following schema and sample XML.\n\n`;
    prompt += `IMPORTANT: Map EVERY element and attribute you can find. The source data is from an industrial calibration system with potentially hundreds of data fields. Do not skip any data — if it exists in the schema or XML, it must appear in the mapping profile.\n\n`;

    prompt += '--- XSD Schema ---\n';
    prompt += xsdContent;
    prompt += '\n\n--- Sample XML ---\n';
    prompt += xmlContent;

    prompt += '\n\nNow generate the complete mapping profile JSON. Remember:\n';
    prompt += '1. Map EVERY element and attribute — do not skip fields\n';
    prompt += '2. Use nested arrays for repeating structures\n';
    prompt += '3. Map ALL units (look for @unit attributes on every numeric element)\n';
    prompt += '4. Use "concat" for names that are split into FirstName/LastName\n';
    prompt += '5. Use predicates like [@role=\'SoldTo\'] to target specific business partners\n';
    prompt += '6. Map influence conditions (temperature, humidity, pressure) with all their sub-values\n';
    prompt += '7. Map BOTH As Found and As Left calibrations if present\n';
    prompt += '8. Include coverage factors, coverage probabilities, and MPE values\n';
    prompt += '9. Output ONLY JSON — no explanations, no markdown code blocks\n';

    return prompt;
}

// ============================================================
// Response parsing
// ============================================================

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
        // Try to extract JSON from mixed content
        const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            try {
                profile = JSON.parse(jsonMatch[0]);
            } catch (e2) {
                throw new Error('Failed to parse training response as JSON: ' + e.message);
            }
        } else {
            throw new Error('Failed to parse training response as JSON: ' + e.message);
        }
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

    // Count total mapping rules (including nested fields)
    profile._totalRules = countRules(profile.mappings);

    return profile;
}

function countRules(mappings) {
    let count = 0;
    for (const m of mappings) {
        count++;
        if (m.fields) {
            count += countRules(m.fields);
        }
    }
    return count;
}
