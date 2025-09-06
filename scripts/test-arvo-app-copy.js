#!/usr/bin/env node

const http = require('http');
require('dotenv').config();

// Quick test script specifically for the Arvo hello_world Flask app

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
    console.log('\nFor production mode, please run:');
    console.log('   1. ./scripts/setup-aws.sh');
    console.log('   2. source .env');
    console.log('\nFor simulation mode, the script will continue...');
    return false;
  }
  
  console.log('\n✅ All prerequisites met for production mode!');
  return true;
}

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

async function testArvoApp() {
  console.log('🎯 Testing Arvo Hello World Flask App');
  console.log('====================================');
  
  const isProductionMode = process.env.USE_REAL_TERRAFORM === 'true';
  console.log(`Mode: ${isProductionMode ? '🚀 PRODUCTION (Real AWS)' : '🧪 SIMULATION'}`);
  
  if (isProductionMode) {
    console.log('⚠️  This will create real AWS resources and incur costs!');
    console.log('   - ECR repository for the Flask app');
    console.log('   - App Runner service (estimated cost: ~$0.064/hour)');
    console.log('   - S3 bucket for Terraform state');
    console.log('   - DynamoDB table for state locking');
  }
  
  try {
    // Health check
    console.log('\n🏥 System Health Check');
    const health = await makeRequest('GET', '/health');
    console.log('✅ Status:', health.data.status);

    // Deploy the Arvo app
    console.log('\n🚀 Deploying Arvo Hello World App');
    const deploymentRequest = {
      description: "Deploy this Flask app in us-east-2 using ecs fargate",
      repo: "https://github.com/stknohg/app-runner-flask-sample.git",
      branch: "main"
    };
    
    console.log('📝 Deployment Request:');
    console.log(`   Description: ${deploymentRequest.description}`);
    console.log(`   Repository: ${deploymentRequest.repo}`);
    console.log(`   Branch: ${deploymentRequest.branch}`);
    
    const deployment = await makeRequest('POST', '/deployments', deploymentRequest);
    console.log('\n✅ Deployment Created:', deployment.data.id);
    
    // Monitor progress
    console.log('\n⏳ Monitoring Deployment Progress...');
    const deploymentId = deployment.data.id;
    let attempts = 0;
    const maxAttempts = isProductionMode ? 60 : 6; // 10 minutes for production, 1 minute for simulation
    
    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
      attempts++;
      
      const status = await makeRequest('GET', `/deployments/${deploymentId}`);
      const elapsed = attempts * 10;
      
      console.log(`   📊 ${elapsed}s - Status: ${status.data.status}`);
      
      if (status.data.status === 'success') {
        console.log('\n🎉 DEPLOYMENT SUCCESSFUL!');
        console.log('========================');
        console.log(`🌐 Live URL: ${status.data.service_url}`);
        
        if (isProductionMode) {
          console.log('\n🔗 Testing the live application...');
          console.log(`   Try opening: ${status.data.service_url}`);
          console.log('   Expected: Flask app with "Hello, World!" button');
        }
        
        break;
      } else if (status.data.status === 'failed') {
        console.log('\n❌ DEPLOYMENT FAILED');
        console.log('===================');
        console.log(`Error: ${status.data.error}`);
        break;
      }
    }
    
    // Get detailed logs
    console.log('\n📋 Deployment Pipeline Logs');
    console.log('===========================');
    const logs = await makeRequest('GET', `/deployments/${deploymentId}/logs`);
    
    if (logs.data.logs && logs.data.logs.length > 0) {
      const stepCounts = {};
      logs.data.logs.forEach(log => {
        stepCounts[log.step] = (stepCounts[log.step] || 0) + 1;
      });
      
      console.log('📊 Pipeline Steps Executed:');
      Object.entries(stepCounts).forEach(([step, count]) => {
        console.log(`   ✅ ${step}: ${count} log entries`);
      });
      
      console.log('\n🔍 Key Messages:');
      const keyLogs = logs.data.logs.filter(log => 
        log.message.includes('Generated') || 
        log.message.includes('completed') || 
        log.message.includes('successful') ||
        log.level === 'error'
      );
      
      keyLogs.slice(-10).forEach(log => { // Show last 10 key messages
        const icon = log.level === 'error' ? '❌' : '✅';
        console.log(`   ${icon} [${log.step}] ${log.message.substring(0, 70)}...`);
      });
    }
    
    // Final status
    const finalStatus = await makeRequest('GET', `/deployments/${deploymentId}`);
    console.log('\n🎯 Final Result');
    console.log('===============');
    console.log(`Status: ${finalStatus.data.status}`);
    console.log(`Created: ${finalStatus.data.created_at}`);
    
    if (finalStatus.data.service_url) {
      console.log(`🌐 URL: ${finalStatus.data.service_url}`);
      
      if (isProductionMode) {
        console.log('\n💡 What you can do now:');
        console.log(`   1. Open ${finalStatus.data.service_url} in your browser`);
        console.log('   2. Click the button to test the Flask API');
        console.log('   3. Check AWS Console to see your resources');
        console.log('   4. Monitor costs in AWS Billing dashboard');
      }
    }
    
    if (finalStatus.data.error) {
      console.log(`❌ Error: ${finalStatus.data.error}`);
    }
    
    console.log(`\n📋 Full logs: curl http://localhost:3000/deployments/${deploymentId}/logs`);
    
    return {
      success: finalStatus.data.status === 'success',
      deploymentId,
      url: finalStatus.data.service_url
    };
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    return { success: false, error: error.message };
  }
}

