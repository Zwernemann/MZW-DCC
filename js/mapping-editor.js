/**
 * Mapping Editor — Interactive visual editor for DCC mapping profiles.
 *
 * Features:
 *  - Table of all current mappings with inline editing
 *  - Coverage stats (mapped vs available DCC target fields)
 *  - Source XML tree explorer (parsed from sample XML)
 *  - Drag source paths onto unmapped target fields
 *  - Add / edit / delete mapping rules
 *  - Toggle between visual editor and raw JSON view
 */

import { parseXmlToTree, flattenXmlPaths } from './mapping-engine.js';

// ============================================================
// DCC-JSON target schema — every possible field
// ============================================================

const DCC_SCALAR_TARGETS = [
    // Core Data
    { path: 'coreData.uniqueIdentifier', label: 'Certificate Number', category: 'Core Data', required: true },
    { path: 'coreData.calibrationMark', label: 'Calibration Mark', category: 'Core Data' },
    { path: 'coreData.orderNumber', label: 'Order Number', category: 'Core Data' },
    { path: 'coreData.beginPerformanceDate', label: 'Begin Performance Date', category: 'Core Data' },
    { path: 'coreData.endPerformanceDate', label: 'End Performance Date', category: 'Core Data' },
    { path: 'coreData.performanceLocation', label: 'Performance Location', category: 'Core Data' },
    { path: 'coreData.languageCode', label: 'Language Code', category: 'Core Data' },
    { path: 'coreData.countryCodeISO3166_1', label: 'Country Code', category: 'Core Data' },
    { path: 'coreData.previousReport', label: 'Previous Report', category: 'Core Data' },
    // Lab
    { path: 'calibrationLaboratory.name', label: 'Lab Name', category: 'Laboratory', required: true },
    { path: 'calibrationLaboratory.calibrationLaboratoryCode', label: 'Accreditation Code', category: 'Laboratory' },
    { path: 'calibrationLaboratory.street', label: 'Lab Street', category: 'Laboratory' },
    { path: 'calibrationLaboratory.postCode', label: 'Lab Post Code', category: 'Laboratory' },
    { path: 'calibrationLaboratory.city', label: 'Lab City', category: 'Laboratory' },
    { path: 'calibrationLaboratory.country', label: 'Lab Country', category: 'Laboratory' },
    { path: 'calibrationLaboratory.eMail', label: 'Lab E-Mail', category: 'Laboratory' },
    { path: 'calibrationLaboratory.phone', label: 'Lab Phone', category: 'Laboratory' },
    { path: 'calibrationLaboratory.fax', label: 'Lab Fax', category: 'Laboratory' },
    { path: 'calibrationLaboratory.website', label: 'Lab Website', category: 'Laboratory' },
    // Customer
    { path: 'customer.name', label: 'Customer Name', category: 'Customer', required: true },
    { path: 'customer.street', label: 'Customer Street', category: 'Customer' },
    { path: 'customer.postCode', label: 'Customer Post Code', category: 'Customer' },
    { path: 'customer.city', label: 'Customer City', category: 'Customer' },
    { path: 'customer.country', label: 'Customer Country', category: 'Customer' },
    { path: 'customer.eMail', label: 'Customer E-Mail', category: 'Customer' },
    { path: 'customer.phone', label: 'Customer Phone', category: 'Customer' },
    { path: 'customer.contactPerson', label: 'Contact Person', category: 'Customer' },
    // Remarks
    { path: 'remarks', label: 'Remarks', category: 'Other' },
];

const DCC_ARRAY_TARGETS = [
    { path: 'respPersons[]', label: 'Responsible Persons', category: 'Persons' },
    { path: 'items[]', label: 'Calibration Items', category: 'Items' },
    { path: 'accessories[]', label: 'Accessories', category: 'Items' },
    { path: 'measurementResults[]', label: 'Measurement Results', category: 'Results' },
    { path: 'measuringEquipments[]', label: 'Measuring Equipment', category: 'Equipment' },
    { path: 'calibrationSOPs[]', label: 'Calibration SOPs', category: 'Procedures' },
    { path: 'statements[]', label: 'Conformity Statements', category: 'Statements' },
];

