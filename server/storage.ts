import { type User, type InsertUser, type Pothole, type InsertPothole } from "../shared/schema";
import { db } from "./firebase";
import { randomUUID } from "crypto";

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

export class FirebaseStorage implements IStorage {
  private usersColl = db.collection("users");
  private potholesColl = db.collection("potholes");

  async getUser(id: string): Promise<User | undefined> {
    const doc = await this.usersColl.doc(id).get();
    return doc.exists ? (doc.data() as User) : undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const snapshot = await this.usersColl.where("username", "==", username).get();
    if (snapshot.empty) return undefined;
    return snapshot.docs[0].data() as User;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user = { ...insertUser, id };
    await this.usersColl.doc(id).set(user);
    return user as User;
  }

  async getPotholes(): Promise<Pothole[]> {
    const snapshot = await this.potholesColl.orderBy("reportedAt", "desc").get();
    return snapshot.docs.map(doc => doc.data() as Pothole);
  }

  async createPothole(insertPothole: InsertPothole): Promise<Pothole> {
    const id = randomUUID();
    const pothole: Pothole = {
      ...insertPothole,
      id,
      reportedAt: new Date().toISOString()
    };
    await this.potholesColl.doc(id).set(pothole);
    return pothole;
  }
}

export const storage = new FirebaseStorage();
