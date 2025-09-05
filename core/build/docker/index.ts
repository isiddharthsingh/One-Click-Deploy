import { execa } from "execa";
import fs from "fs-extra";
import path from "path";

export interface BuildResult {
  success: boolean;
  imageUri?: string;
  error?: string;
  logs: string[];
}

export class DockerBuilder {
  private logs: string[] = [];

  constructor(private repoPath: string, private imageName: string) {}

  private log(message: string): void {
    this.logs.push(`[${new Date().toISOString()}] ${message}`);
    console.log(message);
  }

  async build(): Promise<BuildResult> {
    try {
      // Check if Dockerfile exists
      const dockerfilePath = path.join(this.repoPath, "Dockerfile");
      const hasDockerfile = await fs.pathExists(dockerfilePath);

      if (!hasDockerfile) {
        return {
          success: false,
          error: "No Dockerfile found in repository",
          logs: this.logs
        };
      }

      this.log("Building Docker image...");
      this.log(`Image name: ${this.imageName}`);
      this.log(`Build context: ${this.repoPath}`);

      const result = await execa("docker", [
        "build",
        "--platform=linux/amd64",
        "-t",
        this.imageName,
        "."
      ], {
        cwd: this.repoPath,
        stdio: "pipe"
      });

      this.log(result.stdout);
      if (result.stderr) {
        this.log(`STDERR: ${result.stderr}`);
      }

      this.log("Docker build completed successfully");

      return {
        success: true,
        imageUri: this.imageName,
        logs: this.logs
      };
    } catch (error: any) {
      this.log(`Docker build failed: ${error.message}`);
      if (error.stdout) this.log(`STDOUT: ${error.stdout}`);
      if (error.stderr) this.log(`STDERR: ${error.stderr}`);

      return {
        success: false,
        error: error.message,
        logs: this.logs
      };
    }
  }

  async push(registryUrl: string, tag: string = "latest"): Promise<BuildResult> {
    try {
      const fullImageName = `${registryUrl}:${tag}`;
      
      // Authenticate with ECR if it's an ECR registry
      if (registryUrl.includes('.ecr.')) {
        await this.authenticateECR(registryUrl);
      }
      
      this.log(`Tagging image for registry: ${fullImageName}`);
      await execa("docker", ["tag", this.imageName, fullImageName], {
        stdio: "pipe"
      });

      this.log("Pushing image to registry...");
      const result = await execa("docker", ["push", fullImageName], {
        stdio: "pipe"
      });

      this.log(result.stdout);
      if (result.stderr) {
        this.log(`STDERR: ${result.stderr}`);
      }

      this.log("Docker push completed successfully");

      return {
        success: true,
        imageUri: fullImageName,
        logs: this.logs
      };
    } catch (error: any) {
      this.log(`Docker push failed: ${error.message}`);
      if (error.stdout) this.log(`STDOUT: ${error.stdout}`);
      if (error.stderr) this.log(`STDERR: ${error.stderr}`);

      return {
        success: false,
        error: error.message,
        logs: this.logs
      };
    }
  }

  private async authenticateECR(registryUrl: string): Promise<void> {
    try {
      this.log("Authenticating with ECR...");
      
      // Extract registry domain and region from ECR URL
      // registryUrl example: 123456789012.dkr.ecr.us-east-2.amazonaws.com/repo
      const [registryDomain] = registryUrl.split('/');
      const region = registryDomain.split('.')[3];
      
      // Get ECR login token
      const loginResult = await execa("aws", [
        "ecr", "get-login-password", 
        "--region", region
      ], { stdio: "pipe" });
      
      // Login to Docker registry
      await execa("docker", ["login", "--username", "AWS", "--password-stdin", registryDomain], {
        input: loginResult.stdout,
        stdio: "pipe"
      });
      
      this.log("ECR authentication successful");
    } catch (error: any) {
      this.log(`ECR authentication failed: ${error.message}`);
      throw error;
    }
  }

  getLogs(): string[] {
    return [...this.logs];
  }
}
