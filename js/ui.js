window.App = window.App || {};

App.renderApp = function () {
    const app = document.getElementById('app');

    App.store.subscribe((state) => {
        App.render(app, state);
    });

    App.render(app, App.store.state);
};

App.render = function (container, state) {
    // Save scroll position of the grid if it exists
    const grid = container.querySelector('.grid-container');
    const scrollLeft = grid ? grid.scrollLeft : 0;
    const scrollTop = grid ? grid.scrollTop : 0;

    container.innerHTML = '';

    if (!state.currentOrg) {
        App.renderOrgSelector(container);
    } else {
        App.renderScheduler(container, state);

        // Restore scroll position
        const newGrid = container.querySelector('.grid-container');
        if (newGrid) {
            newGrid.scrollLeft = scrollLeft;
            newGrid.scrollTop = scrollTop;
        }
    }
};

App.renderOrgSelector = function (container) {
    const state = App.store.state;
    const wrapper = document.createElement('div');
    wrapper.className = 'org-selector-container';

    // Header with Admin Toggle
    const headerRow = document.createElement('div');
    headerRow.className = 'org-selector-header';

    const title = document.createElement('h1');
    title.textContent = 'Planilla de Horarios';

    const adminBtn = document.createElement('button');
    adminBtn.className = `btn-admin-login ${state.isAdmin ? 'active' : ''}`;
    adminBtn.innerHTML = state.isAdmin ? '🔓 Admin Activo' : '🔒 Acceso Admin';
    adminBtn.onclick = () => App.toggleAdmin(state);

    headerRow.appendChild(adminBtn);
    headerRow.appendChild(title);
    wrapper.appendChild(headerRow);

    // Add Org Form (Admin Only)
    if (state.isAdmin) {
        const addOrgForm = document.createElement('div');
        addOrgForm.className = 'add-org-form';
        addOrgForm.innerHTML = `
            <input type="text" id="new-org-name" placeholder="Nueva sucursal..." maxlength="20">
            <button id="btn-add-org">Agregar</button>
        `;

        const input = addOrgForm.querySelector('#new-org-name');
        const btn = addOrgForm.querySelector('#btn-add-org');

        const handleAdd = () => {
            const name = input.value.trim().toUpperCase();
            if (name) {
                App.store.addOrganization(name);
                input.value = '';
            }
        };

        btn.onclick = handleAdd;
        input.onkeypress = (e) => { if (e.key === 'Enter') handleAdd(); };

        wrapper.appendChild(addOrgForm);
    }

    const grid = document.createElement('div');
    grid.className = 'org-grid';

    // Use dynamic organizations from store
    const orgs = state.organizations && state.organizations.length > 0
        ? state.organizations
        : (App.ORGANIZATIONS || []);

    orgs.forEach(org => {
        const cardWrapper = document.createElement('div');
        cardWrapper.className = 'org-card-wrapper';

        const btn = document.createElement('button');
        btn.className = 'org-card';
        btn.textContent = org;
        btn.onclick = () => App.store.setOrg(org);
        cardWrapper.appendChild(btn);

        if (state.isAdmin) {
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'org-delete-btn';
            deleteBtn.innerHTML = '×';
            deleteBtn.title = `Eliminar ${org}`;
            deleteBtn.onclick = (e) => {
                e.stopPropagation();
                App.store.deleteOrganization(org);
            };
            cardWrapper.appendChild(deleteBtn);
        }

        grid.appendChild(cardWrapper);
    });

    wrapper.appendChild(grid);
    container.appendChild(wrapper);
};

