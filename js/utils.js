window.App = window.App || {};

App.getDaysInMonth = function (date) {
    const year = date.getFullYear();
    const month = date.getMonth();
    const days = new Date(year, month + 1, 0).getDate();
    const result = [];

    for (let i = 1; i <= days; i++) {
        const d = new Date(year, month, i);
        result.push({
            date: i,
            dayName: d.toLocaleDateString('es-ES', { weekday: 'short' }),
            fullDate: d
        });
    }
    return result;
};

App.formatMonthYear = function (date) {
    const formatted = date.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
};

App.getMonthKey = function (date) {
    return `${date.getFullYear()}-${date.getMonth()}`;
};

App.generateWhatsAppLink = function (employee, date, shifts) {
    // Shifts are stored with 0-indexed month key (e.g. "2026-1" for February)
    const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
    const empShifts = (shifts[monthKey] && shifts[monthKey][employee.id]) || {};
    const daysInMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();

    let text = `\uD83D\uDCC5 *Cronograma ${App.formatMonthYear(date)} - ${employee.name}*\n\n`;

    let hasShifts = false;
    for (let d = 1; d <= daysInMonth; d++) {
        const currentDate = new Date(date.getFullYear(), date.getMonth(), d);
        const dayName = currentDate.toLocaleDateString('es-ES', { weekday: 'short' });
        const shiftCode = empShifts[d];

        if (shiftCode) {
            hasShifts = true;
            let label = shiftCode;
            const allTypes = [...(App.SHIFT_TYPES.PLAYA || []), ...(App.SHIFT_TYPES.FULL || [])];
            const def = allTypes.find(s => s.code === shiftCode);
            if (def) label = def.label;

            text += `${String(d).padStart(2, '0')} (${dayName}): ${label}\n`;
        }
    }

    if (!hasShifts) {
        text += '_Sin turnos asignados este mes._\n';
    }

    text += `\n\uD83D\uDD17 Generado por ShiftScheduler`;
    return `https://wa.me/?text=${encodeURIComponent(text)}`;
};

