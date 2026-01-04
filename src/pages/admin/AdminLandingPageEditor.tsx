import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Save, Eye, Settings, Palette, Smartphone, Monitor, Pencil, Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

import { Section, ThemeSettings, DEFAULT_THEME } from "@/components/landing-builder/types";
import { SectionPalette } from "@/components/landing-builder/SectionPalette";
import { SectionEditor } from "@/components/landing-builder/SectionEditor";
import { ThemeEditor } from "@/components/landing-builder/ThemeEditor";
import { SectionPreview } from "@/components/landing-builder/SectionPreview";

interface LandingPageData {
  id?: string;
  title: string;
  slug: string;
  description: string;
  is_active: boolean;
  is_published: boolean;
  sections: Section[];
  theme_settings: ThemeSettings;
  meta_title: string;
  meta_description: string;
  custom_css: string;
}

const defaultData: LandingPageData = {
  title: "",
  slug: "",
  description: "",
  is_active: false,
  is_published: false,
  sections: [],
  theme_settings: DEFAULT_THEME,
  meta_title: "",
  meta_description: "",
  custom_css: "",
};

const AdminLandingPageEditor = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isNew = id === "new";

  const [formData, setFormData] = useState<LandingPageData>(defaultData);
  const [activeTab, setActiveTab] = useState<"sections" | "theme" | "settings">("sections");
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">("desktop");
  const [editingSlug, setEditingSlug] = useState(false);
  const [tempSlug, setTempSlug] = useState("");
  const slugInputRef = useRef<HTMLInputElement>(null);

  // Fetch existing landing page
  const { data: existingPage, isLoading } = useQuery({
    queryKey: ["landing-page", id],
    queryFn: async () => {
      if (isNew) return null;
      const { data, error } = await supabase
        .from("landing_pages")
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !isNew,
  });

  // Fetch products for selection
  const { data: products } = useQuery({
    queryKey: ["admin-products-for-landing"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, images, price")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (existingPage) {
      setFormData({
        id: existingPage.id,
        title: existingPage.title || "",
        slug: existingPage.slug || "",
        description: existingPage.description || "",
        is_active: existingPage.is_active || false,
        is_published: existingPage.is_published || false,
        sections: (existingPage.sections as unknown as Section[]) || [],
        theme_settings: (existingPage.theme_settings as unknown as ThemeSettings) || DEFAULT_THEME,
        meta_title: existingPage.meta_title || "",
        meta_description: existingPage.meta_description || "",
        custom_css: existingPage.custom_css || "",
      });
    }
  }, [existingPage]);

  const saveMutation = useMutation({
    mutationFn: async (data: LandingPageData) => {
      const payload = {
        title: data.title,
        slug: data.slug,
        description: data.description,
        is_active: data.is_active,
        is_published: data.is_published,
        sections: JSON.parse(JSON.stringify(data.sections)),
        theme_settings: JSON.parse(JSON.stringify(data.theme_settings)),
        meta_title: data.meta_title,
        meta_description: data.meta_description,
        custom_css: data.custom_css,
      };

      if (isNew) {
        const { data: result, error } = await supabase
          .from("landing_pages")
          .insert([payload])
          .select()
          .single();
        if (error) throw error;
        return result;
      } else {
        const { data: result, error } = await supabase
          .from("landing_pages")
          .update(payload)
          .eq("id", id)
          .select()
          .single();
        if (error) throw error;
        return result;
      }
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["admin-landing-pages"] });
      toast.success(isNew ? "Landing page created!" : "Landing page saved!");
      if (isNew && result?.id) {
        navigate(`/admin/landing-pages/${result.id}`);
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to save landing page");
    },
  });

  const generateSlug = (title: string) => {
    const baseSlug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    return `LP-${baseSlug}`;
  };

  const addSection = (section: Section) => {
    setFormData((prev) => ({
      ...prev,
      sections: [...prev.sections, section],
    }));
  };

  const updateSection = (index: number, updatedSection: Section) => {
    setFormData((prev) => ({
      ...prev,
      sections: prev.sections.map((s, i) => (i === index ? updatedSection : s)),
    }));
  };

  const deleteSection = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      sections: prev.sections.filter((_, i) => i !== index),
    }));
  };

  const moveSection = (index: number, direction: "up" | "down") => {
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= formData.sections.length) return;

    setFormData((prev) => {
      const newSections = [...prev.sections];
      [newSections[index], newSections[newIndex]] = [newSections[newIndex], newSections[index]];
      return { ...prev, sections: newSections };
    });
  };

  if (!isNew && isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="border-b px-4 py-2 flex items-center justify-between bg-background z-10">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/admin/landing-pages">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <Input
              value={formData.title}
              onChange={(e) => {
                const title = e.target.value;
                setFormData((prev) => ({
                  ...prev,
                  title,
                  slug: prev.slug || generateSlug(title),
                }));
              }}
              placeholder="Page Title"
              className="font-semibold text-lg border-none shadow-none px-0 h-auto focus-visible:ring-0"
            />
            {editingSlug ? (
              <div className="flex items-center gap-1 mt-1">
                <span className="text-xs text-muted-foreground">/lp/</span>
                <Input
                  ref={slugInputRef}
                  value={tempSlug}
                  onChange={(e) => setTempSlug(e.target.value.replace(/[^a-zA-Z0-9-]/g, ''))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      setFormData((prev) => ({ ...prev, slug: tempSlug }));
                      setEditingSlug(false);
                    } else if (e.key === 'Escape') {
                      setEditingSlug(false);
                    }
                  }}
                  className="h-6 text-xs w-40 px-1"
                  autoFocus
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5"
                  onClick={() => {
                    setFormData((prev) => ({ ...prev, slug: tempSlug }));
                    setEditingSlug(false);
                  }}
                >
                  <Check className="h-3 w-3 text-green-600" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5"
                  onClick={() => setEditingSlug(false)}
                >
                  <X className="h-3 w-3 text-destructive" />
                </Button>
              </div>
            ) : (
              <div
                className="text-xs text-muted-foreground flex items-center gap-1 cursor-pointer hover:text-primary group"
                onClick={() => {
                  setTempSlug(formData.slug);
                  setEditingSlug(true);
                }}
              >
                /lp/{formData.slug || "LP-your-page"}
                <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 border rounded-md p-1">
            <Button
              variant={previewMode === "desktop" ? "secondary" : "ghost"}
              size="icon"
              className="h-7 w-7"
              onClick={() => setPreviewMode("desktop")}
            >
              <Monitor className="h-4 w-4" />
            </Button>
            <Button
              variant={previewMode === "mobile" ? "secondary" : "ghost"}
              size="icon"
              className="h-7 w-7"
              onClick={() => setPreviewMode("mobile")}
            >
              <Smartphone className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex items-center gap-2 px-2">
            <Switch
              id="published"
              checked={formData.is_published}
              onCheckedChange={(checked) =>
                setFormData((prev) => ({
                  ...prev,
                  is_published: checked,
                  is_active: checked,
                }))
              }
            />
            <Label htmlFor="published" className="text-sm">Publish</Label>
          </div>

          {!isNew && formData.is_published && (
            <Button variant="outline" size="sm" asChild>
              <a href={`/lp/${formData.slug}`} target="_blank" rel="noopener noreferrer">
                <Eye className="mr-1 h-4 w-4" />
                View
              </a>
            </Button>
          )}

          <Button
            size="sm"
            onClick={() => saveMutation.mutate(formData)}
            disabled={saveMutation.isPending || !formData.title}
          >
            <Save className="mr-1 h-4 w-4" />
            {saveMutation.isPending ? "Saving..." : "Save"}
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Editor */}
        <div className="w-80 border-r flex flex-col bg-muted/30">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="flex flex-col h-full">
            <TabsList className="grid w-full grid-cols-3 mx-2 mt-2" style={{ width: "calc(100% - 16px)" }}>
              <TabsTrigger value="sections" className="text-xs">Sections</TabsTrigger>
              <TabsTrigger value="theme" className="text-xs">
                <Palette className="h-3 w-3 mr-1" />
                Theme
              </TabsTrigger>
              <TabsTrigger value="settings" className="text-xs">
                <Settings className="h-3 w-3 mr-1" />
                Settings
              </TabsTrigger>
            </TabsList>

            <ScrollArea className="flex-1">
              <div className="p-3">
                <TabsContent value="sections" className="mt-0 space-y-4">
                  <SectionPalette onAddSection={addSection} />
                  
                  <Separator />
                  
                  {formData.sections.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <p className="text-sm">No sections yet</p>
                      <p className="text-xs">Add sections from above</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                        Page Sections ({formData.sections.length})
                      </h3>
                      {formData.sections.map((section, index) => (
                        <SectionEditor
                          key={section.id}
                          section={section}
                          onUpdate={(updated) => updateSection(index, updated as Section)}
                          onDelete={() => deleteSection(index)}
                          onMoveUp={() => moveSection(index, "up")}
                          onMoveDown={() => moveSection(index, "down")}
                          isFirst={index === 0}
                          isLast={index === formData.sections.length - 1}
                          products={products?.map((p) => ({ id: p.id, name: p.name })) || []}
                        />
                      ))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="theme" className="mt-0">
                  <ThemeEditor
                    theme={formData.theme_settings}
                    onChange={(theme) => setFormData((prev) => ({ ...prev, theme_settings: theme }))}
                  />
                </TabsContent>

                <TabsContent value="settings" className="mt-0 space-y-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm">Page Settings</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label className="text-xs">Page Slug</Label>
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-muted-foreground">/lp/</span>
                          <span className="text-sm font-medium text-primary">LP-</span>
                          <Input
                            value={formData.slug.replace(/^LP-/, '')}
                            onChange={(e) => {
                              const value = e.target.value.replace(/[^a-zA-Z0-9-]/g, '');
                              setFormData((prev) => ({ ...prev, slug: `LP-${value}` }));
                            }}
                            placeholder="page-name"
                            className="h-8 text-sm"
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">URL: /lp/{formData.slug || 'LP-page-name'}</p>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs">Description (internal)</Label>
                        <Textarea
                          value={formData.description}
                          onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                          placeholder="Notes about this page"
                          rows={2}
                          className="text-sm"
                        />
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm">SEO Settings</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label className="text-xs">Meta Title</Label>
                        <Input
                          value={formData.meta_title}
                          onChange={(e) => setFormData((prev) => ({ ...prev, meta_title: e.target.value }))}
                          placeholder="SEO page title"
                          className="h-8 text-sm"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs">Meta Description</Label>
                        <Textarea
                          value={formData.meta_description}
                          onChange={(e) => setFormData((prev) => ({ ...prev, meta_description: e.target.value }))}
                          placeholder="SEO description"
                          rows={2}
                          className="text-sm"
                        />
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm">Custom CSS</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Textarea
                        value={formData.custom_css}
                        onChange={(e) => setFormData((prev) => ({ ...prev, custom_css: e.target.value }))}
                        placeholder=".my-class { color: red; }"
                        rows={4}
                        className="font-mono text-xs"
                      />
                    </CardContent>
                  </Card>
                </TabsContent>
              </div>
            </ScrollArea>
          </Tabs>
        </div>

        {/* Right Panel - Preview */}
        <div className="flex-1 bg-muted/50 overflow-auto p-4">
          <div
            className={`mx-auto bg-background shadow-lg transition-all duration-300 overflow-hidden ${
              previewMode === "mobile" ? "max-w-[375px]" : "max-w-[1200px]"
            }`}
            style={{
              fontFamily: formData.theme_settings.fontFamily,
              minHeight: "100%",
            }}
          >
            {formData.custom_css && <style>{formData.custom_css}</style>}
            
            {formData.sections.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-96 text-muted-foreground">
                <p className="text-lg font-medium">Start building your page</p>
                <p className="text-sm">Add sections from the left panel</p>
              </div>
            ) : (
              formData.sections.map((section) => (
                <SectionPreview
                  key={section.id}
                  section={section}
                  theme={formData.theme_settings}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminLandingPageEditor;
