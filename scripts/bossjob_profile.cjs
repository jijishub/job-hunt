// Authored from the BusinessSolutions resume; kept separate from PDF extraction.
const BUSINESS_PERSONAL_SUMMARY = 'IT graduate (Cum Laude) with PROFESSIONAL experience in client-facing business solutions, project management, AI automation, and digital product entrepreneurship. At GDS Capital, I translated business requirements into enterprise solutions that accelerated manual workflows by up to 80% and reduced operational costs by 60%. As the founder of Cloudji, I manage product development, client consultations, pricing, branding, and marketing, growing the business to over 15,000 downloads, 140 paying customers, and an audience of 6,500+ followers. I bring analytical problem-solving, cross-functional collaboration, and hands-on technical execution to roles in business operations, project coordination, and digital product growth.';

function bossjobProfile(data) {
 if(data.variant!=='business')return data;
 return {...data,profile:{...data.profile,summary:BUSINESS_PERSONAL_SUMMARY,experience:data.profile.experience.map(entry=>entry.company==='CLOUDJI NOTION TEMPLATES'?{...entry,existing_titles:['Founder']}:entry)}};
}
module.exports={BUSINESS_PERSONAL_SUMMARY,bossjobProfile};
