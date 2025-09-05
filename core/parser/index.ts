import { DeploySpec } from "../types";

// Rule-based natural language parser
// Maps common phrases to deployment specifications
export function parseDescription(description: string): DeploySpec {
  const text = description.toLowerCase();
  
  // Extract app name (default to "autoapp")
  const appNameMatch = text.match(/(?:app|application|service)\s+(?:called|named)\s+([a-zA-Z0-9-_]+)/);
  const appName = appNameMatch ? appNameMatch[1] : "autoapp";
  
  // Extract cloud provider (default to AWS)
  let cloud = "aws";
  if (text.includes("azure") || text.includes("microsoft")) {
    cloud = "azure";
  } else if (text.includes("gcp") || text.includes("google")) {
    cloud = "gcp";
  }
  
  // Extract region
  let region = "us-east-2"; // default
  const regionPatterns = [
    /us-east-2|ohio/,
    /us-west-2|oregon/,
    /eu-west-1|ireland/,
    /ap-southeast-1|singapore/
  ];
  
  const regions = ["us-east-2", "us-west-2", "eu-west-1", "ap-southeast-1"];
  for (let i = 0; i < regionPatterns.length; i++) {
    if (regionPatterns[i].test(text)) {
      region = regions[i];
      break;
    }
  }
  
  // Extract cost hints
  let cost: "low" | "standard" | "high" = "standard";
  if (text.includes("cheap") || text.includes("minimal") || text.includes("low cost")) {
    cost = "low";
  } else if (text.includes("expensive") || text.includes("high performance") || text.includes("premium")) {
    cost = "high";
  }
  
  // Extract performance hints
  let perf: "low" | "standard" | "high" = "standard";
  if (text.includes("fast") || text.includes("high performance") || text.includes("optimized")) {
    perf = "high";
  } else if (text.includes("minimal") || text.includes("basic")) {
    perf = "low";
  }
  
  // Detect service types
  const services = [];
  if (text.includes("web") || text.includes("frontend") || text.includes("ui") || 
      text.includes("react") || text.includes("vue") || text.includes("angular") ||
      text.includes("static")) {
    services.push({ name: "web", type: "http" as const });
  }
  
  if (text.includes("api") || text.includes("backend") || text.includes("server") ||
      text.includes("flask") || text.includes("django") || text.includes("express") ||
      text.includes("fastapi") || text.includes("node")) {
    services.push({ name: "api", type: "http" as const });
  }
  
  if (text.includes("worker") || text.includes("background") || text.includes("job")) {
    services.push({ name: "worker", type: "worker" as const });
  }
  
  if (text.includes("cron") || text.includes("scheduled") || text.includes("periodic")) {
    services.push({ name: "scheduler", type: "cron" as const });
  }
  
  // Default to web service if none detected
  if (services.length === 0) {
    services.push({ name: "web", type: "http" as const });
  }
  
  // Detect database needs
  let db: string | null = null;
  if (text.includes("database") || text.includes("db") || 
      text.includes("postgres") || text.includes("postgresql") ||
      text.includes("mysql") || text.includes("mongo")) {
    
    if (text.includes("mysql")) {
      db = "mysql";
    } else if (text.includes("mongo")) {
      db = "mongodb";
    } else {
      db = "postgres"; // default
    }
  }
  
  // Detect cache needs
  let cache: string | null = null;
  if (text.includes("redis") || text.includes("cache") || text.includes("memcache")) {
    cache = "redis";
  }
  
  // Detect domain
  const domainMatch = text.match(/(?:domain|host|url)\s+([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
  const domain = domainMatch ? domainMatch[1] : null;
  
  return {
    app_name: appName,
    env: "prod",
    cloud,
    region,
    hints: { cost, perf },
    services,
    data: { db, cache },
    domain
  };
}
