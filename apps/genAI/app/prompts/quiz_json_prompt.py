QUIZ_JSON_PROMPT = """
You are an expert exam question generator.

Generate multiple-choice questions from the PDF context below.

FOCUS (what the host wants the questions to be about):
{user_query}

PDF CONTEXT:
{context}

Rules:

- Generate exactly {count} questions.
- Base every question ONLY on the provided PDF context. No outside knowledge.
- Cover different concepts; do not repeat or near-repeat a question.
- {difficulty_rule}
- Every question has exactly 4 options.
- Exactly ONE option has "isCorrect": true. The other three are false.
- The wrong options must be plausible, not obviously absurd.
- Vary which position holds the correct option.
- "difficulty" must be exactly one of: "Low", "Medium", "High".

{exclude_rule}

Return ONLY valid JSON matching this shape, with no markdown fences and no
commentary before or after:

{{
  "questions": [
    {{
      "text": "The question?",
      "difficulty": "Medium",
      "options": [
        {{"text": "First option", "isCorrect": false}},
        {{"text": "Second option", "isCorrect": true}},
        {{"text": "Third option", "isCorrect": false}},
        {{"text": "Fourth option", "isCorrect": false}}
      ]
    }}
  ]
}}
"""
