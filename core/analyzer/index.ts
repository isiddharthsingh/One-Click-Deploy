import fs from "fs";
import path from "path";
import { RepoFacts, RepoApp } from "../types";

export function analyzeRepo(repoPath: string): RepoFacts {
  const apps: RepoApp[] = [];
  const has = (filePath: string) => fs.existsSync(path.join(repoPath, filePath));
  
  // Detect monorepo structure (do NOT treat a lone "app" folder as a monorepo)
  const isMonorepo = has("frontend") || has("backend") || has("packages") || 
                     has("apps") || (has("client") && has("server"));
  
  if (isMonorepo) {
    // Analyze subdirectories for monorepo
    const dirs = ["frontend", "client", "web", "backend", "server", "api", "app"];
    for (const dir of dirs) {
      if (has(dir)) {
        const subApps = analyzeDirectory(path.join(repoPath, dir), dir);
        apps.push(...subApps);
      }
    }
    
    // Check packages directory
    if (has("packages")) {
      const packagesPath = path.join(repoPath, "packages");
      const packages = fs.readdirSync(packagesPath, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);
      
      for (const pkg of packages) {
        const subApps = analyzeDirectory(path.join(packagesPath, pkg), pkg);
        apps.push(...subApps);
      }
    }
  } else {
    // Single app repo; if an "app" subdir exists, analyze it, otherwise analyze root
    if (has("app")) {
      const subApps = analyzeDirectory(path.join(repoPath, "app"), "app");
      apps.push(...subApps);
    } else {
      const singleApps = analyzeDirectory(repoPath, ".");
      apps.push(...singleApps);
    }
  }
  
  const isMonorepoFinal = apps.length > 1;
  return { apps, monorepo: isMonorepoFinal };
}

