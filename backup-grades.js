// Script untuk backup seluruh koleksi 'grades' dari Firestore ke file JSON lokal
// Jalankan script ini dengan: node backup-grades.js

const fs = require('fs');
const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

// Inisialisasi Firebase Admin
initializeApp({
  credential: applicationDefault(),
});

const db = getFirestore();

async function backupGrades() {
  const gradesSnapshot = await db.collection('grades').get();
  const gradesData = [];
  gradesSnapshot.forEach(doc => {
    gradesData.push({ id: doc.id, ...doc.data() });
  });
  fs.writeFileSync('grades-backup.json', JSON.stringify(gradesData, null, 2), 'utf-8');
  console.log(`Backup selesai. Total dokumen: ${gradesData.length}`);
}

backupGrades().catch(console.error);
