const OpenAI = require('openai');

/**
 * Goal Generation Service
 * Generates SMART goals using OpenAI based on zodiac sign and user input
 */
class GoalGenerationService {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  /**
   * Generate a complete SMART goal with AI
   * @param {Object} params - Generation parameters
   * @param {string} params.zodiacSign - User's zodiac sign
   * @param {string} params.objective - User's stated objective
   * @param {string} params.focusArea - Focus area (career, relationships, wellness, personal_growth)
   * @param {string} params.timeframe - Timeframe (weekly, monthly, quarterly)
   * @param {string} params.emotionalState - Current emotional state
   * @returns {Promise<Object>} Generated goal structure
   */
  async generateGoal({ zodiacSign, objective, focusArea, timeframe, emotionalState }) {
    const prompt = this._buildPrompt({ zodiacSign, objective, focusArea, timeframe, emotionalState });

    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are an expert life coach and astrologer who creates personalized SMART goals. You understand zodiac sign characteristics and create goals that align with astrological energies. Always respond with valid JSON only, no additional text.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.8,
        max_tokens: 2000,
      });

      const responseText = completion.choices[0].message.content.trim();

      // Remove markdown code blocks if present
      const jsonText = responseText
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();

      const goalData = JSON.parse(jsonText);

      // Validate and return
      return this._validateAndFormat(goalData);
    } catch (error) {
      console.error('Error generating goal with OpenAI:', error);
      throw new Error(`Failed to generate goal: ${error.message}`);
    }
  }

  /**
   * Build the OpenAI prompt
   */
  _buildPrompt({ zodiacSign, objective, focusArea, timeframe, emotionalState }) {
    const timeframeMap = {
      weekly: '1 week',
      monthly: '1 month',
      quarterly: '3 months',
    };

    const focusAreaDescriptions = {
      career: 'career development and professional growth',
      relationships: 'relationships and interpersonal connections',
      wellness: 'health, wellness, and self-care',
      personal_growth: 'personal development and self-improvement',
    };

    return `Create a personalized SMART goal for a ${zodiacSign} who wants to "${objective}" in the area of ${focusAreaDescriptions[focusArea]}.

Timeframe: ${timeframeMap[timeframe]}
Current emotional state: ${emotionalState}

Consider ${zodiacSign}'s astrological characteristics:
- Strengths and natural talents
- Challenges and growth areas
- Current planetary influences

Generate a complete goal structure with:

1. **Main Goal** (SMART format):
   - Title: Clear, inspiring goal statement
   - Description: 2-3 sentences about the goal
   - Specific: What exactly will be achieved
   - Measurable: How progress will be measured
   - Achievable: Why this is realistic for ${timeframe}
   - Relevant: How this aligns with ${zodiacSign}'s nature
   - Time-bound: Specific timeline within ${timeframeMap[timeframe]}

2. **Micro-Habits** (3-5 daily habits):
   - Small, actionable habits
   - Include frequency (daily, 3x per week, etc.)
   - Include duration (15 minutes, 30 minutes, etc.)
   - Aligned with ${zodiacSign}'s energy

3. **Milestones** (3-4 checkpoints):
   - Progressive milestones from start to completion
   - Include target dates (Week 1, Mid-month, etc.)
   - Measurable achievements

4. **Potential Obstacles** (2-3 obstacles):
   - Common challenges for ${zodiacSign}
   - Practical solutions for each

5. **Astrological Alignment**:
   - Ruling planet influence
   - Relevant astrological house
   - Strength rating (1-10)
   - Brief description of cosmic support

Return ONLY valid JSON in this exact format:
{
  "mainGoal": {
    "title": "string",
    "description": "string",
    "specific": "string",
    "measurable": "string",
    "achievable": "string",
    "relevant": "string",
    "timebound": "string"
  },
  "microHabits": [
    {
      "habit": "string",
      "frequency": "string",
      "duration": "string"
    }
  ],
  "milestones": [
    {
      "milestone": "string",
      "targetDate": "string"
    }
  ],
  "potentialObstacles": [
    {
      "obstacle": "string",
      "solution": "string"
    }
  ],
  "astrologicalAlignment": {
    "planet": "string",
    "house": "string",
    "strength": number,
    "description": "string"
  }
}`;
  }

  /**
   * Validate and format the AI response
   */
  _validateAndFormat(goalData) {
    // Ensure all required fields are present
    if (!goalData.mainGoal || !goalData.microHabits || !goalData.milestones) {
      throw new Error('Invalid goal structure from AI');
    }

    // Ensure arrays have content
    if (goalData.microHabits.length < 3) {
      throw new Error('Insufficient micro-habits generated');
    }

    if (goalData.milestones.length < 2) {
      throw new Error('Insufficient milestones generated');
    }

    // Validate astrological alignment strength
    if (goalData.astrologicalAlignment?.strength) {
      goalData.astrologicalAlignment.strength = Math.min(10, Math.max(1, goalData.astrologicalAlignment.strength));
    }

    return goalData;
  }
}

module.exports = new GoalGenerationService();
