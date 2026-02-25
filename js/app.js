/**
 * Main application controller for the DCC Converter.
 * Supports three modes: PDF Upload, XML Convert, and Train Mapping.
 */

import { extractTextFromPdf } from './pdf-extractor.js';
import { extractCalibrationData, validateApiKey } from './claude-api.js';
import { generateDccXml, validateData } from './dcc-xml-generator.js';
import { convertXmlToDccJson } from './mapping-engine.js';
import { getAllProfiles, saveProfile, getProfile, deleteProfile, exportProfile, importProfile, detectProfileForXml } from './mapping-store.js';
import { trainMappingProfile } from './mapping-trainer.js';
import { MappingEditor } from './mapping-editor.js';

// ============================================================
// State
// ============================================================

let apiKey = '';
let pdfFile = null;
let pdfText = '';
let pdfMetadata = {};
let extractedData = null;
let generatedXml = '';

// XML Convert mode state
let xmlFile = null;
let xmlContent = '';
let selectedProfileId = '';
let xmlConvertedData = null;
let xmlGeneratedDcc = '';

// Train mode state
let trainXsdFile = null;
let trainXsdContent = '';
let trainXmlFile = null;
let trainXmlContent = '';
let trainedProfile = null;

// Mapping editors
let trainEditor = null;
let xmlProfileEditor = null;

// ============================================================
// DOM Helpers
// ============================================================

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// ============================================================
// Mode Switching
// ============================================================

for (const btn of $$('.mode-btn')) {
    btn.addEventListener('click', () => {
        const mode = btn.dataset.mode;

        // Update buttons
        for (const b of $$('.mode-btn')) b.classList.remove('active');
        btn.classList.add('active');

        // Update content
        for (const mc of $$('.mode-content')) mc.classList.remove('active');
        const target = $(`#mode-${mode}`);
        if (target) target.classList.add('active');

        // Sync API key across modes
        syncApiKeyAcrossModes();

        // Refresh profile lists when switching to xml or train mode
        if (mode === 'xml') refreshXmlProfileSelect();
        if (mode === 'train') refreshTrainProfilesList();
    });
}

function syncApiKeyAcrossModes() {
    if (apiKey) {
        const pdfInput = $('#pdf-api-key-input');
        const trainInput = $('#train-api-key-input');
        if (pdfInput && !pdfInput.value) pdfInput.value = apiKey;
        if (trainInput && !trainInput.value) trainInput.value = apiKey;
    }
}

// ============================================================
// PDF MODE - API Key
// ============================================================

$('#pdf-btn-save-key')?.addEventListener('click', () => {
    const key = $('#pdf-api-key-input').value.trim();
    if (!validateApiKey(key)) {
        $('#pdf-api-key-status').textContent = 'Invalid API key. Must start with "sk-ant-".';
        $('#pdf-api-key-status').className = 'status-text error';
        return;
    }
    apiKey = key;
    $('#pdf-api-key-status').textContent = 'API key saved (session only).';
    $('#pdf-api-key-status').className = 'status-text success';
    completeStep($('#pdf-step-apikey'));
    activateStep($('#pdf-step-upload'));
});

$('#pdf-api-key-input')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') $('#pdf-btn-save-key').click();
});

// ============================================================
// PDF MODE - File Upload
// ============================================================

function handlePdfFile(file) {
    if (!file || file.type !== 'application/pdf') {
        alert('Please select a PDF file.');
        return;
    }
    pdfFile = file;
    $('#pdf-file-name').textContent = file.name;
    $('#pdf-file-info').classList.remove('hidden');
    $('#pdf-drop-zone').style.display = 'none';
    $('#pdf-btn-extract').disabled = false;
    activateStep($('#pdf-step-extract'));
}

$('#pdf-drop-zone')?.addEventListener('click', () => $('#pdf-file-input').click());

$('#pdf-drop-zone')?.addEventListener('dragover', (e) => {
    e.preventDefault();
    $('#pdf-drop-zone').classList.add('drag-over');
});

$('#pdf-drop-zone')?.addEventListener('dragleave', () => {
    $('#pdf-drop-zone').classList.remove('drag-over');
});

$('#pdf-drop-zone')?.addEventListener('drop', (e) => {
    e.preventDefault();
    $('#pdf-drop-zone').classList.remove('drag-over');
    handlePdfFile(e.dataTransfer.files[0]);
});

$('#pdf-file-input')?.addEventListener('change', (e) => {
    handlePdfFile(e.target.files[0]);
});

$('#pdf-btn-remove-file')?.addEventListener('click', () => {
    pdfFile = null;
    pdfText = '';
    extractedData = null;
    generatedXml = '';
    $('#pdf-file-info').classList.add('hidden');
    $('#pdf-drop-zone').style.display = '';
    $('#pdf-file-input').value = '';
    $('#pdf-btn-extract').disabled = true;
    $('#pdf-btn-generate-xml').disabled = true;
    $('#pdf-btn-download').disabled = true;
    $('#pdf-file-name').textContent = '';
});

