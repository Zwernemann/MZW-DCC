/**
 * DCC v3.3.0 XML Generator
 * Generates a valid Digital Calibration Certificate XML document from structured data.
 *
 * Schema: https://ptb.de/dcc/v3.3.0/dcc.xsd
 * Namespace: https://ptb.de/dcc
 * SI Namespace: https://ptb.de/si
 */

const DCC_NS = 'https://ptb.de/dcc';
const SI_NS = 'https://ptb.de/si';
const DCC_SCHEMA_VERSION = '3.3.0';
const DCC_SCHEMA_LOCATION = 'https://ptb.de/dcc/v3.3.0/dcc.xsd';

/**
 * Generate DCC XML from structured calibration data.
 * @param {object} data - Structured calibration data (from Claude API)
 * @returns {{xml: string, warnings: string[]}}
 */
export function generateDccXml(data) {
    const warnings = [];
    const lines = [];

    const indent = (level) => '  '.repeat(level);

    function esc(str) {
        if (str == null) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    // Determine language
    const lang = data.coreData?.languageCode || 'de';
    const secondLang = lang === 'de' ? 'en' : 'de';
    const country = data.coreData?.countryCodeISO3166_1 || 'DE';

    // --- XML Declaration ---
    lines.push('<?xml version="1.0" encoding="UTF-8"?>');
    lines.push(`<dcc:digitalCalibrationCertificate`);
    lines.push(`  xmlns:dcc="${DCC_NS}"`);
    lines.push(`  xmlns:si="${SI_NS}"`);
    lines.push(`  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"`);
    lines.push(`  xsi:schemaLocation="${DCC_NS} ${DCC_SCHEMA_LOCATION}"`);
    lines.push(`  schemaVersion="${DCC_SCHEMA_VERSION}">`);

    // =====================
    // ADMINISTRATIVE DATA
    // =====================
    lines.push(`${indent(1)}<dcc:administrativeData>`);

    // --- dccSoftware ---
    lines.push(`${indent(2)}<dcc:dccSoftware>`);
    lines.push(`${indent(3)}<dcc:software>`);
    lines.push(`${indent(4)}<dcc:name>`);
    lines.push(`${indent(5)}<dcc:content lang="en">PDF-to-DCC Converter</dcc:content>`);
    lines.push(`${indent(4)}</dcc:name>`);
    lines.push(`${indent(4)}<dcc:release>1.0.0</dcc:release>`);
    lines.push(`${indent(4)}<dcc:type>application</dcc:type>`);
    lines.push(`${indent(3)}</dcc:software>`);
    lines.push(`${indent(2)}</dcc:dccSoftware>`);

    // --- coreData ---
    lines.push(`${indent(2)}<dcc:coreData>`);
    lines.push(`${indent(3)}<dcc:countryCodeISO3166_1>${esc(country)}</dcc:countryCodeISO3166_1>`);
    lines.push(`${indent(3)}<dcc:usedLangCodeISO639_1>${esc(lang)}</dcc:usedLangCodeISO639_1>`);
    lines.push(`${indent(3)}<dcc:mandatoryLangCodeISO639_1>${esc(lang)}</dcc:mandatoryLangCodeISO639_1>`);

    const uniqueId = data.coreData?.uniqueIdentifier;
    if (!uniqueId) warnings.push('Zertifikatsnummer (uniqueIdentifier) fehlt.');
    lines.push(`${indent(3)}<dcc:uniqueIdentifier>${esc(uniqueId || 'UNKNOWN')}</dcc:uniqueIdentifier>`);

    if (data.coreData?.calibrationMark) {
        lines.push(`${indent(3)}<dcc:identifications>`);
        lines.push(`${indent(4)}<dcc:identification>`);
        lines.push(`${indent(5)}<dcc:issuer>calibrationLaboratory</dcc:issuer>`);
        lines.push(`${indent(5)}<dcc:value>${esc(data.coreData.calibrationMark)}</dcc:value>`);
        lines.push(`${indent(5)}<dcc:name>`);
        lines.push(`${indent(6)}<dcc:content lang="de">Kalibrierzeichen</dcc:content>`);
        lines.push(`${indent(6)}<dcc:content lang="en">Calibration mark</dcc:content>`);
        lines.push(`${indent(5)}</dcc:name>`);
        lines.push(`${indent(4)}</dcc:identification>`);
        if (data.coreData?.orderNumber) {
            lines.push(`${indent(4)}<dcc:identification>`);
            lines.push(`${indent(5)}<dcc:issuer>customer</dcc:issuer>`);
            lines.push(`${indent(5)}<dcc:value>${esc(data.coreData.orderNumber)}</dcc:value>`);
            lines.push(`${indent(5)}<dcc:name>`);
            lines.push(`${indent(6)}<dcc:content lang="de">Auftragsnummer</dcc:content>`);
            lines.push(`${indent(6)}<dcc:content lang="en">Order number</dcc:content>`);
            lines.push(`${indent(5)}</dcc:name>`);
            lines.push(`${indent(4)}</dcc:identification>`);
        }
        lines.push(`${indent(3)}</dcc:identifications>`);
    } else if (data.coreData?.orderNumber) {
        lines.push(`${indent(3)}<dcc:identifications>`);
        lines.push(`${indent(4)}<dcc:identification>`);
        lines.push(`${indent(5)}<dcc:issuer>customer</dcc:issuer>`);
        lines.push(`${indent(5)}<dcc:value>${esc(data.coreData.orderNumber)}</dcc:value>`);
        lines.push(`${indent(5)}<dcc:name>`);
        lines.push(`${indent(6)}<dcc:content lang="de">Auftragsnummer</dcc:content>`);
        lines.push(`${indent(6)}<dcc:content lang="en">Order number</dcc:content>`);
        lines.push(`${indent(5)}</dcc:name>`);
        lines.push(`${indent(4)}</dcc:identification>`);
        lines.push(`${indent(3)}</dcc:identifications>`);
    }

    if (data.coreData?.previousReport) {
        lines.push(`${indent(3)}<dcc:previousReport>`);
        lines.push(`${indent(4)}<dcc:report>`);
        lines.push(`${indent(5)}<dcc:value>${esc(data.coreData.previousReport)}</dcc:value>`);
        lines.push(`${indent(4)}</dcc:report>`);
        lines.push(`${indent(3)}</dcc:previousReport>`);
    }

    const beginDate = data.coreData?.beginPerformanceDate;
    const endDate = data.coreData?.endPerformanceDate || beginDate;
    if (!beginDate) warnings.push('Kalibrierdatum (beginPerformanceDate) fehlt.');
    lines.push(`${indent(3)}<dcc:beginPerformanceDate>${esc(beginDate || '1970-01-01')}</dcc:beginPerformanceDate>`);
    lines.push(`${indent(3)}<dcc:endPerformanceDate>${esc(endDate || '1970-01-01')}</dcc:endPerformanceDate>`);

    const perfLocation = data.coreData?.performanceLocation || 'laboratory';
    lines.push(`${indent(3)}<dcc:performanceLocation>${esc(perfLocation)}</dcc:performanceLocation>`);

    lines.push(`${indent(2)}</dcc:coreData>`);

    // --- items ---
    lines.push(`${indent(2)}<dcc:items>`);
    const items = data.items || [{}];
    for (const item of items) {
        lines.push(`${indent(3)}<dcc:item>`);

        lines.push(`${indent(4)}<dcc:name>`);
        lines.push(`${indent(5)}<dcc:content lang="${esc(lang)}">${esc(item.name || 'Prüfling')}</dcc:content>`);
        lines.push(`${indent(4)}</dcc:name>`);

        if (item.manufacturer) {
            lines.push(`${indent(4)}<dcc:manufacturer>`);
            lines.push(`${indent(5)}<dcc:name>`);
            lines.push(`${indent(6)}<dcc:content lang="${esc(lang)}">${esc(item.manufacturer)}</dcc:content>`);
            lines.push(`${indent(5)}</dcc:name>`);
            lines.push(`${indent(4)}</dcc:manufacturer>`);
        }

        if (item.model) {
            lines.push(`${indent(4)}<dcc:model>${esc(item.model)}</dcc:model>`);
        }

        // identifications (required)
        lines.push(`${indent(4)}<dcc:identifications>`);

        if (item.serialNumber) {
            lines.push(`${indent(5)}<dcc:identification>`);
            lines.push(`${indent(6)}<dcc:issuer>manufacturer</dcc:issuer>`);
            lines.push(`${indent(6)}<dcc:value>${esc(item.serialNumber)}</dcc:value>`);
            lines.push(`${indent(6)}<dcc:name>`);
            lines.push(`${indent(7)}<dcc:content lang="de">Seriennummer</dcc:content>`);
            lines.push(`${indent(7)}<dcc:content lang="en">Serial number</dcc:content>`);
            lines.push(`${indent(6)}</dcc:name>`);
            lines.push(`${indent(5)}</dcc:identification>`);
        }

        if (item.inventoryNumber) {
            lines.push(`${indent(5)}<dcc:identification>`);
            lines.push(`${indent(6)}<dcc:issuer>customer</dcc:issuer>`);
            lines.push(`${indent(6)}<dcc:value>${esc(item.inventoryNumber)}</dcc:value>`);
            lines.push(`${indent(6)}<dcc:name>`);
            lines.push(`${indent(7)}<dcc:content lang="de">Inventarnummer</dcc:content>`);
            lines.push(`${indent(7)}<dcc:content lang="en">Inventory number</dcc:content>`);
            lines.push(`${indent(6)}</dcc:name>`);
            lines.push(`${indent(5)}</dcc:identification>`);
        }

        if (item.equipmentNumber) {
            lines.push(`${indent(5)}<dcc:identification>`);
            lines.push(`${indent(6)}<dcc:issuer>customer</dcc:issuer>`);
            lines.push(`${indent(6)}<dcc:value>${esc(item.equipmentNumber)}</dcc:value>`);
            lines.push(`${indent(6)}<dcc:name>`);
            lines.push(`${indent(7)}<dcc:content lang="de">Equipment-Nr.</dcc:content>`);
            lines.push(`${indent(7)}<dcc:content lang="en">Equipment number</dcc:content>`);
            lines.push(`${indent(6)}</dcc:name>`);
            lines.push(`${indent(5)}</dcc:identification>`);
        }

        if (item.testEquipmentNumber) {
            lines.push(`${indent(5)}<dcc:identification>`);
            lines.push(`${indent(6)}<dcc:issuer>calibrationLaboratory</dcc:issuer>`);
            lines.push(`${indent(6)}<dcc:value>${esc(item.testEquipmentNumber)}</dcc:value>`);
            lines.push(`${indent(6)}<dcc:name>`);
            lines.push(`${indent(7)}<dcc:content lang="de">Prüfmittel-Nr.</dcc:content>`);
            lines.push(`${indent(7)}<dcc:content lang="en">Test equipment number</dcc:content>`);
            lines.push(`${indent(6)}</dcc:name>`);
            lines.push(`${indent(5)}</dcc:identification>`);
        }

        if (item.tagNumber) {
            lines.push(`${indent(5)}<dcc:identification>`);
            lines.push(`${indent(6)}<dcc:issuer>customer</dcc:issuer>`);
            lines.push(`${indent(6)}<dcc:value>${esc(item.tagNumber)}</dcc:value>`);
            lines.push(`${indent(6)}<dcc:name>`);
            lines.push(`${indent(7)}<dcc:content lang="de">Tag-Nr.</dcc:content>`);
            lines.push(`${indent(7)}<dcc:content lang="en">Tag number</dcc:content>`);
            lines.push(`${indent(6)}</dcc:name>`);
            lines.push(`${indent(5)}</dcc:identification>`);
        }

        // Fallback identification if none given
        if (!item.serialNumber && !item.inventoryNumber && !item.equipmentNumber && !item.testEquipmentNumber && !item.tagNumber) {
            lines.push(`${indent(5)}<dcc:identification>`);
            lines.push(`${indent(6)}<dcc:issuer>other</dcc:issuer>`);
            lines.push(`${indent(6)}<dcc:value>N/A</dcc:value>`);
            lines.push(`${indent(6)}<dcc:name>`);
            lines.push(`${indent(7)}<dcc:content lang="${esc(lang)}">Kennung</dcc:content>`);
            lines.push(`${indent(6)}</dcc:name>`);
            lines.push(`${indent(5)}</dcc:identification>`);
            warnings.push('Keine Seriennummer oder Inventarnummer gefunden.');
        }

        lines.push(`${indent(4)}</dcc:identifications>`);

        // Build description with extra item details
        const descParts = [];
        if (item.description) descParts.push(item.description);
        if (item.parameter) descParts.push(`Messparameter: ${item.parameter}`);
        if (item.measuringRange) descParts.push(`Messbereich: ${item.measuringRange}`);
        if (item.signalOutput) descParts.push(`Signalausgang: ${item.signalOutput}`);
        if (item.calibrationRange) descParts.push(`Kalibrierbereich: ${item.calibrationRange}`);
        if (item.medium) descParts.push(`Medium: ${item.medium}`);
        if (item.mediumConditions && item.mediumConditions.length > 0) {
            const condStr = item.mediumConditions.map(c => `${c.name}: ${c.value}`).join(', ');
            descParts.push(`Mediumbedingungen: ${condStr}`);
        }
        if (item.calibrationFactorsAsFound && item.calibrationFactorsAsFound.length > 0) {
            const cfStr = item.calibrationFactorsAsFound.map(c => c.value).join(', ');
            descParts.push(`Kalibrierfaktoren (As Found): ${cfStr}`);
        }
        if (item.calibrationFactorsAsLeft && item.calibrationFactorsAsLeft.length > 0) {
            const cfStr = item.calibrationFactorsAsLeft.map(c => c.value).join(', ');
            descParts.push(`Kalibrierfaktoren (As Left): ${cfStr}`);
        }
        if (item.mpe) descParts.push(`MPE: ${item.mpe}`);

        if (descParts.length > 0) {
            lines.push(`${indent(4)}<dcc:description>`);
            lines.push(`${indent(5)}<dcc:content lang="${esc(lang)}">${esc(descParts.join('; '))}</dcc:content>`);
            lines.push(`${indent(4)}</dcc:description>`);
        }

        lines.push(`${indent(3)}</dcc:item>`);
    }

    // Add accessories as additional items
    const accessories = data.accessories || [];
    for (const acc of accessories) {
        lines.push(`${indent(3)}<dcc:item>`);
        lines.push(`${indent(4)}<dcc:name>`);
        lines.push(`${indent(5)}<dcc:content lang="${esc(lang)}">${esc(acc.description || acc.type || 'Zubehör')}</dcc:content>`);
        lines.push(`${indent(4)}</dcc:name>`);
        lines.push(`${indent(4)}<dcc:identifications>`);
        if (acc.serialNumber) {
            lines.push(`${indent(5)}<dcc:identification>`);
            lines.push(`${indent(6)}<dcc:issuer>manufacturer</dcc:issuer>`);
            lines.push(`${indent(6)}<dcc:value>${esc(acc.serialNumber)}</dcc:value>`);
            lines.push(`${indent(6)}<dcc:name>`);
            lines.push(`${indent(7)}<dcc:content lang="de">Seriennummer</dcc:content>`);
            lines.push(`${indent(7)}<dcc:content lang="en">Serial number</dcc:content>`);
            lines.push(`${indent(6)}</dcc:name>`);
            lines.push(`${indent(5)}</dcc:identification>`);
        } else {
            lines.push(`${indent(5)}<dcc:identification>`);
            lines.push(`${indent(6)}<dcc:issuer>other</dcc:issuer>`);
            lines.push(`${indent(6)}<dcc:value>${esc(acc.type || 'N/A')}</dcc:value>`);
            lines.push(`${indent(6)}<dcc:name>`);
            lines.push(`${indent(7)}<dcc:content lang="de">Typ</dcc:content>`);
            lines.push(`${indent(7)}<dcc:content lang="en">Type</dcc:content>`);
            lines.push(`${indent(6)}</dcc:name>`);
            lines.push(`${indent(5)}</dcc:identification>`);
        }
        lines.push(`${indent(4)}</dcc:identifications>`);
        if (acc.description && acc.type) {
            lines.push(`${indent(4)}<dcc:description>`);
            lines.push(`${indent(5)}<dcc:content lang="${esc(lang)}">Zubehör/Komponente: ${esc(acc.type)}</dcc:content>`);
            lines.push(`${indent(4)}</dcc:description>`);
        }
        lines.push(`${indent(3)}</dcc:item>`);
    }

    lines.push(`${indent(2)}</dcc:items>`);

    // --- calibrationLaboratory ---
    const lab = data.calibrationLaboratory || {};
    lines.push(`${indent(2)}<dcc:calibrationLaboratory>`);

    if (lab.calibrationLaboratoryCode) {
        lines.push(`${indent(3)}<dcc:calibrationLaboratoryCode>${esc(lab.calibrationLaboratoryCode)}</dcc:calibrationLaboratoryCode>`);
    }

    lines.push(`${indent(3)}<dcc:contact>`);
    lines.push(`${indent(4)}<dcc:name>`);
    lines.push(`${indent(5)}<dcc:content lang="${esc(lang)}">${esc(lab.name || 'Kalibrierlaboratorium')}</dcc:content>`);
    lines.push(`${indent(4)}</dcc:name>`);

    if (lab.eMail) {
        lines.push(`${indent(4)}<dcc:eMail>${esc(lab.eMail)}</dcc:eMail>`);
    }
    if (lab.phone) {
        lines.push(`${indent(4)}<dcc:phone>${esc(lab.phone)}</dcc:phone>`);
    }
    if (lab.fax) {
        lines.push(`${indent(4)}<dcc:fax>${esc(lab.fax)}</dcc:fax>`);
    }

    lines.push(`${indent(4)}<dcc:location>`);
    if (lab.street) lines.push(`${indent(5)}<dcc:street>${esc(lab.street)}</dcc:street>`);
    if (lab.postCode) lines.push(`${indent(5)}<dcc:postCode>${esc(lab.postCode)}</dcc:postCode>`);
    if (lab.city) lines.push(`${indent(5)}<dcc:city>${esc(lab.city)}</dcc:city>`);
    lines.push(`${indent(5)}<dcc:countryCode>${esc(lab.country || country)}</dcc:countryCode>`);
    lines.push(`${indent(4)}</dcc:location>`);

    lines.push(`${indent(3)}</dcc:contact>`);
    lines.push(`${indent(2)}</dcc:calibrationLaboratory>`);

    // --- respPersons ---
    lines.push(`${indent(2)}<dcc:respPersons>`);
    const persons = data.respPersons || [];
    if (persons.length === 0) {
        warnings.push('Keine verantwortliche Person gefunden.');
        lines.push(`${indent(3)}<dcc:respPerson>`);
        lines.push(`${indent(4)}<dcc:person>`);
        lines.push(`${indent(5)}<dcc:name>`);
        lines.push(`${indent(6)}<dcc:content lang="${esc(lang)}">Nicht angegeben</dcc:content>`);
        lines.push(`${indent(5)}</dcc:name>`);
        lines.push(`${indent(4)}</dcc:person>`);
        lines.push(`${indent(3)}</dcc:respPerson>`);
    } else {
        for (const person of persons) {
            lines.push(`${indent(3)}<dcc:respPerson>`);
            lines.push(`${indent(4)}<dcc:person>`);
            lines.push(`${indent(5)}<dcc:name>`);
            lines.push(`${indent(6)}<dcc:content lang="${esc(lang)}">${esc(person.name)}</dcc:content>`);
            lines.push(`${indent(5)}</dcc:name>`);
            lines.push(`${indent(4)}</dcc:person>`);
            if (person.role) {
                lines.push(`${indent(4)}<dcc:role>${esc(person.role)}</dcc:role>`);
            }
            if (person.isMainSigner) {
                lines.push(`${indent(4)}<dcc:mainSigner>true</dcc:mainSigner>`);
            }
            lines.push(`${indent(3)}</dcc:respPerson>`);
        }
    }
    lines.push(`${indent(2)}</dcc:respPersons>`);

    // --- customer ---
    const customer = data.customer || {};
    lines.push(`${indent(2)}<dcc:customer>`);
    lines.push(`${indent(3)}<dcc:name>`);
    lines.push(`${indent(4)}<dcc:content lang="${esc(lang)}">${esc(customer.name || 'Auftraggeber')}</dcc:content>`);
    lines.push(`${indent(3)}</dcc:name>`);
    if (customer.eMail) {
        lines.push(`${indent(3)}<dcc:eMail>${esc(customer.eMail)}</dcc:eMail>`);
    }
    if (customer.phone) {
        lines.push(`${indent(3)}<dcc:phone>${esc(customer.phone)}</dcc:phone>`);
    }
    lines.push(`${indent(3)}<dcc:location>`);
    if (customer.street) lines.push(`${indent(4)}<dcc:street>${esc(customer.street)}</dcc:street>`);
    if (customer.postCode) lines.push(`${indent(4)}<dcc:postCode>${esc(customer.postCode)}</dcc:postCode>`);
    if (customer.city) lines.push(`${indent(4)}<dcc:city>${esc(customer.city)}</dcc:city>`);
    lines.push(`${indent(4)}<dcc:countryCode>${esc(customer.country || country)}</dcc:countryCode>`);
    lines.push(`${indent(3)}</dcc:location>`);
    if (customer.contactPerson) {
        lines.push(`${indent(3)}<dcc:description>`);
        lines.push(`${indent(4)}<dcc:content lang="de">Ansprechpartner: ${esc(customer.contactPerson)}</dcc:content>`);
        lines.push(`${indent(4)}<dcc:content lang="en">Contact person: ${esc(customer.contactPerson)}</dcc:content>`);
        lines.push(`${indent(3)}</dcc:description>`);
    }
    lines.push(`${indent(2)}</dcc:customer>`);

    // --- statements ---
    const statements = data.statements || [];
    if (statements.length > 0 || data.remarks) {
        lines.push(`${indent(2)}<dcc:statements>`);
        for (const stmt of statements) {
            lines.push(`${indent(3)}<dcc:statement>`);
            if (stmt.name) {
                lines.push(`${indent(4)}<dcc:name>`);
                lines.push(`${indent(5)}<dcc:content lang="${esc(lang)}">${esc(stmt.name)}</dcc:content>`);
                lines.push(`${indent(4)}</dcc:name>`);
            }
            // Build rich description with all details
            const stmtDescParts = [];
            if (stmt.description) stmtDescParts.push(stmt.description);
            if (stmt.decisionRule) stmtDescParts.push(`Entscheidungsregel: ${stmt.decisionRule}`);
            if (stmt.conformityProbability) stmtDescParts.push(`Konformitätswahrscheinlichkeit: ${stmt.conformityProbability}`);
            if (stmt.norm) stmtDescParts.push(`Norm: ${stmt.norm}`);
            if (stmtDescParts.length > 0) {
                lines.push(`${indent(4)}<dcc:description>`);
                lines.push(`${indent(5)}<dcc:content lang="${esc(lang)}">${esc(stmtDescParts.join('\n'))}</dcc:content>`);
                lines.push(`${indent(4)}</dcc:description>`);
            }
            if (stmt.conformity) {
                lines.push(`${indent(4)}<dcc:conformity>${esc(stmt.conformity)}</dcc:conformity>`);
            }
            lines.push(`${indent(3)}</dcc:statement>`);
        }
        // Remarks as statement
        if (data.remarks) {
            lines.push(`${indent(3)}<dcc:statement>`);
            lines.push(`${indent(4)}<dcc:name>`);
            lines.push(`${indent(5)}<dcc:content lang="de">Bemerkungen</dcc:content>`);
            lines.push(`${indent(5)}<dcc:content lang="en">Remarks</dcc:content>`);
            lines.push(`${indent(4)}</dcc:name>`);
            lines.push(`${indent(4)}<dcc:description>`);
            lines.push(`${indent(5)}<dcc:content lang="${esc(lang)}">${esc(data.remarks)}</dcc:content>`);
            lines.push(`${indent(4)}</dcc:description>`);
            lines.push(`${indent(3)}</dcc:statement>`);
        }
        lines.push(`${indent(2)}</dcc:statements>`);
    }

    lines.push(`${indent(1)}</dcc:administrativeData>`);

    // =====================
    // MEASUREMENT RESULTS
    // =====================
    lines.push(`${indent(1)}<dcc:measurementResults>`);

    // --- measuringEquipments ---
    const equipments = data.measuringEquipments || [];
    if (equipments.length > 0) {
        lines.push(`${indent(2)}<dcc:measuringEquipments>`);
        for (const equip of equipments) {
            lines.push(`${indent(3)}<dcc:measuringEquipment>`);
            lines.push(`${indent(4)}<dcc:name>`);
            lines.push(`${indent(5)}<dcc:content lang="${esc(lang)}">${esc(equip.name)}</dcc:content>`);
            lines.push(`${indent(4)}</dcc:name>`);
            if (equip.manufacturer) {
                lines.push(`${indent(4)}<dcc:manufacturer>`);
                lines.push(`${indent(5)}<dcc:name>`);
                lines.push(`${indent(6)}<dcc:content lang="${esc(lang)}">${esc(equip.manufacturer)}</dcc:content>`);
                lines.push(`${indent(5)}</dcc:name>`);
                lines.push(`${indent(4)}</dcc:manufacturer>`);
            }
            if (equip.model) {
                lines.push(`${indent(4)}<dcc:model>${esc(equip.model)}</dcc:model>`);
            }
            // Identifications for equipment
            const hasEquipId = equip.serialNumber || equip.certificateNumber || equip.equipmentNumber || equip.calibrationMark;
            if (hasEquipId) {
                lines.push(`${indent(4)}<dcc:identifications>`);
                if (equip.serialNumber) {
                    lines.push(`${indent(5)}<dcc:identification>`);
                    lines.push(`${indent(6)}<dcc:issuer>manufacturer</dcc:issuer>`);
                    lines.push(`${indent(6)}<dcc:value>${esc(equip.serialNumber)}</dcc:value>`);
                    lines.push(`${indent(6)}<dcc:name>`);
                    lines.push(`${indent(7)}<dcc:content lang="de">Seriennummer</dcc:content>`);
                    lines.push(`${indent(7)}<dcc:content lang="en">Serial number</dcc:content>`);
                    lines.push(`${indent(6)}</dcc:name>`);
                    lines.push(`${indent(5)}</dcc:identification>`);
                }
                if (equip.equipmentNumber) {
                    lines.push(`${indent(5)}<dcc:identification>`);
                    lines.push(`${indent(6)}<dcc:issuer>calibrationLaboratory</dcc:issuer>`);
                    lines.push(`${indent(6)}<dcc:value>${esc(equip.equipmentNumber)}</dcc:value>`);
                    lines.push(`${indent(6)}<dcc:name>`);
                    lines.push(`${indent(7)}<dcc:content lang="de">Equipment-Nr.</dcc:content>`);
                    lines.push(`${indent(7)}<dcc:content lang="en">Equipment number</dcc:content>`);
                    lines.push(`${indent(6)}</dcc:name>`);
                    lines.push(`${indent(5)}</dcc:identification>`);
                }
                if (equip.certificateNumber) {
                    lines.push(`${indent(5)}<dcc:identification>`);
                    lines.push(`${indent(6)}<dcc:issuer>calibrationLaboratory</dcc:issuer>`);
                    lines.push(`${indent(6)}<dcc:value>${esc(equip.certificateNumber)}</dcc:value>`);
                    lines.push(`${indent(6)}<dcc:name>`);
                    lines.push(`${indent(7)}<dcc:content lang="de">Kalibrierzertifikat-Nr.</dcc:content>`);
                    lines.push(`${indent(7)}<dcc:content lang="en">Calibration certificate number</dcc:content>`);
                    lines.push(`${indent(6)}</dcc:name>`);
                    lines.push(`${indent(5)}</dcc:identification>`);
                }
                if (equip.calibrationMark) {
                    lines.push(`${indent(5)}<dcc:identification>`);
                    lines.push(`${indent(6)}<dcc:issuer>calibrationLaboratory</dcc:issuer>`);
                    lines.push(`${indent(6)}<dcc:value>${esc(equip.calibrationMark)}</dcc:value>`);
                    lines.push(`${indent(6)}<dcc:name>`);
                    lines.push(`${indent(7)}<dcc:content lang="de">Kalibrierzeichen</dcc:content>`);
                    lines.push(`${indent(7)}<dcc:content lang="en">Calibration mark</dcc:content>`);
                    lines.push(`${indent(6)}</dcc:name>`);
                    lines.push(`${indent(5)}</dcc:identification>`);
                }
                lines.push(`${indent(4)}</dcc:identifications>`);
            }
            // Description with traceability and dates
            const equipDescParts = [];
            if (equip.traceability) equipDescParts.push(`Rückführung: ${equip.traceability}`);
            if (equip.calibrationDate) equipDescParts.push(`Kalibrierdatum: ${equip.calibrationDate}`);
            if (equip.nextCalibrationDate) equipDescParts.push(`Nächste Kalibrierung: ${equip.nextCalibrationDate}`);
            if (equipDescParts.length > 0) {
                lines.push(`${indent(4)}<dcc:description>`);
                lines.push(`${indent(5)}<dcc:content lang="${esc(lang)}">${esc(equipDescParts.join('; '))}</dcc:content>`);
                lines.push(`${indent(4)}</dcc:description>`);
            }
            lines.push(`${indent(3)}</dcc:measuringEquipment>`);
        }
        lines.push(`${indent(2)}</dcc:measuringEquipments>`);
    }

    // --- measurementResult(s) ---
    const measurementResults = data.measurementResults || [];
    if (measurementResults.length === 0) {
        warnings.push('Keine Messergebnisse gefunden.');
        // Add empty measurement result to be schema-valid
        lines.push(`${indent(2)}<dcc:measurementResult>`);
        lines.push(`${indent(3)}<dcc:name>`);
        lines.push(`${indent(4)}<dcc:content lang="${esc(lang)}">Messergebnis</dcc:content>`);
        lines.push(`${indent(3)}</dcc:name>`);
        lines.push(`${indent(3)}<dcc:results>`);
        lines.push(`${indent(4)}<dcc:result>`);
        lines.push(`${indent(5)}<dcc:name>`);
        lines.push(`${indent(6)}<dcc:content lang="${esc(lang)}">Ergebnis</dcc:content>`);
        lines.push(`${indent(5)}</dcc:name>`);
        lines.push(`${indent(5)}<dcc:data>`);
        lines.push(`${indent(6)}<dcc:quantity>`);
        lines.push(`${indent(7)}<dcc:noQuantity/>`);
        lines.push(`${indent(6)}</dcc:quantity>`);
        lines.push(`${indent(5)}</dcc:data>`);
        lines.push(`${indent(4)}</dcc:result>`);
        lines.push(`${indent(3)}</dcc:results>`);
        lines.push(`${indent(2)}</dcc:measurementResult>`);
    } else {
        for (const mr of measurementResults) {
            lines.push(`${indent(2)}<dcc:measurementResult>`);

            // name (with category annotation if present)
            const mrName = mr.name || 'Messergebnis';
            lines.push(`${indent(3)}<dcc:name>`);
            lines.push(`${indent(4)}<dcc:content lang="${esc(lang)}">${esc(mrName)}</dcc:content>`);
            lines.push(`${indent(3)}</dcc:name>`);

            // description (calibration procedure + description)
            const mrDescParts = [];
            if (mr.description) mrDescParts.push(mr.description);
            if (mr.calibrationProcedure) mrDescParts.push(mr.calibrationProcedure);
            if (mr.referenceStandard) mrDescParts.push(`Referenzmaterial: ${mr.referenceStandard}`);
            if (mr.decisionRule) mrDescParts.push(`Entscheidungsregel: ${mr.decisionRule}`);
            if (mrDescParts.length > 0) {
                lines.push(`${indent(3)}<dcc:description>`);
                lines.push(`${indent(4)}<dcc:content lang="${esc(lang)}">${esc(mrDescParts.join('\n\n'))}</dcc:content>`);
                lines.push(`${indent(3)}</dcc:description>`);
            }

            // usedMethods
            const methods = mr.usedMethods || [];
            if (mr.method || methods.length > 0) {
                lines.push(`${indent(3)}<dcc:usedMethods>`);
                if (mr.method) {
                    lines.push(`${indent(4)}<dcc:usedMethod>`);
                    lines.push(`${indent(5)}<dcc:name>`);
                    lines.push(`${indent(6)}<dcc:content lang="${esc(lang)}">${esc(mr.method)}</dcc:content>`);
                    lines.push(`${indent(5)}</dcc:name>`);
                    lines.push(`${indent(4)}</dcc:usedMethod>`);
                }
                for (const method of methods) {
                    lines.push(`${indent(4)}<dcc:usedMethod>`);
                    lines.push(`${indent(5)}<dcc:name>`);
                    lines.push(`${indent(6)}<dcc:content lang="${esc(lang)}">${esc(method.name)}</dcc:content>`);
                    lines.push(`${indent(5)}</dcc:name>`);
                    if (method.description) {
                        lines.push(`${indent(5)}<dcc:description>`);
                        lines.push(`${indent(6)}<dcc:content lang="${esc(lang)}">${esc(method.description)}</dcc:content>`);
                        lines.push(`${indent(5)}</dcc:description>`);
                    }
                    lines.push(`${indent(4)}</dcc:usedMethod>`);
                }
                lines.push(`${indent(3)}</dcc:usedMethods>`);
            }

            // influenceConditions
            const conditions = mr.influenceConditions || [];
            if (conditions.length > 0) {
                lines.push(`${indent(3)}<dcc:influenceConditions>`);
                for (const cond of conditions) {
                    lines.push(`${indent(4)}<dcc:influenceCondition>`);
                    lines.push(`${indent(5)}<dcc:name>`);
                    lines.push(`${indent(6)}<dcc:content lang="${esc(lang)}">${esc(cond.name)}</dcc:content>`);
                    lines.push(`${indent(5)}</dcc:name>`);
                    lines.push(`${indent(5)}<dcc:data>`);
                    if (cond.min != null && cond.max != null) {
                        // Range value
                        lines.push(`${indent(6)}<dcc:quantity>`);
                        lines.push(`${indent(7)}<dcc:name>`);
                        lines.push(`${indent(8)}<dcc:content lang="de">Minimum</dcc:content>`);
                        lines.push(`${indent(7)}</dcc:name>`);
                        lines.push(`${indent(7)}<si:real>`);
                        lines.push(`${indent(8)}<si:value>${cond.min}</si:value>`);
                        lines.push(`${indent(8)}<si:unit>${esc(cond.unit || '')}</si:unit>`);
                        lines.push(`${indent(7)}</si:real>`);
                        lines.push(`${indent(6)}</dcc:quantity>`);
                        lines.push(`${indent(6)}<dcc:quantity>`);
                        lines.push(`${indent(7)}<dcc:name>`);
                        lines.push(`${indent(8)}<dcc:content lang="de">Maximum</dcc:content>`);
                        lines.push(`${indent(7)}</dcc:name>`);
                        lines.push(`${indent(7)}<si:real>`);
                        lines.push(`${indent(8)}<si:value>${cond.max}</si:value>`);
                        lines.push(`${indent(8)}<si:unit>${esc(cond.unit || '')}</si:unit>`);
                        lines.push(`${indent(7)}</si:real>`);
                        lines.push(`${indent(6)}</dcc:quantity>`);
                    } else if (cond.value != null) {
                        lines.push(`${indent(6)}<dcc:quantity>`);
                        lines.push(`${indent(7)}<si:real>`);
                        lines.push(`${indent(8)}<si:value>${cond.value}</si:value>`);
                        lines.push(`${indent(8)}<si:unit>${esc(cond.unit || '')}</si:unit>`);
                        if (cond.uncertainty != null) {
                            lines.push(`${indent(8)}<si:expandedUnc>`);
                            lines.push(`${indent(9)}<si:uncertainty>${cond.uncertainty}</si:uncertainty>`);
                            lines.push(`${indent(9)}<si:coverageFactor>2</si:coverageFactor>`);
                            lines.push(`${indent(9)}<si:coverageProbability>0.95</si:coverageProbability>`);
                            lines.push(`${indent(8)}</si:expandedUnc>`);
                        }
                        lines.push(`${indent(7)}</si:real>`);
                        lines.push(`${indent(6)}</dcc:quantity>`);
                    } else {
                        lines.push(`${indent(6)}<dcc:quantity>`);
                        lines.push(`${indent(7)}<dcc:noQuantity/>`);
                        lines.push(`${indent(6)}</dcc:quantity>`);
                    }
                    lines.push(`${indent(5)}</dcc:data>`);
                    lines.push(`${indent(4)}</dcc:influenceCondition>`);
                }
                lines.push(`${indent(3)}</dcc:influenceConditions>`);
            }

            // results
            lines.push(`${indent(3)}<dcc:results>`);
            const results = mr.results || [];
            if (results.length === 0) {
                lines.push(`${indent(4)}<dcc:result>`);
                lines.push(`${indent(5)}<dcc:name>`);
                lines.push(`${indent(6)}<dcc:content lang="${esc(lang)}">Ergebnis</dcc:content>`);
                lines.push(`${indent(5)}</dcc:name>`);
                lines.push(`${indent(5)}<dcc:data>`);
                lines.push(`${indent(6)}<dcc:quantity>`);
                lines.push(`${indent(7)}<dcc:noQuantity/>`);
                lines.push(`${indent(6)}</dcc:quantity>`);
                lines.push(`${indent(5)}</dcc:data>`);
                lines.push(`${indent(4)}</dcc:result>`);
            } else {
                // Build a list-based result with columns
                lines.push(`${indent(4)}<dcc:result>`);
                lines.push(`${indent(5)}<dcc:name>`);
                lines.push(`${indent(6)}<dcc:content lang="${esc(lang)}">${esc(mr.name || 'Kalibrierergebnisse')}</dcc:content>`);
                lines.push(`${indent(5)}</dcc:name>`);
                lines.push(`${indent(5)}<dcc:data>`);

                for (const r of results) {
                    lines.push(`${indent(6)}<dcc:list>`);

                    if (r.name) {
                        lines.push(`${indent(7)}<dcc:name>`);
                        lines.push(`${indent(8)}<dcc:content lang="${esc(lang)}">${esc(r.name)}</dcc:content>`);
                        lines.push(`${indent(7)}</dcc:name>`);
                    }

                    // Set point
                    if (r.setPoint != null) {
                        lines.push(`${indent(7)}<dcc:quantity refType="basic_setPoint">`);
                        lines.push(`${indent(8)}<dcc:name>`);
                        lines.push(`${indent(9)}<dcc:content lang="de">Sollwert</dcc:content>`);
                        lines.push(`${indent(9)}<dcc:content lang="en">Set point</dcc:content>`);
                        lines.push(`${indent(8)}</dcc:name>`);
                        lines.push(`${indent(8)}<si:real>`);
                        lines.push(`${indent(9)}<si:value>${r.setPoint}</si:value>`);
                        lines.push(`${indent(9)}<si:unit>${esc(r.setPointUnit || r.nominalUnit || '')}</si:unit>`);
                        lines.push(`${indent(8)}</si:real>`);
                        lines.push(`${indent(7)}</dcc:quantity>`);
                    }

                    // Nominal / Reference value
                    const nomVal = r.nominalValue ?? r.referenceValue;
                    const nomUnit = r.nominalUnit || r.referenceUnit || r.measuredUnit || '';
                    if (nomVal != null) {
                        lines.push(`${indent(7)}<dcc:quantity refType="basic_referenceValue">`);
                        lines.push(`${indent(8)}<dcc:name>`);
                        lines.push(`${indent(9)}<dcc:content lang="de">Bezugswert</dcc:content>`);
                        lines.push(`${indent(9)}<dcc:content lang="en">Reference value</dcc:content>`);
                        lines.push(`${indent(8)}</dcc:name>`);
                        lines.push(`${indent(8)}<si:real>`);
                        lines.push(`${indent(9)}<si:value>${nomVal}</si:value>`);
                        lines.push(`${indent(9)}<si:unit>${esc(nomUnit)}</si:unit>`);
                        lines.push(`${indent(8)}</si:real>`);
                        lines.push(`${indent(7)}</dcc:quantity>`);
                    }

                    // Measured value
                    if (r.measuredValue != null) {
                        lines.push(`${indent(7)}<dcc:quantity refType="basic_measuredValue">`);
                        lines.push(`${indent(8)}<dcc:name>`);
                        lines.push(`${indent(9)}<dcc:content lang="de">Messwert</dcc:content>`);
                        lines.push(`${indent(9)}<dcc:content lang="en">Measured value</dcc:content>`);
                        lines.push(`${indent(8)}</dcc:name>`);
                        lines.push(`${indent(8)}<si:real>`);
                        lines.push(`${indent(9)}<si:value>${r.measuredValue}</si:value>`);
                        lines.push(`${indent(9)}<si:unit>${esc(r.measuredUnit || '')}</si:unit>`);
                        if (r.uncertainty != null) {
                            lines.push(`${indent(9)}<si:expandedUnc>`);
                            lines.push(`${indent(10)}<si:uncertainty>${r.uncertainty}</si:uncertainty>`);
                            if (r.coverageFactor != null) {
                                lines.push(`${indent(10)}<si:coverageFactor>${r.coverageFactor}</si:coverageFactor>`);
                            }
                            if (r.coverageProbability != null) {
                                lines.push(`${indent(10)}<si:coverageProbability>${r.coverageProbability}</si:coverageProbability>`);
                            }
                            lines.push(`${indent(9)}</si:expandedUnc>`);
                        }
                        lines.push(`${indent(8)}</si:real>`);
                        lines.push(`${indent(7)}</dcc:quantity>`);
                    }

                    // Deviation
                    if (r.deviation != null) {
                        lines.push(`${indent(7)}<dcc:quantity refType="basic_measurementError">`);
                        lines.push(`${indent(8)}<dcc:name>`);
                        lines.push(`${indent(9)}<dcc:content lang="de">Abweichung</dcc:content>`);
                        lines.push(`${indent(9)}<dcc:content lang="en">Deviation</dcc:content>`);
                        lines.push(`${indent(8)}</dcc:name>`);
                        lines.push(`${indent(8)}<si:real>`);
                        lines.push(`${indent(9)}<si:value>${r.deviation}</si:value>`);
                        lines.push(`${indent(9)}<si:unit>${esc(r.deviationUnit || r.measuredUnit || '')}</si:unit>`);
                        lines.push(`${indent(8)}</si:real>`);
                        lines.push(`${indent(7)}</dcc:quantity>`);
                    }

                    // Allowed deviation / MPE
                    const tolerance = r.allowedDeviation ?? r.mpe;
                    const toleranceUnit = r.allowedDeviationUnit || r.mpeUnit || r.measuredUnit || '';
                    if (tolerance != null) {
                        lines.push(`${indent(7)}<dcc:quantity refType="basic_acceptanceLimitLower">`);
                        lines.push(`${indent(8)}<dcc:name>`);
                        lines.push(`${indent(9)}<dcc:content lang="de">Zul. Abweichung (untere)</dcc:content>`);
                        lines.push(`${indent(9)}<dcc:content lang="en">Acceptance limit (lower)</dcc:content>`);
                        lines.push(`${indent(8)}</dcc:name>`);
                        lines.push(`${indent(8)}<si:real>`);
                        lines.push(`${indent(9)}<si:value>${typeof tolerance === 'number' ? -Math.abs(tolerance) : tolerance}</si:value>`);
                        lines.push(`${indent(9)}<si:unit>${esc(toleranceUnit)}</si:unit>`);
                        lines.push(`${indent(8)}</si:real>`);
                        lines.push(`${indent(7)}</dcc:quantity>`);
                        lines.push(`${indent(7)}<dcc:quantity refType="basic_acceptanceLimitUpper">`);
                        lines.push(`${indent(8)}<dcc:name>`);
                        lines.push(`${indent(9)}<dcc:content lang="de">Zul. Abweichung (obere)</dcc:content>`);
                        lines.push(`${indent(9)}<dcc:content lang="en">Acceptance limit (upper)</dcc:content>`);
                        lines.push(`${indent(8)}</dcc:name>`);
                        lines.push(`${indent(8)}<si:real>`);
                        lines.push(`${indent(9)}<si:value>${typeof tolerance === 'number' ? Math.abs(tolerance) : tolerance}</si:value>`);
                        lines.push(`${indent(9)}<si:unit>${esc(toleranceUnit)}</si:unit>`);
                        lines.push(`${indent(8)}</si:real>`);
                        lines.push(`${indent(7)}</dcc:quantity>`);
                    }

                    // Per-point conformity
                    if (r.conformity) {
                        lines.push(`${indent(7)}<dcc:quantity refType="basic_conformity">`);
                        lines.push(`${indent(8)}<dcc:name>`);
                        lines.push(`${indent(9)}<dcc:content lang="de">Bewertung</dcc:content>`);
                        lines.push(`${indent(9)}<dcc:content lang="en">Conformity</dcc:content>`);
                        lines.push(`${indent(8)}</dcc:name>`);
                        lines.push(`${indent(8)}<dcc:noQuantity>`);
                        lines.push(`${indent(9)}<dcc:content lang="${esc(lang)}">${esc(r.conformity)}</dcc:content>`);
                        lines.push(`${indent(8)}</dcc:noQuantity>`);
                        lines.push(`${indent(7)}</dcc:quantity>`);
                    }

                    lines.push(`${indent(6)}</dcc:list>`);
                }

                lines.push(`${indent(5)}</dcc:data>`);
                lines.push(`${indent(4)}</dcc:result>`);
            }
            lines.push(`${indent(3)}</dcc:results>`);

            lines.push(`${indent(2)}</dcc:measurementResult>`);
        }
    }

    lines.push(`${indent(1)}</dcc:measurementResults>`);

    // --- comments (calibration SOPs, calibration location) ---
    const sops = data.calibrationSOPs || [];
    const calLocation = data.calibrationLocation;
    if (sops.length > 0 || calLocation) {
        lines.push(`${indent(1)}<dcc:comment>`);
        lines.push(`${indent(2)}<dcc:name>`);
        lines.push(`${indent(3)}<dcc:content lang="de">Zusätzliche Informationen</dcc:content>`);
        lines.push(`${indent(3)}<dcc:content lang="en">Additional information</dcc:content>`);
        lines.push(`${indent(2)}</dcc:name>`);
        lines.push(`${indent(2)}<dcc:description>`);
        const commentParts = [];
        if (calLocation) {
            const locParts = [calLocation.name, calLocation.street, `${calLocation.postCode || ''} ${calLocation.city || ''}`.trim(), calLocation.country].filter(Boolean);
            commentParts.push(`Kalibrierort: ${locParts.join(', ')}`);
        }
        if (sops.length > 0) {
            const sopStr = sops.map(s => `${s.sopNumber}: ${s.description || ''}`).join('\n');
            commentParts.push(`Kalibrierverfahren (SOPs):\n${sopStr}`);
        }
        lines.push(`${indent(3)}<dcc:content lang="${esc(lang)}">${esc(commentParts.join('\n\n'))}</dcc:content>`);
        lines.push(`${indent(2)}</dcc:description>`);
        lines.push(`${indent(1)}</dcc:comment>`);
    }

    // Close root
    lines.push('</dcc:digitalCalibrationCertificate>');

    return { xml: lines.join('\n'), warnings };
}

/**
 * Validate extracted data for completeness.
 * @param {object} data
 * @returns {string[]} List of validation warnings
 */
export function validateData(data) {
    const warnings = [];

    if (!data.coreData?.uniqueIdentifier) {
        warnings.push('Zertifikatsnummer fehlt.');
    }
    if (!data.coreData?.beginPerformanceDate) {
        warnings.push('Kalibrierdatum fehlt.');
    }
    if (!data.calibrationLaboratory?.name) {
        warnings.push('Name des Kalibrierlaboratoriums fehlt.');
    }
    if (!data.customer?.name) {
        warnings.push('Name des Auftraggebers fehlt.');
    }
    if (!data.items || data.items.length === 0) {
        warnings.push('Kein Prüfling angegeben.');
    }
    if (!data.measurementResults || data.measurementResults.length === 0) {
        warnings.push('Keine Messergebnisse vorhanden.');
    }
    if (!data.measuringEquipments || data.measuringEquipments.length === 0) {
        warnings.push('Keine Messeinrichtungen/Referenznormale angegeben.');
    }
    if (!data.statements || data.statements.length === 0) {
        warnings.push('Keine Konformitätsaussage vorhanden.');
    }

    return warnings;
}
