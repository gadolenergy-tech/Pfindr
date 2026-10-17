"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, ShieldOff, ShieldCheck } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
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
import { adminApi } from "@/lib/queries";

const ROLE_FILTERS = ["ALL", "USER", "VENDOR", "ADMIN"] as const;

export default function UsersPage() {
  const [role, setRole] = useState<string>("ALL");
  const [query, setQuery] = useState("");

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const params = new URLSearchParams();
  if (role !== "ALL") params.set("role", role);
  if (query.trim()) params.set("q", query.trim());
  const search = params.toString() ? `?${params.toString()}` : "";

  const { data: users, isLoading } = useQuery({
    queryKey: ["admin", "users", role, query],
    queryFn: () => adminApi.users(search),
  });

  const mutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "ACTIVE" | "SUSPENDED" }) =>
      adminApi.setUserStatus(id, status),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["admin"] });
      toast({
        title: "Account updated",
        description:
          variables.status === "SUSPENDED"
            ? "The account is suspended and every active session was revoked."
            : "The account is active again.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Could not update account",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <AdminShell title="Users" description="Every account on the network">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1.5">
          {ROLE_FILTERS.map((filter) => (
            <Button
              key={filter}
              size="sm"
              variant={role === filter ? "default" : "outline"}
              onClick={() => setRole(filter)}
              className={role === filter ? "" : "border-white/[0.08]"}
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
          ) : users && users.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Verified</TableHead>
                  <TableHead>Last seen</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="font-medium text-slate-200">
                        {user.fullName}
                      </div>
                      <div className="text-xs text-slate-500">{user.email}</div>
                    </TableCell>
                    <TableCell className="text-slate-400">{user.role}</TableCell>
                    <TableCell>
                      {user.emailVerified ? (
                        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                          verified
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-slate-500/10 text-slate-400 border-slate-500/20">
                          pending
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-slate-500 text-sm">
                      {user.lastLoginAt
                        ? formatDistanceToNow(new Date(user.lastLoginAt), {
                            addSuffix: true,
                          })
                        : "never"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          user.status === "ACTIVE"
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                            : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                        }
                      >
                        {user.status.toLowerCase()}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {user.status === "ACTIVE" ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={mutation.isPending || user.role === "ADMIN"}
                          title={
                            user.role === "ADMIN"
                              ? "Admin accounts cannot be suspended from here"
                              : "Suspend account"
                          }
                          onClick={() =>
                            mutation.mutate({ id: user.id, status: "SUSPENDED" })
                          }
                          className="text-rose-400 hover:text-rose-300"
                        >
                          <ShieldOff className="h-4 w-4" />
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={mutation.isPending}
                          onClick={() =>
                            mutation.mutate({ id: user.id, status: "ACTIVE" })
                          }
                          className="text-emerald-400 hover:text-emerald-300"
                        >
                          <ShieldCheck className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-slate-500 py-10 text-center">
              No accounts match this filter.
            </p>
          )}
        </CardContent>
      </Card>
    </AdminShell>
  );
}