// ============================================================
// PDF MODE - Extraction Pipeline
// ============================================================

$('#pdf-btn-extract')?.addEventListener('click', async () => {
    if (!pdfFile || !apiKey) return;

    $('#pdf-btn-extract').disabled = true;
    $('#pdf-extraction-progress').classList.remove('hidden');
    setPdfProgress(0, 'Reading PDF...');

    try {
        const pdfResult = await extractTextFromPdf(pdfFile, (pct) => {
            setPdfProgress(pct * 0.4, 'Reading PDF...');
        });

        pdfText = pdfResult.text;
        pdfMetadata = pdfResult.metadata;
        setPdfProgress(40, `${pdfResult.numPages} pages read. Sending to Claude API...`);

        extractedData = await extractCalibrationData(apiKey, pdfText, pdfMetadata);
        setPdfProgress(90, 'Data extracted. Building preview...');

        populatePreview(extractedData);
        setPdfProgress(100, 'Done! Please review the extracted data.');

        completeStep($('#pdf-step-extract'));
        activateStep($('#pdf-step-preview'));
        activateStep($('#pdf-step-download'));
        $('#pdf-btn-generate-xml').disabled = false;

        updateXmlPreview();

    } catch (err) {
        setPdfProgress(0, `Error: ${err.message}`);
        $('#pdf-progress-text').classList.add('error');
        $('#pdf-btn-extract').disabled = false;
    }
});

function setPdfProgress(pct, text) {
    $('#pdf-progress-fill').style.width = `${pct}%`;
    if (text) {
        $('#pdf-progress-text').textContent = text;
        $('#pdf-progress-text').className = 'progress-text';
    }
}

// ============================================================
// PDF MODE - Preview Population
// ============================================================

function populatePreview(data) {
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

    setField('field-lab-name', data.calibrationLaboratory?.name);
    setField('field-lab-code', data.calibrationLaboratory?.calibrationLaboratoryCode);
    setField('field-lab-street', data.calibrationLaboratory?.street);
    setField('field-lab-zip', data.calibrationLaboratory?.postCode);
    setField('field-lab-city', data.calibrationLaboratory?.city);
    setField('field-lab-phone', data.calibrationLaboratory?.phone);
    setField('field-lab-fax', data.calibrationLaboratory?.fax);
    setField('field-lab-email', data.calibrationLaboratory?.eMail);
    setField('field-lab-website', data.calibrationLaboratory?.website);

    setField('field-customer-name', data.customer?.name);
    setField('field-customer-street', data.customer?.street);
    setField('field-customer-zip', data.customer?.postCode);
    setField('field-customer-city', data.customer?.city);
    setField('field-customer-contact', data.customer?.contactPerson);

    populateRespPersons(data.respPersons || []);

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

    populateAccessories(data.accessories || []);
    populateEquipments(data.measuringEquipments || []);
    populateSOPs(data.calibrationSOPs || []);
    populateResults(data.measurementResults || []);
    populateStatements(data.statements || []);

    setField('field-remarks', data.remarks);
}

function setField(id, value) {
    const el = document.getElementById(id);
    if (el && value) el.value = value;
}

// ============================================================
// PDF MODE - Dynamic Tables
// ============================================================

function populateRespPersons(persons) {
    const container = $('#resp-persons-container');
    container.innerHTML = '';
    if (persons.length === 0) {
        container.innerHTML = '<p class="placeholder-text">No responsible persons found.</p>';
        return;
    }
    const table = createTable(['Name', 'Role', 'Main Signer']);
    const tbody = table.querySelector('tbody');
    for (const p of persons) {
        appendRow(tbody, [p.name || '', p.role || '', p.isMainSigner ? 'Yes' : '']);
    }
    container.appendChild(table);
}

function populateAccessories(accessories) {
    const container = $('#accessories-container');
    container.innerHTML = '';
    if (accessories.length === 0) {
        container.innerHTML = '<p class="placeholder-text">No accessories found.</p>';
        return;
    }
    const table = createTable(['Type', 'Description', 'Serial Number']);
    const tbody = table.querySelector('tbody');
    for (const a of accessories) {
        appendRow(tbody, [a.type || '', a.description || '', a.serialNumber || '']);
    }
    container.appendChild(table);
}

function populateEquipments(equipments) {
    const container = $('#equipment-container');
    container.innerHTML = '';
    if (equipments.length === 0) {
        container.innerHTML = '<p class="placeholder-text">No measuring equipment found.</p>';
        return;
    }
    const table = createTable(['Name', 'Eq. No.', 'Certificate No.', 'Traceability', 'Cal. Date', 'Next Cal.']);
    const tbody = table.querySelector('tbody');
    for (const eq of equipments) {
        appendRow(tbody, [
            eq.name || '',
            eq.equipmentNumber || eq.serialNumber || '',
            eq.certificateNumber || '',
            eq.traceability || '',
            eq.calibrationDate || '',
            eq.nextCalibrationDate || '',
        ]);
    }
    container.appendChild(table);
}

