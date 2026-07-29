import type { OpenEndedQuestion, AnswerInput, ValidationResult } from '../types/index.js';

/**
 * Validate an answer before accepting it
 */
export function validateAnswer(answer: AnswerInput, question: OpenEndedQuestion): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Open-ended: must have text
  if (!answer.open_ended?.trim()) {
    errors.push('Open-ended answer cannot be empty');
  }

  // Multi-choice: must select one
  if (!answer.choice_id) {
    errors.push('Must select a multiple-choice option');
  } else {
    const validChoice = question.follow_up_choices.find((c) => c.id === answer.choice_id);
    if (!validChoice) {
      errors.push(`Invalid choice ID: ${answer.choice_id}`);
    }
  }

  // Warnings
  if (answer.open_ended && answer.open_ended.trim().length > 0 && answer.open_ended.trim().length < 20) {
    warnings.push('Consider providing more detail (currently <20 chars)');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Check if a question has been fully answered
 */
export function isQuestionAnswered(answer: any): boolean {
  return !!(answer && answer.open_ended_text?.trim() && answer.multi_choice_id);
}