const MAPPING_TYPES = [
    'string', 'number', 'integer', 'boolean', 'date',
    'array', 'asFoundAsLeft', 'conformity',
    'concat', 'static', 'template', 'lookup', 'firstOf',
];

// ============================================================
// MappingEditor class
// ============================================================

export class MappingEditor {
    /**
     * @param {HTMLElement} container - DOM element to render into
     */
    constructor(container) {
        this.container = container;
        this.profile = null;
        this.sourceTree = null;
        this.sourcePaths = [];
        this.onChange = null; // callback when profile changes
        this._dragSourcePath = null;
    }

    /**
     * Initialize the editor with a profile and optional sample XML.
     */
    init(profile, xmlContent = null) {
        this.profile = JSON.parse(JSON.stringify(profile)); // deep copy
        if (xmlContent) {
            this.sourceTree = parseXmlToTree(xmlContent);
            this.sourcePaths = this.sourceTree ? flattenXmlPaths(this.sourceTree) : [];
        }
        this.render();
    }

    getProfile() {
        return this.profile;
    }

    // ============================================================
    // Render
    // ============================================================

    render() {
        this.container.innerHTML = '';

        // Stats bar
        this.renderStats();

        // Mapping table
        this.renderMappingTable();

        // Unmapped DCC targets
        this.renderUnmappedTargets();

        // Source XML explorer
        if (this.sourceTree) {
            this.renderSourceExplorer();
        }
    }

    // ============================================================
    // Stats bar
    // ============================================================

    renderStats() {
        const totalRules = this.countAllRules(this.profile.mappings);
        const mappedScalar = this.getMappedScalarPaths();
        const mappedArray = this.getMappedArrayPaths();
        const totalTargets = DCC_SCALAR_TARGETS.length + DCC_ARRAY_TARGETS.length;
        const mappedTargets = mappedScalar.size + mappedArray.size;
        const pct = totalTargets > 0 ? Math.round((mappedTargets / totalTargets) * 100) : 0;

        const bar = document.createElement('div');
        bar.className = 'me-stats-bar';
        bar.innerHTML = `
            <div class="me-stats-text">
                <strong>${totalRules}</strong> mapping rules &middot;
                <strong>${mappedTargets}/${totalTargets}</strong> DCC fields covered (${pct}%)
            </div>
            <div class="me-stats-progress">
                <div class="me-stats-fill" style="width: ${pct}%"></div>
            </div>
        `;
        this.container.appendChild(bar);
    }

    // ============================================================
    // Mapping table
    // ============================================================

    renderMappingTable() {
        const section = document.createElement('div');
        section.className = 'me-section';

        const header = document.createElement('div');
        header.className = 'me-section-header';
        header.innerHTML = `<h3>Mapping Rules (${this.profile.mappings.length} top-level)</h3>`;

        const addBtn = document.createElement('button');
        addBtn.className = 'btn btn-small btn-primary';
        addBtn.textContent = '+ Add Rule';
        addBtn.addEventListener('click', () => this.showAddRuleDialog());
        header.appendChild(addBtn);

        section.appendChild(header);

        if (this.profile.mappings.length === 0) {
            section.innerHTML += '<p class="placeholder-text">No mapping rules defined yet.</p>';
        } else {
            const table = document.createElement('table');
            table.className = 'me-table';
            table.innerHTML = `<thead><tr>
                <th>DCC Target</th>
                <th>Source Path</th>
                <th>Type</th>
                <th>Details</th>
                <th></th>
            </tr></thead>`;
            const tbody = document.createElement('tbody');

            for (let i = 0; i < this.profile.mappings.length; i++) {
                this.renderMappingRow(tbody, this.profile.mappings[i], i);
            }

            table.appendChild(tbody);
            section.appendChild(table);
        }

        this.container.appendChild(section);
    }

