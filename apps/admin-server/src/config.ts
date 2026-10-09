// Reads and checks the environment once at startup. A missing or weak
// secret stops the server instead of silently falling back to a default:
// this service can read every user's data.

function required(name: string) {
    const value = process.env[name]?.trim();
    if (!value) throw new Error(`${name} is not set. See apps/admin-server/.env.example`);
    return value;
}

const jwtSecret = required("ADMIN_JWT_SECRET");
if (jwtSecret.length < 32) throw new Error("ADMIN_JWT_SECRET must be at least 32 characters");
if (jwtSecret === process.env.JWT_SECRET) throw new Error("ADMIN_JWT_SECRET must differ from JWT_SECRET");

const password = required("ADMIN_PASSWORD");
if (password.length < 12) throw new Error("ADMIN_PASSWORD must be at least 12 characters");

required("DATABASE_URL");

export const config = {
    port: Number(process.env.PORT) || 5000,
    adminEmail: required("ADMIN_EMAIL").toLowerCase(),
    adminPassword: password,
    jwtSecret,
    tokenTtlSeconds: 12 * 60 * 60,
    origins: required("ADMIN_ORIGIN")
        .split(",")
        .map((o) => o.trim())
        .filter(Boolean),
    staleSessionHours: Number(process.env.STALE_SESSION_HOURS) || 3,
};
