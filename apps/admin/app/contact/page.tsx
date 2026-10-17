"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Mail } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { AdminShell } from "@/components/admin-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { adminApi } from "@/lib/queries";

export default function ContactPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: submissions, isLoading } = useQuery({
    queryKey: ["admin", "contact"],
    queryFn: adminApi.contactSubmissions,
  });

  const mutation = useMutation({
    mutationFn: (id: string) => adminApi.markContactHandled(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin"] });
      toast({ title: "Marked as handled" });
    },
    onError: (error: Error) => {
      toast({
        title: "Could not update",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <AdminShell
      title="Contact"
      description="Messages from the public contact form"
    >
      {isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      ) : submissions && submissions.length > 0 ? (
        <div className="space-y-3">
          {submissions.map((submission) => (
            <Card
              key={submission.id}
              className={`bg-card border-white/[0.06] ${
                submission.handledAt ? "opacity-60" : ""
              }`}
            >
              <CardContent className="pt-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-slate-200">
                        {submission.subject}
                      </h3>
                      {submission.handledAt ? (
                        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                          handled
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/20">
                          open
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      {submission.fullName}
                      {submission.company ? ` · ${submission.company}` : ""} ·{" "}
                      <a
                        href={`mailto:${submission.email}`}
                        className="text-blue-400 hover:underline"
                      >
                        {submission.email}
                      </a>{" "}
                      ·{" "}
                      {formatDistanceToNow(new Date(submission.createdAt), {
                        addSuffix: true,
                      })}
                    </p>
                    <p className="text-sm text-slate-400 mt-3 whitespace-pre-wrap">
                      {submission.message}
                    </p>
                  </div>
                  {!submission.handledAt && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={mutation.isPending}
                      onClick={() => mutation.mutate(submission.id)}
                      className="shrink-0 border-white/[0.08]"
                    >
                      <CheckCircle2 className="mr-1.5 h-4 w-4" /> Mark handled
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="bg-card border-white/[0.06]">
          <CardContent className="py-16 text-center">
            <Mail className="h-8 w-8 text-slate-700 mx-auto mb-3" />
            <p className="text-sm text-slate-500">No messages yet.</p>
          </CardContent>
        </Card>
      )}
    </AdminShell>
  );
}
