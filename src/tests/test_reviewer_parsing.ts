/**
 * TEST 3: Reviewer Mismatch — Unit test for reviewStep JSON parsing.
 *
 * reviewStep calls the LLM and then parses the response. We can't call
 * the LLM in a unit test, so we test the EXACT parsing logic that
 * reviewStep uses (extracted verbatim from planner.ts lines 87–98).
 *
 * Run: npx tsx src/tests/test_reviewer_parsing.ts
 */

// ── Extract the exact parsing logic from planner.ts ──
function parseReviewResponse(fullResponse: string): { approved: boolean; reason: string } {
  try {
    const trimmed = fullResponse.trim();
    const fencedMatch = trimmed.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
    const jsonStr = fencedMatch ? fencedMatch[1].trim() : trimmed;
    const parsed = JSON.parse(jsonStr);
    return {
      approved: !!parsed.approved,
      reason: String(parsed.reason || '')
    };
  } catch {
    return { approved: false, reason: "Reviewer failed to return valid JSON" };
  }
}

// ── Test Cases ──

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passed++;
  } else {
    console.log(`  ❌ FAIL: ${testName}${detail ? ' — ' + detail : ''}`);
    failed++;
  }
}

console.log('\n═══ TEST 3: Reviewer Mismatch Parsing ═══\n');

// ── Case 1: Mismatch — user says "delete only draft.txt", plan deletes all .txt ──
console.log('Case 1: Reviewer rejects mismatched destructive action');
{
  const llmResponse = JSON.stringify({
    approved: false,
    reason: "User requested deleting only 'draft.txt', but the planned action deletes ALL .txt files in the directory. This is a scope escalation."
  });

  const result = parseReviewResponse(llmResponse);
  assert(result.approved === false, 'approved should be false');
  assert(result.reason.includes('scope escalation') || result.reason.includes('draft.txt'),
    'reason should mention the mismatch',
    `Got: "${result.reason}"`);
}

// ── Case 2: Match — user says "delete draft.txt", plan deletes draft.txt ──
console.log('\nCase 2: Reviewer approves matching action');
{
  const llmResponse = JSON.stringify({
    approved: true,
    reason: "The planned action exactly matches the user's request to delete draft.txt."
  });

  const result = parseReviewResponse(llmResponse);
  assert(result.approved === true, 'approved should be true');
  assert(result.reason.includes('matches'), 'reason should confirm the match',
    `Got: "${result.reason}"`);
}

// ── Case 3: Fenced JSON (LLM wraps in ```json ... ```) ──
console.log('\nCase 3: Handles markdown-fenced JSON');
{
  const llmResponse = '```json\n{"approved": false, "reason": "Deleting system files is not what the user asked for."}\n```';

  const result = parseReviewResponse(llmResponse);
  assert(result.approved === false, 'approved should be false for fenced JSON');
  assert(result.reason.includes('system files'), 'reason parsed from fenced block');
}

// ── Case 4: Garbage response — reviewer fails gracefully ──
console.log('\nCase 4: Handles garbage/unparseable LLM output');
{
  const llmResponse = 'I think this is fine, go ahead and do it.';

  const result = parseReviewResponse(llmResponse);
  assert(result.approved === false, 'approved should default to false on parse failure');
  assert(result.reason.includes('failed to return valid JSON'),
    'reason should indicate parse failure',
    `Got: "${result.reason}"`);
}

// ── Case 5: Empty response ──
console.log('\nCase 5: Handles empty response');
{
  const result = parseReviewResponse('');
  assert(result.approved === false, 'approved should be false for empty response');
  assert(result.reason.includes('failed'), 'reason should indicate failure');
}

// ── Case 6: approved is truthy string (edge case) ──
console.log('\nCase 6: Boolean coercion edge case');
{
  const llmResponse = JSON.stringify({ approved: "yes", reason: "Looks good" });
  const result = parseReviewResponse(llmResponse);
  assert(result.approved === true, '"yes" string should coerce to true via !!');
}

// ── Summary ──
console.log(`\n═══ RESULTS: ${passed} passed, ${failed} failed ═══\n`);
process.exit(failed > 0 ? 1 : 0);
