import { v4 as uuidv4 } from "uuid";
import fs from "fs-extra";
import path from "path";
import { execa } from "execa";
import { parseDescription } from "../parser";
import { analyzeRepo } from "../analyzer";
import { createPlan, validatePlan } from "../planner";
import { generateIaC } from "../iac/generator";
import { runTerraform } from "../iac/runner";
import { buildApplication } from "../build";
import { DeploymentRequest } from "../../apps/api/src/run";
import { RunLog } from "../types";

export interface PipelineResult {
  success: boolean;
  runId: string;
  serviceUrl?: string;
  error?: string;
  logs: RunLog[];
}

export class DeploymentPipeline {
  private runId: string;
  private logs: RunLog[] = [];
  private workRoot: string;
  private onLog?: (entry: RunLog) => void;

  constructor(private request: DeploymentRequest, onLog?: (entry: RunLog) => void) {
    this.runId = uuidv4();
    this.workRoot = process.env.WORK_ROOT || "/tmp/auto-deploy-runs";
    this.onLog = onLog;
  }

  private log(step: string, level: "info" | "warn" | "error", message: string, meta?: any): void {
    const logEntry: RunLog = {
      time: new Date().toISOString(),
      run_id: this.runId,
      step,
      level,
      message,
      meta
    };
    
    this.logs.push(logEntry);
    console.log(`[${this.runId}] ${step}: ${message}`);
    if (this.onLog) {
      try { this.onLog(logEntry); } catch {}
    }
  }

