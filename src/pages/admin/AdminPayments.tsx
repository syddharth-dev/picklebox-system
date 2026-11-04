import { AdminLayout } from "@/components/admin/AdminLayout";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { useAdminPagination } from "@/hooks/useAdminPagination";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAdminPayments } from "@/hooks/useAdmin";
import { format } from "date-fns";

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "outline",
  completed: "default",
  failed: "destructive",
  refunded: "secondary",
};

const AdminPayments = () => {
  const { data: payments, isLoading } = useAdminPayments();
  const pagination = useAdminPagination(payments);

  return (
    <AdminLayout>
      <div className="p-6 lg:p-8">
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Payments</h1>
          <p className="text-muted-foreground">Track all payment transactions</p>
        </div>

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 text-center text-muted-foreground">Loading payments...</div>
            ) : payments?.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">No payments yet</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Booking Ref</TableHead>
                    <TableHead>Court</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Paid At</TableHead>
                    <TableHead>Transaction Ref</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagination.rows.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell className="font-mono text-sm text-foreground">
                        {payment.bookings?.reference_code || "—"}
                      </TableCell>
                      <TableCell className="text-foreground">
                        {payment.bookings?.courts?.name || "Unknown"}
                      </TableCell>
                      <TableCell className="font-semibold text-foreground">
                        ₱{payment.amount}
                      </TableCell>
                      <TableCell className="text-muted-foreground capitalize">
                        {payment.payment_method || "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusVariant[payment.status] || "secondary"}>
                          {payment.status.charAt(0).toUpperCase() + payment.status.slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {payment.paid_at
                          ? format(new Date(payment.paid_at), "MMM d, yyyy HH:mm")
                          : "—"}
                      </TableCell>
                      <TableCell className="font-mono text-sm text-muted-foreground">
                        {payment.transaction_reference || "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            {!isLoading && <AdminPagination label="Payments" pagination={pagination} />}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminPayments;
