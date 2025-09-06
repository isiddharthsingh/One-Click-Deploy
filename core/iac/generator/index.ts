import fs from "fs-extra";
import path from "path";
import { DeploySpec, Plan } from "../../types";

export interface TerraformConfig {
  workdir: string;
  varsFile: string;
  stacks: string[];
}

export async function generateIaC(
  deploySpec: DeploySpec,
  plan: Plan,
  workdir: string
): Promise<TerraformConfig> {
  // Ensure work directory exists
  await fs.ensureDir(workdir);

  // Determine which stacks to include
  const stacks: string[] = [];
  
  // Only include ECR for container apps (state backend already exists)
  if (plan.runtime !== "s3_cloudfront") {
    stacks.push("ecr");
  }

  // Add runtime-specific stacks
  if (plan.runtime === "apprunner") {
    stacks.push("apprunner_service");
  } else if (plan.runtime === "ecs_fargate") {
    stacks.push("ecs_fargate_service");
    if (plan.front) {
      stacks.push("alb_path_router");
    }
  } else if (plan.runtime === "s3_cloudfront" || plan.front === "s3_cloudfront") {
    stacks.push("cloudfront_s3_static_site");
  }
  // ECS Fargate runtime vars are set in generateTfVars, not here

  // Add database if needed
  if (plan.db) {
    stacks.push("rds_postgres");
  }

  // Include sample DynamoDB table for ECS Fargate runs to support /dynamodb route in sample app
  if (plan.runtime === "ecs_fargate") {
    stacks.push("dynamodb_sample");
  }

  // Copy stack modules to work directory
  const stacksDir = path.join(__dirname, "../stacks/aws");
  for (const stack of stacks) {
    const srcDir = path.join(stacksDir, stack);
    const destDir = path.join(workdir, "modules", stack);
    await fs.copy(srcDir, destDir);
  }

  // Generate main.tf
  const mainTf = generateMainTf(stacks, deploySpec, plan);
  await fs.writeFile(path.join(workdir, "main.tf"), mainTf);

  // Generate variables.tf
  const variablesTf = generateVariablesTf(deploySpec, plan);
  await fs.writeFile(path.join(workdir, "variables.tf"), variablesTf);

  // Generate terraform.tfvars.json
  const tfVars = generateTfVars(deploySpec, plan);
  const varsFile = path.join(workdir, "terraform.tfvars.json");
  await fs.writeFile(varsFile, JSON.stringify(tfVars, null, 2));

  // Generate backend configuration
  const backendTf = generateBackendTf(deploySpec);
  await fs.writeFile(path.join(workdir, "backend.tf"), backendTf);

  // Generate root outputs forwarding module outputs
  const outputsTf = generateOutputsTf(stacks);
  if (outputsTf.trim().length > 0) {
    await fs.writeFile(path.join(workdir, "outputs.tf"), outputsTf);
  }

  // Generate README
  const readme = generateReadme(deploySpec, plan, stacks);
  await fs.writeFile(path.join(workdir, "README_RUN.md"), readme);

  return {
    workdir,
    varsFile,
    stacks
  };
}

function generateMainTf(stacks: string[], deploySpec: DeploySpec, plan: Plan): string {
  let mainTf = `terraform {
  required_version = ">= 1.5"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.1"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

`;

  // Add module blocks for each stack
  for (const stack of stacks) {
    if (stack === "ecr") {
      mainTf += `module "ecr" {
  source = "./modules/ecr"
  
  repository_name       = var.app_name
  enable_image_scanning = true
}

`;
    } else if (stack === "apprunner_service") {
      mainTf += `module "apprunner_service" {
  source = "./modules/apprunner_service"
  
  service_name      = var.app_name
  image_uri         = var.image_uri
  port              = var.app_port
  env_vars          = var.env_vars
  cpu               = var.cpu
  memory            = var.memory
  health_check_path = var.health_check_path
  
  tags = var.tags
}

`;
    } else if (stack === "ecs_fargate_service") {
      const envVarsExpr = stacks.includes("rds_postgres")
        ? "merge(var.env_vars, { POSTGRES_URL = module.rds_postgres.database_url, AWS_REGION = var.aws_region })"
        : "merge(var.env_vars, { AWS_REGION = var.aws_region })";
      mainTf += `module "ecs_fargate_service" {
  source = "./modules/ecs_fargate_service"
  
  aws_region        = var.aws_region
  service_name      = var.app_name
  image_uri         = var.image_uri
  container_port    = var.app_port
  health_check_path = var.health_check_path
  cpu               = var.fargate_cpu
  memory            = var.fargate_memory
  desired_count     = var.desired_count
  env_vars          = ${envVarsExpr}
  
  tags = var.tags
}

`;
    } else if (stack === "cloudfront_s3_static_site") {
      mainTf += `module "cloudfront_s3_static_site" {
  source = "./modules/cloudfront_s3_static_site"
  
  bucket_name = "\${var.app_name}-static-site"
  
  tags = var.tags
}

`;
    } else if (stack === "rds_postgres") {
      mainTf += `module "rds_postgres" {
  source = "./modules/rds_postgres"
  
  db_name                 = var.db_name
  username                = var.db_username
  instance_class          = var.db_instance_class
  allocated_storage       = var.db_allocated_storage
  backup_retention_period = var.db_backup_retention
  skip_final_snapshot     = var.db_skip_final_snapshot
  deletion_protection     = var.db_deletion_protection
  
  tags = var.tags
}

`;
    } else if (stack === "dynamodb_sample") {
      mainTf += `module "dynamodb_sample" {
  source = "./modules/dynamodb_sample"
  
  table_name = "Employee"
  tags       = var.tags
}

`;
    }
  }

  return mainTf;
}

