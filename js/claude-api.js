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
            max_tokens: 16384,
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
Deine Aufgabe ist es, aus dem Text eines PDF-Kalibrierzertifikats ALLE relevanten Daten vollständig zu extrahieren und als strukturiertes JSON zurückzugeben.

WICHTIG: Extrahiere wirklich ALLE Informationen aus dem Zertifikat. Kalibrierzertifikate enthalten viele verschiedene Datenfelder - Auftragsnummern, Equipment-Nummern, Prüfmittelnummern, Tag-Nummern, Kalibrierzeichen, Verfahrensbeschreibungen, Entscheidungsregeln, Zubehör, SOPs, Medien-Bedingungen, As-Found/As-Left-Werte, Abweichungen, zulässige Abweichungen, MPE, Konformitätsbewertungen pro Messpunkt, etc.

Das JSON muss folgende Struktur haben (fehlende Werte als null):

{
  "coreData": {
    "countryCodeISO3166_1": "DE oder US etc. (ISO 3166-1)",
    "languageCode": "de oder en etc. (ISO 639-1, Hauptsprache des Zertifikats)",
    "uniqueIdentifier": "Zertifikatsnummer / Certificate number",
    "calibrationMark": "Kalibrierzeichen (z.B. D-K-15070-01-00 2023-04)",
    "beginPerformanceDate": "YYYY-MM-DD",
    "endPerformanceDate": "YYYY-MM-DD",
    "performanceLocation": "laboratory oder customer",
    "orderNumber": "Auftragsnummer / Order No. / Service order number",
    "previousReport": "Vorheriger Kalibrierschein / Bezug auf früheren Bericht"
  },
  "calibrationLaboratory": {
    "name": "Name des Kalibrierlaboratoriums",
    "calibrationLaboratoryCode": "DAkkS-Code / Akkreditierungsnummer (z.B. D-K-15070-01-00)",
    "street": "Straße und Hausnummer",
    "postCode": "PLZ",
    "city": "Stadt",
    "country": "Ländercode (z.B. DE, US)",
    "eMail": "E-Mail-Adresse",
    "phone": "Telefonnummer",
    "fax": "Faxnummer",
    "website": "Website-URL"
  },
  "customer": {
    "name": "Name des Kunden/Auftraggebers (inkl. Zusatzzeilen)",
    "street": "Straße und Hausnummer",
    "postCode": "PLZ",
    "city": "Stadt",
    "country": "Ländercode",
    "eMail": "E-Mail",
    "phone": "Telefon",
    "contactPerson": "Ansprechpartner / Contact person"
  },
  "calibrationLocation": {
    "name": "Firmenname am Kalibrierort (falls abweichend vom Labor und Kunden)",
    "street": "Straße",
    "postCode": "PLZ",
    "city": "Stadt",
    "country": "Ländercode"
  },
  "respPersons": [
    {
      "name": "Vollständiger Name",
      "role": "Rolle (z.B. Leiter des Kalibrierlaboratoriums, Freigabe, Service Technician, Manager, Customer)",
      "isMainSigner": true
    }
  ],
  "items": [
    {
      "name": "Bezeichnung des Prüflings / Calibration object / Unit Under Test (UUT)",
      "manufacturer": "Hersteller / Manufacturer",
      "model": "Typ/Modell / Type / Model",
      "serialNumber": "Seriennummer / Fabrikat-Nr. / Serial number",
      "inventoryNumber": "Inventarnummer / Equipment-ID / Inventory number",
      "equipmentNumber": "Equipment-Nr. / Equipment number",
      "testEquipmentNumber": "Prüfmittel-Nr. / Test equipment number",
      "tagNumber": "Tag-Nr. / Tag number",
      "description": "Weitere Beschreibung des Prüflings",
      "parameter": "Messparameter (z.B. Temperatur, Volume, Druck, Flow)",
      "measuringRange": "Messbereich (z.B. '0...200 l' oder '-50...300 °C')",
      "signalOutput": "Signalausgang (z.B. '4...20 mA')",
      "calibrationRange": "Kalibrierbereich (z.B. '0...200 l')",
      "medium": "Medium (z.B. OIL, Wasser, Luft, N2)",
      "mediumConditions": [
        {
          "name": "z.B. Temperature, API gravity, Conductivity, Pressure",
          "value": "Wert (als String, z.B. '27 C', '45.32 APIg', '867 mS/cm')"
        }
      ],
      "calibrationFactorsAsFound": [{"index": 1, "value": "Wert"}],
      "calibrationFactorsAsLeft": [{"index": 1, "value": "Wert"}],
      "mpe": "Maximum Permissible Error (MPE) - allgemeine Angabe falls vorhanden"
    }
  ],
  "accessories": [
    {
      "type": "Typ-Kürzel (z.B. TTX)",
      "description": "Beschreibung (z.B. Temperature TX Type A)",
      "serialNumber": "Seriennummer"
    }
  ],
  "measurementResults": [
    {
      "name": "Name der Messreihe (z.B. 'Kanal 1', 'Calibration values as found', 'Calibration values as left')",
      "description": "Beschreibung der Messreihe",
      "category": "asFound oder asLeft oder corrected oder null",
      "calibrationProcedure": "Ausführliche Beschreibung des Kalibrierverfahrens (DE und/oder EN Text)",
      "method": "Hauptmethode/Norm (z.B. ISO-Norm, Verfahrensbeschreibung-Nr.)",
      "usedMethods": [
        {
          "name": "Name/Nummer (z.B. SOP-Nr. 'QP01005H/88/EN', Verfahrensbeschreibung '3-APD-0-0016-DE')",
          "description": "Beschreibung des Verfahrens"
        }
      ],
      "referenceStandard": "Referenzmaterial/Standard (z.B. 'Aluminium', 'Stahl', Prüfkörper-Beschreibung)",
      "decisionRule": "Entscheidungsregel (z.B. 'Vertrauensniveau 95 mit Konformitätswahrscheinlichkeit > 95%')",
      "influenceConditions": [
        {
          "name": "z.B. Umgebungstemperatur / Ambient temperature",
          "value": 23.0,
          "unit": "\\\\degC",
          "min": null,
          "max": null,
          "uncertainty": null
        }
      ],
      "results": [
        {
          "name": "Messpunkt-Bezeichnung (z.B. 'Punkt 1', 'Test point 1')",
          "setPoint": null,
          "setPointUnit": null,
          "nominalValue": 100.0,
          "nominalUnit": "\\\\degC",
          "referenceValue": null,
          "referenceUnit": null,
          "measuredValue": 100.02,
          "measuredUnit": "\\\\degC",
          "deviation": -0.05,
          "deviationUnit": "\\\\degC",
          "allowedDeviation": 3.428,
          "allowedDeviationUnit": "\\\\degC",
          "uncertainty": 0.8,
          "uncertaintyUnit": "\\\\degC",
          "coverageFactor": 2.0,
          "coverageProbability": 0.95,
          "mpe": null,
          "mpeUnit": null,
          "conformity": "pass oder fail oder null"
        }
      ]
    }
  ],
  "measuringEquipments": [
    {
      "name": "Bezeichnung des Normals/Referenzgeräts (z.B. 'DAkkS-Oberflächentemperatureinrichtung Kanal 13 Alu 3')",
      "manufacturer": "Hersteller",
      "model": "Typ/Modell",
      "serialNumber": "Seriennummer",
      "equipmentNumber": "Equipment-Nr. / Eq.-No.",
      "certificateNumber": "Zertifikat-Nr. des Normals",
      "calibrationMark": "Kalibrierzeichen des Normals (z.B. D-K-15070-01-01 2021-05)",
      "calibrationDate": "Kalibrierdatum des Normals (YYYY-MM-DD)",
      "nextCalibrationDate": "Nächstes Kalibrierdatum / Due date (YYYY-MM-DD)",
      "traceability": "Rückführbarkeit (z.B. DAkkS, NIST, UKAS)"
    }
  ],
  "calibrationSOPs": [
    {
      "sopNumber": "SOP-Nummer (z.B. QP01005H/88/EN)",
      "description": "Beschreibung des SOP"
    }
  ],
  "statements": [
    {
      "name": "z.B. Konformitätsaussage / Conformity statement / UUT Conformity",
      "description": "Vollständiger Inhalt der Aussage (DE und/oder EN)",
      "conformity": "pass oder fail oder null",
      "decisionRule": "Entscheidungsregel (z.B. 'Vertrauensniveau 95', 'ISO 14253-1')",
      "conformityProbability": "z.B. '>95%'",
      "norm": "Bezugsnorm (z.B. 'EA-4/02 M: 2022', 'ISO/IEC 17025:2017', 'ISO 14253-1')"
    }
  ],
  "remarks": "Bemerkungen / Remarks (vollständiger Text oder null)"
}