App.renderScheduler = function (container, state) {
    const days = App.getDaysInMonth(state.currentDate);

    // Filter
    const filter = state.currentFilter || 'ALL';
    let employees = App.store.getEmployeesByOrg(state.currentOrg);
    if (filter !== 'ALL') {
        employees = employees.filter(e => e.category === filter);
    }

    // Header
    const header = document.createElement('header');
    header.className = 'app-header';
    header.innerHTML = `
        <div class="header-main">
            <div class="title-row">
                <h1>Planilla de Horarios</h1>
                <button id="btn-admin" class="${state.isAdmin ? 'active' : ''}">
                    ${state.isAdmin ? '🔓 Salir Admin' : '🔒 Admin'}
                </button>
            </div>
            <div class="header-subrow">
                <span class="org-badge clickable" title="Cambiar Organización">${state.currentOrg}</span>
                <div class="month-nav">
                    <button id="btn-prev-month">&lt;</button>
                    <span class="date-display">${App.formatMonthYear(state.currentDate)}</span>
                    <button id="btn-next-month">&gt;</button>
                </div>
            </div>
        </div>
        <div class="controls">
            ${state.isAdmin ? '<button id="btn-employees">👥 Colaboradores</button>' : ''}
            ${state.isAdmin ? '<button id="btn-tasks">🎲 Asignar Tareas</button>' : ''}
            ${state.isAdmin ? '<button id="btn-export">📥 Exportar</button>' : ''}
        </div>
    `;

    header.querySelector('.org-badge').onclick = () => App.store.setOrg(null);
    header.querySelector('#btn-admin').onclick = () => App.toggleAdmin(state);
    if (header.querySelector('#btn-export')) {
        header.querySelector('#btn-export').onclick = () => App.exportToCSV(state.currentOrg, state.currentDate, employees, state.shifts, state.tasks);
    }

    header.querySelector('#btn-prev-month').onclick = () => App.changeMonth(-1);
    header.querySelector('#btn-next-month').onclick = () => App.changeMonth(1);

    if (header.querySelector('#btn-employees')) {
        header.querySelector('#btn-employees').onclick = () => App.showEmployeeManager(state.currentOrg);
    }

    if (header.querySelector('#btn-tasks')) {
        header.querySelector('#btn-tasks').onclick = () => {
            if (confirm('¿Generar asignación de tareas automáticas para todo el mes? Esto sobrescribirá las tareas existentes.')) {
                App.assignTasksForMonth(state.currentDate.getFullYear(), state.currentDate.getMonth());
            }
        };
    }

    // Filter Bar
    const filterBar = document.createElement('div');
    filterBar.className = 'filter-bar';
    filterBar.innerHTML = `
        <button class="filter-btn ${filter === 'ALL' ? 'active' : ''}" data-filter="ALL">Todos</button>
        <button class="filter-btn ${filter === App.CATEGORIES.ADMIN ? 'active' : ''}" data-filter="${App.CATEGORIES.ADMIN}">Administración</button>
        <button class="filter-btn ${filter === App.CATEGORIES.PLAYA ? 'active' : ''}" data-filter="${App.CATEGORIES.PLAYA}">Playa</button>
        <button class="filter-btn ${filter === App.CATEGORIES.FULL ? 'active' : ''}" data-filter="${App.CATEGORIES.FULL}">Full</button>
    `;

    filterBar.querySelectorAll('.filter-btn').forEach(btn => {
        btn.onclick = () => {
            App.store.state.currentFilter = btn.dataset.filter;
            App.store.emitChange(null, null, false);
        };
    });

    // Legends
    const legends = App.renderLegends(filter);

    // Grid Container
    const gridContainer = document.createElement('div');
    gridContainer.className = 'grid-container';

    // Table
    const table = document.createElement('table');
    table.className = 'scheduler-table';

    // Table Head
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');

    // Empty corner cell
    const cornerTh = document.createElement('th');
    cornerTh.className = 'sticky-col corner-header';
    cornerTh.textContent = 'Colaborador';
    headerRow.appendChild(cornerTh);

    // Day headers
    days.forEach(day => {
        const th = document.createElement('th');
        th.className = 'day-header';
        th.innerHTML = `
            <div class="day-num">${day.date}</div>
            <div class="day-name">${day.dayName}</div>
        `;
        headerRow.appendChild(th);
    });

    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Table Body
    const tbody = document.createElement('tbody');

    // Group employees by category
    const categories = [App.CATEGORIES.PLAYA, App.CATEGORIES.FULL, App.CATEGORIES.ADMIN];

    categories.forEach(category => {
        const categoryEmployees = employees.filter(e => e.category === category);

        if (categoryEmployees.length > 0) {
            // Category header row
            const categoryRow = document.createElement('tr');
            categoryRow.className = 'category-header-row';
            categoryRow.dataset.category = category;
            categoryRow.dataset.expanded = 'true';

            const categoryCell = document.createElement('td');
            categoryCell.className = 'category-header-cell sticky-col';
            categoryCell.colSpan = days.length + 1;
            categoryCell.innerHTML = `
                <span class="category-arrow">▼</span>
                <span class="category-name">${category}</span>
                <span class="category-count">${categoryEmployees.length}</span>
            `;

            // Toggle collapse/expand
            categoryCell.onclick = () => {
                const isExpanded = categoryRow.dataset.expanded === 'true';
                categoryRow.dataset.expanded = isExpanded ? 'false' : 'true';
                categoryCell.querySelector('.category-arrow').textContent = isExpanded ? '▶' : '▼';

                // Toggle visibility of employee rows
                categoryEmployees.forEach(emp => {
                    const empRow = tbody.querySelector(`tr[data-employee-id="${emp.id}"]`);
                    if (empRow) {
                        empRow.style.display = isExpanded ? 'none' : 'table-row';
                    }
                });
            };

            categoryRow.appendChild(categoryCell);
            tbody.appendChild(categoryRow);

            // Employee rows
            categoryEmployees.forEach(emp => {
                const tr = document.createElement('tr');
                tr.className = 'employee-row';
                tr.dataset.employeeId = emp.id;
                tr.dataset.category = category;

                // Employee Name
                const nameTd = document.createElement('td');
                nameTd.className = 'sticky-col emp-name';
                nameTd.textContent = emp.name;
                nameTd.title = emp.category;
                nameTd.onclick = () => App.showCalendarView(emp, state);
                tr.appendChild(nameTd);

                // Days
                days.forEach(day => {
                    const td = document.createElement('td');
                    td.className = 'shift-cell';

                    // Get Shift & Task
                    const monthKey = `${state.currentDate.getFullYear()}-${state.currentDate.getMonth()}`;
                    const shiftCode = state.shifts[monthKey]?.[emp.id]?.[day.date];
                    const taskNum = state.tasks[monthKey]?.[emp.id]?.[day.date];


                    if (shiftCode) {
                        let shiftInfo = null;
                        if (emp.category) {
                            const catKey = emp.category === App.CATEGORIES.PLAYA ? 'PLAYA' : (emp.category === App.CATEGORIES.FULL ? 'FULL' : null);
                            if (catKey && App.SHIFT_TYPES[catKey]) {
                                shiftInfo = App.SHIFT_TYPES[catKey].find(s => s.code === shiftCode);
                            }
                        }
                        if (!shiftInfo) {
                            shiftInfo = [...App.SHIFT_TYPES.PLAYA, ...App.SHIFT_TYPES.FULL].find(s => s.code === shiftCode);
                        }

                        if (shiftInfo) {
                            td.style.backgroundColor = shiftInfo.color;
                            td.textContent = shiftInfo.label;
                            td.title = shiftInfo.label;
                        } else {
                            td.textContent = shiftCode;
                        }

                        // Task Indicator Badge
                        if (taskNum && emp.category === App.CATEGORIES.PLAYA) {
                            const badge = document.createElement('div');
                            badge.className = 'task-badge-main';
                            badge.style.backgroundColor = App.TASK_COLORS[taskNum];
                            badge.style.color = App.getTaskTextColor(shiftCode, taskNum);
                            badge.textContent = taskNum;
                            badge.title = `Tarea ${taskNum}: ${App.TASKS_PLAYA[taskNum]}`;
                            td.appendChild(badge);
                        }
                    }

                    td.onclick = () => App.handleCellClick(emp, day, monthKey, state);

                    tr.appendChild(td);
                });

                tbody.appendChild(tr);
            });
        }
    });

    table.appendChild(tbody);
    gridContainer.appendChild(table);

    container.appendChild(header);
    container.appendChild(filterBar);
    if (legends) container.appendChild(legends);
    container.appendChild(gridContainer);
};

