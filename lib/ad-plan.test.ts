import assert from 'node:assert/strict';
import { test } from 'node:test';
import { adDuration, buildAdPrompt, newAdPlan, planIssues, sceneTimeline } from './ad-plan';

test('ad timeline is contiguous and prompts separate original voiceover from generated speech and captions', () => {
  const plan = newAdPlan(); plan.product = 'Blue packaging, white logo.';
  plan.scenes.forEach((s, i) => { s.visual = `Product action ${i}.`; s.narration = `Exact words ${i}.`; s.caption = 'Only in editing'; });
  assert.equal(adDuration(plan), 15);
  assert.deepEqual(sceneTimeline(plan).map(s => [s.start, s.end]), [[0, 5], [5, 10], [10, 15]]);
  assert.deepEqual(planIssues(plan), []);
  const original = buildAdPrompt(plan);
  assert.match(original, /added unchanged in editing/);
  assert.ok(!original.includes('Exact words') && !original.includes('Only in editing'));
  const generated = buildAdPrompt({ ...plan, audioMode: 'generated' });
  assert.match(generated, /Dialogue in Lithuanian: "Exact words 0/);
  plan.scenes[0].duration = 2;
  assert.match(buildAdPrompt(plan, 0), /4-second/);
  assert.match(buildAdPrompt(plan, 0), /\[2–4s\] Hold/);
});
test('invalid scene plans cannot be generated', () => {
  const plan = newAdPlan();
  assert.ok(planIssues(plan).length >= 2);
  plan.product = 'Product'; plan.scenes.forEach(s => { s.visual = 'Action'; s.duration = 15; });
  assert.match(planIssues(plan).join(' '), /4–30/);
  plan.scenes[0].duration = 1.5;
  assert.match(planIssues(plan).join(' '), /whole seconds/);
});
