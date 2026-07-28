import { useState } from 'react';
import { AppShell } from '@/components/app-shell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { GradeBadge } from '@/components/grade-badge';
import { RiskBadge } from '@/components/risk-badge';
import { Link } from 'wouter';
import {
  usePredictGrade, usePredictAtRisk, useListCourses, useListStudents,
} from '@workspace/api-client-react';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, AlertTriangle, Zap } from 'lucide-react';

export default function Predictions() {
  const [selectedCourse, setSelectedCourse] = useState<string>('');
  const [predictStudentId, setPredictStudentId] = useState<string>('');
  const [predictCourseId, setPredictCourseId] = useState<string>('');
  const [midtermScore, setMidtermScore] = useState<string>('');
  const [predictResult, setPredictResult] = useState<{
    predicted_score: number;
    predicted_letter: string;
    confidence: number;
    risk_level: string;
    factors: { factor: string; weight: number; value: number }[];
  } | null>(null);
  const [predicting, setPredicting] = useState(false);

  const { data: courses } = useListCourses({});
  const { data: students } = useListStudents({});
  const predCourseId = selectedCourse ? Number(selectedCourse) : (courses?.[0]?.id ?? 0);
  const { data: atRiskPredictions, isLoading: atRiskLoading } = usePredictAtRisk(predCourseId);

  const predictGrade = usePredictGrade();

  const runPrediction = () => {
    if (!predictStudentId || !predictCourseId) return;
    setPredicting(true);
    predictGrade.mutate(
      {
        data: {
          student_id: Number(predictStudentId),
          course_id: Number(predictCourseId),
          midterm_score: midtermScore ? Number(midtermScore) : undefined,
        },
      },
      {
        onSuccess: (data) => {
          setPredictResult(data as typeof predictResult);
          setPredicting(false);
        },
        onError: () => setPredicting(false),
      },
    );
  };

  return (
    <AppShell>
      <div className="p-6 lg:p-8 space-y-8">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground mb-2">Predictions</h1>
          <p className="text-muted-foreground">AI-powered grade forecasting and risk assessment</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Individual Grade Predictor */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-display flex items-center gap-2">
                <Zap className="w-5 h-5 text-amber-500" />
                Individual Grade Predictor
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Student</Label>
                <Select value={predictStudentId} onValueChange={setPredictStudentId}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue placeholder="Select student" />
                  </SelectTrigger>
                  <SelectContent>
                    {students?.map((s) => (
                      <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Course</Label>
                <Select value={predictCourseId} onValueChange={setPredictCourseId}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue placeholder="Select course" />
                  </SelectTrigger>
                  <SelectContent>
                    {courses?.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>{c.code} — {c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Midterm Score Override (Optional)</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  placeholder="Leave empty to use actual grade"
                  value={midtermScore}
                  onChange={(e) => setMidtermScore(e.target.value)}
                  className="mt-1.5"
                />
              </div>
              <Button
                className="w-full"
                onClick={runPrediction}
                disabled={!predictStudentId || !predictCourseId || predicting}
                data-testid="button-run-prediction"
              >
                {predicting ? 'Predicting...' : 'Run Prediction'}
              </Button>

              {predictResult && (
                <div className="mt-4 p-4 rounded-xl border border-border bg-muted/30 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Predicted Final Grade</p>
                      <p className="text-4xl font-mono font-bold text-primary">{predictResult.predicted_score.toFixed(1)}%</p>
                    </div>
                    <div className="text-right space-y-2">
                      <GradeBadge letter={predictResult.predicted_letter} size="lg" />
                      <div><RiskBadge level={predictResult.risk_level} /></div>
                      <p className="text-xs text-muted-foreground">{predictResult.confidence}% confidence</p>
                    </div>
                  </div>

                  <div>
                    <p className="text-sm font-medium text-foreground mb-3">Prediction Factors</p>
                    <div className="space-y-3">
                      {predictResult.factors.map((f) => (
                        <div key={f.factor} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-foreground">{f.factor}</span>
                            <span className="text-muted-foreground font-mono">{f.value.toFixed(1)}% (weight: {(f.weight * 100).toFixed(0)}%)</span>
                          </div>
                          <div className="w-full bg-muted rounded-full h-1.5">
                            <div
                              className="bg-primary h-1.5 rounded-full transition-all"
                              style={{ width: `${Math.min(100, f.value)}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Course-level At-Risk Prediction */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-display flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-500" />
                Course At-Risk Forecast
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                <Select value={selectedCourse} onValueChange={setSelectedCourse}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a course" />
                  </SelectTrigger>
                  <SelectContent>
                    {courses?.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>{c.code} — {c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {atRiskLoading ? (
                <div className="space-y-3">
                  {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-14" />)}
                </div>
              ) : atRiskPredictions && atRiskPredictions.length > 0 ? (
                <div className="space-y-3 max-h-[400px] overflow-y-auto">
                  {atRiskPredictions.map((p) => (
                    <Link key={p.student_id} href={`/students/${p.student_id}`}>
                      <div className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors cursor-pointer">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{p.student_name}</p>
                          <p className="text-xs text-muted-foreground">
                            Current: {p.current_score?.toFixed(1) ?? 'N/A'}% → Predicted: {p.predicted_score.toFixed(1)}%
                          </p>
                        </div>
                        <div className="flex items-center gap-2 ml-2 shrink-0">
                          <GradeBadge letter={p.predicted_letter} size="sm" />
                          <RiskBadge level={p.risk_level} />
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-center py-10">
                  <TrendingUp className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground text-sm">
                    {selectedCourse ? 'No predictions available yet — add more grade data.' : 'Select a course to view predictions'}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