App.renderLegends = function (filter) {
    if (filter === 'ALL' || filter === App.CATEGORIES.ADMIN) {
        return null;
    }

    const section = document.createElement('div');
    section.className = 'legends-section';

    // Shift Legend
    const shiftLegend = document.createElement('div');
    shiftLegend.className = 'legend-container';

    const shiftTitle = document.createElement('div');
    shiftTitle.className = 'legend-title';
    shiftTitle.textContent = filter === App.CATEGORIES.PLAYA ? 'Turnos Playa' : 'Turnos Full';

    const shiftItems = document.createElement('div');
    shiftItems.className = 'legend-items';

    let shiftsToShow = filter === App.CATEGORIES.PLAYA ? App.SHIFT_TYPES.PLAYA : App.SHIFT_TYPES.FULL;

    shiftsToShow.forEach(shift => {
        const item = document.createElement('div');
        item.className = 'legend-item';
        item.style.backgroundColor = shift.color;
        item.textContent = shift.label;
        shiftItems.appendChild(item);
    });

    shiftLegend.appendChild(shiftTitle);
    shiftLegend.appendChild(shiftItems);
    section.appendChild(shiftLegend);

    // Task Legend (only for Playa)
    if (filter === App.CATEGORIES.PLAYA) {
        const taskLegend = document.createElement('div');
        taskLegend.className = 'legend-container';

        const taskTitle = document.createElement('div');
        taskTitle.className = 'legend-title';
        taskTitle.textContent = 'Asignación de Tareas Playa';

        const taskItems = document.createElement('div');
        taskItems.className = 'legend-items';

        Object.keys(App.TASKS_PLAYA).forEach(num => {
            const item = document.createElement('div');
            item.className = 'legend-item';
            item.style.backgroundColor = 'white';
            item.style.color = '#333';
            item.style.border = '1px solid #ddd';
            item.innerHTML = `
                <div class="task-badge-main" style="position: relative; top: auto; right: auto; margin-right: 8px; background-color: ${App.TASK_COLORS[num]}; color: ${App.getTaskTextColor(null, num)}; width: 24px; height: 24px; font-size: 0.8rem;">${num}</div>
                ${App.TASKS_PLAYA[num]}
            `;
            taskItems.appendChild(item);
        });

        taskLegend.appendChild(taskTitle);
        taskLegend.appendChild(taskItems);
        section.appendChild(taskLegend);
    }

    return section;
};