    renderMappingRow(tbody, rule, idx) {
        const tr = document.createElement('tr');
        if (rule.type === 'array') tr.classList.add('me-row-array');

        // Target
        const tdTarget = document.createElement('td');
        tdTarget.className = 'me-cell-target';
        const targetInput = document.createElement('input');
        targetInput.type = 'text';
        targetInput.value = rule.target;
        targetInput.className = 'me-inline-input';
        targetInput.addEventListener('change', () => {
            rule.target = targetInput.value;
            this.emitChange();
        });
        tdTarget.appendChild(targetInput);
        tr.appendChild(tdTarget);

        // Source
        const tdSource = document.createElement('td');
        tdSource.className = 'me-cell-source';
        if (rule.type === 'concat' || rule.type === 'firstOf') {
            const txt = (rule.sources || []).join(', ');
            const sourceInput = document.createElement('input');
            sourceInput.type = 'text';
            sourceInput.value = txt;
            sourceInput.className = 'me-inline-input';
            sourceInput.title = 'Comma-separated source paths';
            sourceInput.addEventListener('change', () => {
                rule.sources = sourceInput.value.split(',').map(s => s.trim()).filter(Boolean);
                this.emitChange();
            });
            tdSource.appendChild(sourceInput);
        } else if (rule.type === 'static') {
            const valInput = document.createElement('input');
            valInput.type = 'text';
            valInput.value = rule.value || '';
            valInput.className = 'me-inline-input me-static';
            valInput.placeholder = 'static value';
            valInput.addEventListener('change', () => {
                rule.value = valInput.value;
                this.emitChange();
            });
            tdSource.appendChild(valInput);
        } else {
            const sourceInput = document.createElement('input');
            sourceInput.type = 'text';
            sourceInput.value = rule.source || '';
            sourceInput.className = 'me-inline-input';
            sourceInput.addEventListener('change', () => {
                rule.source = sourceInput.value;
                this.emitChange();
            });
            // Drop target
            sourceInput.addEventListener('dragover', (e) => {
                e.preventDefault();
                sourceInput.classList.add('me-drop-active');
            });
            sourceInput.addEventListener('dragleave', () => {
                sourceInput.classList.remove('me-drop-active');
            });
            sourceInput.addEventListener('drop', (e) => {
                e.preventDefault();
                sourceInput.classList.remove('me-drop-active');
                const path = e.dataTransfer.getData('text/plain');
                if (path) {
                    sourceInput.value = path;
                    rule.source = path;
                    this.emitChange();
                }
            });
            tdSource.appendChild(sourceInput);
        }
        tr.appendChild(tdSource);

        // Type
        const tdType = document.createElement('td');
        const typeSelect = document.createElement('select');
        typeSelect.className = 'me-type-select';
        for (const t of MAPPING_TYPES) {
            const opt = document.createElement('option');
            opt.value = t;
            opt.textContent = t;
            if (t === rule.type) opt.selected = true;
            typeSelect.appendChild(opt);
        }
        typeSelect.addEventListener('change', () => {
            rule.type = typeSelect.value;
            this.emitChange();
            this.render(); // re-render for type-specific UI
        });
        tdType.appendChild(typeSelect);
        tr.appendChild(tdType);

        // Details
        const tdDetails = document.createElement('td');
        tdDetails.className = 'me-cell-details';
        if (rule.type === 'array' && rule.fields) {
            const badge = document.createElement('span');
            badge.className = 'badge badge-info';
            badge.textContent = `${rule.fields.length} fields`;
            badge.style.cursor = 'pointer';
            badge.title = 'Click to expand/collapse nested fields';
            tdDetails.appendChild(badge);
        } else if (rule.type === 'template') {
            const tmplInput = document.createElement('input');
            tmplInput.type = 'text';
            tmplInput.value = rule.template || '';
            tmplInput.className = 'me-inline-input';
            tmplInput.placeholder = '{0} {1}';
            tmplInput.addEventListener('change', () => {
                rule.template = tmplInput.value;
                this.emitChange();
            });
            tdDetails.appendChild(tmplInput);
        } else if (rule.type === 'concat') {
            const sepInput = document.createElement('input');
            sepInput.type = 'text';
            sepInput.value = rule.separator ?? ' ';
            sepInput.className = 'me-inline-input me-sep';
            sepInput.placeholder = 'separator';
            sepInput.style.width = '60px';
            sepInput.addEventListener('change', () => {
                rule.separator = sepInput.value;
                this.emitChange();
            });
            tdDetails.appendChild(document.createTextNode('sep: '));
            tdDetails.appendChild(sepInput);
        } else if (rule.type === 'lookup' && rule.map) {
            const txt = Object.entries(rule.map).map(([k, v]) => `${k}→${v}`).join(', ');
            const span = document.createElement('span');
            span.className = 'text-muted text-xsmall';
            span.textContent = txt.length > 40 ? txt.substring(0, 37) + '...' : txt;
            span.title = txt;
            tdDetails.appendChild(span);
        }
        tr.appendChild(tdDetails);

        // Actions
        const tdActions = document.createElement('td');
        tdActions.className = 'me-cell-actions';

        if (rule.type === 'array') {
            const editBtn = document.createElement('button');
            editBtn.className = 'btn btn-small';
            editBtn.textContent = 'Edit Fields';
            editBtn.addEventListener('click', () => this.showArrayFieldsEditor(rule, idx));
            tdActions.appendChild(editBtn);
        }

        const delBtn = document.createElement('button');
        delBtn.className = 'btn btn-small btn-danger-text';
        delBtn.textContent = 'Del';
        delBtn.addEventListener('click', () => {
            if (confirm(`Delete mapping for "${rule.target}"?`)) {
                this.profile.mappings.splice(idx, 1);
                this.emitChange();
                this.render();
            }
        });
        tdActions.appendChild(delBtn);
        tr.appendChild(tdActions);

        tbody.appendChild(tr);

        // Expand nested array fields inline
        if (rule.type === 'array' && rule.fields && rule.fields.length > 0) {
            const nestedTr = document.createElement('tr');
            nestedTr.className = 'me-row-nested';
            const nestedTd = document.createElement('td');
            nestedTd.colSpan = 5;
            nestedTd.className = 'me-nested-container';

            const details = document.createElement('details');
            const summary = document.createElement('summary');
            summary.textContent = `${rule.fields.length} nested fields in ${rule.target}`;
            details.appendChild(summary);

            const subTable = document.createElement('table');
            subTable.className = 'me-table me-table-nested';
            subTable.innerHTML = `<thead><tr>
                <th>Field Target</th><th>Source</th><th>Type</th><th>Sub-fields</th><th></th>
            </tr></thead>`;
            const subTbody = document.createElement('tbody');

            for (let fi = 0; fi < rule.fields.length; fi++) {
                this.renderFieldRow(subTbody, rule.fields, fi, rule);
            }

            subTable.appendChild(subTbody);
            details.appendChild(subTable);

            // Add field button
            const addFieldBtn = document.createElement('button');
            addFieldBtn.className = 'btn btn-small';
            addFieldBtn.textContent = '+ Add Field';
            addFieldBtn.style.marginTop = '0.5rem';
            addFieldBtn.addEventListener('click', () => {
                rule.fields.push({ target: '', source: '', type: 'string' });
                this.emitChange();
                this.render();
            });
            details.appendChild(addFieldBtn);

            nestedTd.appendChild(details);
            nestedTr.appendChild(nestedTd);
            tbody.appendChild(nestedTr);
        }
    }

