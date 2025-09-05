#!/usr/bin/env node

const http = require('http');

// Production demo script that uses real AWS resources
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

async function checkPrerequisites() {
  console.log('🔍 Checking Prerequisites');
  console.log('=========================');
  
  const required = [
    'AWS_REGION',
    'TF_BUCKET', 
    'TF_DDB_TABLE',
    'REGISTRY_URL',
    'USE_REAL_TERRAFORM'
  ];
  
  const missing = [];
  for (const envVar of required) {
    if (!process.env[envVar]) {
      missing.push(envVar);
    } else {
      console.log(`✅ ${envVar}: ${process.env[envVar]}`);
    }
  }
  
  if (missing.length > 0) {
    console.log('\n❌ Missing required environment variables:');
    missing.forEach(env => console.log(`   - ${env}`));
    console.log('\nPlease run: ./scripts/setup-aws.sh');
    console.log('Then: source .env');
    return false;
  }
  
  console.log('\n✅ All prerequisites met!');
  return true;
}

async function testProductionDeployment(name, request, expectedTime = 300) {
  console.log(`\n🚀 Production Deployment: ${name}`);
  console.log('=' .repeat(60));
  
  try {
    console.log('Creating deployment...');
    const deployment = await makeRequest('POST', '/deployments', request);
    console.log('✅ Deployment created:', deployment.data.id);
    
    console.log(`\n⏳ Deploying to AWS (estimated ${expectedTime}s)...`);
    console.log('   This will:');
    console.log('   - Clone and analyze the repository');
    console.log('   - Generate Terraform configurations');
    console.log('   - Create AWS resources (ECR, App Runner/ECS, RDS, etc.)');
    console.log('   - Build and push container images');
    console.log('   - Deploy the application');
    console.log('   - Verify health and return live URL');
    
    // Poll for completion
    let attempts = 0;
    const maxAttempts = Math.ceil(expectedTime / 10);
    let finalStatus;
    
    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
      attempts++;
      
      const status = await makeRequest('GET', `/deployments/${deployment.data.id}`);
      const progress = Math.round((attempts / maxAttempts) * 100);
      
      console.log(`   📊 Progress: ${progress}% (${attempts * 10}s) - Status: ${status.data.status}`);
      
      if (status.data.status === 'success' || status.data.status === 'failed') {
        finalStatus = status.data;
        break;
      }
    }
    
    if (!finalStatus) {
      // Get final status
      finalStatus = (await makeRequest('GET', `/deployments/${deployment.data.id}`)).data;
    }
    
    console.log('\n📋 Final Result:');
    console.log(`   Status: ${finalStatus.status}`);
    
    if (finalStatus.status === 'success') {
      console.log(`   🌐 Live URL: ${finalStatus.service_url}`);
      console.log('   ✅ Deployment successful!');
      
      // Test the live URL
      if (finalStatus.service_url) {
        console.log('\n🔗 Testing live service...');
        try {
          const response = await fetch(finalStatus.service_url);
          console.log(`   HTTP Status: ${response.status}`);
          console.log('   ✅ Service is responding!');
        } catch (error) {
          console.log('   ⚠️  Service not yet responding (may take a few more minutes)');
        }
      }
    } else {
      console.log(`   ❌ Error: ${finalStatus.error}`);
    }
    
    // Get deployment logs
    console.log('\n📋 Deployment Logs:');
    const logs = await makeRequest('GET', `/deployments/${deployment.data.id}/logs`);
    if (logs.data.logs && logs.data.logs.length > 0) {
      const importantSteps = ['parse', 'analyze', 'plan', 'terraform', 'build', 'deploy'];
      logs.data.logs.forEach(log => {
        if (importantSteps.includes(log.step)) {
          const icon = log.level === 'error' ? '❌' : log.level === 'warn' ? '⚠️' : '✅';
          console.log(`   ${icon} ${log.step}: ${log.message.substring(0, 80)}...`);
        }
      });
    }
    
    return { 
      success: finalStatus.status === 'success', 
      id: deployment.data.id,
      url: finalStatus.service_url,
      error: finalStatus.error
    };
    
  } catch (error) {
    console.log('❌ Deployment failed:', error.message);
    return { success: false, error: error.message };
  }
}

