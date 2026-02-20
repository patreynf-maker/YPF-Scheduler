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
        return {}; // No propagation if month ends in Franco
    }

    // 1. Calculate consecutive work days (streak) at the end of the month
    let consecutiveWorkDays = 0;
    for (let d = daysInMonth; d >= 1; d--) {
        if (empShifts[d] !== 'FRANCO') {
            consecutiveWorkDays++;
        } else {
            break;
        }
    }

    // 2. Analyze pattern over the last 14 days
    const windowDays = [];
    for (let d = Math.max(1, daysInMonth - 13); d <= daysInMonth; d++) {
        if (empShifts[d]) {
            windowDays.push({ code: empShifts[d] });
        }
    }

    if (windowDays.length === 0) return {};

    // 3. Extract work blocks (group consecutive identical shifts, ignoring Francos)
    const workBlocks = [];
    let currentBlock = null;
    windowDays.forEach(day => {
        if (day.code === 'FRANCO') {
            currentBlock = null; // Reset block on Franco
            return;
        }
        if (!currentBlock || currentBlock.code !== day.code) {
            currentBlock = { code: day.code, count: 1 };
            workBlocks.push(currentBlock);
        } else {
            currentBlock.count++;
        }
    });

    if (workBlocks.length === 0) return {};

    // 4. Identify rotation sequence and block size
    // Sequence: the order of unique shifts found in the blocks
    const rotationSequence = [];
    workBlocks.forEach(b => {
        if (!rotationSequence.includes(b.code)) rotationSequence.push(b.code);
    });

    // rotationSize: find the most frequent block length (e.g., if blocks are 3, 3, 2, we pick 3)
    const counts = workBlocks.map(b => b.count);
    const rotationSize = counts.sort((a, b) =>
        counts.filter(v => v === a).length - counts.filter(v => v === b).length
    ).pop() || 1;

    // 5. Prediction Logic
    const nextShifts = {};
    const remainingToFranco = 6 - consecutiveWorkDays;

    // Start predicting from current state
    const lastBlock = workBlocks[workBlocks.length - 1];
    let currentShiftCode = lastBlock.code;
    let daysSpentInBlock = lastBlock.count;
    let seqIndex = rotationSequence.indexOf(currentShiftCode);

    for (let i = 1; i <= remainingToFranco; i++) {
        // If we reached the rotation size, move to the next shift in sequence
        if (daysSpentInBlock >= rotationSize && rotationSequence.length > 1) {
            seqIndex = (seqIndex + 1) % rotationSequence.length;
            currentShiftCode = rotationSequence[seqIndex];
            daysSpentInBlock = 0;
        }
        nextShifts[i] = currentShiftCode;
        daysSpentInBlock++;
    }

    // 6. Mandatory Franco after the streak
    if (remainingToFranco >= 0) {
        nextShifts[remainingToFranco + 1] = 'FRANCO';
    }

    return nextShifts;
};

