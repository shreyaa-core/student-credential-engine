// ==============================================================================
// Skill Mapping Integration Test
// ==============================================================================

const express = require('express');
const certificateRoutes = require('./routes/certificateRoutes');

const app = express();
app.use(express.json());
app.use('/api/certificates', certificateRoutes);

const server = app.listen(5097, async () => {
  try {
    const formData = new FormData();
    const dummyPdfContent = Buffer.from('%PDF-1.4 Machine Learning and Python certificate content');
    const blob = new Blob([dummyPdfContent], { type: 'application/pdf' });
    formData.append('certificate', blob, 'ml_python.pdf');
    formData.append('certificate_name', 'Machine Learning with Python Masterclass');
    formData.append('issuer', 'Stanford Online');

    const res = await fetch('http://localhost:5097/api/certificates/upload', {
      method: 'POST',
      body: formData,
    });

    const data = await res.json();
    console.log('Upload HTTP status:', res.status);
    console.log('Returned mapped skills:', data.skills);

    const hasML = Array.isArray(data.skills) && data.skills.includes('Machine Learning');
    const hasPython = Array.isArray(data.skills) && data.skills.includes('Python');

    if (hasML && hasPython) {
      console.log('✅ INTEGRATION SUCCESS: mapSkillsFromCourse executed and linked skills correctly!');
    } else {
      console.error('❌ Mapped skills missing:', data.skills);
      process.exit(1);
    }
  } catch (err) {
    console.error('Test error:', err);
    process.exit(1);
  } finally {
    server.close();
  }
});
