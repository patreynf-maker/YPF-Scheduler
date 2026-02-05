// Initialize Global Namespace
window.App = window.App || {};

App.ADMIN_PASSWORD = "6rup00c74n0";

App.ORGANIZATIONS = ['QQN', 'CR88', 'VR'];

App.CATEGORIES = {
    PLAYA: 'Playa',
    FULL: 'Full',
    ADMIN: 'Administracion'
};

App.SHIFT_TYPES = {
    PLAYA: [
        { code: '14-22', label: '14 A 22', color: 'var(--shift-14-22)', duration: 8 },
        { code: '06-14', label: '06 A 14', color: 'var(--shift-06-14)', duration: 8 },
        { code: '22-06', label: '22 A 06', color: 'var(--shift-22-06)', duration: 8 },
        { code: '16-00', label: '16 A 00', color: 'var(--shift-16-00)', duration: 8 },
        { code: '08-16', label: '08 A 16', color: 'var(--shift-08-16)', duration: 8 },
        { code: '00-04', label: '00 A 04', color: 'var(--shift-00-04)', duration: 4 },
        { code: '22-02', label: '22 A 02', color: 'var(--shift-22-02)', duration: 4 },
        { code: 'FRANCO', label: 'Franco', color: 'var(--shift-franco)', duration: 0 },
        { code: 'ASIDUIDAD', label: 'Asiduidad', color: 'var(--shift-asiduidad)', duration: 0 },
        { code: 'SUSPENSION', label: 'Suspension', color: 'var(--shift-suspension)', duration: 0 },
        { code: 'MEDICO', label: 'Certificado\nMedico', color: 'var(--shift-medical)', duration: 0 }
    ],
    FULL: [
        { code: '06-14', label: '06 A 14', color: 'var(--shift-06-14)', duration: 8 },
        { code: '05-13', label: '05 A 13', color: 'var(--shift-05-13)', duration: 8 },
        { code: '14-22', label: '14 A 22', color: 'var(--shift-14-22)', duration: 8 },
        { code: '22-06', label: '22 A 06', color: 'var(--shift-22-06)', duration: 8 },
        { code: '08-16', label: '08 A 16', color: 'var(--shift-08-16)', duration: 8 },
        { code: '11-15', label: '11 A 15', color: 'var(--shift-11-15)', duration: 4 },
        { code: '16-20', label: '16 A 20', color: 'var(--shift-16-20)', duration: 4 },
        { code: '20-00', label: '20 A 00', color: 'var(--shift-20-00)', duration: 4 },
        { code: 'FRANCO', label: 'Franco', color: 'var(--shift-franco)', duration: 0 },
        { code: 'ASIDUIDAD', label: 'Asiduidad', color: 'var(--shift-asiduidad)', duration: 0 },
        { code: 'SUSPENSION', label: 'Suspension', color: 'var(--shift-suspension)', duration: 0 },
        { code: 'MEDICO', label: 'Certificado\nMedico', color: 'var(--shift-medical)', duration: 0 }
    ]
};

// Holidays data (YYYY-MM-DD keys)
App.HOLIDAYS = {
    '2024-01-01': 'A\u00F1o Nuevo',
    '2024-03-24': 'Memoria, Verdad y Justicia',
    '2024-04-02': 'Malvinas',
    '2024-05-01': 'D\u00EDa del Trabajador',
    '2024-05-25': 'Revoluci\u00F3n de Mayo',
    '2024-06-20': 'D\u00EDa de la Bandera',
    '2024-07-09': 'D\u00EDa de la Independencia',
    '2024-12-08': 'Inmaculada Concepci\u00F3n',
    '2024-12-25': 'Navidad'
};

App.TASKS_PLAYA = {
    1: 'Surtidores (Liq. y GNC) / Puntera isla',
    2: 'Repasar islas / Bocas combustible / Mueble facturaci\u00F3n',
    3: 'Columnas / Picos / Barrer playa',
    4: 'Encerar'
};

App.TASK_COLORS = {
    1: 'var(--task-1)',
    2: 'var(--task-2)',
    3: 'var(--task-3)',
    4: 'var(--task-4)'
};

