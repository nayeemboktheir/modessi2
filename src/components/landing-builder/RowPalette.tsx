import { Plus, Columns2, Columns3, LayoutGrid, PanelLeftClose, PanelRightClose } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Row, ColumnLayout, createDefaultRow } from "./types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface RowPaletteProps {
  onAddRow: (row: Row) => void;
}

const layoutOptions: Array<{
  layout: ColumnLayout;
  label: string;
  icon: React.ReactNode;
}> = [
  { layout: '100', label: '1 Column', icon: <div className="w-full h-4 bg-primary/60 rounded" /> },
  { layout: '50-50', label: '2 Equal', icon: <Columns2 className="h-4 w-4" /> },
  { layout: '33-33-33', label: '3 Equal', icon: <Columns3 className="h-4 w-4" /> },
  { layout: '25-25-25-25', label: '4 Equal', icon: <LayoutGrid className="h-4 w-4" /> },
  { layout: '66-33', label: '2/3 + 1/3', icon: <PanelRightClose className="h-4 w-4" /> },
  { layout: '33-66', label: '1/3 + 2/3', icon: <PanelLeftClose className="h-4 w-4" /> },
];

export const RowPalette = ({ onAddRow }: RowPaletteProps) => {
  const handleAddRow = (layout: ColumnLayout) => {
    const newRow = createDefaultRow(layout);
    onAddRow(newRow);
  };

  return (
    <div className="space-y-3">
      <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
        Add Row
      </h3>
      <div className="grid grid-cols-3 gap-2">
        {layoutOptions.map((option) => (
          <Card
            key={option.layout}
            className="cursor-pointer hover:border-primary hover:bg-accent/50 transition-all"
            onClick={() => handleAddRow(option.layout)}
          >
            <CardContent className="p-2 flex flex-col items-center text-center gap-1">
              <div className="text-muted-foreground">{option.icon}</div>
              <span className="text-[10px] font-medium">{option.label}</span>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
