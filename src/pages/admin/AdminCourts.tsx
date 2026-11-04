import { AdminLayout } from "@/components/admin/AdminLayout";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { useAdminPagination } from "@/hooks/useAdminPagination";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useAllCourts, type Court } from "@/hooks/useCourts";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil } from "lucide-react";
import { useState } from "react";

interface CourtFormData {
  name: string;
  description: string;
  price_per_hour: number;
  image_url: string;
  is_active: boolean;
}

const defaultForm: CourtFormData = {
  name: "",
  description: "",
  price_per_hour: 500,
  image_url: "",
  is_active: true,
};

const AdminCourts = () => {
  const { data: courts, isLoading } = useAllCourts();
  const pagination = useAdminPagination(courts);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CourtFormData>(defaultForm);

  const saveMutation = useMutation({
    mutationFn: async (data: CourtFormData & { id?: string }) => {
      if (data.id) {
        const { error } = await supabase
          .from("courts")
          .update({
            name: data.name,
            description: data.description,
            price_per_hour: data.price_per_hour,
            image_url: data.image_url,
            is_active: data.is_active,
          })
          .eq("id", data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("courts").insert({
          name: data.name,
          description: data.description,
          price_per_hour: data.price_per_hour,
          image_url: data.image_url,
          is_active: data.is_active,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["courts"] });
      toast({ title: editingId ? "Court updated" : "Court created" });
      setOpen(false);
      setEditingId(null);
      setForm(defaultForm);
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleEdit = (court: Court) => {
    setEditingId(court.id);
    setForm({
      name: court.name,
      description: court.description || "",
      price_per_hour: court.price_per_hour,
      image_url: court.image_url || "",
      is_active: court.is_active,
    });
    setOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate({ ...form, id: editingId || undefined });
  };

  return (
    <AdminLayout>
      <div className="p-6 lg:p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">Courts</h1>
            <p className="text-muted-foreground">Manage your pickleball courts</p>
          </div>
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setEditingId(null); setForm(defaultForm); } }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Court
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingId ? "Edit Court" : "Add New Court"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Court Name</Label>
                  <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea id="description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="price">Price per Hour (₱)</Label>
                  <Input id="price" type="number" value={form.price_per_hour} onChange={(e) => setForm({ ...form, price_per_hour: Number(e.target.value) })} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="image">Image URL</Label>
                  <Input id="image" value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} />
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={form.is_active} onCheckedChange={(checked) => setForm({ ...form, is_active: checked })} />
                  <Label>Active</Label>
                </div>
                <Button type="submit" className="w-full" disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? "Saving..." : editingId ? "Update Court" : "Create Court"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 text-center text-muted-foreground">Loading courts...</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Court</TableHead>
                    <TableHead>Price/Hour</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagination.rows.map((court) => (
                    <TableRow key={court.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-foreground">{court.name}</p>
                          <p className="text-sm text-muted-foreground">{court.description}</p>
                        </div>
                      </TableCell>
                      <TableCell className="font-semibold text-foreground">₱{court.price_per_hour}</TableCell>
                      <TableCell>
                        <Badge variant={court.is_active ? "default" : "secondary"}>
                          {court.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(court)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            {!isLoading && <AdminPagination label="Courts" pagination={pagination} />}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminCourts;