  async execute(): Promise<PipelineResult> {
    const startTime = Date.now();
    
    try {
      this.log("pipeline", "info", "Starting deployment pipeline", {
        repo: this.request.repo,
        description: this.request.description
      });

      // Step 1: Parse natural language description
      this.log("parse", "info", "Parsing deployment description");
      const deploySpec = parseDescription(this.request.description);
      this.log("parse", "info", "Generated DeploySpec", { deploySpec });

      // Step 2: Clone and analyze repository
      this.log("clone", "info", "Cloning repository");
      const repoPath = await this.cloneRepository();
      
      this.log("analyze", "info", "Analyzing repository structure");
      const repoFacts = analyzeRepo(repoPath);
      this.log("analyze", "info", "Generated RepoFacts", { repoFacts });

      // Step 3: Create deployment plan
      this.log("plan", "info", "Creating deployment plan");
      const plan = createPlan(deploySpec, repoFacts);
      
      const planErrors = validatePlan(plan, deploySpec, repoFacts);
      if (planErrors.length > 0) {
        throw new Error(`Plan validation failed: ${planErrors.join(", ")}`);
      }
      
      this.log("plan", "info", "Generated deployment plan", { plan });

      // Step 4: Generate Infrastructure as Code
      this.log("iac_generate", "info", "Generating Terraform configuration");
      const workdir = path.join(this.workRoot, this.runId);
      const iacConfig = await generateIaC(deploySpec, plan, workdir);
      this.log("iac_generate", "info", "Generated Terraform files", { 
        stacks: iacConfig.stacks,
        workdir: iacConfig.workdir
      });

      // For Flask apps, force standard container port 8080 and prefer /api/message as health check path
      try {
        if (plan.runtime === "apprunner" && (Array.isArray(repoFacts.apps) && repoFacts.apps[0]?.framework === "flask")) {
          const tfvarsPath = iacConfig.varsFile;
          const tfvars = JSON.parse(await fs.readFile(tfvarsPath, "utf-8"));
          const standardPort = 8080;
          tfvars.app_port = standardPort;
          tfvars.health_check_path = "/";
          // Ensure PORT is present and consistent
          if (!tfvars.env_vars) tfvars.env_vars = {};
          tfvars.env_vars.PORT = String(standardPort);
          await fs.writeFile(tfvarsPath, JSON.stringify(tfvars, null, 2));
          this.log("iac_generate", "info", "Adjusted Flask settings", { health_check_path: tfvars.health_check_path, app_port: tfvars.app_port });
        }
      } catch (e: any) {
        this.log("iac_generate", "warn", `Failed to adjust health_check_path: ${e.message}`);
      }

      // Step 5: Build application (if needed)
      let imageUri: string | undefined;
      let staticUrl: string | undefined;

      if (plan.runtime !== "s3_cloudfront") {
        const registryUrl = process.env.REGISTRY_URL;
        const useRealTerraform = process.env.USE_REAL_TERRAFORM === 'true';

        if (useRealTerraform && registryUrl) {
          // Perform a real build and push so App Runner can pull :latest
          try {
            this.log("build", "info", "Building and pushing container image");

            const app = (repoFacts.apps && repoFacts.apps.length > 0)
              ? repoFacts.apps[0]
              : undefined;

            const appPath = app?.path ? path.join(repoPath, app.path) : repoPath;

            // Image name used for local build before tagging to registry
            const localImageName = `${deploySpec.app_name}:${this.runId}`;

            const buildResult = await buildApplication(app || ({} as any), plan, {
              repoPath: appPath,
              imageName: localImageName,
              registryUrl
            });

            if (!buildResult.success) {
              throw new Error(`Image build/push failed: ${buildResult.error}`);
            }

            imageUri = buildResult.imageUri || `${registryUrl}:latest`;
            this.log("build", "info", "Image build and push completed", { imageUri });
          } catch (err: any) {
            this.log("build", "error", `Build step failed: ${err.message}`);
            throw err;
          }
        } else {
          // Simulation mode or missing registry URL
          this.log("build", "info", "Building application image (simulated)");
          if (registryUrl) {
            imageUri = `${registryUrl}:${this.runId}`;
            this.log("build", "info", "Image build completed (simulated)", { imageUri });
          } else {
            this.log("build", "warn", "No registry URL configured, skipping image build");
          }
        }
      }

      // Step 6: Deploy infrastructure
      this.log("deploy", "info", "Deploying infrastructure with Terraform");
      
      let serviceUrl: string | undefined;
      let tfOutputs: Record<string, any> = {};
      
      // Check if we should run real Terraform or simulate
      const useRealTerraform = process.env.USE_REAL_TERRAFORM === 'true';
      
      if (useRealTerraform) {
        // Ensure tfvars has correct image/ports and required ECS variables if applicable
        try {
          const tfvarsPath = iacConfig.varsFile;
          const tfvars = JSON.parse(await fs.readFile(tfvarsPath, "utf-8"));
          if (plan.runtime === "ecs_fargate") {
            if (imageUri) tfvars.image_uri = imageUri;
            // Respect detected app port if analyzer provided, else default to 8080
            const detectedPort = (repoFacts.apps && repoFacts.apps[0]?.ports && repoFacts.apps[0].ports[0]) || 8080;
            tfvars.app_port = detectedPort;
            tfvars.health_check_path = tfvars.health_check_path || "/";
            if (!tfvars.env_vars) tfvars.env_vars = {};
            tfvars.env_vars.PORT = String(detectedPort);
            tfvars.env_vars.AWS_DEFAULT_REGION = deploySpec.region;
            // If fargate defaults are missing, set based on perf hint
            if (!tfvars.fargate_cpu || !tfvars.fargate_memory) {
              if (deploySpec.hints.perf === "high") {
                tfvars.fargate_cpu = "1024";
                tfvars.fargate_memory = "2048";
              } else if (deploySpec.hints.perf === "standard") {
                tfvars.fargate_cpu = "512";
                tfvars.fargate_memory = "1024";
              } else {
                tfvars.fargate_cpu = "256";
                tfvars.fargate_memory = "512";
              }
            }
            if (typeof tfvars.desired_count !== "number") {
              tfvars.desired_count = 1;
            }
          } else if (plan.runtime === "apprunner") {
            if (imageUri) tfvars.image_uri = imageUri;
          }
          await fs.writeFile(tfvarsPath, JSON.stringify(tfvars, null, 2));
          this.log("deploy", "info", "Updated terraform.tfvars.json with runtime values");
        } catch (e: any) {
          this.log("deploy", "warn", `Failed to update tfvars prior to Terraform: ${e.message}`);
        }

        // Run actual Terraform deployment
        const tfResult = await runTerraform(iacConfig.workdir, iacConfig.varsFile, 
          (message: string) => this.log("terraform", "info", message));
        
        if (!tfResult.success) {
          throw new Error(`Terraform deployment failed: ${tfResult.error}`);
        }
        
        tfOutputs = tfResult.outputs || {};
        this.log("deploy", "info", "Infrastructure deployment completed", { 
          outputs: Object.keys(tfOutputs) 
        });
        
        // Extract service URL from Terraform outputs
        if (tfOutputs.service_url?.value) {
          serviceUrl = tfOutputs.service_url.value;
        } else if (tfOutputs.cdn_url?.value) {
          serviceUrl = tfOutputs.cdn_url.value;
        } else {
          this.log("deploy", "warn", "No service URL found in Terraform outputs");
        }
        
      } else {
        // Simulate deployment (MVP mode)
        this.log("deploy", "info", "Infrastructure deployment completed (simulated)");
        serviceUrl = plan.runtime === "s3_cloudfront" 
          ? `https://${deploySpec.app_name}-static.s3.amazonaws.com/index.html`
          : `https://${deploySpec.app_name}.amazonaws.com`;
      }

      const duration = Date.now() - startTime;
      this.log("pipeline", "info", "Deployment pipeline completed successfully", {
        serviceUrl,
        duration_ms: duration
      });

      return {
        success: true,
        runId: this.runId,
        serviceUrl,
        logs: this.logs
      };

    } catch (error: any) {
      const duration = Date.now() - startTime;
      this.log("pipeline", "error", `Deployment pipeline failed: ${error.message}`, {
        error: error.message,
        duration_ms: duration
      });

      return {
        success: false,
        runId: this.runId,
        error: error.message,
        logs: this.logs
      };
    }
  }