async function demo() {
  console.log('🌟 Auto-Deploy Production Demo');
  console.log('==============================');
  console.log('This demo deploys REAL applications to AWS!');
  console.log('💰 Note: This will incur AWS costs.');
  console.log('');

  try {
    // Check prerequisites
    if (!(await checkPrerequisites())) {
      process.exit(1);
    }
    
    // Test health
    console.log('\n🏥 Health Check');
    const health = await makeRequest('GET', '/health');
    console.log('✅ System Status:', health.data.status);

    // Production deployment scenarios
    const scenarios = [
      {
        name: "Arvo Hello World Flask App",
        request: {
          description: "Deploy this Flask app with frontend and backend on AWS with low cost",
          repo: "https://github.com/Arvo-AI/hello_world",
          branch: "main"
        },
        expectedTime: 300 // 5 minutes for real AWS deployment
      }
    ];

    console.log('\n⚠️  WARNING: This will create real AWS resources and incur costs!');
    console.log('   - ECR repository');
    console.log('   - App Runner service or ECS cluster');
    console.log('   - RDS database (if detected)');
    console.log('   - S3 bucket and CloudFront (for static sites)');
    console.log('');
    
    // Simple confirmation (in a real CLI tool, you'd use a proper prompt library)
    console.log('Continue? The demo will start in 10 seconds...');
    console.log('Press Ctrl+C to cancel.');
    await new Promise(resolve => setTimeout(resolve, 10000));

    const results = [];
    for (const scenario of scenarios) {
      const result = await testProductionDeployment(scenario.name, scenario.request, scenario.expectedTime);
      results.push({ ...scenario, ...result });
    }

    // Summary
    console.log('\n🎯 PRODUCTION DEMO SUMMARY');
    console.log('==========================');
    results.forEach(result => {
      const status = result.success ? '✅' : '❌';
      console.log(`${status} ${result.name}: ${result.success ? 'SUCCESS' : 'FAILED'}`);
      if (result.url) {
        console.log(`   🌐 URL: ${result.url}`);
      }
      if (result.id) {
        console.log(`   📋 Logs: curl http://localhost:3000/deployments/${result.id}/logs`);
      }
    });

    const successCount = results.filter(r => r.success).length;
    console.log(`\n📊 Results: ${successCount}/${results.length} deployments successful`);
    
    if (successCount > 0) {
      console.log('\n🎉 SUCCESS! Your applications are now running on AWS!');
      console.log('   - Check the AWS Console to see your resources');
      console.log('   - Monitor costs in AWS Billing dashboard');
      console.log('   - Clean up with: terraform destroy (in the work directories)');
    }

    console.log('\n💰 Cost Management:');
    console.log('   - App Runner: ~$0.064/hour + requests');
    console.log('   - RDS t3.micro: ~$0.017/hour');
    console.log('   - ECR: $0.10/GB/month');
    console.log('   - Remember to clean up resources when done!');

  } catch (error) {
    console.error('❌ Production demo failed:', error.message);
    process.exit(1);
  }
}

// Check if server is running and environment is configured
makeRequest('GET', '/health')
  .then(() => {
    if (process.env.USE_REAL_TERRAFORM !== 'true') {
      console.log('❌ Production mode not enabled.');
      console.log('   Set USE_REAL_TERRAFORM=true in your environment.');
      console.log('   Run: ./scripts/setup-aws.sh && source .env');
      process.exit(1);
    }
    demo();
  })
  .catch(() => {
    console.log('❌ Server not running. Please start with: npm run dev');
    process.exit(1);
  });