Wichtige Regeln:
- Extrahiere ALLE Messwerte die im Zertifikat enthalten sind, inklusive Unsicherheiten, Abweichungen und zulässige Abweichungen.
- Wenn es separate "As Found" und "As Left" Tabellen gibt, erstelle dafür SEPARATE measurementResults-Einträge mit category "asFound" bzw. "asLeft".
- Wenn es Oberflächenzuschlag-korrigierte Werte gibt, erstelle einen zusätzlichen measurementResults-Eintrag mit category "corrected".
- Extrahiere ALLE Messeinrichtungen/Referenznormale mit allen verfügbaren Details (Equipment-Nr., Zertifikat-Nr., Kalibrierdatum, nächstes Kalibrierdatum, Rückführung).
- Extrahiere ALLE verantwortlichen Personen mit ihren Rollen (Leiter, Freigabe, Techniker, Manager etc.).
- Extrahiere ALLE Zubehörteile/Komponenten (Accessories/Components) falls vorhanden.
- Extrahiere ALLE SOPs/Kalibrierverfahren falls aufgelistet.
- Verwende SI-Einheiten wo möglich. Für Temperaturen verwende \\\\degC.
- Datumsformat: YYYY-MM-DD. Konvertiere Datumsangaben wie "25.04.2023" zu "2023-04-25".
- Wenn nur ein einzelnes Kalibrierdatum angegeben ist, setze beginPerformanceDate und endPerformanceDate auf denselben Wert.
- Extrahiere auch Umgebungsbedingungen (Temperatur, Luftfeuchte, Druck etc.) als influenceConditions. Wenn Bereiche angegeben sind (z.B. "(20...26) °C"), verwende min und max statt value.
- Extrahiere den vollständigen Kalibrierverfahren-Text (DE und EN) in calibrationProcedure.
- Extrahiere die Konformitätsaussage vollständig inkl. Entscheidungsregel und Bezugsnorm.
- Wenn Informationen nicht vorhanden sind, setze den Wert auf null.
- Wenn calibrationLocation nicht explizit angegeben ist oder identisch mit dem Labor, setze calibrationLocation auf null.
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
