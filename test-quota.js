#!/usr/bin/env node

/**
 * Test Script untuk Gemini API Quota Management
 * Usage: node test-quota.js
 */

const API_BASE = 'http://localhost:3000';

// Colors for console
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// Test 1: Check Quota Status
async function testQuotaStatus() {
  log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'blue');
  log('TEST 1: Quota Status API', 'blue');
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'blue');
  
  try {
    const response = await fetch(`${API_BASE}/api/quota-status`);
    const result = await response.json();
    
    if (result.success) {
      log('✅ Quota Status API: OK', 'green');
      console.log(JSON.stringify(result.data, null, 2));
      
      // Check status
      if (result.data.status === 'healthy') {
        log(`✅ Status: HEALTHY (${result.data.remainingRequests}/${result.data.maxRequestsPerMinute})`, 'green');
      } else if (result.data.status === 'warning') {
        log(`⚠️  Status: WARNING (${result.data.remainingRequests}/${result.data.maxRequestsPerMinute})`, 'yellow');
      } else {
        log(`❌ Status: EXHAUSTED`, 'red');
      }
      
      return true;
    } else {
      log('❌ Quota Status API: FAILED', 'red');
      return false;
    }
  } catch (error) {
    log(`❌ Error: ${error.message}`, 'red');
    return false;
  }
}

// Test 2: Generate TP (Single Request)
async function testGenerateTP() {
  log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'blue');
  log('TEST 2: Generate TP (Single Request)', 'blue');
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'blue');
  
  try {
    const payload = {
      userId: 'test-user-' + Date.now(),
      grade: '7',
      subject: 'Matematika',
      cpReference: 'Siswa mampu memahami konsep bilangan bulat',
      textContent: 'Bilangan bulat adalah himpunan bilangan yang terdiri dari bilangan negatif, nol, dan bilangan positif.'
    };
    
    log('Sending request...', 'yellow');
    const startTime = Date.now();
    
    const response = await fetch(`${API_BASE}/api/generate-tp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    const result = await response.json();
    const duration = Date.now() - startTime;
    
    if (result.success) {
      log(`✅ Generate TP: OK (${duration}ms)`, 'green');
      
      if (result.quotaInfo) {
        log(`📊 Quota Info:`, 'blue');
        console.log(`   - Remaining: ${result.quotaInfo.remainingRequests}/${result.quotaInfo.maxRequestsPerMinute}`);
        console.log(`   - Queue Size: ${result.quotaInfo.queueSize}`);
      }
      
      if (result.data) {
        const s1Count = result.data.semester1?.length || 0;
        const s2Count = result.data.semester2?.length || 0;
        log(`✅ Generated: ${s1Count} TP (Sem 1) + ${s2Count} TP (Sem 2)`, 'green');
      }
      
      return true;
    } else {
      log(`❌ Generate TP: FAILED`, 'red');
      console.log('Error:', result.error);
      
      if (result.quotaInfo) {
        log(`ℹ️  Suggestion: ${result.quotaInfo.suggestion}`, 'yellow');
      }
      
      return false;
    }
  } catch (error) {
    log(`❌ Error: ${error.message}`, 'red');
    return false;
  }
}

// Test 3: Rate Limiting (Multiple Requests)
async function testRateLimiting() {
  log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'blue');
  log('TEST 3: Rate Limiting (5 Concurrent Requests)', 'blue');
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'blue');
  
  const numRequests = 5;
  log(`Sending ${numRequests} concurrent requests...`, 'yellow');
  
  const promises = [];
  const startTime = Date.now();
  
  for (let i = 0; i < numRequests; i++) {
    const payload = {
      userId: `test-user-${i}`,
      grade: '7',
      subject: 'Matematika',
      cpReference: `Test CP ${i}`,
      textContent: `Test content ${i}`
    };
    
    promises.push(
      fetch(`${API_BASE}/api/generate-tp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).then(r => r.json())
    );
  }
  
  try {
    const results = await Promise.all(promises);
    const duration = Date.now() - startTime;
    
    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;
    
    log(`\n📊 Results (${duration}ms total):`, 'blue');
    log(`   ✅ Success: ${successCount}/${numRequests}`, successCount === numRequests ? 'green' : 'yellow');
    log(`   ❌ Failed: ${failCount}/${numRequests}`, failCount > 0 ? 'red' : 'green');
    
    // Check if rate limiting is working
    if (duration > 1000) {
      log(`   ✅ Rate limiting detected (took ${(duration/1000).toFixed(1)}s)`, 'green');
    } else {
      log(`   ⚠️  No rate limiting detected (too fast: ${duration}ms)`, 'yellow');
    }
    
    return successCount > 0;
  } catch (error) {
    log(`❌ Error: ${error.message}`, 'red');
    return false;
  }
}

// Test 4: Check Quota After Tests
async function checkFinalQuota() {
  log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'blue');
  log('TEST 4: Final Quota Check', 'blue');
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'blue');
  
  return await testQuotaStatus();
}

// Main Test Runner
async function runAllTests() {
  log('\n╔══════════════════════════════════════════╗', 'blue');
  log('║  GEMINI API QUOTA MANAGEMENT TEST SUITE ║', 'blue');
  log('╚══════════════════════════════════════════╝', 'blue');
  
  const tests = [
    { name: 'Quota Status', fn: testQuotaStatus },
    { name: 'Generate TP', fn: testGenerateTP },
    { name: 'Rate Limiting', fn: testRateLimiting },
    { name: 'Final Quota', fn: checkFinalQuota }
  ];
  
  const results = [];
  
  for (const test of tests) {
    const passed = await test.fn();
    results.push({ name: test.name, passed });
    
    // Wait 2 seconds between tests
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  // Summary
  log('\n╔══════════════════════════════════════════╗', 'blue');
  log('║           TEST SUMMARY                   ║', 'blue');
  log('╚══════════════════════════════════════════╝', 'blue');
  
  results.forEach(({ name, passed }) => {
    const status = passed ? '✅ PASSED' : '❌ FAILED';
    const color = passed ? 'green' : 'red';
    log(`${status} - ${name}`, color);
  });
  
  const passedCount = results.filter(r => r.passed).length;
  const totalCount = results.length;
  
  log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'blue');
  if (passedCount === totalCount) {
    log(`🎉 ALL TESTS PASSED (${passedCount}/${totalCount})`, 'green');
  } else {
    log(`⚠️  SOME TESTS FAILED (${passedCount}/${totalCount})`, 'yellow');
  }
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n', 'blue');
}

// Check if fetch is available (Node 18+)
if (typeof fetch === 'undefined') {
  console.error('❌ Error: fetch is not available. Please use Node.js 18 or higher.');
  console.error('Or install node-fetch: npm install node-fetch');
  process.exit(1);
}

// Run tests
runAllTests().catch(error => {
  log(`\n❌ Fatal Error: ${error.message}`, 'red');
  process.exit(1);
});
