import { useBridge } from "@/lib/bridge-hooks"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "./ui/card"
import { Calendar, User, Info, FileText } from "lucide-react"

export function AuditPanel() {
  const { data: auditData, loading, refetch } = useBridge("queryAuditLogs", { userId: 0 })
  const logs = auditData?.logs || []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">Security Audit Trail</h2>
          <p className="text-sm text-muted-foreground">Monitor system events, configuration edits, and developer logs.</p>
        </div>

        <button
          onClick={() => refetch()}
          className="cursor-pointer inline-flex items-center justify-center rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted"
        >
          Refresh Log
        </button>
      </div>

      <Card className="border-border/60 shadow-xs">
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Audit Logs Trail ({logs.length})</CardTitle>
          <CardDescription>Immutable log recording administrative project actions.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-xs text-muted-foreground">Loading audit trail...</div>
          ) : logs.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground">No audit logs recorded in system.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="p-3 font-semibold text-muted-foreground">User</th>
                    <th className="p-3 font-semibold text-muted-foreground">Action</th>
                    <th className="p-3 font-semibold text-muted-foreground">Event Details</th>
                    <th className="p-3 font-semibold text-muted-foreground">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-muted/10">
                      <td className="p-3">
                        <div className="flex items-center gap-1.5 font-medium text-foreground">
                          <User className="size-3.5 text-muted-foreground" />
                          {log.userName || "System"}
                        </div>
                      </td>
                      <td className="p-3">
                        <span className="inline-flex items-center gap-1 rounded-md border border-indigo-200 bg-indigo-50/50 px-1.5 py-0.5 text-3xs font-semibold uppercase tracking-wider text-indigo-600">
                          {log.action}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-1.5 text-muted-foreground max-w-md truncate" title={log.details}>
                          <Info className="size-3.5 shrink-0 text-muted-foreground opacity-65" />
                          {log.details}
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Calendar className="size-3.5 text-muted-foreground" />
                          {new Date(log.createdAt).toLocaleString()}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
