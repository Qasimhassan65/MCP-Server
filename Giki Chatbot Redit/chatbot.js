import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

const INDEX_PATH = 'faiss_index';

// OpenRouter API Setup
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

// Reddit Setup (OAuth)
const REDDIT_CONFIG = {
    clientId: process.env.REDDIT_CLIENT_ID,
    clientSecret: process.env.REDDIT_CLIENT_SECRET,
    refreshToken: process.env.REDDIT_REFRESH_TOKEN,
    userAgent: process.env.REDDIT_USER_AGENT
};

// Document Processor
class GIKIDocumentProcessor {
    constructor(dataFolder = 'data') {
        this.dataFolder = dataFolder;
    }

    async extractTextFromPdf(filePath) {
        try {
            const pdfParse = await import('pdf-parse');
            const dataBuffer = await fs.readFile(filePath);
            const data = await pdfParse.default(dataBuffer);
            return data.text;
        } catch (error) {
            console.error(`Error processing PDF ${filePath}:`, error.message);
            return '';
        }
    }

    async extractTextFromDocx(filePath) {
        try {
            const mammoth = await import('mammoth');
            const result = await mammoth.extractRawText({ path: filePath });
            return result.value;
        } catch (error) {
            console.error(`Error processing DOCX ${filePath}:`, error.message);
            return '';
        }
    }

    async extractTextFromTxt(filePath) {
        try {
            return await fs.readFile(filePath, 'utf-8');
        } catch (error) {
            console.error(`Error processing TXT ${filePath}:`, error.message);
            return '';
        }
    }

    async extractTextFromJson(filePath) {
        try {
            const data = await fs.readJson(filePath);
            let text = '';
            
            if (Array.isArray(data)) {
                for (let i = 0; i < data.length; i++) {
                    const post = data[i];
                    if (typeof post === 'object' && post !== null) {
                        const title = post.title || '';
                        const selftext = post.selftext || '';
                        const author = post.author || '';
                        const postId = post.id || '';
                        
                        let postContent = `Title: ${title}\nContent: ${selftext}`;
                        
                        const comments = post.comments || [];
                        if (comments.length > 0) {
                            postContent += '\nComments:\n';
                            for (const comment of comments) {
                                if (typeof comment === 'object' && comment !== null) {
                                    const commentBody = comment.body || '';
                                    const commentAuthor = comment.author || '';
                                    if (commentBody) {
                                        postContent += `- ${commentAuthor}: ${commentBody}\n`;
                                    }
                                }
                            }
                        }
                        
                        text += `\n[Reddit Post ${i + 1} - ID: ${postId}]\n${postContent}\n`;
                    }
                }
            }
            
            return text;
        } catch (error) {
            console.error(`Error processing JSON ${filePath}:`, error.message);
            return '';
        }
    }

    async loadDocuments() {
        const documents = [];
        const dataPath = path.join(__dirname, this.dataFolder);

        if (!(await fs.pathExists(dataPath))) {
            return documents;
        }

        const supportedExtensions = ['.pdf', '.docx', '.txt', '.json'];
        const files = await fs.readdir(dataPath);

        for (const file of files) {
            const filePath = path.join(dataPath, file);
            const stats = await fs.stat(filePath);
            
            if (stats.isFile() && supportedExtensions.includes(path.extname(file).toLowerCase())) {
                let text = '';
                const ext = path.extname(file).toLowerCase();

                if (ext === '.pdf') {
                    text = await this.extractTextFromPdf(filePath);
                } else if (ext === '.docx') {
                    text = await this.extractTextFromDocx(filePath);
                } else if (ext === '.txt') {
                    text = await this.extractTextFromTxt(filePath);
                } else if (ext === '.json') {
                    text = await this.extractTextFromJson(filePath);
                }

                if (text.trim()) {
                    // Split text into chunks (simplified version)
                    const chunks = this.splitText(text);
                    for (let i = 0; i < chunks.length; i++) {
                        const chunk = chunks[i];
                        if (chunk.trim()) {
                            documents.push({
                                content: chunk,
                                metadata: {
                                    source: file,
                                    chunkId: i,
                                    fileType: ext
                                }
                            });
                        }
                    }
                }
            }
        }

        return documents;
    }

