require('dotenv').config();

console.log('=== Environment Check ===');
console.log('Node version:', process.version);
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('OpenAI Key present:', !!process.env.OPENAI_API_KEY);
console.log('OpenAI Key length:', process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY.length : 0);
console.log('Database URL present:', !!process.env.DATABASE_URL);
console.log('Admin Key present:', !!process.env.ADMIN_KEY);
console.log('Port:', process.env.PORT || 3000);
