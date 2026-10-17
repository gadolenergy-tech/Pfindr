"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Handshake } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { PARTNER_STATUSES } from "@finder/shared";
import { AdminShell } from "@/components/admin-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { adminApi, type AdminPartner } from "@/lib/queries";

const STATUS_STYLES: Record<AdminPartner["status"], string> = {
  INQUIRY: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  IN_REVIEW: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  ACTIVE: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  DECLINED: "bg-rose-500/10 text-rose-400 border-rose-500/20",
};

export default function PartnersPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: partners, isLoading } = useQuery({
    queryKey: ["admin", "partners"],
    queryFn: adminApi.partners,
  });

  const mutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      adminApi.setPartnerStatus(id, status),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin"] });
      toast({ title: "Partner updated" });
    },
    onError: (error: Error) => {
      toast({
        title: "Could not update partner",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <AdminShell
      title="Partners"
      description="Inquiries from the partner programme"
    >
      {isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      ) : partners && partners.length > 0 ? (
        <div className="space-y-3">
          {partners.map((partner) => (
            <Card key={partner.id} className="bg-card border-white/[0.06]">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-slate-200">
                        {partner.companyName}
                      </h3>
                      <Badge
                        variant="outline"
                        className={STATUS_STYLES[partner.status]}
                      >
                        {partner.status.replace("_", " ").toLowerCase()}
                      </Badge>
                      <Badge variant="secondary">
                        {partner.partnershipType.toLowerCase()}
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      {partner.contactName} ·{" "}
                      <a
                        href={`mailto:${partner.contactEmail}`}
                        className="text-blue-400 hover:underline"
                      >
                        {partner.contactEmail}
                      </a>
                      {partner.website ? (
                        <>
                          {" "}
                          ·{" "}
                          <a
                            href={partner.website}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="text-blue-400 hover:underline"
                          >
                            website
                          </a>
                        </>
                      ) : null}{" "}
                      ·{" "}
                      {formatDistanceToNow(new Date(partner.createdAt), {
                        addSuffix: true,
                      })}
                    </p>
                    <p className="text-sm text-slate-400 mt-3 whitespace-pre-wrap">
                      {partner.message}
                    </p>
                  </div>
                  <div className="flex gap-1.5 shrink-0 flex-wrap">
                    {PARTNER_STATUSES.filter((s) => s !== partner.status).map(
                      (status) => (
                        <Button
                          key={status}
                          size="sm"
                          variant="outline"
                          disabled={mutation.isPending}
                          onClick={() =>
                            mutation.mutate({ id: partner.id, status })
                          }
                          className="border-white/[0.08] text-xs"
                        >
                          {status.replace("_", " ").toLowerCase()}
                        </Button>
                      ),
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="bg-card border-white/[0.06]">
          <CardContent className="py-16 text-center">
            <Handshake className="h-8 w-8 text-slate-700 mx-auto mb-3" />
            <p className="text-sm text-slate-500">No partner inquiries yet.</p>
          </CardContent>
        </Card>
      )}
    </AdminShell>
  );
}
