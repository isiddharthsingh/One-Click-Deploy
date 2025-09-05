# AWS Setup for Auto-Deploy System

## Prerequisites

1. **AWS CLI installed**:
```bash
curl "https://awscli.amazonaws.com/AWSCLIV2.pkg" -o "AWSCLIV2.pkg"
sudo installer -pkg AWSCLIV2.pkg -target /
```

2. **Terraform installed**:
```bash
brew tap hashicorp/tap
brew install hashicorp/tap/terraform
```

3. **Docker installed** (for container builds):
```bash
brew install docker
```

## AWS Account Setup

### 1. Create IAM User for Auto-Deploy

Create an IAM user with programmatic access and attach the following policies:

#### Required AWS Managed Policies:
- `AmazonEC2ContainerRegistryFullAccess`
- `AmazonS3FullAccess` 
- `AmazonRDSFullAccess`
- `AWSAppRunnerFullAccess`
- `AmazonECS_FullAccess`
- `AmazonVPCFullAccess`
- `CloudFrontFullAccess`
- `DynamoDBFullAccess`

#### Custom Policy for Additional Permissions:
```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "iam:CreateRole",
                "iam:DeleteRole",
                "iam:AttachRolePolicy",
                "iam:DetachRolePolicy",
                "iam:PassRole",
                "iam:GetRole",
                "iam:CreateInstanceProfile",
                "iam:DeleteInstanceProfile",
                "iam:AddRoleToInstanceProfile",
                "iam:RemoveRoleFromInstanceProfile",
                "iam:ListInstanceProfilesForRole",
                "logs:CreateLogGroup",
                "logs:CreateLogStream",
                "logs:PutLogEvents",
                "logs:DescribeLogGroups",
                "logs:DescribeLogStreams",
                "elasticloadbalancing:*",
                "application-autoscaling:*",
                "route53:*"
            ],
            "Resource": "*"
        }
    ]
}
```

### 2. Configure AWS Credentials

```bash
aws configure
# Enter your Access Key ID
# Enter your Secret Access Key  
# Default region: us-east-2 
# Default output format: json
```

Or set environment variables:
```bash
export AWS_ACCESS_KEY_ID=your_access_key
export AWS_SECRET_ACCESS_KEY=your_secret_key
export AWS_DEFAULT_REGION=us-east-2
```

### 3. Set Auto-Deploy Environment Variables

```bash
# Required for production
export AWS_REGION=us-east-2
export TF_BUCKET=your-app-terraform-state-$(date +%s)
export TF_DDB_TABLE=your-app-terraform-locks
export REGISTRY_URL=$(aws sts get-caller-identity --query Account --output text).dkr.ecr.us-east-2.amazonaws.com
export WORK_ROOT=/tmp/auto-deploy-runs

# Optional
export OPENAI_API_KEY=your_openai_key  # For enhanced NLP
```

### 4. Initialize Terraform State Backend

The system will automatically create the S3 bucket and DynamoDB table for Terraform state management on first run.

### 5. Verify Setup

```bash
# Test AWS access
aws sts get-caller-identity

# Test ECR access  
aws ecr get-login-password --region us-east-2

# Test Terraform
terraform version
```

## Security Best Practices

1. **Use least privilege** - Only grant necessary permissions
2. **Rotate credentials** regularly
3. **Use AWS IAM roles** in production environments
4. **Enable CloudTrail** for audit logging
5. **Set up billing alerts** to monitor costs

## Cost Management

- Set up AWS Budgets to monitor spending
- Use `t3.micro` instances for development
- Clean up resources regularly with `terraform destroy`
- Monitor ECR storage costs

## Troubleshooting

### Common Issues:

1. **Permission Denied**: Check IAM policies
2. **State Lock**: Delete DynamoDB lock manually if stuck
3. **ECR Login**: Run `aws ecr get-login-password | docker login --username AWS --password-stdin $REGISTRY_URL`
4. **Terraform State**: Ensure S3 bucket exists and is accessible

### Support Commands:

```bash
# Check AWS identity
aws sts get-caller-identity

# List S3 buckets
aws s3 ls

# Check ECR repositories
aws ecr describe-repositories

# View Terraform state
terraform state list
```
