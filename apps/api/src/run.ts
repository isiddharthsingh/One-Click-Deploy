import { v4 as uuidv4 } from "uuid";
import { deployApplication } from "../../../core/orchestration/pipeline";
import { RunLog } from "../../../core/types";

export interface DeploymentRequest {
  description: string;
  repo: string;
  branch?: string;
  env_overrides?: Record<string, string>;
}

export interface RunInfo {
  id: string;
  status: "pending" | "running" | "success" | "failed";
  created_at: string;
  service_url?: string;
  error?: string;
  logs?: RunLog[];
}

// Temporary in-memory storage for MVP
const runs = new Map<string, RunInfo>();

export async function startRun(request: DeploymentRequest): Promise<RunInfo> {
  const run: RunInfo = {
    id: uuidv4(),
    status: "pending",
    created_at: new Date().toISOString(),
  };
  
  runs.set(run.id, run);
  
  // Start the deployment process asynchronously
  processDeployment(run.id, request).catch(console.error);
  
  return run;
}

async function processDeployment(runId: string, request: DeploymentRequest): Promise<void> {
  const run = runs.get(runId);
  if (!run) return;
  
  try {
    run.status = "running";
    run.logs = [];
    
    console.log(`Starting deployment ${runId} for repo: ${request.repo}`);
    
    // Execute the deployment pipeline with log streaming
    const result = await deployApplication(request, (entry: RunLog) => {
      const current = runs.get(runId);
      if (!current) return;
      if (!current.logs) current.logs = [];
      current.logs.push(entry);
    });
    
    if (result.success) {
      run.status = "success";
      run.service_url = result.serviceUrl;
      console.log(`Deployment ${runId} completed successfully: ${result.serviceUrl}`);
    } else {
      run.status = "failed";
      run.error = result.error;
      console.error(`Deployment ${runId} failed:`, result.error);
    }
    
    // Ensure final logs are captured
    run.logs = result.logs;
    
  } catch (error: any) {
    run.status = "failed";
    run.error = error.message;
    console.error(`Deployment ${runId} failed:`, error);
  }
}

export function getRun(id: string): RunInfo | undefined {
  return runs.get(id);
}

export function getRunLogs(id: string, step?: string): RunLog[] {
  const run = runs.get(id);
  if (!run || !run.logs) return [];
  
  if (step) {
    return run.logs.filter(log => log.step === step);
  }
  
  return run.logs;
}
