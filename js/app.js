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
    // Core data fields
    setField('field-cert-id', data.coreData?.uniqueIdentifier);
    setField('field-cal-mark', data.coreData?.calibrationMark);
    setField('field-order-number', data.coreData?.orderNumber);
    setField('field-country', data.coreData?.countryCodeISO3166_1);
    setField('field-begin-date', data.coreData?.beginPerformanceDate);
    setField('field-end-date', data.coreData?.endPerformanceDate);
    if (data.coreData?.performanceLocation) {
        const sel = $('#field-perf-location');
        if (sel) sel.value = data.coreData.performanceLocation;
    }

    // Lab fields
    setField('field-lab-name', data.calibrationLaboratory?.name);
    setField('field-lab-code', data.calibrationLaboratory?.calibrationLaboratoryCode);
    setField('field-lab-street', data.calibrationLaboratory?.street);
    setField('field-lab-zip', data.calibrationLaboratory?.postCode);
    setField('field-lab-city', data.calibrationLaboratory?.city);
    setField('field-lab-phone', data.calibrationLaboratory?.phone);
    setField('field-lab-fax', data.calibrationLaboratory?.fax);
    setField('field-lab-email', data.calibrationLaboratory?.eMail);
    setField('field-lab-website', data.calibrationLaboratory?.website);

    // Customer fields
    setField('field-customer-name', data.customer?.name);
    setField('field-customer-street', data.customer?.street);
    setField('field-customer-zip', data.customer?.postCode);
    setField('field-customer-city', data.customer?.city);
    setField('field-customer-contact', data.customer?.contactPerson);

    // Responsible persons
    populateRespPersons(data.respPersons || []);

    // Items
    const item = data.items?.[0] || {};
    setField('field-item-name', item.name);
    setField('field-item-manufacturer', item.manufacturer);
    setField('field-item-model', item.model);
    setField('field-item-serial', item.serialNumber);
    setField('field-item-id', item.inventoryNumber);
    setField('field-item-equip-nr', item.equipmentNumber);
    setField('field-item-test-equip-nr', item.testEquipmentNumber);
    setField('field-item-tag-nr', item.tagNumber);
    setField('field-item-parameter', item.parameter);
    setField('field-item-range', item.measuringRange);
    setField('field-item-signal', item.signalOutput);
    setField('field-item-cal-range', item.calibrationRange);
    setField('field-item-medium', item.medium);
    setField('field-item-description', item.description);

    // Accessories
    populateAccessories(data.accessories || []);

    // Measuring equipments
    populateEquipments(data.measuringEquipments || []);

    // SOPs
    populateSOPs(data.calibrationSOPs || []);

    // Measurement results
    populateResults(data.measurementResults || []);

    // Statements
    populateStatements(data.statements || []);

    // Remarks
    setField('field-remarks', data.remarks);
}

function setField(id, value) {
    const el = document.getElementById(id);
    if (el && value) el.value = value;
}

// ============================================================
// Responsible Persons
// ============================================================