    renderFieldRow(tbody, fieldsArray, idx, parentRule) {
        const field = fieldsArray[idx];
        const tr = document.createElement('tr');
        if (field.type === 'array') tr.classList.add('me-row-array');

        // Target
        const tdTarget = document.createElement('td');
        const targetInput = document.createElement('input');
        targetInput.type = 'text';
        targetInput.value = field.target;
        targetInput.className = 'me-inline-input';
        targetInput.addEventListener('change', () => {
            field.target = targetInput.value;
            this.emitChange();
        });
        tdTarget.appendChild(targetInput);
        tr.appendChild(tdTarget);

        // Source
        const tdSource = document.createElement('td');
        if (field.type === 'static') {
            const valInput = document.createElement('input');
            valInput.type = 'text';
            valInput.value = field.value || '';
            valInput.className = 'me-inline-input me-static';
            valInput.addEventListener('change', () => {
                field.value = valInput.value;
                this.emitChange();
            });
            tdSource.appendChild(valInput);
        } else if (field.type === 'concat' || field.type === 'firstOf') {
            const srcInput = document.createElement('input');
            srcInput.type = 'text';
            srcInput.value = (field.sources || []).join(', ');
            srcInput.className = 'me-inline-input';
            srcInput.addEventListener('change', () => {
                field.sources = srcInput.value.split(',').map(s => s.trim()).filter(Boolean);
                this.emitChange();
            });
            tdSource.appendChild(srcInput);
        } else {
            const sourceInput = document.createElement('input');
            sourceInput.type = 'text';
            sourceInput.value = field.source || '';
            sourceInput.className = 'me-inline-input';
            sourceInput.addEventListener('change', () => {
                field.source = sourceInput.value;
                this.emitChange();
            });
            // Drop target
            sourceInput.addEventListener('dragover', (e) => {
                e.preventDefault();
                sourceInput.classList.add('me-drop-active');
            });
            sourceInput.addEventListener('dragleave', () => {
                sourceInput.classList.remove('me-drop-active');
            });
            sourceInput.addEventListener('drop', (e) => {
                e.preventDefault();
                sourceInput.classList.remove('me-drop-active');
                const path = e.dataTransfer.getData('text/plain');
                if (path) {
                    sourceInput.value = path;
                    field.source = path;
                    this.emitChange();
                }
            });
            tdSource.appendChild(sourceInput);
        }
        tr.appendChild(tdSource);

        // Type
        const tdType = document.createElement('td');
        const typeSelect = document.createElement('select');
        typeSelect.className = 'me-type-select';
        for (const t of MAPPING_TYPES) {
            const opt = document.createElement('option');
            opt.value = t;
            opt.textContent = t;
            if (t === field.type) opt.selected = true;
            typeSelect.appendChild(opt);
        }
        typeSelect.addEventListener('change', () => {
            field.type = typeSelect.value;
            if (field.type === 'array' && !field.fields) field.fields = [];
            this.emitChange();
            this.render();
        });
        tdType.appendChild(typeSelect);
        tr.appendChild(tdType);

        // Sub-fields info
        const tdSub = document.createElement('td');
        if (field.type === 'array' && field.fields) {
            tdSub.textContent = `${field.fields.length} sub-fields`;
        }
        tr.appendChild(tdSub);

        // Actions
        const tdActions = document.createElement('td');
        const delBtn = document.createElement('button');
        delBtn.className = 'btn btn-small btn-danger-text';
        delBtn.textContent = 'Del';
        delBtn.addEventListener('click', () => {
            fieldsArray.splice(idx, 1);
            this.emitChange();
            this.render();
        });
        tdActions.appendChild(delBtn);
        tr.appendChild(tdActions);

        tbody.appendChild(tr);
    }

