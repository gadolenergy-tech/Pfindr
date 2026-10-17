import { Router } from "express";
import { prisma } from "../lib/prisma";
import { ok } from "../lib/respond";
import { notFound } from "../lib/errors";

const router = Router();

/** Powers the landing-page category tiles and every category picker. */
router.get("/categories", async (_req, res) => {
  const categories = await prisma.category.findMany({
    where: { parentId: null },
    orderBy: { sortOrder: "asc" },
    include: {
      children: { orderBy: { sortOrder: "asc" } },
      _count: { select: { vendors: true, inventoryItems: true } },
    },
  });

  return ok(
    res,
    categories.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      description: c.description,
      icon: c.icon,
      sortOrder: c.sortOrder,
      vendorCount: c._count.vendors,
      itemCount: c._count.inventoryItems,
      children: c.children.map((child) => ({
        id: child.id,
        name: child.name,
        slug: child.slug,
        icon: child.icon,
      })),
    })),
  );
});

router.get("/categories/:slug", async (req, res) => {
  const category = await prisma.category.findUnique({
    where: { slug: req.params.slug },
    include: { children: { orderBy: { sortOrder: "asc" } } },
  });
  if (!category) throw notFound("No such category");
  return ok(res, category);
});

export default router;
