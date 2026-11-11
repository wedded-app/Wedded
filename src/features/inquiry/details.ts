/**
 * The kinds of questions Ask for a quote puts to a vendor (vision §6
 * "Inquiry asks"): a hall's, a caterer's, or neither, from the primary
 * category's `inquiry_questions`. The answers go as `details` and are
 * printed on the vendor's booking sheet and email (ask-draft's askDetails).
 */
/** Which questions a vendor type's inquiry asks (categories.inquiry_questions). */
export type QuestionSet = 'venue' | 'caterer' | null;

export type DayPart = 'morning' | 'afternoon' | 'evening';
