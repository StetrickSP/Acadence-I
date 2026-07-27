import { useState, useRef, useCallback } from 'react';
import { AppShell } from '@/components/app-shell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useListCourses } from '@workspace/api-client-react';
import { Upload, Download, FileText, Plus, Trash2, AlertCircle, CheckCircle2, Info } from 'lucide-react';

const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, '');
const apiBase = `${BASE_URL}/api`;

// ─── Types ──────────────────────────────────────────────────────────────────

interface ImportResult {
  imported: number;
  updated: number;
  skipped: number;
  errors: { row: number; message: string }[];
}

interface BatchFileResult {
  filename: string;
  course_id: number;
  imported?: number;
  updated?: number;
  skipped?: number;
  errors?: { row: number; message: string }[];
  fatal_error?: string;
}

interface BatchRow {
  id: number;
  file: File | null;
  courseId: string;
}

// ─── CSV Format Hint ─────────────────────────────────────────────────────────

function CsvFormatHint() {
  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm">
      <div className="flex items-start gap-2">
        <Info className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
        <div>
          <p className="font-medium text-blue-800 mb-2">CSV Format</p>
          <p className="text-blue-700 mb-1">
            <span className="font-mono">Required columns:</span>{' '}
            <code className="bg-blue-100 px-1 rounded">student_id</code>,{' '}
            <code className="bg-blue-100 px-1 rounded">assignment_name</code>,{' '}
            <code className="bg-blue-100 px-1 rounded">score</code>
          </p>
          <p className="text-blue-700 mb-2">
            <span className="font-mono">Optional:</span>{' '}
            <code className="bg-blue-100 px-1 rounded">type</code>{' '}
            (midterm, final, assignment, quiz, homework, project, exam)
          </p>
          <p className="text-blue-600 text-xs font-mono">
            student_id,assignment_name,score,type<br />
            S001,Midterm Exam,85,midterm<br />
            S002,Assignment 1,90,assignment
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Import Result Panel ─────────────────────────────────────────────────────

function ImportResultPanel({ result }: { result: ImportResult }) {
  return (
    <div className="space-y-3 mt-4">
      <div className="flex gap-3 flex-wrap">
        <Badge variant="default" className="gap-1 bg-green-600 hover:bg-green-600">
          <CheckCircle2 className="w-3 h-3" />
          {result.imported} imported
        </Badge>
        <Badge variant="secondary" className="gap-1">
          {result.updated} updated
        </Badge>
        <Badge variant="outline" className="gap-1">
          {result.skipped} skipped
        </Badge>
        {result.errors.length > 0 && (
          <Badge variant="destructive" className="gap-1">
            <AlertCircle className="w-3 h-3" />
            {result.errors.length} error{result.errors.length !== 1 ? 's' : ''}
          </Badge>
        )}
      </div>

      {result.errors.length > 0 && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3">
          <p className="text-sm font-medium text-destructive mb-2">Row errors</p>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {result.errors.map((e, i) => (
              <div key={i} className="text-xs font-mono text-destructive/90">
                Row {e.row}: {e.message}
              </div>
            ))}
          </div>
        </div>
      )}

      {result.errors.length === 0 && (
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle2 className="w-4 h-4 text-green-600" />
          <AlertDescription className="text-green-700">
            All rows processed successfully.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

// ─── Single Import Tab ───────────────────────────────────────────────────────

function ImportTab({ courses }: { courses: { id: number; code: string; name: string }[] }) {
  const [file, setFile] = useState<File | null>(null);
  const [courseId, setCourseId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (f: File | null) => {
    setFile(f);
    setResult(null);
    setError(null);
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, []);

  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setDragging(true); };
  const onDragLeave = () => setDragging(false);

  const submit = async () => {
    if (!file || !courseId) return;
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('course_id', courseId);
      const res = await fetch(`${apiBase}/import/grades`, {
        method: 'POST',
        body: fd,
        credentials: 'include',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.detail ?? `Server error: ${res.status}`);
      }
      const data = await res.json();
      setResult(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      <CsvFormatHint />

      {/* Drop zone */}
      <div
        className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
          dragging
            ? 'border-primary bg-primary/5'
            : 'border-border hover:border-primary/50 hover:bg-muted/30'
        }`}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
        />
        <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
        {file ? (
          <div>
            <p className="font-medium text-foreground">{file.name}</p>
            <p className="text-sm text-muted-foreground mt-1">{(file.size / 1024).toFixed(1)} KB</p>
          </div>
        ) : (
          <div>
            <p className="font-medium text-foreground">Drop a CSV file here</p>
            <p className="text-sm text-muted-foreground mt-1">or click to browse</p>
          </div>
        )}
      </div>

      {/* Course selector */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-foreground">Course</label>
        <Select value={courseId} onValueChange={setCourseId}>
          <SelectTrigger>
            <SelectValue placeholder="Select a course…" />
          </SelectTrigger>
          <SelectContent>
            {courses.map((c) => (
              <SelectItem key={c.id} value={String(c.id)}>
                {c.code} — {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Button
        onClick={submit}
        disabled={!file || !courseId || loading}
        className="w-full sm:w-auto"
      >
        {loading ? 'Importing…' : 'Import Grades'}
      </Button>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="w-4 h-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {result && <ImportResultPanel result={result} />}
    </div>
  );
}

// ─── Batch Import Tab ────────────────────────────────────────────────────────

function BatchImportTab({ courses }: { courses: { id: number; code: string; name: string }[] }) {
  const [rows, setRows] = useState<BatchRow[]>([{ id: 1, file: null, courseId: '' }]);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<BatchFileResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const nextId = useRef(2);
  const fileRefs = useRef<Record<number, HTMLInputElement | null>>({});

  const addRow = () => {
    setRows((r) => [...r, { id: nextId.current++, file: null, courseId: '' }]);
  };

  const removeRow = (id: number) => {
    setRows((r) => r.filter((row) => row.id !== id));
  };

  const setRowFile = (id: number, file: File | null) => {
    setRows((r) => r.map((row) => (row.id === id ? { ...row, file } : row)));
  };

  const setRowCourse = (id: number, courseId: string) => {
    setRows((r) => r.map((row) => (row.id === id ? { ...row, courseId } : row)));
  };

  const submit = async () => {
    const valid = rows.filter((r) => r.file && r.courseId);
    if (valid.length === 0) return;
    setLoading(true);
    setResults(null);
    setError(null);

    try {
      const fd = new FormData();
      const courseIds = valid.map((r) => r.courseId).join(',');
      fd.append('course_ids', courseIds);
      for (const row of valid) {
        fd.append('files', row.file!);
      }
      const res = await fetch(`${apiBase}/import/batch`, {
        method: 'POST',
        body: fd,
        credentials: 'include',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.detail ?? `Server error: ${res.status}`);
      }
      const data = await res.json();
      setResults(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Batch upload failed');
    } finally {
      setLoading(false);
    }
  };

  const readyCount = rows.filter((r) => r.file && r.courseId).length;

  return (
    <div className="space-y-5">
      <CsvFormatHint />

      <div className="space-y-3">
        {rows.map((row, idx) => (
          <div key={row.id} className="flex gap-3 items-center flex-wrap sm:flex-nowrap">
            <span className="text-sm text-muted-foreground w-6 shrink-0">#{idx + 1}</span>

            {/* File picker */}
            <div
              className="flex-1 min-w-0 border rounded-md px-3 py-2 text-sm cursor-pointer hover:bg-muted/30 transition-colors flex items-center gap-2"
              onClick={() => fileRefs.current[row.id]?.click()}
            >
              <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className={row.file ? 'text-foreground truncate' : 'text-muted-foreground'}>
                {row.file ? row.file.name : 'Click to choose CSV…'}
              </span>
              <input
                ref={(el) => { fileRefs.current[row.id] = el; }}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => setRowFile(row.id, e.target.files?.[0] ?? null)}
              />
            </div>

            {/* Course selector */}
            <div className="w-52 shrink-0">
              <Select value={row.courseId} onValueChange={(v) => setRowCourse(row.id, v)}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select course…" />
                </SelectTrigger>
                <SelectContent>
                  {courses.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.code} — {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Remove row */}
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0 text-muted-foreground hover:text-destructive"
              onClick={() => removeRow(row.id)}
              disabled={rows.length === 1}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        ))}
      </div>

      <div className="flex gap-3 flex-wrap">
        <Button variant="outline" size="sm" onClick={addRow} className="gap-2">
          <Plus className="w-4 h-4" />
          Add file
        </Button>
        <Button
          onClick={submit}
          disabled={readyCount === 0 || loading}
          className="gap-2"
        >
          <Upload className="w-4 h-4" />
          {loading ? 'Importing…' : `Import ${readyCount} file${readyCount !== 1 ? 's' : ''}`}
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="w-4 h-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {results && (
        <div className="rounded-md border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="text-left px-4 py-2.5 text-muted-foreground font-medium">File</th>
                <th className="text-right px-4 py-2.5 text-muted-foreground font-medium">Imported</th>
                <th className="text-right px-4 py-2.5 text-muted-foreground font-medium">Updated</th>
                <th className="text-right px-4 py-2.5 text-muted-foreground font-medium">Skipped</th>
                <th className="text-right px-4 py-2.5 text-muted-foreground font-medium">Errors</th>
                <th className="text-center px-4 py-2.5 text-muted-foreground font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {results.map((r, i) => (
                <tr key={i} className="hover:bg-muted/20">
                  <td className="px-4 py-3 font-medium truncate max-w-[200px]">{r.filename}</td>
                  {r.fatal_error ? (
                    <>
                      <td colSpan={4} className="px-4 py-3 text-destructive text-sm">{r.fatal_error}</td>
                      <td className="px-4 py-3 text-center">
                        <Badge variant="destructive" className="gap-1">
                          <AlertCircle className="w-3 h-3" /> Failed
                        </Badge>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-4 py-3 text-right font-mono">{r.imported ?? 0}</td>
                      <td className="px-4 py-3 text-right font-mono">{r.updated ?? 0}</td>
                      <td className="px-4 py-3 text-right font-mono">{r.skipped ?? 0}</td>
                      <td className="px-4 py-3 text-right font-mono text-destructive">{r.errors?.length ?? 0}</td>
                      <td className="px-4 py-3 text-center">
                        {(r.errors?.length ?? 0) === 0 ? (
                          <Badge className="gap-1 bg-green-600 hover:bg-green-600">
                            <CheckCircle2 className="w-3 h-3" /> OK
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="gap-1">
                            <AlertCircle className="w-3 h-3" /> Errors
                          </Badge>
                        )}
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Export Tab ──────────────────────────────────────────────────────────────

function ExportTab({ courses }: { courses: { id: number; code: string; name: string }[] }) {
  const [courseId, setCourseId] = useState<string>('all');
  const [downloadingCsv, setDownloadingCsv] = useState(false);
  const [downloadingJson, setDownloadingJson] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const triggerDownload = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

  const downloadCsv = async () => {
    setDownloadingCsv(true);
    setError(null);
    try {
      const url = courseId && courseId !== 'all'
        ? `${apiBase}/export/grades?course_id=${courseId}`
        : `${apiBase}/export/grades`;
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const blob = await res.blob();
      const filename = courseId && courseId !== 'all'
        ? `grades_course_${courseId}.csv`
        : 'grades_all.csv';
      triggerDownload(blob, filename);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Download failed');
    } finally {
      setDownloadingCsv(false);
    }
  };

  const downloadJson = async () => {
    if (!courseId || courseId === 'all') return;
    setDownloadingJson(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/export/report?course_id=${courseId}`, {
        credentials: 'include',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.detail ?? `Server error: ${res.status}`);
      }
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      triggerDownload(blob, `report_course_${courseId}.json`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Download failed');
    } finally {
      setDownloadingJson(false);
    }
  };

  const selectedCourseName = courses.find((c) => String(c.id) === courseId)
    ? courses.find((c) => String(c.id) === courseId)!.code
    : null;

  return (
    <div className="space-y-6">
      {/* Course selector */}
      <div className="space-y-1.5 max-w-sm">
        <label className="text-sm font-medium text-foreground">Course</label>
        <Select value={courseId} onValueChange={setCourseId}>
          <SelectTrigger>
            <SelectValue placeholder="All Courses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Courses</SelectItem>
            {courses.map((c) => (
              <SelectItem key={c.id} value={String(c.id)}>
                {c.code} — {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Download buttons */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="border-dashed">
          <CardContent className="pt-6 flex flex-col items-center text-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center">
              <Download className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="font-medium text-foreground">Grades CSV</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {courseId && courseId !== 'all' && selectedCourseName
                  ? `${selectedCourseName} grades spreadsheet`
                  : 'All grades across all courses'}
              </p>
            </div>
            <Button
              onClick={downloadCsv}
              disabled={downloadingCsv}
              className="w-full gap-2"
              variant="outline"
            >
              <Download className="w-4 h-4" />
              {downloadingCsv ? 'Downloading…' : 'Download grades CSV'}
            </Button>
          </CardContent>
        </Card>

        <Card className={`border-dashed ${(!courseId || courseId === 'all') ? 'opacity-60' : ''}`}>
          <CardContent className="pt-6 flex flex-col items-center text-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
              <FileText className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="font-medium text-foreground">JSON Report</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {courseId && courseId !== 'all' && selectedCourseName
                  ? `Full ${selectedCourseName} report with stats`
                  : 'Select a specific course to generate a report'}
              </p>
            </div>
            <Button
              onClick={downloadJson}
              disabled={downloadingJson || !courseId || courseId === 'all'}
              className="w-full gap-2"
              variant="outline"
            >
              <Download className="w-4 h-4" />
              {downloadingJson ? 'Downloading…' : 'Download JSON report'}
            </Button>
          </CardContent>
        </Card>
      </div>

      {(!courseId || courseId === 'all') && (
        <Alert>
          <Info className="w-4 h-4" />
          <AlertDescription>
            The JSON report requires a specific course to be selected. The CSV export works for all courses or a single course.
          </AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="w-4 h-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function ImportExport() {
  const { data: courses = [] } = useListCourses({});

  return (
    <AppShell>
      <div className="p-6 lg:p-8 space-y-6">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground mb-2">Import / Export</h1>
          <p className="text-muted-foreground">Upload grade files or download reports</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-display">Grade Data</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="import">
              <TabsList className="mb-6">
                <TabsTrigger value="import" className="gap-2">
                  <Upload className="w-4 h-4" />
                  Import
                </TabsTrigger>
                <TabsTrigger value="batch" className="gap-2">
                  <Upload className="w-4 h-4" />
                  Batch Import
                </TabsTrigger>
                <TabsTrigger value="export" className="gap-2">
                  <Download className="w-4 h-4" />
                  Export
                </TabsTrigger>
              </TabsList>

              <TabsContent value="import">
                <ImportTab courses={courses} />
              </TabsContent>

              <TabsContent value="batch">
                <BatchImportTab courses={courses} />
              </TabsContent>

              <TabsContent value="export">
                <ExportTab courses={courses} />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
