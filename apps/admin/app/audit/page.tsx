"use client";

import { useQuery } from "@tanstack/react-query";
import { ScrollText } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { AdminShell } from "@/components/admin-shell";
import { Card, CardContent } from "@/components/ui/card";
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

export default function AuditPage() {
  const { data: logs, isLoading } = useQuery({
    queryKey: ["admin", "audit"],
    queryFn: adminApi.auditLogs,
  });

  return (
    <AdminShell
      title="Audit log"
      description="Every state change an operator has made"
    >
      <Card className="bg-card border-white/[0.06]">
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="space-y-2">
              {[0, 1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : logs && logs.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Action</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>Operator</TableHead>
                  <TableHead>Details</TableHead>
                  <TableHead className="text-right">When</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      <Badge variant="secondary" className="font-mono text-[11px]">
                        {log.action}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-slate-400">
                      {log.entityType}
                      {log.entityId ? (
                        <span className="text-slate-600 text-xs ml-1">
                          #{log.entityId.slice(-6)}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-slate-400">
                      {log.actor?.fullName ?? "system"}
                    </TableCell>
                    <TableCell className="text-slate-500 text-xs font-mono">
                      {log.metadata ? JSON.stringify(log.metadata) : "—"}
                    </TableCell>
                    <TableCell className="text-right text-slate-500 text-sm">
                      {formatDistanceToNow(new Date(log.createdAt), {
                        addSuffix: true,
                      })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="py-16 text-center">
              <ScrollText className="h-8 w-8 text-slate-700 mx-auto mb-3" />
              <p className="text-sm text-slate-500">Nothing logged yet.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </AdminShell>
  );
}
