"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, BookOpen, Brain, ChartBar, GraduationCap, Shield, Users } from "lucide-react";
import { motion } from "framer-motion";

const features = [
  {
    icon: Users,
    title: "Student Management",
    description: "Comprehensive student profiles with attendance, results, fees, and medical records.",
  },
  {
    icon: BookOpen,
    title: "Academic Management",
    description: "Classes, subjects, examinations, and automated report cards generation.",
  },
  {
    icon: Brain,
    title: "AI-Powered Tools",
    description: "Auto-generate report comments, lesson plans, and student performance analysis.",
  },
  {
    icon: ChartBar,
    title: "Analytics & Reports",
    description: "Real-time dashboards with attendance trends, financial overview, and academic performance.",
  },
  {
    icon: Shield,
    title: "Role-Based Access",
    description: "Secure portals for admins, teachers, parents, and students with granular permissions.",
  },
  {
    icon: GraduationCap,
    title: "Parent & Student Portals",
    description: "Parents monitor progress, students access learning materials and homework help.",
  },
];

const stats = [
  { label: "Students Managed", value: "10,000+" },
  { label: "Schools Using EduFlow", value: "500+" },
  { label: "AI Reports Generated", value: "50,000+" },
  { label: "Teacher Hours Saved", value: "100,000+" },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                <GraduationCap className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="text-xl font-bold">EduFlow</span>
            </Link>
            <div className="flex items-center gap-4">
              <Link href="/login">
                <Button variant="ghost">Sign In</Button>
              </Link>
              <Link href="/register">
                <Button variant="gradient">Get Started</Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-blue-50 via-transparent to-transparent dark:from-blue-950/20" />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <div className="inline-flex items-center rounded-full border bg-muted/50 px-4 py-1.5 text-sm mb-6">
                <span className="text-primary font-medium">🚀 Now in Early Access</span>
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-6">
                The AI-Powered{" "}
                <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                  School Operating System
                </span>
              </h1>
              <p className="text-lg sm:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto leading-relaxed">
                EduFlow digitizes every aspect of school management — from attendance and results to 
                AI-generated report comments and lesson plans. Save hundreds of hours and make 
                data-driven decisions.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link href="/register">
                  <Button size="lg" variant="gradient" className="text-base">
                    Start Free Trial <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
                <Link href="#features">
                  <Button size="lg" variant="outline" className="text-base">
                    Learn More
                  </Button>
                </Link>
              </div>
            </motion.div>
          </div>

          {/* Dashboard Preview */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.3 }}
            className="mt-16 relative"
          >
            <div className="relative mx-auto max-w-5xl">
              <div className="rounded-2xl border border-border/50 bg-gradient-to-b from-card to-muted/50 shadow-2xl p-2">
                <div className="rounded-xl bg-background p-6">
                  <div className="grid grid-cols-4 gap-4 mb-6">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="h-20 rounded-lg bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 p-3">
                        <div className="h-2 w-16 rounded bg-muted-foreground/20 mb-2" />
                        <div className="h-4 w-12 rounded bg-primary/20" />
                      </div>
                    ))}
                  </div>
                  <div className="h-40 rounded-lg bg-muted/30" />
                </div>
              </div>
              <div className="absolute -bottom-4 -right-4 -z-10 h-full w-full rounded-2xl bg-gradient-to-r from-blue-600/20 to-indigo-600/20 blur-2xl" />
            </div>
          </motion.div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 border-y border-border/40">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-3xl font-bold text-primary mb-1">{stat.value}</div>
                <div className="text-sm text-muted-foreground">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Everything You Need to Run a School</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              From classroom management to AI-powered insights — EduFlow has it all.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.title}
                  className="group rounded-xl border bg-card p-6 hover:shadow-md transition-all hover:border-primary/50"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary mb-4 group-hover:scale-110 transition-transform">
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="font-semibold mb-2">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 gradient-blue">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Ready to Transform Your School?
          </h2>
          <p className="text-blue-100 mb-8 max-w-xl mx-auto">
            Join hundreds of schools already using EduFlow to manage their operations 
            and empower their teachers with AI.
          </p>
          <Link href="/register">
            <Button size="lg" variant="secondary" className="bg-white text-primary hover:bg-blue-50 text-base">
              Get Started Free <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} EduFlow. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
