window.App = window.App || {};

App.store = {
    state: {
        currentOrg: null,
        currentDate: new Date(),
        isAdmin: false,
        employees: [],
        shifts: {},
        tasks: {},
        organizations: [],
        currentFilter: 'ALL',
        nextEmployeeId: 500,
        organizations: [],
        currentFilter: 'ALL',
        nextEmployeeId: 500,
        requests: {}, // { 'YYYY-MM-DD-EMP_ID': 'Reason' }
        logs: [], // Array of log objects { timestamp, action, details }
        isLoaded: false
    },

    getEmployeesByOrg(org) {
        return this.state.employees.filter(e => e.organization === org)
            .sort((a, b) => a.name.localeCompare(b.name));
    },

    setOrg(org) {
        this.state.currentOrg = org;
        this.emitChange(null, null, false); // UI change only
    },

    getEmployeeStats(employeeId, monthKey) {
        const shifts = this.state.shifts[monthKey]?.[employeeId] || {};
        const employees = this.state.employees;
        const emp = employees.find(e => e.id === employeeId);
        if (!emp) return { hours: 0, sundays: 0, holidays: 0 };

        const shiftDefinitions = emp.category === App.CATEGORIES.PLAYA ? App.SHIFT_TYPES.PLAYA : App.SHIFT_TYPES.FULL;

        let totalHours = 0;
        let sundaysWorked = 0;
        let holidaysWorked = 0;

        const [year, month] = monthKey.split('-').map(Number);

        Object.entries(shifts).forEach(([day, code]) => {
            const shiftDef = shiftDefinitions.find(s => s.code === code);
            if (shiftDef) {
                totalHours += shiftDef.duration;

                // Track Sundays
                const date = new Date(year, month - 1, parseInt(day));
                if (date.getDay() === 0 && code !== 'FRANCO') {
                    sundaysWorked++;
                }

                // Track Holidays
                const fullDateKey = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                if (App.HOLIDAYS[fullDateKey] && code !== 'FRANCO') {
                    holidaysWorked++;
                }
            }
        });

        return { hours: totalHours, sundays: sundaysWorked, holidays: holidaysWorked };
    },

    validateShiftSequence(employeeId, day, newShiftCode, monthKey) {
        if (newShiftCode === 'FRANCO' || !newShiftCode) return { valid: true };

        const shifts = this.state.shifts[monthKey]?.[employeeId] || {};
        const prevDay = parseInt(day) - 1;
        const nextDay = parseInt(day) + 1;

        const prevShift = shifts[prevDay];
        const nextShift = shifts[nextDay];

        // Shift times helper
        const getTimes = (code) => {
            if (code === '06-14') return { start: 6, end: 14 };
            if (code === '14-22') return { start: 14, end: 22 };
            if (code === '22-06') return { start: 22, end: 30 }; // 30 is 06:00 next day
            if (code === '16-00') return { start: 16, end: 24 };
            if (code === '08-16') return { start: 8, end: 16 };
            if (code === '20-00') return { start: 20, end: 24 };
            if (code === '05-13') return { start: 5, end: 13 };
            return null;
        };

        const current = getTimes(newShiftCode);
        if (!current) return { valid: true };

        // Check against previous day
        if (prevShift) {
            const prev = getTimes(prevShift);
            if (prev) {
                const rest = (24 + current.start) - prev.end;
                if (rest < 12) {
                    return {
                        valid: false,
                        message: `Descanso insuficiente (${rest}hs) entre el día anterior (${prevShift}) y hoy (${newShiftCode}).`
                    };
                }
            }
        }

        // Check against next day
        if (nextShift) {
            const next = getTimes(nextShift);
            if (next) {
                const rest = (24 + next.start) - current.end;
                if (rest < 12) {
                    return {
                        valid: false,
                        message: `Descanso insuficiente (${rest}hs) entre hoy (${newShiftCode}) y el día siguiente (${nextShift}).`
                    };
                }
            }
        }

        return { valid: true };
    },

    setAdmin(status) {
        this.state.isAdmin = status;
        this.emitChange(null, null, false);
    },

    setShift(employeeId, day, shiftCode, monthKey) {
        try {
            if (!this.state.shifts[monthKey]) this.state.shifts[monthKey] = {};
            if (!this.state.shifts[monthKey][employeeId]) this.state.shifts[monthKey][employeeId] = {};

            // Business Rule: Validate rest period
            const validation = this.validateShiftSequence(employeeId, day, shiftCode, monthKey);
            if (!validation.valid) {
                if (!confirm(`${validation.message}\n\n¿Desea asignar este turno de todas formas?`)) {
                    return;
                }
            }

            this.state.shifts[monthKey][employeeId][day] = shiftCode;

            this.checkAndAssignTasks(day, monthKey);

            // Log Action
            this.logAction('ASSIGN_SHIFT', `Asignado ${shiftCode} a Emp#${employeeId} el día ${day}`);

            this.emitChange(`shifts/${monthKey}/${employeeId}/${day}`, shiftCode);

            if (this.state.tasks[monthKey]) {
                this.saveTasksToFirebase(monthKey);
            }
        } catch (e) {
            console.error('Error in setShift:', e);
            throw e;
        }
    },

    removeShift(employeeId, day, monthKey) {
        if (this.state.shifts[monthKey] && this.state.shifts[monthKey][employeeId]) {
            delete this.state.shifts[monthKey][employeeId][day];

            if (this.state.tasks[monthKey] && this.state.tasks[monthKey][employeeId]) {
                delete this.state.tasks[monthKey][employeeId][day];
            }

            this.checkAndAssignTasks(day, monthKey);
            this.emitChange();
        }
    },

    checkAndAssignTasks(day, monthKey) {
        if (!this.state.currentOrg) return;

        try {
            const playaEmployees = this.state.employees.filter(e =>
                e.organization === this.state.currentOrg &&
                e.category === App.CATEGORIES.PLAYA
            );

            if (playaEmployees.length === 0) return;

            const allAssigned = playaEmployees.every(emp => {
                const shift = this.state.shifts[monthKey]?.[emp.id]?.[day];
                return shift !== undefined && shift !== null && shift !== '';
            });

            if (allAssigned) {
                if (App.isDailyTaskAssignmentValid(day, monthKey, playaEmployees, this.state.shifts, this.state.tasks)) {
                    return;
                }
                App.assignDailyTasks(day, monthKey, playaEmployees, this.state.shifts[monthKey]);
            } else {
                playaEmployees.forEach(emp => {
                    if (this.state.tasks[monthKey] && this.state.tasks[monthKey][emp.id]) {
                        delete this.state.tasks[monthKey][emp.id][day];
                    }
                });
            }
        } catch (e) {
            console.error('Error in checkAndAssignTasks:', e);
        }
    },

    saveTasksToFirebase(monthKey) {
        if (window.db) {
            window.db.ref(`scheduler_data/tasks/${monthKey}`).set(this.state.tasks[monthKey]);
        }
    },

    addOrganization(name) {
        if (!name) return;

        // Ensure we are working with the correct base list (including defaults if cloud was empty)
        if (this.state.organizations.length === 0 && App.ORGANIZATIONS) {
            this.state.organizations = [...App.ORGANIZATIONS];
        }

        if (this.state.organizations.includes(name)) {
            alert('La organización ya existe.');
            return;
        }

        this.state.organizations.push(name);
        this.emitChange('organizations', this.state.organizations);
    },

    deleteOrganization(name) {
        if (!confirm(`¿Estás seguro de eliminar la organización "${name}" y todos sus colaboradores?`)) return;

        this.state.organizations = this.state.organizations.filter(o => o !== name);
        this.state.employees = this.state.employees.filter(e => e.organization !== name);

        this.emitChange('organizations', this.state.organizations);
        this.emitChange('employees', this.state.employees);
    },

    propagateToNextMonth() {
        if (!this.state.currentOrg) {
            alert('Por favor seleccione una organización.');
            return;
        }

        // Strict filter for current organization
        const employees = this.state.employees.filter(e => e.organization === this.state.currentOrg);

        if (employees.length === 0) {
            alert('No hay colaboradores en esta organización.');
            return;
        }

        const year = this.state.currentDate.getFullYear();
        const month = this.state.currentDate.getMonth();

        const check = App.isMonthCompleteForOrg(employees, year, month, this.state.shifts);
        if (!check.valid) {
            alert(`No se puede propagar:\n${check.message}`);
            return;
        }

        const nextMonthDate = new Date(year, month + 1, 1);
        const nextMonthKey = App.getMonthKey(nextMonthDate);

        if (!this.state.shifts[nextMonthKey]) this.state.shifts[nextMonthKey] = {};

        const firebaseUpdates = {};

        employees.forEach(emp => {
            const predictions = App.predictNextMonthShifts(emp.id, year, month, this.state.shifts);
            if (predictions && Object.keys(predictions).length > 0) {
                this.state.shifts[nextMonthKey][emp.id] = predictions;
                // Prepare granular update for Firebase to avoid overwriting other orgs
                firebaseUpdates[emp.id] = predictions;
            }
        });

        // Save to Firebase (using granular update for specific employees)
        if (window.db && Object.keys(firebaseUpdates).length > 0) {
            console.log(`Granular sync for ${Object.keys(firebaseUpdates).length} employees in ${nextMonthKey} for Org: ${this.state.currentOrg}`);
            window.db.ref(`scheduler_data/shifts/${nextMonthKey}`).update(firebaseUpdates)
                .catch(err => console.error('Firebase propagation error:', err));
        }

        // Navigate to next month
        this.state.currentDate = nextMonthDate;
        this.emitChange(null, null, false); // Local update only as we already synced shifts
        alert(`Se han propagado los turnos para ${App.formatMonthYear(nextMonthDate)} (Solo sucursal ${this.state.currentOrg}).`);
    },

    moveShift(fromEmpId, fromDay, toEmpId, toDay, monthKey) {
        // Swap logic
        const shifts = this.state.shifts[monthKey] || {};
        const fromShift = shifts[fromEmpId]?.[fromDay];
        const toShift = shifts[toEmpId]?.[toDay];

        // If source is empty, do nothing (shouldn't happen via UI)
        if (!fromShift) return;

        // Perform validation on Target if needed (e.g. check rest time)
        // For simplicity, we skip strictly blocking validation on DragDrop but maybe warn?
        // Let's just move/swap.

        if (!this.state.shifts[monthKey][fromEmpId]) this.state.shifts[monthKey][fromEmpId] = {};
        if (!this.state.shifts[monthKey][toEmpId]) this.state.shifts[monthKey][toEmpId] = {};

        // Swap values
        this.state.shifts[monthKey][fromEmpId][fromDay] = toShift || null; // If toShift null, it clears source
        this.state.shifts[monthKey][toEmpId][toDay] = fromShift;

        // Clean up if null
        if (!this.state.shifts[monthKey][fromEmpId][fromDay]) delete this.state.shifts[monthKey][fromEmpId][fromDay];

        // Persist
        if (window.db) {
            const updates = {};
            updates[`scheduler_data/shifts/${monthKey}/${fromEmpId}/${fromDay}`] = toShift || null;
            updates[`scheduler_data/shifts/${monthKey}/${toEmpId}/${toDay}`] = fromShift;
            window.db.ref().update(updates);
        }

        this.logAction('MOVE_SHIFT', `Movido turno de Emp#${fromEmpId} (Día ${fromDay}) a Emp#${toEmpId} (Día ${toDay})`);
        this.emitChange();
    },

    addEmployee(name, organization, category, pin = '0000') {
        const newEmployee = {
            id: this.state.nextEmployeeId++,
            name: name,
            organization: organization,
            category: category,
            pin: pin
        };

        this.state.employees.push(newEmployee);
        this.logAction('ADD_EMPLOYEE', `Agregado colaborador ${name} (${category}) en ${organization}`);
        this.emitChange('employees', this.state.employees);
        return newEmployee;
    },

    logAction(action, details) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            action: action,
            details: details
        };
        this.state.logs.unshift(logEntry); // Add to beginning
        if (this.state.logs.length > 100) this.state.logs.pop(); // Keep last 100

        // Optional: Save logs to Firebase (maybe a separate path to avoid loading all logs on init)
        // For now, in-memory is fine as requested "for admins to see who modified" during session
    },

    validateEmployeePin(employeeId, pin) {
        const emp = this.state.employees.find(e => e.id === parseInt(employeeId));
        return emp && emp.pin === pin;
    },

    addDayOffRequest(employeeId, date, reason) {
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        // Store request in a separate node or integrated into shifts? 
        // Let's use a separate root key for requests
        const requestKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}-${employeeId}`;

        this.state.requests[requestKey] = reason;

        if (window.db) {
            window.db.ref(`scheduler_data/requests/${requestKey}`).set(reason);
        }

        this.emitChange();
    },

    getRequest(employeeId, date) {
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}-${employeeId}`;
        return this.state.requests[key];
    },

    updateEmployee(id, updates) {
        const index = this.state.employees.findIndex(e => e.id === id);
        if (index !== -1) {
            this.state.employees[index] = { ...this.state.employees[index], ...updates };
            this.emitChange();
            return true;
        }
        return false;
    },

    deleteEmployee(id) {
        const index = this.state.employees.findIndex(e => e.id === id);
        if (index !== -1) {
            this.state.employees.splice(index, 1);
            Object.keys(this.state.shifts).forEach(monthKey => {
                if (this.state.shifts[monthKey][id]) delete this.state.shifts[monthKey][id];
            });
            Object.keys(this.state.tasks).forEach(monthKey => {
                if (this.state.tasks[monthKey][id]) delete this.state.tasks[monthKey][id];
            });
            this.emitChange();
            return true;
        }
        return false;
    },

    listeners: [],
    subscribe(listener) {
        this.listeners.push(listener);
    },
    emitChange(path, value, sync = true) {
        this.listeners.forEach(l => l(this.state));
        App.saveStore();
        if (sync && window.db && this.state.isLoaded) {
            App.saveToFirebase(path, value);
        }
    }
};

