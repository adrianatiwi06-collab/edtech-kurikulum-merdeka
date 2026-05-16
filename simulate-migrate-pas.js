// Simulasi migrasi: Deteksi dokumen yang akan diubah, tanpa update Firestore
// Jalankan: node simulate-migrate-pas.js
// Pastikan sudah set GOOGLE_APPLICATION_CREDENTIALS

const fs = require('fs');
const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

initializeApp({
  credential: applicationDefault(),
});

const db = getFirestore();

async function simulateMigratePAS() {
  const gradesSnapshot = await db.collection('grades').get();
  let willMigrate = 0;
  const affectedDocs = [];

  for (const doc of gradesSnapshot.docs) {
    const data = doc.data();
    let changed = false;
    if (!Array.isArray(data.grades)) continue;
    // Deteksi dokumen PAS berdasarkan exam_name/title
    const isPAS = (data.exam_name && /pas|uas|pat/i.test(data.exam_name)) || (data.exam_title && /pas|uas|pat/i.test(data.exam_title));
    if (!isPAS) continue;
    // Cek setiap siswa
    data.grades.forEach(g => {
      if (Array.isArray(g.uh) && g.uh.length > 0 && (g.pas === undefined || g.pas === 0)) {
        changed = true;
      }
    });
    if (changed) {
      willMigrate++;
      affectedDocs.push({ id: doc.id, exam_name: data.exam_name, exam_title: data.exam_title });
    }
  }
  fs.writeFileSync('simulate-migrate-pas.json', JSON.stringify(affectedDocs, null, 2), 'utf-8');
  console.log(`Simulasi selesai. Dokumen yang akan diubah: ${willMigrate}`);
  if (willMigrate > 0) console.log('Cek simulate-migrate-pas.json untuk daftar dokumen.');
}

simulateMigratePAS().catch(console.error);