    // ============================================================
    // Unmapped DCC targets
    // ============================================================

    renderUnmappedTargets() {
        const mappedScalar = this.getMappedScalarPaths();
        const mappedArray = this.getMappedArrayPaths();

        const unmappedScalars = DCC_SCALAR_TARGETS.filter(t => !mappedScalar.has(t.path));
        const unmappedArrays = DCC_ARRAY_TARGETS.filter(t => !mappedArray.has(t.path));

        if (unmappedScalars.length === 0 && unmappedArrays.length === 0) return;

        const section = document.createElement('div');
        section.className = 'me-section';

        const details = document.createElement('details');
        details.className = 'me-details';
        const summary = document.createElement('summary');
        summary.innerHTML = `<h3>Unmapped DCC Fields (${unmappedScalars.length + unmappedArrays.length})</h3>`;
        details.appendChild(summary);

        const hint = document.createElement('p');
        hint.className = 'text-muted text-small';
        hint.textContent = 'Click a field to add a mapping rule for it. Drag a source path from the XML Explorer below onto the source input.';
        details.appendChild(hint);

        // Group by category
        const categories = new Map();
        for (const t of [...unmappedScalars, ...unmappedArrays]) {
            const cat = t.category || 'Other';
            if (!categories.has(cat)) categories.set(cat, []);
            categories.get(cat).push(t);
        }

        for (const [cat, targets] of categories) {
            const catDiv = document.createElement('div');
            catDiv.className = 'me-unmapped-category';

            const catTitle = document.createElement('h4');
            catTitle.textContent = cat;
            catDiv.appendChild(catTitle);

            const list = document.createElement('div');
            list.className = 'me-unmapped-list';

            for (const target of targets) {
                const chip = document.createElement('button');
                chip.className = 'me-unmapped-chip';
                if (target.required) chip.classList.add('me-required');
                chip.textContent = target.label || target.path;
                chip.title = target.path;

                // Drop target
                chip.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    chip.classList.add('me-drop-active');
                });
                chip.addEventListener('dragleave', () => {
                    chip.classList.remove('me-drop-active');
                });
                chip.addEventListener('drop', (e) => {
                    e.preventDefault();
                    chip.classList.remove('me-drop-active');
                    const sourcePath = e.dataTransfer.getData('text/plain');
                    if (sourcePath) {
                        const isArray = target.path.endsWith('[]');
                        this.profile.mappings.push({
                            target: target.path,
                            source: sourcePath,
                            type: isArray ? 'array' : 'string',
                            ...(isArray ? { fields: [] } : {}),
                        });
                        this.emitChange();
                        this.render();
                    }
                });

                chip.addEventListener('click', () => {
                    const isArray = target.path.endsWith('[]');
                    this.profile.mappings.push({
                        target: target.path,
                        source: '',
                        type: isArray ? 'array' : 'string',
                        ...(isArray ? { fields: [] } : {}),
                    });
                    this.emitChange();
                    this.render();
                });

                list.appendChild(chip);
            }