    splitText(text, chunkSize = 500, overlap = 50) {
        const chunks = [];
        const sentences = text.split(/[.!?]+/).filter(s => s.trim());
        let currentChunk = '';

        for (const sentence of sentences) {
            if ((currentChunk + sentence).length > chunkSize && currentChunk) {
                chunks.push(currentChunk.trim());
                currentChunk = sentence + '. ';
            } else {
                currentChunk += sentence + '. ';
            }
        }

        if (currentChunk.trim()) {
            chunks.push(currentChunk.trim());
        }

        return chunks;
    }
}

// Answer Quality Checker
class AnswerQualityChecker {
    constructor() {
        this.positiveIndicators = [
            'according to', 'based on', 'stated in', 'specified in', 'outlined in',
            'policy', 'rule', 'regulation', 'guideline', 'procedure',
            'prohibited', 'allowed', 'permitted', 'required', 'mandatory',
            'specific', 'detailed', 'comprehensive', 'complete', 'thorough'
        ];

        this.negativeIndicators = [
            'i don\'t have', 'i don\'t know', 'i cannot', 'not found', 'not specified',
            'no information', 'cannot find', 'unclear', 'not clear', 'sorry',
            'unable to', 'can\'t help', 'don\'t know', 'not available', 'missing'
        ];
    }

    calculateBasicScore(answer) {
        const answerLower = answer.toLowerCase().trim();
        const answerLength = answerLower.length;

        // Length score (0-1)
        const lengthScore = Math.min(answerLength / 200, 1.0);

        // Specificity score based on positive indicators
        const positiveCount = this.positiveIndicators.filter(indicator => 
            answerLower.includes(indicator)
        ).length;
        const specificityScore = Math.min(positiveCount / 3, 1.0);

        // Negativity score based on negative indicators
        const negativeCount = this.negativeIndicators.filter(indicator => 
            answerLower.includes(indicator)
        ).length;
        const negativityScore = Math.max(0, 1 - (negativeCount / 2));

        // Structure score (simplified)
        let structureScore = 0.0;
        if (answer.match(/[-•*]\s/)) structureScore += 0.3;
        if (answer.match(/\d+\.\s/)) structureScore += 0.2;
        if (answer.match(/[A-Z][a-z]+:/)) structureScore += 0.2;
        if (answer.match(/\*\*.*\*\*/)) structureScore += 0.1;
        if (answer.match(/\[.*\]/)) structureScore += 0.2;

        // Source citation score
        const citationScore = this.positiveIndicators.some(phrase => 
            answerLower.includes(phrase)
        ) ? 1.0 : 0.0;

        return {
            lengthScore,
            specificityScore,
            negativityScore,
            structureScore: Math.min(structureScore, 1.0),
            citationScore
        };
    }

    async getAIQualityAssessment(question, answer) {
        try {
            const prompt = `
            Assess the quality of this answer to the given question.
            
            Question: ${question}
            Answer: ${answer}
            
            Rate the answer on a scale of 1-10 for each criterion:
            1. Relevance: How well does it answer the question?
            2. Completeness: Does it provide sufficient information?
            3. Specificity: Is it specific and detailed?
            4. Helpfulness: Would this be useful to the user?
            
            Also determine if this answer is sufficient or if additional sources should be consulted.
            
            Respond in this exact format:
            Relevance: [1-10]
            Completeness: [1-10]
            Specificity: [1-10]
            Helpfulness: [1-10]
            Sufficient: [Yes/No]
            Reason: [Brief explanation]
            `;

            const response = await this.callOpenRouterAPI(prompt);
            
            // Parse the response
            const scores = {};
            let sufficient = false;
            let reason = '';

            const lines = response.split('\n');
            for (const line of lines) {
                if (line.includes(':')) {
                    const [key, value] = line.split(':', 2);
                    const keyTrim = key.trim();
                    const valueTrim = value.trim();

                    if (['Relevance', 'Completeness', 'Specificity', 'Helpfulness'].includes(keyTrim)) {
                        scores[keyTrim.toLowerCase()] = parseInt(valueTrim) || 5;
                    } else if (keyTrim === 'Sufficient') {
                        sufficient = valueTrim.toLowerCase() === 'yes';
                    } else if (keyTrim === 'Reason') {
                        reason = valueTrim;
                    }
                }
            }

            return {
                aiScores: scores,
                aiSufficient: sufficient,
                aiReason: reason
            };

        } catch (error) {
            console.error('AI assessment failed:', error.message);
            return {
                aiScores: { relevance: 5, completeness: 5, specificity: 5, helpfulness: 5 },
                aiSufficient: true,
                aiReason: 'AI assessment unavailable'
            };
        }
    }

