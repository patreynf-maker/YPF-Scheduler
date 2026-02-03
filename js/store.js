window.App = window.App || {};

App.store = {
    state: {
        currentOrg: null,
        currentDate: new Date(),
        isAdmin: false,
        employees: [],
        shifts: {},
        tasks: {},
        currentFilter: 'ALL',
        nextEmployeeId: 500
    },

    getEmployeesByOrg(org) {
        return this.state.employees.filter(e => e.organization === org)
            .sort((a, b) => a.name.localeCompare(b.name));
    },

    setOrg(org) {
        this.state.currentOrg = org;
        this.emitChange();
    },

    setAdmin(status) {
        this.state.isAdmin = status;
        this.emitChange();
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
                console.log(`Auto-assigning tasks for day ${day}...`);
                App.assignDailyTasks(day, monthKey, playaEmployees, this.state.shifts[monthKey]);
            } else {
                // Modified: Warn that tasks won't be assigned until all have shifts
                // We only alert if there's at least one shift assigned to avoid spamming on empty days
                const someAssigned = playaEmployees.some(emp => {
                    const shift = this.state.shifts[monthKey]?.[emp.id]?.[day];
                    return shift !== undefined && shift !== null && shift !== '';
                });

                if (someAssigned) {
                    console.log(`Day ${day} incomplete, clearing partial tasks.`);
                }

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
                if (this.state.shifts[monthKey][id]) {
                    delete this.state.shifts[monthKey][id];
                }
            });

            Object.keys(this.state.tasks).forEach(monthKey => {
                if (this.state.tasks[monthKey][id]) {
                    delete this.state.tasks[monthKey][id];
                }
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
    emitChange(path, value) {
        this.listeners.forEach(l => l(this.state));
        if (window.db) {
            App.saveToFirebase(path, value);
        } else {
            App.saveStore();
        }
    }
};

App.saveToFirebase = function (path, value) {
    if (!window.db) return;

    if (path) {
        // Granular update
        window.db.ref('scheduler_data/' + path).set(value)
            .catch(err => console.error('Firebase save error:', err));
    } else {
        // Full state sync (used for deletions or initial setup)
        const syncData = {
            employees: App.store.state.employees,
            shifts: App.store.state.shifts,
            tasks: App.store.state.tasks,
            nextEmployeeId: App.store.state.nextEmployeeId
        };
        window.db.ref('scheduler_data').set(syncData)
            .catch(err => console.error('Firebase save error:', err));
    }
};

// Helper to normalize Firebase data (converts potential arrays back to objects)
App.normalizeFirebaseData = function (data, path = '') {
    if (!data || typeof data !== 'object') return data;

    // We want to keep 'employees' as a real Array if it comes as one
    if (Array.isArray(data)) {
        if (path.endsWith('employees')) {
            return data.filter(i => i !== undefined && i !== null).map(i => App.normalizeFirebaseData(i, path));
        }

        // Otherwise, convert array with potential holes/indices to Object
        const obj = {};
        data.forEach((val, idx) => {
            if (val !== undefined && val !== null) {
                obj[idx] = App.normalizeFirebaseData(val, path + '/' + idx);
            }
        });
        return obj;
    }

    // Recursively normalize children
    const normalized = {};
    Object.keys(data).forEach(key => {
        normalized[key] = App.normalizeFirebaseData(data[key], path ? path + '/' + key : key);
    });
    return normalized;
};

App.initStore = function () {
    // 1. Load context from localStorage (UI state only)
    const saved = localStorage.getItem('shift_scheduler_data');
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            // Only take local-only states
            App.store.state.currentOrg = parsed.currentOrg || null;
            App.store.state.currentDate = new Date(parsed.currentDate || new Date());
            App.store.state.currentFilter = parsed.currentFilter || 'ALL';
        } catch (e) {
            console.error('Failed to load local context', e);
        }
    }

    // 2. Sync with Firebase
    if (window.db) {
        console.log('Connecting to Firebase...');
        window.db.ref('scheduler_data').on('value', (snapshot) => {
            const rawData = snapshot.val();
            if (rawData) {
                console.log('Firebase data received - Normalizing...');
                const data = App.normalizeFirebaseData(rawData);

                App.store.state.employees = Array.isArray(data.employees) ? data.employees :
                    (data.employees ? Object.values(data.employees) : []);
                App.store.state.shifts = data.shifts || {};
                App.store.state.tasks = data.tasks || {};
                // Ensure nextEmployeeId is higher than any existing employee id
                const maxId = App.store.state.employees.reduce((max, e) => Math.max(max, e.id), 499);
                App.store.state.nextEmployeeId = Math.max(data.nextEmployeeId || 500, maxId + 1);

                // Notify listeners to re-render
                App.store.listeners.forEach(l => l(App.store.state));
            } else {
                console.log('Firebase empty, seeding...');
                App.seedStore();
            }
        });
    } else {
        // Fallback to purely local if Firebase fails
        console.warn('Firebase not available, using localStorage fallback');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                App.store.state = { ...App.store.state, ...parsed };
                App.store.state.currentDate = new Date(parsed.currentDate || new Date());
            } catch (e) {
                App.seedStore();
            }
        } else {
            App.seedStore();
        }
    }
};

App.seedStore = function () {
    console.log('Seeding initial data...');
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
    App.store.state.nextEmployeeId = 12;
    App.store.state.shifts = {};
    App.store.state.tasks = {};
    App.saveStore();
};

App.saveStore = function () {
    // Save only UI context states to local
    const context = {
        currentOrg: App.store.state.currentOrg,
        currentDate: App.store.state.currentDate,
        currentFilter: App.store.state.currentFilter
    };
    localStorage.setItem('shift_scheduler_data', JSON.stringify(context));
};