App.saveToFirebase = function (path, value) {
    if (!window.db || !App.store.state.isLoaded) return;

    if (path) {
        window.db.ref('scheduler_data/' + path).set(value)
            .catch(err => console.error('Firebase save error:', err));
    } else {
        const syncData = {
            employees: App.store.state.employees,
            shifts: App.store.state.shifts,
            tasks: App.store.state.tasks,
            nextEmployeeId: App.store.state.nextEmployeeId,
            organizations: App.store.state.organizations
        };
        window.db.ref('scheduler_data').set(syncData)
            .catch(err => console.error('Firebase save error:', err));
    }
};

App.normalizeFirebaseData = function (data, path = '') {
    if (!data || typeof data !== 'object') return data;
    if (Array.isArray(data)) {
        if (path.endsWith('employees') || path.endsWith('organizations')) {
            return data.filter(i => i !== undefined && i !== null).map(i => App.normalizeFirebaseData(i, path));
        }
        const obj = {};
        data.forEach((val, idx) => {
            if (val !== undefined && val !== null) {
                obj[idx] = App.normalizeFirebaseData(val, path + '/' + idx);
            }
        });
        return obj;
    }
    const normalized = {};
    Object.keys(data).forEach(key => {
        normalized[key] = App.normalizeFirebaseData(data[key], path ? path + '/' + key : key);
    });
    return normalized;
};