App.changeMonth = function (delta) {
    const newDate = new Date(App.store.state.currentDate);
    newDate.setMonth(newDate.getMonth() + delta);
    App.store.state.currentDate = newDate;
    App.store.emitChange();
};

App.toggleAdmin = function (state) {
    if (state.isAdmin) {
        App.store.setAdmin(false);
    } else {
        const pass = prompt("Ingrese contraseña de administrador:");
        if (pass === App.ADMIN_PASSWORD) {
            App.store.setAdmin(true);
        } else if (pass !== null) {
            alert("Contraseña incorrecta");
        }
    }

    // If we are on the org selector, we want to stay there but refresh the view
    if (state.currentOrg === null) {
        App.render(state);
    }
};

// Helper to determine if task badge text should be black or white for contrast
App.getTaskTextColor = function (shiftCode, taskNum) {
    return 'black';
};

App.handleCellClick = function (employee, day, monthKey, state) {
    if (!state.isAdmin) return;

    let options = [];
    if (employee.category === App.CATEGORIES.PLAYA) {
        options = App.SHIFT_TYPES.PLAYA;
    } else if (employee.category === App.CATEGORIES.FULL) {
        options = App.SHIFT_TYPES.FULL;
    } else {
        alert("Este colaborador no tiene turnos asignables (Administracion).");
        return;
    }

    App.showShiftPickerModal(employee, day, options);
};

