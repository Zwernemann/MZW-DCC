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
            lines.push(`${indent(7)}<dcc:content lang="${esc(lang)}">Seriennummer</dcc:content>`);
            lines.push(`${indent(7)}<dcc:content lang="en">Serial number</dcc:content>`);
            lines.push(`${indent(6)}</dcc:name>`);
            lines.push(`${indent(5)}</dcc:identification>`);
        }

        if (item.inventoryNumber) {
            lines.push(`${indent(5)}<dcc:identification>`);
            lines.push(`${indent(6)}<dcc:issuer>customer</dcc:issuer>`);
            lines.push(`${indent(6)}<dcc:value>${esc(item.inventoryNumber)}</dcc:value>`);
            lines.push(`${indent(6)}<dcc:name>`);
            lines.push(`${indent(7)}<dcc:content lang="${esc(lang)}">Inventarnummer</dcc:content>`);
            lines.push(`${indent(7)}<dcc:content lang="en">Inventory number</dcc:content>`);
            lines.push(`${indent(6)}</dcc:name>`);
            lines.push(`${indent(5)}</dcc:identification>`);
        }

        // Fallback identification if none given
        if (!item.serialNumber && !item.inventoryNumber) {
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

        if (item.description) {
            lines.push(`${indent(4)}<dcc:description>`);
            lines.push(`${indent(5)}<dcc:content lang="${esc(lang)}">${esc(item.description)}</dcc:content>`);
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
        for (let i = 0; i < persons.length; i++) {
            const person = persons[i];
            lines.push(`${indent(3)}<dcc:respPerson>`);
            lines.push(`${indent(4)}<dcc:person>`);
            lines.push(`${indent(5)}<dcc:name>`);
            lines.push(`${indent(6)}<dcc:content lang="${esc(lang)}">${esc(person.name)}</dcc:content>`);
            lines.push(`${indent(5)}</dcc:name>`);
            lines.push(`${indent(4)}</dcc:person>`);
            if (person.role) {
                lines.push(`${indent(4)}<dcc:role>${esc(person.role)}</dcc:role>`);
            }
            if (i === 0) {
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
    lines.push(`${indent(3)}<dcc:location>`);
    if (customer.street) lines.push(`${indent(4)}<dcc:street>${esc(customer.street)}</dcc:street>`);
    if (customer.postCode) lines.push(`${indent(4)}<dcc:postCode>${esc(customer.postCode)}</dcc:postCode>`);
    if (customer.city) lines.push(`${indent(4)}<dcc:city>${esc(customer.city)}</dcc:city>`);
    lines.push(`${indent(4)}<dcc:countryCode>${esc(customer.country || country)}</dcc:countryCode>`);
    lines.push(`${indent(3)}</dcc:location>`);
    lines.push(`${indent(2)}</dcc:customer>`);

    // --- statements ---
    const statements = data.statements || [];
    if (statements.length > 0) {
        lines.push(`${indent(2)}<dcc:statements>`);
        for (const stmt of statements) {
            lines.push(`${indent(3)}<dcc:statement>`);
            if (stmt.name) {
                lines.push(`${indent(4)}<dcc:name>`);
                lines.push(`${indent(5)}<dcc:content lang="${esc(lang)}">${esc(stmt.name)}</dcc:content>`);
                lines.push(`${indent(4)}</dcc:name>`);
            }
            if (stmt.description) {
                lines.push(`${indent(4)}<dcc:description>`);
                lines.push(`${indent(5)}<dcc:content lang="${esc(lang)}">${esc(stmt.description)}</dcc:content>`);
                lines.push(`${indent(4)}</dcc:description>`);
            }
            if (stmt.conformity) {
                lines.push(`${indent(4)}<dcc:conformity>${esc(stmt.conformity)}</dcc:conformity>`);
            }
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
            if (equip.serialNumber || equip.certificateNumber) {
                lines.push(`${indent(4)}<dcc:identifications>`);
                if (equip.serialNumber) {
                    lines.push(`${indent(5)}<dcc:identification>`);
                    lines.push(`${indent(6)}<dcc:issuer>manufacturer</dcc:issuer>`);
                    lines.push(`${indent(6)}<dcc:value>${esc(equip.serialNumber)}</dcc:value>`);
                    lines.push(`${indent(6)}<dcc:name>`);
                    lines.push(`${indent(7)}<dcc:content lang="${esc(lang)}">Seriennummer</dcc:content>`);
                    lines.push(`${indent(6)}</dcc:name>`);
                    lines.push(`${indent(5)}</dcc:identification>`);
                }
                if (equip.certificateNumber) {
                    lines.push(`${indent(5)}<dcc:identification>`);
                    lines.push(`${indent(6)}<dcc:issuer>calibrationLaboratory</dcc:issuer>`);
                    lines.push(`${indent(6)}<dcc:value>${esc(equip.certificateNumber)}</dcc:value>`);
                    lines.push(`${indent(6)}<dcc:name>`);
                    lines.push(`${indent(7)}<dcc:content lang="${esc(lang)}">Kalibrierzertifikat-Nr.</dcc:content>`);
                    lines.push(`${indent(6)}</dcc:name>`);
                    lines.push(`${indent(5)}</dcc:identification>`);
                }
                lines.push(`${indent(4)}</dcc:identifications>`);
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

            // name
            lines.push(`${indent(3)}<dcc:name>`);
            lines.push(`${indent(4)}<dcc:content lang="${esc(lang)}">${esc(mr.name || 'Messergebnis')}</dcc:content>`);
            lines.push(`${indent(3)}</dcc:name>`);

            if (mr.description) {
                lines.push(`${indent(3)}<dcc:description>`);
                lines.push(`${indent(4)}<dcc:content lang="${esc(lang)}">${esc(mr.description)}</dcc:content>`);
                lines.push(`${indent(3)}</dcc:description>`);
            }

            // usedMethods
            if (mr.method) {
                lines.push(`${indent(3)}<dcc:usedMethods>`);
                lines.push(`${indent(4)}<dcc:usedMethod>`);
                lines.push(`${indent(5)}<dcc:name>`);
                lines.push(`${indent(6)}<dcc:content lang="${esc(lang)}">${esc(mr.method)}</dcc:content>`);
                lines.push(`${indent(5)}</dcc:name>`);
                lines.push(`${indent(4)}</dcc:usedMethod>`);
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
                    if (cond.value != null) {
                        lines.push(`${indent(6)}<dcc:quantity>`);
                        lines.push(`${indent(7)}<si:real>`);
                        lines.push(`${indent(8)}<si:value>${cond.value}</si:value>`);
                        lines.push(`${indent(8)}<si:unit>${esc(cond.unit || '')}</si:unit>`);
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
                // Build a list-based result with columns for nominal, measured, uncertainty
                lines.push(`${indent(4)}<dcc:result>`);
                lines.push(`${indent(5)}<dcc:name>`);
                lines.push(`${indent(6)}<dcc:content lang="${esc(lang)}">${esc(mr.name || 'Kalibrierergebnisse')}</dcc:content>`);
                lines.push(`${indent(5)}</dcc:name>`);
                lines.push(`${indent(5)}<dcc:data>`);

                for (const r of results) {
                    // Each result as a list with quantity entries
                    lines.push(`${indent(6)}<dcc:list>`);

                    if (r.name) {
                        lines.push(`${indent(7)}<dcc:name>`);
                        lines.push(`${indent(8)}<dcc:content lang="${esc(lang)}">${esc(r.name)}</dcc:content>`);
                        lines.push(`${indent(7)}</dcc:name>`);
                    }

                    // Nominal value
                    if (r.nominalValue != null) {
                        lines.push(`${indent(7)}<dcc:quantity refType="basic_nominalValue">`);
                        lines.push(`${indent(8)}<dcc:name>`);
                        lines.push(`${indent(9)}<dcc:content lang="${esc(lang)}">Nennwert</dcc:content>`);
                        lines.push(`${indent(9)}<dcc:content lang="en">Nominal value</dcc:content>`);
                        lines.push(`${indent(8)}</dcc:name>`);
                        lines.push(`${indent(8)}<si:real>`);
                        lines.push(`${indent(9)}<si:value>${r.nominalValue}</si:value>`);
                        lines.push(`${indent(9)}<si:unit>${esc(r.nominalUnit || r.measuredUnit || '')}</si:unit>`);
                        lines.push(`${indent(8)}</si:real>`);
                        lines.push(`${indent(7)}</dcc:quantity>`);
                    }

                    // Measured value
                    if (r.measuredValue != null) {
                        lines.push(`${indent(7)}<dcc:quantity refType="basic_measuredValue">`);
                        lines.push(`${indent(8)}<dcc:name>`);
                        lines.push(`${indent(9)}<dcc:content lang="${esc(lang)}">Messwert</dcc:content>`);
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

    return warnings;
}
