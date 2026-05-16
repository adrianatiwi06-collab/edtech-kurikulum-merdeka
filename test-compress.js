const { compressTP, detectMultipleTopics } = require('./lib/tp-compressor.ts');

const tp = 'Peserta didik mampu mengidentifikasi dan menggunakan kalimat aktif (dengan awalan me-) dan kalimat pasif (dengan awalan di-) dalam berbagai konteks dengan tepat.';

console.log('=== TP COMPRESSION TEST ===\n');
console.log('ORIGINAL TP:');
console.log(tp);
console.log('\nPanjang: ' + tp.length + ' karakter\n');

console.log('---\n');

const result = compressTP(tp, 100, true);

console.log('ANALYSIS RESULT:');
console.log('Status: ' + result.status);
console.log('Has Multiple Topics: ' + result.hasMultipleTopics);
console.log('Topic Count: ' + result.topicCount);
console.log('Has Split: ' + result.hasSplit);
console.log('Confidence: ' + (result.confidenceScore * 100).toFixed(1) + '%');
console.log('Recommended Action: ' + result.recommendedAction);

if (result.hasSplit && result.splits) {
  console.log('\n✅ SPLIT RESULT (' + result.splits.length + ' TPs):');
  result.splits.forEach((split, i) => {
    console.log('  ' + (i+1) + '. (' + split.length + ' char) ' + split);
  });
} else {
  console.log('\n✅ COMPRESSED RESULT:');
  console.log('(' + result.charCount + ' char) ' + result.compressed);
}

console.log('\n=== TOPIC DETECTION ===');
const topicDetection = detectMultipleTopics(tp);
console.log('Topics Found: ' + topicDetection.topics.length);
topicDetection.topics.forEach((topic, i) => {
  console.log('  ' + (i+1) + '. ' + topic);
});