App.showShiftPickerModal = function (employee, day, options) {
    let modal = document.getElementById('shift-picker-modal');
    if (modal) modal.remove();

    modal = document.createElement('div');
    modal.id = 'shift-picker-modal';
    modal.className = 'modal-overlay';
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };

    const content = document.createElement('div');
    content.className = 'modal-content';

    const title = document.createElement('h3');
    title.textContent = 'Asignar turno';

    const subtitle = document.createElement('div');
    subtitle.className = 'modal-subtitle';
    subtitle.textContent = `${employee.name} - Día ${day.date}`;

    const grid = document.createElement('div');
    grid.className = 'shift-options-grid';

    options.forEach(opt => {
        const btn = document.createElement('button');
        btn.className = 'shift-option-btn';
        btn.textContent = opt.label;
        btn.style.backgroundColor = opt.color;

        btn.onclick = () => {
            try {
                const monthKey = `${App.store.state.currentDate.getFullYear()}-${App.store.state.currentDate.getMonth()}`;
                console.log(`Setting shift: EmpId=${employee.id}, Day=${day.date}, Code=${opt.code}, Month=${monthKey}`);
                App.store.setShift(employee.id, day.date, opt.code, monthKey);

                // New logic: Check if day is complete. If not, inform user.
                const updatedState = App.store.state;
                const playaEmployees = updatedState.employees.filter(e =>
                    e.organization === updatedState.currentOrg &&
                    e.category === App.CATEGORIES.PLAYA
                );

                const allAssigned = playaEmployees.every(emp => {
                    const shift = updatedState.shifts[monthKey]?.[emp.id]?.[day.date];
                    return shift !== undefined && shift !== null && shift !== '';
                });

                if (!allAssigned) {
                    console.log("Día aún incompleto, no se asignarán tareas hasta completar todos los colaboradores.");
                }

                modal.remove();
            } catch (err) {
                console.error('Error assigning shift:', err);
                alert('Error al asignar turno: ' + err.message);
            }
        };
        grid.appendChild(btn);
    });

    const clearBtn = document.createElement('button');
    clearBtn.className = 'shift-option-btn clear-btn';
    clearBtn.textContent = 'Quitar turno';
    clearBtn.onclick = () => {
        const monthKey = `${App.store.state.currentDate.getFullYear()}-${App.store.state.currentDate.getMonth()}`;
        App.store.removeShift(employee.id, day.date, monthKey);
        modal.remove();
    };

    const closeBtn = document.createElement('button');
    closeBtn.className = 'close-modal-btn';
    closeBtn.textContent = 'Cancelar';
    closeBtn.onclick = () => modal.remove();

    content.appendChild(title);
    content.appendChild(subtitle);
    content.appendChild(grid);
    content.appendChild(clearBtn);
    content.appendChild(closeBtn);
    modal.appendChild(content);

    document.body.appendChild(modal);
};