function populateSOPs(sops) {
    const container = $('#sops-container');
    container.innerHTML = '';
    if (sops.length === 0) {
        container.innerHTML = '<p class="placeholder-text">No SOPs found.</p>';
        return;
    }
    const table = createTable(['SOP No.', 'Description']);
    const tbody = table.querySelector('tbody');
    for (const s of sops) {
        appendRow(tbody, [s.sopNumber || '', s.description || '']);
    }
    container.appendChild(table);
}

function populateResults(measurementResults) {
    const container = $('#results-container');
    container.innerHTML = '';
    if (measurementResults.length === 0) {
        container.innerHTML = '<p class="placeholder-text">No measurement results found.</p>';
        return;
    }

    for (const mr of measurementResults) {
        const section = document.createElement('div');
        section.className = 'result-section';

        const title = document.createElement('h3');
        title.className = 'result-section-title';
        let titleText = mr.name || 'Measurement Result';
        if (mr.category) {
            const labels = { asFound: 'As Found', asLeft: 'As Left', corrected: 'Corrected' };
            titleText += ` (${labels[mr.category] || mr.category})`;
        }
        title.textContent = titleText;
        section.appendChild(title);

        if (mr.description) {
            const desc = document.createElement('p');
            desc.className = 'text-muted text-small';
            desc.textContent = mr.description;
            section.appendChild(desc);
        }

        if (mr.calibrationProcedure) {
            const proc = document.createElement('details');
            proc.className = 'details-block';
            const summary = document.createElement('summary');
            summary.textContent = 'Calibration Procedure';
            proc.appendChild(summary);
            const procText = document.createElement('p');
            procText.className = 'text-muted text-small';
            procText.textContent = mr.calibrationProcedure;
            proc.appendChild(procText);
            section.appendChild(proc);
        }

        if (mr.method || (mr.usedMethods && mr.usedMethods.length > 0)) {
            const parts = [];
            if (mr.method) parts.push(mr.method);
            if (mr.usedMethods) {
                for (const m of mr.usedMethods) {
                    parts.push(`${m.name}${m.description ? ': ' + m.description : ''}`);
                }
            }
            const meth = document.createElement('p');
            meth.className = 'text-muted text-small';
            meth.innerHTML = `<strong>Method:</strong> ${escapeHtml(parts.join('; '))}`;
            section.appendChild(meth);
        }

        const conditions = mr.influenceConditions || [];
        if (conditions.length > 0) {
            const condBlock = document.createElement('details');
            condBlock.className = 'details-block';
            const condSummary = document.createElement('summary');
            condSummary.textContent = `Influence Conditions (${conditions.length})`;
            condBlock.appendChild(condSummary);
            const condList = document.createElement('ul');
            condList.className = 'text-small';
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
            condBlock.appendChild(condList);
            section.appendChild(condBlock);
        }

        if (mr.decisionRule) {
            const drp = document.createElement('p');
            drp.className = 'text-muted text-small';
            drp.innerHTML = `<strong>Decision Rule:</strong> ${escapeHtml(mr.decisionRule)}`;
            section.appendChild(drp);
        }

        const results = mr.results || [];
        if (results.length > 0) {
            const hasSetPoint = results.some(r => r.setPoint != null);
            const hasDeviation = results.some(r => r.deviation != null);
            const hasAllowedDev = results.some(r => r.allowedDeviation != null || r.mpe != null);
            const hasConformity = results.some(r => r.conformity);

            const headers = ['Point'];
            if (hasSetPoint) headers.push('Set Point');
            headers.push('Reference', 'Measured');
            if (hasDeviation) headers.push('Deviation');
            if (hasAllowedDev) headers.push('Allowed Dev. / MPE');
            headers.push('U (k)');
            if (hasConformity) headers.push('Conformity');

            const table = createTable(headers);
            const tbody = table.querySelector('tbody');

            for (let i = 0; i < results.length; i++) {
                const r = results[i];
                const fields = [r.name || `Point ${i + 1}`];
                if (hasSetPoint) fields.push(formatValue(r.setPoint, r.setPointUnit));
                fields.push(
                    formatValue(r.nominalValue ?? r.referenceValue, r.nominalUnit || r.referenceUnit),
                    formatValue(r.measuredValue, r.measuredUnit)
                );
                if (hasDeviation) fields.push(formatValue(r.deviation, r.deviationUnit));
                if (hasAllowedDev) fields.push(formatValue(r.allowedDeviation ?? r.mpe, r.allowedDeviationUnit || r.mpeUnit));
                fields.push(r.uncertainty != null ? `${r.uncertainty} (k=${r.coverageFactor ?? '?'})` : '');
                if (hasConformity) fields.push(r.conformity || '');

                const tr = document.createElement('tr');
                for (const val of fields) {
                    const td = document.createElement('td');
                    td.textContent = val;
                    if (val === 'pass') td.className = 'text-pass';
                    if (val === 'fail') td.className = 'text-fail';
                    tr.appendChild(td);
                }
                tbody.appendChild(tr);
            }
            section.appendChild(table);
        }

        container.appendChild(section);
    }
}

