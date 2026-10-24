"use client";

import { useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { motion } from "framer-motion";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  RefreshCw,
  UploadCloud,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProductList } from "@/components/inventory/product-list";
import { inventoryApi, type SyncResult } from "@/lib/vendor-api";

type FinderField = "name" | "sku" | "quantity" | "price" | "brand" | "image";

const FIELD_LABEL: Record<FinderField, string> = {
  name: "Product Name",
  sku: "SKU / Product Code",
  quantity: "Quantity Available",
  price: "Price",
  brand: "Brand / Manufacturer",
  image: "Photo File Name",
};

/** Header names we recognise for each field, most specific first. */
const ALIASES: Record<FinderField, string[]> = {
  sku: ["sku", "product code", "code", "item code", "part number", "part no", "barcode"],
  name: ["product name", "name", "product", "item", "description", "item name"],
  quantity: ["quantity", "qty", "stock", "stock qty", "stock_qty", "on hand", "available", "units"],
  price: ["price", "unit price", "unit_price", "cost", "selling price", "amount", "rate"],
  brand: ["brand", "manufacturer", "maker", "make", "company", "producer"],
  image: ["image", "photo", "picture", "image file", "photo file", "file name", "filename"],
};

const MAX_ROWS = 1000; // matches inventorySyncSchema in packages/shared

const TEMPLATE =
  "sku,name,brand,quantity,price,image\nMED-001,Amoxicillin 500mg,Emzor,480,1200,MED-001.jpg\nIND-087,Hydraulic Pump 12T,,12,84500,\n";

/** RFC 4180-ish CSV parser: quoted fields, escaped quotes, CRLF. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      if (row.some((cell) => cell.trim() !== "")) rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  row.push(field);
  if (row.some((cell) => cell.trim() !== "")) rows.push(row);
  return rows;
}

type Mapping = { field: FinderField; column: number; header: string; confidence: number };

/** Matches headers to fields: exact alias 100%, partial alias 80%. */
function detectColumns(headers: string[]): Mapping[] {
  const normalised = headers.map((h) => h.trim().toLowerCase().replace(/[_-]+/g, " "));
  const used = new Set<number>();
  const mappings: Mapping[] = [];

  for (const field of ["image", "brand", "sku", "quantity", "price", "name"] as FinderField[]) {
    let best: Mapping | null = null;
    normalised.forEach((header, column) => {
      if (used.has(column)) return;
      for (const alias of ALIASES[field]) {
        const clean = alias.replace(/_/g, " ");
        const confidence = header === clean ? 100 : header.includes(clean) ? 80 : 0;
        if (confidence > (best?.confidence ?? 0)) {
          best = { field, column, header: headers[column] ?? "", confidence };
        }
      }
    });
    if (best) {
      used.add((best as Mapping).column);
      mappings.push(best);
    }
  }
  return mappings;
}

function toNumber(raw: string | undefined): number {
  return Number((raw ?? "").replace(/[₦$,\s]/g, ""));
}

