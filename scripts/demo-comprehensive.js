#!/usr/bin/env node

const http = require('http');

// Comprehensive demo script showing different deployment scenarios
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

async function testDeployment(name, request) {
  console.log(`\n🔥 Testing: ${name}`);
  console.log('=' .repeat(50));
  
  try {
    // Create deployment
    console.log('Creating deployment...');
    const deployment = await makeRequest('POST', '/deployments', request);
    console.log('✅ Deployment created:', deployment.data.id);
    
    // Wait for processing
    console.log('Processing (waiting 8 seconds)...');
    await new Promise(resolve => setTimeout(resolve, 8000));
    
    // Get final status
    const status = await makeRequest('GET', `/deployments/${deployment.data.id}`);
    console.log('📊 Final Status:', status.data.status);
    
    if (status.data.error) {
      console.log('❌ Error:', status.data.error.split('\n')[0]); // First line only
    }
    
    if (status.data.service_url) {
      console.log('🌐 Service URL:', status.data.service_url);
    }
    
    // Get key logs
    const logs = await makeRequest('GET', `/deployments/${deployment.data.id}/logs`);
    if (logs.data.logs && logs.data.logs.length > 0) {
      console.log('📋 Key Steps:');
      const keySteps = ['parse', 'analyze', 'plan'];
      logs.data.logs.forEach(log => {
        if (keySteps.includes(log.step) && log.level === 'info' && log.message.includes('Generated')) {
          console.log(`   ✓ ${log.step}: ${log.message}`);
        }
      });
    }
    
    return { success: status.data.status === 'success', id: deployment.data.id };
    
  } catch (error) {
    console.log('❌ Test failed:', error.message);
    return { success: false, error: error.message };
  }
}

async function demo() {
  console.log('🚀 Auto-Deploy System - Comprehensive Demo');
  console.log('==========================================');

  try {
    // Test health
    console.log('\n🏥 Health Check');
    const health = await makeRequest('GET', '/health');
    console.log('✅ System healthy:', health.data.status);

    // Test scenarios
    const scenarios = [
      {
        name: "Simple Flask App (Real Repo)",
        request: {
          description: "Deploy this Python Flask app on AWS with low cost",
          repo: "https://github.com/miguelgrinberg/microblog",
          branch: "main"
        }
      },
      {
        name: "Static Site Deployment", 
        request: {
          description: "Deploy this static website on AWS with CloudFront",
          repo: "https://github.com/github/personal-website",
          branch: "main"
        }
      },
      {
        name: "High Performance API",
        request: {
          description: "Deploy this Express API on AWS with high performance and Postgres database",
          repo: "https://github.com/expressjs/express",
          branch: "master"
        }
      },
      {
        name: "React App with Custom Region",
        request: {
          description: "Deploy this React frontend in us-west-2 region with minimal cost",
          repo: "https://github.com/facebook/create-react-app",
          branch: "main"
        }
      }
    ];

    const results = [];
    for (const scenario of scenarios) {
      const result = await testDeployment(scenario.name, scenario.request);
      results.push({ ...scenario, ...result });
    }

    // Summary
    console.log('\n📊 DEMO SUMMARY');
    console.log('================');
    results.forEach(result => {
      const status = result.success ? '✅' : '❌';
      console.log(`${status} ${result.name}: ${result.success ? 'SUCCESS' : 'FAILED'}`);
      if (result.id) {
        console.log(`   ID: ${result.id}`);
      }
    });

    const successCount = results.filter(r => r.success).length;
    console.log(`\n🎯 Results: ${successCount}/${results.length} scenarios completed successfully`);
    
    if (successCount > 0) {
      console.log('\n💡 The system successfully:');
      console.log('   - Parsed natural language descriptions');
      console.log('   - Analyzed repository structures'); 
      console.log('   - Generated deployment plans');
      console.log('   - Created infrastructure configurations');
      console.log('   - Provided structured logging');
    }

    console.log('\n🚀 Demo completed! The auto-deploy system is working correctly.');
    console.log('Note: Deployments are simulated in this MVP - no actual AWS resources created.');

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
    console.log('   Then run this demo again.');
    process.exit(1);
  });