function analyzeDirectory(dirPath: string, relativePath: string): RepoApp[] {
  const apps: RepoApp[] = [];
  const has = (filePath: string) => fs.existsSync(path.join(dirPath, filePath));
  const readFile = (filePath: string) => {
    try {
      return fs.readFileSync(path.join(dirPath, filePath), "utf8");
    } catch {
      return "";
    }
  };
  
  // Python detection
  const isPython = has("requirements.txt") || has("pyproject.toml") || has("setup.py");
  if (isPython) {
    const requirements = readFile("requirements.txt").toLowerCase();
    const pyproject = readFile("pyproject.toml").toLowerCase();
    const allPython = requirements + pyproject;
    
    if (allPython.includes("flask")) {
      apps.push({
        role: "web",
        language: "python",
        framework: "flask",
        package_manager: "pip",
        dockerfile: has("Dockerfile"),
        build_cmd: null,
        start_cmd: "gunicorn -b 0.0.0.0:$PORT app:app",
        ports: [5000],
        env_hints: ["PORT", "DATABASE_URL"],
        needs_db: allPython.includes("sqlalchemy") || allPython.includes("psycopg2") || allPython.includes("pymongo"),
        path: relativePath
      });
    } else if (allPython.includes("django")) {
      // Try to find Django project name
      let djangoProject = "mysite";
      if (has("manage.py")) {
        const manage = readFile("manage.py");
        const projectMatch = manage.match(/DJANGO_SETTINGS_MODULE['"]\s*,\s*['"]([^.'"]+)/);
        if (projectMatch) {
          djangoProject = projectMatch[1];
        }
      }
      
      apps.push({
        role: "web",
        language: "python",
        framework: "django",
        package_manager: "pip",
        dockerfile: has("Dockerfile"),
        build_cmd: null,
        start_cmd: `gunicorn -b 0.0.0.0:$PORT ${djangoProject}.wsgi:application`,
        ports: [8000],
        env_hints: ["PORT", "DATABASE_URL", "SECRET_KEY"],
        needs_db: true,
        path: relativePath
      });
    } else if (allPython.includes("fastapi")) {
      apps.push({
        role: "api",
        language: "python",
        framework: "fastapi",
        package_manager: "pip",
        dockerfile: has("Dockerfile"),
        build_cmd: null,
        start_cmd: "uvicorn main:app --host 0.0.0.0 --port $PORT",
        ports: [8000],
        env_hints: ["PORT"],
        needs_db: allPython.includes("sqlalchemy") || allPython.includes("tortoise"),
        path: relativePath
      });
    }
  }
  
  // Node.js detection
  const isNode = has("package.json");
  if (isNode) {
    const pkg = JSON.parse(readFile("package.json"));
    const pkgStr = JSON.stringify(pkg).toLowerCase();
    const packageManager = detectPackageManager(dirPath);
    
    if (pkgStr.includes("next") || has("next.config.js")) {
      apps.push({
        role: "web",
        language: "javascript",
        framework: "nextjs",
        package_manager: packageManager,
        dockerfile: has("Dockerfile"),
        build_cmd: "next build",
        start_cmd: "next start -p $PORT",
        ports: [3000],
        env_hints: ["NEXT_PUBLIC_API_URL", "PORT"],
        needs_db: false,
        path: relativePath
      });
    } else if (pkgStr.includes("react") && (pkgStr.includes("vite") || has("vite.config.js"))) {
      apps.push({
        role: "web",
        language: "javascript",
        framework: "react-vite",
        package_manager: packageManager,
        dockerfile: has("Dockerfile"),
        build_cmd: "vite build",
        start_cmd: null, // Static build
        ports: [],
        env_hints: ["VITE_API_URL"],
        needs_db: false,
        path: relativePath
      });
    } else if (pkgStr.includes("react") && (pkgStr.includes("react-scripts") || has("public/index.html"))) {
      apps.push({
        role: "web",
        language: "javascript",
        framework: "create-react-app",
        package_manager: packageManager,
        dockerfile: has("Dockerfile"),
        build_cmd: "react-scripts build",
        start_cmd: null, // Static build
        ports: [],
        env_hints: ["REACT_APP_API_URL"],
        needs_db: false,
        path: relativePath
      });
    } else if (pkgStr.includes("express")) {
      const startCmd = pkg.scripts?.start || "node server.js";
      apps.push({
        role: "api",
        language: "javascript",
        framework: "express",
        package_manager: packageManager,
        dockerfile: has("Dockerfile"),
        build_cmd: pkg.scripts?.build || null,
        start_cmd: startCmd,
        ports: [3000, 8080],
        env_hints: ["PORT", "DATABASE_URL"],
        needs_db: pkgStr.includes("mongoose") || pkgStr.includes("pg") || pkgStr.includes("mysql"),
        path: relativePath
      });
    } else if (pkgStr.includes("nestjs") || pkgStr.includes("@nestjs")) {
      apps.push({
        role: "api",
        language: "javascript",
        framework: "nestjs",
        package_manager: packageManager,
        dockerfile: has("Dockerfile"),
        build_cmd: pkg.scripts?.build || "nest build",
        start_cmd: pkg.scripts?.start || "node dist/main",
        ports: [3000],
        env_hints: ["PORT", "DATABASE_URL"],
        needs_db: false,
        path: relativePath
      });
    }
  }
  
  // Static site detection
  const isStatic = has("index.html") && !isNode && !isPython;
  if (isStatic) {
    apps.push({
      role: "web",
      language: "static",
      framework: "static",
      dockerfile: false,
      build_cmd: null,
      start_cmd: null,
      ports: [],
      env_hints: [],
      needs_db: false,
      path: relativePath
    });
  }
  
  return apps;
}

function detectPackageManager(dirPath: string): string {
  const has = (filePath: string) => fs.existsSync(path.join(dirPath, filePath));
  
  if (has("pnpm-lock.yaml")) return "pnpm";
  if (has("yarn.lock")) return "yarn";
  if (has("package-lock.json")) return "npm";
  return "npm";
}