App.showCalendarView = function (employee, state) {
    let modal = document.getElementById('calendar-modal');
    if (modal) modal.remove();

    modal = document.createElement('div');
    modal.id = 'calendar-modal';
    modal.className = 'modal-overlay';
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };

    const content = document.createElement('div');
    content.className = 'modal-content calendar-modal-content';

    const header = document.createElement('div');
    header.className = 'calendar-header';

    const headerLeft = document.createElement('div');
    headerLeft.className = 'calendar-header-left';
    headerLeft.innerHTML = `
        <h3>${employee.name}</h3>
        <div class="calendar-category-badge">${employee.category}</div>
    `;

    const headerRight = document.createElement('span');
    headerRight.textContent = App.formatMonthYear(state.currentDate);

    const closeBtn = document.createElement('button');
    closeBtn.className = 'close-btn-x';
    closeBtn.innerHTML = '&times;';
    closeBtn.onclick = () => modal.remove();

    header.appendChild(headerLeft);
    header.appendChild(headerRight);
    header.appendChild(closeBtn);

    // Task Legend (only for Playa)
    if (employee.category === App.CATEGORIES.PLAYA) {
        const taskLegendDiv = document.createElement('div');
        taskLegendDiv.className = 'calendar-task-legend';

        const legendTitle = document.createElement('div');
        legendTitle.className = 'calendar-task-legend-title';
        legendTitle.textContent = 'Asignación de Tareas';

        const legendItems = document.createElement('div');
        legendItems.className = 'calendar-task-items';

        Object.keys(App.TASKS_PLAYA).forEach(num => {
            const item = document.createElement('div');
            item.className = 'calendar-task-item';
            item.innerHTML = `
                <div class="task-badge-main" style="background-color: ${App.TASK_COLORS[num]}; position: relative; top: 0; right: 0; margin-right: 8px;">${num}</div>
                ${App.TASKS_PLAYA[num]}
            `;
            legendItems.appendChild(item);
        });

        taskLegendDiv.appendChild(legendTitle);
        taskLegendDiv.appendChild(legendItems);
        content.appendChild(header);
        content.appendChild(taskLegendDiv);
    } else {
        content.appendChild(header);
    }

    const grid = document.createElement('div');
    grid.className = 'calendar-grid';

    const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    dayNames.forEach(d => {
        const div = document.createElement('div');
        div.className = 'cal-day-name';
        div.textContent = d;
        grid.appendChild(div);
    });

    const year = state.currentDate.getFullYear();
    const month = state.currentDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayIndex = new Date(year, month, 1).getDay();

    for (let i = 0; i < firstDayIndex; i++) {
        const div = document.createElement('div');
        div.className = 'cal-day-empty';
        grid.appendChild(div);
    }

    const monthKey = `${year}-${month}`;
    const empShifts = state.shifts[monthKey]?.[employee.id] || {};
    const empTasks = state.tasks[monthKey]?.[employee.id] || {};

    for (let d = 1; d <= daysInMonth; d++) {
        const div = document.createElement('div');
        div.className = 'cal-day-cell';

        const shiftCode = empShifts[d];
        const taskNum = empTasks[d];

        if (shiftCode) {
            let shiftInfo = null;
            if (employee.category) {
                const catKey = employee.category === App.CATEGORIES.PLAYA ? 'PLAYA' : (employee.category === App.CATEGORIES.FULL ? 'FULL' : null);
                if (catKey && App.SHIFT_TYPES[catKey]) {
                    shiftInfo = App.SHIFT_TYPES[catKey].find(s => s.code === shiftCode);
                }
            }
            if (!shiftInfo) shiftInfo = [...App.SHIFT_TYPES.PLAYA, ...App.SHIFT_TYPES.FULL].find(s => s.code === shiftCode);

            const label = document.createElement('div');
            label.className = 'cal-shift-label';
            if (shiftInfo) {
                label.style.backgroundColor = shiftInfo.color;
                label.textContent = shiftInfo.label;
            } else {
                label.textContent = shiftCode;
            }

            // Date inside label
            const dateDiv = document.createElement('div');
            dateDiv.className = 'cal-date inside-shift';
            dateDiv.textContent = d;
            label.appendChild(dateDiv);

            // Badge inside label
            if (taskNum && employee.category === App.CATEGORIES.PLAYA) {
                const badge = document.createElement('div');
                badge.className = 'task-badge-main';
                badge.style.backgroundColor = App.TASK_COLORS[taskNum];
                badge.style.color = App.getTaskTextColor(shiftCode, taskNum);
                badge.textContent = taskNum;
                badge.title = `Tarea ${taskNum}`;
                label.appendChild(badge);
            }

            div.appendChild(label);
        } else {
            // No shift, just date
            const dateDiv = document.createElement('div');
            dateDiv.className = 'cal-date';
            dateDiv.textContent = d;
            div.appendChild(dateDiv);
        }

        grid.appendChild(div);
    }

    content.appendChild(grid);
    modal.appendChild(content);
    document.body.appendChild(modal);
};

