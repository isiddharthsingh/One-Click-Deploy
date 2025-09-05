import Fastify, { FastifyRequest, FastifyReply } from "fastify";
import { startRun, getRun, getRunLogs } from "./run";
import * as dotenv from "dotenv";

// Load environment variables from .env file
dotenv.config();

const app = Fastify({
  logger: true
});

// Health check endpoint
app.get("/health", async () => {
  return { status: "ok", timestamp: new Date().toISOString() };
});

// Main deployment endpoint
app.post("/deployments", async (req: FastifyRequest, reply: FastifyReply) => {
  const body = req.body as any;
  
  if (!body.description || !body.repo) {
    return reply.code(400).send({ 
      error: "Missing required fields: description and repo" 
    });
  }
  
  const run = await startRun(body);
  return reply.send({ id: run.id });
});

// Get deployment status
app.get("/deployments/:id", async (req: FastifyRequest, reply: FastifyReply) => {
  const { id } = req.params as { id: string };
  
  const run = getRun(id);
  if (!run) {
    return reply.code(404).send({ error: "Deployment not found" });
  }
  
  return reply.send({
    id: run.id,
    status: run.status,
    created_at: run.created_at,
    service_url: run.service_url,
    error: run.error
  });
});

// Get deployment logs
app.get("/deployments/:id/logs", async (req: FastifyRequest, reply: FastifyReply) => {
  const { id } = req.params as { id: string };
  const { step } = req.query as { step?: string };
  
  const run = getRun(id);
  if (!run) {
    return reply.code(404).send({ error: "Deployment not found" });
  }
  
  const logs = getRunLogs(id, step);
  return reply.send({ 
    id, 
    step: step || "all", 
    logs 
  });
});

// Redeploy
app.post("/deployments/:id/redeploy", async (req: FastifyRequest, reply: FastifyReply) => {
  const { id } = req.params as { id: string };
  // TODO: implement redeploy logic
  return reply.send({ 
    id, 
    status: "redeploying" 
  });
});

const start = async () => {
  try {
    await app.listen({ port: 3000, host: "0.0.0.0" });
    console.log("Server listening on http://0.0.0.0:3000");
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
