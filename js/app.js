// Firebase Configuration is now loaded from js/config.js


// Initialize Firebase
if (typeof firebase !== 'undefined') {
    firebase.initializeApp(firebaseConfig);
    window.db = firebase.database();
}

// Main Entry Point
document.addEventListener('DOMContentLoaded', () => {
    console.log('Initializing Shift Scheduler...');

    if (window.App && App.initStore && App.renderApp) {
        App.initStore();
        App.renderApp();
    } else {
        console.error('Core modules failed to load.');
        document.querySelector('.loading').textContent = 'Error: Fallo al cargar modulos. Verifique los archivos.';
    }
});

