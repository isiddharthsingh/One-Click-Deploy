import { execa } from "execa";
import fs from "fs-extra";
import path from "path";
import { RepoApp } from "../../types";

export interface StaticBuildResult {
  success: boolean;
  buildPath?: string;
  error?: string;
  logs: string[];
}

export class StaticBuilder {
  private logs: string[] = [];

  constructor(private repoPath: string, private app: RepoApp) {}

  private log(message: string): void {
    this.logs.push(`[${new Date().toISOString()}] ${message}`);
    console.log(message);
  }

  async build(): Promise<StaticBuildResult> {
    try {
      this.log(`Building static site for ${this.app.framework}...`);
      this.log(`Build path: ${this.repoPath}`);

      // Install dependencies first
      const installSuccess = await this.installDependencies();
      if (!installSuccess) {
        return {
          success: false,
          error: "Failed to install dependencies",
          logs: this.logs
        };
      }

      // Run build command
      if (this.app.build_cmd) {
        await this.runBuildCommand();
      }

      // Determine build output directory
      const buildPath = this.getBuildOutputPath();
      const buildExists = await fs.pathExists(buildPath);

      if (!buildExists) {
        return {
          success: false,
          error: `Build output directory not found: ${buildPath}`,
          logs: this.logs
        };
      }

      this.log(`Static build completed successfully`);
      this.log(`Build output: ${buildPath}`);

      return {
        success: true,
        buildPath,
        logs: this.logs
      };
    } catch (error: any) {
      this.log(`Static build failed: ${error.message}`);
      
      return {
        success: false,
        error: error.message,
        logs: this.logs
      };
    }
  }

  private async installDependencies(): Promise<boolean> {
    try {
      if (this.app.language === "javascript") {
        this.log(`Installing dependencies with ${this.app.package_manager}...`);
        
        const installCmd = this.app.package_manager === "yarn" ? "yarn" : 
                          this.app.package_manager === "pnpm" ? "pnpm" : "npm";
        const installArgs = installCmd === "npm" ? ["ci"] : ["install"];

        const result = await execa(installCmd, installArgs, {
          cwd: this.repoPath,
          stdio: "pipe"
        });

        this.log(result.stdout);
        if (result.stderr) {
          this.log(`STDERR: ${result.stderr}`);
        }
      }

      return true;
    } catch (error: any) {
      this.log(`Dependency installation failed: ${error.message}`);
      if (error.stdout) this.log(`STDOUT: ${error.stdout}`);
      if (error.stderr) this.log(`STDERR: ${error.stderr}`);
      return false;
    }
  }

  private async runBuildCommand(): Promise<void> {
    if (!this.app.build_cmd) return;

    this.log(`Running build command: ${this.app.build_cmd}`);

    const [cmd, ...args] = this.app.build_cmd.split(" ");
    const result = await execa(cmd, args, {
      cwd: this.repoPath,
      stdio: "pipe"
    });

    this.log(result.stdout);
    if (result.stderr) {
      this.log(`STDERR: ${result.stderr}`);
    }
  }

  private getBuildOutputPath(): string {
    const basePath = this.repoPath;

    // Determine build output directory based on framework
    if (this.app.framework === "nextjs") {
      return path.join(basePath, ".next");
    } else if (this.app.framework === "react-vite") {
      return path.join(basePath, "dist");
    } else if (this.app.framework === "create-react-app") {
      return path.join(basePath, "build");
    } else if (this.app.framework === "static") {
      return basePath; // Static files are already in place
    } else {
      // Default to common build directories
      const possibleDirs = ["build", "dist", "public", "."];
      for (const dir of possibleDirs) {
        const fullPath = path.join(basePath, dir);
        if (fs.existsSync(fullPath)) {
          return fullPath;
        }
      }
      return path.join(basePath, "build");
    }
  }

  getLogs(): string[] {
    return [...this.logs];
  }
}

export async function uploadToS3(
  buildPath: string,
  bucketName: string,
  region: string = "us-east-2"
): Promise<{ success: boolean; error?: string; logs: string[] }> {
  const logs: string[] = [];
  
  try {
    logs.push(`Uploading static files to S3 bucket: ${bucketName}`);
    logs.push(`Source path: ${buildPath}`);

    // Use AWS CLI to sync files
    const result = await execa("aws", [
      "s3",
      "sync",
      buildPath,
      `s3://${bucketName}`,
      "--delete",
      "--region",
      region
    ], {
      stdio: "pipe"
    });

    logs.push(result.stdout);
    if (result.stderr) {
      logs.push(`STDERR: ${result.stderr}`);
    }

    logs.push("S3 upload completed successfully");

    return { success: true, logs };
  } catch (error: any) {
    logs.push(`S3 upload failed: ${error.message}`);
    if (error.stdout) logs.push(`STDOUT: ${error.stdout}`);
    if (error.stderr) logs.push(`STDERR: ${error.stderr}`);

    return { success: false, error: error.message, logs };
  }
}
