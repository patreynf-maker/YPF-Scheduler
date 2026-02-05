window.App = window.App || {};

App.assignTasksForMonth = function (year, month) {
    const state = App.store.state;
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // Get Playa employees for current org
    const employees = state.employees.filter(e =>
        e.organization === state.currentOrg &&
        e.category === App.CATEGORIES.PLAYA
    );

    const monthKey = `${year}-${month}`;
    if (!state.tasks[monthKey]) state.tasks[monthKey] = {};

    // Validation: Ensure all Playa employees have a shift for EVERY day of the month
    let incompleteDays = [];
    for (let d = 1; d <= daysInMonth; d++) {
        const allAssigned = employees.every(emp => {
            const shift = state.shifts[monthKey]?.[emp.id]?.[d];
            return shift !== undefined && shift !== null && shift !== '';
        });
        if (!allAssigned) incompleteDays.push(d);
    }

    if (incompleteDays.length > 0) {
        alert(`No se pueden asignar tareas. Faltan asignar turnos en los dÃ­as: ${incompleteDays.join(', ')}. Todos los colaboradores deben tener un turno asignado.`);
        return;
    }

    for (let d = 1; d <= daysInMonth; d++) {
        // Only assign if current assignments are not valid
        if (!App.isDailyTaskAssignmentValid(d, monthKey, employees, state.shifts, state.tasks)) {
            App.assignDailyTasks(d, monthKey, employees, state.shifts[monthKey]);
        } else {
            console.log(`Day ${d} has a valid task assignment, skipping re-allocation.`);
        }
    }

    App.store.emitChange();
    alert("Tareas asignadas exitosamente para todo el mes.");
};

App.assignDailyTasks = function (day, monthKey, employees, monthlyShifts) {
    if (!monthlyShifts) return;

    // Build list of employees working this day (exclude franco, certificado medico, asiduidad)
    let candidates = [];
    employees.forEach(emp => {
        const shiftCode = monthlyShifts[emp.id]?.[day];
        if (App.isWorkingShift(shiftCode)) {
            candidates.push({ id: emp.id, shift: shiftCode });
        }
    });

    if (candidates.length === 0) return;

    let dailyAssignments = {};

    // Rule 1: Cada dÃ­a debe tener solo un nro 4, en el horario de "22 a 06"
    const pool2206 = candidates.filter(c => c.shift === '22-06' && !dailyAssignments[c.id]);
    if (pool2206.length > 0) {
        const chosen = App.pickRandom(pool2206);
        dailyAssignments[chosen.id] = 4;
    }

    // Rule 2: Cada dÃ­a debe tener dos nÃºmeros 3, en "16 a 00" y "08 a 16"
    const pool1600 = candidates.filter(c => c.shift === '16-00' && !dailyAssignments[c.id]);
    if (pool1600.length > 0) {
        const chosen = App.pickRandom(pool1600);
        dailyAssignments[chosen.id] = 3;
    }

    const pool0816 = candidates.filter(c => c.shift === '08-16' && !dailyAssignments[c.id]);
    if (pool0816.length > 0) {
        const chosen = App.pickRandom(pool0816);
        dailyAssignments[chosen.id] = 3;
    }

    // Rule 3 & 4: Al menos un nro 1 y al menos un nro 2 al dÃ­a
    // Get remaining unassigned employees
    const remaining = candidates.filter(c => !dailyAssignments[c.id]);

    if (remaining.length > 0) {
        // Create a bag of task numbers ensuring at least one 1 and one 2
        let taskBag = [];

        if (remaining.length >= 2) {
            // Ensure at least one 1 and one 2
            taskBag.push(1);
            taskBag.push(2);

            // Fill the rest with random 1s and 2s
            for (let i = 2; i < remaining.length; i++) {
                taskBag.push(Math.random() > 0.5 ? 1 : 2);
            }
        } else if (remaining.length === 1) {
            // Only one person left, assign either 1 or 2
            taskBag.push(Math.random() > 0.5 ? 1 : 2);
        }

        // Shuffle the bag
        taskBag = taskBag.sort(() => Math.random() - 0.5);

        // Assign tasks from the bag to remaining employees
        remaining.forEach((cand, idx) => {
            dailyAssignments[cand.id] = taskBag[idx];
        });
    }

    // Save all assignments for this day
    const state = App.store.state;
    Object.keys(dailyAssignments).forEach(empId => {
        if (!state.tasks[monthKey][empId]) state.tasks[monthKey][empId] = {};
        state.tasks[monthKey][empId][day] = dailyAssignments[empId];
    });
};