            catDiv.appendChild(list);
            details.appendChild(catDiv);
        }

        section.appendChild(details);
        this.container.appendChild(section);
    }

    // ============================================================
    // Source XML explorer
    // ============================================================

    renderSourceExplorer() {
        const section = document.createElement('div');
        section.className = 'me-section';

        const details = document.createElement('details');
        details.className = 'me-details';
        const summary = document.createElement('summary');
        summary.innerHTML = `<h3>Source XML Explorer (${this.sourcePaths.length} paths)</h3>`;
        details.appendChild(summary);

        const hint = document.createElement('p');
        hint.className = 'text-muted text-small';
        hint.textContent = 'Drag a path from here onto a source input in the mapping table above, or onto an unmapped DCC field.';
        details.appendChild(hint);

        const treeContainer = document.createElement('div');
        treeContainer.className = 'me-source-tree';
        this.renderTreeNode(treeContainer, this.sourceTree, 0);

        details.appendChild(treeContainer);
        section.appendChild(details);
        this.container.appendChild(section);
    }

    renderTreeNode(container, node, depth) {
        const row = document.createElement('div');
        row.className = 'me-tree-row';
        row.style.paddingLeft = `${depth * 16}px`;

        // Expand/collapse toggle for nodes with children
        const hasChildren = node.children.length > 0;
        const toggle = document.createElement('span');
        toggle.className = 'me-tree-toggle';
        toggle.textContent = hasChildren ? '\u25B6' : '\u00A0\u00A0';
        row.appendChild(toggle);

        // Element name
        const nameSpan = document.createElement('span');
        nameSpan.className = 'me-tree-name';
        nameSpan.textContent = node.name;
        if (node.count > 1) {
            const countBadge = document.createElement('span');
            countBadge.className = 'me-tree-count';
            countBadge.textContent = `\u00D7${node.count}`;
            nameSpan.appendChild(countBadge);
        }
        row.appendChild(nameSpan);

        // Path (draggable)
        const pathSpan = document.createElement('span');
        pathSpan.className = 'me-tree-path';
        pathSpan.textContent = node.path;
        pathSpan.draggable = true;
        pathSpan.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', node.path);
            e.dataTransfer.effectAllowed = 'copy';
        });
        row.appendChild(pathSpan);

        // Value preview
        if (node.hasText && node.value) {
            const valSpan = document.createElement('span');
            valSpan.className = 'me-tree-value';
            valSpan.textContent = `= "${node.value}"`;
            row.appendChild(valSpan);
        }

        container.appendChild(row);

        // Attributes
        for (const attr of node.attributes) {
            const attrRow = document.createElement('div');
            attrRow.className = 'me-tree-row me-tree-attr';
            attrRow.style.paddingLeft = `${(depth + 1) * 16}px`;

            attrRow.innerHTML = '<span class="me-tree-toggle">\u00A0\u00A0</span>';

            const attrName = document.createElement('span');
            attrName.className = 'me-tree-name me-tree-attr-name';
            attrName.textContent = `@${attr.name}`;
            attrRow.appendChild(attrName);

            const attrPath = document.createElement('span');
            attrPath.className = 'me-tree-path';
            attrPath.textContent = attr.path;
            attrPath.draggable = true;
            attrPath.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', attr.path);
                e.dataTransfer.effectAllowed = 'copy';
            });
            attrRow.appendChild(attrPath);

            if (attr.value) {
                const attrVal = document.createElement('span');
                attrVal.className = 'me-tree-value';
                const displayVal = attr.value.length > 40 ? attr.value.substring(0, 37) + '...' : attr.value;
                attrVal.textContent = `= "${displayVal}"`;
                attrRow.appendChild(attrVal);
            }

            container.appendChild(attrRow);
        }

        // Child container (collapsible)
        if (hasChildren) {
            const childContainer = document.createElement('div');
            childContainer.className = 'me-tree-children';
            childContainer.style.display = 'none';

            for (const child of node.children) {
                this.renderTreeNode(childContainer, child, depth + 1);
            }

            container.appendChild(childContainer);

            // Toggle handler
            toggle.style.cursor = 'pointer';
            toggle.addEventListener('click', () => {
                const isOpen = childContainer.style.display !== 'none';
                childContainer.style.display = isOpen ? 'none' : 'block';
                toggle.textContent = isOpen ? '\u25B6' : '\u25BC';
            });
        }
    }

    // ============================================================
    // Dialogs
    // ============================================================

    showAddRuleDialog() {
        const target = prompt('Enter DCC target path (e.g., "coreData.orderNumber" or "items[]"):');
        if (!target) return;

        const isArray = target.endsWith('[]');
        this.profile.mappings.push({
            target: target,
            source: '',
            type: isArray ? 'array' : 'string',
            ...(isArray ? { fields: [] } : {}),
        });
        this.emitChange();
        this.render();
    }

    showArrayFieldsEditor(rule) {
        // Scroll to the nested fields section and open it
        const allDetails = this.container.querySelectorAll('.me-row-nested details');
        for (const d of allDetails) {
            const summary = d.querySelector('summary');
            if (summary && summary.textContent.includes(rule.target)) {
                d.open = true;
                d.scrollIntoView({ behavior: 'smooth', block: 'center' });
                break;
            }
        }
    }

    // ============================================================
    // Helpers
    // ============================================================

    getMappedScalarPaths() {
        const paths = new Set();
        for (const m of this.profile.mappings) {
            if (m.type !== 'array') {
                paths.add(m.target);
            }
        }
        return paths;
    }

    getMappedArrayPaths() {
        const paths = new Set();
        for (const m of this.profile.mappings) {
            if (m.type === 'array') {
                paths.add(m.target);
            }
        }
        return paths;
    }

    countAllRules(mappings) {
        let count = 0;
        for (const m of (mappings || [])) {
            count++;
            if (m.fields) {
                count += this.countAllRules(m.fields);
            }
        }
        return count;
    }

    emitChange() {
        if (this.onChange) this.onChange(this.profile);
    }
}
