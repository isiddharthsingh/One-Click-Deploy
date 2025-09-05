#!/usr/bin/env node

const http = require('http');

// Simple demo script to test the auto-deploy API
async function makeRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });

    req.on('error', reject);
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

async function demo() {
  console.log('🚀 Auto-Deploy System Demo');
  console.log('===========================\n');

  try {
    // Test health endpoint
    console.log('1. Testing health endpoint...');
    const health = await makeRequest('GET', '/health');
    console.log('   ✅ Health:', health.data);
    console.log();

    // Create a deployment
    console.log('2. Creating deployment...');
    const deploymentRequest = {
      description: "Deploy this Flask app on AWS with Postgres database and low cost",
      repo: "https://github.com/pallets/flask",
      branch: "main"
    };
    
    const deployment = await makeRequest('POST', '/deployments', deploymentRequest);
    console.log('   ✅ Deployment created:', deployment.data);
    const deploymentId = deployment.data.id;
    console.log();

    // Wait a bit for processing
    console.log('3. Waiting for processing...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Check status
    console.log('4. Checking deployment status...');
    const status = await makeRequest('GET', `/deployments/${deploymentId}`);
    console.log('   📊 Status:', status.data);
    console.log();

    // Get logs
    console.log('5. Fetching deployment logs...');
    const logs = await makeRequest('GET', `/deployments/${deploymentId}/logs`);
    console.log('   📋 Logs:');
    if (logs.data.logs && logs.data.logs.length > 0) {
      logs.data.logs.forEach(log => {
        console.log(`      [${log.step}] ${log.level}: ${log.message}`);
      });
    } else {
      console.log('      No logs available yet');
    }
    console.log();

    // Wait a bit more and check final status
    console.log('6. Waiting for completion...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    const finalStatus = await makeRequest('GET', `/deployments/${deploymentId}`);
    console.log('   🎯 Final Status:', finalStatus.data);
    
    if (finalStatus.data.service_url) {
      console.log(`   🌐 Service URL: ${finalStatus.data.service_url}`);
    }

    console.log('\n✅ Demo completed successfully!');

  } catch (error) {
    console.error('❌ Demo failed:', error.message);
    process.exit(1);
  }
}

// Check if server is running
makeRequest('GET', '/health')
  .then(() => demo())
  .catch(() => {
    console.log('❌ Server not running. Please start with: npm run dev');
    process.exit(1);
  });