App.initStore = function () {
    const saved = localStorage.getItem('shift_scheduler_data');
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            App.store.state.currentOrg = parsed.currentOrg || null;
            App.store.state.currentDate = new Date(parsed.currentDate || new Date());
            App.store.state.currentFilter = parsed.currentFilter || 'ALL';
            App.store.state.isAdmin = parsed.isAdmin || false;
        } catch (e) {
            console.error('Failed to load local context', e);
        }
    }

    if (window.db) {
        console.log('Connecting to Firebase...');
        window.db.ref('scheduler_data').on('value', (snapshot) => {
            const rawData = snapshot.val();
            if (rawData) {
                const data = App.normalizeFirebaseData(rawData);
                App.store.state.employees = Array.isArray(data.employees) ? data.employees : (data.employees ? Object.values(data.employees) : []);
                App.store.state.shifts = data.shifts || {};
                App.store.state.tasks = data.tasks || {};

                // Organization logic: prioritize cloud list, fallback to defaults
                const cloudOrgs = Array.isArray(data.organizations) ? data.organizations : (data.organizations ? Object.values(data.organizations) : []);
                if (cloudOrgs.length > 0) {
                    App.store.state.organizations = cloudOrgs;
                } else if (App.ORGANIZATIONS) {
                    App.store.state.organizations = [...App.ORGANIZATIONS];
                }

                const maxId = App.store.state.employees.reduce((max, e) => Math.max(max, e.id), 499);
                App.store.state.nextEmployeeId = Math.max(data.nextEmployeeId || 500, maxId + 1);
                App.store.state.isLoaded = true;
                App.store.listeners.forEach(l => l(App.store.state));
            } else {
                App.store.state.isLoaded = true;
                App.seedStore();
            }
        });
    } else {
        App.store.state.isLoaded = true;
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                App.store.state = { ...App.store.state, ...parsed };
                App.store.state.currentDate = new Date(parsed.currentDate || new Date());
                if (!App.store.state.organizations || App.store.state.organizations.length === 0) {
                    App.store.state.organizations = [...App.ORGANIZATIONS];
                }
            } catch (e) { App.seedStore(); }
        } else { App.seedStore(); }
    }
};

