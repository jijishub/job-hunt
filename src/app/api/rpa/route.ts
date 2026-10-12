import { getSessionAccount } from '@/lib/session-account';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const user = await getSessionAccount();
  if (!user) return NextResponse.json({ success: false, error: 'Sign in required.' }, { status: 401 });
  if (user.role !== 'admin') return NextResponse.json({ success: false, error: 'Admin access required.' }, { status: 403 });
  const { searchParams } = new URL(request.url);
  const platform = searchParams.get('platform') || 'bytedance';

  const resumeData = {
    basic_information: {
      name: "Jizelle D. Casia",
      mobile: "09603899736",
      email: "jizelle.casia@gmail.com",
      preferred_work_location: "Philippines"
    },
    work_experience: [
      {
        company_name: "GDS CAPITAL, INC.",
        title: "Junior Forward-Deployed Engineer",
        start_date: "2026-07",
        end_date: "2026-10",
        description: "● Engineered project-based agentic AI workflows and an enterprise Retrieval-Augmented Generation (RAG) system using Dify to resolve cross-border knowledge gaps. Analyzed business performance to design comprehensive automation pipelines and containerized AI agents for autonomous cross-node execution, accelerating manual workflows by up to 80% (saving ~21 hours/month) and driving a 60% reduction in operational costs. ● Acted as a primary client-facing engineer to translate business requirements into tailored client platforms across a multi-region infrastructure (Philippines, Hong Kong, Singapore). Partnered with cross-functional stakeholders to deliver resilient systems via Dockerized deployments and centralized NAS integration, eliminating data risks and ensuring 24/7 availability for enterprise operations. ● Partnered directly with the CEO in an Agile, rapid-deployment environment to manage enterprise projects and architect strategic technical roadmaps. Delivered executive-level performance reports and evaluated emerging technologies (including RPA tools and open-source platforms) to modernize the corporate tech stack and expand commercial capabilities."
      },
      {
        company_name: "CLOUDJI NOTION TEMPLATES",
        title: "Founder & Digital Product Freelancer",
        start_date: "2023-11",
        end_date: "Present",
        description: "● Design and develop database-driven Notion templates for an international client base, independently managing branding, marketing, and content strategies. ● Scaled brand presence to 6,500+ followers across Pinterest and Ko-fi, driving 15,000+ product downloads and securing 140+ paid customers."
      }
    ],
    education: [
      {
        school_name: "POLYTECHNIC UNIVERSITY OF THE PHILIPPINES",
        faculty: "Information Technology",
        degree: "Bachelor's degree",
        field_of_study: "Information Technology",
        start_date: "2022-09",
        end_date: "2026-09"
      },
      {
        school_name: "LAS PINAS NATIONAL HIGH SCHOOL",
        faculty: "STEM (Science, Engineering, Technology & Mathematics)",
        degree: "High school",
        field_of_study: "STEM (Science, Engineering, Technology & Mathematics)",
        start_date: "2020-09",
        end_date: "2022-09"
      }
    ],
    internship_experience: [
      {
        company_name: "GDS CAPITAL, INC.",
        title: "IT Specialist Intern (AI Product & Growth Trainee)",
        start_date: "2026-03",
        end_date: "2026-06",
        description: "● Led the end-to-end development, project management, and optimization of full-stack applications, the GDS OpenClaw ECC dashboard, and public-facing websites, while administering VPS and Windows Active Directory to maintain high system availability for over 70+ internal users. ● Spearheaded agentic AI solutions to deploy autonomous workflows and agents into Feishu, automating key operations for the Compliance department and 6 other cross-functional teams. Collaborated directly with executives to translate data insights into actionable technical roadmaps."
      },
      {
        company_name: "SUN LIFE GLOBAL SOLUTIONS",
        title: "Core Systems Delivery Intern",
        start_date: "2026-06",
        end_date: "2026-06",
        description: "● Gained critical exposure to multinational enterprise operations by participating in a SAFe Agile workflow-including cross-border Program Increment (PI) planning and technical Scrum sprints (Indonesia, HK, Vietnam)-and observing COBOL code reviews for a large-scale on-premise to cloud migration. ● Evaluated GitHub Copilot integration strategies to accelerate enterprise AI adoption across foundational Core Systems operations, and tracked engineering delivery performance by compiling and analyzing DORA metrics."
      }
    ],
    project_experience: [
      {
        project_name: "GDS OPENCLAW ENTERPRISE CONTROL CENTER",
        title: "Project Manager & Full-Stack Developer",
        start_date: "2026-05",
        end_date: "2026-05",
        project_url: "https://openclaw.gdsgroup.tech/",
        description: "Ubuntu Linux, Docker, Hyper-V, Next.js, PostgreSQL, OpenClaw ● Engineered and deployed a centralized administration dashboard to orchestrate autonomous AI agents, integrating live telemetry, cost tracking, and automated, self-healing VM/Docker container auto-spawning with SMTP alerts, secure API key injections, and policy governance."
      },
      {
        project_name: "ENTERPRISE BUSINESS CONSULTING AUTOMATION",
        title: "Forward-Deployed Engineer & Project Manager",
        start_date: "2026-07",
        end_date: "2026-10",
        project_url: "NDA",
        description: "Debian Linux, Docker, Dify, Nest.js, OpenClaw, Feishu, Synology NAS, RPA ● Architected and deployed an enterprise Dify RAG-to-Feishu pipeline hosted on Singapore servers, resolving cross-border knowledge gaps and reducing operational costs. ● Engineered secure government compliance automation pipelines utilizing RPA and continuous AI integration to streamline departmental workflows. ● Developed a Private-LAN client management platform with live Synology NAS connectivity to manage automation outputs, and established governance for deployed AI agents (OpenClaw) across enterprise systems."
      }
    ],
    self_introduction: "I am a recent Information Technology graduate (Cum Laude) with a unique blend of technical execution and commercial acumen. My background spans both enterprise engineering—where I led project-based AI deployments at GDS Capital that reduced operational costs by 60%—and entrepreneurial e-commerce, having founded and scaled a digital product business (Cloudji) to over 15,000 downloads and 6,500+ followers in the creator economy. I am passionate about bridging the gap between complex technology and tangible business growth. Having worked as a client-facing Forward-Deployed Engineer, I thrive in fast-paced, dynamic environments that demand adaptability, analytical problem-solving, and cross-functional collaboration across international markets. I am eager to leverage my experience in project management, process automation, and creator engagement to build scalable playbooks, solve complex platform challenges, and drive high-impact commercial outcomes in the digital tech and e-commerce space.",
    sns: [
      {
        platform: "LinkedIn",
        url: "https://www.linkedin.com/in/jizelle-casia"
      }
    ]
  };

  const bookmarkletCode = `javascript:(function(){const d=${JSON.stringify(resumeData.basic_information)};const intro=${JSON.stringify(resumeData.self_introduction)};const setV=(el,val)=>{const p=el.tagName==='TEXTAREA'?window.HTMLTextAreaElement.prototype:window.HTMLInputElement.prototype;const s=Object.getOwnPropertyDescriptor(p,'value')?.set||Object.getOwnPropertyDescriptor(el.__proto__,'value')?.set;if(s){s.call(el,val);}else{el.value=val;}el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));el.dispatchEvent(new Event('blur',{bubbles:true}));};Array.from(document.querySelectorAll('input:not([type="hidden"]):not([type="file"])')).forEach(i=>{const c=(i.placeholder+' '+i.name+' '+i.id).toLowerCase();if(c.includes('name'))setV(i,d.name);else if(c.includes('mail'))setV(i,d.email);else if(c.includes('phone')||c.includes('mobile'))setV(i,d.mobile);else if(c.includes('loc')||c.includes('country')||c.includes('city'))setV(i,d.preferred_work_location);});Array.from(document.querySelectorAll('textarea')).forEach(t=>setV(t,intro));alert('🌸 ByteDance RPA Autofill Complete!');})();`;

  return NextResponse.json({
    platform,
    data: resumeData,
    bookmarklet: bookmarkletCode,
    local_command: "npm run rpa:bytedance"
  });
}