  private async cloneRepository(): Promise<string> {
    const repoPath = path.join(this.workRoot, this.runId, "repo");
    await fs.ensureDir(repoPath);

    const preferredBranch = this.request.branch || "main";
    // First attempt: preferred branch
    try {
      await execa("git", [
        "clone",
        "--depth", "1",
        "--branch", preferredBranch,
        this.request.repo,
        repoPath
      ]);
      this.log("clone", "info", "Repository cloned successfully", {
        path: repoPath,
        branch: preferredBranch
      });
      return repoPath;
    } catch (firstErr: any) {
      this.log("clone", "warn", `Clone with branch '${preferredBranch}' failed, detecting default branch...`);

      // Detect default branch via HEAD symref
      let defaultBranch = "master";
      try {
        const ls = await execa("git", [
          "ls-remote",
          "--symref",
          this.request.repo,
          "HEAD"
        ]);
        // Format: ref: refs/heads/<branch>\tHEAD
        const line = ls.stdout.split("\n").find(l => l.startsWith("ref: refs/heads/"));
        if (line) {
          const match = line.match(/ref: refs\/heads\/(\S+)\s+HEAD/);
          if (match && match[1]) defaultBranch = match[1];
        }
        this.log("clone", "info", "Detected default branch", { defaultBranch });
      } catch {
        this.log("clone", "warn", `Failed to detect default branch, falling back to '${defaultBranch}'`);
      }

      // Retry with detected default branch
      try {
        await execa("git", [
          "clone",
          "--depth", "1",
          "--branch", defaultBranch,
          this.request.repo,
          repoPath
        ]);
        this.log("clone", "info", "Repository cloned successfully", {
          path: repoPath,
          branch: defaultBranch
        });
        return repoPath;
      } catch (secondErr: any) {
        this.log("clone", "warn", `Clone with default branch '${defaultBranch}' failed, trying HEAD without branch...`);

        // Final fallback: clone default HEAD without specifying branch
        await execa("git", [
          "clone",
          "--depth", "1",
          this.request.repo,
          repoPath
        ]);
        this.log("clone", "info", "Repository cloned successfully (default HEAD)", { path: repoPath });
        return repoPath;
      }
    }
  }

  getLogs(): RunLog[] {
    return [...this.logs];
  }

  getRunId(): string {
    return this.runId;
  }
}

export async function deployApplication(request: DeploymentRequest, onLog?: (entry: RunLog) => void): Promise<PipelineResult> {
  const pipeline = new DeploymentPipeline(request, onLog);
  return await pipeline.execute();
}
