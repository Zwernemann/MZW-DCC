/**
 * Main application controller for the PDF-to-DCC Converter.
 * Connects PDF extraction, Claude API, and DCC XML generation.
 */

import { extractTextFromPdf } from './pdf-extractor.js';
import { extractCalibrationData, validateApiKey } from './claude-api.js';
import { generateDccXml, validateData } from './dcc-xml-generator.js';

// ============================================================
// State
// ============================================================

let apiKey = '';
let pdfFile = null;
let pdfText = '';
let pdfMetadata = {};
let extractedData = null;
let generatedXml = '';

// ============================================================
// DOM References
// ============================================================

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// Steps
const stepApikey = $('#step-apikey');
const stepUpload = $('#step-upload');
const stepExtract = $('#step-extract');
const stepPreview = $('#step-preview');
const stepDownload = $('#step-download');

// API Key
const apiKeyInput = $('#api-key-input');
const btnSaveKey = $('#btn-save-key');
const apiKeyStatus = $('#api-key-status');

// Upload
const dropZone = $('#drop-zone');
const fileInput = $('#file-input');
const fileInfo = $('#file-info');
const fileName = $('#file-name');
const btnRemoveFile = $('#btn-remove-file');

// Extract
const btnExtract = $('#btn-extract');
const extractionProgress = $('#extraction-progress');
const progressFill = $('#progress-fill');
const progressText = $('#progress-text');

// Preview
const resultsContainer = $('#results-container');
const xmlPreview = $('#xml-preview code');

// Download
const btnGenerateXml = $('#btn-generate-xml');
const btnDownload = $('#btn-download');
const validationMessages = $('#validation-messages');

// ============================================================
// Step Management
// ============================================================

function activateStep(step) {
    step.classList.add('active');
}

function completeStep(step) {
    step.classList.add('completed');
}

// ============================================================
// API Key Handling
// ============================================================

btnSaveKey.addEventListener('click', () => {
    const key = apiKeyInput.value.trim();
    if (!validateApiKey(key)) {
        apiKeyStatus.textContent = 'Ungültiger API-Key. Er muss mit "sk-ant-" beginnen.';
        apiKeyStatus.className = 'status-text error';
        return;
    }
    apiKey = key;
    apiKeyStatus.textContent = 'API-Key gespeichert (nur in dieser Sitzung).';
    apiKeyStatus.className = 'status-text success';
    completeStep(stepApikey);
    activateStep(stepUpload);
});

apiKeyInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') btnSaveKey.click();
});

// ============================================================
// File Upload / Drag & Drop
// ============================================================

function handleFile(file) {
    if (!file || file.type !== 'application/pdf') {
        alert('Bitte eine PDF-Datei auswählen.');
        return;
    }
    pdfFile = file;
    fileName.textContent = file.name;
    fileInfo.classList.remove('hidden');
    dropZone.style.display = 'none';
    btnExtract.disabled = false;
    activateStep(stepExtract);
}

dropZone.addEventListener('click', () => fileInput.click());

dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
});

dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('drag-over');
});

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    handleFile(file);
});

fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    handleFile(file);
});

btnRemoveFile.addEventListener('click', () => {
    pdfFile = null;
    pdfText = '';
    extractedData = null;
    generatedXml = '';
    fileInfo.classList.add('hidden');
    dropZone.style.display = '';
    fileInput.value = '';
    btnExtract.disabled = true;
    btnGenerateXml.disabled = true;
    btnDownload.disabled = true;
    fileName.textContent = '';
});

// ============================================================
// Extraction Pipeline
// ============================================================

btnExtract.addEventListener('click', async () => {
    if (!pdfFile || !apiKey) return;

    btnExtract.disabled = true;
    extractionProgress.classList.remove('hidden');
    setProgress(0, 'PDF wird gelesen...');

    try {
        // Step 1: Extract text from PDF
        const pdfResult = await extractTextFromPdf(pdfFile, (pct) => {
            setProgress(pct * 0.4, 'PDF wird gelesen...');
        });

        pdfText = pdfResult.text;
        pdfMetadata = pdfResult.metadata;
        setProgress(40, `${pdfResult.numPages} Seiten gelesen. Sende an Claude API...`);

        // Step 2: Send to Claude API for structured extraction
        extractedData = await extractCalibrationData(apiKey, pdfText, pdfMetadata);
        setProgress(90, 'Daten extrahiert. Vorschau wird erstellt...');

        // Step 3: Populate preview
        populatePreview(extractedData);
        setProgress(100, 'Fertig! Bitte prüfe die extrahierten Daten.');

        completeStep(stepExtract);
        activateStep(stepPreview);
        activateStep(stepDownload);
        btnGenerateXml.disabled = false;

        // Auto-generate XML preview
        updateXmlPreview();

    } catch (err) {
        setProgress(0, `Fehler: ${err.message}`);
        progressText.classList.add('error');
        btnExtract.disabled = false;
    }
});

function setProgress(pct, text) {
    progressFill.style.width = `${pct}%`;
    if (text) {
        progressText.textContent = text;
        progressText.className = 'progress-text';
    }
}

