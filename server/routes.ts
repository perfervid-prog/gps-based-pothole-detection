import type { Express } from "express";
import { createServer, type Server } from "node:http";
import { storage } from "./storage";
import { insertPotholeSchema } from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  // Pothole routes
  app.get("/api/potholes", async (_req, res) => {
    const potholes = await storage.getPotholes();
    res.json(potholes);
  });

  app.post("/api/potholes", async (req, res) => {
    const result = insertPotholeSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    const pothole = await storage.createPothole(result.data);
    res.json(pothole);
  });

  const httpServer = createServer(app);

  return httpServer;
}
