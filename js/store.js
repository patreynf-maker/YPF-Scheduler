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
        nextEmployeeId: 100
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

    // Shift Management with Auto-Task Trigger
    setShift(employeeId, day, shiftCode, monthKey) {
        if (!this.state.shifts[monthKey]) this.state.shifts[monthKey] = {};
        if (!this.state.shifts[monthKey][employeeId]) this.state.shifts[monthKey][employeeId] = {};

        this.state.shifts[monthKey][employeeId][day] = shiftCode;

        // Check if we should trigger auto-assignment for this day
        this.checkAndAssignTasks(day, monthKey);

        this.emitChange();
    },

    removeShift(employeeId, day, monthKey) {
        if (this.state.shifts[monthKey] && this.state.shifts[monthKey][employeeId]) {
            delete this.state.shifts[monthKey][employeeId][day];

            // Also remove any task assigned to this day
            if (this.state.tasks[monthKey] && this.state.tasks[monthKey][employeeId]) {
                delete this.state.tasks[monthKey][employeeId][day];
            }

            this.checkAndAssignTasks(day, monthKey);
            this.emitChange();
        }
    },

    checkAndAssignTasks(day, monthKey) {
        if (!this.state.currentOrg) return;

        // Only run logic for PLAYA employees of current org
        const playaEmployees = this.state.employees.filter(e =>
            e.organization === this.state.currentOrg &&
            e.category === App.CATEGORIES.PLAYA
        );

        if (playaEmployees.length === 0) return;

        // Check if ALL Playa employees have a shift assigned (working or non-working) on this day
        const allAssigned = playaEmployees.every(emp => {
            const shift = this.state.shifts[monthKey]?.[emp.id]?.[day];
            return shift !== undefined && shift !== null && shift !== '';
        });

        // If all assigned, trigger task distribution
        if (allAssigned) {
            console.log(`Auto-assigning tasks for day ${day}...`);
            App.assignDailyTasks(day, monthKey, playaEmployees, this.state.shifts[monthKey]);
        } else {
            // Optional: Clear tasks for this day if the day becomes incomplete? 
            // Ideally yes, to ensure validity, but might be annoying. 
            // Let's clear them to enforce the "only when full" rule strictness and re-calculate when full again.
            playaEmployees.forEach(emp => {
                if (this.state.tasks[monthKey] && this.state.tasks[monthKey][emp.id]) {
                    delete this.state.tasks[monthKey][emp.id][day];
                }
            });
        }
    },

    // Employee CRUD
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

            // Clean up shifts and tasks for this employee
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
    emitChange() {
        this.listeners.forEach(l => l(this.state));

        // Save to Firebase if initialized
        if (window.db) {
            App.saveToFirebase();
        } else {
            App.saveStore(); // Fallback to local
        }
    }
};

App.saveToFirebase = function () {
    if (!window.db) return;

    // We only sync employees, shifts and tasks.
    // currentOrg, currentDate, isAdmin are local state.
    const syncData = {
        employees: App.store.state.employees,
        shifts: App.store.state.shifts,
        tasks: App.store.state.tasks,
        nextEmployeeId: App.store.state.nextEmployeeId
    };

    window.db.ref('scheduler_data').set(syncData)
        .catch(err => console.error('Firebase save error:', err));
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
            const data = snapshot.val();
            if (data) {
                console.log('Firebase data received');
                App.store.state.employees = data.employees || [];
                App.store.state.shifts = data.shifts || {};
                App.store.state.tasks = data.tasks || {};
                App.store.state.nextEmployeeId = data.nextEmployeeId || 100;

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
