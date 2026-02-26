# DCC Converter — Automated Transformation of Proprietary Calibration XML into Digital Calibration Certificates

## Background

The **Digital Calibration Certificate (DCC)** is an XML-based, machine-readable and machine-interpretable format for the standardised exchange of calibration results, fulfilling ISO/IEC 17025 requirements while enabling Industry 4.0 integration. The standard is maintained by PTB, DKD, BAM, and a broad international community of metrology institutes, accredited labs, and industrial partners.

The DCC schema (current v3.3.0, v3.4.0-rc.1 in testing) is quantity-agnostic and accompanied by the Digital System of Units (D-SI) for SI-traceable quantity representation and a refType thesaurus for semantic annotations. Measurement-specific guidance is provided through DKD expert reports for various measurands.

## Problem

While the DCC defines a unified target structure, calibration laboratories and instrument manufacturers in practice operate with a wide variety of **proprietary XML data formats** — each defined by individual XSD schemas with domain-specific element hierarchies, naming conventions, and attribute semantics. These vendor-specific formats already exist in many organisations as structured, machine-readable XML data, yet they cannot be directly consumed as DCCs.

Converting these heterogeneous source formats into schema-conformant DCCs currently requires either manual transcription or custom-built, format-specific transformation scripts. Both approaches are labour-intensive, error-prone, and difficult to maintain as source schemas evolve. The structural gap between proprietary calibration data models and the DCC schema — which encompasses administrative metadata, item identifications, measurement results with SI-traceable quantities and expanded uncertainties, influence conditions, conformity statements, responsible persons, and refType annotations — makes fully manual mapping impractical, particularly for complex industrial calibration certificates containing hundreds of data fields across deeply nested XML structures.

## Approach

This module addresses the problem through a two-phase workflow built around a reusable, JSON-based **mapping profile** that serves as an intermediate transformation layer between any source XML schema and a DCC-JSON intermediate format:

**Phase 1 — Profile Generation (one-time, AI-assisted):** Given an XSD schema definition and a representative sample XML document, the system employs a LLM to perform comprehensive schema analysis and automatically generate an exhaustive mapping profile. The profile encodes XPath-based extraction rules that map source elements and attributes to their corresponding DCC-JSON target fields — including scalar values, nested arrays of arbitrary depth, unit attributes, conformity flags, date conversions, value lookups, field concatenations, and template-based transformations. A visual mapping editor allows domain experts to review, refine, and extend the generated profile interactively through drag-and-drop, without programming knowledge.

**Phase 2 — Conversion (repeatable, offline):** Once a mapping profile exists for a given source format, any XML document conforming to that schema can be transformed into a valid DCC XML document entirely client-side, without API calls or server infrastructure. The namespace-agnostic XPath engine resolves source paths regardless of XML namespace prefixes, and the DCC XML generator produces output conforming to the DCC v3.3.0 schema, including proper SI namespace handling for measurement quantities and expanded uncertainties.

The mapping profile is portable (JSON), can be stored locally or shared across teams, and decouples the one-time schema analysis effort from the recurring conversion task — enabling scalable, reproducible DCC generation for any organisation that maintains calibration data in structured XML formats.

## Features

### Conversion Modes

| Mode | Input | Uses API? | Description |
|------|-------|-----------|-------------|
| **XML Convert** | XML file | No | Instant local conversion using a saved mapping profile — no API calls needed |
| **Train Mapping** | XSD schema + sample XML | Yes (once) | One-time AI training that generates a reusable mapping profile for a specific XML format |
| **PDF Upload** | PDF calibration certificate | Yes (Claude) | AI-powered extraction of structured data from any PDF calibration certificate |

### How It Works

```
Train Mapping:   XSD + XML  ──Claude AI──▶  Mapping Profile (JSON, saved locally)
XML Convert:     XML  ──Mapping Profile──▶  DCC-JSON  ──▶  DCC XML v3.3.0  (no API!)
PDF Upload:      PDF  ──Claude AI──▶        DCC-JSON  ──▶  DCC XML v3.3.0
```

