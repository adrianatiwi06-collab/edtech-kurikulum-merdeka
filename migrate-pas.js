// Script migrasi: Deteksi nilai PAS yang salah masuk UH1, lalu pindahkan ke field PAS
// Jalankan: node migrate-pas.js
// Pastikan sudah backup dan set GOOGLE_APPLICATION_CREDENTIALS

const fs = require('fs');
const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

initializeApp({
  credential: applicationDefault(),
});

const db = getFirestore();

async function migratePAS() {
  const gradesSnapshot = await db.collection('grades').get();
  let migrated = 0;
  let failed = 0;
  const errorLog = [];

  for (const doc of gradesSnapshot.docs) {
    const data = doc.data();
    let changed = false;
    if (!Array.isArray(data.grades)) continue;
    // Deteksi dokumen PAS berdasarkan exam_name/title
    const isPAS = (data.exam_name && /pas|uas|pat/i.test(data.exam_name)) || (data.exam_title && /pas|uas|pat/i.test(data.exam_title));
    if (!isPAS) continue;
    // Perbaiki setiap siswa
    data.grades.forEach(g => {
      if (Array.isArray(g.uh) && g.uh.length > 0 && (g.pas === undefined || g.pas === 0)) {
        // Asumsi: nilai PAS salah masuk ke UH1
        g.pas = g.uh[0];
        g.uh = g.uh.slice(1);
        changed = true;
      }
    });
    if (changed) {
      try {
        await db.collection('grades').doc(doc.id).update({ grades: data.grades });
        migrated++;
      } catch (e) {
        failed++;
        errorLog.push({ id: doc.id, error: e.message });
      }
    }
  }
  fs.writeFileSync('migrate-pas-error-log.json', JSON.stringify(errorLog, null, 2), 'utf-8');
  console.log(`Migrasi selesai. Dokumen berhasil: ${migrated}, gagal: ${failed}`);
  if (failed > 0) console.log('Cek migrate-pas-error-log.json untuk detail error.');
}

migratePAS().catch(console.error);
