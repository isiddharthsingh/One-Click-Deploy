import { execa } from "execa";
import fs from "fs-extra";
import path from "path";

export interface TerraformResult {
  success: boolean;
  outputs?: Record<string, any>;
  error?: string;
  logs: string[];
}

export class TerraformRunner {
  private logs: string[] = [];

  constructor(private workdir: string) {}

  private log(message: string): void {
    this.logs.push(`[${new Date().toISOString()}] ${message}`);
    console.log(message);
  }

  async init(): Promise<boolean> {
    try {
      this.log("Running terraform init...");
      const result = await execa("terraform", ["init", "-input=false"], {
        cwd: this.workdir,
        stdio: "pipe"
      });

      this.log(result.stdout);
      if (result.stderr) {
        this.log(`STDERR: ${result.stderr}`);
      }

      this.log("Terraform init completed successfully");
      return true;
    } catch (error: any) {
      this.log(`Terraform init failed: ${error.message}`);
      if (error.stdout) this.log(`STDOUT: ${error.stdout}`);
      if (error.stderr) this.log(`STDERR: ${error.stderr}`);
      return false;
    }
  }

  async plan(varsFile: string): Promise<boolean> {
    try {
      this.log("Running terraform plan...");
      const result = await execa("terraform", [
        "plan",
        "-input=false",
        "-var-file",
        varsFile,
        "-out=tfplan"
      ], {
        cwd: this.workdir,
        stdio: "pipe"
      });

      this.log(result.stdout);
      if (result.stderr) {
        this.log(`STDERR: ${result.stderr}`);
      }

      this.log("Terraform plan completed successfully");
      return true;
    } catch (error: any) {
      this.log(`Terraform plan failed: ${error.message}`);
      if (error.stdout) this.log(`STDOUT: ${error.stdout}`);
      if (error.stderr) this.log(`STDERR: ${error.stderr}`);
      return false;
    }
  }

  async apply(varsFile: string): Promise<TerraformResult> {
    try {
      this.log("Running terraform apply...");
      
      // First run plan if not already done
      const planExists = await fs.pathExists(path.join(this.workdir, "tfplan"));
      if (!planExists) {
        const planSuccess = await this.plan(varsFile);
        if (!planSuccess) {
          return {
            success: false,
            error: "Plan failed",
            logs: this.logs
          };
        }
      }

      const result = await execa("terraform", [
        "apply",
        "-auto-approve",
        "-input=false",
        "tfplan"
      ], {
        cwd: this.workdir,
        stdio: "pipe"
      });

      this.log(result.stdout);
      if (result.stderr) {
        this.log(`STDERR: ${result.stderr}`);
      }

      this.log("Terraform apply completed successfully");

      // Get outputs
      const outputs = await this.getOutputs();

      return {
        success: true,
        outputs,
        logs: this.logs
      };
    } catch (error: any) {
      this.log(`Terraform apply failed: ${error.message}`);
      if (error.stdout) this.log(`STDOUT: ${error.stdout}`);
      if (error.stderr) this.log(`STDERR: ${error.stderr}`);

      return {
        success: false,
        error: error.message,
        logs: this.logs
      };
    }
  }

  async getOutputs(): Promise<Record<string, any>> {
    try {
      const result = await execa("terraform", ["output", "-json"], {
        cwd: this.workdir,
        stdio: "pipe"
      });

      return JSON.parse(result.stdout);
    } catch (error: any) {
      this.log(`Failed to get terraform outputs: ${error.message}`);
      return {};
    }
  }

  async destroy(varsFile: string): Promise<TerraformResult> {
    try {
      this.log("Running terraform destroy...");
      const result = await execa("terraform", [
        "destroy",
        "-auto-approve",
        "-input=false",
        "-var-file",
        varsFile
      ], {
        cwd: this.workdir,
        stdio: "pipe"
      });

      this.log(result.stdout);
      if (result.stderr) {
        this.log(`STDERR: ${result.stderr}`);
      }

      this.log("Terraform destroy completed successfully");

      return {
        success: true,
        logs: this.logs
      };
    } catch (error: any) {
      this.log(`Terraform destroy failed: ${error.message}`);
      if (error.stdout) this.log(`STDOUT: ${error.stdout}`);
      if (error.stderr) this.log(`STDERR: ${error.stderr}`);

      return {
        success: false,
        error: error.message,
        logs: this.logs
      };
    }
  }

  getLogs(): string[] {
    return [...this.logs];
  }
}

export async function runTerraform(
  workdir: string,
  varsFile: string,
  logCallback?: (message: string) => void
): Promise<TerraformResult> {
  const runner = new TerraformRunner(workdir);

  // Set up log streaming if callback provided
  if (logCallback) {
    const originalLog = runner['log'].bind(runner);
    runner['log'] = (message: string) => {
      originalLog(message);
      logCallback(message);
    };
  }

  // Run the terraform workflow
  const initSuccess = await runner.init();
  if (!initSuccess) {
    return {
      success: false,
      error: "Terraform init failed",
      logs: runner.getLogs()
    };
  }

  return await runner.apply(varsFile);
}
