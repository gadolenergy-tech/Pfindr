"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, XCircle, PauseCircle, Search } from "lucide-react";
import { AdminShell } from "@/components/admin-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { adminApi, type AdminVendor } from "@/lib/queries";

const STATUS_FILTERS = ["ALL", "PENDING", "VERIFIED", "SUSPENDED", "REJECTED"] as const;

const STATUS_STYLES: Record<AdminVendor["status"], string> = {
  PENDING: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  VERIFIED: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  SUSPENDED: "bg-slate-500/10 text-slate-400 border-slate-500/20",
  REJECTED: "bg-rose-500/10 text-rose-400 border-rose-500/20",
};

function VendorsTable() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<string>(
    searchParams.get("status") ?? "ALL",
  );
  const [query, setQuery] = useState("");

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const params = new URLSearchParams();
  if (status !== "ALL") params.set("status", status);
  if (query.trim()) params.set("q", query.trim());
  const search = params.toString() ? `?${params.toString()}` : "";

  const { data: vendors, isLoading } = useQuery({
    queryKey: ["admin", "vendors", status, query],
    queryFn: () => adminApi.vendors(search),
  });

  const mutation = useMutation({
    mutationFn: ({
      id,
      nextStatus,
    }: {
      id: string;
      nextStatus: AdminVendor["status"];
    }) => adminApi.setVendorStatus(id, nextStatus),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["admin"] });
      toast({
        title: "Vendor updated",
        description: `Status set to ${variables.nextStatus.toLowerCase()}.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Could not update vendor",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <AdminShell
      title="Vendors"
      description="Verification queue and vendor directory"
    >
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1.5">
          {STATUS_FILTERS.map((filter) => (
            <Button
              key={filter}
              size="sm"
              variant={status === filter ? "default" : "outline"}
              onClick={() => setStatus(filter)}
              className={status === filter ? "" : "border-white/[0.08]"}
            >
              {filter.charAt(0) + filter.slice(1).toLowerCase()}
            </Button>
          ))}
        </div>
        <div className="relative ml-auto w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-600" />
          <Input
            placeholder="Search name or email"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9 bg-card border-white/[0.08]"
          />
        </div>
      </div>

      <Card className="bg-card border-white/[0.06]">
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="space-y-2">
              {[0, 1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : vendors && vendors.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Business</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vendors.map((vendor) => (
                  <TableRow key={vendor.id}>
                    <TableCell>
                      <div className="font-medium text-slate-200">
                        {vendor.businessName}
                      </div>
                      <div className="text-xs text-slate-500">
                        {vendor.contactEmail}
                      </div>
                    </TableCell>
                    <TableCell className="text-slate-400">
                      {vendor.category?.name ?? "—"}
                    </TableCell>
                    <TableCell className="text-slate-400">
                      {[vendor.city, vendor.state].filter(Boolean).join(", ") || "—"}
                    </TableCell>
                    <TableCell className="text-slate-400">
                      {vendor._count.inventoryItems}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={STATUS_STYLES[vendor.status]}
                      >
                        {vendor.status.toLowerCase()}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1.5">
                        {vendor.status !== "VERIFIED" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={mutation.isPending}
                            onClick={() =>
                              mutation.mutate({
                                id: vendor.id,
                                nextStatus: "VERIFIED",
                              })
                            }
                            className="text-emerald-400 hover:text-emerald-300"
                          >
                            <CheckCircle2 className="h-4 w-4" />
                          </Button>
                        )}
                        {vendor.status !== "SUSPENDED" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={mutation.isPending}
                            onClick={() =>
                              mutation.mutate({
                                id: vendor.id,
                                nextStatus: "SUSPENDED",
                              })
                            }
                            className="text-slate-400 hover:text-slate-200"
                          >
                            <PauseCircle className="h-4 w-4" />
                          </Button>
                        )}
                        {vendor.status !== "REJECTED" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={mutation.isPending}
                            onClick={() =>
                              mutation.mutate({
                                id: vendor.id,
                                nextStatus: "REJECTED",
                              })
                            }
                            className="text-rose-400 hover:text-rose-300"
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-slate-500 py-10 text-center">
              No vendors match this filter.
            </p>
          )}
        </CardContent>
      </Card>
    </AdminShell>
  );
}

export default function VendorsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <VendorsTable />
    </Suspense>
  );
}
