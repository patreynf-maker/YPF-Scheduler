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

    setAdmin(status) {
        this.state.isAdmin = status;
        this.emitChange(null, null, false);
    },

    setShift(employeeId, day, shiftCode, monthKey) {
        try {
            if (!this.state.shifts[monthKey]) this.state.shifts[monthKey] = {};
            if (!this.state.shifts[monthKey][employeeId]) this.state.shifts[monthKey][employeeId] = {};

            this.state.shifts[monthKey][employeeId][day] = shiftCode;

            this.checkAndAssignTasks(day, monthKey);

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
        if (!this.state.currentOrg) return;
        const employees = this.getEmployeesByOrg(this.state.currentOrg);

        const year = this.state.currentDate.getFullYear();
        const month = this.state.currentDate.getMonth();

        if (!App.isMonthCompleteForOrg(employees, year, month, this.state.shifts)) {
            alert('Error: La planilla del mes actual debe estar completa para todos los colaboradores antes de continuar.');
            return;
        }

        const nextMonthDate = new Date(year, month + 1, 1);
        const nextMonthKey = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, '0')}`;

        if (!this.state.shifts[nextMonthKey]) this.state.shifts[nextMonthKey] = {};

        employees.forEach(emp => {
            const predictions = App.predictNextMonthShifts(emp.id, year, month, this.state.shifts);
            if (Object.keys(predictions).length > 0) {
                this.state.shifts[nextMonthKey][emp.id] = predictions;
            }
        });

        // Save to Firebase (using full save as it's a new month key usually)
        if (window.db) {
            window.db.ref(`scheduler_data/shifts/${nextMonthKey}`).set(this.state.shifts[nextMonthKey]);
        }

        // Navigate to next month
        this.state.currentDate = nextMonthDate;
        this.emitChange();
        alert(`Se han propagado los turnos para ${App.formatMonthYear(nextMonthDate)}.`);
    },

    addEmployee(name, organization, category) {
        const newEmployee = {
            id: this.state.nextEmployeeId++,
            name: name,
            organization: organization,
            category: category
        };
        this.state.employees.push(newEmployee);
        this.emitChange();
        return newEmployee;
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
