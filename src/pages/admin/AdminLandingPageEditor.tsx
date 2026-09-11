import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Save, Eye, Settings, Palette, Smartphone, Monitor, Pencil, Check, X, Layers3, Sparkles } from "lucide-react";
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
    <div className="flex h-full min-h-[680px] flex-col overflow-hidden rounded-2xl border bg-card shadow-sm">
      {/* Header */}
      <header className="z-10 flex flex-wrap items-center gap-4 border-b bg-card px-4 py-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <Button variant="ghost" size="icon" className="shrink-0 rounded-lg" asChild>
            <Link to="/admin/landing-pages">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="min-w-0">
            <div className="mb-0.5 flex items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.13em] text-muted-foreground">Landing page</span>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${formData.is_published ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                {formData.is_published ? "Live" : "Draft"}
              </span>
            </div>
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
              className="h-6 max-w-[220px] border-none px-0 text-lg font-semibold shadow-none focus-visible:ring-0 sm:max-w-[320px]"
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

        <div className="hidden flex-1 items-center justify-center lg:flex">
          <div className="flex items-center gap-3 rounded-lg border bg-muted/30 px-3 py-1.5">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">Canvas preview</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">{previewMode === "mobile" ? "Mobile · 375 px" : "Desktop · responsive"}</p>
            </div>
            <span className="rounded-full border bg-card px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              {formData.sections.length} {formData.sections.length === 1 ? "section" : "sections"}
            </span>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2 self-end sm:self-auto">
          <div className="flex items-center gap-1 rounded-lg border bg-muted/30 p-1">
            <Button
              variant={previewMode === "desktop" ? "secondary" : "ghost"}
              size="icon"
              className="h-7 w-7 rounded-md"
              onClick={() => setPreviewMode("desktop")}
              title="Desktop preview"
            >
              <Monitor className="h-4 w-4" />
            </Button>
            <Button
              variant={previewMode === "mobile" ? "secondary" : "ghost"}
              size="icon"
              className="h-7 w-7 rounded-md"
              onClick={() => setPreviewMode("mobile")}
              title="Mobile preview"
            >
              <Smartphone className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex items-center gap-2 border-l pl-3">
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
            <Label htmlFor="published" className="hidden text-sm font-medium sm:inline">Publish</Label>
          </div>

          {!isNew && formData.is_published && (
            <Button variant="outline" size="sm" className="hidden sm:inline-flex" asChild>
              <a href={`/lp/${formData.slug}`} target="_blank" rel="noopener noreferrer">
                <Eye className="mr-1 h-4 w-4" />
                View
              </a>
            </Button>
          )}

          <Button
            size="sm"
            className="shadow-sm"
            onClick={() => saveMutation.mutate(formData)}
            disabled={saveMutation.isPending || !formData.title}
          >
            <Save className="mr-1 h-4 w-4" />
            {saveMutation.isPending ? "Saving..." : "Save"}
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Left Panel - Editor */}
        <div className="flex w-[340px] shrink-0 flex-col border-r bg-muted/[0.22] xl:w-[370px]">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="flex h-full min-h-0 flex-col">
            <TabsList className="mx-3 mt-3 grid h-10 w-auto grid-cols-3 rounded-lg bg-muted/70 p-1">
              <TabsTrigger value="sections" className="gap-1.5 rounded-md text-xs data-[state=active]:bg-card data-[state=active]:shadow-sm">
                <Layers3 className="h-3.5 w-3.5" />
                Sections
              </TabsTrigger>
              <TabsTrigger value="theme" className="gap-1.5 rounded-md text-xs data-[state=active]:bg-card data-[state=active]:shadow-sm">
                <Palette className="h-3 w-3 mr-1" />
                Theme
              </TabsTrigger>
              <TabsTrigger value="settings" className="gap-1.5 rounded-md text-xs data-[state=active]:bg-card data-[state=active]:shadow-sm">
                <Settings className="h-3 w-3 mr-1" />
                Settings
              </TabsTrigger>
            </TabsList>

            <ScrollArea className="flex-1 min-h-0">
              <div className="p-4">
                <TabsContent value="sections" className="mt-0 space-y-4">
                  <SectionPalette onAddSection={addSection} />
                  
                  <Separator className="my-5" />
                  
                  {formData.sections.length === 0 ? (
                    <div className="rounded-xl border border-dashed bg-background/70 px-4 py-6 text-center">
                      <div className="mx-auto mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <Layers3 className="h-4 w-4" />
                      </div>
                      <p className="text-sm font-semibold text-foreground">Your page is empty</p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">Add a hero section first, then build the story with benefits and proof.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                        On this page · {formData.sections.length}
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
        <div className="flex min-w-0 flex-1 flex-col overflow-auto bg-[radial-gradient(circle_at_top,_hsl(var(--primary)/0.08),_transparent_32%),linear-gradient(hsl(var(--muted)/0.55),hsl(var(--background)))] p-4 sm:p-6">
          <div
            className={`mx-auto w-full overflow-hidden rounded-xl border bg-background shadow-xl transition-all duration-300 ${
              previewMode === "mobile" ? "max-w-[375px]" : "max-w-none"
            }`}
            style={{
              fontFamily: formData.theme_settings.fontFamily,
              minHeight: "100%",
            }}
          >
            {formData.custom_css && <style>{formData.custom_css}</style>}
            
            {formData.sections.length === 0 ? (
              <div className="flex min-h-[520px] flex-col items-center justify-center px-6 text-center">
                <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-sm">
                  <Sparkles className="h-7 w-7" />
                </div>
                <p className="text-xl font-semibold text-foreground">Start with a strong first impression</p>
                <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">Choose a section from the library to see it here instantly. A hero, benefits grid, and checkout form make a great starting point.</p>
                <Button className="mt-6" size="sm" onClick={() => setActiveTab("sections")}>
                  <Layers3 className="mr-2 h-4 w-4" />
                  Browse sections
                </Button>
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
