window.App = window.App || {};

/**
 * Checks if the specified month is complete for all employees in the current organization.
 */
App.isMonthCompleteForOrg = function (employees, year, month, allShifts) {
    const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
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
                errors.push(`${emp.name} (DÃ­a ${d})`);
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
    const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const monthlyShifts = allShifts[monthKey];
    const empShifts = monthlyShifts[empId];

    if (!empShifts || empShifts[daysInMonth] === 'FRANCO') {
        return {}; // No propagation if month ends in Franco
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

    // 2. Detect rotation pattern (2 or 3 days) and shift sequence
    // We look at the last 14 days to find blocks
    const lastShifts = [];
    for (let d = Math.max(1, daysInMonth - 13); d <= daysInMonth; d++) {
        lastShifts.push(empShifts[d]);
    }

    const blocks = [];
    if (lastShifts.length > 0) {
        let currentShift = lastShifts[0];
        let count = 1;
        for (let i = 1; i < lastShifts.length; i++) {
            if (lastShifts[i] === currentShift) {
                count++;
            } else {
                blocks.push({ code: currentShift, count: count });
                currentShift = lastShifts[i];
                count = 1;
            }
        }
        blocks.push({ code: currentShift, count: count });
    }

    // Determine rotation size (most frequent block size, ignoring Franco)
    const workBlocks = blocks.filter(b => b.code !== 'FRANCO');
    const rotationSize = workBlocks.length > 0
        ? (workBlocks.some(b => b.count >= 3) ? 3 : 2)
        : 2;

    // Detect shift sequence (e.g. 06-14 -> 14-22 -> 22-06)
    const uniqueWorkShifts = [];
    workBlocks.forEach(b => {
        if (!uniqueWorkShifts.includes(b.code)) {
            uniqueWorkShifts.push(b.code);
        }
    });

    // Prediction logic
    const nextShifts = {};
    let lastWorkDayInMonth = {
        code: workBlocks[workBlocks.length - 1].code,
        countInBlock: workBlocks[workBlocks.length - 1].count
    };

    let currentRotationIndex = uniqueWorkShifts.indexOf(lastWorkDayInMonth.code);
    let currentShiftCode = lastWorkDayInMonth.code;
    let daysSpentInCurrentBlock = lastWorkDayInMonth.countInBlock;

    // Propagate until first FRANCO
    const remainingToFranco = 6 - consecutiveWorkDays;

    if (remainingToFranco <= 0) return {}; // Should have been Franco already

    // Fill work days
    for (let i = 1; i <= remainingToFranco; i++) {
        // If we exhausted the block for this shift, move to next
        if (daysSpentInCurrentBlock >= rotationSize) {
            currentRotationIndex = (currentRotationIndex + 1) % uniqueWorkShifts.length;
            currentShiftCode = uniqueWorkShifts[currentRotationIndex];
            daysSpentInCurrentBlock = 0;
        }

        nextShifts[i] = currentShiftCode;
        daysSpentInCurrentBlock++;
    }

    // Add exactly one FRANCO after the streak
    nextShifts[remainingToFranco + 1] = 'FRANCO';

    return nextShifts;
};

