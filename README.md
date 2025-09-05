# Auto-Deploy 🚀

Turn a short request and a repo link into a running app on cloud.

## Features

- **Natural Language Input**: Describe what you want to deploy in plain English
- **Multi-Framework Support**: Flask, Django, Express, Next.js, React, static sites
- **Smart Infrastructure**: Automatically picks the right AWS services (App Runner, ECS, S3+CloudFront)
- **One-Click Deploy**: From repo to live URL with full pipeline automation
- **Comprehensive Logging**: Track every step with structured logs

## Quick Start

### MVP Mode (Simulated Deployments)

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

4. **Run the demo:**
```bash
# In another terminal
node scripts/demo.js
```

### Production Mode (Real AWS Deployments)

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

5. **Run production deployment:**
```bash
node scripts/demo-production.js
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

## Environment Variables (Optional)

For production deployments, configure:

```bash
export AWS_REGION=us-east-2
export TF_BUCKET=your-terraform-state-bucket
export TF_DDB_TABLE=your-terraform-lock-table
export REGISTRY_URL=your-ecr-registry-url
export WORK_ROOT=/tmp/auto-deploy-runs
```

## Project Structure

```
auto-deploy/
├── apps/api/                 # FastAPI server
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
- `node scripts/demo.js` - Run interactive demo

## Current Status (MVP)

✅ **Completed Features:**
- Natural language parsing with rule-based system
- Repository analysis for major frameworks
- Intelligent runtime planning
- Complete Terraform stack generation
- Build system architecture (Docker + Buildpacks)
- Full API with logging and status tracking
- End-to-end pipeline orchestration

🚧 **MVP Limitations:**
- Simulated deployments (no actual AWS provisioning)
- In-memory storage (no persistence)
- Basic error handling
- No authentication/authorization

## Next Steps for Production

1. **AWS Integration** - Connect to real AWS services
2. **Persistence** - Add database for run history
3. **Authentication** - Add user management
4. **UI Dashboard** - Web interface for deployments
5. **Advanced Features** - Custom domains, environment management
6. **Monitoring** - Application health monitoring

## Contributing

This is an MVP implementation. The architecture is designed for extensibility:

- Add new framework detectors in `core/analyzer/`
- Add new cloud providers in `core/iac/stacks/`
- Add new runtime strategies in `core/planner/`
- Add new build systems in `core/build/`

## License

MIT
