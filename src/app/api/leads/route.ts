import { getSessionAccount } from '@/lib/session-account';
import { NextResponse } from 'next/server';

export interface TargetedLead {
  id: string;
  title: string;
  company_name: string;
  company_logo: string;
  url: string;
  location: string;
  remote: boolean;
  tags: string[];
  matched_skills: string[];
  match_score: number;
  source: 'LinkedIn' | 'JobStreet' | 'Indeed' | 'Google Search';
  source_priority: 'HIGH' | 'MEDIUM' | 'LOW';
  salary_range?: string;
  job_types: string[];
  description: string;
}

const TARGETED_LEADS: TargetedLead[] = [
  // --- LINKEDIN (High Priority) ---
  {
    id: 'lead-canva-fe',
    title: 'Frontend Engineer - Web Experience (React / Next.js)',
    company_name: 'Canva',
    company_logo: 'https://www.google.com/s2/favicons?domain=canva.com&sz=128',
    url: 'https://www.canva.com/careers/jobs/?location=Philippines',
    location: 'BGC, Taguig / Hybrid',
    remote: false,
    tags: ['React', 'TypeScript', 'Next.js', 'Tailwind CSS', 'Figma'],
    matched_skills: ['React', 'TypeScript', 'Next.js', 'Figma', 'Tailwind CSS'],
    match_score: 98,
    source: 'LinkedIn',
    source_priority: 'HIGH',
    salary_range: '₱65,000 - ₱95,000 / mo',
    job_types: ['Full-Time'],
    description: 'Build responsive web experiences and reusable UI components. Work closely with product design to turn Figma specs into polished, accessible micro-interactions.',
  },
  {
    id: 'lead-thinkingmachines-ai',
    title: 'AI & Data Applications Engineer (Junior/Associate)',
    company_name: 'Thinking Machines Data Science',
    company_logo: 'https://www.google.com/s2/favicons?domain=thinkingmachin.es&sz=128',
    url: 'https://thinkingmachin.es/careers/',
    location: 'BGC, Taguig / Remote',
    remote: true,
    tags: ['Python', 'FastAPI', 'RAG', 'PostgreSQL', 'React'],
    matched_skills: ['Python', 'FastAPI', 'RAG', 'PostgreSQL', 'React'],
    match_score: 96,
    source: 'LinkedIn',
    source_priority: 'HIGH',
    salary_range: '₱55,000 - ₱80,000 / mo',
    job_types: ['Full-Time'],
    description: 'Develop data platforms and generative AI web tooling for enterprise clients across Southeast Asia using modern Python and React.',
  },
  {
    id: 'lead-supabase-cloud',
    title: 'Full-Stack Developer (PostgreSQL & TypeScript)',
    company_name: 'Supabase Ecosystem',
    company_logo: 'https://www.google.com/s2/favicons?domain=supabase.com&sz=128',
    url: 'https://supabase.com/careers',
    location: 'Remote (Anywhere)',
    remote: true,
    tags: ['PostgreSQL', 'TypeScript', 'React', 'APIs'],
    matched_skills: ['PostgreSQL', 'TypeScript', 'React', 'APIs'],
    match_score: 92,
    source: 'LinkedIn',
    source_priority: 'HIGH',
    salary_range: '$2,800 - $4,200 / mo',
    job_types: ['Full-Time', 'Remote'],
    description: 'Build database dashboards and developer interfaces with PostgreSQL, serverless functions, and real-time state management.',
  },

  // --- JOBSTREET (High Priority) ---
  {
    id: 'lead-sunlife-core',
    title: 'Associate Software Delivery Engineer (Core Systems)',
    company_name: 'Sun Life Global Solutions',
    company_logo: 'https://www.google.com/s2/favicons?domain=sunlife.com&sz=128',
    url: 'https://www.sunlife.com/en/careers/',
    location: 'BGC, Taguig',
    remote: false,
    tags: ['TypeScript', 'APIs', 'SAFe Agile', 'PostgreSQL', 'Cloud'],
    matched_skills: ['TypeScript', 'APIs', 'PostgreSQL', 'Git'],
    match_score: 95,
    source: 'JobStreet',
    source_priority: 'HIGH',
    salary_range: '₱50,000 - ₱70,000 / mo',
    job_types: ['Full-Time', 'Associate'],
    description: 'Core systems modernization and cloud delivery. Participate in Agile sprint planning, API integrations, and developer performance telemetry across APAC.',
  },
  {
    id: 'lead-maya-fullstack',
    title: 'Full-Stack Software Engineer (React / TypeScript)',
    company_name: 'Maya (PayMaya)',
    company_logo: 'https://www.google.com/s2/favicons?domain=maya.ph&sz=128',
    url: 'https://www.maya.ph/careers',
    location: 'Mandaluyong / Hybrid',
    remote: false,
    tags: ['React', 'TypeScript', 'Docker', 'PostgreSQL', 'Node.js'],
    matched_skills: ['React', 'TypeScript', 'Docker', 'PostgreSQL'],
    match_score: 93,
    source: 'JobStreet',
    source_priority: 'HIGH',
    salary_range: '₱60,000 - ₱85,000 / mo',
    job_types: ['Full-Time'],
    description: 'Power digital banking applications for millions of Filipinos. Build resilient transactional dashboards and customer portal features.',
  },
  {
    id: 'lead-ekonek-qa-dev',
    title: 'Quality Assurance & Systems Developer',
    company_name: 'E-Konek Solutions',
    company_logo: 'https://www.google.com/s2/favicons?domain=ekoneksolutions.com&sz=128',
    url: 'https://www.ekoneksolutions.com/',
    location: 'Parqal, Parañaque City',
    remote: false,
    tags: ['QA', 'Playwright', 'Web Systems', 'SQL'],
    matched_skills: ['Playwright', 'SQL', 'Git'],
    match_score: 89,
    source: 'JobStreet',
    source_priority: 'HIGH',
    salary_range: '₱40,000 - ₱55,000 / mo',
    job_types: ['Full-Time'],
    description: 'System verification, Playwright end-to-end automation, and web development for logistics and enterprise compliance portals right in Parqal.',
  },

  // --- INDEED (High Priority) ---
  {
    id: 'lead-moatable-saas',
    title: 'Frontend / Fullstack Developer',
    company_name: 'Moatable',
    company_logo: 'https://www.google.com/s2/favicons?domain=moatable.com&sz=128',
    url: 'https://www.moatable.com/careers',
    location: 'Makati, Metro Manila',
    remote: false,
    tags: ['React', 'Next.js', 'TypeScript', 'Tailwind CSS'],
    matched_skills: ['React', 'Next.js', 'TypeScript', 'Tailwind CSS'],
    match_score: 94,
    source: 'Indeed',
    source_priority: 'HIGH',
    salary_range: '₱55,000 - ₱75,000 / mo',
    job_types: ['Full-Time'],
    description: 'Contribute to global SaaS applications with intuitive React dashboards, high performance rendering, and modern design system integration.',
  },
  {
    id: 'lead-software1902',
    title: 'Junior Web Developer (React / C# / SQL)',
    company_name: '1902 Software Development',
    company_logo: 'https://www.google.com/s2/favicons?domain=1902software.com&sz=128',
    url: 'https://1902software.com/careers/',
    location: 'Muntinlupa / Alabang',
    remote: false,
    tags: ['C#', 'SQL', 'React', 'JavaScript'],
    matched_skills: ['C#', 'SQL', 'JavaScript', 'React'],
    match_score: 88,
    source: 'Indeed',
    source_priority: 'HIGH',
    salary_range: '₱35,000 - ₱50,000 / mo',
    job_types: ['Full-Time', 'Junior'],
    description: 'European software development agency in Alabang. Full-stack development using C#, modern JavaScript frameworks, and enterprise SQL.',
  },

  // --- GOOGLE SEARCH (Less Priority / Broad Web Discovery) ---
  {
    id: 'lead-google-fintech-trainee',
    title: 'Junior Web Application Engineer (Broad Web Search)',
    company_name: 'Acquire BPO / Tech Services',
    company_logo: 'https://www.google.com/s2/favicons?domain=google.com&sz=128',
    url: 'https://www.google.com/search?q=junior+software+engineer+jobs+metro+manila&ibp=htl;jobs',
    location: 'Ortigas, Pasig / Hybrid',
    remote: false,
    tags: ['HTML', 'JavaScript', 'SQL', 'Web Apps'],
    matched_skills: ['JavaScript', 'SQL', 'HTML'],
    match_score: 83,
    source: 'Google Search',
    source_priority: 'LOW',
    salary_range: '₱30,000 - ₱45,000 / mo',
    job_types: ['Full-Time', 'Entry-Level'],
    description: 'Aggregated via Google Jobs search. Assisting client software integration, script testing, and standard database queries.',
  },
  {
    id: 'lead-google-general-it',
    title: 'IT Support & Web Coordinator (Broad Web Search)',
    company_name: 'Global Business Inroads Manila',
    company_logo: 'https://www.google.com/s2/favicons?domain=google.com&sz=128',
    url: 'https://www.google.com/search?q=it+developer+jobs+philippines&ibp=htl;jobs',
    location: 'Taguig / Makati',
    remote: false,
    tags: ['IT Support', 'Web Maintenance', 'Git'],
    matched_skills: ['Git', 'APIs'],
    match_score: 80,
    source: 'Google Search',
    source_priority: 'LOW',
    salary_range: '₱28,000 - ₱40,000 / mo',
    job_types: ['Full-Time'],
    description: 'Aggregated via Google Jobs indexing. General web system maintenance, basic CMS management, and local server troubleshooting.',
  },
];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = (searchParams.get('q') || '').toLowerCase().trim();
  const sourceFilter = searchParams.get('source');
  const user = await getSessionAccount();
  if (!user) return NextResponse.json({ success: false, error: 'Sign in required.' }, { status: 401 });
  const role = user.role;

  // For members: do NOT seed hardcoded IT leads, as members have diverse non-IT backgrounds
  if (role === 'member') {
    return NextResponse.json({
      success: true,
      data: [],
      portfolioConnected: false,
      message: 'Seeded IT leads removed for member accounts. Use AI Search or Direct Sourcing Launchpads.',
    });
  }

  let results = TARGETED_LEADS;

  if (sourceFilter && sourceFilter !== 'ALL') {
    results = results.filter((j) => {
      if (sourceFilter === 'Google' || sourceFilter === 'Google Search') {
        return j.source === 'Google Search';
      }
      return j.source.toLowerCase() === sourceFilter.toLowerCase();
    });
  }

  if (query) {
    results = results.filter(
      (j) =>
        j.title.toLowerCase().includes(query) ||
        j.company_name.toLowerCase().includes(query) ||
        j.location.toLowerCase().includes(query) ||
        j.tags.some((t) => t.toLowerCase().includes(query)) ||
        j.matched_skills.some((s) => s.toLowerCase().includes(query))
    );
  }

  // Sort: High priority sources first, then match_score desc
  results = results.sort((a, b) => {
    const priorityWeight: Record<string, number> = { HIGH: 2, MEDIUM: 1, LOW: 0 };
    const pDiff = (priorityWeight[b.source_priority] || 0) - (priorityWeight[a.source_priority] || 0);
    if (pDiff !== 0) return pDiff;
    return b.match_score - a.match_score;
  });

  return NextResponse.json({
    success: true,
    data: results,
    portfolioConnected: true,
    matchedProfile: 'Jizelle Casia (jizellecasia.vercel.app)',
  });
}
