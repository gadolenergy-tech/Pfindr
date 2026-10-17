import { Router } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import categoriesRouter from "./categories";
import contactRouter from "./contact";
import vendorsRouter from "./vendors";
import adminRouter from "./admin";
import inventoryRouter from "./inventory";
import discoverRouter from "./discover";
import ordersRouter from "./orders";
import customersRouter from "./customers";
import conversationsRouter from "./conversations";
import analyticsRouter from "./analytics";
import apiKeysRouter from "./api-keys";
import publicV1Router from "./public-v1";
import affiliateRouter from "./affiliate";
import checkoutRouter from "./checkout";

const router = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use(categoriesRouter);
router.use(contactRouter);
router.use(vendorsRouter);
router.use("/admin", adminRouter);
router.use("/inventory", inventoryRouter);
router.use(discoverRouter);
router.use("/orders", ordersRouter);
router.use("/customers", customersRouter);
router.use("/conversations", conversationsRouter);
router.use("/analytics", analyticsRouter);
router.use("/api-keys", apiKeysRouter);
router.use("/v1", publicV1Router);
router.use("/affiliate", affiliateRouter);
router.use(checkoutRouter);

export default router;