    async assessAnswerQuality(question, answer) {
        // Basic scoring
        const basicScores = this.calculateBasicScore(answer);

        // AI assessment
        const aiAssessment = await this.getAIQualityAssessment(question, answer);

        // Calculate overall score
        const basicAvg = Object.values(basicScores).reduce((a, b) => a + b, 0) / Object.keys(basicScores).length;
        const aiAvg = Object.values(aiAssessment.aiScores).reduce((a, b) => a + b, 0) / Object.keys(aiAssessment.aiScores).length;

        // Weighted combination (70% AI, 30% basic)
        const overallScore = (aiAvg * 0.7) + (basicAvg * 0.3);

        // Determine if answer is sufficient
        const isSufficient = (
            overallScore >= 6.0 &&
            aiAssessment.aiSufficient &&
            basicScores.negativityScore >= 0.5
        );

        return {
            overallScore,
            isSufficient,
            basicScores,
            aiAssessment,
            recommendation: isSufficient ? 'sufficient' : 'needs_fallback'
        };
    }

    async callOpenRouterAPI(prompt) {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://huggingface.co',
                'X-Title': 'GIKI-RAG-bot'
            },
            body: JSON.stringify({
                model: 'deepseek/deepseek-r1-0528-qwen3-8b:free',
                messages: [
                    {
                        role: 'system',
                        content: 'You are a helpful assistant for GIKI (Ghulam Ishaq Khan Institute of Engineering Sciences and Technology).'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: 0.1
            })
        });

        if (!response.ok) {
            throw new Error(`OpenRouter API error: ${response.status}`);
        }

        const data = await response.json();
        return data.choices[0].message.content;
    }
}

// Main GIKIbot class
export class GIKIbot {
    constructor() {
        this.qaChain = null;
        this.vectorstore = null;
        this.processor = new GIKIDocumentProcessor();
        this.qualityChecker = new AnswerQualityChecker();
        this.initialized = false;
    }

    async initializeSystem() {
        try {
            if (await fs.pathExists(INDEX_PATH)) {
                // Load existing index (simplified - in real implementation you'd use a proper vector store)
                this.vectorstore = { loaded: true };
            } else {
                const documents = await this.processor.loadDocuments();
                if (documents.length === 0) {
                    return '❌ No documents found. Add files to the \'data\' folder.';
                }

                // Create vector store (simplified)
                this.vectorstore = { documents, loaded: true };
                await this.saveIndex();
            }

            this.initialized = true;
            return '✅ System ready! Ask questions now.';
        } catch (error) {
            return `❌ Error initializing system: ${error.message}`;
        }
    }

    async saveIndex() {
        // Simplified index saving
        await fs.ensureDir(INDEX_PATH);
        await fs.writeJson(path.join(INDEX_PATH, 'documents.json'), this.vectorstore.documents);
    }

    async loadIndex() {
        try {
            const documentsPath = path.join(INDEX_PATH, 'documents.json');
            if (await fs.pathExists(documentsPath)) {
                this.vectorstore = {
                    documents: await fs.readJson(documentsPath),
                    loaded: true
                };
                return true;
            }
        } catch (error) {
            console.error('Error loading index:', error.message);
        }
        return false;
    }

    async askQuestion(question) {
        if (!this.initialized) {
            return '⚠️ System not initialized yet.';
        }

        if (!question.trim()) {
            return '⚠️ Please enter a valid question.';
        }

        try {
            // Get answer from documents
            const answer = await this.getDocumentAnswer(question);
            
            // Assess answer quality
            console.log('🔍 Assessing answer quality...');
            const qualityAssessment = await this.qualityChecker.assessAnswerQuality(question, answer);
            
            console.log(`🔍 Overall score: ${qualityAssessment.overallScore.toFixed(2)}/10`);
            console.log(`🔍 AI assessment: ${qualityAssessment.aiAssessment.aiSufficient}`);
            console.log(`🔍 AI reason: ${qualityAssessment.aiAssessment.aiReason}`);

            const needsFallback = !qualityAssessment.isSufficient;

            if (needsFallback) {
                console.log('🔍 Fallback triggered!');
                const redditAnswer = await this.getRedditAnswer(question);
                if (redditAnswer) {
                    return `⚠️ Not found in official documents. Based on Reddit discussions:\n\n${redditAnswer}`;
                } else {
                    return `⚠️ ${answer}\n\n(No additional information found on Reddit)`;
                }
            } else {
                return answer;
            }

        } catch (error) {
            return `❌ Error: ${error.message}`;
        }
    }

