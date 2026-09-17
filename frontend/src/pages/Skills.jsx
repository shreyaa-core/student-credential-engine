import React from 'react';
import SkillCard from '../components/SkillCard';

/**
 * Skills Page Component
 * 
 * Lists competencies extracted and verified from coursework, assessments, and certificates.
 */
function Skills() {
  const skillsData = [
    { name: 'React.js', category: 'Frontend', level: 'Advanced', verifiedCertificatesCount: 3 },
    { name: 'Node.js & Express', category: 'Backend', level: 'Advanced', verifiedCertificatesCount: 2 },
    { name: 'PostgreSQL Architecture', category: 'Database', level: 'Intermediate', verifiedCertificatesCount: 2 },
    { name: 'Tailwind CSS', category: 'Frontend', level: 'Expert', verifiedCertificatesCount: 2 },
    { name: 'Solidity & EVM', category: 'Blockchain', level: 'Intermediate', verifiedCertificatesCount: 1 },
    { name: 'RESTful API Design', category: 'Backend', level: 'Expert', verifiedCertificatesCount: 3 },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Verified Skills Matrix</h1>
        <p className="text-sm text-slate-500">
          Skills verified through issued micro-credentials and practical coursework evidence.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {skillsData.map((skill, idx) => (
          <SkillCard key={idx} {...skill} />
        ))}
      </div>
    </div>
  );
}

export default Skills;
