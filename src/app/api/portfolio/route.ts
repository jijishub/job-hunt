import { getSessionAccount } from '@/lib/session-account';
import { NextResponse } from 'next/server';

export interface PortfolioProfile {
  name: string;
  headline: string;
  bio: string;
  education: {
    school: string;
    major: string;
    honors: string;
    gpa: string;
    description: string;
  };
  skills: string[];
  targetRoles: string[];
  preferredLocations: string[];
  experienceHighlights: Array<{
    company: string;
    role: string;
    location: string;
  }>;
  projects: Array<{
    title: string;
    role: string;
    techStack: string;
  }>;
  portfolioUrl: string;
}

export async function GET() {
  const user = await getSessionAccount();
  if (!user) return NextResponse.json({ success: false, error: 'Sign in required.' }, { status: 401 });
  if (user.role !== 'admin') return NextResponse.json({ success: false, error: 'Admin access required.' }, { status: 403 });
  try {
    const res = await fetch('https://jizellecasia.vercel.app/api/content', {
      headers: { 'User-Agent': 'JobHuntTracker/1.0' },
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      throw new Error(`Portfolio API returned status ${res.status}`);
    }

    const json = await res.json();
    const data = json.data || {};
    const about = data.about || {};
    const education = about.education || {};
    const experience = data.experience || [];
    const projects = data.projects || [];

    const skillsText = about.skillsText || '';
    const rawSkills = Array.from(skillsText.matchAll(/<code>([^<]+)<\/code>/g)).map((m: any) => m[1]);
    
    // Also pull skills from skillCategories if available
    const categorySkills: string[] = [];
    if (Array.isArray(about.skillCategories)) {
      about.skillCategories.forEach((cat: any) => {
        if (Array.isArray(cat.skills)) {
          cat.skills.forEach((s: any) => {
            if (typeof s === 'string') categorySkills.push(s);
            else if (s?.name) categorySkills.push(s.name);
          });
        }
      });
    }

    const combinedSkills = Array.from(new Set([...rawSkills, ...categorySkills])).filter(Boolean);

    const skills = combinedSkills.length > 0 ? combinedSkills : [
      'TypeScript', 'JavaScript', 'Python', 'C#', 'SQL',
      'React', 'Next.js', 'Docker', 'Linux', 'Git', 'Tailwind CSS',
      'LLM Orchestration', 'OpenClaw', 'RAG', 'Playwright', 'PostgreSQL'
    ];

    const targetRoles = [
      'Forward-Deployed Engineer',
      'Full-Stack Developer',
      'AI & Automation Engineer',
      'React / Next.js Developer',
      'Software Engineer',
    ];

    const preferredLocations = [
      'Remote',
      'BGC, Taguig',
      'Makati',
      'Metro Manila',
      'Parañaque',
    ];

    const experienceHighlights = experience.map((exp: any) => ({
      company: exp.companyName,
      role: exp.roles?.[0]?.role || '',
      location: exp.location || '',
    }));

    const projectHighlights = projects.map((proj: any) => ({
      title: proj.title,
      role: proj.role,
      techStack: proj.techStack,
    }));

    const profile: PortfolioProfile = {
      name: 'Jizelle Casia',
      headline: 'Forward-Deployed Engineer & Full-Stack Developer',
      bio: about.description?.replace(/<[^>]*>?/gm, '') || 'Full-stack developer building agentic AI and enterprise apps.',
      education: {
        school: education.school?.trim() || 'Polytechnic University of the Philippines',
        major: education.major?.trim() || 'BS Information Technology',
        honors: education.honors?.trim() || 'Cum Laude',
        gpa: education.gpa?.trim() || '1.35',
        description: education.description?.trim() || '',
      },
      skills,
      targetRoles,
      preferredLocations,
      experienceHighlights,
      projects: projectHighlights,
      portfolioUrl: 'https://jizellecasia.vercel.app',
    };

    return NextResponse.json({ success: true, data: profile, profile });
  } catch (error: any) {
    console.warn('Portfolio remote fetch fallback active:', error?.message);

    const fallbackProfile: PortfolioProfile = {
      name: 'Jizelle Casia',
      headline: 'Forward-Deployed Engineer & Full-Stack Developer',
      bio: 'Forward-Deployed Engineer building agentic AI systems, enterprise dashboards, and full-stack applications.',
      education: {
        school: 'Polytechnic University of the Philippines - Parañaque City Campus',
        major: 'BS Information Technology',
        honors: 'Cum Laude',
        gpa: '1.35',
        description: "A.Y. 2022 - 2026 | President's Lister | Metro Pacific Tollways Scholar",
      },
      skills: [
        'TypeScript', 'JavaScript', 'Python', 'C#', 'SQL',
        'React', 'Next.js', 'Docker', 'Linux', 'Tailwind CSS',
        'LLM Orchestration', 'OpenClaw', 'RAG', 'Playwright', 'PostgreSQL'
      ],
      targetRoles: [
        'Forward-Deployed Engineer',
        'Full-Stack Developer',
        'AI & Automation Engineer',
        'React / Next.js Developer',
      ],
      preferredLocations: ['Remote', 'BGC, Taguig', 'Makati', 'Metro Manila'],
      experienceHighlights: [
        { company: 'GDS Capital', role: 'Forward-Deployed Engineer', location: 'Philippines / APAC' },
        { company: 'Sun Life Global Solutions', role: 'Core Systems Delivery Intern', location: 'BGC, Taguig' },
      ],
      projects: [
        { title: 'GDS OpenClaw Enterprise Control Center', role: 'Full-Stack Developer', techStack: 'Next.js, PostgreSQL, Docker, Ubuntu' },
        { title: 'Jizelle Casia Portfolio', role: 'Full-Stack Developer', techStack: 'React.js, Tailwind CSS, Turso' },
      ],
      portfolioUrl: 'https://jizellecasia.vercel.app',
    };

    return NextResponse.json({ success: true, data: fallbackProfile, profile: fallbackProfile });
  }
}
