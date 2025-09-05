import { createPlan, validatePlan } from "./index";
import { DeploySpec, RepoFacts } from "../types";

describe("Planner", () => {
  test("should choose S3+CloudFront for static sites", () => {
    const deploySpec: DeploySpec = {
      app_name: "static-site",
      env: "prod",
      cloud: "aws",
      region: "us-east-2",
      hints: { cost: "standard", perf: "standard" },
      services: [{ name: "web", type: "http" }],
      data: { db: null, cache: null },
      domain: null
    };

    const repoFacts: RepoFacts = {
      apps: [{
        role: "web",
        language: "static",
        framework: "static",
        dockerfile: false,
        build_cmd: null,
        start_cmd: null,
        ports: [],
        env_hints: [],
        needs_db: false,
        path: "."
      }],
      monorepo: false
    };

    const plan = createPlan(deploySpec, repoFacts);
    expect(plan.runtime).toBe("s3_cloudfront");
    expect(plan.db).toBeNull();
  });

  test("should choose App Runner for simple HTTP service", () => {
    const deploySpec: DeploySpec = {
      app_name: "flask-app",
      env: "prod",
      cloud: "aws",
      region: "us-east-2",
      hints: { cost: "standard", perf: "standard" },
      services: [{ name: "api", type: "http" }],
      data: { db: null, cache: null },
      domain: null
    };

    const repoFacts: RepoFacts = {
      apps: [{
        role: "web",
        language: "python",
        framework: "flask",
        package_manager: "pip",
        dockerfile: false,
        build_cmd: null,
        start_cmd: "gunicorn -b 0.0.0.0:$PORT app:app",
        ports: [5000],
        env_hints: ["PORT"],
        needs_db: false,
        path: "."
      }],
      monorepo: false
    };

    const plan = createPlan(deploySpec, repoFacts);
    expect(plan.runtime).toBe("apprunner");
  });

  test("should choose ECS Fargate for complex apps", () => {
    const deploySpec: DeploySpec = {
      app_name: "complex-app",
      env: "prod",
      cloud: "aws",
      region: "us-east-2",
      hints: { cost: "standard", perf: "standard" },
      services: [
        { name: "web", type: "http" },
        { name: "api", type: "http" },
        { name: "worker", type: "worker" }
      ],
      data: { db: "postgres", cache: null },
      domain: null
    };

    const repoFacts: RepoFacts = {
      apps: [
        {
          role: "web",
          language: "javascript",
          framework: "react-vite",
          package_manager: "npm",
          dockerfile: false,
          build_cmd: "vite build",
          start_cmd: null,
          ports: [],
          env_hints: [],
          needs_db: false,
          path: "frontend"
        },
        {
          role: "api",
          language: "python",
          framework: "flask",
          package_manager: "pip",
          dockerfile: false,
          build_cmd: null,
          start_cmd: "gunicorn -b 0.0.0.0:$PORT app:app",
          ports: [5000],
          env_hints: ["PORT", "DATABASE_URL"],
          needs_db: true,
          path: "backend"
        }
      ],
      monorepo: true
    };

    const plan = createPlan(deploySpec, repoFacts);
    expect(plan.runtime).toBe("ecs_fargate");
    expect(plan.db).toBe("postgres");
    expect(plan.front).toBe("s3_cloudfront");
  });

  test("should validate plan correctly", () => {
    const deploySpec: DeploySpec = {
      app_name: "test-app",
      env: "prod",
      cloud: "aws",
      region: "us-east-2",
      hints: { cost: "standard", perf: "standard" },
      services: [{ name: "api", type: "http" }],
      data: { db: null, cache: null },
      domain: null
    };

    const repoFacts: RepoFacts = {
      apps: [{
        role: "api",
        language: "python",
        framework: "flask",
        package_manager: "pip",
        dockerfile: false,
        build_cmd: null,
        start_cmd: "gunicorn -b 0.0.0.0:$PORT app:app",
        ports: [5000],
        env_hints: ["PORT"],
        needs_db: false,
        path: "."
      }],
      monorepo: false
    };

    const validPlan = createPlan(deploySpec, repoFacts);
    const errors = validatePlan(validPlan, deploySpec, repoFacts);
    expect(errors).toHaveLength(0);

    // Test invalid plan
    const invalidPlan = { ...validPlan, runtime: "s3_cloudfront" as const };
    const invalidErrors = validatePlan(invalidPlan, deploySpec, repoFacts);
    expect(invalidErrors.length).toBeGreaterThan(0);
  });
});
