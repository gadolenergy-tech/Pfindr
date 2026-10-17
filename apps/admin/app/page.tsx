"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Store,
  Users,
  Boxes,
  ShieldAlert,
  Mail,
  Handshake,
  ArrowRight,
} from "lucide-react";
import { AdminShell } from "@/components/admin-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

function Stat({
  label,
  value,
  icon: Icon,
  loading,
  accent,
  href,
}: {
  label: string;
  value: number | undefined;
  icon: typeof Store;
  loading: boolean;
  accent?: string;
  href: string;
}) {
  return (
    <Link href={href}>
      <Card className="bg-card border-white/[0.06] transition-colors hover:border-white/[0.15] hover:bg-white/[0.02] cursor-pointer">
        <CardContent className="pt-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                {label}
              </p>
              {loading ? (
                <Skeleton className="h-8 w-16 mt-2" />
              ) : (
                <p className={`text-3xl font-bold mt-1 ${accent ?? "text-white"}`}>
                  {value?.toLocaleString() ?? "—"}
                </p>
              )}
            </div>
            <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Icon className="h-5 w-5 text-blue-400" />
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export default function OverviewPage() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["admin", "stats"],
    queryFn: adminApi.stats,
  });

  const { data: topInventory, isLoading: inventoryLoading } = useQuery({
    queryKey: ["admin", "inventory", "top"],
    queryFn: adminApi.topInventory,
  });

  return (
    <AdminShell
      title="Overview"
      description="Live state of the Finder Network"
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Users" value={stats?.totalUsers} icon={Users} loading={isLoading} href="/users" />
        <Stat label="Vendors" value={stats?.totalVendors} icon={Store} loading={isLoading} href="/vendors" />
        <Stat
          label="Awaiting verification"
          value={stats?.pendingVendors}
          icon={ShieldAlert}
          loading={isLoading}
          accent="text-amber-400"
          href="/vendors?status=PENDING"
        />
        <Stat
          label="Inventory lines"
          value={stats?.inventoryItems}
          icon={Boxes}
          loading={isLoading}
          href="/inventory"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="bg-card border-white/[0.06]">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Queues</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between rounded-xl border border-white/[0.06] px-4 py-3">
              <div className="flex items-center gap-3">
                <ShieldAlert className="h-4 w-4 text-amber-400" />
                <span className="text-sm text-slate-300">Vendors to verify</span>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant="secondary">{stats?.pendingVendors ?? 0}</Badge>
                <Button asChild size="sm" variant="ghost">
                  <Link href="/vendors?status=PENDING">
                    Review <ArrowRight className="ml-1 h-3 w-3" />
                  </Link>
                </Button>
              </div>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-white/[0.06] px-4 py-3">
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-blue-400" />
                <span className="text-sm text-slate-300">Unhandled messages</span>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant="secondary">{stats?.openContact ?? 0}</Badge>
                <Button asChild size="sm" variant="ghost">
                  <Link href="/contact">
                    Open <ArrowRight className="ml-1 h-3 w-3" />
                  </Link>
                </Button>
              </div>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-white/[0.06] px-4 py-3">
              <div className="flex items-center gap-3">
                <Handshake className="h-4 w-4 text-emerald-400" />
                <span className="text-sm text-slate-300">New partner inquiries</span>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant="secondary">{stats?.openPartners ?? 0}</Badge>
                <Button asChild size="sm" variant="ghost">
                  <Link href="/partners">
                    Open <ArrowRight className="ml-1 h-3 w-3" />
                  </Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-white/[0.06]">
          <CardHeader>
            <CardTitle className="text-base">Deepest stock on the network</CardTitle>
          </CardHeader>
          <CardContent>
            {inventoryLoading ? (
              <div className="space-y-2">
                {[0, 1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : topInventory && topInventory.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topInventory.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium text-slate-200">
                        {row.name}
                      </TableCell>
                      <TableCell className="text-slate-500">
                        {row.vendor.businessName}
                      </TableCell>
                      <TableCell className="text-right text-slate-300">
                        {row.quantity.toLocaleString()} {row.unit}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-sm text-slate-500 py-6 text-center">
                No inventory on the network yet.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminShell>
  );
}
