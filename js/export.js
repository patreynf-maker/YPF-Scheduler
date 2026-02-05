window.App = window.App || {};

App.exportToCSV = function (orgName, date, employees, shifts, tasks) {
    const days = App.getDaysInMonth(date);
    const monthKey = `${date.getFullYear()}-${date.getMonth()}`;

    let csvContent = "Colaborador,Categoria,";
    csvContent += days.map(d => `${d.date} (${d.dayName})`).join(",");
    csvContent += "\n";

    employees.forEach(emp => {
        let row = `"${emp.name}","${emp.category}",`;

        const rowData = days.map(day => {
            const shiftCode = shifts[monthKey]?.[emp.id]?.[day.date] || "";
            const task = tasks[monthKey]?.[emp.id]?.[day.date];

            let cell = shiftCode;
            if (task) cell += ` (Tarea: ${task})`;
            return `"${cell}"`;
        });

        row += rowData.join(",");
        csvContent += row + "\n";
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Horarios_${orgName}_${monthKey}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

App.importFromCSV = function (file, orgName, currentDate) {
    const reader = new FileReader();
    reader.onload = function (e) {
        const text = e.target.result;
        const lines = text.split(/\r?\n/);
        if (lines.length < 2) return;

        const monthKey = `${currentDate.getFullYear()}-${currentDate.getMonth()}`;
        const employees = App.store.getEmployeesByOrg(orgName);

        // Helper to parse CSV line correctly handling quotes and commas
        const parseLine = (line) => {
            const result = [];
            let cell = '';
            let inQuotes = false;
            for (let i = 0; i < line.length; i++) {
                const char = line[i];
                if (char === '"') {
                    inQuotes = !inQuotes;
                } else if (char === ',' && !inQuotes) {
                    result.push(cell.trim());
                    cell = '';
                } else {
                    cell += char;
                }
            }
            result.push(cell.trim());
            return result;
        };

        const firstLine = lines[0].replace(/^\uFEFF/, ''); // Remove UTF-8 BOM if present
        const header = parseLine(firstLine);
        const daysIndices = [];
        header.forEach((col, idx) => {
            // Match day number even if quoted or with extra text
            const cleanCol = col.replace(/"/g, '');
            const match = cleanCol.match(/^(\d+)/);
            if (match) {
                daysIndices.push({ date: parseInt(match[1]), index: idx });
            }
        });

        if (daysIndices.length === 0) {
            alert("No se detectaron columnas de dÃ­as en el encabezado del archivo. AsegÃºrate de usar el formato exportado por el sistema.");
            return;
        }

        let updatedCount = 0;

        for (let i = 1; i < lines.length; i++) {
            if (!lines[i].trim()) continue;

            const row = parseLine(lines[i]);
            if (!row || row.length < 2) continue;

            const csvName = row[0].replace(/"/g, '').toLowerCase().trim();
            const employee = employees.find(e => e.name.toLowerCase().trim() === csvName);

            if (employee) {
                daysIndices.forEach(dayInfo => {
                    let cellValue = row[dayInfo.index];
                    if (cellValue === undefined || cellValue === null) return;

                    let shiftCode = cellValue;
                    let taskNum = null;

                    if (cellValue.includes("(Tarea:")) {
                        const parts = cellValue.split("(Tarea:");
                        shiftCode = parts[0].trim();
                        taskNum = parts[1].replace(/\D/g, '');
                    }

                    // Always update shift (even if empty to allow clearing)
                    if (!App.store.state.shifts[monthKey]) App.store.state.shifts[monthKey] = {};
                    if (!App.store.state.shifts[monthKey][employee.id]) App.store.state.shifts[monthKey][employee.id] = {};
                    App.store.state.shifts[monthKey][employee.id][dayInfo.date] = shiftCode;

                    // Update task if found, or clear if not present in cell but exists in state
                    if (taskNum) {
                        if (!App.store.state.tasks[monthKey]) App.store.state.tasks[monthKey] = {};
                        if (!App.store.state.tasks[monthKey][employee.id]) App.store.state.tasks[monthKey][employee.id] = {};
                        App.store.state.tasks[monthKey][employee.id][dayInfo.date] = taskNum;
                    } else if (App.store.state.tasks[monthKey]?.[employee.id]?.[dayInfo.date]) {
                        // Clear task if not in CSV for this specific cell
                        delete App.store.state.tasks[monthKey][employee.id][dayInfo.date];
                    }
                });
                updatedCount++;
            } else if (row[0]) {
                console.log(`No match for CSV name: "${row[0]}"`);
            }
        }

        if (updatedCount > 0) {
            App.store.emitChange();
            alert(`ImportaciÃ³n completada con Ã©xito.\nSe actualizaron: ${updatedCount} colaboradores.`);
        } else {
            alert("No se encontraron coincidencias. AsegÃºrate de:\n1. Que los nombres coincidan exactamente.\n2. Estar en la misma OrganizaciÃ³n que el archivo.\n3. Que el archivo no estÃ© abierto en Excel al importar.");
        }
    };
    reader.readAsText(file);
}

