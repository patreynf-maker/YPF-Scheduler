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
        { code: '14-22', label: '14 A 22', color: 'var(--shift-14-22)' },
        { code: '06-14', label: '06 A 14', color: 'var(--shift-06-14)' },
        { code: '22-06', label: '22 A 06', color: 'var(--shift-22-06)' },
        { code: '16-00', label: '16 A 00', color: 'var(--shift-16-00)' },
        { code: '08-16', label: '08 A 16', color: 'var(--shift-08-16)' },
        { code: '00-04', label: '00 A 04', color: 'var(--shift-00-04)' },
        { code: '22-02', label: '22 A 02', color: 'var(--shift-22-02)' },
        { code: 'FRANCO', label: 'Franco', color: 'var(--shift-franco)' },
        { code: 'ASIDUIDAD', label: 'Asiduidad', color: 'var(--shift-asiduidad)' },
        { code: 'SUSPENSION', label: 'Suspension', color: 'var(--shift-suspension)' },
        { code: 'MEDICO', label: 'Certificado\nMedico', color: 'var(--shift-medical)' }
    ],
    FULL: [
        { code: '06-14', label: '06 A 14', color: 'var(--shift-06-14)' },
        { code: '05-13', label: '05 A 13', color: 'var(--shift-05-13)' },
        { code: '14-22', label: '14 A 22', color: 'var(--shift-14-22)' },
        { code: '22-06', label: '22 A 06', color: 'var(--shift-22-06)' },
        { code: '08-16', label: '08 A 16', color: 'var(--shift-08-16)' },
        { code: '11-15', label: '11 A 15', color: 'var(--shift-11-15)' },
        { code: '16-20', label: '16 A 20', color: 'var(--shift-16-20)' },
        { code: '20-00', label: '20 A 00', color: 'var(--shift-20-00)' },
        { code: 'FRANCO', label: 'Franco', color: 'var(--shift-franco)' },
        { code: 'ASIDUIDAD', label: 'Asiduidad', color: 'var(--shift-asiduidad)' },
        { code: 'SUSPENSION', label: 'Suspension', color: 'var(--shift-suspension)' },
        { code: 'MEDICO', label: 'Certificado\nMedico', color: 'var(--shift-medical)' }
    ]
};

App.TASKS_PLAYA = {
    1: 'Surtidores (Liq. y GNC) / Puntera isla',
    2: 'Repasar islas / Bocas combustible / Mueble facturación',
    3: 'Columnas / Picos / Barrer playa',
    4: 'Encerar'
};

App.TASK_COLORS = {
    1: 'var(--task-1)',
    2: 'var(--task-2)',
    3: 'var(--task-3)',
    4: 'var(--task-4)'
};
