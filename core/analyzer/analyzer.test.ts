import { analyzeRepo } from "./index";
import path from "path";

describe("Repo Analyzer", () => {
  const examplesPath = path.join(__dirname, "../../examples");

  test("should detect Flask app", () => {
    const result = analyzeRepo(path.join(examplesPath, "flask-app"));
    
    expect(result.monorepo).toBe(false);
    expect(result.apps).toHaveLength(1);
    
    const app = result.apps[0];
    expect(app.language).toBe("python");
    expect(app.framework).toBe("flask");
    expect(app.needs_db).toBe(true); // SQLAlchemy detected
    expect(app.ports).toContain(5000);
  });

  test("should detect Express API", () => {
    const result = analyzeRepo(path.join(examplesPath, "express-api"));
    
    expect(result.monorepo).toBe(false);
    expect(result.apps).toHaveLength(1);
    
    const app = result.apps[0];
    expect(app.language).toBe("javascript");
    expect(app.framework).toBe("express");
    expect(app.role).toBe("api");
    expect(app.needs_db).toBe(true); // pg detected
  });

  test("should detect React app", () => {
    const result = analyzeRepo(path.join(examplesPath, "react-app"));
    
    expect(result.monorepo).toBe(false);
    expect(result.apps).toHaveLength(1);
    
    const app = result.apps[0];
    expect(app.language).toBe("javascript");
    expect(app.framework).toBe("create-react-app");
    expect(app.role).toBe("web");
    expect(app.build_cmd).toBe("react-scripts build");
    expect(app.start_cmd).toBeNull(); // Static build
  });
});