function populateStatements(statements) {
    const container = $('#statements-container');
    container.innerHTML = '';
    if (statements.length === 0) {
        container.innerHTML = '<p class="placeholder-text">No conformity statements found.</p>';
        return;
    }

    for (const stmt of statements) {
        const div = document.createElement('div');
        div.className = 'statement-item';

        if (stmt.name) {
            const nameEl = document.createElement('p');
            nameEl.className = 'statement-name';
            nameEl.textContent = stmt.name;
            div.appendChild(nameEl);
        }

        if (stmt.conformity) {
            const badge = document.createElement('span');
            badge.className = `badge ${stmt.conformity === 'pass' ? 'badge-success' : 'badge-danger'}`;
            badge.textContent = stmt.conformity.toUpperCase();
            div.appendChild(badge);
        }

        if (stmt.description) {
            const descEl = document.createElement('p');
            descEl.className = 'text-muted text-small';
            descEl.textContent = stmt.description;
            div.appendChild(descEl);
        }

        const details = [];
        if (stmt.decisionRule) details.push(`Decision Rule: ${stmt.decisionRule}`);
        if (stmt.conformityProbability) details.push(`Probability: ${stmt.conformityProbability}`);
        if (stmt.norm) details.push(`Norm: ${stmt.norm}`);
        if (details.length > 0) {
            const detailEl = document.createElement('p');
            detailEl.className = 'text-muted text-xsmall';
            detailEl.textContent = details.join(' | ');
            div.appendChild(detailEl);
        }

        container.appendChild(div);
    }
}

// ============================================================
// PDF MODE - Form Sync & XML Generation
// ============================================================

function syncFormToData() {
    if (!extractedData) return;

    if (!extractedData.coreData) extractedData.coreData = {};
    extractedData.coreData.uniqueIdentifier = $('#field-cert-id')?.value || extractedData.coreData.uniqueIdentifier;
    extractedData.coreData.calibrationMark = $('#field-cal-mark')?.value || extractedData.coreData.calibrationMark;
    extractedData.coreData.orderNumber = $('#field-order-number')?.value || extractedData.coreData.orderNumber;
    extractedData.coreData.countryCodeISO3166_1 = $('#field-country')?.value || extractedData.coreData.countryCodeISO3166_1;
    extractedData.coreData.beginPerformanceDate = $('#field-begin-date')?.value || extractedData.coreData.beginPerformanceDate;
    extractedData.coreData.endPerformanceDate = $('#field-end-date')?.value || extractedData.coreData.endPerformanceDate;
    extractedData.coreData.performanceLocation = $('#field-perf-location')?.value || extractedData.coreData.performanceLocation;

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

    if (!extractedData.customer) extractedData.customer = {};
    extractedData.customer.name = $('#field-customer-name')?.value || extractedData.customer.name;
    extractedData.customer.street = $('#field-customer-street')?.value || extractedData.customer.street;
    extractedData.customer.postCode = $('#field-customer-zip')?.value || extractedData.customer.postCode;
    extractedData.customer.city = $('#field-customer-city')?.value || extractedData.customer.city;
    extractedData.customer.contactPerson = $('#field-customer-contact')?.value || extractedData.customer.contactPerson;

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

    const remarksVal = $('#field-remarks')?.value;
    if (remarksVal) extractedData.remarks = remarksVal;
}

$('#pdf-btn-generate-xml')?.addEventListener('click', () => {
    syncFormToData();
    updateXmlPreview();

    const dataWarnings = validateData(extractedData);
    if (dataWarnings.length > 0) {
        showValidationMessages($('#pdf-validation-messages'), dataWarnings, 'warnings');
    } else {
        $('#pdf-validation-messages').classList.add('hidden');
    }
    $('#pdf-btn-download').disabled = false;
});

function updateXmlPreview() {
    if (!extractedData) return;
    syncFormToData();
    const { xml } = generateDccXml(extractedData);
    generatedXml = xml;
    const codeEl = $('#xml-preview code');
    if (codeEl) codeEl.textContent = xml;
}

$('#pdf-btn-download')?.addEventListener('click', () => {
    if (!generatedXml) return;
    downloadFile(generatedXml, 'application/xml',
        (extractedData?.coreData?.uniqueIdentifier || 'dcc-export').replace(/[^a-zA-Z0-9_-]/g, '_') + '.xml'
    );
});

// ============================================================
// XML CONVERT MODE - Profile Selection
// ============================================================

