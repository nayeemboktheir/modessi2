import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Plus, Edit, Trash2, Eye, EyeOff, ExternalLink, Copy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { format } from "date-fns";

interface LandingPage {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  is_active: boolean;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

const AdminLandingPages = () => {
  const queryClient = useQueryClient();
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: landingPages, isLoading } = useQuery({
    queryKey: ["admin-landing-pages"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("landing_pages")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as LandingPage[];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("landing_pages")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-landing-pages"] });
      toast.success("Landing page deleted");
      setDeleteId(null);
    },
    onError: (error) => {
      toast.error("Failed to delete landing page");
      console.error(error);
    },
  });

  const togglePublishMutation = useMutation({
    mutationFn: async ({ id, is_published }: { id: string; is_published: boolean }) => {
      const { error } = await supabase
        .from("landing_pages")
        .update({ is_published, is_active: is_published })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-landing-pages"] });
      toast.success("Landing page updated");
    },
    onError: (error) => {
      toast.error("Failed to update landing page");
      console.error(error);
    },
  });

  const copyMutation = useMutation({
    mutationFn: async (id: string) => {
      // First fetch the full landing page data
      const { data: original, error: fetchError } = await supabase
        .from("landing_pages")
        .select("*")
        .eq("id", id)
        .single();

      if (fetchError) throw fetchError;

      // Create a copy with new slug and unpublished status
      const newSlug = `${original.slug}-copy-${Date.now()}`;
      const { id: _id, created_at: _created, updated_at: _updated, ...rest } = original;
      
      const { error: insertError } = await supabase
        .from("landing_pages")
        .insert({
          ...rest,
          title: `${original.title} (Copy)`,
          slug: newSlug,
          is_published: false,
          is_active: false,
        });

      if (insertError) throw insertError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-landing-pages"] });
      toast.success("Landing page copied successfully");
    },
    onError: (error) => {
      toast.error("Failed to copy landing page");
      console.error(error);
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Landing Pages</h1>
          <p className="text-muted-foreground">
            Create and manage product landing pages
          </p>
        </div>
        <Button asChild>
          <Link to="/admin/landing-pages/new">
            <Plus className="mr-2 h-4 w-4" />
            Add New
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Landing Pages</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading...
            </div>
          ) : !landingPages?.length ? (
            <div className="text-center py-8 text-muted-foreground">
              No landing pages yet. Create your first one!
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {landingPages.map((page) => (
                  <TableRow key={page.id}>
                    <TableCell className="font-medium">{page.title}</TableCell>
                    <TableCell>
                      <code className="text-sm bg-muted px-2 py-1 rounded">
                        /lp/{page.slug}
                      </code>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={page.is_published ? "default" : "secondary"}
                      >
                        {page.is_published ? "Published" : "Draft"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {format(new Date(page.created_at), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            togglePublishMutation.mutate({
                              id: page.id,
                              is_published: !page.is_published,
                            })
                          }
                          title={page.is_published ? "Unpublish" : "Publish"}
                        >
                          {page.is_published ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
                        {page.is_published && (
                          <Button
                            variant="ghost"
                            size="icon"
                            asChild
                            title="View page"
                          >
                            <a
                              href={`/lp/${page.slug}`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => copyMutation.mutate(page.id)}
                          title="Copy landing page"
                          disabled={copyMutation.isPending}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" asChild>
                          <Link to={`/admin/landing-pages/${page.id}`}>
                            <Edit className="h-4 w-4" />
                          </Link>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteId(page.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Landing Page?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The landing page will be permanently
              deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminLandingPages;
