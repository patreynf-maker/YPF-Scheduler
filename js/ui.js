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
    adminBtn.innerHTML = state.isAdmin ? 'ðŸ”“ Admin Activo' : 'ðŸ”’ Acceso Admin';
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
            if (name && pin.length === 4) {
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
            deleteBtn.innerHTML = 'Ã—';
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

    // Employee Login Button
    const employeeLoginBtn = document.createElement('button');
    employeeLoginBtn.className = 'btn-employee-login';
    employeeLoginBtn.textContent = '👤 Soy Colaborador';
    employeeLoginBtn.onclick = () => App.renderEmployeeLogin(container);
    wrapper.appendChild(employeeLoginBtn);

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
                    ${state.isAdmin ? 'ðŸ”“ Salir Admin' : 'ðŸ”’ Admin'}
                </button>
            </div>
            <div class="header-subrow">
                <span class="org-badge clickable" title="Cambiar OrganizaciÃ³n">${state.currentOrg}</span>
                <div class="month-nav">
                    <button id="btn-prev-month">&lt;</button>
                    <span class="date-display">${App.formatMonthYear(state.currentDate)}</span>
                    <button id="btn-next-month">&gt;</button>
                </div>
            </div>
        </div>
        <div class="controls">
            ${state.isAdmin ? '<button id="btn-employees">ðŸ‘¥ Colaboradores</button>' : ''}
            ${state.isAdmin ? '<button id="btn-tasks">ðŸŽ² Asignar Tareas</button>' : ''}
            ${state.isAdmin ? '<button id="btn-dashboard">ðŸ“Š EstadÃ­sticas</button>' : ''}
            ${state.isAdmin ? '<button id="btn-propagate" title="Rellenar inicio del prÃ³ximo mes">â­ï¸ PrÃ³ximo Mes</button>' : ''}
            ${state.isAdmin ? '<button id="btn-export">ðŸ“¥ Exportar</button>' : ''}
        </div>
    `;

    header.querySelector('.org-badge').onclick = () => App.store.setOrg(null);
    header.querySelector('#btn-admin').onclick = () => App.toggleAdmin(state);
    if (header.querySelector('#btn-export')) {
        header.querySelector('#btn-export').onclick = () => App.exportToCSV(state.currentOrg, state.currentDate, employees, state.shifts, state.tasks);
    }

    if (header.querySelector('#btn-dashboard')) {
        header.querySelector('#btn-dashboard').onclick = () => App.showDashboard(state.currentOrg, state.currentDate);
    }

    if (header.querySelector('#btn-dashboard')) {
        header.querySelector('#btn-dashboard').onclick = () => App.showDashboard(state.currentOrg, state.currentDate);
    }

    if (header.querySelector('#btn-propagate')) {
        header.querySelector('#btn-propagate').onclick = () => {
            if (confirm('Â¿Propagar turnos al inicio del prÃ³ximo mes siguiendo los patrones actuales?')) {
                App.store.propagateToNextMonth();
            }
        };
    }

    header.querySelector('#btn-prev-month').onclick = () => App.changeMonth(-1);
    header.querySelector('#btn-next-month').onclick = () => App.changeMonth(1);

    if (header.querySelector('#btn-employees')) {
        header.querySelector('#btn-employees').onclick = () => App.showEmployeeManager(state.currentOrg);
    }

    if (header.querySelector('#btn-tasks')) {
        header.querySelector('#btn-tasks').onclick = () => {
            if (confirm('Â¿Generar asignaciÃ³n de tareas automÃ¡ticas para todo el mes? Esto sobrescribirÃ¡ las tareas existentes.')) {
                App.assignTasksForMonth(state.currentDate.getFullYear(), state.currentDate.getMonth());
            }
        };
    }

    // Filter Bar
    const filterBar = document.createElement('div');
    filterBar.className = 'filter-bar';
    filterBar.innerHTML = `
        <button class="filter-btn ${filter === 'ALL' ? 'active' : ''}" data-filter="ALL">Todos</button>
        <button class="filter-btn ${filter === App.CATEGORIES.ADMIN ? 'active' : ''}" data-filter="${App.CATEGORIES.ADMIN}">AdministraciÃ³n</button>
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
        const dateKey = `${state.currentDate.getFullYear()}-${String(state.currentDate.getMonth() + 1).padStart(2, '0')}-${String(day.date).padStart(2, '0')}`;
        const holidayName = App.HOLIDAYS[dateKey];

        th.className = `day-header ${day.isSunday ? 'sunday' : ''} ${holidayName ? 'holiday' : ''}`;
        if (holidayName) th.title = holidayName;

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
                <span class="category-arrow">â–¼</span>
                <span class="category-name">${category}</span>
                <span class="category-count">${categoryEmployees.length}</span>
            `;

            // Toggle collapse/expand
            categoryCell.onclick = () => {
                const isExpanded = categoryRow.dataset.expanded === 'true';
                categoryRow.dataset.expanded = isExpanded ? 'false' : 'true';
                categoryCell.querySelector('.category-arrow').textContent = isExpanded ? 'â–¶' : 'â–¼';

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
        taskTitle.textContent = 'AsignaciÃ³n de Tareas Playa';

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
        const pass = prompt("Ingrese contraseÃ±a de administrador:");
        if (pass === App.ADMIN_PASSWORD) {
            App.store.setAdmin(true);
        } else if (pass !== null) {
            alert("ContraseÃ±a incorrecta");
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
    subtitle.textContent = `${employee.name} - DÃ­a ${day.date}`;

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
                    console.log("DÃ­a aÃºn incompleto, no se asignarÃ¡n tareas hasta completar todos los colaboradores.");
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
        legendTitle.textContent = 'AsignaciÃ³n de Tareas';

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

    const dayNames = ['Dom', 'Lun', 'Mar', 'MiÃ©', 'Jue', 'Vie', 'SÃ¡b'];
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
        <h3>GestiÃ³n de Colaboradores - ${currentOrg}</h3>
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
                <input type="text" id="emp-name" required placeholder="Ej: Juan PÃ©rez">
            </div>
            <div class="form-group">
                <label>Categoría</label>
                <select id="emp-category" required>
                    <option value="${App.CATEGORIES.PLAYA}">Playa</option>
                    <option value="${App.CATEGORIES.FULL}">Full</option>
                    <option value="${App.CATEGORIES.ADMIN}">Administración</option>
                </select>
            </div>
            <div class="form-group">
                <label>PIN (4 dígitos)</label>
                <input type="text" id="edit-emp-pin" maxlength="4" required value="${employee.pin || '0000'}">
            </div><button type="submit" class="btn-add-employee">+ Agregar</button>
        </form>
    `;

    addSection.querySelector('#add-employee-form').onsubmit = (e) => {
        e.preventDefault();
        const name = addSection.querySelector('#emp-name').value.trim();
        const category = addSection.querySelector('#emp-category').value;
        const pin = addSection.querySelector('#emp-pin').value.trim();

        if (name && pin.length === 4) {
            App.store.addEmployee(name, currentOrg, category, pin);
            addSection.querySelector('#emp-name').value = '';
            addSection.querySelector('#emp-pin').value = '0000';
            App.refreshEmployeeList(currentOrg, listSection);
        } else {
            alert('Por favor complete todos los campos. El PIN debe tener 4 dígitos.');
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
        list.innerHTML = '<p style="color: #999; text-align: center; padding: 20px;">No hay colaboradores registrados para esta organizaciÃ³n.</p>';
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
                    <span class="category-arrow">â–¼</span>
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
                        if (confirm(`Â¿Eliminar a ${emp.name}? Esto tambiÃ©n eliminarÃ¡ todos sus turnos y tareas.`)) {
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
                    categoryHeader.querySelector('.category-arrow').textContent = isExpanded ? 'â–¶' : 'â–¼';
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
                <label>CategorÃ­a</label>
                <select id="edit-emp-category" required>
                    <option value="${App.CATEGORIES.PLAYA}" ${employee.category === App.CATEGORIES.PLAYA ? 'selected' : ''}>Playa</option>
                    <option value="${App.CATEGORIES.FULL}" ${employee.category === App.CATEGORIES.FULL ? 'selected' : ''}>Full</option>
                    <option value="${App.CATEGORIES.ADMIN}" ${employee.category === App.CATEGORIES.ADMIN ? 'selected' : ''}>AdministraciÃ³n</option>
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
        const pin = content.querySelector('#edit-emp-pin').value.trim();

        if (name && pin.length === 4) {
            App.store.updateEmployee(employee.id, { name, category, pin });
            App.refreshEmployeeList(currentOrg, listContainer);
            modal.remove();
        }
    };

    content.querySelector('.close-modal-btn').onclick = () => modal.remove();

    modal.appendChild(content);
    document.body.appendChild(modal);
};


App.showDashboard = function (org, currentDate) {
    var monthKey = currentDate.getFullYear() + '-' + String(currentDate.getMonth() + 1).padStart(2, '0');
    var employees = App.store.getEmployeesByOrg(org);

    var modal = document.createElement('div');
    modal.className = 'modal-backdrop';

    var rows = employees.map(function (emp) {
        var stats = App.store.getEmployeeStats(emp.id, monthKey);
        return '<tr><td><strong>' + emp.name + '</strong></td><td>' + stats.hours + ' hs</td><td>' + stats.sundays + '</td><td>' + stats.holidays + '</td></tr>';
    }).join('');

    modal.innerHTML = '<div class=\'modal-content dashboard-modal\'><header class=\'modal-header\'><h2>Resumen de Estadísticas - ' + App.formatMonthYear(currentDate) + '</h2><button class=\'btn-close\'>&times;</button></header><div class=\'dashboard-grid\'><table><thead><tr><th>Colaborador</th><th>hs. Totales</th><th>Dom. Trabajados</th><th>Fer. Trabajados</th></tr></thead><tbody>' + rows + '</tbody></table></div><div class=\'modal-footer\'><p class=\'stats-note\'>Basado en turnos cargados y días feriados nacionales configurados.</p><button class=\'btn-primary\'>Entendido</button></div></div>';

    modal.querySelector('.btn-close').onclick = function () { modal.remove(); };
    modal.querySelector('.btn-primary').onclick = function () { modal.remove(); };
    document.body.appendChild(modal);
};

App.renderEmployeeLogin = function (container) {
    var wrapper = document.createElement('div');
    wrapper.className = 'login-container';
    wrapper.innerHTML = '<h2>Acceso Colaborador</h2><div class=\'form-group\'><select id=\'login-org-select\'><option value=\'\'>Selecciona tu Sucursal</option></select></div><div class=\'form-group\'><select id=\'login-emp-select\' disabled><option value=\'\'>Selecciona tu Nombre</option></select></div><div class=\'form-group\'><input type=\'password\' id=\'login-pin\' placeholder=\'PIN (4 dígitos)\' maxlength=\'4\' disabled></div><button id=\'btn-login-enter\' disabled>Ingresar</button><button id=\'btn-login-back\'>Volver</button>';

    var orgSelect = wrapper.querySelector('#login-org-select');
    var empSelect = wrapper.querySelector('#login-emp-select');
    var pinInput = wrapper.querySelector('#login-pin');
    var loginBtn = wrapper.querySelector('#btn-login-enter');
    var backBtn = wrapper.querySelector('#btn-login-back');

    var orgs = App.store.state.organizations || [];
    orgs.forEach(function (org) {
        var opt = document.createElement('option');
        opt.value = org;
        opt.textContent = org;
        orgSelect.appendChild(opt);
    });

    orgSelect.onchange = function () {
        empSelect.innerHTML = '<option value=\'\'>Selecciona tu Nombre</option>';
        if (orgSelect.value) {
            var emps = App.store.getEmployeesByOrg(orgSelect.value);
            emps.forEach(function (emp) {
                var opt = document.createElement('option');
                opt.value = emp.id;
                opt.textContent = emp.name;
                empSelect.appendChild(opt);
            });
            empSelect.disabled = false;
        } else {
            empSelect.disabled = true;
            pinInput.disabled = true;
        }
    };

    empSelect.onchange = function () {
        pinInput.disabled = !empSelect.value;
        if (empSelect.value) pinInput.focus();
    };

    pinInput.oninput = function () {
        loginBtn.disabled = pinInput.value.length < 4;
    };

    loginBtn.onclick = function () {
        var empId = empSelect.value;
        var pin = pinInput.value;
        if (App.store.validateEmployeePin(empId, pin)) {
            var emp = App.store.state.employees.find(function (e) { return e.id == empId; });
            App.showEmployeePortal(emp);
        } else {
            alert('PIN Incorrecto');
        }
    };

    backBtn.onclick = function () { App.render(document.getElementById('app'), App.store.state); };

    container.innerHTML = '';
    container.appendChild(wrapper);
};

App.showEmployeePortal = function (employee) {
    var container = document.getElementById('app');
    container.innerHTML = '';

    var portal = document.createElement('div');
    portal.className = 'employee-portal';

    var header = document.createElement('header');
    header.className = 'portal-header';
    header.innerHTML = '<div class=\'user-info\'><h2>Hola, ' + employee.name + '</h2><span>' + employee.organization + '</span></div><button id=\'btn-portal-logout\'>Salir</button>';
    header.querySelector('#btn-portal-logout').onclick = function () { window.location.reload(); };

    portal.appendChild(header);

    var wrapper = document.createElement('div');
    wrapper.style.padding = '20px';
    wrapper.innerHTML = '<p>Tu calendario se abrirá a continuación...</p>';
    portal.appendChild(wrapper);

    container.appendChild(portal);

    setTimeout(function () {
        App.showCalendarView(employee, App.store.state);
    }, 100);
};

/* PORTAL MODE OVERRIDES */

App.render = function (container, state) {
    // Save scroll position for scheduler
    var grid = container.querySelector('.grid-container');
    var scrollLeft = grid ? grid.scrollLeft : 0;
    var scrollTop = grid ? grid.scrollTop : 0;

    container.innerHTML = '';

    if (state.isPortalMode && state.portalEmployee) {
        App.renderEmployeePortal(container, state.portalEmployee);
    } else if (!state.currentOrg) {
        App.renderOrgSelector(container);
    } else {
        App.renderScheduler(container, state);
        var newGrid = container.querySelector('.grid-container');
        if (newGrid) {
            newGrid.scrollLeft = scrollLeft;
            newGrid.scrollTop = scrollTop;
        }
    }
};

App.showEmployeePortal = function (employee) {
    App.store.state.isPortalMode = true;
    App.store.state.portalEmployee = employee;
    App.store.emitChange();
};

App.renderEmployeePortal = function (container, employee) {
    var wrapper = document.createElement('div');
    wrapper.className = 'employee-portal';

    // Header
    var header = document.createElement('header');
    header.className = 'portal-header';
    header.innerHTML = '<div class=\'user-info\'><h2>Hola, ' + employee.name + '</h2><span>' + employee.organization + '</span></div><div class=\'portal-controls\'><button id=\'btn-portal-share\' title=\'Compartir por WhatsApp\'>??</button><button id=\'btn-portal-logout\'>Salir</button></div>';

    header.querySelector('#btn-portal-share').onclick = function () {
        var url = App.generateWhatsAppLink(employee, App.store.state.currentDate, App.store.state.shifts);
        window.open(url, '_blank');
    };

    header.querySelector('#btn-portal-logout').onclick = function () {
        App.store.state.isPortalMode = false;
        App.store.state.portalEmployee = null;
        window.location.reload();
    };

    wrapper.appendChild(header);

    // Month Nav
    var nav = document.createElement('div');
    nav.className = 'month-nav portal-nav';
    nav.style.justifyContent = 'center';
    nav.style.margin = '20px 0';
    nav.innerHTML = '<button id=\'btn-prev-month\'>&lt;</button><span class=\'date-display\'>' + App.formatMonthYear(App.store.state.currentDate) + '</span><button id=\'btn-next-month\'>&gt;</button>';

    nav.querySelector('#btn-prev-month').onclick = function () { App.changeMonth(-1); };
    nav.querySelector('#btn-next-month').onclick = function () { App.changeMonth(1); };

    wrapper.appendChild(nav);

    // Calendar Request
    // Reuse showCalendarView logic but append to wrapper instead of modal?
    // showCalendarView creates a modal. We want inline.
    // Let's create a container for the calendar.
    var calContainer = document.createElement('div');
    calContainer.className = 'portal-calendar-wrapper';
    wrapper.appendChild(calContainer);

    container.appendChild(wrapper);

    // HACK: Use showCalendarView but hijack the modal creation?
    // No, better to duplicate the grid rendering logic or refactor.
    // Given the constraints, I will duplicate the grid rendering part of showCalendarView here for stability.

    var grid = document.createElement('div');
    grid.className = 'calendar-grid';
    grid.style.maxWidth = '100%';
    grid.style.margin = '0 auto';

    var dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    dayNames.forEach(function (d) {
        var div = document.createElement('div');
        div.className = 'cal-day-name';
        div.textContent = d;
        grid.appendChild(div);
    });

    var date = App.store.state.currentDate;
    var year = date.getFullYear();
    var month = date.getMonth();
    var daysInMonth = new Date(year, month + 1, 0).getDate();
    var firstDayIndex = new Date(year, month, 1).getDay();

    for (var i = 0; i < firstDayIndex; i++) {
        var div = document.createElement('div');
        div.className = 'cal-day-empty';
        grid.appendChild(div);
    }

    var monthKey = App.getMonthKey(date);
    var empShifts = App.store.state.shifts[monthKey] && App.store.state.shifts[monthKey][employee.id] ? App.store.state.shifts[monthKey][employee.id] : {};

    for (var d = 1; d <= daysInMonth; d++) {
        var div = document.createElement('div');
        div.className = 'cal-day-cell';

        var shiftCode = empShifts[d];

        if (shiftCode) {
            var shiftInfo = null;
            var allTypes = (App.SHIFT_TYPES.PLAYA || []).concat(App.SHIFT_TYPES.FULL || []);
            shiftInfo = allTypes.find(function (s) { return s.code === shiftCode; });

            var label = document.createElement('div');
            label.className = 'cal-shift-label';
            if (shiftInfo) {
                label.style.backgroundColor = shiftInfo.color;
                label.textContent = shiftInfo.label;
            } else {
                label.textContent = shiftCode;
            }

            var dateDiv = document.createElement('div');
            dateDiv.className = 'cal-date inside-shift';
            dateDiv.textContent = d;
            label.appendChild(dateDiv);
            div.appendChild(label);
        } else {
            var dateDiv = document.createElement('div');
            dateDiv.className = 'cal-date';
            dateDiv.textContent = d;
            div.appendChild(dateDiv);
        }
        grid.appendChild(div);
    }

    calContainer.appendChild(grid);
};





