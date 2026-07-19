import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { DataTable } from "@/components/data-table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { docLibrary, type DocItem } from "@/lib/mock-data";
import { fmtDate } from "@/lib/format";
import { Download, FileText, Upload, History, Replace } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/documents")({ component: DocsPage });

const CATS = ["Training", "SOP", "Forms", "Contracts", "Policies", "Templates"];

function DocsPage() {
  const [cat, setCat] = useState("all");
  const [q, setQ] = useState("");
  const [drag, setDrag] = useState(false);
  const filtered = docLibrary.filter(
    (d) =>
      (cat === "all" || d.category === cat) &&
      (!q || d.name.toLowerCase().includes(q.toLowerCase())),
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="Document Library"
        description="Shared SOPs, training materials, contracts, and templates."
      />

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          toast.success(`Uploaded ${e.dataTransfer.files.length} file(s)`);
        }}
        className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 text-center transition ${drag ? "border-primary bg-primary/5" : "border-border bg-card/40"}`}
      >
        <Upload className="size-6 text-muted-foreground" />
        <p className="mt-2 text-sm">Drag & drop files here or</p>
        <Button
          size="sm"
          variant="outline"
          className="mt-2"
          onClick={() => toast.success("File picker (mock)")}
        >
          Choose files
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search documents…"
          className="max-w-xs"
        />
        <Select value={cat} onValueChange={setCat}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {CATS.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DataTable<DocItem>
        rows={filtered}
        columns={[
          {
            head: "Name",
            cell: (d) => (
              <span className="inline-flex items-center gap-2 font-medium">
                <FileText className="size-4 text-muted-foreground" />
                {d.name}
              </span>
            ),
          },
          { head: "Category", cell: (d) => <span className="text-xs">{d.category}</span> },
          { head: "Version", cell: (d) => <span className="font-mono text-xs">{d.version}</span> },
          { head: "Size", cell: (d) => <span className="font-mono text-xs">{d.size}</span> },
          {
            head: "Access",
            cell: (d) => (
              <span className="text-xs text-muted-foreground">{d.access.join(", ")}</span>
            ),
          },
          {
            head: "Updated",
            cell: (d) => (
              <span className="text-xs text-muted-foreground">{fmtDate(d.updatedAt)}</span>
            ),
          },
          {
            head: "",
            cell: () => (
              <div className="flex justify-end gap-1">
                <Button size="sm" variant="ghost" onClick={() => toast.success("Download started")}>
                  <Download className="size-3.5" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => toast("Replace (mock)")}>
                  <Replace className="size-3.5" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => toast("Version history (mock)")}>
                  <History className="size-3.5" />
                </Button>
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}