async function demo() {
  console.log('🌟 Arvo Hello World - Production Deployment Test');
  console.log('================================================');
  console.log('Repository: https://github.com/Arvo-AI/hello_world');
  console.log('App Type: Flask with Frontend + Backend');
  console.log('');

  try {
    // Check prerequisites
    const hasPrereqs = await checkPrerequisites();
    if (!hasPrereqs && process.env.USE_REAL_TERRAFORM === 'true') {
      console.log('\n❌ Production mode requires AWS setup. Exiting.');
      process.exit(1);
    } else if (!hasPrereqs) {
      console.log('\n🧪 Running in simulation mode...');
    }

    const result = await testArvoApp();
    
    if (result.success) {
      console.log('\n🎉 SUCCESS! Arvo Hello World app deployed to AWS!');
      console.log('================================================');
      
      if (result.url) {
        console.log(`🌐 Your app is live at: ${result.url}`);
        console.log('');
        console.log('🧪 Test the app:');
        console.log('   1. Open the URL in your browser');
        console.log('   2. You should see a simple page with a button');
        console.log('   3. Click the button to test the Flask API');
        console.log('   4. The button should fetch "Hello, World!" from /api/message');
      }
      
      console.log('\n💰 Cost Management:');
      console.log('   - App Runner: ~$0.064/hour + requests');
      console.log('   - ECR: $0.10/GB/month');
      console.log('   - S3: ~$0.02/GB/month');
      console.log('   - DynamoDB: ~$0.25/month');
      console.log('');
      console.log('🧹 Cleanup when done:');
      console.log('   - Resources will auto-scale down when not used');
      console.log('   - Delete via AWS Console or Terraform destroy');
      
    } else {
      console.log('\n❌ Deployment failed. Check the logs above for details.');
      console.log('💡 Common issues:');
      console.log('   - AWS credentials not configured');
      console.log('   - Missing IAM permissions'); 
      console.log('   - Terraform not installed');
      console.log('   - Docker not running');
    }

  } catch (error) {
    console.error('❌ Demo failed:', error.message);
    process.exit(1);
  }
}

// Run the demo
makeRequest('GET', '/health')
  .then(() => demo())
  .catch(() => {
    console.log('❌ Server not running. Please start with: npm run dev');
    process.exit(1);
  });