**Train Mapping** is a one-time setup step. You provide an XSD schema and a sample XML file, and the LLM performs an exhaustive schema analysis to generate a mapping profile — a set of XPath-based rules that map your proprietary XML structure to the DCC-JSON intermediate format. The profile is saved in localStorage and can be exported/imported as JSON. A visual editor with drag-and-drop allows you to review, refine, and extend the generated mappings.

**XML Convert** applies a previously trained mapping profile to transform structured XML data into DCC format. This runs entirely in the browser with zero API calls, making it fast, free, and private. Profiles are auto-detected based on XML namespace and root element.

**PDF Upload** uses the Anthropic-Claude API to intelligently extract calibration data from unstructured PDF text — certificate numbers, measurement results, equipment details, conformity statements, and more.

### Data Coverage

The converter handles the full scope of DCC data as defined by the schema:

- **Core data** — Certificate number, calibration mark, order number, calibration dates, performance location, language and country codes, previous report reference
- **Calibration laboratory** — Name, accreditation code, full address, contact details (phone, fax, e-mail, website)
- **Customer** — Name, full address, contact person
- **Responsible persons** — Names, roles, main signer identification
- **Calibration items** — Manufacturer, model, serial number, inventory/equipment/test equipment/tag numbers, measuring range, signal output, calibration range, medium, description
- **Accessories** — Type, description, serial number, manufacturer, model
- **Measuring equipment** — Reference standards with traceability, certificate numbers, calibration dates, next calibration dates
- **Measurement results** — As Found / As Left / Corrected categories with set points, nominal/reference/measured values, deviations, allowed deviations, uncertainties (with coverage factors and coverage probabilities), MPE, per-point conformity — all with SI units
- **Influence conditions** — Temperature, humidity, barometric pressure (with min/max ranges and uncertainties)
- **Calibration procedures** — SOPs with numbers, descriptions, versions, referenced norms
- **Conformity statements** — Pass/fail assessments with decision rules, referenced norms, conformity probabilities
- **Remarks** — Free-text comments and notes

## Technical Implementation

### Architecture

The application is implemented as a pure client-side single-page application with zero backend dependencies. All processing — XML parsing, XPath evaluation, mapping execution, and DCC XML generation — runs entirely in the browser.

```
Source XML ──► Mapping Engine ──► DCC-JSON ──► DCC XML Generator ──► DCC v3.3.0 XML
                    ▲                              │
              Mapping Profile                 SI Namespace (D-SI)
              (JSON, XPath rules)             DCC Namespace
```

### Modules

| Module | Responsibility |
|--------|---------------|
| `mapping-engine.js` | Namespace-agnostic XPath engine that evaluates mapping profiles against source XML. Supports recursive array nesting to arbitrary depth, 12 mapping types (`string`, `number`, `integer`, `boolean`, `date`, `array`, `conformity`, `asFoundAsLeft`, `concat`, `static`, `template`, `lookup`, `firstOf`), and attribute/predicate-based element selection. Includes XML tree parser and path flattener for the visual editor. |
| `mapping-trainer.js` | One-time AI-assisted profile generation. Sends XSD schema + sample XML to the Claude API with a comprehensive system prompt that documents the full DCC-JSON target schema, all mapping types with examples, and a systematic extraction checklist covering all 11 DCC data categories. Configured for up to 64,000 output tokens to handle complex schemas with hundreds of fields. |
| `mapping-editor.js` | Interactive visual profile editor. Renders the mapping table with inline editing, coverage statistics against the full DCC target schema, an unmapped-fields section with clickable chips grouped by category, and a source XML tree explorer with HTML5 drag-and-drop for creating new mapping rules. Supports editing of nested array fields, type selection, and advanced mapping parameters (separators, templates, lookup maps). |
| `mapping-store.js` | Profile persistence via `localStorage` with import/export as JSON files and auto-detection of matching profiles based on XML namespace and root element. |
| `dcc-xml-generator.js` | Generates DCC v3.3.0 XML from the DCC-JSON intermediate format. Handles `dcc:` and `si:` namespace prefixes, `xsi:schemaLocation`, SI real quantities with expanded uncertainties (coverage factor, coverage probability), influence conditions with min/max ranges, per-point conformity, DCC list structures for tabular measurement results, and identification blocks with issuer semantics. |
| `pdf-extractor.js` | PDF text extraction using PDF.js v4.9.155 for the PDF Upload mode. |
| `claude-api.js` | Claude API integration for PDF-based data extraction. |
| `app.js` | Main application controller managing all three modes, shared API key handling, tab/step management, and editor integration. |

