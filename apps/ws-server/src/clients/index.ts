import type { Client } from "../index.js";



export const clients = new Set<Client>();
export const sessionTimers = new Map<string, NodeJS.Timeout>();