// ============================================================
// Preview Population
// ============================================================

function populatePreview(data) {
    // Admin fields
    setField('field-cert-id', data.coreData?.uniqueIdentifier);
    setField('field-country', data.coreData?.countryCodeISO3166_1);
    setField('field-begin-date', data.coreData?.beginPerformanceDate);
    setField('field-end-date', data.coreData?.endPerformanceDate);
    setField('field-lab-name', data.calibrationLaboratory?.name);
    setField('field-lab-street', data.calibrationLaboratory?.street);
    setField('field-lab-zip', data.calibrationLaboratory?.postCode);
    setField('field-lab-city', data.calibrationLaboratory?.city);
    setField('field-customer-name', data.customer?.name);
    setField('field-customer-street', data.customer?.street);
    setField('field-customer-zip', data.customer?.postCode);
    setField('field-customer-city', data.customer?.city);
    setField('field-resp-person', data.respPersons?.[0]?.name);

    // Items
    const item = data.items?.[0] || {};
    setField('field-item-name', item.name);
    setField('field-item-manufacturer', item.manufacturer);
    setField('field-item-model', item.model);
    setField('field-item-serial', item.serialNumber);
    setField('field-item-id', item.inventoryNumber);

    // Measurement results
    populateResults(data.measurementResults || []);
}

function setField(id, value) {
    const el = document.getElementById(id);
    if (el && value) el.value = value;
}

function populateResults(measurementResults) {
    resultsContainer.innerHTML = '';

    if (measurementResults.length === 0) {
        resultsContainer.innerHTML = '<p class="placeholder-text">Keine Messergebnisse gefunden.</p>';
        return;
    }

    for (const mr of measurementResults) {
        const section = document.createElement('div');

        const title = document.createElement('h3');
        title.className = 'result-section-title';
        title.textContent = mr.name || 'Messergebnis';
        section.appendChild(title);

        if (mr.description) {
            const desc = document.createElement('p');
            desc.textContent = mr.description;
            desc.style.marginBottom = '0.5rem';
            desc.style.fontSize = '0.85rem';
            desc.style.color = '#64748b';
            section.appendChild(desc);
        }

        // Influence conditions
        const conditions = mr.influenceConditions || [];
        if (conditions.length > 0) {
            const condTitle = document.createElement('p');
            condTitle.style.fontWeight = '600';
            condTitle.style.fontSize = '0.85rem';
            condTitle.style.marginTop = '0.5rem';
            condTitle.textContent = 'Umgebungsbedingungen:';
            section.appendChild(condTitle);

            const condList = document.createElement('ul');
            condList.style.fontSize = '0.85rem';
            condList.style.marginLeft = '1rem';
            condList.style.marginBottom = '0.5rem';
            for (const c of conditions) {
                const li = document.createElement('li');
                li.textContent = `${c.name}: ${c.value ?? '?'} ${c.unit || ''}`;
                condList.appendChild(li);
            }
            section.appendChild(condList);
        }

        // Results table
        const results = mr.results || [];
        if (results.length > 0) {
            const table = document.createElement('table');
            table.className = 'results-table';

            const thead = document.createElement('thead');
            const headerRow = document.createElement('tr');
            const headers = ['Messpunkt', 'Nennwert', 'Messwert', 'Unsicherheit (U)', 'k'];
            for (const h of headers) {
                const th = document.createElement('th');
                th.textContent = h;
                headerRow.appendChild(th);
            }
            thead.appendChild(headerRow);
            table.appendChild(thead);

            const tbody = document.createElement('tbody');
            for (let i = 0; i < results.length; i++) {
                const r = results[i];
                const tr = document.createElement('tr');

                const fields = [
                    { val: r.name || `Punkt ${i + 1}`, key: 'name' },
                    { val: formatValue(r.nominalValue, r.nominalUnit), key: 'nominalValue' },
                    { val: formatValue(r.measuredValue, r.measuredUnit), key: 'measuredValue' },
                    { val: formatValue(r.uncertainty, r.uncertaintyUnit || r.measuredUnit), key: 'uncertainty' },
                    { val: r.coverageFactor ?? '', key: 'coverageFactor' },
                ];

                for (const f of fields) {
                    const td = document.createElement('td');
                    const input = document.createElement('input');
                    input.type = 'text';
                    input.value = f.val;
                    input.dataset.resultIndex = i;
                    input.dataset.key = f.key;
                    input.addEventListener('change', onResultFieldChange);
                    td.appendChild(input);
                    tr.appendChild(td);
                }

                tbody.appendChild(tr);
            }
            table.appendChild(tbody);
            section.appendChild(table);
        }

        resultsContainer.appendChild(section);
    }
}

function formatValue(value, unit) {
    if (value == null) return '';
    return unit ? `${value} ${unit}` : `${value}`;
}

function onResultFieldChange() {
    // When user edits results, we'd need to update extractedData accordingly
    // For now, we just mark that the XML needs to be regenerated
    btnGenerateXml.disabled = false;
    btnDownload.disabled = true;
}

// ============================================================
// Form -> Data Sync
// ============================================================