### Mapping Profile Format

The mapping profile is a portable JSON document containing an ordered array of extraction rules. Each rule specifies an XPath-like source path, a DCC-JSON target path, and a type that controls value extraction and conversion:

```json
{
  "name": "Vendor Calibration Profile",
  "schemaNamespace": "urn:com:vendor:calibration",
  "rootElement": "CalibrationData",
  "mappings": [
    {
      "target": "coreData.uniqueIdentifier",
      "source": "CertificateData/@certificateNumber",
      "type": "string"
    },
    {
      "target": "measurementResults[]",
      "source": "CalibrationSettings/CalibrationSetting",
      "type": "array",
      "fields": [
        { "target": "name", "source": "ParameterName", "type": "string" },
        { "target": "category", "source": "Calibrations/Calibration", "type": "asFoundAsLeft" },
        {
          "target": "results[]",
          "source": "Calibrations/Calibration/TestPoints/TestPoint",
          "type": "array",
          "fields": [
            { "target": "setPoint", "source": "SetPoint", "type": "number" },
            { "target": "setPointUnit", "source": "SetPoint/@unit", "type": "string" },
            { "target": "measuredValue", "source": "UUTValue", "type": "number" },
            { "target": "measuredUnit", "source": "UUTValue/@unit", "type": "string" },
            { "target": "deviation", "source": "Deviations", "type": "number" },
            { "target": "deviationUnit", "source": "Deviations/@unit", "type": "string" },
            { "target": "uncertainty", "source": "Uncertainty", "type": "number" },
            { "target": "uncertaintyUnit", "source": "Uncertainty/@unit", "type": "string" },
            { "target": "conformity", "source": "@isConform", "type": "conformity" }
          ]
        }
      ]
    }
  ]
}
```

### Supported Mapping Types

| Type | Description | Example |
|------|-------------|---------|
| `string` | Text content from element or attribute | `"source": "HeaderData/CertificateNumber"` |
| `number` | Parsed as float | `"source": "SetPoint"` |
| `integer` | Parsed as integer | `"source": "PointIndex"` |
| `boolean` | `"true"`/`"1"` → true | `"source": "IsValid"` |
| `date` | DateTime → `YYYY-MM-DD` | `"source": "CalibrationDateTime"` |
| `array` | Repeating elements with nested `fields` (recursive) | See example above |
| `conformity` | `@isConform` → `"pass"`/`"fail"` | `"source": "@isConform"` |
| `asFoundAsLeft` | `@isAsFound`/`@isAsLeft` → category string | `"source": "Calibration"` |
| `concat` | Combine multiple fields | `"sources": ["FirstName", "LastName"], "separator": " "` |
| `static` | Fixed value, no source needed | `"value": "laboratory"` |
| `template` | String template with indexed references | `"template": "{0} {1}", "sources": ["PostCode", "City"]` |
| `lookup` | Map source values via lookup table | `"source": "Status", "map": {"OK": "pass", "NOK": "fail"}` |
| `firstOf` | First non-null from multiple paths | `"sources": ["CompanyName", "OrganizationName"]` |

### XPath Resolution

All paths are resolved using a namespace-agnostic strategy: element names are matched via `local-name()` XPath functions, making the engine independent of whatever namespace prefixes the source XML uses. The first path step uses `descendant-or-self::` for root-relative resolution; subsequent steps resolve as direct children. Attribute predicates (e.g. `[@role='SoldTo']`) are supported for element selection within repeating structures.

### DCC Schema Conformance

The generated XML conforms to the DCC v3.3.0 schema (`https://ptb.de/dcc/v3.3.0/dcc.xsd`) and includes:

- `dcc:digitalCalibrationCertificate` root element with correct `schemaVersion`, namespace declarations, and `xsi:schemaLocation`
- `dcc:administrativeData` with core data, calibration items (with identification blocks using issuer semantics), calibration laboratory, responsible persons, customer, and statements
- `dcc:measurementResults` with measuring equipments, influence conditions, and measurement results using `dcc:list` / `dcc:quantity` / `si:real` / `si:expandedUnc` structures
- Bilingual content support (`dcc:content` with `lang` attribute)

