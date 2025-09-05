#!/bin/bash

# Auto-Deploy AWS Setup Script
# This script sets up the necessary AWS resources for the auto-deploy system

set -e

echo "🚀 Auto-Deploy AWS Setup"
echo "========================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo -e "${RED}❌ AWS CLI is not installed. Please install it first.${NC}"
    echo "   brew install awscli"
    exit 1
fi

# Check if Terraform is installed
if ! command -v terraform &> /dev/null; then
    echo -e "${RED}❌ Terraform is not installed. Please install it first.${NC}"
    echo "   brew tap hashicorp/tap && brew install hashicorp/tap/terraform"
    exit 1
fi

# Check AWS credentials
echo "🔐 Checking AWS credentials..."
if ! aws sts get-caller-identity &> /dev/null; then
    echo -e "${RED}❌ AWS credentials not configured. Please run 'aws configure' first.${NC}"
    exit 1
fi

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
REGION=${AWS_REGION:-us-east-2}

echo -e "${GREEN}✅ AWS credentials configured${NC}"
echo "   Account ID: $ACCOUNT_ID"
echo "   Region: $REGION"

# Generate unique names
TIMESTAMP=$(date +%s)
APP_NAME=${1:-auto-deploy}
BUCKET_NAME="${APP_NAME}-terraform-state-${TIMESTAMP}"
TABLE_NAME="${APP_NAME}-terraform-locks"
ECR_REPO="${APP_NAME}"

echo ""
echo "📋 Configuration:"
echo "   Terraform State Bucket: $BUCKET_NAME"
echo "   DynamoDB Lock Table: $TABLE_NAME"
echo "   ECR Repository: $ECR_REPO"
echo ""

# Create S3 bucket for Terraform state
echo "🪣 Creating S3 bucket for Terraform state..."
if aws s3 mb "s3://$BUCKET_NAME" --region "$REGION"; then
    echo -e "${GREEN}✅ S3 bucket created: $BUCKET_NAME${NC}"
    
    # Enable versioning
    aws s3api put-bucket-versioning \
        --bucket "$BUCKET_NAME" \
        --versioning-configuration Status=Enabled
    
    # Enable server-side encryption
    aws s3api put-bucket-encryption \
        --bucket "$BUCKET_NAME" \
        --server-side-encryption-configuration '{
            "Rules": [{
                "ApplyServerSideEncryptionByDefault": {
                    "SSEAlgorithm": "AES256"
                }
            }]
        }'
    
    echo -e "${GREEN}✅ S3 bucket configured with versioning and encryption${NC}"
else
    echo -e "${YELLOW}⚠️  S3 bucket might already exist or creation failed${NC}"
fi

# Create DynamoDB table for state locking
echo ""
echo "🗄️  Creating DynamoDB table for state locking..."
if aws dynamodb create-table \
    --table-name "$TABLE_NAME" \
    --attribute-definitions AttributeName=LockID,AttributeType=S \
    --key-schema AttributeName=LockID,KeyType=HASH \
    --billing-mode PAY_PER_REQUEST \
    --region "$REGION" &> /dev/null; then
    
    echo -e "${GREEN}✅ DynamoDB table created: $TABLE_NAME${NC}"
    
    # Wait for table to be active
    echo "   Waiting for table to be active..."
    aws dynamodb wait table-exists --table-name "$TABLE_NAME" --region "$REGION"
    echo -e "${GREEN}✅ DynamoDB table is active${NC}"
else
    echo -e "${YELLOW}⚠️  DynamoDB table might already exist or creation failed${NC}"
fi

# Create ECR repository
echo ""
echo "🐳 Creating ECR repository..."
if aws ecr create-repository \
    --repository-name "$ECR_REPO" \
    --region "$REGION" &> /dev/null; then
    
    echo -e "${GREEN}✅ ECR repository created: $ECR_REPO${NC}"
else
    echo -e "${YELLOW}⚠️  ECR repository might already exist or creation failed${NC}"
fi

# Get ECR registry URL
REGISTRY_URL="$ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/$ECR_REPO"

# Generate environment variables
echo ""
echo "📝 Environment Variables"
echo "========================"
echo "Add these to your environment (.bashrc, .zshrc, or .env):"
echo ""
echo "export AWS_REGION=$REGION"
echo "export TF_BUCKET=$BUCKET_NAME"
echo "export TF_DDB_TABLE=$TABLE_NAME"
echo "export REGISTRY_URL=$REGISTRY_URL"
echo "export WORK_ROOT=/tmp/auto-deploy-runs"
echo "export USE_REAL_TERRAFORM=true"
echo ""

# Create .env file
echo "📄 Creating .env file..."
cat > .env << EOF
# Auto-Deploy Environment Variables
AWS_REGION=$REGION
TF_BUCKET=$BUCKET_NAME
TF_DDB_TABLE=$TABLE_NAME
REGISTRY_URL=$REGISTRY_URL
WORK_ROOT=/tmp/auto-deploy-runs
USE_REAL_TERRAFORM=true

# Optional: OpenAI API key for enhanced NLP
# OPENAI_API_KEY=your_openai_key_here
EOF

echo -e "${GREEN}✅ Environment variables saved to .env file${NC}"

# Test ECR authentication
echo ""
echo "🔑 Testing ECR authentication..."
if aws ecr get-login-password --region "$REGION" | docker login --username AWS --password-stdin "$ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com" &> /dev/null; then
    echo -e "${GREEN}✅ ECR authentication successful${NC}"
else
    echo -e "${YELLOW}⚠️  ECR authentication failed (Docker might not be running)${NC}"
fi

echo ""
echo -e "${GREEN}🎉 AWS Setup Complete!${NC}"
echo "========================"
echo ""
echo "Next steps:"
echo "1. Source the environment variables: source .env"
echo "2. Start the auto-deploy server: npm run dev"
echo "3. Test with real AWS deployments!"
echo ""
echo "💰 Cost Management:"
echo "   - Monitor your AWS billing dashboard"
echo "   - Clean up resources with: terraform destroy"
echo "   - Delete S3 bucket and DynamoDB table when done"
echo ""
echo "🔧 Troubleshooting:"
echo "   - Check AWS credentials: aws sts get-caller-identity"
echo "   - Verify permissions: see docs/AWS_SETUP.md"
echo "   - Monitor CloudTrail for API calls"