    async getDocumentAnswer(question) {
        // Simplified document search and answer generation
        const documents = this.vectorstore.documents || [];
        
        // Simple keyword matching (in real implementation, use proper vector search)
        const relevantDocs = documents.filter(doc => 
            question.toLowerCase().split(' ').some(word => 
                doc.content.toLowerCase().includes(word)
            )
        ).slice(0, 5);

        if (relevantDocs.length === 0) {
            return 'I don\'t have that information in the provided documents.';
        }

        // Generate answer using OpenRouter API
        const context = relevantDocs.map(doc => doc.content).join('\n\n');
        const prompt = `You are a helpful assistant for GIKI (Ghulam Ishaq Khan Institute of Engineering Sciences and Technology).
Answer questions based on official GIKI documents: prospectus, fee structure, academic rules, and handbook.

Instructions:
- Answer based only on context
- If answer not found, say "I don't have that information in the provided documents"
- Be specific and cite document source when possible
- Maintain professional, student-friendly tone

Context:
${context}

Question: ${question}

Answer:`;

        const answer = await this.callOpenRouterAPI(prompt);
        
        // Add sources
        const sources = [...new Set(relevantDocs.map(doc => `📄 ${doc.metadata.source}`))];
        const sourceText = sources.length > 0 ? `\n\nSources:\n${sources.join('\n')}` : '';
        
        return `${answer}${sourceText}`;
    }

    async getRedditAnswer(question) {
        try {
            // Simplified Reddit search (in real implementation, use proper Reddit API)
            const searchTerms = question.toLowerCase().split(' ').slice(0, 3);
            
            // Mock Reddit posts for demonstration
            const mockPosts = [
                {
                    title: 'GIKI Hostel Information',
                    selftext: 'The boys hostel has good facilities and the food is decent. Rooms are shared but comfortable.',
                    url: 'https://reddit.com/r/giki/comments/example1'
                },
                {
                    title: 'Academic Calendar 2024',
                    selftext: 'The academic calendar for 2024 has been updated. Check the official website for details.',
                    url: 'https://reddit.com/r/giki/comments/example2'
                }
            ];

            if (mockPosts.length === 0) {
                return null;
            }

            const redditContext = mockPosts.map(post => 
                `**${post.title}**\n${post.selftext.substring(0, 500)}...\n(Source: ${post.url})`
            ).join('\n\n');

            const prompt = `Answer the following question using the Reddit discussions:\n\nQuestion: ${question}\n\nReddit Posts:\n${redditContext}\n\nAnswer:`;
            
            const redditAnswer = await this.callOpenRouterAPI(prompt);
            
            const redditSources = mockPosts.map(post => 
                `🌐 r/giki: ${post.title.substring(0, 60)}...`
            );
            
            return `${redditAnswer}\n\nReddit Sources:\n${redditSources.join('\n')}`;

        } catch (error) {
            console.error('Error getting Reddit answer:', error.message);
            return null;
        }
    }

    async callOpenRouterAPI(prompt) {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://huggingface.co',
                'X-Title': 'GIKI-RAG-bot'
            },
            body: JSON.stringify({
                model: 'deepseek/deepseek-r1-0528-qwen3-8b:free',
                messages: [
                    {
                        role: 'system',
                        content: 'You are a helpful assistant for GIKI (Ghulam Ishaq Khan Institute of Engineering Sciences and Technology).'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: 0.1
            })
        });

        if (!response.ok) {
            throw new Error(`OpenRouter API error: ${response.status}`);
        }

        const data = await response.json();
        return data.choices[0].message.content;
    }

    async rebuildIndex() {
        try {
            if (await fs.pathExists(INDEX_PATH)) {
                await fs.remove(INDEX_PATH);
            }
            return await this.initializeSystem();
        } catch (error) {
            return `Error rebuilding index: ${error.message}`;
        }
    }

    isInitialized() {
        return this.initialized;
    }
}
