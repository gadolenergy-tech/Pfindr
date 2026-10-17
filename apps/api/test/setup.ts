import { testDatabaseUrl } from "./test-env";

// Runs before any test file imports src/env.ts, which reads these once.
process.env.NODE_ENV = "test";
process.env.DATABASE_URL = testDatabaseUrl();
process.env.JWT_ACCESS_SECRET = "test-access-secret";
process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
process.env.PAYSTACK_SECRET_KEY = "sk_test_unit";
process.env.RESEND_API_KEY = "";
process.env.LOG_LEVEL = "error";
process.env.WEB_URL = "http://localhost:3020";
process.env.CHECKOUT_HOLD_MINUTES = "30";
