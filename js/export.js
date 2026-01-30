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
