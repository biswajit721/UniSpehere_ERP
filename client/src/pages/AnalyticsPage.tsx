import { Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api } from "../services/api";
import { useAuthStore } from "../store/authStore";
import { useChartTheme } from "../utils/useChartTheme";

interface SubjectPerf {
  subject: string;
  averagePercentage: number;
}
interface TrendPoint {
  examTitle: string;
  subject: string;
  date: string;
  percentage: number;
}
interface AttendancePoint {
  month: string;
  percentage: number;
}

export function AnalyticsPage() {
  const role = useAuthStore((s) => s.user?.role);
  if (role !== "STUDENT") {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-text-primary dark:text-text-dark-primary">Analytics</h1>
          <p className="text-sm text-text-secondary mt-1">Performance analytics are currently available for students viewing their own data.</p>
        </div>
      </div>
    );
  }
  return <StudentAnalytics />;
}

function StudentAnalytics() {
  const chart = useChartTheme();
  const tip = { background: chart.tooltipBg, border: `1px solid ${chart.tooltipBorder}`, borderRadius: 10, color: chart.ink };
  const [studentId, setStudentId] = useState("");
  const [subjectPerf, setSubjectPerf] = useState<SubjectPerf[]>([]);
  const [careerTrend, setCareerTrend] = useState<TrendPoint[]>([]);
  const [attendanceTrend, setAttendanceTrend] = useState<AttendancePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [tips, setTips] = useState<string | null>(null);
  const [tipsAiPowered, setTipsAiPowered] = useState(false);
  const [tipsLoading, setTipsLoading] = useState(false);

  useEffect(() => {
    api.get("/students/me").then(async ({ data }) => {
      const id = data.student.id;
      setStudentId(id);
      const [perf, career, attendance] = await Promise.all([
        api.get(`/insights/student/${id}/performance`),
        api.get(`/insights/student/${id}/career-trend`),
        api.get(`/insights/student/${id}/attendance-trend`),
      ]);
      setSubjectPerf(perf.data.performance);
      setCareerTrend(career.data.trend);
      setAttendanceTrend(attendance.data.trend);
      setLoading(false);
    });
  }, []);

  const loadTips = async () => {
    setTipsLoading(true);
    try {
      const { data } = await api.get(`/insights/student/${studentId}/tips`);
      setTips(data.tips);
      setTipsAiPowered(data.aiPowered);
    } finally {
      setTipsLoading(false);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-text-primary dark:text-text-dark-primary">My Performance</h1>
        <p className="text-sm text-text-secondary mt-1">Real analytics from your attendance and exam records.</p>
      </div>

      {loading ? (
        <p className="text-text-secondary text-sm">Loading...</p>
      ) : (
        <div className="space-y-6">
          <div className="card p-5">
            <h2 className="text-sm font-semibold text-text-primary dark:text-text-dark-primary mb-4">Average score by subject</h2>
            {subjectPerf.length === 0 ? (
              <p className="text-sm text-text-secondary">No published results yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={subjectPerf}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} />
                  <XAxis dataKey="subject" tick={{ fontSize: 12, fill: chart.text }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: chart.text }} />
                  <Tooltip contentStyle={tip} labelStyle={{ color: chart.ink, fontWeight: 600 }} formatter={(v: number) => `${v}%`} />
                  <Bar dataKey="averagePercentage" fill={chart.primary} radius={[6, 6, 0, 0]} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="card p-5">
            <h2 className="text-sm font-semibold text-text-primary dark:text-text-dark-primary mb-4">Career trend (exam performance over time)</h2>
            {careerTrend.length === 0 ? (
              <p className="text-sm text-text-secondary">No published results yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={careerTrend.map((t) => ({ ...t, label: new Date(t.date).toLocaleDateString() }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: chart.text }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: chart.text }} />
                  <Tooltip contentStyle={tip} labelStyle={{ color: chart.ink, fontWeight: 600 }} formatter={(v: number, _n, p: any) => [`${v}%`, p.payload.examTitle]} />
                  <Line type="monotone" dataKey="percentage" stroke={chart.success} strokeWidth={2} dot={{ r: 4 }} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="card p-5">
            <h2 className="text-sm font-semibold text-text-primary dark:text-text-dark-primary mb-4">Attendance trend by month</h2>
            {attendanceTrend.length === 0 ? (
              <p className="text-sm text-text-secondary">No attendance recorded yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={attendanceTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} />
                  <XAxis dataKey="month" tick={{ fontSize: 12, fill: chart.text }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: chart.text }} />
                  <Tooltip contentStyle={tip} labelStyle={{ color: chart.ink, fontWeight: 600 }} formatter={(v: number) => `${v}%`} />
                  <Bar dataKey="percentage" fill={chart.success} radius={[6, 6, 0, 0]} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-text-primary dark:text-text-dark-primary flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-primary" />
                Performance tips
              </h2>
              <button onClick={loadTips} disabled={tipsLoading} className="text-xs font-medium text-primary">
                {tipsLoading ? "Generating..." : tips ? "Regenerate" : "Get tips"}
              </button>
            </div>
            {tips ? (
              <>
                <p className="text-sm text-text-secondary whitespace-pre-wrap">{tips}</p>
                <p className="text-xs text-text-secondary mt-3">
                  {tipsAiPowered ? "Generated by AI based on your real performance data." : "Rule-based tip (AI unavailable right now)."}
                </p>
              </>
            ) : (
              <p className="text-sm text-text-secondary">Click "Get tips" for personalized suggestions based on your actual grades and attendance.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
