#!/usr/bin/env python3
"""
Intelligent Answer Quality Checker
Uses scoring and semantic analysis to determine if an answer is sufficient
"""

import re
from typing import Dict, List, Tuple
from langchain_openai import ChatOpenAI
import os

class AnswerQualityChecker:
    def __init__(self):
        self.llm = ChatOpenAI(
            model="deepseek/deepseek-r1-0528-qwen3-8b:free",
            base_url="https://openrouter.ai/api/v1",
            api_key=os.getenv("OPENAI_API_KEY"),
            temperature=0.1
        )
        
        # Quality indicators
        self.positive_indicators = [
            "according to", "based on", "stated in", "specified in", "outlined in",
            "policy", "rule", "regulation", "guideline", "procedure",
            "prohibited", "allowed", "permitted", "required", "mandatory",
            "specific", "detailed", "comprehensive", "complete", "thorough"
        ]
        
        self.negative_indicators = [
            "i don't have", "i don't know", "i cannot", "not found", "not specified",
            "no information", "cannot find", "unclear", "not clear", "sorry",
            "unable to", "can't help", "don't know", "not available", "missing"
        ]
        
    def calculate_basic_score(self, answer: str) -> Dict[str, float]:
        """Calculate basic quality scores based on various metrics"""
        answer_lower = answer.lower().strip()
        answer_length = len(answer_lower)
        
        # Length score (0-1)
        length_score = min(answer_length / 200, 1.0)  # Optimal length around 200+ chars
        
        # Specificity score based on positive indicators
        positive_count = sum(1 for indicator in self.positive_indicators 
                           if indicator in answer_lower)
        specificity_score = min(positive_count / 3, 1.0)  # 3+ positive indicators is good
        
        # Negativity score based on negative indicators
        negative_count = sum(1 for indicator in self.negative_indicators 
                           if indicator in answer_lower)
        negativity_score = max(0, 1 - (negative_count / 2))  # 2+ negative indicators is bad
        
        # Structure score (has bullet points, lists, etc.)
        structure_score = 0.0
        if re.search(r'[-•*]\s', answer):  # Bullet points
            structure_score += 0.3
        if re.search(r'\d+\.\s', answer):  # Numbered lists
            structure_score += 0.2
        if re.search(r'[A-Z][a-z]+:', answer):  # Categories
            structure_score += 0.2
        if re.search(r'\*\*.*\*\*', answer):  # Bold text
            structure_score += 0.1
        if re.search(r'\[.*\]', answer):  # References
            structure_score += 0.2
        
        # Source citation score
        citation_score = 0.0
        if any(phrase in answer_lower for phrase in ["document", "handbook", "policy", "rule", "source"]):
            citation_score = 1.0
        
        return {
            'length_score': length_score,
            'specificity_score': specificity_score,
            'negativity_score': negativity_score,
            'structure_score': min(structure_score, 1.0),
            'citation_score': citation_score
        }
    
    def get_ai_quality_assessment(self, question: str, answer: str) -> Dict[str, any]:
        """Use AI to assess answer quality"""
        try:
            prompt = f"""
            Assess the quality of this answer to the given question.
            
            Question: {question}
            Answer: {answer}
            
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
            """
            
            response = self.llm.invoke(prompt).content
            
            # Parse the response
            scores = {}
            sufficient = False
            reason = ""
            
            for line in response.split('\n'):
                if ':' in line:
                    key, value = line.split(':', 1)
                    key = key.strip()
                    value = value.strip()
                    
                    if key in ['Relevance', 'Completeness', 'Specificity', 'Helpfulness']:
                        try:
                            scores[key.lower()] = int(value)
                        except:
                            scores[key.lower()] = 5
                    elif key == 'Sufficient':
                        sufficient = value.lower() == 'yes'
                    elif key == 'Reason':
                        reason = value
            
            return {
                'ai_scores': scores,
                'ai_sufficient': sufficient,
                'ai_reason': reason
            }
            
        except Exception as e:
            print(f"AI assessment failed: {e}")
            return {
                'ai_scores': {'relevance': 5, 'completeness': 5, 'specificity': 5, 'helpfulness': 5},
                'ai_sufficient': True,
                'ai_reason': 'AI assessment unavailable'
            }
    
    def assess_answer_quality(self, question: str, answer: str) -> Dict[str, any]:
        """Comprehensive answer quality assessment"""
        
        # Basic scoring
        basic_scores = self.calculate_basic_score(answer)
        
        # AI assessment
        ai_assessment = self.get_ai_quality_assessment(question, answer)
        
        # Calculate overall score
        basic_avg = sum(basic_scores.values()) / len(basic_scores)
        ai_avg = sum(ai_assessment['ai_scores'].values()) / len(ai_assessment['ai_scores'])
        
        # Weighted combination (70% AI, 30% basic)
        overall_score = (ai_avg * 0.7) + (basic_avg * 0.3)
        
        # Determine if answer is sufficient
        is_sufficient = (
            overall_score >= 6.0 and  # Good overall score
            ai_assessment['ai_sufficient'] and  # AI thinks it's sufficient
            basic_scores['negativity_score'] >= 0.5  # Not too negative
        )
        
        return {
            'overall_score': overall_score,
            'is_sufficient': is_sufficient,
            'basic_scores': basic_scores,
            'ai_assessment': ai_assessment,
            'recommendation': 'sufficient' if is_sufficient else 'needs_fallback'
        }
