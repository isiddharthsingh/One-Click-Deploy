import { execa } from "execa";
import fs from "fs-extra";
import path from "path";
import { RepoApp } from "../../types";

export interface BuildpackResult {
  success: boolean;
  imageUri?: string;
  error?: string;
  logs: string[];
}

export class BuildpackBuilder {
  private logs: string[] = [];

  constructor(
    private repoPath: string,
    private imageName: string,
    private app: RepoApp
  ) {}

  private log(message: string): void {
    this.logs.push(`[${new Date().toISOString()}] ${message}`);
    console.log(message);
  }

  async build(): Promise<BuildpackResult> {
    try {
      // Determine the appropriate builder
      const builder = this.selectBuilder();
      
      this.log(`Building with Cloud Native Buildpacks...`);
      this.log(`Builder: ${builder}`);
      this.log(`Image name: ${this.imageName}`);
      this.log(`Build context: ${this.repoPath}`);

      // Prepare build environment
      const env = await this.prepareBuildEnv();

      const args = [
        "build",
        this.imageName,
        "--builder",
        builder,
        "--path",
        this.repoPath
      ];

      // Add environment variables if any
      for (const [key, value] of Object.entries(env)) {
        args.push("--env", `${key}=${value}`);
      }

      const result = await execa("pack", args, {
        stdio: "pipe",
        env: { ...process.env, ...env, DOCKER_DEFAULT_PLATFORM: "linux/amd64" }
      });

      this.log(result.stdout);
      if (result.stderr) {
        this.log(`STDERR: ${result.stderr}`);
      }

      this.log("Buildpack build completed successfully");

      return {
        success: true,
        imageUri: this.imageName,
        logs: this.logs
      };
    } catch (error: any) {
      this.log(`Buildpack build failed: ${error.message}`);
      if (error.stdout) this.log(`STDOUT: ${error.stdout}`);
      if (error.stderr) this.log(`STDERR: ${error.stderr}`);

      return {
        success: false,
        error: error.message,
        logs: this.logs
      };
    }
  }

  private selectBuilder(): string {
    // Select builder based on language/framework
    if (this.app.language === "python") {
      return "paketobuildpacks/builder-jammy-base";
    } else if (this.app.language === "javascript") {
      return "paketobuildpacks/builder-jammy-base";
    } else if (this.app.language === "go") {
      return "paketobuildpacks/builder-jammy-base";
    } else if (this.app.language === "java") {
      return "paketobuildpacks/builder-jammy-base";
    } else {
      // Default builder
      return "paketobuildpacks/builder-jammy-base";
    }
  }

  private async prepareBuildEnv(): Promise<Record<string, string>> {
    const env: Record<string, string> = {};

    // Python-specific environment
    if (this.app.language === "python") {
      if (this.app.framework === "flask") {
        env.FLASK_APP = "app.py";
      } else if (this.app.framework === "django") {
        // Django settings will be auto-detected
      }
    }

    // Node.js-specific environment
    if (this.app.language === "javascript") {
      if (this.app.framework === "nextjs") {
        env.NODE_ENV = "production";
      }
    }

    // Set port if specified
    if (this.app.ports.length > 0) {
      env.PORT = this.app.ports[0].toString();
    }

    return env;
  }

  async push(registryUrl: string, tag: string = "latest"): Promise<BuildpackResult> {
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

      this.log("Image push completed successfully");

      return {
        success: true,
        imageUri: fullImageName,
        logs: this.logs
      };
    } catch (error: any) {
      this.log(`Image push failed: ${error.message}`);
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

export async function checkPackInstalled(): Promise<boolean> {
  try {
    await execa("pack", ["version"], { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}
