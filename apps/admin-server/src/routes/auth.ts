import { Router } from "express";
import { createHash, timingSafeEqual } from "crypto";
import jwt from "jsonwebtoken";
import { config } from "../config";
import { requireAdmin } from "../middleware/auth";

const router: Router = Router();

// Brute-force guard: a handful of failed attempts per IP, then a cool-off.
const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 5;
const failures = new Map<string, { count: number; resetAt: number }>();

// Forget expired lockouts, so failed attempts from many IPs can't grow the
// map for as long as the process lives.
setInterval(() => {
    const now = Date.now();
    for (const [ip, entry] of failures) if (entry.resetAt <= now) failures.delete(ip);
}, WINDOW_MS).unref();

function sameSecret(a: string, b: string) {
    // Hashing first gives equal-length buffers, so the comparison takes the
    // same time whatever the input length.
    const ha = createHash("sha256").update(a).digest();
    const hb = createHash("sha256").update(b).digest();
    return timingSafeEqual(ha, hb);
}

router.post("/login", (req, res) => {
    const ip = req.ip || "unknown";
    const now = Date.now();
    const entry = failures.get(ip);
    if (entry && entry.resetAt > now && entry.count >= MAX_FAILURES) {
        const minutes = Math.ceil((entry.resetAt - now) / 60000);
        return res.status(429).json({ error: `Too many attempts. Try again in ${minutes} min.` });
    }

    const email = String(req.body?.email ?? "").trim().toLowerCase();
    const password = String(req.body?.password ?? "");

    const ok = sameSecret(email, config.adminEmail) && sameSecret(password, config.adminPassword);
    if (!ok) {
        const fresh = !entry || entry.resetAt <= now;
        failures.set(ip, { count: fresh ? 1 : entry.count + 1, resetAt: fresh ? now + WINDOW_MS : entry.resetAt });
        return res.status(401).json({ error: "Invalid credentials" });
    }

    failures.delete(ip);
    const token = jwt.sign({ role: "SUPER_ADMIN", email }, config.jwtSecret, {
        audience: "rexial-admin",
        expiresIn: config.tokenTtlSeconds,
    });
    return res.json({ token, email });
});

router.get("/me", requireAdmin, (_req, res) => {
    res.json({ email: config.adminEmail });
});

export default router;
