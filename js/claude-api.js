/**
 * Claude API integration for extracting structured calibration data from PDF text.
 * Sends extracted text to Claude with a DCC-schema-aware prompt.
 */

const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-20250514';

/**
 * Extract structured calibration data from PDF text using Claude API.
 * @param {string} apiKey - Anthropic API key
 * @param {string} pdfText - Extracted text from the PDF
 * @param {object} pdfMetadata - PDF metadata (title, author, etc.)
 * @returns {Promise<object>} Structured calibration data
 */
export async function extractCalibrationData(apiKey, pdfText, pdfMetadata = {}) {
    const systemPrompt = buildSystemPrompt();
    const userPrompt = buildUserPrompt(pdfText, pdfMetadata);

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
            max_tokens: 8192,
            system: systemPrompt,
            messages: [{ role: 'user', content: userPrompt }],
        }),
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(
            `API-Fehler (${response.status}): ${error.error?.message || response.statusText}`
        );
    }

    const result = await response.json();
    const content = result.content?.[0]?.text;

    if (!content) {
        throw new Error('Keine Antwort von der Claude API erhalten.');
    }

    return parseResponse(content);
}

function buildSystemPrompt() {
    return `Du bist ein Experte für Kalibrierzertifikate und den DCC-Standard (Digital Calibration Certificate) der PTB.
Deine Aufgabe ist es, aus dem Text eines PDF-Kalibrierzertifikats alle relevanten Daten zu extrahieren und als strukturiertes JSON zurückzugeben.

Das JSON muss folgende Struktur haben (fehlende Werte als null):

{
  "coreData": {
    "countryCodeISO3166_1": "DE",
    "languageCode": "de",
    "uniqueIdentifier": "Zertifikats-/Berichtsnummer",
    "beginPerformanceDate": "YYYY-MM-DD",
    "endPerformanceDate": "YYYY-MM-DD",
    "performanceLocation": "laboratory|customer"
  },
  "calibrationLaboratory": {
    "name": "Name des Labors",
    "calibrationLaboratoryCode": "DAkkS-Code o.ä.",
    "street": "Straße und Hausnummer",
    "postCode": "PLZ",
    "city": "Stadt",
    "country": "DE",
    "eMail": "E-Mail falls vorhanden",
    "phone": "Telefon falls vorhanden"
  },
  "customer": {
    "name": "Name des Kunden/Auftraggebers",
    "street": "Straße und Hausnummer",
    "postCode": "PLZ",
    "city": "Stadt",
    "country": "DE"
  },
  "respPersons": [
    {
      "name": "Name",
      "role": "Rolle (z.B. Prüfer, Leiter)"
    }
  ],
  "items": [
    {
      "name": "Bezeichnung des Prüflings",
      "manufacturer": "Hersteller",
      "model": "Typ/Modell",
      "serialNumber": "Seriennummer",
      "inventoryNumber": "Inventarnummer/Equipment-ID",
      "description": "Weitere Beschreibung"
    }
  ],
  "measurementResults": [
    {
      "name": "Name der Messreihe/des Messverfahrens",
      "description": "Beschreibung",
      "method": "Verwendete Methode/Norm",
      "influenceConditions": [
        {
          "name": "z.B. Umgebungstemperatur",
          "value": 23.0,
          "unit": "\\\\degC",
          "uncertainty": null
        }
      ],
      "results": [
        {
          "name": "Messpunkt-Bezeichnung",
          "nominalValue": 100.0,
          "nominalUnit": "\\\\degC",
          "measuredValue": 100.02,
          "measuredUnit": "\\\\degC",
          "uncertainty": 0.05,
          "uncertaintyUnit": "\\\\degC",
          "coverageFactor": 2.0,
          "coverageProbability": 0.95
        }
      ]
    }
  ],
  "measuringEquipments": [
    {
      "name": "Bezeichnung des Normals/Referenzgeräts",
      "manufacturer": "Hersteller",
      "model": "Typ/Modell",
      "serialNumber": "Seriennummer",
      "certificateNumber": "Zertifikat-Nr. des Normals",
      "traceability": "Rückführbarkeit"
    }
  ],
  "statements": [
    {
      "name": "z.B. Konformitätsaussage",
      "description": "Inhalt der Aussage",
      "conformity": "pass|fail|null"
    }
  ]
}

Regeln:
- Extrahiere ALLE Messwerte die im Zertifikat enthalten sind, inklusive Unsicherheiten.
- Verwende SI-Einheiten wo möglich.
- Datumsformat: YYYY-MM-DD
- Wenn nur ein einzelnes Kalibrierdatum angegeben ist, setze beginPerformanceDate und endPerformanceDate auf denselben Wert.
- Extrahiere auch Umgebungsbedingungen (Temperatur, Luftfeuchte etc.) als influenceConditions.
- Wenn Informationen nicht vorhanden sind, setze den Wert auf null.
- Antworte NUR mit dem JSON-Objekt, kein weiterer Text.`;
}

function buildUserPrompt(pdfText, pdfMetadata) {
    let prompt = 'Extrahiere die Kalibrierdaten aus folgendem PDF-Kalibrierzertifikat:\n\n';

    if (pdfMetadata.title || pdfMetadata.author) {
        prompt += '--- PDF Metadaten ---\n';
        if (pdfMetadata.title) prompt += `Titel: ${pdfMetadata.title}\n`;
        if (pdfMetadata.author) prompt += `Autor: ${pdfMetadata.author}\n`;
        if (pdfMetadata.subject) prompt += `Betreff: ${pdfMetadata.subject}\n`;
        prompt += '\n';
    }

    prompt += '--- Zertifikatstext ---\n';
    prompt += pdfText;

    return prompt;
}

/**
 * Parse Claude's JSON response, handling potential markdown code blocks.
 */
function parseResponse(content) {
    let jsonStr = content.trim();

    // Remove markdown code block wrapper if present
    const codeBlockMatch = jsonStr.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
    if (codeBlockMatch) {
        jsonStr = codeBlockMatch[1].trim();
    }

    try {
        return JSON.parse(jsonStr);
    } catch (e) {
        throw new Error(`Konnte die API-Antwort nicht als JSON parsen: ${e.message}`);
    }
}

/**
 * Validate that an API key looks correct.
 */
export function validateApiKey(key) {
    return typeof key === 'string' && key.startsWith('sk-ant-');
}