function refreshXmlProfileSelect() {
    const select = $('#xml-profile-select');
    if (!select) return;
    const profiles = getAllProfiles();

    select.innerHTML = '';
    if (profiles.length === 0) {
        select.innerHTML = '<option value="">-- No profiles saved --</option>';
    } else {
        select.innerHTML = '<option value="">-- Select a profile --</option>';
        for (const p of profiles) {
            const opt = document.createElement('option');
            opt.value = p.id;
            opt.textContent = p.name || p.id;
            select.appendChild(opt);
        }
    }

    // Restore selection if possible
    if (selectedProfileId) {
        select.value = selectedProfileId;
    }

    updateXmlProfileInfo();
}

function updateXmlProfileInfo() {
    const select = $('#xml-profile-select');
    const id = select?.value;
    const info = $('#xml-profile-info');

    if (!id) {
        info?.classList.add('hidden');
        selectedProfileId = '';
        updateXmlConvertButton();
        return;
    }

    const profile = getProfile(id);
    if (!profile) {
        info?.classList.add('hidden');
        selectedProfileId = '';
        updateXmlConvertButton();
        return;
    }

    selectedProfileId = id;
    info?.classList.remove('hidden');
    $('#xml-profile-name').textContent = profile.name || profile.id;
    $('#xml-profile-desc').textContent = profile.description || '';
    $('#xml-profile-ns').textContent = profile.schemaNamespace || 'N/A';
    $('#xml-profile-count').textContent = profile.mappings?.length || 0;

    activateStep($('#xml-step-upload'));
    updateXmlConvertButton();
}

$('#xml-profile-select')?.addEventListener('change', updateXmlProfileInfo);

$('#xml-btn-import-profile')?.addEventListener('click', () => {
    $('#xml-import-profile-input').click();
});

$('#xml-import-profile-input')?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
        const imported = await importProfile(file);
        refreshXmlProfileSelect();
        $('#xml-profile-select').value = imported.id;
        updateXmlProfileInfo();
    } catch (err) {
        alert('Import failed: ' + err.message);
    }
    e.target.value = '';
});

$('#xml-btn-export-profile')?.addEventListener('click', () => {
    if (!selectedProfileId) return;
    const profile = getProfile(selectedProfileId);
    if (profile) exportProfile(profile);
});

$('#xml-btn-delete-profile')?.addEventListener('click', () => {
    if (!selectedProfileId) return;
    if (!confirm('Delete this mapping profile?')) return;
    deleteProfile(selectedProfileId);
    selectedProfileId = '';
    refreshXmlProfileSelect();
});

// --- XML Convert: Profile Editor ---

$('#xml-btn-edit-profile')?.addEventListener('click', () => {
    if (!selectedProfileId) return;
    const profile = getProfile(selectedProfileId);
    if (!profile) return;

    const container = $('#xml-profile-editor-container');
    const editorEl = $('#xml-mapping-editor');
    if (!container || !editorEl) return;

    container.classList.remove('hidden');

    xmlProfileEditor = new MappingEditor(editorEl);
    xmlProfileEditor.onChange = () => {
        // Changes tracked in the editor, saved on explicit "Save Changes"
    };
    xmlProfileEditor.init(profile, xmlContent || null);
});

$('#xml-btn-save-edited-profile')?.addEventListener('click', () => {
    if (!xmlProfileEditor || !selectedProfileId) return;
    const updated = xmlProfileEditor.getProfile();
    // Preserve metadata from the original profile
    const original = getProfile(selectedProfileId);
    if (original) {
        updated.id = original.id;
        updated.name = original.name;
        updated.schemaNamespace = original.schemaNamespace;
        updated.rootElement = original.rootElement;
        updated.description = original.description;
    }
    saveProfile(updated);
    showStatus('#xml-editor-status', 'Profile saved successfully!', 'success');
    updateXmlProfileInfo();
});

$('#xml-btn-close-editor')?.addEventListener('click', () => {
    $('#xml-profile-editor-container')?.classList.add('hidden');
    xmlProfileEditor = null;
});

// ============================================================
// XML CONVERT MODE - File Upload
// ============================================================

function handleXmlFile(file) {
    if (!file) return;
    xmlFile = file;
    $('#xml-file-name').textContent = file.name;
    $('#xml-file-info').classList.remove('hidden');
    $('#xml-drop-zone').style.display = 'none';

    const reader = new FileReader();
    reader.onload = (e) => {
        xmlContent = e.target.result;

        // Try auto-detection
        const detected = detectProfileForXml(xmlContent);
        if (detected) {
            $('#xml-auto-detect').classList.remove('hidden');
            $('#xml-auto-detect-name').textContent = detected.name || detected.id;
            selectedProfileId = detected.id;
            $('#xml-profile-select').value = detected.id;
            updateXmlProfileInfo();
        }

        activateStep($('#xml-step-convert'));
        updateXmlConvertButton();
    };
    reader.readAsText(file);
}