## Getting Started

### Prerequisites

- A modern web browser (Chrome, Firefox, Edge, Safari)
- An [Anthropic API key](https://console.anthropic.com/) (only needed for Train Mapping and PDF Upload modes; XML Convert runs fully offline)

### Running Locally

Simply serve the files via a local HTTP server — no build step required.

```bash
# Clone the repository
git clone <repo-url>
cd MZW-DCC

# Serve via Python (required for ES module imports)
python3 -m http.server 8080
# then visit http://localhost:8080
```

> **Note:** Due to ES module imports, the files must be served via HTTP. Opening `index.html` directly as a `file://` URL will not work.

### Usage

#### Train Mapping (one-time setup per XML format)
1. Enter your Anthropic API key
2. Name your profile and upload the XSD schema + a sample XML file
3. Click "Train Mapping with Claude"
4. Review and refine the generated profile in the visual editor (drag-and-drop source paths, edit rules inline, add missing mappings)
5. Save the profile to localStorage or export as JSON for sharing

#### XML Convert (repeatable, offline)
1. Select a saved mapping profile (or import one from JSON) — profiles are auto-detected when you upload an XML file
2. Upload your XML calibration data file
3. Click "Convert XML to DCC" — the conversion runs locally, no API needed
4. Review the JSON data and DCC XML previews
5. Download the DCC XML

#### PDF Upload
1. Enter your Anthropic API key
2. Upload a PDF calibration certificate
3. Click "Analyze PDF & Extract Data"
4. Review and edit the extracted data in the preview tabs
5. Generate and download the DCC XML

## Project Structure

```
MZW-DCC/
├── index.html               # Main application (English UI, 3 modes)
├── css/
│   └── style.css            # Complete styling incl. mapping editor
├── js/
│   ├── app.js               # Main controller (3 modes, editor integration)
│   ├── mapping-engine.js    # XPath-based XML→DCC-JSON converter (12 types, recursive)
│   ├── mapping-trainer.js   # Claude API for exhaustive mapping training
│   ├── mapping-editor.js    # Interactive visual profile editor (drag & drop)
│   ├── mapping-store.js     # localStorage profile management
│   ├── dcc-xml-generator.js # DCC XML v3.3.0 generation (dcc: + si: namespaces)
│   ├── pdf-extractor.js     # PDF.js text extraction
│   └── claude-api.js        # Claude API for PDF extraction
└── README.md
```

## Technology

- **Pure client-side** — No backend server required; all processing in the browser
- **PDF.js** (v4.9.155) — PDF text extraction in the browser
- **Claude API** (claude-sonnet-4-20250514) — AI-powered schema analysis and data extraction
- **DCC v3.3.0** — Digital Calibration Certificate schema standard
- **D-SI** — Digital System of Units for SI-traceable quantity representation
- **Namespace-agnostic XPath** — Mapping engine works with any XML namespace

## Privacy

- Your API key is only used locally in your browser session and is never stored
- PDF files are processed client-side; only the extracted text is sent to the Claude API
- Mapping profiles are stored in your browser's localStorage
- XML Convert mode runs entirely offline — no data leaves your browser

## References

- [PTB DCC Homepage](https://ptb.de/dcc/)
- [DCC Schema v3.3.0 (XSD)](https://ptb.de/dcc/v3.3.0/dcc.xsd)
- [DCC Schema Repository (GitLab)](https://gitlab.com/ptb/dcc/xsd-dcc)
- [DCC Schema v3.4.0-rc.1 (XSD)](https://ptb.de/dcc/v3.4.0-rc.1/dcc.xsd)
- [DCC Wiki](https://dccwiki.ptb.de/)
- [refType Thesaurus](https://digilab.ptb.de/dkd/refType/vocab/)
- [D-SI Repository (PTB GitLab)](https://gitlab1.ptb.de/siunit/d-si)
- [GEMIMEG-Tool 2](https://gemimeg-tool.ptb.de)


## Contact & Support

**Zwernemann Medienentwicklung**
79730 Murg, Germany

[To the website](https://www.zwernemann.de/)

If you have questions, problems, or ideas for new features – feel free to get in touch.


## License

See repository for license details.
