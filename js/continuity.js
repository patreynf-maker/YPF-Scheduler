window.App = window.App || {};

/**
 * Checks if the specified month is complete for all employees in the current organization.
 */
App.isMonthCompleteForOrg = function (employees, year, month, allShifts) {
    const monthKey = App.getMonthKey(new Date(year, month, 1));
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const monthlyShifts = allShifts[monthKey];

    if (!monthlyShifts) {
        return { valid: false, message: `No se encontraron turnos para el mes ${monthKey}` };
    }

    const errors = [];
    employees.forEach(emp => {
        const empShifts = monthlyShifts[emp.id];

        // If employee has NO shifts at all in this month, skip them (assume inactive for this month)
        if (!empShifts || Object.keys(empShifts).length === 0) {
            return;
        }

        for (let d = 1; d <= daysInMonth; d++) {
            const val = empShifts[d];
            if (val === undefined || val === null || (typeof val === 'string' && val.trim() === '')) {
                errors.push(`${emp.name} (D\u00C3\u00ADa ${d})`);
                if (errors.length > 5) break;
            }
        }
    });

    if (errors.length > 0) {
        return {
            valid: false,
            message: `Faltan horarios para:\n${errors.join('\n')}${errors.length > 5 ? '\n...y otros.' : ''}`
        };
    }

    return { valid: true };
};

/**
 * Predicts shifts for the start of the next month for a specific employee.
 */
App.predictNextMonthShifts = function (empId, year, month, allShifts) {
    const monthKey = App.getMonthKey(new Date(year, month, 1));
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const monthlyShifts = allShifts[monthKey];
    const empShifts = monthlyShifts[empId];

    if (!empShifts || !empShifts[daysInMonth]) {
        return {}; // Cannot propagate if last day is empty
    }

    if (empShifts[daysInMonth] === 'FRANCO') {
        return {}; // No propagation if month ends in Franco (standard behavior)
    }

    // 1. Calculate consecutive work days at the end of the month
    let consecutiveWorkDays = 0;
    for (let d = daysInMonth; d >= 1; d--) {
        if (empShifts[d] !== 'FRANCO') {
            consecutiveWorkDays++;
        } else {
            break;
        }
    }

    // 2. Analyze pattern in the last 7 days
    const last7Days = [];
    for (let d = Math.max(1, daysInMonth - 6); d <= daysInMonth; d++) {
        if (empShifts[d]) last7Days.push({ day: d, code: empShifts[d] });
    }

    if (last7Days.length === 0) return {};

    // 3. Detect current work block (streak) pattern
    // Find when the current work block started
    let blockStartIndex = -1;
    for (let i = last7Days.length - 1; i >= 0; i--) {
        if (last7Days[i].code === 'FRANCO') break;
        blockStartIndex = i;
    }

    const currentBlock = last7Days.slice(blockStartIndex);
    const uniqueCodesInBlock = [...new Set(currentBlock.map(b => b.code))];

    // 4. Prediction Logic
    const nextShifts = {};
    const remainingToFranco = 6 - consecutiveWorkDays;

    if (uniqueCodesInBlock.length === 1) {
        // Simple case: same shift code for the whole current streak
        const shiftCode = uniqueCodesInBlock[0];
        for (let i = 1; i <= remainingToFranco; i++) {
            nextShifts[i] = shiftCode;
        }
    } else {
        // Complex case: detect rotation (e.g., 14-22, 14-22, 22-06, 22-06)
        // Find block size of each shift
        const blocks = [];
        let current = currentBlock[0].code;
        let count = 0;
        currentBlock.forEach(b => {
            if (b.code === current) {
                count++;
            } else {
                blocks.push({ code: current, count: count });
                current = b.code;
                count = 1;
            }
        });
        blocks.push({ code: current, count: count });

        // Identify most common block size in the last week (2 or 3 usually)
        const rotationSize = blocks[0].count; // Default to first block size
        const lastBlock = blocks[blocks.length - 1];

        let currentShiftCode = lastBlock.code;
        let daysSpentInCurrentBlock = lastBlock.count;
        let rotationIndex = uniqueCodesInBlock.indexOf(currentShiftCode);

        for (let i = 1; i <= remainingToFranco; i++) {
            if (daysSpentInCurrentBlock >= rotationSize) {
                rotationIndex = (rotationIndex + 1) % uniqueCodesInBlock.length;
                currentShiftCode = uniqueCodesInBlock[rotationIndex];
                daysSpentInCurrentBlock = 0;
            }
            nextShifts[i] = currentShiftCode;
            daysSpentInCurrentBlock++;
        }
    }

    // 5. Mandatory Franco after the streak
    if (remainingToFranco >= 0) {
        nextShifts[remainingToFranco + 1] = 'FRANCO';
    }

    return nextShifts;
};