function populateRespPersons(persons) {
    const container = $('#resp-persons-container');
    container.innerHTML = '';

    if (persons.length === 0) {
        container.innerHTML = '<p class="placeholder-text">Keine verantwortlichen Personen gefunden.</p>';
        return;
    }

    const table = document.createElement('table');
    table.className = 'results-table';
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    for (const h of ['Name', 'Rolle', 'Hauptunterzeichner']) {
        const th = document.createElement('th');
        th.textContent = h;
        headerRow.appendChild(th);
    }
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    for (const person of persons) {
        const tr = document.createElement('tr');
        for (const val of [person.name || '', person.role || '', person.isMainSigner ? 'Ja' : '']) {
            const td = document.createElement('td');
            td.textContent = val;
            tr.appendChild(td);
        }
        tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    container.appendChild(table);
}

// ============================================================
// Accessories
// ============================================================

function populateAccessories(accessories) {
    const container = $('#accessories-container');
    container.innerHTML = '';

    if (accessories.length === 0) {
        container.innerHTML = '<p class="placeholder-text">Kein Zubehör gefunden.</p>';
        return;
    }

    const table = document.createElement('table');
    table.className = 'results-table';
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    for (const h of ['Typ', 'Beschreibung', 'Seriennummer']) {
        const th = document.createElement('th');
        th.textContent = h;
        headerRow.appendChild(th);
    }
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    for (const acc of accessories) {
        const tr = document.createElement('tr');
        for (const val of [acc.type || '', acc.description || '', acc.serialNumber || '']) {
            const td = document.createElement('td');
            td.textContent = val;
            tr.appendChild(td);
        }
        tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    container.appendChild(table);
}

// ============================================================
// Measuring Equipments
// ============================================================

function populateEquipments(equipments) {
    const container = $('#equipment-container');
    container.innerHTML = '';

    if (equipments.length === 0) {
        container.innerHTML = '<p class="placeholder-text">Keine Messeinrichtungen gefunden.</p>';
        return;
    }

    const table = document.createElement('table');
    table.className = 'results-table';
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    for (const h of ['Bezeichnung', 'Eq.-Nr.', 'Zertifikat-Nr.', 'Rückführung', 'Kal.-Datum', 'Rekal.']) {
        const th = document.createElement('th');
        th.textContent = h;
        headerRow.appendChild(th);
    }
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    for (const equip of equipments) {
        const tr = document.createElement('tr');
        for (const val of [
            equip.name || '',
            equip.equipmentNumber || equip.serialNumber || '',
            equip.certificateNumber || '',
            equip.traceability || '',
            equip.calibrationDate || '',
            equip.nextCalibrationDate || '',
        ]) {
            const td = document.createElement('td');
            td.textContent = val;
            tr.appendChild(td);
        }
        tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    container.appendChild(table);
}

// ============================================================
// SOPs
// ============================================================

function populateSOPs(sops) {
    const container = $('#sops-container');
    container.innerHTML = '';

    if (sops.length === 0) {
        container.innerHTML = '<p class="placeholder-text">Keine SOPs gefunden.</p>';
        return;
    }

    const table = document.createElement('table');
    table.className = 'results-table';
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    for (const h of ['SOP-Nr.', 'Beschreibung']) {
        const th = document.createElement('th');
        th.textContent = h;
        headerRow.appendChild(th);
    }
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    for (const sop of sops) {
        const tr = document.createElement('tr');
        for (const val of [sop.sopNumber || '', sop.description || '']) {
            const td = document.createElement('td');
            td.textContent = val;
            tr.appendChild(td);
        }
        tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    container.appendChild(table);
}

// ============================================================
// Measurement Results
// ============================================================

function populateResults(measurementResults) {
    resultsContainer.innerHTML = '';

    if (measurementResults.length === 0) {
        resultsContainer.innerHTML = '<p class="placeholder-text">Keine Messergebnisse gefunden.</p>';
        return;
    }

    for (const mr of measurementResults) {
        const section = document.createElement('div');
        section.className = 'result-section';

        const title = document.createElement('h3');
        title.className = 'result-section-title';
        let titleText = mr.name || 'Messergebnis';
        if (mr.category) {
            const categoryLabels = { asFound: 'As Found', asLeft: 'As Left', corrected: 'Korrigiert' };
            titleText += ` (${categoryLabels[mr.category] || mr.category})`;
        }
        title.textContent = titleText;
        section.appendChild(title);

        if (mr.description) {
            const desc = document.createElement('p');
            desc.textContent = mr.description;
            desc.style.marginBottom = '0.5rem';
            desc.style.fontSize = '0.85rem';
            desc.style.color = '#64748b';
            section.appendChild(desc);
        }

        // Calibration procedure
        if (mr.calibrationProcedure) {
            const procTitle = document.createElement('p');
            procTitle.style.fontWeight = '600';
            procTitle.style.fontSize = '0.85rem';
            procTitle.style.marginTop = '0.5rem';
            procTitle.textContent = 'Kalibrierverfahren:';
            section.appendChild(procTitle);

            const proc = document.createElement('p');
            proc.textContent = mr.calibrationProcedure.substring(0, 300) + (mr.calibrationProcedure.length > 300 ? '...' : '');
            proc.style.fontSize = '0.8rem';
            proc.style.color = '#64748b';
            proc.style.marginBottom = '0.5rem';
            section.appendChild(proc);
        }

        // Used methods
        if (mr.method || (mr.usedMethods && mr.usedMethods.length > 0)) {
            const methodTitle = document.createElement('p');
            methodTitle.style.fontWeight = '600';
            methodTitle.style.fontSize = '0.85rem';
            methodTitle.textContent = 'Methode:';
            section.appendChild(methodTitle);
            const methodText = document.createElement('p');
            methodText.style.fontSize = '0.8rem';
            methodText.style.color = '#64748b';
            methodText.style.marginBottom = '0.5rem';
            const parts = [];
            if (mr.method) parts.push(mr.method);
            if (mr.usedMethods) {
                for (const m of mr.usedMethods) {
                    parts.push(`${m.name}${m.description ? ': ' + m.description : ''}`);
                }
            }
            methodText.textContent = parts.join('; ');
            section.appendChild(methodText);
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
                if (c.min != null && c.max != null) {
                    li.textContent = `${c.name}: ${c.min}...${c.max} ${c.unit || ''}`;
                } else {
                    li.textContent = `${c.name}: ${c.value ?? '?'} ${c.unit || ''}`;
                }
                if (c.uncertainty) li.textContent += ` (U: ${c.uncertainty})`;
                condList.appendChild(li);
            }
            section.appendChild(condList);
        }

        // Decision rule
        if (mr.decisionRule) {
            const drp = document.createElement('p');
            drp.style.fontSize = '0.8rem';
            drp.style.color = '#64748b';
            drp.textContent = `Entscheidungsregel: ${mr.decisionRule}`;
            section.appendChild(drp);
        }

        // Results table
        const results = mr.results || [];
        if (results.length > 0) {
            const table = document.createElement('table');
            table.className = 'results-table';

            const thead = document.createElement('thead');
            const headerRow = document.createElement('tr');

            // Determine which columns to show based on available data
            const hasSetPoint = results.some(r => r.setPoint != null);
            const hasDeviation = results.some(r => r.deviation != null);
            const hasAllowedDev = results.some(r => r.allowedDeviation != null || r.mpe != null);
            const hasConformity = results.some(r => r.conformity);

            const headers = ['Messpunkt'];
            if (hasSetPoint) headers.push('Sollwert');
            headers.push('Bezugswert', 'Messwert');
            if (hasDeviation) headers.push('Abweichung');
            if (hasAllowedDev) headers.push('Zul. Abw. / MPE');
            headers.push('U (k)');
            if (hasConformity) headers.push('Bewertung');

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

                const fields = [r.name || `Punkt ${i + 1}`];
                if (hasSetPoint) fields.push(formatValue(r.setPoint, r.setPointUnit));
                fields.push(
                    formatValue(r.nominalValue ?? r.referenceValue, r.nominalUnit || r.referenceUnit),
                    formatValue(r.measuredValue, r.measuredUnit)
                );
                if (hasDeviation) fields.push(formatValue(r.deviation, r.deviationUnit));
                if (hasAllowedDev) fields.push(formatValue(r.allowedDeviation ?? r.mpe, r.allowedDeviationUnit || r.mpeUnit));
                fields.push(r.uncertainty != null ? `${r.uncertainty} (k=${r.coverageFactor ?? '?'})` : '');
                if (hasConformity) fields.push(r.conformity || '');

                for (const val of fields) {
                    const td = document.createElement('td');
                    td.textContent = val;
                    if (val === 'pass') td.style.color = '#16a34a';
                    if (val === 'fail') td.style.color = '#dc2626';
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

// ============================================================
// Statements
// ============================================================

function populateStatements(statements) {
    const container = $('#statements-container');
    container.innerHTML = '';

    if (statements.length === 0) {
        container.innerHTML = '<p class="placeholder-text">Keine Konformitätsaussagen gefunden.</p>';
        return;
    }

    for (const stmt of statements) {
        const div = document.createElement('div');
        div.className = 'statement-item';
        div.style.marginBottom = '1rem';
        div.style.padding = '0.75rem';
        div.style.background = '#f8fafc';
        div.style.borderRadius = '0.375rem';
        div.style.border = '1px solid #e2e8f0';

        if (stmt.name) {
            const nameEl = document.createElement('p');
            nameEl.style.fontWeight = '600';
            nameEl.style.marginBottom = '0.25rem';
            nameEl.textContent = stmt.name;
            div.appendChild(nameEl);
        }

        if (stmt.conformity) {
            const confEl = document.createElement('span');
            confEl.style.display = 'inline-block';
            confEl.style.padding = '0.125rem 0.5rem';
            confEl.style.borderRadius = '0.25rem';
            confEl.style.fontSize = '0.8rem';
            confEl.style.fontWeight = '600';
            confEl.style.marginBottom = '0.5rem';
            if (stmt.conformity === 'pass') {
                confEl.style.background = '#dcfce7';
                confEl.style.color = '#16a34a';
                confEl.textContent = 'PASS';
            } else {
                confEl.style.background = '#fee2e2';
                confEl.style.color = '#dc2626';
                confEl.textContent = 'FAIL';
            }
            div.appendChild(confEl);
        }

        if (stmt.description) {
            const descEl = document.createElement('p');
            descEl.style.fontSize = '0.85rem';
            descEl.style.color = '#475569';
            descEl.textContent = stmt.description;
            div.appendChild(descEl);
        }

        const details = [];
        if (stmt.decisionRule) details.push(`Entscheidungsregel: ${stmt.decisionRule}`);
        if (stmt.conformityProbability) details.push(`Konformitätswahrscheinlichkeit: ${stmt.conformityProbability}`);
        if (stmt.norm) details.push(`Norm: ${stmt.norm}`);
        if (details.length > 0) {
            const detailEl = document.createElement('p');
            detailEl.style.fontSize = '0.8rem';
            detailEl.style.color = '#94a3b8';
            detailEl.style.marginTop = '0.25rem';
            detailEl.textContent = details.join(' | ');
            div.appendChild(detailEl);
        }

        container.appendChild(div);
    }
}

// ============================================================
// Form -> Data Sync
// ============================================================

function syncFormToData() {
    if (!extractedData) return;

    // Core data
    if (!extractedData.coreData) extractedData.coreData = {};
    extractedData.coreData.uniqueIdentifier = $('#field-cert-id')?.value || extractedData.coreData.uniqueIdentifier;
    extractedData.coreData.calibrationMark = $('#field-cal-mark')?.value || extractedData.coreData.calibrationMark;
    extractedData.coreData.orderNumber = $('#field-order-number')?.value || extractedData.coreData.orderNumber;
    extractedData.coreData.countryCodeISO3166_1 = $('#field-country')?.value || extractedData.coreData.countryCodeISO3166_1;
    extractedData.coreData.beginPerformanceDate = $('#field-begin-date')?.value || extractedData.coreData.beginPerformanceDate;
    extractedData.coreData.endPerformanceDate = $('#field-end-date')?.value || extractedData.coreData.endPerformanceDate;
    extractedData.coreData.performanceLocation = $('#field-perf-location')?.value || extractedData.coreData.performanceLocation;

    // Lab
    if (!extractedData.calibrationLaboratory) extractedData.calibrationLaboratory = {};
    extractedData.calibrationLaboratory.name = $('#field-lab-name')?.value || extractedData.calibrationLaboratory.name;
    extractedData.calibrationLaboratory.calibrationLaboratoryCode = $('#field-lab-code')?.value || extractedData.calibrationLaboratory.calibrationLaboratoryCode;
    extractedData.calibrationLaboratory.street = $('#field-lab-street')?.value || extractedData.calibrationLaboratory.street;
    extractedData.calibrationLaboratory.postCode = $('#field-lab-zip')?.value || extractedData.calibrationLaboratory.postCode;
    extractedData.calibrationLaboratory.city = $('#field-lab-city')?.value || extractedData.calibrationLaboratory.city;
    extractedData.calibrationLaboratory.phone = $('#field-lab-phone')?.value || extractedData.calibrationLaboratory.phone;
    extractedData.calibrationLaboratory.fax = $('#field-lab-fax')?.value || extractedData.calibrationLaboratory.fax;
    extractedData.calibrationLaboratory.eMail = $('#field-lab-email')?.value || extractedData.calibrationLaboratory.eMail;
    extractedData.calibrationLaboratory.website = $('#field-lab-website')?.value || extractedData.calibrationLaboratory.website;

    // Customer
    if (!extractedData.customer) extractedData.customer = {};
    extractedData.customer.name = $('#field-customer-name')?.value || extractedData.customer.name;
    extractedData.customer.street = $('#field-customer-street')?.value || extractedData.customer.street;
    extractedData.customer.postCode = $('#field-customer-zip')?.value || extractedData.customer.postCode;
    extractedData.customer.city = $('#field-customer-city')?.value || extractedData.customer.city;
    extractedData.customer.contactPerson = $('#field-customer-contact')?.value || extractedData.customer.contactPerson;

    // Items
    if (!extractedData.items) extractedData.items = [{}];
    if (extractedData.items.length === 0) extractedData.items.push({});
    extractedData.items[0].name = $('#field-item-name')?.value || extractedData.items[0].name;
    extractedData.items[0].manufacturer = $('#field-item-manufacturer')?.value || extractedData.items[0].manufacturer;
    extractedData.items[0].model = $('#field-item-model')?.value || extractedData.items[0].model;
    extractedData.items[0].serialNumber = $('#field-item-serial')?.value || extractedData.items[0].serialNumber;
    extractedData.items[0].inventoryNumber = $('#field-item-id')?.value || extractedData.items[0].inventoryNumber;
    extractedData.items[0].equipmentNumber = $('#field-item-equip-nr')?.value || extractedData.items[0].equipmentNumber;
    extractedData.items[0].testEquipmentNumber = $('#field-item-test-equip-nr')?.value || extractedData.items[0].testEquipmentNumber;
    extractedData.items[0].tagNumber = $('#field-item-tag-nr')?.value || extractedData.items[0].tagNumber;
    extractedData.items[0].parameter = $('#field-item-parameter')?.value || extractedData.items[0].parameter;
    extractedData.items[0].measuringRange = $('#field-item-range')?.value || extractedData.items[0].measuringRange;
    extractedData.items[0].signalOutput = $('#field-item-signal')?.value || extractedData.items[0].signalOutput;
    extractedData.items[0].calibrationRange = $('#field-item-cal-range')?.value || extractedData.items[0].calibrationRange;
    extractedData.items[0].medium = $('#field-item-medium')?.value || extractedData.items[0].medium;
    extractedData.items[0].description = $('#field-item-description')?.value || extractedData.items[0].description;

    // Remarks
    const remarksVal = $('#field-remarks')?.value;
    if (remarksVal) extractedData.remarks = remarksVal;
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
