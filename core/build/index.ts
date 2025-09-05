import { RepoApp, Plan } from "../types";
import { DockerBuilder } from "./docker";
import { BuildpackBuilder, checkPackInstalled } from "./buildpacks";
import { StaticBuilder, uploadToS3 } from "./static";
import fs from "fs-extra";
import path from "path";

export interface BuildConfig {
  repoPath: string;
  imageName: string;
  registryUrl?: string;
  tag?: string;
  s3Bucket?: string;
  region?: string;
}

export interface BuildResult {
  success: boolean;
  imageUri?: string;
  staticUrl?: string;
  error?: string;
  logs: string[];
}

export async function buildApplication(
  app: RepoApp,
  plan: Plan,
  config: BuildConfig
): Promise<BuildResult> {
  const allLogs: string[] = [];
  
  try {
    // Handle static sites
    if (app.language === "static" || 
        (app.framework === "react-vite" || app.framework === "create-react-app") && 
        app.start_cmd === null) {
      
      const staticBuilder = new StaticBuilder(config.repoPath, app);
      const buildResult = await staticBuilder.build();
      allLogs.push(...buildResult.logs);

      if (!buildResult.success) {
        return {
          success: false,
          error: buildResult.error,
          logs: allLogs
        };
      }

      // Upload to S3 if bucket is configured
      if (config.s3Bucket && buildResult.buildPath) {
        const uploadResult = await uploadToS3(
          buildResult.buildPath,
          config.s3Bucket,
          config.region
        );
        allLogs.push(...uploadResult.logs);

        if (!uploadResult.success) {
          return {
            success: false,
            error: uploadResult.error,
            logs: allLogs
          };
        }
      }

      return {
        success: true,
        staticUrl: config.s3Bucket ? `https://${config.s3Bucket}.s3.amazonaws.com/index.html` : undefined,
        logs: allLogs
      };
    }

    // Handle container-based apps
    let imageUri: string | undefined;

    if (app.dockerfile) {
      // Use Docker if Dockerfile exists
      const dockerBuilder = new DockerBuilder(config.repoPath, config.imageName);
      const buildResult = await dockerBuilder.build();
      allLogs.push(...buildResult.logs);

      if (!buildResult.success) {
        return {
          success: false,
          error: buildResult.error,
          logs: allLogs
        };
      }

      // Push to registry if configured
      if (config.registryUrl) {
        const pushResult = await dockerBuilder.push(config.registryUrl, config.tag || "latest");
        allLogs.push(...pushResult.logs);

        if (!pushResult.success) {
          return {
            success: false,
            error: pushResult.error,
            logs: allLogs
          };
        }

        imageUri = pushResult.imageUri;
      } else {
        imageUri = buildResult.imageUri;
      }
    } else {
      // Prefer Buildpacks if available; otherwise, generate a Dockerfile for common stacks
      const packInstalled = await checkPackInstalled();
      if (packInstalled) {
        const buildpackBuilder = new BuildpackBuilder(config.repoPath, config.imageName, app);
        const buildResult = await buildpackBuilder.build();
        allLogs.push(...buildResult.logs);

        if (!buildResult.success) {
          return {
            success: false,
            error: buildResult.error,
            logs: allLogs
          };
        }

        // Push to registry if configured
        if (config.registryUrl) {
          const pushResult = await buildpackBuilder.push(config.registryUrl, config.tag || "latest");
          allLogs.push(...pushResult.logs);

          if (!pushResult.success) {
            return {
              success: false,
              error: pushResult.error,
              logs: allLogs
            };
          }

          imageUri = pushResult.imageUri;
        } else {
          imageUri = buildResult.imageUri;
        }
      } else {
        // Fallback: generate a minimal Dockerfile for supported frameworks (e.g., Flask)
        const created = await ensureDockerfileForApp(config.repoPath, app);
        if (!created) {
          return {
            success: false,
            error: "Cloud Native Buildpacks (pack CLI) is not installed and automatic Dockerfile generation is not supported for this app.",
            logs: allLogs
          };
        }

        const dockerBuilder = new DockerBuilder(config.repoPath, config.imageName);
        const buildResult = await dockerBuilder.build();
        allLogs.push(...buildResult.logs);

        if (!buildResult.success) {
          return {
            success: false,
            error: buildResult.error,
            logs: allLogs
          };
        }

        // Push to registry if configured
        if (config.registryUrl) {
          const pushResult = await dockerBuilder.push(config.registryUrl, config.tag || "latest");
          allLogs.push(...pushResult.logs);

          if (!pushResult.success) {
            return {
              success: false,
              error: pushResult.error,
              logs: allLogs
            };
          }

          imageUri = pushResult.imageUri;
        } else {
          imageUri = buildResult.imageUri;
        }
      }
    }

    return {
      success: true,
      imageUri,
      logs: allLogs
    };
  } catch (error: any) {
    allLogs.push(`Build failed: ${error.message}`);
    return {
      success: false,
      error: error.message,
      logs: allLogs
    };
  }
}

async function ensureDockerfileForApp(repoPath: string, app: RepoApp): Promise<boolean> {
  const dockerfilePath = path.join(repoPath, "Dockerfile");
  const exists = await fs.pathExists(dockerfilePath);
  if (exists) return true;

  // Support Python Flask minimal container
  if (app.language === "python" && app.framework === "flask") {
    const dockerfile = [
      "FROM python:3.11-slim",
      "WORKDIR /app",
      "ENV PYTHONDONTWRITEBYTECODE=1",
      "ENV PYTHONUNBUFFERED=1",
      "COPY . /app",
      "RUN pip install --no-cache-dir --upgrade pip && \\",
      "    if [ -f requirements.txt ]; then pip install --no-cache-dir -r requirements.txt; fi && \\",
      "    pip install --no-cache-dir gunicorn",
      // Ensure a basic template exists so '/' route doesn't 500
      "RUN mkdir -p templates && \\",
      "    if [ ! -f templates/index.html ]; then echo '<!doctype html><html><head><meta charset=\"utf-8\"></head><body><h1>Hello from Flask</h1><p>/api/message returns JSON.</p></body></html>' > templates/index.html; fi",
      "ENV PORT=8080",
      "EXPOSE 8080",
      "CMD [\"sh\", \"-c\", \"gunicorn --timeout 120 --keep-alive 2 -b 0.0.0.0:${PORT} app:app\"]"
    ].join("\n");
    await fs.writeFile(dockerfilePath, dockerfile);
    return true;
  }

  // Extend here for other stacks if needed
  return false;
}
