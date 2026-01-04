import { useState } from "react";
import { Trash2, ChevronDown, ChevronUp, Copy, GripVertical, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Row, ColumnLayout, COLUMN_LAYOUTS, Column } from "./types";

interface RowEditorProps {
  row: Row;
  rowIndex: number;
  onUpdate: (row: Row) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDuplicate: () => void;
  isFirst: boolean;
  isLast: boolean;
}

export const RowEditor = ({
  row,
  rowIndex,
  onUpdate,
  onDelete,
  onMoveUp,
  onMoveDown,
  onDuplicate,
  isFirst,
  isLast,
}: RowEditorProps) => {
  const [isOpen, setIsOpen] = useState(false);

  const updateSettings = (key: string, value: unknown) => {
    onUpdate({
      ...row,
      settings: {
        ...row.settings,
        [key]: value,
      },
    });
  };

  const changeLayout = (newLayout: ColumnLayout) => {
    const newColumnCount = COLUMN_LAYOUTS[newLayout].widths.length;
    const currentColumns = row.columns;
    
    // Adjust columns to match new layout
    let newColumns: Column[];
    if (newColumnCount > currentColumns.length) {
      // Add new columns
      newColumns = [
        ...currentColumns,
        ...Array.from({ length: newColumnCount - currentColumns.length }, () => ({
          id: crypto.randomUUID(),
          widgets: [],
          settings: {
            verticalAlign: 'top' as const,
            padding: '16px',
            backgroundColor: 'transparent',
          },
        })),
      ];
    } else if (newColumnCount < currentColumns.length) {
      // Remove extra columns (keep widgets from removed columns in last column)
      const keepColumns = currentColumns.slice(0, newColumnCount - 1);
      const removedColumns = currentColumns.slice(newColumnCount - 1);
      const lastColumn = {
        ...removedColumns[0],
        widgets: removedColumns.flatMap(col => col.widgets),
      };
      newColumns = [...keepColumns, lastColumn];
    } else {
      newColumns = currentColumns;
    }

    onUpdate({
      ...row,
      layout: newLayout,
      columns: newColumns,
    });
  };

  const widgetCount = row.columns.reduce((acc, col) => acc + col.widgets.length, 0);

  return (
    <Card className="border-l-4 border-l-primary/50">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="p-2">
          <div className="flex items-center justify-between">
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="flex-1 justify-start gap-2 h-8 px-2">
                <GripVertical className="h-3 w-3 text-muted-foreground" />
                <span className="text-xs font-medium">Row {rowIndex + 1}</span>
                <span className="text-[10px] text-muted-foreground">
                  ({row.columns.length} cols, {widgetCount} widgets)
                </span>
                {isOpen ? <ChevronUp className="h-3 w-3 ml-auto" /> : <ChevronDown className="h-3 w-3 ml-auto" />}
              </Button>
            </CollapsibleTrigger>
            <div className="flex items-center gap-0.5">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={onMoveUp}
                disabled={isFirst}
              >
                <ChevronUp className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={onMoveDown}
                disabled={isLast}
              >
                <ChevronDown className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={onDuplicate}
              >
                <Copy className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-destructive hover:text-destructive"
                onClick={onDelete}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="p-3 pt-0 space-y-3">
            {/* Layout Selection */}
            <div className="space-y-2">
              <Label className="text-xs">Column Layout</Label>
              <Select value={row.layout} onValueChange={changeLayout}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(COLUMN_LAYOUTS).map(([key, config]) => (
                    <SelectItem key={key} value={key} className="text-xs">
                      {config.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Row Settings */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Max Width</Label>
                <Select
                  value={row.settings.maxWidth}
                  onValueChange={(v) => updateSettings('maxWidth', v)}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="boxed" className="text-xs">Boxed</SelectItem>
                    <SelectItem value="full" className="text-xs">Full Width</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Gap</Label>
                <Input
                  value={row.settings.gap}
                  onChange={(e) => updateSettings('gap', e.target.value)}
                  placeholder="16px"
                  className="h-8 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Padding</Label>
                <Input
                  value={row.settings.padding}
                  onChange={(e) => updateSettings('padding', e.target.value)}
                  placeholder="24px 16px"
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Min Height</Label>
                <Input
                  value={row.settings.minHeight}
                  onChange={(e) => updateSettings('minHeight', e.target.value)}
                  placeholder="auto"
                  className="h-8 text-xs"
                />
              </div>
            </div>

            {/* Background */}
            <div className="space-y-1">
              <Label className="text-xs">Background Color</Label>
              <div className="flex gap-2">
                <Input
                  type="color"
                  value={row.settings.backgroundColor === 'transparent' ? '#ffffff' : row.settings.backgroundColor}
                  onChange={(e) => updateSettings('backgroundColor', e.target.value)}
                  className="w-10 h-8 p-1"
                />
                <Input
                  value={row.settings.backgroundColor}
                  onChange={(e) => updateSettings('backgroundColor', e.target.value)}
                  placeholder="transparent"
                  className="flex-1 h-8 text-xs"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Background Image URL</Label>
              <Input
                value={row.settings.backgroundImage}
                onChange={(e) => updateSettings('backgroundImage', e.target.value)}
                placeholder="https://..."
                className="h-8 text-xs"
              />
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};
