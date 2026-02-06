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
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

App.generateWhatsAppLink = function (employee, date, shifts) {
    const monthKey = App.getMonthKey(date);
    const empShifts = shifts[monthKey]?.[employee.id] || {};
    const daysInMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    
    let text = `\u00F0\u0178\u201C\u2026 *Cronograma ${App.formatMonthYear(date)} - ${employee.name}*\n\n`;
    
    for (let d = 1; d <= daysInMonth; d++) {
        const currentDate = new Date(date.getFullYear(), date.getMonth(), d);
        const dayName = currentDate.toLocaleDateString('es-ES', { weekday: 'short' });
        const shiftCode = empShifts[d];
        
        if (shiftCode) {
            let label = shiftCode;
            // Try to find label
            const allTypes = [...(App.SHIFT_TYPES.PLAYA || []), ...(App.SHIFT_TYPES.FULL || [])];
            const def = allTypes.find(s => s.code === shiftCode);
            if (def) label = def.label;
            
            text += `${String(d).padStart(2, '0')} (${dayName}): ${label}\n`;
        }
    }
    
    text += `\n\u00F0\u0178\u201D\u2014 Generado por ShiftScheduler`;
    return `https://wa.me/?text=${encodeURIComponent(text)}`;
};

