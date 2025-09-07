# Auto-Deploy 🚀

Turn a short request and a repo link into a running app on cloud.

## Features

- **Natural Language Input**: Describe what you want to deploy in plain English
- **Multi-Framework Support**: Flask, Django, Express, Next.js, React, static sites
- **Smart Infrastructure**: Automatically picks the right AWS services (App Runner, ECS Fargate + ALB, S3+CloudFront, RDS Postgres)
- **One-Click Deploy**: From repo to live URL with full pipeline automation
- **Comprehensive Logging**: Track every step with structured logs
- **Production Deployments**: Real AWS provisioning via Terraform
- **Container Build & Push**: Docker/Buildpacks with ECR login and linux/amd64 platform
- **Resilient Terraform Runner**: Auto force-unlock state and import existing resources when safe

## Quick Start

### Local Development

1. **Install dependencies:**
```bash
npm install
```

2. **Build the project:**
```bash
npm run build
```

3. **Start the development server:**
```bash
npm run dev
```



### Production Deployments (Real AWS)

1. **Prerequisites:**
   - AWS CLI installed and configured
   - Terraform installed
   - Docker installed and running
   - Valid AWS account with appropriate permissions

2. **Set up AWS resources:**
```bash
./scripts/setup-aws.sh
```

3. **Load environment variables:**
```bash
source .env
```

4. **Start the server:**
```bash
npm run dev
```

5. **Run a production deployment:**
```bash
# Deploy a real Flask sample app to AWS
node scripts/test-arvo-app.js

# Deploy an alternate repo
node scripts/test-arvo-app-copy.js
```

## API Usage

### Create Deployment
```bash
curl -X POST http://localhost:3000/deployments \
  -H "content-type: application/json" \
  -d '{
    "description": "Deploy this Flask app on AWS with Postgres database and low cost",
    "repo": "https://github.com/user/flask-app",
    "branch": "main"
  }'
```

### Check Status
```bash
curl http://localhost:3000/deployments/{id}
```

### Get Logs
```bash
curl http://localhost:3000/deployments/{id}/logs
```

### Filter Logs by Step
```bash
curl http://localhost:3000/deployments/{id}/logs?step=build
```

## Natural Language Examples

The parser understands various deployment descriptions:

- `"Deploy this Flask app on AWS"`
- `"Deploy React frontend with Express API and Postgres database"`
- `"Deploy this static site on AWS with low cost"`
- `"Deploy Django app with Redis cache in us-west-2"`
- `"Deploy Next.js app with high performance"`

## Architecture

The system follows a comprehensive pipeline:

1. **Parser** - Converts natural language to structured DeploySpec
2. **Analyzer** - Scans repository to detect frameworks, dependencies, and structure
3. **Planner** - Decides optimal runtime and infrastructure based on app requirements
4. **IaC Generator** - Creates Terraform configurations for AWS resources
5. **Builder** - Builds Docker images with buildpacks or handles static sites
6. **Deployer** - Provisions infrastructure and deploys applications
7. **Verifier** - Checks health and provides deployment status

## Supported Frameworks

### Python
- **Flask** - Auto-detects, configures gunicorn, handles database connections
- **Django** - Detects manage.py, configures WSGI, sets up database
- **FastAPI** - Configures uvicorn server, handles async applications

### JavaScript/TypeScript
- **Express** - Detects API servers, configures for container deployment
- **Next.js** - Handles SSR/SSG, builds optimized bundles
- **React (Vite)** - Static builds, S3+CloudFront deployment
- **Create React App** - Static builds with proper routing

### Static Sites
- **HTML/CSS/JS** - Direct S3+CloudFront deployment

## Infrastructure Decisions

The planner automatically chooses the best AWS services:

### Static Sites
- **S3 + CloudFront** for pure static content
- Automatic SPA routing configuration
- Optimized caching and compression

### Simple HTTP Services
- **AWS App Runner** for single-service applications
- Automatic scaling and load balancing
- Built-in health checks

### Complex Applications
- **ECS Fargate + ALB** for multi-service applications
- **RDS Postgres** when database is detected
- Custom networking and routing

Notes:
- Simple single-service apps favor App Runner. Explicit multi-service/DB requirements favor ECS Fargate + ALB and RDS.
- Flask ports (5000/8080) and health checks are auto-configured.

## Environment Variables

For production deployments, configure:

```bash
export AWS_REGION=us-east-2
export TF_BUCKET=your-terraform-state-bucket
export TF_DDB_TABLE=your-terraform-lock-table
export REGISTRY_URL=your-ecr-registry-url
export WORK_ROOT=/tmp/auto-deploy-runs
export USE_REAL_TERRAFORM=true
```

## Project Structure

```
auto-deploy/
├── apps/api/                 # Fastify server
├── core/
│   ├── parser/              # Natural language parser
│   ├── analyzer/            # Repository analyzer
│   ├── planner/             # Deployment planner
│   ├── iac/                 # Infrastructure as Code
│   │   ├── generator/       # Terraform generator
│   │   └── stacks/aws/      # AWS Terraform modules
│   ├── build/               # Build system (Docker/Buildpacks)
│   └── orchestration/       # Pipeline orchestrator
├── examples/                # Test repositories
└── scripts/                 # Demo and utility scripts
```

## Development

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build TypeScript to JavaScript
- `npm run start` - Start production server
- `npm run lint` - Lint code with ESLint
- `node scripts/test-arvo-app.js` - Run production test deployment
- `node scripts/test-arvo-app-copy.js` - Run alternate production test

## Validated Examples

Successfully deployed end-to-end to AWS:

- https://github.com/stknohg/app-runner-flask-sample.git
- https://github.com/isiddharthsingh/Flash-Hello-World.git

## Cost and Cleanup

- App Runner: ~ $0.064/hour + requests
- ECR: ~$0.10/GB/month; S3 and DynamoDB minimal

Cleanup:
- Delete resources via AWS Console, or run Terraform destroy from generated workdir.

## Contributing

The architecture is designed for extensibility:

- Add new framework detectors in `core/analyzer/`
- Add new cloud providers in `core/iac/stacks/`
- Add new runtime strategies in `core/planner/`
- Add new build systems in `core/build/`

## License

MIT
