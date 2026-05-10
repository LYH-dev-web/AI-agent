/**
 * Document parser — extracts structured info from raw text.
 * Supports meeting minutes, chat records, requirement docs, and generic text.
 */

const DOC_TYPES = {
  MEETING_MINUTES: 'meeting_minutes',
  CHAT_RECORD: 'chat_record',
  REQUIREMENT_DOC: 'requirement_doc',
  OTHER: 'other',
};

export function parseDocument(title, content, docType = DOC_TYPES.OTHER) {
  const parsed = {
    title,
    docType,
    rawLength: content.length,
    participants: [],
    topics: [],
    decisions: [],
    actionItems: [],
    requirementsMentioned: [],
    keyTerms: [],
    timestampRefs: [],
  };

  switch (docType) {
    case DOC_TYPES.MEETING_MINUTES:
      Object.assign(parsed, parseMeeting(content));
      break;
    case DOC_TYPES.CHAT_RECORD:
      Object.assign(parsed, parseChat(content));
      break;
    case DOC_TYPES.REQUIREMENT_DOC:
      Object.assign(parsed, parseRequirementDoc(content));
      break;
    default:
      Object.assign(parsed, parseGeneric(content));
  }

  parsed.keyTerms = extractKeyTerms(content);
  return parsed;
}

function parseMeeting(content) {
  const result = { participants: [], decisions: [], actionItems: [], topics: [], meetingDate: null };

  // Participants
  const ptMatch = content.match(/(?:参会[人员人]{0,2}|参与者|出席|Attendees?)[：:\s]+(.+?)(?:\n|$)/i);
  if (ptMatch) {
    result.participants = ptMatch[1].split(/[,，、\s]+/).map(s => s.trim()).filter(Boolean);
  }

  // Decisions
  const decMatch = content.match(/(?:决定|决议|结论|决策|一致同意|达成共识)[：:\s]*([\s\S]*?)(?:\n\n|\n#{1,}|$)/i);
  if (decMatch) {
    result.decisions = decMatch[1].split('\n').map(l => l.replace(/^[-•*\s]+/, '').trim()).filter(l => l.length > 5).slice(0, 20);
  }

  // Action items
  const actMatch = content.match(/(?:TODO|待办|Action Items?|后续|下一步)[：:\s]*([\s\S]*?)(?:\n\n|\n#{1,}|$)/i);
  if (actMatch) {
    result.actionItems = actMatch[1].split('\n').map(l => l.replace(/^[-•*\s]+/, '').trim()).filter(l => l.length > 5).slice(0, 20);
  }

  // Topics
  const topicMatches = content.matchAll(/##+\s*(.+?)(?:\n|$)/g);
  result.topics = [...topicMatches].map(m => m[1].trim()).filter(Boolean).slice(0, 10);

  // Date
  const dateMatch = content.match(/(?:日期|时间|Date|Time)[：:\s]*(\d{4}[-/年]\d{1,2}[-/月]\d{1,2})/);
  if (dateMatch) result.meetingDate = dateMatch[1];

  return result;
}

function parseChat(content) {
  const result = { participants: [], keyDiscussions: [], agreements: [], pendingItems: [] };

  const mentions = content.match(/@(\w+)/g);
  if (mentions) result.participants = [...new Set(mentions.map(m => m.slice(1)))];

  const qaMatches = content.matchAll(/([^\n]*\?[^\n]*)\n([^\n]*)/g);
  result.keyDiscussions = [...qaMatches].map(([, q, a]) => `Q: ${q.trim()} A: ${a.trim()}`).filter(Boolean).slice(0, 15);

  const agreeMatches = content.matchAll(/(?:同意|确认|OK|好的|没问题)[^\n]*/gi);
  result.agreements = [...agreeMatches].map(m => m[0].trim()).filter(a => a.length > 5).slice(0, 10);

  const pendingMatches = content.matchAll(/(?:待办|TODO|跟进|需要|要做的|pending)[：:\s]*([^\n]*)/gi);
  result.pendingItems = [...pendingMatches].map(m => m[1].trim()).filter(Boolean).slice(0, 10);

  return result;
}

function parseRequirementDoc(content) {
  const result = { requirementsMentioned: [], acceptanceCriteria: [], constraints: [], stakeholders: [] };

  const reqMatches = content.matchAll(/[-•*]\s*(?:支持|提供|实现|增加|添加|优化|改进)[^\n]*/gi);
  result.requirementsMentioned = [...reqMatches].map(m => m[0].replace(/^[-•*\s]+/, '').trim()).filter(Boolean).slice(0, 20);

  // Also match FR/NFR patterns
  const frMatches = content.matchAll(/(?:FR|NFR)-?\d+[：:\s]*([^\n]+)/gi);
  for (const m of frMatches) {
    result.requirementsMentioned.push(m[1].trim());
  }

  const acMatch = content.match(/(?:验收|Acceptance Criteria)[：:\s]*([\s\S]*?)(?:\n\n|\n#{1,}|$)/i);
  if (acMatch) {
    result.acceptanceCriteria = acMatch[1].split('\n').map(l => l.replace(/^[-•*\s]+/, '').trim()).filter(Boolean).slice(0, 10);
  }

  return result;
}

function parseGeneric(content) {
  const result = { topics: [], keyPoints: [] };

  const headerMatches = content.matchAll(/^#{1,4}\s+(.+?)$/gm);
  result.topics = [...headerMatches].map(m => m[1].trim()).filter(Boolean).slice(0, 10);

  const bulletMatches = content.matchAll(/^[-•*]\s+(.+?)$/gm);
  result.keyPoints = [...bulletMatches].map(m => m[1].trim()).filter(Boolean).slice(0, 20);

  return result;
}

function extractKeyTerms(content) {
  const terms = new Set();

  const camelMatches = content.match(/\b[A-Z][a-z]+[A-Z][A-Za-z]+\b/g);
  if (camelMatches) camelMatches.slice(0, 20).forEach(t => terms.add(t));

  const acronymMatches = content.match(/\b[A-Z]{2,8}\b/g);
  if (acronymMatches) acronymMatches.slice(0, 10).forEach(t => terms.add(t));

  return [...terms].slice(0, 30);
}

export { DOC_TYPES };
