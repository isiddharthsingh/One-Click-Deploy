// Core data contracts as specified in CURSOR_BUILD_SPEC.md

export interface DeploySpec {
  app_name: string;
  env: string;
  cloud: string;
  region: string;
  hints: {
    cost: "low" | "standard" | "high";
    perf: "low" | "standard" | "high";
  };
  services: Array<{
    name: string;
    type: "http" | "worker" | "cron";
  }>;
  data: {
    db: string | null;
    cache: string | null;
  };
  domain: string | null;
}

export interface RepoApp {
  role: "web" | "api" | "worker" | "cron";
  language: string;
  framework: string;
  package_manager?: string;
  dockerfile: boolean;
  build_cmd: string | null;
  start_cmd: string | null;
  ports: number[];
  env_hints: string[];
  needs_db: boolean;
  path: string;
}

export interface RepoFacts {
  apps: RepoApp[];
  monorepo: boolean;
}

export interface Plan {
  runtime: "apprunner" | "ecs_fargate" | "s3_cloudfront" | "ec2";
  db: string | null;
  front: string | null;
  network: {
    https: boolean;
    host: string | null;
  };
}

export interface RunLog {
  time: string;
  run_id: string;
  step: string;
  level: "debug" | "info" | "warn" | "error";
  message: string;
  meta?: Record<string, any>;
}
