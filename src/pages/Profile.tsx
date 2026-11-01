import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { User, Save } from "lucide-react";
import { useState } from "react";
import { useProfile, useUpdateProfile } from "@/hooks/useProfile";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { PageHeading } from "@/components/layout/PageHeading";
import { profileSchema } from "@/lib/profile";

const Profile = () => {
  const { user } = useAuth();
  const { data: profile, isLoading, error, refetch } = useProfile();
  const updateProfile = useUpdateProfile();
  const { toast } = useToast();

  const [draft, setDraft] = useState<{ userId: string; full_name: string; phone: string } | null>(null);
  const formData = draft?.userId === user?.id ? draft : { full_name: profile?.full_name || "", phone: profile?.phone || "" };

  const handleSave = async () => {
    const result = profileSchema.safeParse(formData);
    if (!result.success) {
      toast({ title: "Check your details", description: result.error.issues[0].message, variant: "destructive" });
      return;
    }
    try {
      await updateProfile.mutateAsync(result.data);
      setDraft(null);
      toast({ title: "Profile updated successfully" });
    } catch (error: unknown) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update profile",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main id="main-content" className="pt-32 pb-20 md:pt-40">
        <div className="container mx-auto px-4 max-w-2xl">
          <PageHeading title="My profile" description="The details your club needs to keep in touch." />

          {error ? (
            <div role="alert" className="rounded-xl border border-destructive/30 p-6">
              <p>Could not load your profile. Please try again.</p>
              <Button variant="outline" className="mt-3" onClick={() => void refetch()}>Try again</Button>
            </div>
          ) : isLoading ? (
            <Card>
              <CardContent className="p-6 space-y-4">
                <Skeleton className="h-20 w-20 rounded-full mx-auto" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5 text-primary" />
                  Account Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Avatar placeholder */}
                <div className="flex justify-center">
                  <div className="h-20 w-20 rounded-full gradient-primary flex items-center justify-center">
                    <User className="h-10 w-10 text-primary-foreground" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    value={user?.email || ""}
                    disabled
                    className="bg-muted"
                  />
                  <p className="text-xs text-muted-foreground">Email cannot be changed</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="full_name">Full Name</Label>
                  <Input
                    id="full_name"
                    value={formData.full_name}
                    onChange={(e) => setDraft({ ...formData, userId: user!.id, full_name: e.target.value })}
                    autoComplete="name"
                    maxLength={120}
                    placeholder="Enter your full name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setDraft({ ...formData, userId: user!.id, phone: e.target.value })}
                    autoComplete="tel"
                    maxLength={32}
                    placeholder="+63 912 345 6789"
                    type="tel"
                  />
                </div>

                <Button
                  onClick={handleSave}
                  disabled={updateProfile.isPending}
                  className="w-full"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {updateProfile.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Profile;