App.isDailyTaskAssignmentValid = function (day, monthKey, employees, monthlyShifts, tasks) {
    if (!monthlyShifts || !tasks[monthKey]) return false;

    let candidates = [];
    employees.forEach(emp => {
        const shiftCode = monthlyShifts[emp.id]?.[day];
        if (App.isWorkingShift(shiftCode)) {
            candidates.push({ id: emp.id, shift: shiftCode });
        }
    });

    if (candidates.length === 0) return true; // No ones working, technically valid

    // 1. Check if all candidates have a task and no non-candidates have tasks
    for (let emp of employees) {
        const hasTask = tasks[monthKey][emp.id]?.[day] !== undefined;
        const isCandidate = candidates.some(c => c.id === emp.id);

        if (isCandidate && !hasTask) return false;
        if (!isCandidate && hasTask) return false;
    }

    const dailyTasks = {};
    candidates.forEach(c => {
        dailyTasks[c.id] = parseInt(tasks[monthKey][c.id][day]);
    });

    // 2. Rule 1: Task 4 on 22-06
    const workers2206 = candidates.filter(c => c.shift === '22-06');
    const task4Count = Object.values(dailyTasks).filter(v => v === 4).length;
    if (workers2206.length > 0) {
        if (task4Count !== 1) return false;
        const owner = candidates.find(c => dailyTasks[c.id] === 4);
        if (!owner || owner.shift !== '22-06') return false;
    } else {
        if (task4Count !== 0) return false;
    }

    // 3. Rule 2: Task 3 on 16-00 and 08-16
    const task3Count = Object.values(dailyTasks).filter(v => v === 3).length;
    let expected3 = 0;

    const workers1600 = candidates.filter(c => c.shift === '16-00');
    if (workers1600.length > 0) {
        expected3++;
        if (!workers1600.some(w => dailyTasks[w.id] === 3)) return false;
    }

    const workers0816 = candidates.filter(c => c.shift === '08-16');
    if (workers0816.length > 0) {
        expected3++;
        if (!workers0816.some(w => dailyTasks[w.id] === 3)) return false;
    }

    if (task3Count !== expected3) return false;

    // 4. Rule 3 & 4: At least one 1 and one 2 if remaining candidates allow
    const remainingValues = Object.values(dailyTasks).filter(v => v === 1 || v === 2);
    const pool16 = candidates.filter(c => c.shift !== '22-06' && c.shift !== '16-00' && c.shift !== '08-16');

    if (pool16.length >= 2) {
        const has1 = remainingValues.includes(1);
        const has2 = remainingValues.includes(2);
        if (!has1 || !has2) return false;
    }

    return true;
};

App.isWorkingShift = function (code) {
    if (!code) return false;

    // Normalize code to uppercase for comparison
    const normalizedCode = code.toUpperCase();

    // List of non-working shift codes (franco, certificado medico, asiduidad, etc.)
    const nonWorkingKeywords = ['FRANCO', 'ASIDUIDAD', 'SUSPENSION', 'MEDICO', 'CERTIFICADO'];

    // Check if the shift code contains any non-working keywords
    for (let keyword of nonWorkingKeywords) {
        if (normalizedCode.includes(keyword)) {
            return false;
        }
    }

    return true;
};

App.pickRandom = function (array) {
    return array[Math.floor(Math.random() * array.length)];
};

