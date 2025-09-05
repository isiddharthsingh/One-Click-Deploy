import { DeploySpec, RepoFacts, Plan, RepoApp } from "../types";

export function createPlan(deploySpec: DeploySpec, repoFacts: RepoFacts): Plan {
  // Default plan
  let plan: Plan = {
    runtime: "apprunner",
    db: null,
    front: null,
    network: {
      https: true,
      host: null
    }
  };

  // Determine database needs
  const needsDb = repoFacts.apps.some(app => app.needs_db) || deploySpec.data.db;
  if (needsDb) {
    plan.db = deploySpec.data.db || "postgres";
  }

  // Analyze apps to determine runtime strategy
  const staticApps = repoFacts.apps.filter(app => 
    app.language === "static" || 
    (app.framework === "react-vite" || app.framework === "create-react-app") && 
    app.start_cmd === null
  );
  
  const httpApps = repoFacts.apps.filter(app => 
    app.role === "web" || app.role === "api"
  ).filter(app => !staticApps.includes(app));
  
  const workerApps = repoFacts.apps.filter(app => 
    app.role === "worker" || app.role === "cron"
  );

  // Decision logic based on complexity
  if (staticApps.length > 0 && httpApps.length === 0 && workerApps.length === 0) {
    // Pure static site
    plan.runtime = "s3_cloudfront";
  } else if (httpApps.length === 1 && workerApps.length === 0 && !repoFacts.monorepo) {
    // Simple single HTTP service
    plan.runtime = "apprunner";
  } else if (httpApps.length > 0 || workerApps.length > 0 || repoFacts.monorepo) {
    // Complex app with multiple services or workers
    plan.runtime = "ecs_fargate";
  }

  // Handle monorepo routing
  if (repoFacts.monorepo && staticApps.length > 0) {
    plan.front = "s3_cloudfront";
    
    // If we have both frontend and backend, use ALB for routing
    if (httpApps.length > 0) {
      plan.runtime = "ecs_fargate"; // Need ALB routing
    }
  }

  // Performance and cost adjustments
  if (deploySpec.hints.cost === "low") {
    // Prefer simpler, cheaper options
    if (plan.runtime === "ecs_fargate" && httpApps.length === 1 && workerApps.length === 0) {
      plan.runtime = "apprunner";
    }
  }

  if (deploySpec.hints.perf === "high") {
    // Prefer more robust options
    if (plan.runtime === "apprunner" && (needsDb || deploySpec.hints.perf === "high")) {
      plan.runtime = "ecs_fargate";
    }
  }

  // Set domain if specified
  if (deploySpec.domain) {
    plan.network.host = deploySpec.domain;
  }

  return plan;
}

export function validatePlan(plan: Plan, deploySpec: DeploySpec, repoFacts: RepoFacts): string[] {
  const errors: string[] = [];

  // Validate runtime choice
  const staticApps = repoFacts.apps.filter(app => 
    app.language === "static" || 
    (app.framework === "react-vite" || app.framework === "create-react-app") && 
    app.start_cmd === null
  );
  
  const httpApps = repoFacts.apps.filter(app => 
    app.role === "web" || app.role === "api"
  ).filter(app => !staticApps.includes(app));

  if (plan.runtime === "s3_cloudfront" && httpApps.length > 0) {
    errors.push("Cannot use S3+CloudFront runtime with HTTP services");
  }

  if (plan.runtime === "apprunner" && httpApps.length > 1) {
    errors.push("App Runner cannot handle multiple HTTP services");
  }

  // Validate database
  if (plan.db && !repoFacts.apps.some(app => app.needs_db) && !deploySpec.data.db) {
    errors.push("Database specified but no apps require database");
  }

  return errors;
}
