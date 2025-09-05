import { parseDescription } from "./index";

describe("Natural Language Parser", () => {
  test("should parse basic Flask app deployment", () => {
    const result = parseDescription("Deploy this Flask app on AWS");
    
    expect(result.cloud).toBe("aws");
    expect(result.services).toHaveLength(1);
    expect(result.services[0].type).toBe("http");
    expect(result.data.db).toBeNull();
  });

  test("should detect database requirement", () => {
    const result = parseDescription("Deploy my Django app with Postgres database on AWS");
    
    expect(result.data.db).toBe("postgres");
    expect(result.cloud).toBe("aws");
  });

  test("should parse cost hints", () => {
    const result = parseDescription("Deploy this cheap Flask app on AWS with minimal cost");
    
    expect(result.hints.cost).toBe("low");
  });

  test("should parse performance hints", () => {
    const result = parseDescription("Deploy this high performance API on AWS");
    
    expect(result.hints.perf).toBe("high");
  });

  test("should detect multiple services", () => {
    const result = parseDescription("Deploy React frontend and Express API with worker jobs");
    
    expect(result.services).toHaveLength(3);
    expect(result.services.map(s => s.type)).toContain("http");
    expect(result.services.map(s => s.type)).toContain("worker");
  });

  test("should parse custom app name", () => {
    const result = parseDescription("Deploy application called my-awesome-app on AWS");
    
    expect(result.app_name).toBe("my-awesome-app");
  });

  test("should detect different regions", () => {
    const result = parseDescription("Deploy this app in Oregon region");
    
    expect(result.region).toBe("us-west-2");
  });

  test("should detect domain requirements", () => {
    const result = parseDescription("Deploy app with domain myapp.example.com");
    
    expect(result.domain).toBe("myapp.example.com");
  });

  test("should detect cache requirements", () => {
    const result = parseDescription("Deploy API with Redis cache on AWS");
    
    expect(result.data.cache).toBe("redis");
  });

  test("should handle complex deployment description", () => {
    const result = parseDescription(
      "Deploy my React frontend and Flask API called ecommerce-platform with Postgres database and Redis cache on AWS us-west-2 with high performance"
    );
    
    expect(result.app_name).toBe("ecommerce-platform");
    expect(result.region).toBe("us-west-2");
    expect(result.hints.perf).toBe("high");
    expect(result.data.db).toBe("postgres");
    expect(result.data.cache).toBe("redis");
    expect(result.services).toHaveLength(2);
  });
});