$('#xml-drop-zone')?.addEventListener('click', () => $('#xml-file-input').click());

$('#xml-drop-zone')?.addEventListener('dragover', (e) => {
    e.preventDefault();
    $('#xml-drop-zone').classList.add('drag-over');
});

$('#xml-drop-zone')?.addEventListener('dragleave', () => {
    $('#xml-drop-zone').classList.remove('drag-over');
});

$('#xml-drop-zone')?.addEventListener('drop', (e) => {
    e.preventDefault();
    $('#xml-drop-zone').classList.remove('drag-over');
    handleXmlFile(e.dataTransfer.files[0]);
});

$('#xml-file-input')?.addEventListener('change', (e) => {
    handleXmlFile(e.target.files[0]);
});

$('#xml-btn-remove-file')?.addEventListener('click', () => {
    xmlFile = null;
    xmlContent = '';
    xmlConvertedData = null;
    xmlGeneratedDcc = '';
    $('#xml-file-info').classList.add('hidden');
    $('#xml-drop-zone').style.display = '';
    $('#xml-file-input').value = '';
    $('#xml-auto-detect').classList.add('hidden');
    $('#xml-btn-convert').disabled = true;
    $('#xml-btn-download').disabled = true;
    $('#xml-file-name').textContent = '';
});

function updateXmlConvertButton() {
    const btn = $('#xml-btn-convert');
    if (btn) btn.disabled = !(xmlContent && selectedProfileId);
}

// ============================================================
// XML CONVERT MODE - Conversion
// ============================================================

$('#xml-btn-convert')?.addEventListener('click', () => {
    if (!xmlContent || !selectedProfileId) return;

    const profile = getProfile(selectedProfileId);
    if (!profile) {
        showStatus('#xml-conversion-status', 'Profile not found.', 'error');
        return;
    }

    try {
        xmlConvertedData = convertXmlToDccJson(xmlContent, profile);

        // Show JSON preview
        const jsonCode = $('#xml-json-preview code');
        if (jsonCode) jsonCode.textContent = JSON.stringify(xmlConvertedData, null, 2);

        // Generate DCC XML
        const { xml } = generateDccXml(xmlConvertedData);
        xmlGeneratedDcc = xml;
        const dccCode = $('#xml-dcc-preview code');
        if (dccCode) dccCode.textContent = xml;

        showStatus('#xml-conversion-status', `Conversion successful! ${profile.mappings.length} mapping rules applied.`, 'success');
        completeStep($('#xml-step-convert'));
        activateStep($('#xml-step-preview'));
        $('#xml-btn-download').disabled = false;

    } catch (err) {
        showStatus('#xml-conversion-status', `Conversion error: ${err.message}`, 'error');
    }
});

$('#xml-btn-download')?.addEventListener('click', () => {
    if (!xmlGeneratedDcc) return;
    const certId = xmlConvertedData?.coreData?.uniqueIdentifier || 'dcc-export';
    downloadFile(xmlGeneratedDcc, 'application/xml', certId.replace(/[^a-zA-Z0-9_-]/g, '_') + '.xml');
});

// ============================================================
// TRAIN MODE - API Key
// ============================================================

$('#train-btn-save-key')?.addEventListener('click', () => {
    const key = $('#train-api-key-input').value.trim();
    if (!validateApiKey(key)) {
        $('#train-api-key-status').textContent = 'Invalid API key. Must start with "sk-ant-".';
        $('#train-api-key-status').className = 'status-text error';
        return;
    }
    apiKey = key;
    $('#train-api-key-status').textContent = 'API key saved (session only).';
    $('#train-api-key-status').className = 'status-text success';
    completeStep($('#train-step-apikey'));
    activateStep($('#train-step-upload'));
});

$('#train-api-key-input')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') $('#train-btn-save-key').click();
});

// ============================================================
// TRAIN MODE - File Uploads
// ============================================================

function setupTrainDropZone(dropId, inputId, infoId, nameId, removeClass, onLoad) {
    const drop = $(dropId);
    const input = $(inputId);
    const info = $(infoId);
    const nameEl = $(nameId);

    drop?.addEventListener('click', () => input?.click());

    drop?.addEventListener('dragover', (e) => {
        e.preventDefault();
        drop.classList.add('drag-over');
    });

    drop?.addEventListener('dragleave', () => {
        drop.classList.remove('drag-over');
    });

    drop?.addEventListener('drop', (e) => {
        e.preventDefault();
        drop.classList.remove('drag-over');
        loadTrainFile(e.dataTransfer.files[0], drop, info, nameEl, onLoad);
    });

    input?.addEventListener('change', (e) => {
        loadTrainFile(e.target.files[0], drop, info, nameEl, onLoad);
    });

    const removeBtn = $(`.${removeClass}`);
    removeBtn?.addEventListener('click', () => {
        onLoad(null, '');
        info?.classList.add('hidden');
        drop.style.display = '';
        if (input) input.value = '';
        updateTrainButton();
    });
}