// Employee Management
App.showEmployeeManager = function (currentOrg) {
    let modal = document.getElementById('employee-manager-modal');
    if (modal) modal.remove();

    modal = document.createElement('div');
    modal.id = 'employee-manager-modal';
    modal.className = 'modal-overlay employee-manager-modal';
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };

    const content = document.createElement('div');
    content.className = 'modal-content';

    // Header
    const header = document.createElement('div');
    header.className = 'employee-manager-header';
    header.innerHTML = `
        <h3>Gestión de Colaboradores - ${currentOrg}</h3>
        <button class="close-btn-x">&times;</button>
    `;
    header.querySelector('.close-btn-x').onclick = () => modal.remove();

    // Body
    const body = document.createElement('div');
    body.className = 'employee-manager-body';

    // Add Employee Section
    const addSection = document.createElement('div');
    addSection.className = 'employee-add-section';
    addSection.innerHTML = `
        <h4>Agregar Nuevo Colaborador</h4>
        <form class="employee-form" id="add-employee-form">
            <div class="form-group">
                <label>Nombre Completo</label>
                <input type="text" id="emp-name" required placeholder="Ej: Juan Pérez">
            </div>
            <div class="form-group">
                <label>Categoría</label>
                <select id="emp-category" required>
                    <option value="${App.CATEGORIES.PLAYA}">Playa</option>
                    <option value="${App.CATEGORIES.FULL}">Full</option>
                    <option value="${App.CATEGORIES.ADMIN}">Administración</option>
                </select>
            </div>
            <button type="submit" class="btn-add-employee">+ Agregar</button>
        </form>
    `;

    addSection.querySelector('#add-employee-form').onsubmit = (e) => {
        e.preventDefault();
        const name = addSection.querySelector('#emp-name').value.trim();
        const category = addSection.querySelector('#emp-category').value;

        if (name) {
            App.store.addEmployee(name, currentOrg, category);
            addSection.querySelector('#emp-name').value = '';
            App.refreshEmployeeList(currentOrg, listSection);
        }
    };

    // List Section
    const listSection = document.createElement('div');
    listSection.className = 'employee-list-section';
    listSection.innerHTML = '<h4>Colaboradores Actuales</h4>';

    App.refreshEmployeeList(currentOrg, listSection);

    body.appendChild(addSection);
    body.appendChild(listSection);

    content.appendChild(header);
    content.appendChild(body);
    modal.appendChild(content);
    document.body.appendChild(modal);
};

