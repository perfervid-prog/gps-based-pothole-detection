import { users, potholes, type User, type InsertUser, type Pothole, type InsertPothole } from "../shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";

// modify the interface with any CRUD methods
// you might need

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Pothole methods
  getPotholes(): Promise<Pothole[]>;
  createPothole(pothole: InsertPothole): Promise<Pothole>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async getPotholes(): Promise<Pothole[]> {
    return await db.select().from(potholes);
  }

  async createPothole(insertPothole: InsertPothole): Promise<Pothole> {
    const [pothole] = await db.insert(potholes).values(insertPothole).returning();
    return pothole;
  }
}

export const storage = new DatabaseStorage();
