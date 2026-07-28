import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { GraduationCap, TrendingUp, AlertTriangle, BarChart3 } from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-teal-950 to-slate-900 flex flex-col">
      <header className="px-6 py-5 flex items-center justify-between max-w-6xl mx-auto w-full">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-teal-600 rounded-lg flex items-center justify-center">
            <GraduationCap className="w-5 h-5 text-white" />
          </div>
          <span className="text-white font-bold text-lg font-display">Acadence</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/sign-in">
            <Button variant="ghost" className="text-slate-300 hover:text-white hover:bg-white/10">
              Sign In
            </Button>
          </Link>
          <Link href="/sign-up">
            <Button className="bg-teal-600 hover:bg-teal-700 text-white">
              Get Started
            </Button>
          </Link>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6 py-20 text-center max-w-5xl mx-auto w-full">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-teal-500/10 border border-teal-500/20 text-teal-400 text-sm font-medium mb-8">
          <TrendingUp className="w-3.5 h-3.5" />
          University Course Performance Tracker
        </div>

        <h1 className="text-5xl md:text-6xl font-display font-bold text-white mb-6 leading-tight">
          Track, Predict &amp;<br />
          <span className="text-teal-400">Improve</span> Grades
        </h1>

        <p className="text-xl text-slate-400 max-w-2xl mb-10 leading-relaxed">
          Monitor student performance, identify at-risk students before it's too late,
          and make data-driven decisions with AI-powered grade predictions.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 mb-20">
          <Link href="/sign-up">
            <Button size="lg" className="bg-teal-600 hover:bg-teal-700 text-white px-8 py-6 text-base">
              Start Tracking Free
            </Button>
          </Link>
          <Link href="/sign-in">
            <Button size="lg" variant="outline" className="border-slate-600 text-slate-300 hover:text-white hover:bg-white/5 hover:border-slate-400 px-8 py-6 text-base">
              Sign In
            </Button>
          </Link>
        </div>

        <div className="grid md:grid-cols-3 gap-6 w-full">
          {[
            {
              icon: BarChart3,
              title: 'Analytics Dashboard',
              description: 'Real-time grade distribution, pass rates, and semester performance trends at a glance.',
              color: 'text-teal-400',
              bg: 'bg-teal-500/10 border-teal-500/20',
            },
            {
              icon: AlertTriangle,
              title: 'At-Risk Detection',
              description: 'Automatically flag students who may fail before it\'s too late to intervene.',
              color: 'text-amber-400',
              bg: 'bg-amber-500/10 border-amber-500/20',
            },
            {
              icon: TrendingUp,
              title: 'Grade Prediction',
              description: 'ML-powered predictions for final grades based on current performance and assignment completion.',
              color: 'text-emerald-400',
              bg: 'bg-emerald-500/10 border-emerald-500/20',
            },
          ].map((feature) => (
            <div
              key={feature.title}
              className={`p-6 rounded-2xl border ${feature.bg} text-left`}
            >
              <feature.icon className={`w-8 h-8 ${feature.color} mb-4`} />
              <h3 className="text-white font-semibold text-lg mb-2">{feature.title}</h3>
              <p className="text-slate-400 text-sm leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </main>

      <footer className="px-6 py-6 text-center text-slate-500 text-sm">
        © 2026 Acadence. Academic performance made transparent.
      </footer>
    </div>
  );
}