App.refreshEmployeeList = function (currentOrg, container) {
    // Remove existing list
    const existingList = container.querySelector('.employee-list');
    if (existingList) existingList.remove();

    const employees = App.store.getEmployeesByOrg(currentOrg);

    const list = document.createElement('div');
    list.className = 'employee-list';

    if (employees.length === 0) {
        list.innerHTML = '<p style="color: #999; text-align: center; padding: 20px;">No hay colaboradores registrados para esta organización.</p>';
    } else {
        // Group employees by category
        const categories = [App.CATEGORIES.PLAYA, App.CATEGORIES.FULL, App.CATEGORIES.ADMIN];

        categories.forEach(category => {
            const categoryEmployees = employees.filter(e => e.category === category);

            if (categoryEmployees.length > 0) {
                // Category section
                const categorySection = document.createElement('div');
                categorySection.className = 'employee-category-section';

                // Category header (collapsible)
                const categoryHeader = document.createElement('div');
                categoryHeader.className = 'employee-category-header';
                categoryHeader.innerHTML = `
                    <span class="category-arrow">▼</span>
                    <span class="category-name">${category}</span>
                    <span class="category-count">(${categoryEmployees.length})</span>
                `;
                categoryHeader.dataset.category = category;
                categoryHeader.dataset.expanded = 'true';

                // Category content (employee items)
                const categoryContent = document.createElement('div');
                categoryContent.className = 'employee-category-content';

                categoryEmployees.forEach(emp => {
                    const item = document.createElement('div');
                    item.className = 'employee-item';
                    item.innerHTML = `
                        <div class="employee-item-info">
                            <div class="employee-item-name">${emp.name}</div>
                        </div>
                        <div class="employee-item-actions">
                            <button class="btn-edit-employee" data-id="${emp.id}">Editar</button>
                            <button class="btn-delete-employee" data-id="${emp.id}">Eliminar</button>
                        </div>
                    `;

                    item.querySelector('.btn-edit-employee').onclick = () => App.showEditEmployee(emp, currentOrg, container);
                    item.querySelector('.btn-delete-employee').onclick = () => {
                        if (confirm(`¿Eliminar a ${emp.name}? Esto también eliminará todos sus turnos y tareas.`)) {
                            App.store.deleteEmployee(emp.id);
                            App.refreshEmployeeList(currentOrg, container);
                        }
                    };

                    categoryContent.appendChild(item);
                });

                // Toggle collapse/expand
                categoryHeader.onclick = () => {
                    const isExpanded = categoryHeader.dataset.expanded === 'true';
                    categoryHeader.dataset.expanded = isExpanded ? 'false' : 'true';
                    categoryContent.style.display = isExpanded ? 'none' : 'block';
                    categoryHeader.querySelector('.category-arrow').textContent = isExpanded ? '▶' : '▼';
                };

                categorySection.appendChild(categoryHeader);
                categorySection.appendChild(categoryContent);
                list.appendChild(categorySection);
            }
        });
    }

    container.appendChild(list);
};

App.showEditEmployee = function (employee, currentOrg, listContainer) {
    let modal = document.getElementById('edit-employee-modal');
    if (modal) modal.remove();

    modal = document.createElement('div');
    modal.id = 'edit-employee-modal';
    modal.className = 'modal-overlay';
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };

    const content = document.createElement('div');
    content.className = 'modal-content';
    content.style.maxWidth = '400px';

    content.innerHTML = `
        <h3>Editar Colaborador</h3>
        <form class="employee-form" id="edit-employee-form" style="grid-template-columns: 1fr;">
            <div class="form-group">
                <label>Nombre Completo</label>
                <input type="text" id="edit-emp-name" required value="${employee.name}">
            </div>
            <div class="form-group">
                <label>Categoría</label>
                <select id="edit-emp-category" required>
                    <option value="${App.CATEGORIES.PLAYA}" ${employee.category === App.CATEGORIES.PLAYA ? 'selected' : ''}>Playa</option>
                    <option value="${App.CATEGORIES.FULL}" ${employee.category === App.CATEGORIES.FULL ? 'selected' : ''}>Full</option>
                    <option value="${App.CATEGORIES.ADMIN}" ${employee.category === App.CATEGORIES.ADMIN ? 'selected' : ''}>Administración</option>
                </select>
            </div>
            <button type="submit" class="btn-add-employee">Guardar Cambios</button>
            <button type="button" class="close-modal-btn">Cancelar</button>
        </form>
    `;

    content.querySelector('#edit-employee-form').onsubmit = (e) => {
        e.preventDefault();
        const name = content.querySelector('#edit-emp-name').value.trim();
        const category = content.querySelector('#edit-emp-category').value;

        if (name) {
            App.store.updateEmployee(employee.id, { name, category });
            App.refreshEmployeeList(currentOrg, listContainer);
            modal.remove();
        }
    };

    content.querySelector('.close-modal-btn').onclick = () => modal.remove();

    modal.appendChild(content);
    document.body.appendChild(modal);
};

