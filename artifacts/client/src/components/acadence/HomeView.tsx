import { useState } from 'react';
import {
  Edit, BookOpen, X, Plus, Trash2, ArrowRight,
  Binary, BarChart3, Blocks, BrainCircuit,
} from 'lucide-react';
import { useAcadence } from '@/context/AcadenceContext';
import { getGlobalStats, getEnrolledCount, getCourseStyle, getTimeOfDay } from '@/lib/acadence-utils';

interface HomeViewProps {
  onOpenCourse: (courseId: string) => void;
  profileName: string;
}

function CourseIcon({ courseId }: { courseId: string }) {
  const prefix = courseId.substring(0, 2).toLowerCase();
  if (prefix === 'cs') return <Binary className="w-4 h-4" />;
  if (prefix === 'ds') return <BarChart3 className="w-4 h-4" />;
  if (prefix === 'se') return <Blocks className="w-4 h-4" />;
  if (prefix === 'ai') return <BrainCircuit className="w-4 h-4" />;
  return <BookOpen className="w-4 h-4" />;
}

export function HomeView({ onOpenCourse, profileName }: HomeViewProps) {
  const { courseData, attendanceState, addCourse, deleteCourse, updateCourse, loading, error, refreshData } = useAcadence();

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 320, gap: 16 }}>
        <div style={{ width: 36, height: 36, borderRadius: '50%', border: '3px solid #0f766e', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
        <p style={{ color: '#64748b', fontSize: 14 }}>Loading courses…</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 320, gap: 12 }}>
        <p style={{ color: '#dc2626', fontSize: 14, fontWeight: 600 }}>Failed to load courses</p>
        <p style={{ color: '#64748b', fontSize: 13 }}>{error}</p>
        <button
          onClick={refreshData}
          style={{ padding: '8px 20px', background: '#0f766e', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
        >
          Retry
        </button>
      </div>
    );
  }
  const [managerOpen, setManagerOpen] = useState(false);
  const [newCourseId, setNewCourseId] = useState('');
  const [newCourseName, setNewCourseName] = useState('');
  const [newCourseInstructor, setNewCourseInstructor] = useState('');

  const stats = getGlobalStats(courseData, attendanceState);
  const timeOfDay = getTimeOfDay();
  const shortName = profileName.split(' ').pop() || profileName;

  const handleAddCourse = (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedId = newCourseId.trim().toLowerCase().replace(/\s/g, '');
    if (!normalizedId || courseData[normalizedId]) return;
    addCourse(normalizedId, { name: newCourseName.trim(), instructor: newCourseInstructor.trim() });
    setNewCourseId('');
    setNewCourseName('');
    setNewCourseInstructor('');
  };

  return (
    <>
      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-3xl mb-7 min-h-[230px] bg-slate-900">
        <img
          className="absolute inset-0 w-full h-full object-cover opacity-60"
          src="https://images.pexels.com/photos/5940844/pexels-photo-5940844.jpeg?auto=compress&cs=tinysrgb&w=1280"
          alt="Students studying together"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950/90 via-slate-900/60 to-transparent" />
        <div className="relative z-10 p-7 md:p-10 max-w-2xl text-white">
          <span
            className="inline-block px-3 py-1 rounded-full mb-4 font-bold text-[11px] tracking-widest uppercase"
            style={{ background: 'rgb(204,251,241)', color: 'rgb(15,118,110)' }}
          >
            INSTRUCTOR DASHBOARD
          </span>
          <h2 className="heading-font text-white font-bold leading-tight" style={{ fontSize: 34 }}>
            Good {timeOfDay}, {shortName}.
          </h2>
          <p className="mt-3 max-w-xl text-slate-200 text-base leading-relaxed">
            Choose a course below to manage its grades, review performance, or take attendance.
          </p>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        <div className="canva-card rounded-2xl p-4 border border-slate-200 bg-white">
          <p className="text-slate-500 text-xs">Active courses</p>
          <p className="text-2xl font-bold mt-1">{stats.totalCourses}</p>
        </div>
        <div className="canva-card rounded-2xl p-4 border border-slate-200 bg-white">
          <p className="text-slate-500 text-xs">Enrolled students</p>
          <p className="text-2xl font-bold mt-1">{stats.totalStudents}</p>
        </div>
        <div className="canva-card rounded-2xl p-4 border border-slate-200 bg-white">
          <p className="text-slate-500 text-xs">Avg. attendance</p>
          <p className="text-2xl font-bold text-teal-700 mt-1">{stats.avgAttendance}</p>
        </div>
        <div className="canva-card rounded-2xl p-4 border border-slate-200 bg-white">
          <p className="text-slate-500 text-xs">Grades pending</p>
          <p className="text-2xl font-bold text-amber-600 mt-1">{stats.pendingGrades}</p>
        </div>
      </div>

      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-4">
        <div>
          <h2 className="heading-font text-slate-900 font-bold" style={{ fontSize: 27 }}>Your Courses</h2>
          <p className="text-slate-500 text-sm mt-1">Each course has its own grade book and Attendance Report.</p>
        </div>
        <button
          type="button"
          onClick={() => setManagerOpen(true)}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-white border border-slate-200 hover:border-teal-500 hover:text-teal-700 rounded-xl transition-all font-semibold text-xs text-slate-700 self-start sm:self-auto"
        >
          <Edit className="w-3.5 h-3.5 text-teal-700" />
          Edit Courses
        </button>
      </div>

      {/* Course Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-h-[380px] overflow-y-auto pr-1">
        {Object.keys(courseData).map((courseId) => {
          const course = courseData[courseId];
          const style = getCourseStyle(courseId);
          const enrolledCount = getEnrolledCount(course);
          return (
            <button
              key={courseId}
              type="button"
              className="course-card text-left rounded-2xl border border-slate-200 bg-white p-3.5 w-full"
              onClick={() => onOpenCourse(courseId)}
              aria-label={`Open ${courseId.toUpperCase()} ${course.name || ''}`}
            >
              <div className="relative z-10 h-full flex flex-col justify-between">
                <div className="flex justify-between items-start gap-1.5">
                  <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${style.badgeBg} ${style.badgeText}`}>
                    {courseId.toUpperCase()}
                  </span>
                  <span className={`w-6 h-6 rounded-md ${style.iconBg} ${style.iconText} flex items-center justify-center shrink-0`}>
                    <CourseIcon courseId={courseId} />
                  </span>
                </div>
                <div className="mt-2 flex-1 flex flex-col justify-center min-w-0">
                  <h3 className="heading-font font-bold text-slate-900 text-sm md:text-base leading-tight line-clamp-2">
                    {course.name || courseId.toUpperCase()}
                  </h3>
                  <p className="text-[10px] md:text-xs text-slate-500 truncate mt-0.5">
                    {course.instructor || 'Staff'}
                  </p>
                </div>
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[9px] md:text-[10px] text-slate-600 font-medium">{enrolledCount} enrolled</span>
                  <span className="inline-flex items-center gap-0.5 font-bold text-teal-700 text-[10px]">
                    Open <ArrowRight className="w-2.5 h-2.5" />
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Course Manager Modal */}
      {managerOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[80] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-2xl w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-teal-700" /> Course Management
              </h3>
              <button type="button" onClick={() => setManagerOpen(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="max-h-[300px] overflow-y-auto space-y-3 pr-1">
              {Object.keys(courseData).map((courseId) => {
                const course = courseData[courseId];
                return (
                  <div key={courseId} className="flex flex-col sm:flex-row items-start sm:items-center gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                    <div className="w-16 font-mono font-bold text-xs text-slate-500 px-1 py-0.5 shrink-0">
                      {courseId.toUpperCase()}
                    </div>
                    <input
                      type="text"
                      defaultValue={course.name || ''}
                      className="flex-1 text-xs border border-slate-200 rounded-lg p-2 focus:outline-none focus:border-teal-600 focus:bg-white bg-white w-full"
                      placeholder="Course Name"
                      onChange={(e) => updateCourse(courseId, 'name', e.target.value)}
                    />
                    <input
                      type="text"
                      defaultValue={course.instructor || ''}
                      className="w-full sm:w-40 text-xs border border-slate-200 rounded-lg p-2 focus:outline-none focus:border-teal-600 focus:bg-white bg-white"
                      placeholder="Instructor"
                      onChange={(e) => updateCourse(courseId, 'instructor', e.target.value)}
                    />
                    <button
                      type="button"
                      className="text-slate-400 hover:text-red-500 p-2 rounded-lg transition-colors self-end sm:self-auto shrink-0 disabled:opacity-30"
                      onClick={() => deleteCourse(courseId)}
                      disabled={Object.keys(courseData).length <= 1}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
            <form onSubmit={handleAddCourse} className="border-t border-slate-100 pt-4 space-y-3">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Add New Course</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input
                  type="text" value={newCourseId} onChange={(e) => setNewCourseId(e.target.value)}
                  placeholder="e.g. CS101" required
                  className="text-xs border border-slate-200 rounded-lg p-2.5 focus:outline-none focus:border-teal-600"
                />
                <input
                  type="text" value={newCourseName} onChange={(e) => setNewCourseName(e.target.value)}
                  placeholder="Course Title" required
                  className="text-xs border border-slate-200 rounded-lg p-2.5 focus:outline-none focus:border-teal-600"
                />
                <input
                  type="text" value={newCourseInstructor} onChange={(e) => setNewCourseInstructor(e.target.value)}
                  placeholder="Instructor Name" required
                  className="text-xs border border-slate-200 rounded-lg p-2.5 focus:outline-none focus:border-teal-600"
                />
              </div>
              <button
                type="submit"
                className="w-full inline-flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-semibold bg-teal-700 hover:bg-teal-800 text-white transition-colors"
              >
                <Plus className="w-4 h-4" /> Add Course
              </button>
            </form>
            <div className="flex justify-end border-t border-slate-100 pt-3">
              <button
                type="button" onClick={() => setManagerOpen(false)}
                className="px-5 py-2 rounded-xl bg-teal-700 text-white font-semibold text-sm hover:bg-teal-800 transition-colors shadow-sm"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
