// Firebase Configuration (TUS CLAVES VAN AQUÃ)
// Debes crear un proyecto en console.firebase.google.com y pegar tu config aquí:
const firebaseConfig = {
    apiKey: "AIzaSyBGGNkdypMPAfLNhxkDj9NQiNPU7v88JVY",
    authDomain: "ypf-scheduler.firebaseapp.com",
    databaseURL: "https://ypf-scheduler-default-rtdb.firebaseio.com",
    projectId: "ypf-scheduler",
    storageBucket: "ypf-scheduler.firebasestorage.app",
    messagingSenderId: "702746306343",
    appId: "1:702746306343:web:b1e088eaf8ec2b18ae6b02",
    measurementId: "G-4FQ963MZXS"
};


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