App.seedStore = function () {
    const dummyEmployees = [
        { id: 1, name: 'Del Rio Federico', organization: 'QQN', category: App.CATEGORIES.PLAYA },
        { id: 2, name: 'Escobar Maximiliano', organization: 'QQN', category: App.CATEGORIES.PLAYA },
        { id: 3, name: 'Hanson Luciano', organization: 'QQN', category: App.CATEGORIES.PLAYA },
        { id: 4, name: 'Hernandez Aron', organization: 'QQN', category: App.CATEGORIES.PLAYA },
        { id: 5, name: 'Laborte Miguel', organization: 'QQN', category: App.CATEGORIES.PLAYA },
        { id: 6, name: 'Parada David', organization: 'QQN', category: App.CATEGORIES.PLAYA },
        { id: 7, name: 'Rodriguez Benjamin', organization: 'QQN', category: App.CATEGORIES.PLAYA },
        { id: 8, name: 'Romano Cerola', organization: 'QQN', category: App.CATEGORIES.PLAYA },
        { id: 9, name: 'Maria Garcia', organization: 'CR88', category: App.CATEGORIES.FULL },
        { id: 10, name: 'Carlos Lopez', organization: 'CR88', category: App.CATEGORIES.PLAYA },
        { id: 11, name: 'Ana Martinez', organization: 'VR', category: App.CATEGORIES.ADMIN }
    ];
    App.store.state.employees = dummyEmployees;
    App.store.state.organizations = [...App.ORGANIZATIONS];
    App.store.state.nextEmployeeId = 500;
    App.store.state.shifts = {};
    App.store.state.tasks = {};
    if (window.db) App.saveToFirebase();
    App.saveStore();
};

App.saveStore = function () {
    const context = {
        currentOrg: App.store.state.currentOrg,
        currentDate: App.store.state.currentDate,
        currentFilter: App.store.state.currentFilter,
        isAdmin: App.store.state.isAdmin
    };
    localStorage.setItem('shift_scheduler_data', JSON.stringify(context));
};