function syncFormToData() {
    if (!extractedData) return;

    // Sync admin fields back
    if (!extractedData.coreData) extractedData.coreData = {};
    extractedData.coreData.uniqueIdentifier = $('#field-cert-id')?.value || extractedData.coreData.uniqueIdentifier;
    extractedData.coreData.countryCodeISO3166_1 = $('#field-country')?.value || extractedData.coreData.countryCodeISO3166_1;
    extractedData.coreData.beginPerformanceDate = $('#field-begin-date')?.value || extractedData.coreData.beginPerformanceDate;
    extractedData.coreData.endPerformanceDate = $('#field-end-date')?.value || extractedData.coreData.endPerformanceDate;

    if (!extractedData.calibrationLaboratory) extractedData.calibrationLaboratory = {};
    extractedData.calibrationLaboratory.name = $('#field-lab-name')?.value || extractedData.calibrationLaboratory.name;
    extractedData.calibrationLaboratory.street = $('#field-lab-street')?.value || extractedData.calibrationLaboratory.street;
    extractedData.calibrationLaboratory.postCode = $('#field-lab-zip')?.value || extractedData.calibrationLaboratory.postCode;
    extractedData.calibrationLaboratory.city = $('#field-lab-city')?.value || extractedData.calibrationLaboratory.city;

    if (!extractedData.customer) extractedData.customer = {};
    extractedData.customer.name = $('#field-customer-name')?.value || extractedData.customer.name;
    extractedData.customer.street = $('#field-customer-street')?.value || extractedData.customer.street;
    extractedData.customer.postCode = $('#field-customer-zip')?.value || extractedData.customer.postCode;
    extractedData.customer.city = $('#field-customer-city')?.value || extractedData.customer.city;

    if (!extractedData.respPersons) extractedData.respPersons = [{}];
    if (extractedData.respPersons.length === 0) extractedData.respPersons.push({});
    extractedData.respPersons[0].name = $('#field-resp-person')?.value || extractedData.respPersons[0].name;

    // Items
    if (!extractedData.items) extractedData.items = [{}];
    if (extractedData.items.length === 0) extractedData.items.push({});
    extractedData.items[0].name = $('#field-item-name')?.value || extractedData.items[0].name;
    extractedData.items[0].manufacturer = $('#field-item-manufacturer')?.value || extractedData.items[0].manufacturer;
    extractedData.items[0].model = $('#field-item-model')?.value || extractedData.items[0].model;
    extractedData.items[0].serialNumber = $('#field-item-serial')?.value || extractedData.items[0].serialNumber;
    extractedData.items[0].inventoryNumber = $('#field-item-id')?.value || extractedData.items[0].inventoryNumber;
}

// ============================================================
// XML Generation & Download
// ============================================================

btnGenerateXml.addEventListener('click', () => {
    syncFormToData();
    updateXmlPreview();

    const dataWarnings = validateData(extractedData);
    if (dataWarnings.length > 0) {
        showValidationMessages(dataWarnings, 'warnings');
    } else {
        validationMessages.classList.add('hidden');
    }

    btnDownload.disabled = false;
});

function updateXmlPreview() {
    if (!extractedData) return;
    syncFormToData();
    const { xml, warnings } = generateDccXml(extractedData);
    generatedXml = xml;
    xmlPreview.textContent = xml;
}

btnDownload.addEventListener('click', () => {
    if (!generatedXml) return;

    const certId = extractedData?.coreData?.uniqueIdentifier || 'dcc-export';
    const safeId = certId.replace(/[^a-zA-Z0-9_-]/g, '_');
    const blob = new Blob([generatedXml], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `${safeId}.xml`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
});

function showValidationMessages(messages, type) {
    validationMessages.innerHTML = '';
    validationMessages.className = `validation-messages ${type}`;
    validationMessages.classList.remove('hidden');

    const title = document.createElement('strong');
    title.textContent = type === 'warnings' ? 'Hinweise:' : 'Fehler:';
    validationMessages.appendChild(title);

    const ul = document.createElement('ul');
    for (const msg of messages) {
        const li = document.createElement('li');
        li.textContent = msg;
        ul.appendChild(li);
    }
    validationMessages.appendChild(ul);
}

// ============================================================
// Tab Switching
// ============================================================

for (const tab of $$('.tab')) {
    tab.addEventListener('click', () => {
        const tabId = tab.dataset.tab;

        // Update active tab button
        for (const t of $$('.tab')) t.classList.remove('active');
        tab.classList.add('active');

        // Update active tab content
        for (const tc of $$('.tab-content')) tc.classList.remove('active');
        document.getElementById(tabId)?.classList.add('active');

        // Refresh XML preview when switching to that tab
        if (tabId === 'tab-xml' && extractedData) {
            updateXmlPreview();
        }
    });
}

// ============================================================
// Step Header Toggle
// ============================================================

for (const header of $$('.step-header')) {
    header.addEventListener('click', () => {
        const step = header.parentElement;
        if (step.classList.contains('completed') || step.classList.contains('active')) {
            step.classList.toggle('active');
        }
    });
}
