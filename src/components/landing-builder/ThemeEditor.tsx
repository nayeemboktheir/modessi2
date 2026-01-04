import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ThemeSettings, DEFAULT_THEME } from "./types";

interface ThemeEditorProps {
  theme: ThemeSettings;
  onChange: (theme: ThemeSettings) => void;
}

const fontOptions = [
  'Inter',
  'Roboto',
  'Open Sans',
  'Poppins',
  'Lato',
  'Montserrat',
  'Noto Sans Bengali',
  'Hind Siliguri',
];

export const ThemeEditor = ({ theme, onChange }: ThemeEditorProps) => {
  const updateTheme = (key: keyof ThemeSettings, value: string) => {
    onChange({
      ...theme,
      [key]: value,
    });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Theme Settings</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Primary</Label>
            <div className="flex gap-1">
              <Input
                type="color"
                value={theme.primaryColor}
                onChange={(e) => updateTheme('primaryColor', e.target.value)}
                className="w-10 h-8 p-1"
              />
              <Input
                value={theme.primaryColor}
                onChange={(e) => updateTheme('primaryColor', e.target.value)}
                className="flex-1 h-8 text-xs"
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Secondary</Label>
            <div className="flex gap-1">
              <Input
                type="color"
                value={theme.secondaryColor}
                onChange={(e) => updateTheme('secondaryColor', e.target.value)}
                className="w-10 h-8 p-1"
              />
              <Input
                value={theme.secondaryColor}
                onChange={(e) => updateTheme('secondaryColor', e.target.value)}
                className="flex-1 h-8 text-xs"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Accent</Label>
            <div className="flex gap-1">
              <Input
                type="color"
                value={theme.accentColor}
                onChange={(e) => updateTheme('accentColor', e.target.value)}
                className="w-10 h-8 p-1"
              />
              <Input
                value={theme.accentColor}
                onChange={(e) => updateTheme('accentColor', e.target.value)}
                className="flex-1 h-8 text-xs"
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Background</Label>
            <div className="flex gap-1">
              <Input
                type="color"
                value={theme.backgroundColor}
                onChange={(e) => updateTheme('backgroundColor', e.target.value)}
                className="w-10 h-8 p-1"
              />
              <Input
                value={theme.backgroundColor}
                onChange={(e) => updateTheme('backgroundColor', e.target.value)}
                className="flex-1 h-8 text-xs"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Text Color</Label>
            <div className="flex gap-1">
              <Input
                type="color"
                value={theme.textColor}
                onChange={(e) => updateTheme('textColor', e.target.value)}
                className="w-10 h-8 p-1"
              />
              <Input
                value={theme.textColor}
                onChange={(e) => updateTheme('textColor', e.target.value)}
                className="flex-1 h-8 text-xs"
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Border Radius</Label>
            <Input
              value={theme.borderRadius}
              onChange={(e) => updateTheme('borderRadius', e.target.value)}
              placeholder="8px"
              className="h-8 text-xs"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Font Family</Label>
            <Select
              value={theme.fontFamily}
              onValueChange={(v) => updateTheme('fontFamily', v)}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {fontOptions.map((font) => (
                  <SelectItem key={font} value={font}>{font}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Button Style</Label>
            <Select
              value={theme.buttonStyle}
              onValueChange={(v) => updateTheme('buttonStyle', v as ThemeSettings['buttonStyle'])}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="filled">Filled</SelectItem>
                <SelectItem value="outline">Outline</SelectItem>
                <SelectItem value="ghost">Ghost</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
