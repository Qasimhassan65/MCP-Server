import { GIKIbot } from './chatbot.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function testGIKIbot() {
    console.log('🧪 Testing GIKI Chatbot...');
    
    try {
        // Initialize the bot
        const bot = new GIKIbot();
        console.log('📝 Initializing system...');
        const initResult = await bot.initializeSystem();
        console.log('✅ Initialization result:', initResult);
        
        // Test a simple question
        console.log('\n🤔 Testing question...');
        const question = 'What is GIKI?';
        const answer = await bot.askQuestion(question);
        console.log('❓ Question:', question);
        console.log('💬 Answer:', answer);
        
        // Test health check
        console.log('\n🏥 Health check...');
        const isInitialized = bot.isInitialized();
        console.log('✅ Initialized:', isInitialized);
        
        console.log('\n🎉 Test completed successfully!');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error(error.stack);
    }
}

// Run the test
testGIKIbot();