function loadTrainFile(file, drop, info, nameEl, onLoad) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        onLoad(file, e.target.result);
        nameEl.textContent = file.name;
        info?.classList.remove('hidden');
        drop.style.display = 'none';
        updateTrainButton();
    };
    reader.readAsText(file);
}

setupTrainDropZone('#train-xsd-drop', '#train-xsd-input', '#train-xsd-info', '#train-xsd-name', 'train-btn-remove-xsd',
    (file, content) => { trainXsdFile = file; trainXsdContent = content; }
);

setupTrainDropZone('#train-xml-drop', '#train-xml-input', '#train-xml-info', '#train-xml-name', 'train-btn-remove-xml',
    (file, content) => { trainXmlFile = file; trainXmlContent = content; }
);

function updateTrainButton() {
    const btn = $('#train-btn-train');
    const name = $('#train-profile-name')?.value?.trim();
    if (btn) btn.disabled = !(trainXsdContent && trainXmlContent && name && apiKey);
    if (trainXsdContent && trainXmlContent) {
        activateStep($('#train-step-train'));
    }
}

$('#train-profile-name')?.addEventListener('input', updateTrainButton);

// ============================================================
// TRAIN MODE - Training
// ============================================================

$('#train-btn-train')?.addEventListener('click', async () => {
    if (!trainXsdContent || !trainXmlContent || !apiKey) return;

    const profileName = $('#train-profile-name').value.trim() || 'Unnamed Profile';

    $('#train-btn-train').disabled = true;
    $('#train-progress').classList.remove('hidden');
    setTrainProgress(20, 'Sending schema and sample to Claude API...');

    try {
        trainedProfile = await trainMappingProfile(apiKey, trainXsdContent, trainXmlContent, profileName, (pct, msg) => {
            setTrainProgress(pct, msg);
        });

        setTrainProgress(100, 'Mapping profile generated successfully!');

        // Show summary
        $('#train-profile-summary').classList.remove('hidden');
        $('#train-result-name').textContent = trainedProfile.name || profileName;
        $('#train-result-ns').textContent = trainedProfile.schemaNamespace || 'N/A';
        $('#train-result-root').textContent = trainedProfile.rootElement || 'N/A';
        $('#train-result-count').textContent = trainedProfile.mappings?.length || 0;
        $('#train-result-total').textContent = trainedProfile._totalRules || trainedProfile.mappings?.length || 0;

        // Show JSON preview
        const previewCode = $('#train-profile-preview code');
        if (previewCode) previewCode.textContent = JSON.stringify(trainedProfile, null, 2);

        // Initialize visual editor
        const editorContainer = $('#train-mapping-editor');
        if (editorContainer) {
            trainEditor = new MappingEditor(editorContainer);
            trainEditor.onChange = (updatedProfile) => {
                trainedProfile = { ...trainedProfile, mappings: updatedProfile.mappings };
                // Sync JSON preview
                const code = $('#train-profile-preview code');
                if (code) code.textContent = JSON.stringify(trainedProfile, null, 2);
                // Update counts
                $('#train-result-count').textContent = trainedProfile.mappings?.length || 0;
                const total = countAllRulesRecursive(trainedProfile.mappings);
                $('#train-result-total').textContent = total;
            };
            trainEditor.init(trainedProfile, trainXmlContent);
        }

        completeStep($('#train-step-train'));
        activateStep($('#train-step-review'));
        $('#train-btn-save').disabled = false;
        $('#train-btn-export').disabled = false;

    } catch (err) {
        setTrainProgress(0, `Error: ${err.message}`);
        $('#train-progress-text').classList.add('error');
        $('#train-btn-train').disabled = false;
    }
});

function setTrainProgress(pct, text) {
    $('#train-progress-fill').style.width = `${pct}%`;
    if (text) {
        $('#train-progress-text').textContent = text;
        $('#train-progress-text').className = 'progress-text';
    }
}

// ============================================================
// TRAIN MODE - Save & Export
// ============================================================

$('#train-btn-save')?.addEventListener('click', () => {
    if (!trainedProfile) return;

    const saved = saveProfile(trainedProfile);
    trainedProfile = saved;

    $('#train-save-status').textContent = `Profile "${saved.name}" saved successfully!`;
    $('#train-save-status').className = 'status-text success';

    refreshTrainProfilesList();
});

$('#train-btn-export')?.addEventListener('click', () => {
    if (!trainedProfile) return;
    exportProfile(trainedProfile);
});

