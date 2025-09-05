#!/bin/bash

# Test script for the auto-deploy system

echo "🚀 Testing Auto-Deploy System"
echo "=============================="

# Start the server in background
echo "Starting server..."
npm run build
npm start &
SERVER_PID=$!

# Wait for server to start
sleep 3

echo "Testing health endpoint..."
curl -s http://localhost:3000/health | jq .

echo ""
echo "Creating a test deployment..."
DEPLOYMENT_ID=$(curl -s -X POST http://localhost:3000/deployments \
  -H "Content-Type: application/json" \
  -d '{
    "description": "Deploy this Flask app on AWS with low cost",
    "repo": "https://github.com/example/flask-hello-world"
  }' | jq -r .id)

echo "Deployment ID: $DEPLOYMENT_ID"

echo ""
echo "Checking deployment status..."
sleep 2
curl -s http://localhost:3000/deployments/$DEPLOYMENT_ID | jq .

echo ""
echo "Getting deployment logs..."
curl -s http://localhost:3000/deployments/$DEPLOYMENT_ID/logs | jq .

# Clean up
echo ""
echo "Cleaning up..."
kill $SERVER_PID

echo "Test completed! ✅"