function generateOutputsTf(stacks: string[]): string {
  let outputs = "";
  if (stacks.includes("apprunner_service")) {
    outputs += `output "service_url" {
  description = "URL of the service"
  value       = module.apprunner_service.service_url
}

`;
  }
  if (stacks.includes("ecs_fargate_service")) {
    outputs += `output "alb_dns_name" {
  description = "Public DNS name of the ALB"
  value       = module.ecs_fargate_service.alb_dns_name
}

`;
  }
  if (stacks.includes("cloudfront_s3_static_site")) {
    outputs += `output "cdn_url" {
  description = "URL of the CDN"
  value       = module.cloudfront_s3_static_site.cdn_url
}

`;
  }
  return outputs;
}

function generateTfVars(deploySpec: DeploySpec, plan: Plan): Record<string, any> {
  // Generate unique names to avoid conflicts
  const timestamp = Date.now();
  const uniqueSuffix = `${deploySpec.app_name}-${timestamp}`;
  
  const vars: Record<string, any> = {
    aws_region: deploySpec.region,
    app_name: deploySpec.app_name,
    tags: {
      Environment: deploySpec.env,
      Application: deploySpec.app_name,
      ManagedBy: "auto-deploy",
      CreatedAt: new Date().toISOString()
    }
  };

  // Add runtime-specific variables
  if (plan.runtime === "apprunner") {
    // Use the actual registry URL from environment
    const registryUrl = process.env.REGISTRY_URL || `${process.env.AWS_ACCOUNT_ID || "123456789012"}.dkr.ecr.${deploySpec.region}.amazonaws.com/${deploySpec.app_name}`;
    // Use run-specific tag if provided via TFVARS update; default to latest here (overridden later in pipeline)
    vars.image_uri = `${registryUrl}:latest`;
    vars.app_port = 8080;
    vars.env_vars = { PORT: String(8080) };
    vars.cpu = deploySpec.hints.perf === "high" ? "1 vCPU" : "0.25 vCPU";
    vars.memory = deploySpec.hints.perf === "high" ? "2 GB" : "0.5 GB";
    // Default to root path for broader compatibility (many apps serve at "/")
    vars.health_check_path = "/";
  }

  if (plan.runtime === "ecs_fargate") {
    const registryUrl = process.env.REGISTRY_URL || `${process.env.AWS_ACCOUNT_ID || "123456789012"}.dkr.ecr.${deploySpec.region}.amazonaws.com/${deploySpec.app_name}`;
    vars.image_uri = `${registryUrl}:latest`;
    const defaultPort = 8080;
    vars.app_port = defaultPort;
    vars.env_vars = { PORT: String(defaultPort), AWS_DEFAULT_REGION: deploySpec.region };

    // Map perf hint to Fargate CPU/Memory in units expected by AWS (strings)
    if (deploySpec.hints.perf === "high") {
      vars.fargate_cpu = "1024";
      vars.fargate_memory = "2048";
    } else if (deploySpec.hints.perf === "standard") {
      vars.fargate_cpu = "512";
      vars.fargate_memory = "1024";
    } else {
      vars.fargate_cpu = "256";
      vars.fargate_memory = "512";
    }

    vars.desired_count = 1;
    vars.health_check_path = "/";
  }

  // Add database variables
  if (plan.db) {
    vars.db_name = deploySpec.app_name.replace(/-/g, "_");
    vars.db_username = "postgres";
    vars.db_instance_class = deploySpec.hints.cost === "low" ? "db.t3.micro" : "db.t3.small";
    vars.db_allocated_storage = 20;
    vars.db_backup_retention = 7;
    vars.db_skip_final_snapshot = true;
    // Always disable deletion protection per request
    vars.db_deletion_protection = false;
  }

  return vars;
}

