// ==============================================================================
// Skill Mapping Service Test Script
// ==============================================================================

const { mapSkillsFromCourse } = require('./services/skillMappingService');

// Test input
const courseName = "Machine Learning with Python";

console.log(`Course Name: "${courseName}"`);

// Map skills using skillMappingService
const mappedSkills = mapSkillsFromCourse(courseName);

// Print mapped skills to console
console.log("Mapped Skills:", mappedSkills);
