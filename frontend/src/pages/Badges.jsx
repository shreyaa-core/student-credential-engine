import React from 'react';
import BadgeCard from '../components/BadgeCard';

/**
 * Badges Page Component
 * 
 * Displays student micro-badges awarded for achieving specific learning milestones.
 */
function Badges() {
  const badgesList = [
    {
      name: 'Full-Stack Pioneer',
      criteria: 'Attained verified competence across frontend, backend, and relational databases.',
      earnedDate: '2026-03-20',
      icon: '🚀',
    },
    {
      name: 'React Ecosystem Specialist',
      criteria: 'Demonstrated mastery of React, state management, and component architecture.',
      earnedDate: '2026-04-15',
      icon: '⚛️',
    },
    {
      name: 'Database Optimizer',
      criteria: 'Designed and optimized production-grade PostgreSQL schemas and indexing.',
      earnedDate: '2026-05-10',
      icon: '🗄️',
    },
    {
      name: 'Security Guardian',
      criteria: 'Passed advanced verification in cryptographic hashing and secure authentication.',
      earnedDate: '2026-06-02',
      icon: '🛡️',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Digital Badges</h1>
        <p className="text-sm text-slate-500">
          Open-standard micro-badges awarded for verified student milestones and skill certifications.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {badgesList.map((badge, idx) => (
          <BadgeCard key={idx} {...badge} />
        ))}
      </div>
    </div>
  );
}

export default Badges;
