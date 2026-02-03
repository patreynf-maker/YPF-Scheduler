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
