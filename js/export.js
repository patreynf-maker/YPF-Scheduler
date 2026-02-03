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

        // Header parsing to get days
        const header = lines[0].split(",");
        const daysIndices = [];
        header.forEach((col, idx) => {
            if (col.match(/^\d+/)) {
                daysIndices.push({ date: parseInt(col), index: idx });
            }
        });

        let updatedCount = 0;

        for (let i = 1; i < lines.length; i++) {
            if (!lines[i].trim()) continue;

            // Handle quoted commas in CSV
            const row = lines[i].match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
            if (!row) continue;

            const empName = row[0].replace(/"/g, '').trim();
            const employee = employees.find(e => e.name.trim() === empName);

            if (employee) {
                daysIndices.forEach(dayInfo => {
                    let cellValue = row[dayInfo.index]?.replace(/"/g, '').trim();
                    if (!cellValue) return;

                    // Split shift and task: "14-22 (Tarea: 1)"
                    let shiftCode = cellValue;
                    let taskNum = null;

                    if (cellValue.includes("(Tarea:")) {
                        const parts = cellValue.split("(Tarea:");
                        shiftCode = parts[0].trim();
                        taskNum = parts[1].replace(/\D/g, '');
                    }

                    // Update shift
                    if (!App.store.state.shifts[monthKey]) App.store.state.shifts[monthKey] = {};
                    if (!App.store.state.shifts[monthKey][employee.id]) App.store.state.shifts[monthKey][employee.id] = {};
                    App.store.state.shifts[monthKey][employee.id][dayInfo.date] = shiftCode;

                    // Update task
                    if (taskNum) {
                        if (!App.store.state.tasks[monthKey]) App.store.state.tasks[monthKey] = {};
                        if (!App.store.state.tasks[monthKey][employee.id]) App.store.state.tasks[monthKey][employee.id] = {};
                        App.store.state.tasks[monthKey][employee.id][dayInfo.date] = taskNum;
                    }
                });
                updatedCount++;
            }
        }

        if (updatedCount > 0) {
            // Trigger a full sync and notification
            App.store.emitChange(); // This will trigger Firebase sync if loaded
            alert(`Importación completada. Se actualizaron datos para ${updatedCount} colaboradores.`);
        } else {
            alert("No se encontraron coincidencias de nombres en el archivo para esta organización.");
        }
    };
    reader.readAsText(file);
}
