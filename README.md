# DCC Converter

Convert calibration certificates into **Digital Calibration Certificates (DCC v3.3.0)** conforming to the [PTB DCC standard](https://ptb.de/dcc/).

## Features

### Three Conversion Modes

| Mode | Input | Uses API? | Description |
|------|-------|-----------|-------------|
| **PDF Upload** | PDF calibration certificate | Yes (Claude) | AI-powered extraction of structured data from any PDF calibration certificate |
| **XML Convert** | XML file | No | Instant local conversion using a saved mapping profile — no API calls needed |
| **Train Mapping** | XSD schema + sample XML | Yes (once) | One-time AI training that generates a reusable mapping profile for a specific XML format |

### How It Works

```
PDF Upload:      PDF  ──Claude AI──▶  DCC-JSON  ──▶  DCC XML
XML Convert:     XML  ──Mapping──▶    DCC-JSON  ──▶  DCC XML  (no API!)
Train Mapping:   XSD + XML  ──Claude AI──▶  Mapping Profile (saved locally)
```

**PDF Upload** uses the Claude API to intelligently extract calibration data from unstructured PDF text — certificate numbers, measurement results, equipment details, conformity statements, and more.

**XML Convert** applies a previously trained mapping profile to transform structured XML data into DCC format. This runs entirely in the browser with zero API calls, making it fast, free, and private.

**Train Mapping** is a one-time setup step. You provide an XSD schema and a sample XML file, and Claude generates a mapping profile (XPath-based rules) that maps your XML structure to the DCC-JSON intermediate format. The profile is saved in localStorage and can be exported/imported as JSON.

## Data Extracted

The converter handles comprehensive calibration certificate data:

- **Core data** — Certificate number, calibration mark, order number, dates, location
- **Laboratory** — Name, accreditation code, full address, contact details
- **Customer** — Name, address, contact person
- **Calibration items** — Manufacturer, model, serial number, equipment numbers, tag numbers, measuring range, medium
- **Accessories** — Type, description, serial number
- **Measuring equipment** — Reference standards with traceability, certificate numbers, calibration dates
- **Measurement results** — As Found / As Left / Corrected values with set points, deviations, allowed deviations, uncertainties, coverage factors, per-point conformity
- **Influence conditions** — Temperature, humidity, pressure (with min/max ranges)
- **Calibration procedures** — SOPs, methods, norms
- **Conformity statements** — Pass/fail assessments with decision rules and probabilities
- **Remarks** — Free-text comments

## Getting Started

### Prerequisites

- A modern web browser (Chrome, Firefox, Edge, Safari)
- An [Anthropic API key](https://console.anthropic.com/) (only needed for PDF Upload and Train Mapping modes)

### Running Locally

Simply open `index.html` in your browser — no build step or server required.

```bash
# Clone the repository
git clone <repo-url>
cd MZW-DCC

# Open in browser
open index.html
# or
python3 -m http.server 8080  # then visit http://localhost:8080
```

> **Note:** Due to ES module imports, you may need to serve the files via a local HTTP server (e.g., `python3 -m http.server`) rather than opening `index.html` directly as a `file://` URL.

### Usage

#### Mode A: PDF Upload
1. Enter your Anthropic API key
2. Upload a PDF calibration certificate
3. Click "Analyze PDF & Extract Data"
4. Review and edit the extracted data in the preview tabs
5. Generate and download the DCC XML

#### Mode B: XML Convert
1. Select a saved mapping profile (or import one from JSON)
2. Upload your XML calibration data file
3. Click "Convert XML to DCC" — the conversion runs locally, no API needed
4. Review the JSON data and DCC XML previews
5. Download the DCC XML

#### Mode C: Train Mapping
1. Enter your Anthropic API key
2. Name your profile and upload the XSD schema + a sample XML file
3. Click "Train Mapping with Claude"
4. Review the generated mapping profile
5. Save it to localStorage or export as JSON for sharing

## Project Structure

```
MZW-DCC/
├── index.html              # Main application (English UI)
├── css/
│   └── style.css           # Complete styling
├── js/
│   ├── app.js              # Main controller (3 modes)
│   ├── pdf-extractor.js    # PDF.js text extraction
│   ├── claude-api.js       # Claude API for PDF extraction
│   ├── dcc-xml-generator.js # DCC XML v3.3.0 generation
│   ├── mapping-engine.js   # XPath-based XML→DCC-JSON converter
│   ├── mapping-store.js    # localStorage profile management
│   └── mapping-trainer.js  # Claude API for mapping training
└── README.md
```

## Technology

- **Pure client-side** — No backend server required
- **PDF.js** (v4.9.155) — PDF text extraction in the browser
- **Claude API** (claude-sonnet-4-20250514) — AI-powered data extraction and schema analysis
- **DCC v3.3.0** — PTB Digital Calibration Certificate standard
- **Namespace-agnostic XPath** — Mapping engine works with any XML namespace

## Privacy

- Your API key is only used locally in your browser session and is never stored
- PDF files are processed client-side; only the extracted text is sent to the Claude API
- Mapping profiles are stored in your browser's localStorage
- XML Convert mode runs entirely offline — no data leaves your browser

## DCC Standard

This tool generates XML conforming to the [DCC v3.3.0 schema](https://ptb.de/dcc/v3.3.0/dcc.xsd) from the Physikalisch-Technische Bundesanstalt (PTB).

- [PTB DCC Homepage](https://ptb.de/dcc/)
- [DCC Wiki](https://wiki.dcc.ptb.de/)

## License

See repository for license details.