function generateVariablesTf(deploySpec: DeploySpec, plan: Plan): string {
  let variablesTf = `# Input variables for ${deploySpec.app_name} deployment

variable "aws_region" {
  description = "AWS region for deployment"
  type        = string
}

variable "app_name" {
  description = "Name of the application"
  type        = string
}

variable "tags" {
  description = "Tags to apply to all resources"
  type        = map(string)
  default     = {}
}

`;

  // Add runtime-specific variables
  if (plan.runtime === "apprunner") {
    variablesTf += `variable "image_uri" {
  description = "URI of the container image"
  type        = string
}

variable "app_port" {
  description = "Port the application listens on"
  type        = number
}

variable "env_vars" {
  description = "Environment variables for the application"
  type        = map(string)
  default     = {}
}

variable "cpu" {
  description = "CPU allocation for the service"
  type        = string
}

variable "memory" {
  description = "Memory allocation for the service"
  type        = string
}

variable "health_check_path" {
  description = "Health check path"
  type        = string
}

`;
  }

  // Add ECS Fargate variables
  if (plan.runtime === "ecs_fargate") {
    variablesTf += `variable "image_uri" {
  description = "URI of the container image"
  type        = string
}

variable "app_port" {
  description = "Container port"
  type        = number
}

variable "env_vars" {
  description = "Environment variables for the service"
  type        = map(string)
  default     = {}
}

variable "fargate_cpu" {
  description = "CPU units for Fargate task"
  type        = string
}

variable "fargate_memory" {
  description = "Memory (MB) for Fargate task"
  type        = string
}

variable "desired_count" {
  description = "Desired task count"
  type        = number
}

variable "health_check_path" {
  description = "ALB health check path"
  type        = string
}

`;
  }

  // Add database variables if needed
  if (plan.db) {
    variablesTf += `variable "db_name" {
  description = "Database name"
  type        = string
}

variable "db_username" {
  description = "Database username"
  type        = string
}

variable "db_instance_class" {
  description = "Database instance class"
  type        = string
}

variable "db_allocated_storage" {
  description = "Database allocated storage"
  type        = number
}

variable "db_backup_retention" {
  description = "Database backup retention period"
  type        = number
}

variable "db_skip_final_snapshot" {
  description = "Skip final snapshot on database deletion"
  type        = bool
}

variable "db_deletion_protection" {
  description = "Enable deletion protection on database"
  type        = bool
}

`;
  }

  return variablesTf;
}

function generateBackendTf(deploySpec: DeploySpec): string {
  // Use environment variables for bucket and table names
  const bucketName = process.env.TF_BUCKET || `${deploySpec.app_name}-terraform-state`;
  const tableName = process.env.TF_DDB_TABLE || `${deploySpec.app_name}-terraform-locks`;
  // Default to legacy key for compatibility with existing state; allow override
  const stateKey = process.env.TF_STATE_KEY || `terraform.tfstate`;
  
  return `terraform {
  backend "s3" {
    bucket         = "${bucketName}"
    key            = "${stateKey}"
    region         = "${deploySpec.region}"
    dynamodb_table = "${tableName}"
    encrypt        = true
  }
}
`;
}

function generateReadme(deploySpec: DeploySpec, plan: Plan, stacks: string[]): string {
  return `# Terraform Configuration for ${deploySpec.app_name}

This directory contains the generated Terraform configuration for deploying ${deploySpec.app_name}.

## Configuration

- **Cloud**: ${deploySpec.cloud}
- **Region**: ${deploySpec.region}
- **Runtime**: ${plan.runtime}
- **Database**: ${plan.db || "None"}
- **Stacks**: ${stacks.join(", ")}

## Commands

1. Initialize Terraform:
   \`\`\`bash
   terraform init
   \`\`\`

2. Plan the deployment:
   \`\`\`bash
   terraform plan -var-file=terraform.tfvars.json
   \`\`\`

3. Apply the configuration:
   \`\`\`bash
   terraform apply -var-file=terraform.tfvars.json -auto-approve
   \`\`\`

4. Destroy when done:
   \`\`\`bash
   terraform destroy -var-file=terraform.tfvars.json -auto-approve
   \`\`\`

## Outputs

After successful deployment, Terraform will output the service URLs and connection details.
`;
}
