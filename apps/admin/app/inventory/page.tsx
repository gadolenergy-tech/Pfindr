"use client";

import { useQuery } from "@tanstack/react-query";
import { Boxes, Info } from "lucide-react";
import { AdminShell } from "@/components/admin-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { adminApi } from "@/lib/queries";

const STATUS_STYLES: Record<string, string> = {
  IN_STOCK: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  LOW_STOCK: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  OUT_OF_STOCK: "bg-rose-500/10 text-rose-400 border-rose-500/20",
  DISCONTINUED: "bg-slate-500/10 text-slate-400 border-slate-500/20",
};

const currency = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 0,
});

export default function InventoryPage() {
  const { data: rows, isLoading } = useQuery({
    queryKey: ["admin", "inventory", "top"],
    queryFn: adminApi.topInventory,
  });

  return (
    <AdminShell
      title="Inventory"
      description="Network-wide stock overview"
    >
      <Alert className="border-white/[0.08]">
        <Info className="h-4 w-4" />
        <AlertDescription>
          This view reads the ten deepest stock lines on the network. Full
          moderation — search, per-vendor drill-down and take-downs — lands with
          the inventory API in the next pass.
        </AlertDescription>
      </Alert>

      <Card className="bg-card border-white/[0.06]">
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="space-y-2">
              {[0, 1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : rows && rows.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium text-slate-200">
                      {row.name}
                    </TableCell>
                    <TableCell className="text-slate-400">
                      {row.vendor.businessName}
                    </TableCell>
                    <TableCell className="text-right text-slate-300">
                      {row.quantity.toLocaleString()} {row.unit}
                    </TableCell>
                    <TableCell className="text-right text-slate-300">
                      {currency.format(row.price)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={STATUS_STYLES[row.status] ?? ""}
                      >
                        {row.status.replace(/_/g, " ").toLowerCase()}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="py-16 text-center">
              <Boxes className="h-8 w-8 text-slate-700 mx-auto mb-3" />
              <p className="text-sm text-slate-500">
                No inventory on the network yet.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </AdminShell>
  );
}