export function BulkImport() {
  const [stage, setStage] = useState<"upload" | "mapping" | "importing" | "done">("upload");
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<string[][]>([]);
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [problem, setProblem] = useState<string | null>(null);
  const [result, setResult] = useState<SyncResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const has = (field: FinderField) => mappings.some((m) => m.field === field);

  const sync = useMutation({
    mutationFn: inventoryApi.sync,
    onSuccess: (data) => {
      setResult(data);
      setStage("done");
      void queryClient.invalidateQueries({ queryKey: ["inventory"] });
    },
    onError: (err: Error) => {
      setProblem(err.message);
      setStage("mapping");
    },
  });

  async function readFile(file: File) {
    setProblem(null);
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setProblem("Please upload a .csv file. In Excel, use File → Save As → CSV.");
      return;
    }
    const parsed = parseCsv(await file.text());
    if (parsed.length < 2) {
      setProblem("That file has no data rows under the header.");
      return;
    }
    const [headers, ...data] = parsed;
    if (data.length > MAX_ROWS) {
      setProblem(`That file has ${data.length} rows; the limit is ${MAX_ROWS} per import. Split it and upload in parts.`);
      return;
    }
    setFileName(file.name);
    setRows(data);
    setMappings(detectColumns(headers ?? []));
    setStage("mapping");
  }

  function onPick(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) void readFile(file);
    event.target.value = "";
  }

  function onDrop(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    if (file) void readFile(file);
  }

  function confirmImport() {
    const col = (field: FinderField) => mappings.find((m) => m.field === field)?.column;
    const skuCol = col("sku");
    const qtyCol = col("quantity");
    const priceCol = col("price");
    const nameCol = col("name");
    const brandCol = col("brand");
    const imageCol = col("image");
    if (skuCol === undefined || qtyCol === undefined) return;

    const items = rows
      .map((row) => {
        const quantity = toNumber(row[qtyCol]);
        const price = priceCol !== undefined ? toNumber(row[priceCol]) : undefined;
        const name = nameCol !== undefined ? row[nameCol]?.trim() : undefined;
        const brand = brandCol !== undefined ? row[brandCol]?.trim() : undefined;
        const image = imageCol !== undefined ? row[imageCol]?.trim() : undefined;
        return {
          sku: (row[skuCol] ?? "").trim(),
          quantity: Number.isFinite(quantity) ? Math.max(0, Math.round(quantity)) : NaN,
          ...(price !== undefined && Number.isFinite(price) ? { price } : {}),
          ...(name && name.length >= 2 ? { name } : {}),
          ...(brand ? { brand } : {}),
          ...(image ? { image } : {}),
        };
      })
      .filter((item) => item.sku && Number.isFinite(item.quantity));

    if (items.length === 0) {
      setProblem("No rows had both a SKU and a numeric quantity.");
      return;
    }
    setStage("importing");
    sync.mutate({ items });
  }

  function downloadTemplate() {
    const url = URL.createObjectURL(new Blob([TEMPLATE], { type: "text/csv" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "finder-inventory-template.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  const reset = () => {
    setStage("upload");
    setRows([]);
    setMappings([]);
    setResult(null);
    setProblem(null);
  };

  return (
    <div className="space-y-6">
      {problem && (
        <div className="flex items-start gap-3 bg-amber-500/[0.06] border border-amber-500/20 rounded-xl px-4 py-3">
          <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
          <p className="text-[12px] text-amber-200">{problem}</p>
        </div>
      )}

      {stage === "upload" && (
        <>
          <div>
            <h3 className="text-base font-semibold text-white mb-1">Upload Inventory File</h3>
            <p className="text-slate-400 text-sm">Upload a .csv export from your spreadsheet, POS or ERP. Finder detects your columns and maps them to Finder fields.</p>
          </div>
          <input ref={inputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={onPick} />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={onDrop}
            className="w-full border-2 border-dashed border-white/[0.08] rounded-2xl p-12 text-center hover:border-blue-500/30 hover:bg-blue-500/[0.02] transition-all duration-300 group"
          >
            <UploadCloud className="h-12 w-12 text-slate-600 group-hover:text-blue-400 mx-auto mb-4 transition-colors" />
            <p className="text-sm font-medium text-slate-300 mb-1">Drag and drop your inventory file</p>
            <p className="text-xs text-slate-600 mb-4">or click to browse — .csv · up to {MAX_ROWS.toLocaleString()} rows per import</p>
            <span className="inline-block text-[11px] px-4 py-2 bg-white/[0.05] border border-white/[0.08] rounded-lg text-slate-400 font-medium">Browse Files</span>
          </button>
          <button
            type="button"
            onClick={downloadTemplate}
            className="w-full flex items-center gap-3 bg-white/[0.02] border border-white/[0.05] rounded-xl px-5 py-3 text-left hover:bg-white/[0.04] transition-all"
          >
            <FileSpreadsheet className="h-4 w-4 text-green-400 shrink-0" />
            <div className="flex-1">
              <p className="text-[12px] font-medium text-slate-300">Download Finder Template</p>
              <p className="text-[10px] text-slate-600">Pre-formatted with all required columns ready to fill</p>
            </div>
            <Download className="h-4 w-4 text-slate-500" />
          </button>
        </>
      )}

      {stage === "mapping" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
              <span className="text-[11px] text-blue-400 font-medium uppercase tracking-wider">Column Detection</span>
            </div>
            <h3 className="text-base font-semibold text-white">{fileName} detected · {rows.length} rows</h3>
            <p className="text-slate-400 text-sm mt-1">
              Review the mapping before import. Existing SKUs are updated; new SKUs are created when a name is present.
              Photos already in your library are attached automatically by SKU or product name; a Photo File Name column picks one explicitly.
            </p>
          </div>
          <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl overflow-hidden">
            <div className="grid grid-cols-3 px-5 py-3 border-b border-white/[0.05] bg-white/[0.02]">
              <span className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold">Your Column</span>
              <span className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold">Finder Field</span>
              <span className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold">Confidence</span>
            </div>
            {(["sku", "name", "quantity", "price", "brand", "image"] as FinderField[]).map((field) => {
              const match = mappings.find((m) => m.field === field);
              const required = field === "sku" || field === "quantity";
              return (
                <div key={field} className="grid grid-cols-3 px-5 py-3 border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                  <span className={`text-[12px] font-mono ${match ? "text-slate-300" : "text-slate-600"}`}>
                    {match?.header ?? "— not found —"}
                  </span>
                  <span className="text-[12px] text-slate-400">
                    {FIELD_LABEL[field]}
                    {required && <span className="text-red-400"> *</span>}
                  </span>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1 bg-white/[0.06] rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${match ? "bg-green-500" : required ? "bg-red-500/60" : "bg-white/[0.12]"}`} style={{ width: `${match?.confidence ?? 100}%` }} />
                    </div>
                    <span className={`text-[10px] font-semibold tabular-nums shrink-0 ${match ? "text-green-400" : required ? "text-red-400" : "text-slate-500"}`}>
                      {match ? `${match.confidence}%` : required ? "missing" : "optional"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
          {(!has("sku") || !has("quantity")) && (
            <p className="text-[12px] text-red-400">
              A SKU column and a quantity column are required. Rename your headers (e.g. &ldquo;sku&rdquo;, &ldquo;quantity&rdquo;) and upload again.
            </p>
          )}
          <div className="flex gap-3">
            <Button variant="ghost" onClick={reset} className="text-slate-400 hover:text-white">← Back</Button>
            <Button
              onClick={confirmImport}
              disabled={!has("sku") || !has("quantity")}
              className="flex-1 bg-blue-600 hover:bg-blue-500 text-white gap-2"
            >
              Confirm &amp; Import {rows.length} Products
            </Button>
          </div>
        </motion.div>
      )}

      {stage === "importing" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          <h3 className="text-base font-semibold text-white">Importing your inventory…</h3>
          {[
            { label: "Validating file format", done: true },
            { label: `Mapping ${rows.length} rows`, done: true },
            { label: "Syncing to Finder network…", done: false },
          ].map((step, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.12 }}
              className="flex items-center gap-3 p-3.5 bg-white/[0.02] border border-white/[0.05] rounded-xl">
              {step.done
                ? <CheckCircle2 className="h-4 w-4 text-green-400 shrink-0" />
                : <RefreshCw className="h-4 w-4 text-blue-400 animate-spin shrink-0" />}
              <span className={`text-sm ${step.done ? "text-slate-300" : "text-blue-300"}`}>{step.label}</span>
              {step.done && <span className="ml-auto text-[10px] text-green-500 font-medium uppercase tracking-wider">Pass</span>}
            </motion.div>
          ))}
        </motion.div>
      )}

      {stage === "done" && result && (
        <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-10 space-y-4">
          <div className="w-16 h-16 rounded-full bg-green-500/10 border border-green-500/30 flex items-center justify-center mx-auto shadow-[0_0_40px_rgba(74,222,128,0.15)]">
            <CheckCircle2 className="h-8 w-8 text-green-400" />
          </div>
          <h3 className="text-xl font-bold text-white">{result.updated + result.created} Products Synced</h3>
          <p className="text-sm text-slate-400 max-w-sm mx-auto">Your inventory is now live on Finder. Buyers in your area can discover your products in real time.</p>
          <div className="grid grid-cols-4 gap-3 max-w-md mx-auto mt-4">
            {[
              { label: "Updated", val: result.updated, color: "text-green-400" },
              { label: "Created", val: result.created, color: "text-blue-400" },
              { label: "Photos matched", val: result.imagesMatched, color: "text-cyan-400" },
              { label: "Errors", val: result.failed, color: result.failed ? "text-amber-400" : "text-slate-400" },
            ].map((s) => (
              <div key={s.label} className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-3 text-center">
                <div className={`text-lg font-bold tabular-nums ${s.color}`}>{s.val}</div>
                <div className="text-[9px] text-slate-600 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
          {result.errors.length > 0 && (
            <div className="max-w-md mx-auto text-left bg-white/[0.02] border border-white/[0.05] rounded-xl p-3 space-y-1 max-h-40 overflow-y-auto">
              {result.errors.slice(0, 20).map((e) => (
                <p key={e.sku} className="text-[11px] text-slate-400">
                  <span className="font-mono text-amber-400">{e.sku}</span> — {e.message}
                </p>
              ))}
            </div>
          )}
          <Button onClick={reset} variant="ghost" className="text-slate-400 hover:text-white text-sm">Import another file</Button>
        </motion.div>
      )}

      <div className="pt-4 border-t border-white/[0.06]">
        <ProductList />
      </div>
    </div>
  );
}