function refreshTrainProfilesList() {
    const container = $('#train-profiles-list');
    if (!container) return;

    const profiles = getAllProfiles();
    container.innerHTML = '';

    if (profiles.length === 0) {
        container.innerHTML = '<p class="placeholder-text">No mapping profiles saved yet.</p>';
        return;
    }

    const table = createTable(['Name', 'Namespace', 'Mappings', 'Created', 'Actions']);
    const tbody = table.querySelector('tbody');

    for (const p of profiles) {
        const tr = document.createElement('tr');

        const tdName = document.createElement('td');
        tdName.textContent = p.name || p.id;
        tdName.style.fontWeight = '500';
        tr.appendChild(tdName);

        const tdNs = document.createElement('td');
        tdNs.textContent = p.schemaNamespace ? truncate(p.schemaNamespace, 30) : 'N/A';
        tdNs.style.fontSize = '0.8rem';
        tr.appendChild(tdNs);

        const tdCount = document.createElement('td');
        tdCount.textContent = p.mappings?.length || 0;
        tr.appendChild(tdCount);

        const tdDate = document.createElement('td');
        tdDate.textContent = p.createdAt ? new Date(p.createdAt).toLocaleDateString() : '';
        tdDate.style.fontSize = '0.8rem';
        tr.appendChild(tdDate);

        const tdActions = document.createElement('td');
        const btnExport = document.createElement('button');
        btnExport.className = 'btn btn-small';
        btnExport.textContent = 'Export';
        btnExport.addEventListener('click', () => exportProfile(p));
        tdActions.appendChild(btnExport);

        const btnDel = document.createElement('button');
        btnDel.className = 'btn btn-small btn-danger-text';
        btnDel.textContent = 'Delete';
        btnDel.style.marginLeft = '0.25rem';
        btnDel.addEventListener('click', () => {
            if (!confirm(`Delete profile "${p.name}"?`)) return;
            deleteProfile(p.id);
            refreshTrainProfilesList();
        });
        tdActions.appendChild(btnDel);

        tr.appendChild(tdActions);
        tbody.appendChild(tr);
    }

    container.appendChild(table);
}

// ============================================================
// Tab Switching (works for all modes)
// ============================================================

document.addEventListener('click', (e) => {
    const tab = e.target.closest('.tab');
    if (!tab) return;

    const tabId = tab.dataset.tab;
    if (!tabId) return;

    const tabsContainer = tab.closest('.tabs');
    const contentParent = tabsContainer?.parentElement;
    if (!tabsContainer || !contentParent) return;

    // Update active tab button within this tab group
    for (const t of tabsContainer.querySelectorAll('.tab')) t.classList.remove('active');
    tab.classList.add('active');

    // Update active tab content within this parent
    for (const tc of contentParent.querySelectorAll(':scope > .tab-content')) tc.classList.remove('active');
    const target = document.getElementById(tabId);
    if (target) target.classList.add('active');

    // Auto-refresh XML preview
    if (tabId === 'pdf-tab-xml' && extractedData) updateXmlPreview();
});

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

// ============================================================
// Utility Functions
// ============================================================

function activateStep(step) {
    if (step) step.classList.add('active');
}

function completeStep(step) {
    if (step) step.classList.add('completed');
}

function createTable(headers) {
    const table = document.createElement('table');
    table.className = 'results-table';
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    for (const h of headers) {
        const th = document.createElement('th');
        th.textContent = h;
        headerRow.appendChild(th);
    }
    thead.appendChild(headerRow);
    table.appendChild(thead);
    const tbody = document.createElement('tbody');
    table.appendChild(tbody);
    return table;
}

function appendRow(tbody, values) {
    const tr = document.createElement('tr');
    for (const val of values) {
        const td = document.createElement('td');
        td.textContent = val;
        tr.appendChild(td);
    }
    tbody.appendChild(tr);
}

function formatValue(value, unit) {
    if (value == null) return '';
    return unit ? `${value} ${unit}` : `${value}`;
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function truncate(str, maxLen) {
    if (!str || str.length <= maxLen) return str;
    return str.substring(0, maxLen) + '...';
}

function downloadFile(content, mimeType, filename) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function showStatus(selector, text, type) {
    const el = $(selector);
    if (!el) return;
    el.textContent = text;
    el.className = `status-text ${type}`;
    el.classList.remove('hidden');
}

function showValidationMessages(container, messages, type) {
    if (!container) return;
    container.innerHTML = '';
    container.className = `validation-messages ${type}`;
    container.classList.remove('hidden');

    const title = document.createElement('strong');
    title.textContent = type === 'warnings' ? 'Warnings:' : 'Errors:';
    container.appendChild(title);

    const ul = document.createElement('ul');
    for (const msg of messages) {
        const li = document.createElement('li');
        li.textContent = msg;
        ul.appendChild(li);
    }
    container.appendChild(ul);
}

// ============================================================
// Helpers: Recursive rule counter
// ============================================================

function countAllRulesRecursive(mappings) {
    let count = 0;
    for (const m of (mappings || [])) {
        count++;
        if (m.fields) count += countAllRulesRecursive(m.fields);
    }
    return count;
}

// ============================================================
// Init
// ============================================================

refreshXmlProfileSelect();
refreshTrainProfilesList();
